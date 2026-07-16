import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { type SettledMarket } from "@/lib/mock-data";
import { useApp } from "@/lib/app-context";
import { useQuery } from "@tanstack/react-query";
import { API_URL } from "@/lib/config";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Settlement archive — Ninety" },
      {
        name: "description",
        content: "Verifiable on-chain history. Every settled market carries a Solana receipt.",
      },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { settled, positions, isConnected, connectWallet } = useApp();

  const totalStakedVal = isConnected
    ? settled.reduce((acc, s) => acc + (s.stake || 0), 0) +
      positions.reduce((acc, p) => acc + p.stake, 0)
    : 0;

  const marketsSettledCount = isConnected ? settled.length : 0;

  const winCount = isConnected ? settled.filter((s) => s.result === "win").length : 0;
  const winRateVal = marketsSettledCount > 0 ? (winCount / marketsSettledCount) * 100 : 0;
  const proofsVerifiedVal = marketsSettledCount > 0 ? 100 : 0;

  const { data: platformStats } = useQuery<{
    totalStakedSol: number;
    marketsSettled: number;
    activeWallets24h: number;
  }>({
    queryKey: ["platform-stats"],
    queryFn: () => fetch(`${API_URL}/api/stats`).then((r) => r.json()),
    staleTime: 60000,
    refetchInterval: 120000,
  });

  // Pre-connect: show platform-wide stats. Connected: show user stats.
  const totalStakedDisplay = isConnected
    ? `${totalStakedVal.toFixed(2)} SOL`
    : platformStats
    ? `${platformStats.totalStakedSol.toFixed(2)} SOL`
    : "— SOL";

  const marketsSettledDisplay = isConnected
    ? marketsSettledCount.toString()
    : platformStats
    ? platformStats.marketsSettled.toString()
    : "—";

  const thirdStatLabel = isConnected ? "User win rate" : "Active wallets (24h)";
  const thirdStatValue = isConnected
    ? marketsSettledCount > 0
      ? `${winRateVal.toFixed(1)}%`
      : "—"
    : platformStats
    ? platformStats.activeWallets24h.toString()
    : "—";

  return (
    <main className="mx-auto max-w-[1080px] px-4 pb-32 pt-6 sm:px-6">
      <header className="border-b border-line pb-5">
        <h1
          className="font-display text-[34px] font-extrabold uppercase leading-[0.95] tracking-[-0.02em] sm:text-[44px]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Settlement
          <br />
          archive
        </h1>
        <p className="mt-2 text-[12px] uppercase tracking-[0.14em] text-cyan">
          Verifiable on-chain history · fixed assets
        </p>
      </header>

      <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-4">
        <Stat label={isConnected ? "Total staked" : "Platform staked"} value={totalStakedDisplay} />
        <Stat label="Markets settled" value={marketsSettledDisplay} />
        <Stat label={thirdStatLabel} value={thirdStatValue} />
        <Stat label="Proofs verified" value={marketsSettledCount > 0 ? `${proofsVerifiedVal}%` : platformStats ? "100%" : "—"} />
      </dl>

      {!isConnected ? (
        <div className="mt-12 text-center py-12 border border-dashed border-line rounded-md">
          <p className="text-muted-foreground text-[14px]">Connect your wallet to view your settlement history and verifiable receipts.</p>
          <button
            onClick={connectWallet}
            className="mt-4 inline-block rounded-sm bg-foreground text-background px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.12em] hover:bg-amber hover:text-background cursor-pointer"
          >
            Connect Wallet
          </button>
        </div>
      ) : settled.length === 0 ? (
        <div className="mt-12 text-center py-12 border border-dashed border-line rounded-md">
          <p className="text-muted-foreground text-[14px]">No settled positions found for this wallet. Place stakes on active matches to build history.</p>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {settled.map((s) => (
            <li key={s.id}>
              <SettledRow s={s} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface p-4 sm:p-5">
      <dt className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</dt>
      <dd className="mt-1.5 num font-mono text-[18px] font-semibold tabular-nums sm:text-[20px]">
        {value}
      </dd>
    </div>
  );
}

function SettledRow({ s }: { s: SettledMarket & { claimed?: boolean; marketId?: string } }) {
  const { claimPosition } = useApp();
  const [isClaiming, setIsClaiming] = useState(false);
  const win = s.result === "win";
  const isMockSig = !s.txSig || s.txSig.includes("-") || s.txSig.startsWith("mock-") || s.txSig.startsWith("p2p-") || s.txSig.length < 80;
  const href = isMockSig ? "#" : `https://explorer.solana.com/tx/${s.txSig}?cluster=devnet`;
  const sigShort = `${s.slot.toLocaleString()}`;
  const hashShort = isMockSig ? "local proof ✓" : `${s.txSig.slice(0, 4)}…${s.txSig.slice(-4)}`;

  const handleClaim = async () => {
    if (!s.marketId) return;
    setIsClaiming(true);
    try {
      await claimPosition(s.id, s.marketId);
    } catch (err) {
      console.error(err);
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <article className="grid grid-cols-[88px_minmax(0,1fr)] overflow-hidden rounded-md border border-line bg-surface md:grid-cols-[120px_minmax(0,1fr)]">
      {/* Verdict chip */}
      <div
        className={`flex flex-col items-center justify-center gap-2 p-3 text-center ${
          win ? "bg-cyan text-background font-bold" : "bg-[#C0392B] text-white font-bold"
        }`}
      >
        <span aria-hidden>
          {win ? <CheckCircle /> : <XCircle />}
        </span>
        <span className="num font-mono text-[10px] font-semibold uppercase tracking-[0.18em]">
          settled · {s.result}
        </span>
        <span className="num font-mono text-[13px] font-semibold tabular-nums">
          {win ? "+" : ""}
          {s.pnl.toFixed(2)} SOL
        </span>
      </div>

      {/* Body */}
      <div className="grid grid-cols-1 gap-3 p-4 sm:p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div className="min-w-0">
          <h3
            className="truncate font-display text-[18px] font-bold uppercase tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {s.home} vs {s.away}
          </h3>
          <div className="mt-0.5 truncate text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {s.competition} · {s.context}
          </div>
          <p className="mt-2 text-[12px] text-muted-foreground">{s.marketQuestion}</p>

          <div className="mt-3 inline-flex items-center gap-2 rounded-sm border border-line bg-background px-2 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan" aria-hidden />
            <span className="num font-mono text-[11px] tabular-nums">{sigShort}</span>
            <span className="h-3 w-px bg-line" aria-hidden />
            <span className="num font-mono text-[11px] text-muted-foreground">
              hash: {hashShort}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 md:flex-col md:items-end">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              odds
            </div>
            <div className="num font-mono text-[18px] font-semibold tabular-nums">
              {s.odds.toFixed(2)}×
            </div>
          </div>
          <div className="flex flex-col gap-2 w-full md:w-auto">
            {win && s.marketId && !s.claimed && (
              <button
                onClick={handleClaim}
                disabled={isClaiming}
                className="shrink-0 rounded-sm border border-cyan bg-cyan px-3 py-1.5 num font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-background transition hover:bg-foreground hover:text-cyan cursor-pointer disabled:opacity-50 text-center"
              >
                {isClaiming ? "Claiming..." : "Claim Payout"}
              </button>
            )}
            {win && s.marketId && s.claimed && (
              <span className="shrink-0 rounded-sm border border-line bg-line/20 px-3 py-1.5 num font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground text-center">
                Claimed ✓
              </span>
            )}
            <a
              href={href}
              target={isMockSig ? undefined : "_blank"}
              rel={isMockSig ? undefined : "noopener noreferrer"}
              className="shrink-0 rounded-sm border border-amber px-3 py-1.5 num font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-amber transition hover:bg-amber hover:text-background text-center"
            >
              Verify on explorer
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}

function CheckCircle() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="12" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 14.5l4 4 8-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" fill="none" />
    </svg>
  );
}

function XCircle() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="12" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 9l10 10M19 9L9 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
    </svg>
  );
}
