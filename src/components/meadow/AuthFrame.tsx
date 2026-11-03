import type { ReactNode } from "react";
import { MeadowScope } from "./MeadowScope";
import { ThemeToggle, Wordmark } from "./ui";

/** Shared frame for login, signup, onboarding and email verification. */
export function AuthFrame({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <MeadowScope>
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 sm:px-6">
        <header className="flex h-16 items-center justify-between">
          <Wordmark />
          <ThemeToggle />
        </header>
        <main
          className={`mx-auto flex w-full flex-1 flex-col justify-center gap-6 py-8 ${wide ? "max-w-xl" : "max-w-md"}`}
        >
          <div className="rounded-mw-xl bg-surface-raised p-6 shadow-mw-card sm:p-8">{children}</div>
        </main>
      </div>
    </MeadowScope>
  );
}
