import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/lib/app-context";
import { FlagImg } from "@/lib/flags";
import { Flame, Trophy, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { API_URL } from "@/lib/config";

export const Route = createFileRoute("/streak")({
  head: () => ({
    meta: [
      { title: "Daily Streak — Ninety" },
      {
        name: "description",
        content: "One free pick a day. Call it right, build your streak, climb the leaderboard.",
      },
    ],
  }),
  component: StreakPage,
});

type StreakFixture = {
  id: string;
  home_team: string;
  away_team: string;
  competition: string;
  kickoff_at: string;
};

type MyStreak = {
  currentStreak: number;
  bestStreak: number;
  correctCount: number;
  settledCount: number;
  xp: number;
  pickedToday: boolean;
  picks: any[];
};

function StreakPage() {
  const { isConnected, walletAddress, connectWallet } = useApp();
  const queryClient = useQueryClient();

  const fixturesQuery = useQuery<StreakFixture[]>({
    queryKey: ["streak-fixtures"],
    queryFn: () => fetch(`${API_URL}/api/streak/fixtures`).then((r) => r.json()),
    staleTime: 60000,
  });

  const meQuery = useQuery<MyStreak>({
    queryKey: ["streak-me", walletAddress],
    queryFn: () => fetch(`${API_URL}/api/streak/me/${walletAddress}`).then((r) => r.json()),
    enabled: !!walletAddress,
    staleTime: 30000,
  });

  const leaderboardQuery = useQuery<any[]>({
    queryKey: ["streak-leaderboard"],
    queryFn: () => fetch(`${API_URL}/api/streak/leaderboard`).then((r) => r.json()),
    staleTime: 60000,
  });

  const fixtures = Array.isArray(fixturesQuery.data) ? fixturesQuery.data : [];
  const me = meQuery.data;
  const leaderboard = Array.isArray(leaderboardQuery.data) ? leaderboardQuery.data : [];

  const submitPick = async (matchId: string, pick: "home" | "draw" | "away") => {
    if (!isConnected || !walletAddress) {
      connectWallet();
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/streak/pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: walletAddress, match_id: matchId, pick }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error || "Pick failed");
        return;
      }
      toast.success("Pick locked in — settles at full time. 🔥");
      queryClient.invalidateQueries({ queryKey: ["streak-me", walletAddress] });
    } catch {
      toast.error("Pick failed. Try again.");
    }
  };

  return (
    <main className="mx-auto max-w-[1080px] px-4 pb-32 pt-6 sm:px-6">
      <header className="border-b border-line pb-5">
        <h1
          className="font-display text-[34px] font-extrabold uppercase leading-[0.95] tracking-[-0.02em] sm:text-[44px]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Daily
          <br />
          streak
        </h1>
        <p className="mt-2 text-[12px] uppercase tracking-[0.14em] text-amber font-mono">
          One free pick a day · no SOL required · XP only
        </p>
      </header>

      {/* My streak stats */}
      <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-4">
        <Stat
          label="Current streak"
          value={me ? `${me.currentStreak} 🔥` : "—"}
        />
        <Stat label="Best streak" value={me ? me.bestStreak.toString() : "—"} />
        <Stat label="XP" value={me ? me.xp.toString() : "—"} />
        <Stat
          label="Accuracy"
          value={me && me.settledCount > 0 ? `${Math.round((me.correctCount / me.settledCount) * 100)}%` : "—"}
        />
      </dl>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-8 items-start">
        {/* Today's pick */}
        <section>
          <div className="flex items-center gap-2 border-b border-line pb-2">
            <Flame className="h-4 w-4 text-amber" />
            <h2 className="font-display text-[14px] font-bold uppercase tracking-[0.16em]" style={{ fontFamily: "var(--font-display)" }}>
              Today's pick
            </h2>
          </div>

          {fixturesQuery.isLoading ? (
            <div className="mt-6 text-center py-10 border border-dashed border-line rounded-md">
              <Clock className="h-6 w-6 text-muted-foreground mx-auto mb-2 opacity-60 animate-pulse" />
              <p className="text-muted-foreground text-[13px]">Loading fixtures...</p>
            </div>
          ) : isConnected && me?.pickedToday ? (
            <div className="mt-6 rounded-md border border-amber/30 bg-amber/5 p-6 text-center">
              <CheckCircle2 className="h-6 w-6 text-amber mx-auto mb-2" />
              <p className="text-[13px] font-semibold text-foreground">Today's pick is locked in.</p>
              <p className="text-[11px] text-muted-foreground mt-1">It settles at full time — come back tomorrow for the next one.</p>
            </div>
          ) : fixtures.length === 0 ? (
            <div className="mt-6 text-center py-10 border border-dashed border-line rounded-md">
              <Clock className="h-6 w-6 text-muted-foreground mx-auto mb-2 opacity-60" />
              <p className="text-muted-foreground text-[13px]">No fixtures kicking off in the next 72 hours.</p>
            </div>
          ) : (
            <>
              {!isConnected && (
                <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-dashed border-line bg-surface/30 px-4 py-2.5">
                  <p className="text-[12px] text-muted-foreground">Connect your wallet to lock in a pick — it's free.</p>
                  <button
                    onClick={connectWallet}
                    className="shrink-0 rounded-sm bg-foreground text-background px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] hover:bg-amber cursor-pointer"
                  >
                    Connect
                  </button>
                </div>
              )}
              <ul className="mt-4 flex flex-col gap-3">
              {fixtures.map((f) => (
                <li key={f.id} className="rounded-md border border-line bg-surface p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <span className="font-display text-[15px] font-semibold flex items-center gap-1.5">
                      <FlagImg team={f.home_team} />{f.home_team} vs <FlagImg team={f.away_team} />{f.away_team}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">
                      {new Date(f.kickoff_at).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => submitPick(f.id, "home")}
                      className="rounded-sm border border-line px-2 py-2 text-[12px] font-semibold hover:border-amber hover:text-amber transition cursor-pointer"
                    >
                      {f.home_team} win
                    </button>
                    <button
                      onClick={() => submitPick(f.id, "draw")}
                      className="rounded-sm border border-line px-2 py-2 text-[12px] font-semibold hover:border-amber hover:text-amber transition cursor-pointer"
                    >
                      Draw
                    </button>
                    <button
                      onClick={() => submitPick(f.id, "away")}
                      className="rounded-sm border border-line px-2 py-2 text-[12px] font-semibold hover:border-amber hover:text-amber transition cursor-pointer"
                    >
                      {f.away_team} win
                    </button>
                  </div>
                </li>
              ))}
              </ul>
            </>
          )}

          {/* My recent picks */}
          {isConnected && (me?.picks?.length ?? 0) > 0 && (
            <div className="mt-8">
              <h3 className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground border-b border-line pb-2">Recent picks</h3>
              <ul className="mt-3 flex flex-col gap-2">
                {me!.picks.slice(0, 8).map((p: any) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 text-[12px] py-1.5 border-b border-line/40">
                    <span className="min-w-0 truncate text-foreground">
                      {p.match?.home_team} vs {p.match?.away_team}
                      <span className="text-muted-foreground"> · picked {p.pick}</span>
                    </span>
                    {p.settled ? (
                      p.correct ? (
                        <span className="flex items-center gap-1 text-cyan font-mono text-[11px] shrink-0"><CheckCircle2 className="h-3.5 w-3.5" /> +10 XP</span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-400 font-mono text-[11px] shrink-0"><XCircle className="h-3.5 w-3.5" /> streak reset</span>
                      )
                    ) : (
                      <span className="flex items-center gap-1 text-muted-foreground font-mono text-[11px] shrink-0"><Clock className="h-3.5 w-3.5" /> pending</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Leaderboard */}
        <section>
          <div className="flex items-center gap-2 border-b border-line pb-2">
            <Trophy className="h-4 w-4 text-amber" />
            <h2 className="font-display text-[14px] font-bold uppercase tracking-[0.16em]" style={{ fontFamily: "var(--font-display)" }}>
              Leaderboard
            </h2>
          </div>
          {leaderboard.length === 0 ? (
            <p className="mt-6 text-[12px] text-muted-foreground italic">No settled picks yet — be the first on the board.</p>
          ) : (
            <ol className="mt-4 flex flex-col">
              {leaderboard.map((row: any, i: number) => {
                const isMe = row.wallet === walletAddress;
                return (
                  <li
                    key={row.wallet}
                    className={`flex items-center gap-3 py-2.5 border-b border-line/40 ${isMe ? "bg-amber/5 -mx-2 px-2 rounded" : ""}`}
                  >
                    <span className={`num font-mono text-[12px] w-6 shrink-0 ${i < 3 ? "text-amber font-bold" : "text-muted-foreground"}`}>
                      {i + 1}
                    </span>
                    <span className="num font-mono text-[12px] flex-1 truncate text-foreground">
                      {row.wallet.slice(0, 4)}…{row.wallet.slice(-4)}{isMe ? " (you)" : ""}
                    </span>
                    <span className="num font-mono text-[12px] text-amber font-bold shrink-0">{row.currentStreak} 🔥</span>
                    <span className="num font-mono text-[11px] text-muted-foreground w-14 text-right shrink-0">{row.xp} XP</span>
                  </li>
                );
              })}
            </ol>
          )}
          <p className="mt-4 text-[10px] text-muted-foreground font-mono leading-relaxed">
            +10 XP per correct call · streak bonus at settlement · wrong pick resets your run to zero.
          </p>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface p-4 sm:p-5">
      <dt className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-mono">{label}</dt>
      <dd className="mt-1.5 num font-mono text-[18px] font-semibold tabular-nums sm:text-[20px]">{value}</dd>
    </div>
  );
}
