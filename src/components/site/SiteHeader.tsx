import { Link } from "@tanstack/react-router";

import { useAuth } from "@/hooks/useAuth";

const NAV = [
  { label: "Forecast", href: "#forecast" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Accuracy", href: "#accuracy" },
];

export function SiteHeader() {
  const { session } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
        <a href="#top" className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-primary/15 ring-1 ring-primary/40">
            <svg
              viewBox="0 0 24 24"
              className="size-4 text-primary"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M4 20V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v13" />
              <path d="M12 4v16M4 12h4M16 12h4" />
            </svg>
          </span>
          <span className="text-base font-semibold tracking-tight">
            Traff<span className="text-primary">IQ</span>
          </span>
        </a>

        <nav aria-label="Primary" className="hidden items-center gap-7 md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
            <span className="size-1.5 animate-pulse rounded-full bg-low" />
            Model online
          </span>
          {session ? (
            <Link
              to="/dashboard"
              className="rounded-lg border border-border bg-secondary px-3.5 py-2 text-xs font-semibold text-secondary-foreground transition-colors hover:border-primary/50"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              to="/auth"
              className="rounded-lg border border-border bg-secondary px-3.5 py-2 text-xs font-semibold text-secondary-foreground transition-colors hover:border-primary/50"
            >
              Sign in
            </Link>
          )}
          <a
            href="#forecast"
            className="rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Run a forecast
          </a>
        </div>
      </div>
    </header>
  );
}
