"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// The Web Speech API is not in TypeScript's DOM lib, so only the bits used here.
type RecognitionEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
};
type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const RESTART_DELAY_MS = 250;
const MAX_RESTART_TRIES = 4;
const STOP_WAIT_MS = 2500;

function join(a: string, b: string): string {
  const left = a.trim();
  const right = b.trim();
  return left && right ? `${left} ${right}` : left || right;
}

/**
 * Live speech-to-text via the browser's built-in recognition (best in Chrome
 * and Edge). Audio is handled by the browser, never stored here.
 *
 * Chrome ends a recognition session after a pause, so this restarts itself
 * until stop() is called. Text is kept in three parts so nothing is lost
 * across restarts:
 *   committed - text from finished sessions (including words that were still
 *               "interim" when a session ended)
 *   session   - finalised text from the running session
 *   interim   - the in-progress guess, shown greyed out
 * stopAndWait() resolves once the browser has delivered its last words.
 */
export function useSpeech() {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognition = useRef<Recognition | null>(null);
  const wanted = useRef(false);
  const committed = useRef("");
  const session = useRef("");
  const interimRef = useRef("");
  const endWaiters = useRef<Array<() => void>>([]);

  const publish = useCallback(() => {
    setFinalText(join(committed.current, session.current));
    setInterim(interimRef.current);
  }, []);

  useEffect(() => {
    setSupported(getCtor() !== null);
    return () => {
      wanted.current = false;
      recognition.current?.stop();
    };
  }, []);

  const begin = useCallback(
    (attempt: number) => {
      const Ctor = getCtor();
      if (!Ctor) return;

      const rec = new Ctor();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

      rec.onresult = (e) => {
        // Rebuild from every result of this session instead of trusting
        // resultIndex, so a skipped or repeated event can't drop or double text.
        let finals = "";
        let partial = "";
        for (let i = 0; i < e.results.length; i++) {
          const text = e.results[i][0].transcript;
          if (e.results[i].isFinal) finals += text;
          else partial += text;
        }
        session.current = finals;
        interimRef.current = partial;
        publish();
      };

      rec.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          wanted.current = false;
          setError("Microphone access was blocked. Allow it in your browser, or type your answer instead.");
        } else if (e.error === "audio-capture") {
          wanted.current = false;
          setError("No microphone was found. Plug one in, or type your answer instead.");
        } else if (e.error === "network") {
          setError("Speech recognition lost its connection. Your words so far are kept; press stop or keep talking.");
        }
        // "no-speech" and "aborted" are normal pauses; onend restarts.
      };

      rec.onend = () => {
        // Keep whatever was said, even words that never became final.
        committed.current = join(committed.current, join(session.current, interimRef.current));
        session.current = "";
        interimRef.current = "";
        publish();

        if (wanted.current) {
          window.setTimeout(() => {
            if (!wanted.current) return;
            try {
              begin(0);
            } catch {
              if (attempt + 1 < MAX_RESTART_TRIES) begin(attempt + 1);
              else {
                wanted.current = false;
                setListening(false);
                setError("The microphone stopped listening. Press stop to review what was captured.");
              }
            }
          }, RESTART_DELAY_MS);
          return;
        }

        setListening(false);
        const waiters = endWaiters.current;
        endWaiters.current = [];
        waiters.forEach((resolve) => resolve());
      };

      recognition.current = rec;
      rec.start();
    },
    [publish]
  );

  const start = useCallback(() => {
    if (!getCtor()) return;
    setError(null);
    committed.current = "";
    session.current = "";
    interimRef.current = "";
    publish();
    wanted.current = true;
    try {
      begin(0);
      setListening(true);
    } catch {
      wanted.current = false;
      setError("Couldn't start the microphone. Try again, or type your answer instead.");
    }
  }, [begin, publish]);

  /** Stops listening and resolves once the final words have been delivered. */
  const stopAndWait = useCallback((): Promise<void> => {
    wanted.current = false;
    const rec = recognition.current;
    if (!rec) {
      setListening(false);
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      const timer = window.setTimeout(() => {
        // The browser never reported the end; keep what we have.
        committed.current = join(committed.current, join(session.current, interimRef.current));
        session.current = "";
        interimRef.current = "";
        publish();
        setListening(false);
        resolve();
      }, STOP_WAIT_MS);
      endWaiters.current.push(() => {
        window.clearTimeout(timer);
        resolve();
      });
      try {
        rec.stop();
      } catch {
        // already stopped; the timeout above covers it
      }
    });
  }, [publish]);

  /** Everything captured so far, including not-yet-final words. */
  const getText = useCallback(
    () => join(committed.current, join(session.current, interimRef.current)),
    []
  );

  const reset = useCallback(() => {
    committed.current = "";
    session.current = "";
    interimRef.current = "";
    setFinalText("");
    setInterim("");
    setError(null);
  }, []);

  return { supported, listening, finalText, interim, error, start, stopAndWait, getText, reset };
}
