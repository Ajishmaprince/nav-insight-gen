export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-surface/40">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <p className="text-base font-semibold tracking-tight">
            Traff<span className="text-primary">IQ</span>
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Congestion forecasting for everyday commutes. A gradient-boosted model trained
            offline, shipped as static weights, and explained in plain language by AI.
          </p>
        </div>

        <div>
          <p className="text-xs font-medium tracking-wide text-foreground uppercase">Product</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <a href="#forecast" className="transition-colors hover:text-foreground">
                Route forecast
              </a>
            </li>
            <li>
              <a href="#how-it-works" className="transition-colors hover:text-foreground">
                How it works
              </a>
            </li>
            <li>
              <a href="#accuracy" className="transition-colors hover:text-foreground">
                Accuracy &amp; drift
              </a>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-medium tracking-wide text-foreground uppercase">
            Data &amp; privacy
          </p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>Predictions run in your browser</li>
            <li>Feedback stored locally only</li>
            <li>No accounts, no tracking</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border/70">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-xs text-muted-foreground sm:px-8">
          <p>© {new Date().getFullYear()} TraffIQ. Forecasts are estimates, not guarantees.</p>
          <p className="font-mono">Metro Interstate Traffic Volume · offline-trained weights</p>
        </div>
      </div>
    </footer>
  );
}
