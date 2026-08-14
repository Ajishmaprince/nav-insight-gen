import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — TraffIQ Traffic Intelligence" },
      {
        name: "description",
        content:
          "Sign in to TraffIQ to save route forecasts, track prediction accuracy and open your commute dashboard.",
      },
      { property: "og:title", content: "Sign in — TraffIQ" },
      {
        property: "og:description",
        content: "Access your saved congestion forecasts and commute dashboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) void navigate({ to: "/", replace: true });
  }, [loading, session, navigate]);

  function friendly(message: string) {
    const m = message.toLowerCase();
    if (m.includes("invalid login credentials"))
      return "That email and password don't match an account. Check them, or create an account.";
    if (m.includes("email not confirmed"))
      return "Please confirm your email from the link we sent, then sign in.";
    if (m.includes("user already registered") || m.includes("already been registered"))
      return "An account with this email already exists — sign in instead.";
    if (m.includes("password should be at least"))
      return "Use a password with at least 6 characters.";
    if (m.includes("rate limit") || m.includes("too many"))
      return "Too many attempts. Please wait a minute and try again.";
    if (m.includes("failed to fetch") || m.includes("network"))
      return "Network problem — check your connection and try again.";
    return message;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Use a password with at least 6 characters.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signin") {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (err) throw err;
        void navigate({ to: "/", replace: true });
      } else {
        const { error: err } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (err) throw err;
        setNotice("Account created. Check your inbox to confirm your email, then sign in.");
        setMode("signin");
      }
    } catch (err) {
      setError(friendly(err instanceof Error ? err.message : "Something went wrong. Try again."));
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setError(null);
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError("Google sign-in failed. Please try again.");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    void navigate({ to: "/", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border/70">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link to="/" className="text-base font-semibold tracking-tight">
            Traff<span className="text-primary">IQ</span>
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            Back to site
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">
          {mode === "signin" ? "Sign in to TraffIQ" : "Create your TraffIQ account"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Save forecasts, review your commute history and track how well the model performs on
          your routes.
        </p>

        <div className="panel mt-8 p-6">
          <button
            type="button"
            onClick={onGoogle}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground transition-colors hover:border-primary/50 disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
              <path
                fill="currentColor"
                d="M21.35 11.1h-9.17v2.96h5.27c-.23 1.37-1.62 4.02-5.27 4.02-3.17 0-5.76-2.62-5.76-5.86s2.59-5.86 5.76-5.86c1.8 0 3.01.77 3.7 1.43l2.52-2.43C16.75 3.85 14.68 3 12.18 3 7.03 3 2.86 7.14 2.86 12.22S7.03 21.44 12.18 21.44c5.35 0 8.88-3.76 8.88-9.05 0-.61-.07-1.07-.17-1.29Z"
              />
            </svg>
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3 text-[11px] tracking-wide text-muted-foreground uppercase">
            <span className="h-px flex-1 bg-border" />
            or use email
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div>
              <label
                htmlFor="email"
                className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field mt-1.5"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field mt-1.5"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}
            {notice && <p className="text-xs text-low">{notice}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            {mode === "signin" ? "New to TraffIQ?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
                setNotice(null);
              }}
              className="font-semibold text-primary hover:underline"
            >
              {mode === "signin" ? "Create an account" : "Sign in instead"}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
