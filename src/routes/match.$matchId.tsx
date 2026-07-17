import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@anchor-lang/core";
import { Buffer } from "buffer";
import { useApp } from "../lib/app-context";
import { FlagImg } from "../lib/flags";
import { API_URL, NINETY_PROGRAM_ID } from "../lib/config";
import { toast } from "sonner";
import { Sparkles, Activity, MessageSquare, Send, Share2 } from "lucide-react";
import { io, Socket } from "socket.io-client";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function toBytes32(str: string): number[] {
  const buf = Buffer.alloc(32);
  buf.write(str, "utf-8");
  return Array.from(buf);
}

export const Route = createFileRoute("/match/$matchId")({
  head: ({ params }) => ({
    meta: [
      { title: `Match · ${params.matchId} — Ninety` },
      {
        name: "description",
        content: "Live micro-markets for this fixture, settled on Solana.",
      },
    ],
  }),
  loader: ({ params }) => {
    return { matchId: params.matchId };
  },
  component: MatchPage,
});

type Side = { label: string; price: number; pool: number; votes: number };
type Market = {
  id: string;
  market_type: string;
  question: string;
  window: string;
  closesInSec: number | null;
  totalPool: number;
  yes: Side;
  no: Side;
  settled?: { outcome: "Yes" | "No"; settledAt: string; txSig: string; slot: number };
};

function MatchPage() {
  const { matchId } = Route.useParams();
  const { matches, fetchCopilot, settled, isConnected } = useApp();
  const [now, setNow] = useState(0);
  const [copilot, setCopilot] = useState<any>(null);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  const fixture = matches.find((m) => m.id === matchId);

  useEffect(() => {
    const t = setInterval(() => setNow((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Poll AI Copilot commentary & probabilities
  useEffect(() => {
    if (!fixture) return;
    const fetchCopilotData = async () => {
      const data = await fetchCopilot(fixture.id);
      setCopilot(data);
    };
    fetchCopilotData();
    const interval = setInterval(fetchCopilotData, 6000);
    return () => clearInterval(interval);
  }, [fixture]);

  const MARKETS = useMemo(() => {
    if (!fixture) return [];
    return (fixture.rawMarkets || []).map((m: any) => {
      const kickoff = new Date(fixture.kickoffAt || Date.now()).getTime();
      const opensMin = Math.max(0, Math.floor((new Date(m.opens_at).getTime() - kickoff) / 60000));
      const closesMin = Math.max(0, Math.floor((new Date(m.closes_at).getTime() - kickoff) / 60000));
      
      const remainingSec = Math.max(0, Math.floor((new Date(m.closes_at).getTime() - Date.now()) / 1000));
      
      const dbStakes = m.stakes || [];
      const yesDbLamports = dbStakes.filter((st: any) => st.side === "yes").reduce((sum: number, st: any) => sum + Number(st.amount_lamports), 0);
      const noDbLamports = dbStakes.filter((st: any) => st.side === "no").reduce((sum: number, st: any) => sum + Number(st.amount_lamports), 0);

      const yesDbSol = yesDbLamports / 1e9;
      const noDbSol = noDbLamports / 1e9;

      const yesPoolSol = yesDbSol;
      const noPoolSol = noDbSol;
      const totalPoolSol = yesPoolSol + noPoolSol;

      const yesPrice = totalPoolSol > 0 ? yesPoolSol / totalPoolSol : 0.5;
      const noPrice = totalPoolSol > 0 ? noPoolSol / totalPoolSol : 0.5;

      const yesPool = Math.round(yesPoolSol * 1000);
      const noPool = Math.round(noPoolSol * 1000);
      const totalPool = yesPool + noPool;

      const yesVotes = m.yesVotes ?? dbStakes.filter((st: any) => st.side === "yes").length;
      const noVotes = m.noVotes ?? dbStakes.filter((st: any) => st.side === "no").length;

      return {
        id: String(m.id),
        market_type: String(m.market_type || ""),
        question: String(m.question || ""),
        window: `${ordinal(opensMin)} → ${ordinal(closesMin)} min`,
        closesInSec: m.status === "open" ? remainingSec : null,
        totalPool,
        yes: { label: "Yes", price: yesPrice, pool: yesPool, votes: yesVotes },
        no: { label: "No", price: noPrice, pool: noPool, votes: noVotes },
        settled: m.status === "settled" ? {
          outcome: (m.outcome === true || m.outcome === "yes" || m.outcome === "Yes" ? "Yes" : "No") as "Yes" | "No",
          settledAt: `${ordinal(closesMin)} min · Settled on-chain`,
          txSig: String(m.resolution_event_hash || "mock-signature"),
          slot: 301229104
        } : undefined
      } satisfies Market;
    });
  }, [fixture, now]);

  const livePools = useMemo(
    () =>
      MARKETS.map((m) => {
        return m.totalPool;
      }),
    [MARKETS],
  );

  const userMatchReceipts = useMemo(() => {
    if (!isConnected || !fixture) return [];
    return settled.filter((s) => s.home === fixture.home && s.away === fixture.away);
  }, [settled, fixture, isConnected]);

  if (!fixture) {
    return (
      <main className="mx-auto max-w-[680px] px-4 py-16 text-center sm:px-6">
        <h1 className="font-display text-[28px] font-bold">Loading match details...</h1>
        <p className="mt-2 text-[13px] text-muted-foreground animate-pulse">
          Establishing connection to the pitch feed...
        </p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-sm border border-foreground px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] hover:bg-foreground hover:text-background"
        >
          Back to Lobby
        </Link>
      </main>
    );
  }

  return (
    <>
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-[1080px] px-4 py-4 sm:px-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition hover:text-foreground"
          >
            ← all matches
          </Link>
          <div className="mt-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {fixture.state === "live" && <span className="h-1.5 w-1.5 rounded-full bg-amber pip-live" aria-hidden />}
            {fixture.state === "ended" && <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" aria-hidden />}
            <span className="num font-mono">
              {fixture.state === "live"
                ? `LIVE · ${fixture.minute}′`
                : fixture.state === "ht"
                ? "HALFTIME"
                : fixture.state === "ended"
                ? "FINISHED"
                : "UPCOMING"} · {fixture.competition}
            </span>
            {fixture.state === "soon" && fixture.kickoffAt && (
              <KickoffCountdown kickoffAt={fixture.kickoffAt} />
            )}
          </div>

          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-3">
            <div className="min-w-0 flex items-center gap-2">
              <FlagImg team={fixture.home} />
              <div className="truncate font-display text-[22px] font-bold leading-none tracking-tight sm:text-[26px]" style={{ fontFamily: "var(--font-display)" }}>{fixture.home}</div>
            </div>
            <div className="num font-mono text-[28px] font-semibold tracking-tight sm:text-[32px]">{fixture.homeScore}<span className="px-1.5 text-muted-foreground">–</span>{fixture.awayScore}</div>
            <div className="min-w-0 text-right flex items-center justify-end gap-2">
              <div className="truncate font-display text-[22px] font-bold leading-none tracking-tight sm:text-[26px]" style={{ fontFamily: "var(--font-display)" }}>{fixture.away}</div>
              <FlagImg team={fixture.away} />
            </div>
          </div>
        </div>
      </section>

      {/* Main Two-Column Layout */}
      <main className="mx-auto max-w-[1080px] px-4 pb-32 pt-6 sm:px-6 grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-8">
        {/* Left Column: Markets & Receipts */}
        <div className="space-y-8">
          {/* Mobile: probabilities & chat */}
          <div className="lg:hidden space-y-4">
            <CopilotPanel copilot={copilot} fixture={fixture} compact />
            <HistoryPanel matchId={fixture.id} />
            <MatchChat matchId={fixture.id} />
          </div>
          {fixture.state === "ended" ? (
            <div className="rounded-lg border border-line bg-surface/30 p-4 text-center">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">Match concluded</span>
              <p className="text-xs text-muted-foreground mt-1 max-w-[40ch] mx-auto">All predicting pools are locked and settled — see how the crowd called it below.</p>
            </div>
          ) : (
            <div>
              <SectionHeading eyebrow="Live markets" title="Open now" meta={`${MARKETS.filter(m => !m.settled).length} open`} />
              <ul className="mt-4 flex flex-col gap-3">
                {MARKETS.filter(m => !m.settled).map((m, i) => (
                  <li key={m.id}><LiveMarketCard market={m} livePool={livePools[MARKETS.indexOf(m)]} tick={now + i} fixture={fixture} copilot={copilot} /></li>
                ))}
              </ul>
            </div>
          )}
          {MARKETS.some(m => m.settled) ? (
            <div>
              <SectionHeading
                eyebrow="How the crowd called it"
                title="Market history"
                meta={`${MARKETS.filter(m => m.settled).length} settled`}
              />
              <ul className="mt-4 flex flex-col gap-3">
                {MARKETS.filter(m => m.settled).slice(0, historyExpanded ? undefined : 6).map(m => (
                  <li key={m.id}><MarketHistoryCard market={m} /></li>
                ))}
              </ul>
              {MARKETS.filter(m => m.settled).length > 6 && (
                <button
                  onClick={() => setHistoryExpanded((v) => !v)}
                  className="mt-4 w-full rounded-md border border-line py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition hover:border-foreground hover:text-foreground"
                >
                  {historyExpanded ? "Show less" : `Show all ${MARKETS.filter(m => m.settled).length} settled markets`}
                </button>
              )}
            </div>
          ) : fixture.state === "ended" ? (
            <div className="rounded-md border border-dashed border-line p-6 text-center bg-surface/20">
              <p className="text-xs text-muted-foreground">No markets were resolved for this match.</p>
            </div>
          ) : null}
          <div>
            <SectionHeading
              eyebrow="Settled · verifiable on Solana"
              title="Receipts"
              meta={isConnected && userMatchReceipts.length > 0 ? `${userMatchReceipts.length} receipts` : undefined}
            />
            <ul className="mt-4 flex flex-col gap-3">
              {!isConnected ? (
                <div className="rounded-md border border-dashed border-line p-6 text-center bg-surface/20">
                  <p className="text-xs text-muted-foreground">Connect wallet to view your receipts.</p>
                </div>
              ) : userMatchReceipts.length === 0 ? (
                <div className="rounded-md border border-dashed border-line p-6 text-center bg-surface/20">
                  <p className="text-xs text-muted-foreground">No receipts yet. Stake on a live market to get a receipt.</p>
                </div>
              ) : (
                userMatchReceipts.map((receipt) => (
                  <li key={receipt.id}>
                    <SettledMarketCard receipt={receipt} matchId={fixture.id} />
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
        {/* Right Column: AI Match Copilot & Chat Sidebar (desktop) */}
        <div className="hidden lg:flex lg:flex-col lg:gap-4 lg:sticky lg:top-6 lg:self-start">
          <CopilotPanel copilot={copilot} fixture={fixture} />
          <HistoryPanel matchId={fixture.id} />
          <MatchChat matchId={fixture.id} />
        </div>
      </main>
    </>
  );
}

function SectionHeading({ eyebrow, title, meta }: { eyebrow: string; title: string; meta?: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 border-b border-line pb-2">
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</div>
        <h2
          className="mt-1 font-display text-[22px] font-bold leading-none tracking-[-0.01em]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {title}
        </h2>
      </div>
      {meta && (
        <div className="shrink-0 num font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {meta}
        </div>
      )}
    </div>
  );
}

function LiveMarketCard({
  market,
  livePool: _livePool,
  tick,
  fixture,
  copilot,
}: {
  market: any;
  livePool: number;
  tick: number;
  fixture: any;
  copilot: any;
}) {
  const { isConnected, connectWallet, addPosition, program, walletAddress, walletBalance } = useApp();

  const [pickedSide, setPickedSide] = useState<"yes" | "no" | null>(null);
  const [stake, setStake] = useState<number>(0.5);
  const [isStaking, setIsStaking] = useState<boolean>(false);

  const remaining = Math.max(0, (market.closesInSec ?? 0) - tick);
  const isClosed = remaining <= 0;
  const isClosingSoon = remaining > 0 && remaining <= 60;
  const totalWindow = market.closesInSec ?? 1;
  const progress = 1 - remaining / totalWindow;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  const side = pickedSide ? (pickedSide === "yes" ? market.yes : market.no) : null;
  const payout = side ? (stake / side.price).toFixed(4) : null;

  const hasInsufficientFunds = isConnected && (walletBalance < stake);
  const btnDisabled = isStaking || isClosed || hasInsufficientFunds;
  
  let btnText = `Stake ${stake} SOL on ${side?.label}`;
  if (isStaking) btnText = "Staking...";
  else if (!isConnected) btnText = "Connect Wallet to Stake";
  else if (isClosed) btnText = "Market Closed";
  else if (hasInsufficientFunds) btnText = `Insufficient SOL Balance (Need ${stake.toFixed(1)} SOL)`;

  // Find probability based on market type
  let copilotProb: number | null = null;
  if (copilot) {
    if (market.market_type === "goal") copilotProb = copilot.goalYesProb;
    else if (market.market_type === "corner") copilotProb = copilot.cornerYesProb;
    else if (market.market_type === "throwin") copilotProb = copilot.throwinYesProb || 0.85;
    else if (market.market_type === "freekick") copilotProb = copilot.freekickYesProb || 0.40;
  }

  const handleStakeClick = async () => {
    if (!isConnected) {
      connectWallet();
      return;
    }
    if (!side || !program || !walletAddress) return;

    setIsStaking(true);

    const stakeSol = stake;
    const odds = 1 / side.price;
    const potentialPayout = stakeSol * odds;

    try {
      const PROGRAM_ID = new PublicKey(NINETY_PROGRAM_ID);
      
      const matchBytes = Buffer.from(toBytes32(fixture.id));
      const marketBytes = Buffer.from(toBytes32(market.id));
      
      const [marketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("market"), matchBytes, marketBytes],
        PROGRAM_ID
      );
      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), marketPda.toBuffer()],
        PROGRAM_ID
      );
      const userPublicKey = new PublicKey(walletAddress);
      const [stakePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("stake"), marketPda.toBuffer(), userPublicKey.toBuffer()],
        PROGRAM_ID
      );

      const sideVal = pickedSide === "yes" ? 0 : 1;
      const lamports = new anchor.BN(Math.round(stakeSol * 1e9));

      const txSig = await program.methods
        .placeStake(sideVal, lamports)
        .accounts({
          user: userPublicKey,
          market: marketPda,
          vault: vaultPda,
          stake: stakePda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      toast.success(`Staked successfully! Signature: ${txSig.slice(0, 8)}...`);

      await addPosition({
        marketId: market.id,
        matchId: fixture.id,
        competition: fixture.competition,
        home: fixture.home,
        away: fixture.away,
        marketQuestion: market.question,
        side: pickedSide === "yes" ? "Yes" : "No",
        sideLabel: side.label,
        stake: stakeSol,
        odds: odds,
        potentialPayout: potentialPayout,
        matchMinute: fixture.minute ?? 70,
        matchProgress: (fixture.minute ?? 70) / 90,
        onChainPubkey: stakePda.toBase58(),
        txSig: txSig,
      });

      setPickedSide(null);
    } catch (e: any) {
      console.error("Failed to place stake on-chain:", e);
      const errMsg = e.message || String(e);
      if (errMsg.includes("custom program error: 0x1") || errMsg.includes("Instruction 2: custom program error: 0x1")) {
        toast.error("Staking failed: Insufficient SOL balance. Please request a Devnet airdrop or top up your wallet.");
      } else {
        toast.error(`Staking failed: ${errMsg}`);
      }
    } finally {
      setIsStaking(false);
    }
  };

  return (
    <article className="rounded-md border border-line bg-surface">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 p-4 sm:p-5">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">
            <span>{market.window}</span>
            {market.market_type === "throwin" && (
              <span className="rounded bg-cyan-dim/20 text-cyan text-[9px] px-1.5 uppercase font-mono tracking-wider font-bold">Micro 60s</span>
            )}
            {market.market_type === "freekick" && (
              <span className="rounded bg-cyan-dim/20 text-cyan text-[9px] px-1.5 uppercase font-mono tracking-wider font-bold">Micro 120s</span>
            )}
          </div>
          <h3
            className="mt-1.5 font-display text-[18px] font-semibold leading-[1.15] tracking-tight sm:text-[20px]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {market.question}
          </h3>

          {copilotProb !== null && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#5BE0C9] font-mono bg-[#5BE0C9]/10 px-2 py-0.5 rounded w-fit select-none">
              <Sparkles className="h-3 w-3" />
              <span>AI Fair Odds: {(1 / copilotProb).toFixed(2)} ({Math.round(copilotProb * 100)}% prob)</span>
            </div>
          )}
        </div>
        <CountdownArc
          remaining={remaining}
          progress={progress}
          urgent={isClosingSoon}
          formatted={fmt(remaining)}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 px-4 pb-3 sm:px-5">
        <SideButton
          side={market.yes}
          active={pickedSide === "yes"}
          onClick={() => {
            if (!isClosed) setPickedSide("yes");
          }}
          disabled={isClosed}
        />
        <SideButton
          side={market.no}
          active={pickedSide === "no"}
          onClick={() => {
            if (!isClosed) setPickedSide("no");
          }}
          disabled={isClosed}
        />
      </div>

      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-t border-line px-4 py-2.5 sm:px-5">
        <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-amber pip-live" aria-hidden />
          Live pool
        </span>
        <PoolBar yesPool={market.yesPoolSol ?? market.yes.pool} noPool={market.noPoolSol ?? market.no.pool} />
        <span className="num font-mono text-[12px] tabular-nums">
          {((market.totalPoolSol ?? market.totalPool) / (market.totalPoolSol ? 1 : 1000)).toFixed(2)} SOL
        </span>
      </div>

      {pickedSide && side ? (
        <div className="border-t border-line p-4 sm:p-5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <label className="text-[12px] text-muted-foreground flex justify-between w-full">
              <span>
                Stake on <span className="font-medium text-foreground">{side.label}</span> at{" "}
                <span className="num font-mono text-foreground">{side.price.toFixed(2)}</span>
              </span>
              {isConnected && (
                <span className="num font-mono text-muted-foreground">
                  Balance: {walletBalance.toFixed(4)} SOL
                </span>
              )}
            </label>
            <div className="flex shrink-0 gap-1">
              {[0.5, 2.5, 10.0].map((v) => (
                <button
                  key={v}
                  onClick={() => setStake(v)}
                  className={`num font-mono text-[11px] rounded-sm border px-2 py-1 transition cursor-pointer ${
                    stake === v
                      ? "border-foreground bg-foreground text-background"
                      : "border-line text-muted-foreground hover:border-foreground hover:text-foreground"
                  }`}
                >
                  {v} SOL
                </button>
              ))}
            </div>
          </div>
          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                You stake
              </span>
              <span className="num font-mono text-[22px] font-semibold tracking-tight">{stake} SOL</span>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Pays if {side.label.toLowerCase()}
              </div>
              <div className="num font-mono text-[18px] font-semibold tracking-tight text-cyan">
                {payout} SOL
              </div>
            </div>
          </div>
          <button
            disabled={btnDisabled}
            className={`mt-3 w-full rounded-sm py-3 text-[14px] font-semibold transition cursor-pointer ${
              btnDisabled
                ? "bg-muted text-muted-foreground cursor-not-allowed border border-line"
                : "bg-foreground text-background hover:bg-amber hover:text-background"
            }`}
            onClick={handleStakeClick}
          >
            {btnText}
          </button>
        </div>
      ) : null}
    </article>
  );
}

function SideButton({ side, active, onClick, disabled }: { side: Side; active: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-sm border px-3 py-2.5 text-left transition ${
        disabled
          ? "border-line bg-muted/20 text-muted-foreground opacity-60 cursor-not-allowed"
          : active
            ? "border-foreground bg-foreground/[0.04] cursor-pointer"
            : "border-line hover:border-foreground/60 cursor-pointer"
      }`}
    >
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium">{side.label}</span>
        <span className="block num font-mono text-[10px] text-muted-foreground tabular-nums">
          {side.votes} {side.votes === 1 ? "vote" : "votes"}
        </span>
      </span>
      <span className="num shrink-0 font-mono text-[15px] font-semibold tabular-nums">
        {side.price.toFixed(2)}
      </span>
    </button>
  );
}

function PoolBar({ yesPool, noPool }: { yesPool: number; noPool: number }) {
  const total = yesPool + noPool;
  const yesPct = (yesPool / total) * 100;
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-background">
      <div className="h-full bg-foreground/70" style={{ width: `${yesPct}%` }} />
      <div className="h-full bg-clag/70" style={{ width: `${100 - yesPct}%` }} />
    </div>
  );
}

function CountdownArc({
  remaining,
  progress,
  urgent,
  formatted,
}: {
  remaining: number;
  progress: number;
  urgent: boolean;
  formatted: string;
}) {
  const R = 22;
  const C = 2 * Math.PI * R;
  const dash = C * progress;
  return (
    <div className="relative grid h-[56px] w-[56px] shrink-0 place-items-center">
      <svg viewBox="0 0 56 56" className="absolute inset-0 -rotate-90">
        <circle cx="28" cy="28" r={R} fill="none" stroke="var(--line)" strokeWidth="2" />
        <circle
          cx="28"
          cy="28"
          r={R}
          fill="none"
          stroke={urgent ? "var(--amber)" : "var(--amber-dim)"}
          strokeWidth="2"
          strokeDasharray={`${dash} ${C}`}
        />
      </svg>
      <div className="relative flex flex-col items-center leading-none">
        <span
          className={`num font-mono text-[12px] font-semibold tabular-nums ${
            urgent ? "text-amber" : "text-foreground"
          }`}
        >
          {remaining > 0 ? formatted : "0:00"}
        </span>
        <span className="mt-0.5 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
          close
        </span>
      </div>
    </div>
  );
}

function MarketHistoryCard({ market }: { market: Market }) {
  if (!market.settled) return null;
  const s = market.settled;
  const totalVotes = market.yes.votes + market.no.votes;
  const yesPct = totalVotes > 0 ? Math.round((market.yes.votes / totalVotes) * 100) : 50;

  return (
    <article className="overflow-hidden rounded-md border border-line bg-surface p-4 sm:p-4.5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5 font-mono">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan/80" />
          Settled · {market.window}
        </div>
      </div>

      <div className="mt-2.5 flex items-start justify-between gap-4">
        <h3 className="font-display text-[16px] sm:text-[17px] font-medium leading-snug tracking-tight text-foreground max-w-[80%]">
          {market.question}
        </h3>
        <div className="shrink-0 rounded bg-cyan/10 border border-cyan/30 px-2.5 py-1 text-center min-w-[70px]">
          <div className="text-[8px] uppercase tracking-[0.12em] text-muted-foreground leading-none font-mono">Outcome</div>
          <div className="mt-0.5 font-display text-[14px] font-bold text-cyan leading-none">{s.outcome}</div>
        </div>
      </div>

      <div className="mt-3.5 pt-3 border-t border-line/60">
        <div className="flex justify-between text-[11px] font-mono text-muted-foreground mb-1.5">
          <span className={s.outcome === "Yes" ? "text-cyan font-bold" : ""}>
            Yes · {market.yes.votes} {market.yes.votes === 1 ? "vote" : "votes"}
          </span>
          <span className={s.outcome === "No" ? "text-cyan font-bold" : ""}>
            No · {market.no.votes} {market.no.votes === 1 ? "vote" : "votes"}
          </span>
        </div>
        {totalVotes > 0 ? (
          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-background">
            <div className="h-full bg-foreground/70" style={{ width: `${yesPct}%` }} />
            <div className="h-full bg-clag/70" style={{ width: `${100 - yesPct}%` }} />
          </div>
        ) : (
          <div className="text-[10px] text-muted-foreground/60 font-mono">No stakes were placed on this market.</div>
        )}
      </div>
    </article>
  );
}

function SettledMarketCard({ receipt, matchId }: { receipt: any; matchId: string }) {
  const won = receipt.result === "win";
  const isCashout = receipt.result === "cashout";
  const outcomeColor = won ? "text-cyan" : isCashout ? "text-amber" : "text-red-400 font-bold";
  const outcomeBorder = won ? "border-cyan/40 bg-cyan/10" : isCashout ? "border-amber/40 bg-amber/10" : "border-red-500/40 bg-red-500/10";

  const txSig = receipt.txSig || receipt.settlement_tx_signature;
  const nftMint = receipt.nft_mint_address;
  const isMockSig = !txSig || txSig.includes("-") || txSig.startsWith("mock") || txSig.startsWith("p2p") || txSig.length < 80;
  const href = isMockSig ? "#" : `https://explorer.solana.com/tx/${txSig}?cluster=devnet`;
  const sigShort = isMockSig ? "local proof ✓" : `${txSig.slice(0, 8)}…${txSig.slice(-8)}`;

  const [showProof, setShowProof] = useState(false);
  const [proofData, setProofData] = useState<any>(null);
  const [loadingProof, setLoadingProof] = useState(false);

  const fetchProof = async () => {
    if (showProof) {
      setShowProof(false);
      return;
    }
    setShowProof(true);
    if (proofData) return;
    setLoadingProof(true);
    try {
      const nonce = 1;
      const res = await fetch(`${API_URL}/api/proof/${matchId}/${nonce}`);
      if (res.ok) {
        const data = await res.json();
        setProofData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingProof(false);
    }
  };

  const handleShareReceipt = () => {
    const sideName = receipt.sideLabel || (receipt.result === "win" ? "YES" : "NO");
    const currentOdds = receipt.odds ? receipt.odds.toFixed(2) : "1.50";
    const resultText = receipt.result === "win" ? "WON" : receipt.result === "loss" ? "LOST" : "CASHED OUT";
    const pnlText = receipt.pnl >= 0 ? `+${receipt.pnl.toFixed(2)} SOL` : `${receipt.pnl.toFixed(2)} SOL`;

    const baseUrl = window.location.origin + window.location.pathname;
    const shareParams = new URLSearchParams({
      share: "true",
      side: sideName,
      q: receipt.marketQuestion,
      odds: currentOdds,
      comm: `Wager settled: ${resultText} (${pnlText})`,
    });
    const shareUrl = `${baseUrl}?${shareParams.toString()}`;

    navigator.clipboard.writeText(shareUrl);
    toast.success("Receipt share link copied to clipboard!");

    const tweetText = encodeURIComponent(`My wager on ${receipt.home} vs ${receipt.away} settled on-chain via Ninety Protocol!\n\nResult: ${resultText} (${pnlText})\n\nCheck proof: `);
    const twitterUrl = `https://twitter.com/intent/tweet?text=${tweetText}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, "_blank");
  };

  return (
    <article className="overflow-hidden rounded-md border border-line bg-surface p-4 sm:p-4.5 transition hover:border-cyan/30">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5 font-mono">
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${won ? "bg-cyan/80 animate-pulse" : isCashout ? "bg-amber/80" : "bg-red-400/80"}`} />
          {isCashout ? "Cashed Out" : won ? "Won" : "Lost"}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchProof}
            className="text-[11px] font-mono text-muted-foreground hover:text-foreground transition flex items-center gap-1 uppercase tracking-[0.15em] cursor-pointer"
            title="Verify Cryptographic Proof"
          >
            {showProof ? "Hide Proof" : "Verify Proof"}
          </button>
          <button
            onClick={handleShareReceipt}
            className="text-[11px] font-mono text-muted-foreground hover:text-foreground transition flex items-center gap-1 uppercase tracking-[0.15em] cursor-pointer"
            title="Share Wager Receipt"
          >
            <Share2 className="h-3 w-3" /> Share
          </button>
          <a
            href={href}
            target={isMockSig ? undefined : "_blank"}
            rel={isMockSig ? undefined : "noopener noreferrer"}
            className="text-[11px] font-mono text-cyan hover:text-cyan/80 transition flex items-center gap-1 uppercase tracking-[0.15em]"
          >
            {isMockSig ? "local proof ✓" : "solana explorer ↗"}
          </a>
        </div>
      </div>

      <div className="mt-2.5 flex items-start justify-between gap-4">
        <h3 className="font-display text-[16px] sm:text-[17px] font-medium leading-snug tracking-tight text-foreground max-w-[80%]">
          {receipt.marketQuestion}
        </h3>
        <div className={`shrink-0 rounded px-2.5 py-1 text-center min-w-[70px] border ${outcomeBorder}`}>
          <div className="text-[8px] uppercase tracking-[0.12em] text-muted-foreground leading-none font-mono">PnL</div>
          <div className={`mt-0.5 font-display text-[14px] font-bold leading-none ${outcomeColor}`}>
            {receipt.pnl >= 0 ? `+${receipt.pnl.toFixed(2)}` : receipt.pnl.toFixed(2)} SOL
          </div>
        </div>
      </div>

      <div className="mt-3.5 pt-3 border-t border-line/60 flex items-center justify-between text-[11px] font-mono text-muted-foreground gap-4">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="uppercase text-[9px] tracking-[0.12em] text-cyan font-bold shrink-0">TX</span>
          <span className="truncate">{sigShort}</span>
        </div>
        {nftMint && !nftMint.includes("-") && (
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="uppercase text-[9px] tracking-[0.12em] text-cyan font-bold shrink-0">NFT</span>
            <a
              href={`https://explorer.solana.com/address/${nftMint}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
              className="truncate text-cyan hover:underline"
            >
              {nftMint.slice(0, 6)}...{nftMint.slice(-6)}
            </a>
          </div>
        )}
      </div>

      {showProof && (
        <div className="mt-3.5 p-3 bg-background border border-line rounded font-mono text-[10px] space-y-1.5 text-muted-foreground select-none">
          <div className="text-[11px] font-bold text-foreground border-b border-line pb-1 mb-1.5">Cryptographic Verification</div>
          {loadingProof ? (
            <div className="animate-pulse">Fetching Merkle path from TxLINE...</div>
          ) : proofData ? (
            <>
              <div className="truncate"><span className="text-amber">Root:</span> {proofData.root}</div>
              <div className="truncate"><span className="text-amber">Leaf:</span> {proofData.leaf}</div>
              <div>
                <span className="text-amber">Merkle Path:</span>
                <ul className="pl-3 list-disc space-y-0.5 mt-0.5">
                  {proofData.proof?.map((h: string, i: number) => (
                    <li key={i} className="truncate">{h}</li>
                  ))}
                </ul>
              </div>
              <div className="truncate"><span className="text-amber">Signature:</span> {proofData.signature}</div>
              <div className="text-[9px] text-[#5BE0C9] mt-1 font-bold">✓ Event verified on Solana via Merkle root anchoring</div>
            </>
          ) : (
            <div className="text-red-400">Failed to fetch proof from TxLINE node.</div>
          )}
        </div>
      )}
    </article>
  );
}

function KickoffCountdown({ kickoffAt }: { kickoffAt?: string }) {
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    if (!kickoffAt) return;
    const target = new Date(kickoffAt).getTime();

    function update() {
      const diff = target - Date.now();
      if (diff <= 0) {
        setTimeLeft("Starting...");
        return;
      }

      const seconds = Math.floor((diff / 1000) % 60);
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));

      const parts = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0) parts.push(`${hours}h`);
      if (minutes > 0) parts.push(`${minutes}m`);
      parts.push(`${seconds}s`);

      setTimeLeft(parts.join(" "));
    }

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [kickoffAt]);

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber/5 border border-amber/20 px-2 py-0.5 text-[9px] font-semibold text-amber font-mono normal-case tracking-normal">
      <svg className="w-2.5 h-2.5 fill-none stroke-current" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      Starts in {timeLeft}
    </span>
  );
}

function CopilotPanel({ copilot, fixture, compact }: { copilot: any; fixture?: any; compact?: boolean }) {
  if (!copilot) {
    return (
      <div className="rounded-xl border border-line bg-surface/30 p-4 text-center">
        <Activity className="animate-pulse h-5 w-5 text-amber mx-auto mb-2" />
        <p className="text-[11px] text-muted-foreground">Connecting copilot stream...</p>
      </div>
    );
  }

  const { commentary, goalYesProb, cornerYesProb, updatedAt } = copilot;
  const isEnded = fixture?.state === "ended";
  const isSoon = fixture?.state === "soon";
  const throwinYesProb = copilot.throwinYesProb || 0.85;
  const freekickYesProb = copilot.freekickYesProb || 0.40;
  const secAgo = updatedAt ? Math.round((Date.now() - updatedAt) / 1000) : null;

  // Market velocity: total pool vs estimated cap
  const totalPool = copilot._totalPool || 0;
  const poolCap = 50;
  const velocityPct = isEnded ? 100 : Math.min(100, Math.round((totalPool / poolCap) * 100));

  return (
    <div className="rounded-xl border border-line bg-surface/50 p-5 space-y-4">
      <div className="flex items-center gap-2 border-b border-line pb-3">
        <Sparkles className="h-4 w-4 text-amber" />
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">AI Match Copilot</span>
        {isSoon && <span className="text-[9px] font-mono text-amber ml-auto uppercase font-bold">Warming Up</span>}
        {isEnded && <span className="text-[9px] font-mono text-muted-foreground ml-auto uppercase font-bold">Concluded</span>}
        {!isSoon && !isEnded && secAgo !== null && (
          <span className="text-[9px] font-mono text-muted-foreground ml-auto">Updated {secAgo}s ago</span>
        )}
      </div>

      {/* Commentary — ambient, demoted */}
      <p className="text-[11px] text-muted-foreground/80 leading-relaxed italic border-l border-line pl-3 select-none">
        {isSoon
          ? `Match starts soon. AI Match Copilot is gathering pre-match stats and H2H insights.`
          : isEnded
          ? `Match concluded. Final Score: ${fixture.homeScore}-${fixture.awayScore}. All predicting pools are locked and settled.`
          : commentary}
      </p>

      {/* Market Velocity */}
      {!isSoon && !isEnded && (
        <div className="rounded bg-background border border-line p-3 space-y-1.5">
          <div className="flex justify-between text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            <span>Market Velocity</span>
            <span className="text-amber font-bold">{velocityPct}% filled</span>
          </div>
          <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden">
            <div className="h-full bg-amber rounded-full transition-all duration-500" style={{ width: `${velocityPct}%` }} />
          </div>
        </div>
      )}

      {/* Countdown inside Copilot Panel for upcoming match */}
      {isSoon && (
        <div className="rounded bg-background border border-line p-3 text-center space-y-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block">Time to Kickoff</span>
          <div className="flex justify-center">
            <KickoffCountdown kickoffAt={fixture.kickoffAt} />
          </div>
        </div>
      )}

      {!compact && !isSoon && !isEnded && (
        <div className="space-y-2.5">
          <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground block">Live Probabilities</span>
          <ProbRow label="Next Goal" prob={probOrDefault(goalYesProb, 0.14)} />
          <ProbRow label="Next Corner" prob={probOrDefault(cornerYesProb, 0.55)} />
          <ProbRow label="Throw-In (60s)" prob={throwinYesProb} />
          <ProbRow label="Free-Kick (120s)" prob={freekickYesProb} />
        </div>
      )}
    </div>
  );
}

function probOrDefault(val: any, fallback: number): number {
  if (typeof val === "number") return val;
  return fallback;
}

function ProbRow({ label, prob }: { label: string; prob: number }) {
  const pct = Math.round(prob * 100);
  const fairOdds = prob > 0 ? (1 / prob).toFixed(2) : "—";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] font-mono">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground font-bold">{pct}% · {fairOdds}×</span>
      </div>
      <div className="h-1 w-full bg-background rounded-full overflow-hidden">
        <div className="h-full bg-cyan rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function HistoryPanel({ matchId }: { matchId: string }) {
  const [history, setHistory] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${API_URL}/api/matches/${matchId}/history`);
        if (res.ok) {
          const data = await res.json();
          setHistory(data);
        }
      } catch (err) {
        console.error("Failed to fetch historical stats:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [matchId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-line bg-surface/30 p-5 text-center w-full">
        <Activity className="animate-pulse h-5 w-5 text-cyan mx-auto mb-2" />
        <p className="text-[11px] text-muted-foreground font-mono">Loading historical stats...</p>
      </div>
    );
  }

  if (!history) return null;

  return (
    <div className="rounded-xl border border-line bg-surface/50 p-5 space-y-4 w-full">
      <div className="flex items-center gap-2 border-b border-line pb-3">
        <Activity className="h-4 w-4 text-cyan" />
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Match Stats & History</span>
      </div>

      {/* Head to Head */}
      <div className="space-y-2">
        <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground block">Recent Head-to-Head</span>
        <div className="space-y-1.5 font-mono text-[11px]">
          {history.h2h.map((matchStr: string, idx: number) => (
            <div key={idx} className="flex justify-between py-1 border-b border-line/20 text-foreground">
              <span>{matchStr}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Form Guides */}
      <div className="grid grid-cols-2 gap-4 pt-1">
        <div>
          <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground block mb-1.5">Home Form</span>
          <div className="flex gap-1">
            {history.form.home.map((f: string, i: number) => (
              <span
                key={i}
                className={`w-5 h-5 flex items-center justify-center rounded text-[9px] font-mono font-bold leading-none ${
                  f === "W"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : f === "D"
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "bg-red-500/20 text-red-400 border border-red-500/30"
                }`}
              >
                {f}
              </span>
            ))}
          </div>
        </div>
        <div>
          <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground block mb-1.5">Away Form</span>
          <div className="flex gap-1">
            {history.form.away.map((f: string, i: number) => (
              <span
                key={i}
                className={`w-5 h-5 flex items-center justify-center rounded text-[9px] font-mono font-bold leading-none ${
                  f === "W"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : f === "D"
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "bg-red-500/20 text-red-400 border border-red-500/30"
                }`}
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Average Stats */}
      <div className="space-y-2 pt-2 border-t border-line/60">
        <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground block">Match Average Stats</span>
        <div className="grid grid-cols-3 gap-2 text-center font-mono">
          <div className="bg-background border border-line rounded p-2">
            <span className="text-[9px] text-muted-foreground block uppercase">Goals</span>
            <span className="text-[14px] font-bold text-foreground">{history.stats.goals}</span>
          </div>
          <div className="bg-background border border-line rounded p-2">
            <span className="text-[9px] text-muted-foreground block uppercase">Corners</span>
            <span className="text-[14px] font-bold text-foreground">{history.stats.corners}</span>
          </div>
          <div className="bg-background border border-line rounded p-2">
            <span className="text-[9px] text-muted-foreground block uppercase">Cards</span>
            <span className="text-[14px] font-bold text-foreground">{history.stats.cards}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MatchChat({ matchId }: { matchId: string }) {
  const { isConnected, walletAddress } = useApp();
  const [messages, setMessages] = useState<{ wallet: string; message: string; ts: number }[]>([]);
  const [count, setCount] = useState(0);
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(true);
  const socketRef = useRef<Socket | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const socket = io(API_URL, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.emit("chat:join", matchId);

    socket.on("chat:history", (hist: any[]) => setMessages(hist));
    socket.on("chat:new", (msg: any) => setMessages((prev) => [...prev.slice(-49), msg]));
    socket.on("chat:count", (n: number) => setCount(n));

    return () => {
      socket.disconnect();
    };
  }, [matchId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    if (!input.trim() || !isConnected || !walletAddress) return;
    socketRef.current?.emit("chat:message", {
      matchId,
      wallet: walletAddress,
      message: input.trim(),
    });
    setInput("");
  };

  const fmt = (w: string) => (w ? `${w.slice(0, 4)}…${w.slice(-4)}` : "Anon");
  const relTime = (ts: number) => {
    const s = Math.round((Date.now() - ts) / 1000);
    return s < 60 ? `${s}s` : `${Math.round(s / 60)}m`;
  };

  return (
    <div className="rounded-xl border border-line bg-surface/40 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 border-b border-line text-left cursor-pointer hover:bg-surface/80 transition"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber pip-live" />
        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Match Room Chat</span>
        <span className="text-[10px] font-mono text-muted-foreground ml-1">({count} live)</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <>
          <div className="h-52 overflow-y-auto p-3 space-y-2 font-mono">
            {messages.length === 0 && (
              <p className="text-[11px] text-muted-foreground text-center pt-6 italic">No messages in room yet. Say hello!</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className="flex items-start gap-2 text-[11px]">
                <span className="text-amber font-bold shrink-0">{fmt(m.wallet)}:</span>
                <span className="text-foreground leading-snug flex-1 break-words">{m.message}</span>
                <span className="text-[9px] text-muted-foreground shrink-0">{relTime(m.ts)}</span>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <div className="border-t border-line p-2 flex gap-2">
            {isConnected ? (
              <>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder="Chat with match room..."
                  className="flex-1 text-[12px] bg-background border border-line px-3 py-1.5 rounded text-foreground focus:outline-none focus:border-amber font-sans"
                />
                <button
                  onClick={send}
                  className="rounded bg-amber px-3 py-1.5 cursor-pointer hover:bg-amber/90 transition flex items-center justify-center"
                >
                  <Send className="h-3.5 w-3.5 text-background" />
                </button>
              </>
            ) : (
              <p className="text-[11px] text-muted-foreground py-1 px-2 italic">Connect wallet to join live match chat</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
