import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { Buffer } from "buffer";
import { type Fixture, type TournamentTeam } from "@/lib/app-context";
import { useApp } from "@/lib/app-context";
import { FlagImg } from "@/lib/flags";
import { Sparkles, Users, ArrowRight, Brain, PlusCircle, ChevronDown, Bell } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useCountdown, formatCountdown } from "@/lib/hooks/useCountdown";
import { useMatchNotification } from "@/lib/hooks/useMatchNotifications";
import { toast } from "sonner";
import { API_URL, NINETY_PROGRAM_ID } from "@/lib/config";

export const Route = createFileRoute("/")(({
  head: () => ({
    meta: [
      { title: "Ninety — live football markets, open right now" },
      { name: "description", content: "Every live football match, every open micro-market, in one teletext-tight lobby. Pick a fixture, open a market, settle on-chain." },
    ],
  }),
  component: Lobby,
}));

function normaliseComp(raw: string): string {
  if (!raw) return raw;
  const lower = raw.toLowerCase();
  if (lower.includes("world cup")) return "World Cup 2026";
  if (lower.includes("friendl")) return "Friendlies";
  return raw.replace(/\b\w/g, c => c.toUpperCase());
}

const PRIORITY_COMPS = ["world cup"];
const CUTOFF_7D = 7 * 86400000;
function isWorldCup(comp: string) {
  return PRIORITY_COMPS.some(p => comp?.toLowerCase().includes(p));
}
function isWithin7Days(kickoffAt?: string) {
  if (!kickoffAt) return true;
  return new Date(kickoffAt).getTime() <= Date.now() + CUTOFF_7D;
}

function Lobby() {
  const { matches, p2pChallenges, createP2pChallenge, acceptP2pChallenge, p2pPlaceStake, resolveP2pChallenge, p2pClaimPayout, walletAddress, isConnected, tournamentTeams } = useApp();
  const [activeTab, setActiveTab] = useState<"markets" | "recommendations" | "p2p">("markets");

  const live = matches.filter(f => f.state === "live").sort((a, b) => (a.kickoffAt ? new Date(a.kickoffAt).getTime() : 0) - (b.kickoffAt ? new Date(b.kickoffAt).getTime() : 0));
  const ht = matches.filter(f => f.state === "ht");
  const ended = matches.filter(f => f.state === "ended");

  const allSoon = matches.filter(f => f.state === "soon");
  const soonWC = allSoon.filter(f => isWorldCup(f.competition) && isWithin7Days(f.kickoffAt));
  const soonOther = allSoon.filter(f => !isWorldCup(f.competition) && isWithin7Days(f.kickoffAt));

  const recommendedQuery = useQuery<any[]>({
    queryKey: ["recommended-matches"],
    queryFn: () => fetch(`${API_URL}/api/matches/recommended`).then((r) => r.json()),
    staleTime: 30000,
    refetchInterval: 60000,
  });
  const recommendedMatches = recommendedQuery.data ?? [];

  return (
    <main className="mx-auto max-w-[1080px] px-4 pb-32 pt-6 sm:px-6">
      <Hero count={live.length} />

      <div className="mt-8 flex gap-4 border-b border-line pb-px">
        {(["markets", "recommendations", "p2p"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`pb-3 text-[13px] font-bold uppercase tracking-[0.14em] transition border-b-2 cursor-pointer flex items-center gap-1.5 ${activeTab === tab ? "border-amber text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {tab === "recommendations" && <Sparkles className="h-3.5 w-3.5 text-amber" />}
            {tab === "p2p" && <Users className="h-3.5 w-3.5 text-amber" />}
            {tab === "markets" ? "Lobby Markets" : tab === "recommendations" ? `AI Feeds (${recommendedMatches.length})` : `P2P Challenges (${p2pChallenges.length})`}
          </button>
        ))}
      </div>

      {activeTab === "markets" && (
        <>
          <TournamentWinnerCard teams={tournamentTeams} />
          <Section
            title="Live now"
            count={live.length}
            live
            empty={
              <div className="rounded-xl border border-line bg-surface/10 p-8 text-center max-w-[500px] mx-auto space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">Pitch Status</span>
                <h4 className="text-[13px] font-bold text-foreground">No fixtures are currently live</h4>
                <p className="text-[11px] text-muted-foreground max-w-[40ch] mx-auto">
                  Live predictions will unlock as soon as fixtures are in play. Check scheduled kickoffs below.
                </p>
              </div>
            }
          >
            {live.map((f, i) => <FixtureRow key={f.id} f={f} index={i} />)}
          </Section>
          {ht.length > 0 && <Section title="Half-time" count={ht.length}>{ht.map((f, i) => <FixtureRow key={f.id} f={f} index={i} muted />)}</Section>}
          {soonWC.length > 0 && <Section title="Kicking off soon" count={soonWC.length}>{soonWC.map((f, i) => <FixtureRow key={f.id} f={f} index={i} muted />)}</Section>}
          {soonOther.length > 0 && <OtherFixturesSection fixtures={soonOther} />}
          {ended.length > 0 && <Section title="Finished" count={ended.length}>{ended.map((f, i) => <FixtureRow key={f.id} f={f} index={i} muted />)}</Section>}
        </>
      )}

      {activeTab === "recommendations" && (
        <div className="mt-8">
          <h2 className="font-display text-[18px] font-bold tracking-tight mb-1 text-foreground flex items-center gap-2"><Sparkles className="h-5 w-5 text-amber" />AI Recommended Feeds</h2>
          <p className="text-[12px] text-muted-foreground mb-6">Live and upcoming World Cup fixtures, sorted by market activity.</p>
          {recommendedMatches.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line p-8 text-center bg-surface/30">
              <Brain className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-[13px] text-muted-foreground">Loading fixtures&hellip;</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recommendedMatches.map((f: any) => (
                <div key={f.id} className="rounded-lg border border-line bg-surface/40 p-4 transition hover:bg-surface/80">
                  <div className="flex justify-between items-start gap-4 mb-3">
                    <span className="inline-flex items-center gap-1.5 rounded bg-amber/10 px-2 py-0.5 text-[10px] font-medium text-amber uppercase tracking-wider"><Sparkles className="h-3 w-3" />{f.status === "live" || f.status === "halftime" ? "Live" : "Upcoming"}</span>
                    <span className="text-[11px] font-mono text-muted-foreground">{normaliseComp(f.competition)}</span>
                  </div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-display text-base font-bold flex items-center gap-1.5"><FlagImg team={f.home_team ?? f.home} />{f.home_team ?? f.home} vs <FlagImg team={f.away_team ?? f.away} />{f.away_team ?? f.away}</span>
                    <span className="num font-mono text-amber text-[13px]">
                      {f.status === "live" ? `${f.minute ?? "—"}′` : f.status === "halftime" ? "HT" : f.status === "full_time" ? "FT" : ""}
                    </span>
                  </div>
                  <p className="text-[12px] text-muted-foreground border-l-2 border-amber pl-3 py-1 bg-amber/5 mb-4 font-mono">{f.rationale}</p>
                  <Link to="/match/$matchId" params={{ matchId: f.id }} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-foreground hover:text-amber transition cursor-pointer">
                    Open Match Markets <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "p2p" && (
        <div className="mt-8">
          <P2pChallengesSection isConnected={isConnected} p2pChallenges={p2pChallenges} matches={matches} walletAddress={walletAddress} createP2pChallenge={createP2pChallenge} acceptP2pChallenge={acceptP2pChallenge} p2pPlaceStake={p2pPlaceStake} resolveP2pChallenge={resolveP2pChallenge} p2pClaimPayout={p2pClaimPayout} />
        </div>
      )}

      <p className="mt-12 max-w-[56ch] text-[12px] leading-relaxed text-muted-foreground">Markets open and close in minutes. Tap a fixture to see what's trading, stake on one side, and walk away with a Solana signature you can verify yourself.</p>
    </main>
  );
}

function Hero({ count }: { count: number }) {
  return (
    <div className="border-b border-line pb-5">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-amber pip-live" aria-hidden />
        <span className="num font-mono">{count} matches live · feed refreshing</span>
      </div>
      <h1 className="mt-2 font-display text-[34px] font-extrabold leading-[0.95] tracking-[-0.02em] sm:text-[44px]" style={{ fontFamily: "var(--font-display)" }}>The pitch, right now.</h1>
      <p className="mt-2 max-w-[52ch] text-[13px] leading-relaxed text-muted-foreground">Every live football match, every open micro-market. Pick a fixture below to see what's trading on the next ten minutes of play.</p>
    </div>
  );
}

function toBytes32(str: string): number[] {
  const buf = Buffer.alloc(32);
  buf.write(str, "utf-8");
  return Array.from(buf);
}

function TournamentWinnerCard({ teams }: { teams: TournamentTeam[] }) {
  const displayTeams: TournamentTeam[] = teams && teams.length > 0 ? teams : [
    { name: "France", prob: 0.22 },
    { name: "Brazil", prob: 0.18 },
    { name: "Argentina", prob: 0.16 },
    { name: "England", prob: 0.13 },
    { name: "Spain", prob: 0.11 },
    { name: "Germany", prob: 0.09 },
    { name: "Portugal", prob: 0.07 },
    { name: "Morocco", prob: 0.04 },
  ];

  const stakeable = displayTeams.some((t) => t.marketId && t.marketStatus === "open");

  // Stakeable teams first (each keeps prob order within its group) so real markets
  // never get pushed out of the top-8 slice by display-only outsiders.
  const ordered = [...displayTeams].sort(
    (a, b) => Number(!!b.marketId) - Number(!!a.marketId) || b.prob - a.prob
  );

  return (
    <div className="mt-8 mb-6 rounded-xl border border-line bg-[#1A2A1A] p-5 relative overflow-hidden">
      <span className="absolute top-3 right-3 text-[9px] font-mono uppercase tracking-[0.2em] text-amber/50">TOURNAMENT</span>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">⚽</span>
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">World Cup 2026 — Tournament Winner</div>
          <h2 className="font-display text-[17px] font-bold tracking-tight text-foreground" style={{ fontFamily: "var(--font-display)" }}>Who lifts the trophy?</h2>
        </div>
      </div>
      <div className="space-y-1">
        {ordered.slice(0, 8).map(team => (
          <TournamentTeamRow key={team.name} team={team} />
        ))}
      </div>
      {stakeable && (
        <p className="mt-3 text-[10px] text-muted-foreground font-mono">
          Tap a team to back them on-chain — pays out when the tournament settles.
        </p>
      )}
    </div>
  );
}

function TournamentTeamRow({ team }: { team: TournamentTeam }) {
  const { isConnected, connectWallet, program, walletAddress, walletBalance, addPosition } = useApp();
  const [open, setOpen] = useState(false);
  const [stake, setStake] = useState<number>(0.1);
  const [isStaking, setIsStaking] = useState(false);

  const canStake = !!(team.marketId && team.matchId && team.marketStatus === "open");

  const handleStake = async () => {
    if (!isConnected) {
      connectWallet();
      return;
    }
    if (!canStake || !program || !walletAddress) return;
    if (walletBalance < stake) {
      toast.error(`Insufficient SOL balance (need ${stake} SOL).`);
      return;
    }
    setIsStaking(true);
    try {
      const PROGRAM_ID = new PublicKey(NINETY_PROGRAM_ID);
      const matchBytes = Buffer.from(toBytes32(team.matchId!));
      const marketBytes = Buffer.from(toBytes32(team.marketId!));
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

      const lamports = new anchor.BN(Math.round(stake * 1e9));
      const txSig = await program.methods
        .placeStake(0, lamports) // side 0 = YES ("{team} wins the World Cup")
        .accounts({
          user: userPublicKey,
          market: marketPda,
          vault: vaultPda,
          stake: stakePda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      await addPosition({
        marketId: team.marketId!,
        matchId: team.matchId!,
        competition: "World Cup 2026",
        home: "World Cup 2026",
        away: "Tournament Winner",
        marketQuestion: `Will ${team.name} win the 2026 World Cup?`,
        side: "Yes",
        sideLabel: `${team.name} wins`,
        stake,
        odds: team.prob > 0 ? 1 / team.prob : 2,
        potentialPayout: team.prob > 0 ? stake / team.prob : stake * 2,
        matchMinute: 0,
        matchProgress: 0,
        onChainPubkey: stakePda.toBase58(),
        txSig,
      });

      toast.success(`Backed ${team.name} with ${stake} SOL! Signature: ${txSig.slice(0, 8)}...`);
      setOpen(false);
    } catch (e: any) {
      console.error("Tournament stake failed:", e);
      toast.error(`Staking failed: ${e.message || String(e)}`);
    } finally {
      setIsStaking(false);
    }
  };

  return (
    <div className={`rounded transition ${open ? "bg-background/60 p-2 -mx-2" : ""}`}>
      <button
        onClick={() => canStake && setOpen((o) => !o)}
        className={`w-full flex items-center gap-3 py-1 ${canStake ? "cursor-pointer hover:opacity-90" : "cursor-default"}`}
      >
        <div className="w-28 flex items-center gap-1.5 shrink-0">
          <FlagImg team={team.name} />
          <span className="text-[13px] font-semibold text-foreground truncate">{team.name}</span>
        </div>
        <div className="flex-1 h-[6px] bg-background rounded-full overflow-hidden">
          <div className="h-full bg-amber rounded-full transition-all duration-700" style={{ width: `${Math.round(team.prob * 100)}%` }} />
        </div>
        <span className="num font-mono text-[12px] font-bold text-foreground w-10 text-right">{Math.round(team.prob * 100)}%</span>
        {canStake && (
          <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
        )}
      </button>
      {open && canStake && (
        <div className="mt-2 flex items-center justify-between gap-3 border-t border-line/60 pt-2">
          <div className="flex items-center gap-2">
            {[0.1, 0.5, 1.0].map((v) => (
              <button
                key={v}
                onClick={() => setStake(v)}
                className={`num font-mono text-[11px] rounded-sm border px-2 py-1 transition cursor-pointer ${
                  stake === v
                    ? "border-amber bg-amber/10 text-amber font-bold"
                    : "border-line text-muted-foreground hover:border-foreground hover:text-foreground"
                }`}
              >
                {v} SOL
              </button>
            ))}
            {(team.yesVotes ?? 0) > 0 && (
              <span className="num font-mono text-[10px] text-muted-foreground">
                {team.yesVotes} {team.yesVotes === 1 ? "backer" : "backers"} · {(team.yesPoolSol ?? 0).toFixed(2)} SOL
              </span>
            )}
          </div>
          <button
            onClick={handleStake}
            disabled={isStaking}
            className="rounded bg-amber px-3 py-1.5 text-[11px] font-bold text-background hover:bg-amber/90 transition cursor-pointer disabled:opacity-50"
          >
            {isStaking ? "Staking..." : !isConnected ? "Connect Wallet" : `Back ${team.name}`}
          </button>
        </div>
      )}
    </div>
  );
}

interface P2pProps {
  isConnected: boolean; p2pChallenges: any[]; matches: Fixture[];
  walletAddress: string; createP2pChallenge: (d: any) => Promise<void>;
  acceptP2pChallenge: (id: string) => Promise<void>;
  p2pPlaceStake: (id: string) => Promise<void>;
  resolveP2pChallenge: (id: string, outcome: boolean) => Promise<void>;
  p2pClaimPayout: (id: string) => Promise<void>;
}

function P2pChallengesSection({ isConnected, p2pChallenges, matches, walletAddress, createP2pChallenge, acceptP2pChallenge, p2pPlaceStake, resolveP2pChallenge, p2pClaimPayout }: P2pProps) {
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const runAction = async (id: string, fn: () => Promise<void>) => {
    setActionLoadingId(id);
    try {
      await fn();
    } catch (e: any) {
      alert(e.message || "Action failed");
    } finally {
      setActionLoadingId(null);
    }
  };
  const [challengerWallet, setChallengerWallet] = useState("");
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [customQuestion, setCustomQuestion] = useState("");
  const [amountSol, setAmountSol] = useState("0.1");
  const [side, setSide] = useState("yes");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengerWallet || !selectedMatchId || !customQuestion || !amountSol) { setErrorMsg("All fields are required"); return; }
    setLoading(true); setErrorMsg("");
    try {
      await createP2pChallenge({ challenger_wallet: challengerWallet, match_id: selectedMatchId, question: customQuestion, amount_sol: Number(amountSol), creator_side: side });
      setChallengerWallet(""); setCustomQuestion("");
    } catch (err: any) { setErrorMsg(err.message || "Failed to create challenge"); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <h2 className="font-display text-[18px] font-bold tracking-tight mb-2 text-foreground flex items-center gap-2"><Users className="h-5 w-5 text-amber" />P2P Custom Challenges</h2>
      <p className="text-[13px] text-muted-foreground mb-6">Challenge a friend's wallet directly with a custom prediction escrowed on-chain.</p>
      {!isConnected ? (
        <div className="rounded-lg border border-line p-8 text-center bg-surface/30"><p className="text-[13px] text-muted-foreground">Connect your wallet to challenge friends or accept incoming wagers.</p></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1.8fr] gap-6 items-start">
          <form onSubmit={handleCreate} className="rounded-xl border border-line bg-surface/30 p-5 space-y-4">
            <h3 className="text-xs uppercase font-bold tracking-wider text-muted-foreground">New Custom Bet</h3>
            {errorMsg && <p className="text-xs text-red-500 font-mono bg-red-500/10 p-2 rounded">{errorMsg}</p>}
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Friend's Wallet Address</label>
              <input type="text" placeholder="Solana wallet address (e.g. 6YjV...S8ZV)" value={challengerWallet} onChange={e => setChallengerWallet(e.target.value)} className="w-full text-xs font-mono bg-background border border-line p-2 rounded text-foreground focus:outline-none" />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Select Fixture</label>
              <select value={selectedMatchId} onChange={e => setSelectedMatchId(e.target.value)} className="w-full text-xs bg-background border border-line p-2 rounded text-foreground focus:outline-none">
                <option value="">-- Choose Match --</option>
                {matches.map(m => <option key={m.id} value={m.id}>{m.home} vs {m.away} ({m.state === "live" ? "Live" : "Soon"})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Custom Prediction</label>
              <input type="text" placeholder="e.g. Will Arsenal win more corners?" value={customQuestion} onChange={e => setCustomQuestion(e.target.value)} className="w-full text-xs bg-background border border-line p-2 rounded text-foreground focus:outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Stake Amount (SOL)</label>
                <input type="number" step="0.01" min="0.01" value={amountSol} onChange={e => setAmountSol(e.target.value)} className="w-full text-xs bg-background border border-line p-2 rounded text-foreground focus:outline-none" />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Your Side</label>
                <div className="flex bg-background border border-line rounded overflow-hidden">
                  {["yes", "no"].map(s => <button key={s} type="button" onClick={() => setSide(s)} className={`flex-1 text-xs py-1.5 cursor-pointer ${side === s ? "bg-amber text-background font-bold" : "text-foreground hover:bg-surface"}`}>{s.toUpperCase()}</button>)}
                </div>
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 rounded bg-amber py-2.5 text-xs font-bold text-background hover:bg-amber/90 transition cursor-pointer disabled:opacity-50">
              <PlusCircle className="h-4 w-4" /> Send Challenge
            </button>
          </form>

          <div className="space-y-4">
            <h3 className="text-xs uppercase font-bold tracking-wider text-muted-foreground">Challenge Log</h3>
            {p2pChallenges.length === 0 ? <p className="text-[12px] text-muted-foreground italic py-6">No wagers active. Fire off a challenge to start.</p> : (
              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {p2pChallenges.map(chal => {
                  const isCreator = chal.creator_wallet === walletAddress;
                  const sideLabel = isCreator ? chal.creator_side.toUpperCase() : (chal.creator_side === "yes" ? "NO" : "YES");
                  const amtSol = Number(chal.amount_lamports) / 1e9;
                  const match = matches.find(m => m.id === chal.match_id);
                  return (
                    <div key={chal.id} className="rounded-lg border border-line bg-surface/20 p-4 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-mono text-muted-foreground truncate max-w-[140px]">{isCreator ? `Challenged: ${chal.challenger_wallet}` : `From: ${chal.creator_wallet}`}</span>
                        <span className="num font-mono text-amber text-[12px] font-bold">{amtSol} SOL</span>
                      </div>
                      <div className="text-[13px] font-semibold text-foreground">{chal.question}</div>
                      {match && <div className="text-[11px] text-muted-foreground flex justify-between"><span><FlagImg team={match.home} />{match.home} vs <FlagImg team={match.away} />{match.away}</span><span>{match.state === "live" ? `${match.minute}′` : "Upcoming"}</span></div>}
                      <div className="flex justify-between items-center pt-2 border-t border-line/50">
                        <div className="text-[11px] text-muted-foreground">Your Side: <span className="font-bold text-foreground">{sideLabel}</span></div>
                        <div>
                          {chal.status === "pending" && !isCreator && <button onClick={() => runAction(chal.id, () => acceptP2pChallenge(chal.id))} disabled={actionLoadingId === chal.id} className="rounded bg-amber px-3 py-1 text-[11px] font-bold text-background hover:bg-amber/90 transition cursor-pointer disabled:opacity-50">{actionLoadingId === chal.id ? "Accepting…" : "Accept Wager"}</button>}
                          {chal.status === "pending" && isCreator && <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-surface text-amber/80">Awaiting Friend</span>}
                          {chal.status === "accepted" && (() => {
                            const myTxSig = isCreator ? chal.creator_tx_sig : chal.challenger_tx_sig;
                            return myTxSig ? (
                              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-surface text-cyan">Staked — waiting on opponent</span>
                            ) : (
                              <button onClick={() => runAction(chal.id, () => p2pPlaceStake(chal.id))} disabled={actionLoadingId === chal.id} className="rounded bg-cyan/80 px-3 py-1 text-[11px] font-bold text-background hover:bg-cyan transition cursor-pointer disabled:opacity-50">{actionLoadingId === chal.id ? "Staking…" : "Place Your Stake On-Chain"}</button>
                            );
                          })()}
                          {(chal.status === "staked" || chal.status === "disputed") && <div className="flex flex-col items-end gap-1">
                            {chal.status === "disputed" && <span className="text-[9px] uppercase font-mono text-amber">AI couldn't decide — manual review</span>}
                            <div className="flex gap-2">
                              <button onClick={() => runAction(chal.id, () => resolveP2pChallenge(chal.id, true))} disabled={actionLoadingId === chal.id} className="rounded bg-green-600/80 px-2 py-0.5 text-[10px] font-bold text-foreground hover:bg-green-600 transition cursor-pointer disabled:opacity-50">Settle YES</button>
                              <button onClick={() => runAction(chal.id, () => resolveP2pChallenge(chal.id, false))} disabled={actionLoadingId === chal.id} className="rounded bg-red-600/80 px-2 py-0.5 text-[10px] font-bold text-foreground hover:bg-red-600 transition cursor-pointer disabled:opacity-50">Settle NO</button>
                            </div>
                          </div>}
                          {chal.status === "settled" && (
                            chal.winner_wallet === walletAddress ? (
                              chal.payout_tx_sig ? (
                                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-surface-2 text-cyan">Claimed ✓</span>
                              ) : (
                                <button onClick={() => runAction(chal.id, () => p2pClaimPayout(chal.id))} disabled={actionLoadingId === chal.id} className="rounded bg-amber px-3 py-1 text-[11px] font-bold text-background hover:bg-amber/90 transition cursor-pointer disabled:opacity-50">{actionLoadingId === chal.id ? "Claiming…" : "Claim Payout"}</button>
                              )
                            ) : (
                              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-surface-2 text-muted-foreground">Settled ({chal.outcome ? "YES Win" : "NO Win"})</span>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, count, children, live, empty }: { title: string; count: number; children: React.ReactNode; live?: boolean; empty?: React.ReactNode; }) {
  return (
    <section className="mt-8">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 border-b border-line pb-2">
        <div className="flex items-center gap-2">
          {live && <span className="h-1.5 w-1.5 rounded-full bg-amber pip-live" aria-hidden />}
          <h2 className="font-display text-[14px] font-bold uppercase tracking-[0.16em]" style={{ fontFamily: "var(--font-display)" }}>{title}</h2>
          <span className="num font-mono text-[12px] text-muted-foreground">({count.toString().padStart(2, "0")})</span>
        </div>
      </div>
      {count === 0 && empty ? (
        typeof empty === "string" ? (
          <p className="py-6 text-[13px] text-muted-foreground">{empty}</p>
        ) : (
          <div className="py-6">{empty}</div>
        )
      ) : (
        <ul className="divide-y divide-line">{children}</ul>
      )}
    </section>
  );
}

function OtherFixturesSection({ fixtures }: { fixtures: Fixture[] }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="mt-8">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full grid grid-cols-[minmax(0,1fr)_auto] items-center border-b border-line pb-2 cursor-pointer group"
      >
        <div className="flex items-center gap-2">
          <h2 className="font-display text-[14px] font-bold uppercase tracking-[0.16em] text-muted-foreground group-hover:text-foreground transition" style={{ fontFamily: "var(--font-display)" }}>Other Fixtures</h2>
          <span className="num font-mono text-[12px] text-muted-foreground">({fixtures.length.toString().padStart(2, "0")})</span>
        </div>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="divide-y divide-line">
          {fixtures.map((f, i) => <FixtureRow key={f.id} f={f} index={i} muted />)}
        </ul>
      )}
    </section>
  );
}

function FixtureRow({ f, muted: _muted }: { f: Fixture; index: number; muted?: boolean }) {
  const isLive = f.state === "live";
  const isHT = f.state === "ht";
  const isEnded = f.state === "ended";
  const isSoon = f.state === "soon";

  // Live-ticking countdown for upcoming fixtures
  const kickoffMs = f.kickoffAt ? new Date(f.kickoffAt).getTime() : 0;
  const remaining = useCountdown(kickoffMs);
  const countdownText = isSoon && kickoffMs > 0 ? formatCountdown(remaining) : null;

  // Notify bell
  const { isSubscribed, subscribe, unsubscribe } = useMatchNotification(
    f.id,
    kickoffMs,
    `${f.home} vs ${f.away}`
  );
  const [subscribed, setSubscribed] = useState(() => isSubscribed());

  const handleBell = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (subscribed) {
      unsubscribe();
      setSubscribed(false);
      toast("Notifications off");
    } else {
      const ok = await subscribe();
      if (ok) {
        setSubscribed(true);
        toast.success("We'll notify you at kickoff");
      } else {
        toast.error("Enable browser notifications first");
      }
    }
  };

  const statusLabel = isLive
    ? `${f.minute}′`
    : isHT
    ? "HT"
    : isEnded
    ? "FT"
    : null;

  const isClosingSoon = (f.rawMarkets || []).some((m: any) => {
    if (m.status !== "open") return false;
    const rem = (new Date(m.closes_at).getTime() - Date.now()) / 1000;
    return rem > 0 && rem < 90;
  });

  return (
    <li>
      <Link to="/match/$matchId" params={{ matchId: f.id }}
        className={`group grid items-center gap-3 py-3 transition hover:bg-surface/60 cursor-pointer ${
          statusLabel || isLive
            ? "grid-cols-[44px_minmax(0,1fr)_72px] md:grid-cols-[48px_minmax(0,1.4fr)_minmax(0,1fr)_108px_36px]"
            : "grid-cols-[minmax(0,1fr)_72px] md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_108px_36px]"
        } md:gap-4 ${isClosingSoon ? "closing-ring rounded-sm" : ""}`}>

        {(statusLabel || isLive) && (
          <div className="flex items-center gap-1.5">
            {isLive && <span className="h-1.5 w-1.5 rounded-full bg-amber pip-live" aria-hidden />}
            {statusLabel && (
              <span className={`num font-mono text-[13px] tabular-nums ${isLive ? "text-amber" : "text-muted-foreground"}`}>
                {statusLabel}
              </span>
            )}
          </div>
        )}

        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex items-center gap-1.5 min-w-0 font-display text-[15px] font-semibold tracking-tight sm:text-[16px]" style={{ fontFamily: "var(--font-display)" }}>
              <FlagImg team={f.home} /><span className="truncate">{f.home}</span>
            </span>
            <span className={`num font-mono text-[13px] tabular-nums shrink-0 ${
              isSoon ? "text-muted-foreground" : isEnded ? "text-amber font-bold" : "text-muted-foreground"
            }`}>
              {isSoon ? "—" : `${f.homeScore}–${f.awayScore}`}
            </span>
            <span className="flex items-center gap-1.5 min-w-0 font-display text-[15px] font-semibold tracking-tight sm:text-[16px]" style={{ fontFamily: "var(--font-display)" }}>
              <FlagImg team={f.away} /><span className="truncate">{f.away}</span>
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] tracking-[0.12em] text-muted-foreground">
            <span>{normaliseComp(f.competition)}</span>
            {isSoon && countdownText && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber/5 border border-amber/20 px-2 py-0.5 text-[9px] font-semibold text-amber font-mono normal-case tracking-normal">
                <svg className="w-2.5 h-2.5 fill-none stroke-current" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {countdownText}
              </span>
            )}
            {isEnded && (
              <span className="inline-flex items-center rounded bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground font-mono normal-case">
                Finished
              </span>
            )}
          </div>
        </div>

        <div className="hidden md:block">
          {isLive ? <Sparkline points={f.velocity} muted={false} /> : null}
        </div>

        <div className="hidden text-right md:flex md:flex-col md:items-end md:justify-center">
          {isSoon ? (
            <button
              onClick={handleBell}
              title={subscribed ? "Mute notifications" : "Notify me at kickoff"}
              className={`mb-1 p-1 rounded transition cursor-pointer ${subscribed ? "text-amber" : "text-muted-foreground hover:text-foreground"}`}
            >
              {subscribed ? <Bell className="h-4 w-4 fill-current" /> : <Bell className="h-4 w-4" />}
            </button>
          ) : null}
          <MarketCountDisplay f={f} />
        </div>

        <div className="flex items-center justify-end gap-2">
          {isClosingSoon && <span className="hidden rounded-sm border border-amber/40 bg-amber/10 px-1.5 py-0.5 num font-mono text-[9px] uppercase tracking-[0.14em] text-amber sm:inline">closing</span>}
          <span className="text-muted-foreground transition group-hover:text-amber"><Chev /></span>
        </div>
      </Link>
    </li>
  );
}

function MarketCountDisplay({ f }: { f: Fixture }) {
  const isEnded = f.state === "ended";
  const isSoon = f.state === "soon";
  const isLive = f.state === "live" || f.state === "ht";
  const count = f.openMarkets ?? 0;
  const totalMarkets = (f.rawMarkets || []).length;

  if (isEnded) {
    return (
      <>
        <div className="num font-mono text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Settled</div>
        {totalMarkets > 0 && (
          <div className="text-[10px] text-muted-foreground/60">{totalMarkets} market{totalMarkets !== 1 ? "s" : ""}</div>
        )}
      </>
    );
  }

  if (isSoon) {
    return (
      <>
        <div className="num font-mono text-[10px] text-muted-foreground leading-tight">Markets</div>
        <div className="num font-mono text-[10px] text-muted-foreground/60 leading-tight">at kickoff</div>
      </>
    );
  }

  if (isLive && count === 0) {
    return (
      <div className="flex flex-col gap-1 items-end">
        {["w-8", "w-6", "w-5"].map((w, i) => (
          <div key={i} className={`h-1.5 ${w} rounded-full bg-muted-foreground/20 animate-pulse`} style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className={`num font-mono text-[15px] font-semibold tabular-nums ${count === 0 ? "text-muted-foreground" : "text-foreground"}`}>
        {count.toString().padStart(2, "0")}
      </div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">markets</div>
    </>
  );
}

function Sparkline({ points, muted }: { points: number[]; muted?: boolean }) {
  const w = 120, h = 24;
  const stepX = w / (points.length - 1);
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${(i * stepX).toFixed(1)},${(h - p * h).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} aria-hidden className="opacity-90">
      <path d={d} fill="none" stroke={muted ? "var(--clag)" : "var(--foreground)"} strokeWidth="1" strokeOpacity="0.9" />
      {!muted && <circle cx={(points.length - 1) * stepX} cy={h - points[points.length - 1] * h} r="1.6" fill="var(--amber)" />}
    </svg>
  );
}

function Chev() {
  return <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden><path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" /></svg>;
}
