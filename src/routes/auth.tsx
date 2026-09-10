import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, ArrowRight, MapPin, ShieldCheck, Sparkles } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import heroHighway from "@/assets/hero-highway.jpg";

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
        const { data, error: err } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (err) throw err;
        if (data.session) {
          void navigate({ to: "/", replace: true });
        } else {
          setNotice("Account created. Check your inbox to confirm your email, then sign in.");
          setMode("signin");
        }
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
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(440px,0.95fr)]">
      <aside className="command-sidebar relative hidden min-h-screen overflow-hidden lg:block">
        <img
          src={heroHighway}
          alt="City traffic moving through Bengaluru at dusk"
          className="absolute inset-0 size-full object-cover opacity-45"
        />
        <div className="absolute inset-0 bg-foreground/75" />
        <div className="relative flex min-h-screen flex-col justify-between p-10 xl:p-14">
          <Link to="/" className="flex items-center gap-3 text-lg font-semibold tracking-tight text-primary-foreground">
            <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground shadow-lg">
              <Activity className="size-5" aria-hidden="true" />
            </span>
            Traff<span className="text-sky">IQ</span>
          </Link>

          <div className="max-w-xl pb-10">
            <p className="mb-6 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-sky">
              <span className="size-2 rounded-full bg-accent" />
              Route intelligence, made personal
            </p>
            <h2 className="display-title max-w-lg text-6xl leading-[0.95] text-primary-foreground xl:text-7xl">
              Know the road before you take it.
            </h2>
            <p className="mt-7 max-w-md text-base leading-relaxed text-primary-foreground/70">
              Turn Bengaluru traffic patterns into a calmer, more predictable commute with forecasts that fit your day.
            </p>
            <div className="mt-10 grid max-w-md grid-cols-2 gap-3">
              <div className="rounded-xl border border-primary-foreground/15 bg-primary-foreground/10 p-4 backdrop-blur-sm">
                <MapPin className="size-4 text-accent" aria-hidden="true" />
                <p className="mt-5 text-2xl font-semibold text-primary-foreground">13</p>
                <p className="mt-1 text-xs text-primary-foreground/60">observed corridors</p>
              </div>
              <div className="rounded-xl border border-primary-foreground/15 bg-primary-foreground/10 p-4 backdrop-blur-sm">
                <Sparkles className="size-4 text-accent" aria-hidden="true" />
                <p className="mt-5 text-2xl font-semibold text-primary-foreground">AI</p>
                <p className="mt-1 text-xs text-primary-foreground/60">route guidance</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-primary-foreground/45">Observed traffic records from Bengaluru, Karnataka</p>
        </div>
      </aside>

      <main className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-5 py-6 sm:px-10 lg:px-14">
          <Link to="/" className="flex items-center gap-2 text-base font-semibold tracking-tight lg:hidden">
            <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-foreground">
              <Activity className="size-4" aria-hidden="true" />
            </span>
            Traff<span className="text-primary">IQ</span>
          </Link>
          <span className="hidden text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground lg:block">Private forecast workspace</span>
          <Link to="/" className="ml-auto text-sm text-muted-foreground transition-colors hover:text-foreground">
            Back to site <ArrowRight className="ml-1 inline size-3.5" aria-hidden="true" />
          </Link>
        </header>

        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 pb-14 pt-6 sm:px-10 lg:px-14 lg:py-16">
          <div className="mb-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Welcome back</p>
            <h1 className="display-title text-5xl leading-none text-foreground sm:text-6xl">
              {mode === "signin" ? "Your next move starts here." : "Build your calmer commute."}
            </h1>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">
              {mode === "signin"
                ? "Sign in to save forecasts, review your commute history and track how the model performs on your routes."
                : "Create your account to save route forecasts and build a clearer picture of your daily travel."}
            </p>
          </div>

          <div className="panel p-6 shadow-panel sm:p-8">
            <Button type="button" variant="outline" onClick={onGoogle} disabled={busy} className="h-12 w-full rounded-xl bg-secondary text-secondary-foreground">
              <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M21.35 11.1h-9.17v2.96h5.27c-.23 1.37-1.62 4.02-5.27 4.02-3.17 0-5.76-2.62-5.76-5.86s2.59-5.86 5.76-5.86c1.8 0 3.01.77 3.7 1.43l2.52-2.43C16.75 3.85 14.68 3 12.18 3 7.03 3 2.86 7.14 2.86 12.22S7.03 21.44 12.18 21.44c5.35 0 8.88-3.76 8.88-9.05 0-.61-.07-1.07-.17-1.29Z"
                />
              </svg>
              Continue with Google
            </Button>

            <div className="my-6 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or use email
              <span className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={onSubmit} className="space-y-5" noValidate>
              <div>
                <label htmlFor="email" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Email
                </label>
                <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field mt-2 h-12" placeholder="you@example.com" />
              </div>
              <div>
                <label htmlFor="password" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Password
                </label>
                <input id="password" type="password" required minLength={6} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="field mt-2 h-12" placeholder="••••••••" />
              </div>

              {error && <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-xs leading-relaxed text-destructive">{error}</p>}
              {notice && <p role="status" className="rounded-lg border border-low/20 bg-low/10 px-3 py-2.5 text-xs leading-relaxed text-low">{notice}</p>}

              <Button type="submit" disabled={busy} className="h-12 w-full rounded-xl text-sm font-semibold">
                {busy ? "Please wait…" : mode === "signin" ? "Sign in to TraffIQ" : "Create my account"}
                {!busy && <ArrowRight className="size-4" aria-hidden="true" />}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              {mode === "signin" ? "New to TraffIQ?" : "Already have an account?"}{" "}
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => {
                  setMode(mode === "signin" ? "signup" : "signin");
                  setError(null);
                  setNotice(null);
                }}
                className="h-auto p-0 font-semibold"
              >
                {mode === "signin" ? "Create an account" : "Sign in instead"}
              </Button>
            </p>
          </div>

          <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-low" aria-hidden="true" />
            Your saved forecasts are private to your account.
          </p>
        </div>
    </div>
  );
}
