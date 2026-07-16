import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { API_URL } from "../lib/config";

export const Route = createFileRoute("/verify/$stakeId")({
  head: () => ({
    meta: [{ title: "Verify Receipt — Ninety" }],
  }),
  component: VerifyPage,
});

function shortSig(sig?: string | null): string {
  if (!sig) return "—";
  if (sig.length < 12) return sig;
  return `${sig.slice(0, 6)}…${sig.slice(-6)}`;
}

function formatDateTime(dt?: string | null): string {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function VerifyPage() {
  const { stakeId } = Route.useParams();
  const [stake, setStake] = useState<any>(null);
  const [status, setStatus] = useState<"loading" | "found" | "not-found">("loading");

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/stakes/verify/${encodeURIComponent(stakeId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data) {
          setStake(data);
          setStatus("found");
        } else {
          setStatus("not-found");
        }
      })
      .catch(() => !cancelled && setStatus("not-found"));
    return () => {
      cancelled = true;
    };
  }, [stakeId]);

  if (status === "loading") {
    return (
      <main className="mx-auto max-w-[640px] px-4 pb-32 pt-12 text-center">
        <p className="text-[13px] text-muted-foreground animate-pulse">Looking up receipt…</p>
      </main>
    );
  }

  if (status === "not-found" || !stake) {
    return (
      <main className="mx-auto max-w-[640px] px-4 pb-32 pt-12 text-center">
        <h1 className="font-display text-xl font-bold">Receipt not found</h1>
        <p className="mt-2 text-[13px] text-muted-foreground">
          No stake matches that id or on-chain pubkey.
        </p>
        <Link to="/" className="mt-6 inline-block rounded bg-amber px-4 py-2 text-xs font-bold text-background hover:bg-amber/90 transition">
          Back to lobby
        </Link>
      </main>
    );
  }

  const market = stake.market;
  const match = market?.match;

  const amtSol = (Number(stake.amount_lamports) / 1e9).toFixed(3);
  const won =
    (stake.side === "yes" && market?.outcome === true) ||
    (stake.side === "no" && market?.outcome === false);

  // Uses the real recorded claim payout when available; otherwise a rough pari-mutuel
  // estimate — this is display-only, the actual payout is computed on-chain at claim time.
  const payoutSol = stake.claim_payout_lamports
    ? (Number(stake.claim_payout_lamports) / 1e9).toFixed(3)
    : won
    ? (Number(stake.amount_lamports) / 1e9 * 1.8).toFixed(3)
    : "0.000";
  const cluster = "?cluster=devnet";
  const explorerBase = "https://explorer.solana.com";

  return (
    <main className="mx-auto max-w-[640px] px-4 pb-32 pt-8 sm:px-6">
      <div className="rounded-xl border border-line bg-surface overflow-hidden">
        <div className="border-b border-line px-6 py-4 flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            On-chain verified receipt
          </span>
          <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded font-bold ${
            won ? "bg-cyan/10 text-cyan" : "bg-red-500/10 text-red-400"
          }`}>
            {market?.status === "settled" ? (won ? "WON" : "LOST") : "PENDING"}
          </span>
        </div>

        <div className="px-6 py-6 space-y-5">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground mb-1">
              Match
            </div>
            <h1 className="font-display text-[22px] font-extrabold tracking-tight">
              {match?.home_team ?? "?"} {match?.score_home ?? 0}–{match?.score_away ?? 0} {match?.away_team ?? "?"}
            </h1>
            <div className="text-[11px] text-muted-foreground font-mono">
              {match?.competition} · {formatDateTime(match?.kickoff_at)}
            </div>
          </div>

          <div className="rounded-lg bg-amber/5 border border-amber/20 px-4 py-3">
            <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-amber mb-1">
              Prediction
            </div>
            <p className="text-[14px] font-semibold text-foreground">
              {market?.question ?? "—"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-line bg-background px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground mb-1">
                Position
              </div>
              <div className="font-mono text-[16px] font-bold text-foreground">
                {stake.side?.toUpperCase()} · {amtSol} SOL
              </div>
            </div>
            <div className={`rounded-lg border px-4 py-3 ${won ? "border-cyan/30 bg-cyan/5" : "border-red-500/20 bg-red-500/5"}`}>
              <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground mb-1">
                Outcome
              </div>
              <div className={`font-mono text-[16px] font-bold ${won ? "text-cyan" : "text-red-400"}`}>
                {market?.status !== "settled"
                  ? "Pending"
                  : won
                  ? `+${payoutSol} SOL`
                  : `–${amtSol} SOL`}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
              Settlement proof
            </div>
            {stake.settlement_tx_signature ? (
              <a
                href={`${explorerBase}/tx/${stake.settlement_tx_signature}${cluster}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-lg border border-amber/30 bg-amber/5 px-4 py-2.5 text-amber hover:bg-amber/10 transition"
              >
                <span className="text-[11px] font-mono">TX: {shortSig(stake.settlement_tx_signature)}</span>
                <span className="text-[12px]">↗</span>
              </a>
            ) : (
              <div className="text-[12px] text-muted-foreground font-mono px-4 py-2.5 border border-line rounded-lg">
                Settlement pending
              </div>
            )}

            {stake.claim_tx_signature && (
              <a
                href={`${explorerBase}/tx/${stake.claim_tx_signature}${cluster}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-lg border border-cyan/30 bg-cyan/5 px-4 py-2.5 text-cyan hover:bg-cyan/10 transition"
              >
                <span className="text-[11px] font-mono">Claim TX: {shortSig(stake.claim_tx_signature)}</span>
                <span className="text-[12px]">↗</span>
              </a>
            )}

            {stake.nft_mint_address && (
              <a
                href={`${explorerBase}/address/${stake.nft_mint_address}${cluster}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-lg border border-cyan/30 bg-cyan/5 px-4 py-2.5 text-cyan hover:bg-cyan/10 transition"
              >
                <span className="text-[11px] font-mono">NFT: {shortSig(stake.nft_mint_address)}</span>
                <span className="text-[12px]">↗</span>
              </a>
            )}
          </div>

          {market?.status === "settled" && (
            <div className="text-[11px] text-muted-foreground font-mono text-right">
              Settled {formatDateTime(stake.updated_at ?? stake.created_at)}
            </div>
          )}
        </div>

        <div className="border-t border-line px-6 py-4 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground font-mono">Ninety Protocol</span>
          <Link
            to={match?.id ? `/match/$matchId` : "/"}
            params={match?.id ? { matchId: match.id } : undefined}
            className="inline-flex items-center gap-1.5 rounded bg-amber px-3 py-1.5 text-[12px] font-bold text-background hover:bg-amber/90 transition"
          >
            Stake on next market →
          </Link>
        </div>
      </div>
    </main>
  );
}
