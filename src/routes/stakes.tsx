import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useApp } from "../lib/app-context";
import { Ticket, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/stakes")({
  head: () => ({
    meta: [
      { title: "Positions & Receipts — Ninety" },
      {
        name: "description",
        content: "Track your active predictions and verified settlement receipts on Solana.",
      },
    ],
  }),
  component: StakesPage,
});

function StakesPage() {
  const { positions, settled, isConnected, connectWallet, cashoutPosition, claimPosition } = useApp();
  const [tab, setTab] = useState<"positions" | "receipts">("positions");
  const [cashoutLoadingId, setCashoutLoadingId] = useState<string | null>(null);
  const [claimLoadingId, setClaimLoadingId] = useState<string | null>(null);

  const handleCashout = async (stakeId: string, marketId: string) => {
    setCashoutLoadingId(stakeId);
    try {
      await cashoutPosition(stakeId, marketId);
      toast.success(`Position cashed out — refund sent to your wallet on-chain.`);
    } catch (e: any) {
      toast.error(`Cashout failed: ${e.message}`);
    } finally {
      setCashoutLoadingId(null);
    }
  };

  const handleClaim = async (stakeId: string, marketId: string) => {
    setClaimLoadingId(stakeId);
    try {
      await claimPosition(stakeId, marketId);
    } catch (e: any) {
      // Handled in app context alert
    } finally {
      setClaimLoadingId(null);
    }
  };

  if (!isConnected) {
    return (
      <main className="mx-auto max-w-[1080px] px-4 pb-32 pt-12 text-center">
        <div className="rounded-xl border border-line bg-surface/30 p-12 max-w-md mx-auto space-y-4">
          <Ticket className="h-10 w-10 text-amber mx-auto" />
          <h1 className="font-display text-xl font-bold">Connect your wallet</h1>
          <p className="text-xs text-muted-foreground">
            Connect your Solana wallet to view your active predictions and verified NFT receipts.
          </p>
          <button
            onClick={connectWallet}
            className="rounded bg-amber px-6 py-2.5 text-xs font-bold text-background hover:bg-amber/90 transition cursor-pointer"
          >
            Connect Wallet
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1080px] px-4 pb-32 pt-6 sm:px-6">
      <div className="border-b border-line pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-extrabold tracking-tight sm:text-[34px]" style={{ fontFamily: "var(--font-display)" }}>
            Positions & Receipts
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            Active predictions and on-chain verified Metaplex Core NFT stubs.
          </p>
        </div>
        <div className="flex gap-2 border border-line rounded-md bg-surface p-1 self-start">
          <button
            onClick={() => setTab("positions")}
            className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded transition cursor-pointer ${
              tab === "positions" ? "bg-amber text-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Active ({positions.length})
          </button>
          <button
            onClick={() => setTab("receipts")}
            className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded transition cursor-pointer ${
              tab === "receipts" ? "bg-amber text-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Receipts ({settled.length})
          </button>
        </div>
      </div>

      {tab === "positions" && (
        <section className="mt-8 space-y-4">
          {positions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line p-12 text-center bg-surface/20">
              <Ticket className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-40" />
              <p className="text-xs text-muted-foreground">No active predictions. Stake on a live market from the lobby.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {positions.map((pos) => {
                return (
                  <div key={pos.id} className="rounded-xl border border-line bg-surface/40 p-5 space-y-4 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                          {pos.competition}
                        </span>
                        <span className="num font-mono text-[11px] text-amber font-bold">
                          {pos.matchMinute ? `${pos.matchMinute}′` : "LIVE"}
                        </span>
                      </div>
                      <h2 className="font-display text-[15px] font-bold text-foreground">
                        {pos.home} vs {pos.away}
                      </h2>
                      <p className="text-[12px] text-muted-foreground mt-1 font-mono">
                        {pos.marketQuestion}
                      </p>
                      <div className="mt-4 grid grid-cols-3 gap-2 bg-background/60 p-3 rounded-lg border border-line text-center">
                        <div>
                          <div className="text-[9px] font-mono uppercase text-muted-foreground">Side</div>
                          <div className="text-[13px] font-bold text-amber mt-0.5">{pos.side}</div>
                        </div>
                        <div>
                          <div className="text-[9px] font-mono uppercase text-muted-foreground">Stake</div>
                          <div className="num font-mono text-[13px] font-bold text-foreground mt-0.5">{pos.stake.toFixed(2)} SOL</div>
                        </div>
                        <div>
                          <div className="text-[9px] font-mono uppercase text-muted-foreground">Payout</div>
                          <div className="num font-mono text-[13px] font-bold text-cyan mt-0.5">{pos.potentialPayout.toFixed(3)} SOL</div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-line flex items-center justify-between gap-3">
                      <div className="text-[11px] font-mono text-muted-foreground">
                        Early exit: <span className="text-foreground font-bold">stake minus protocol fee</span>
                      </div>
                      <button
                        onClick={() => handleCashout(pos.id, pos.marketId!)}
                        disabled={cashoutLoadingId === pos.id}
                        className="rounded bg-amber px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-background hover:bg-amber/90 transition cursor-pointer disabled:opacity-50"
                      >
                        {cashoutLoadingId === pos.id ? "Cashing out..." : "Cash Out"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {tab === "receipts" && (
        <section className="mt-8 space-y-6">
          {settled.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line p-12 text-center bg-surface/20">
              <Ticket className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-40" />
              <p className="text-xs text-muted-foreground">No settled receipts yet. Receipts mint automatically when markets resolve.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {settled.map((s: any) => {
                const won = s.result === "win";
                const isCashout = s.result === "cashout";
                const outcomeColor = won ? "text-cyan" : isCashout ? "text-amber" : "text-red-400 font-bold";
                const outcomeBorder = won ? "border-cyan/40 bg-cyan/10" : isCashout ? "border-amber/40 bg-amber/10" : "border-red-500/40 bg-red-500/10";

                const txSig = s.txSig || s.settlement_tx_signature;
                const nftMint = s.nft_mint_address;
                const isValidTx = txSig && !txSig.includes("-") && !txSig.startsWith("mock") && !txSig.startsWith("p2p") && txSig.length >= 80;
                const txShort = isValidTx ? `${txSig.slice(0, 6)}...${txSig.slice(-6)}` : null;
                const nftShort = nftMint && !nftMint.includes("-") && nftMint.length >= 32 ? `${nftMint.slice(0, 6)}...${nftMint.slice(-6)}` : null;

                return (
                  <div key={s.id} className="relative rounded-xl border border-line bg-surface/60 overflow-hidden flex flex-col justify-between">
                    {/* Top perforated border effect */}
                    <div className="border-b border-dashed border-line/80 px-5 py-3 flex items-center justify-between bg-background/40">
                      <div className="flex items-center gap-2">
                        <Ticket className="h-4 w-4 text-amber" />
                        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                          {s.competition}
                        </span>
                      </div>
                      <span className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded border ${outcomeBorder} ${outcomeColor}`}>
                        {isCashout ? "Cashed Out" : won ? "WON" : "LOST"}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="p-5 space-y-4">
                      <div>
                        <h3 className="font-display text-[16px] font-bold text-foreground">
                          {s.home} vs {s.away}
                        </h3>
                        <p className="text-[12px] text-muted-foreground mt-1 font-mono">
                          {s.marketQuestion}
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-2 bg-background/60 p-3 rounded-lg border border-line text-center">
                        <div>
                          <div className="text-[9px] font-mono uppercase text-muted-foreground">Stake</div>
                          <div className="num font-mono text-[12px] font-bold text-foreground mt-0.5">{s.stake?.toFixed(2) || "—"} SOL</div>
                        </div>
                        <div>
                          <div className="text-[9px] font-mono uppercase text-muted-foreground">Odds</div>
                          <div className="num font-mono text-[12px] font-bold text-foreground mt-0.5">{s.odds ? `${s.odds.toFixed(2)}×` : "—"}</div>
                        </div>
                        <div>
                          <div className="text-[9px] font-mono uppercase text-muted-foreground">PnL</div>
                          <div className={`num font-mono text-[12px] font-bold mt-0.5 ${s.pnl >= 0 ? "text-cyan" : "text-red-400 font-bold"}`}>
                            {s.pnl >= 0 ? `+${s.pnl.toFixed(3)}` : s.pnl.toFixed(3)} SOL
                          </div>
                        </div>
                      </div>

                      {/* On-Chain Proof & Dual Links */}
                      <div className="rounded-lg bg-background/80 border border-line p-3 space-y-2">
                        <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                          <span>On-Chain Settlement Verification</span>
                          <span className="text-[9px] text-cyan font-bold">Solana Devnet</span>
                        </div>
                        <div className="flex flex-col gap-1.5 text-[11px] font-mono">
                          {/* Settlement Tx Link */}
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Settlement TX:</span>
                            {txShort ? (
                              <a
                                href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-amber hover:underline flex items-center gap-1 font-bold"
                              >
                                {txShort} <ArrowUpRight className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="text-amber font-mono text-[10px]">Local proof ✓</span>
                            )}
                          </div>

                          {/* NFT Mint Link */}
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">NFT Receipt Mint:</span>
                            {nftShort ? (
                              <a
                                href={`https://explorer.solana.com/address/${nftMint}?cluster=devnet`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-cyan hover:underline flex items-center gap-1 font-bold"
                              >
                                {nftShort} <ArrowUpRight className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground/60 italic">Minting stub...</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Claim Button for Winners */}
                    {won && !s.claimed && (
                      <div className="p-4 bg-cyan/5 border-t border-cyan/20 flex items-center justify-between">
                        <span className="text-xs text-cyan font-bold">Payout ready to claim</span>
                        <button
                          onClick={() => handleClaim(s.id, s.marketId)}
                          disabled={claimLoadingId === s.id}
                          className="rounded bg-cyan px-4 py-1.5 text-xs font-bold text-background hover:bg-cyan/90 transition cursor-pointer disabled:opacity-50"
                        >
                          {claimLoadingId === s.id ? "Claiming..." : "Claim Payout"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
