import "server-only";

/**
 * Tiny server-only wrapper around Groq's OpenAI-compatible Chat Completions
 * endpoint. We talk to it with plain `fetch` on purpose — no extra SDK to
 * keep in sync, and it keeps the API key strictly on the server (this file
 * can never be imported into a client component thanks to `server-only`).
 *
 * The key comes from GROQ_API_KEY. It is intentionally OPTIONAL at boot (see
 * src/lib/env.ts) so the rest of the app still runs for anyone who hasn't set
 * it up yet — we only fail, with a clear message, at the moment a request
 * actually tries to use it.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

/**
 * A current, strong general-purpose Groq model. Override with GROQ_MODEL.
 * Groq regularly deprecates/replaces hosted models — if this ever 404s with
 * "model_not_found", check `GET https://api.groq.com/openai/v1/models`
 * (with your API key) for what's currently active and swap it in.
 */
const DEFAULT_MODEL = "openai/gpt-oss-120b";

type GroqChatArgs = {
  system: string;
  user: string;
  /** Ask the model to return a single JSON object. Defaults to true. */
  json?: boolean;
  model?: string;
  temperature?: number;
};

/**
 * Sends one system + one user message and returns the raw assistant text.
 * Throws on a missing key or any non-2xx response so callers can map it to a
 * friendly error.
 */
export async function groqChat({
  system,
  user,
  json = true,
  model,
  temperature = 0.2,
}: GroqChatArgs): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not set. Add it to your .env file (see .env.example)."
    );
  }

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model ?? process.env.GROQ_MODEL ?? DEFAULT_MODEL,
      temperature,
      ...(json ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Groq API error ${res.status}: ${detail.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("Groq returned an empty response.");
  }
  return content;
}
