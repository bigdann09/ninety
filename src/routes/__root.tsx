import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { ConnectionProvider, WalletProvider, useWallet } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { Buffer } from "buffer";

import appCss from "../styles.css?url";

if (typeof window !== "undefined") {
  (window as any).Buffer = (window as any).Buffer || Buffer;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#0B1410" },
      { title: "Ninety — on-chain micro-markets for live football" },
      {
        name: "description",
        content:
          "Short-duration prediction markets on live football matches. Settled on-chain on Solana — every market carries its own verifiable receipt.",
      },
      { property: "og:title", content: "Ninety — on-chain micro-markets for live football" },
      {
        property: "og:description",
        content:
          "Short-duration prediction markets on live football matches. Settled on-chain on Solana — every market carries its own verifiable receipt.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;500;600&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

import { AppProvider, useApp } from "../lib/app-context";
import { Toaster } from "sonner";
import { NotificationPoller } from "../components/NotificationPoller";
import { SolarProvider } from "@solar-icons/react";

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

const endpoint = "https://api.devnet.solana.com";

// @solana/web3.js's Connection has no default timeout on its RPC calls — a stalled
// connection (not a clean network error, just no response) leaves fetch pending
// indefinitely. That hang happens inside getLatestBlockhash(), which runs *before*
// wallet.signTransaction() is ever called, so the symptom is exactly "stake button says
// Staking... forever, Phantom's approve popup never even appears" — the try/catch around
// the stake call can't help because a promise that never settles is never caught. This
// wraps every RPC call in a timeout so a stall becomes a rejection instead of a hang.
const connectionConfig = {
  commitment: "confirmed" as const,
  fetch: (url: RequestInfo | URL, init?: RequestInit) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
  },
};

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const [walletsList, setWalletsList] = useState<any[]>([]);

  useEffect(() => {
    setWalletsList([
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ]);
  }, []);

  return (
    <SolarProvider value={{ weight: "Linear" }}>
      <QueryClientProvider client={queryClient}>
        <ConnectionProvider endpoint={endpoint} config={connectionConfig}>
          <WalletProvider wallets={walletsList} autoConnect>
            <AppProvider>
              <AppLayout />
            </AppProvider>
          </WalletProvider>
        </ConnectionProvider>
      </QueryClientProvider>
    </SolarProvider>
  );
}

function AppLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      <div className="flex-1">
        <Outlet />
      </div>
      <WalletModal />
      <NotificationPoller />
      <Toaster theme="dark" position="bottom-right" richColors />
    </div>
  );
}

function WalletModal() {
  const { isWalletModalOpen, setIsWalletModalOpen } = useApp();
  const { wallets, select, connect } = useWallet();

  if (!isWalletModalOpen) return null;

  const handleConnect = async (walletName: any) => {
    try {
      select(walletName);
      setTimeout(async () => {
        try {
          await connect();
          setIsWalletModalOpen?.(false);
        } catch (e) {
          console.error("Failed to connect:", e);
        }
      }, 100);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm transition-all duration-300">
      <div className="w-full max-w-sm overflow-hidden rounded-md border border-line bg-surface shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="font-display text-[16px] font-bold uppercase tracking-tight">
            Connect wallet
          </h3>
          <button
            onClick={() => setIsWalletModalOpen?.(false)}
            className="text-muted-foreground hover:text-foreground transition text-[11px] uppercase tracking-[0.14em] cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* Wallets list */}
        <div className="p-5 flex flex-col gap-3">
          {wallets.length === 0 ? (
            <div className="text-[12px] text-muted-foreground text-center py-4">
              No wallet extensions found.
            </div>
          ) : (
            wallets.map((w) => (
              <button
                key={w.adapter.name}
                onClick={() => handleConnect(w.adapter.name)}
                className="flex items-center justify-between rounded-sm border border-line bg-background/50 px-4 py-3 text-left transition hover:border-amber group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  {w.adapter.icon && (
                    <img
                      src={w.adapter.icon}
                      alt={w.adapter.name}
                      className="h-6 w-6 shrink-0"
                    />
                  )}
                  <span className="text-[13px] font-semibold tracking-wide">
                    {w.adapter.name}
                  </span>
                </div>
                <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground group-hover:text-amber transition">
                  {w.readyState === "Installed" ? "Detected" : "Select"}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Header() {
  const { isConnected, walletAddress, walletBalance, connectWallet, disconnectWallet } = useApp();
  const router = useRouter();
  
  // Determine active nav tab
  const pathname = router.state.location.pathname;
  const isMarketsActive = pathname === "/" || pathname.startsWith("/match/");
  const isStakesActive = pathname === "/stakes";
  const isStreakActive = pathname === "/streak";
  const isHistoryActive = pathname === "/history";
  const isSettingsActive = pathname === "/settings";

  const shortAddress = `${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}`;

  return (
    <header className="border-b border-line bg-background">
      <div className="mx-auto max-w-[1080px] px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-1.5 group">
          <span 
            className="font-display text-[22px] font-extrabold tracking-tight text-foreground transition group-hover:text-amber"
            style={{ fontFamily: "var(--font-display)" }}
          >
            ninety<span className="text-amber">.</span>
          </span>
        </Link>

        {/* Nav Links */}
        <nav className="flex items-center gap-6 md:gap-8">
          <Link
            to="/"
            className={`relative py-5 text-[11px] font-semibold uppercase tracking-[0.14em] transition hover:text-foreground ${
              isMarketsActive ? "text-foreground font-bold" : "text-muted-foreground"
            }`}
          >
            Markets
            {isMarketsActive && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-amber" />
            )}
          </Link>
          <Link
            to="/stakes"
            className={`relative py-5 text-[11px] font-semibold uppercase tracking-[0.14em] transition hover:text-foreground ${
              isStakesActive ? "text-foreground font-bold" : "text-muted-foreground"
            }`}
          >
            Stakes
            {isStakesActive && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-amber" />
            )}
          </Link>
          <Link
            to="/streak"
            className={`relative py-5 text-[11px] font-semibold uppercase tracking-[0.14em] transition hover:text-foreground ${
              isStreakActive ? "text-foreground font-bold" : "text-muted-foreground"
            }`}
          >
            Streak
            {isStreakActive && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-amber" />
            )}
          </Link>
          <Link
            to="/history"
            className={`relative py-5 text-[11px] font-semibold uppercase tracking-[0.14em] transition hover:text-foreground ${
              isHistoryActive ? "text-foreground font-bold" : "text-muted-foreground"
            }`}
          >
            History
            {isHistoryActive && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-amber" />
            )}
          </Link>
          <Link
            to="/settings"
            className={`relative py-5 text-[11px] font-semibold uppercase tracking-[0.14em] transition hover:text-foreground ${
              isSettingsActive ? "text-foreground font-bold" : "text-muted-foreground"
            }`}
          >
            Settings
            {isSettingsActive && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-amber" />
            )}
          </Link>
        </nav>

        {/* Wallet pill or Connect */}
        <div>
          {isConnected ? (
            <button
              onClick={disconnectWallet}
              className="bg-surface hover:bg-surface-2 border border-line rounded-md px-3 py-1.5 flex items-center gap-2 num font-mono text-[12px] text-foreground transition cursor-pointer"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-cyan" />
              <span>{shortAddress}</span>
              <span className="text-muted-foreground">|</span>
              <span className="tabular-nums">{walletBalance.toFixed(2)} SOL</span>
            </button>
          ) : (
            <button
              onClick={connectWallet}
              className="bg-foreground text-background font-semibold px-4 py-1.5 rounded-sm hover:bg-amber hover:text-background transition text-[11px] uppercase tracking-[0.14em] cursor-pointer"
            >
              Connect
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
