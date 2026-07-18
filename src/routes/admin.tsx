import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import * as anchor from "@anchor-lang/core";
import { useApp } from "../lib/app-context";
import { API_URL, NINETY_PROGRAM_ID } from "../lib/config";
import {
  Settings,
  Wallet,
  Database,
  CheckCircle,
  CloseCircle,
  DangerTriangle,
  Refresh,
  Bolt,
  GraphUp,
  Shield,
} from "@solar-icons/react/ssr";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Keeper Admin — Ninety" }],
  }),
  component: AdminPage,
});

const PROGRAM_ID = new anchor.web3.PublicKey(NINETY_PROGRAM_ID);
const KEEPER = "GP4vEquiGYPrw42WETmRBeyAUNA59pRR8WUD9TKUYsMG";

function getConfigPda(): anchor.web3.PublicKey {
  const [pda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    PROGRAM_ID
  );
  return pda;
}

function AdminPage() {
  const { program, walletAddress, isConnected, connectWallet } = useApp();

  const [treasury, setTreasury] = useState(KEEPER);
  const [feeBps, setFeeBps] = useState(200);
  const [configState, setConfigState] = useState<{
    exists: boolean;
    treasury?: string;
    fee_bps?: number;
    authority?: string;
  } | null>(null);
  const [contractLoading, setContractLoading] = useState(false);
  const [contractMsg, setContractMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [dbStatus, setDbStatus] = useState<{
    connected: boolean;
    tables: string[];
    error?: string;
  } | null>(null);
  const [dbLoading, setDbLoading] = useState(false);

  const isKeeper = walletAddress === KEEPER;
  const configPda = getConfigPda();

  const fetchConfig = async () => {
    if (!program) return;
    try {
      const cfg = await (program.account as any).programConfig.fetch(configPda);
      setConfigState({
        exists: true,
        treasury: cfg.treasury.toBase58(),
        fee_bps: cfg.feeBps,
        authority: cfg.authority.toBase58(),
      });
    } catch {
      setConfigState({ exists: false });
    }
  };

  useEffect(() => {
    if (program) fetchConfig();
  }, [program]);

  const handleInitialize = async () => {
    if (!program || !isKeeper) return;
    setContractLoading(true);
    setContractMsg(null);
    try {
      const treasuryPubkey = new anchor.web3.PublicKey(treasury);
      const tx = await (program.methods as any)
        .initialize(treasuryPubkey, feeBps)
        .accounts({
          authority: new anchor.web3.PublicKey(walletAddress),
          config: configPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      setContractMsg({ type: "ok", text: `Initialized! tx: ${tx}` });
      await fetchConfig();
    } catch (e: any) {
      setContractMsg({ type: "err", text: e.message });
    } finally {
      setContractLoading(false);
    }
  };

  const handleUpdateConfig = async () => {
    if (!program || !isKeeper) return;
    setContractLoading(true);
    setContractMsg(null);
    try {
      const treasuryPubkey = new anchor.web3.PublicKey(treasury);
      const tx = await (program.methods as any)
        .updateConfig(treasuryPubkey, feeBps)
        .accounts({
          authority: new anchor.web3.PublicKey(walletAddress),
          config: configPda,
        })
        .rpc();
      setContractMsg({ type: "ok", text: `Config updated! tx: ${tx}` });
      await fetchConfig();
    } catch (e: any) {
      setContractMsg({ type: "err", text: e.message });
    } finally {
      setContractLoading(false);
    }
  };

  const testSupabase = async () => {
    setDbLoading(true);
    setDbStatus(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/db-status`);
      const data = await res.json();
      setDbStatus(data);
    } catch (e: any) {
      setDbStatus({ connected: false, tables: [], error: e.message });
    } finally {
      setDbLoading(false);
    }
  };

  useEffect(() => {
    testSupabase();
  }, []);

  return (
    <main className="mx-auto max-w-[900px] px-4 pb-32 pt-8 sm:px-6">
      <div className="border-b border-line pb-6 mb-8">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground mb-2">
          <Shield className="h-3.5 w-3.5" />
          <span>Keeper Admin Panel</span>
        </div>
        <h1 className="font-display text-[28px] font-extrabold tracking-tight">
          Ninety Protocol Admin
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground max-w-[52ch]">
          Initialize the on-chain program, set your treasury wallet, configure the protocol fee, and verify database connectivity.
        </p>
      </div>

      {!isConnected ? (
        <div className="rounded-xl border border-dashed border-line p-10 text-center">
          <Wallet className="h-10 w-10 text-amber mx-auto mb-3 opacity-60" />
          <p className="text-[14px] font-semibold mb-4">Connect the keeper wallet to continue</p>
          <button
            onClick={connectWallet}
            className="rounded-lg bg-amber px-6 py-2.5 text-sm font-bold text-background hover:bg-amber/90 transition cursor-pointer"
          >
            Connect Wallet
          </button>
        </div>
      ) : !isKeeper ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 text-center">
          <CloseCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
          <p className="text-[13px] text-red-400 font-mono">
            Connected wallet is not the keeper authority.
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Expected: <span className="font-mono">{KEEPER.slice(0, 8)}…{KEEPER.slice(-8)}</span>
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Connected: <span className="font-mono">{walletAddress.slice(0, 8)}…{walletAddress.slice(-8)}</span>
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-xl border border-line bg-surface/30 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bolt className="h-4 w-4 text-amber" />
                <h2 className="font-bold text-[15px]">On-chain Program Config</h2>
              </div>
              <button
                onClick={fetchConfig}
                className="text-[11px] text-muted-foreground hover:text-foreground transition flex items-center gap-1 cursor-pointer"
              >
                <Refresh className="h-3 w-3" /> Refresh
              </button>
            </div>

            {configState === null ? (
              <p className="text-[12px] text-muted-foreground animate-pulse">Loading config…</p>
            ) : configState.exists ? (
              <div className="space-y-2 font-mono text-[12px]">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-green-400 shrink-0" />
                  <span className="text-muted-foreground">Initialized</span>
                </div>
                <div className="grid grid-cols-[120px_1fr] gap-1 pl-5.5">
                  <span className="text-muted-foreground">Treasury</span>
                  <span className="text-amber truncate">{configState.treasury}</span>
                  <span className="text-muted-foreground">Fee</span>
                  <span className="text-foreground">{configState.fee_bps} bps ({((configState.fee_bps ?? 0) / 100).toFixed(1)}%)</span>
                  <span className="text-muted-foreground">Authority</span>
                  <span className="text-foreground truncate">{configState.authority}</span>
                  <span className="text-muted-foreground">Config PDA</span>
                  <span className="text-foreground truncate">{configPda.toBase58()}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[12px] text-yellow-400">
                <DangerTriangle className="h-3.5 w-3.5" />
                Program not initialized — run Initialize below.
              </div>
            )}
          </div>

          <div className="rounded-xl border border-line bg-surface/30 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="h-4 w-4 text-amber" />
              <h2 className="font-bold text-[15px]">
                {configState?.exists ? "Update Config" : "Initialize Program"}
              </h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
                  Treasury Wallet Address
                </label>
                <input
                  type="text"
                  value={treasury}
                  onChange={(e) => setTreasury(e.target.value)}
                  className="w-full font-mono text-[12px] bg-background border border-line rounded-lg px-3 py-2.5 text-foreground focus:outline-none focus:border-amber/60 transition"
                  placeholder="Solana pubkey that receives fees"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  This wallet collects the protocol fee on every winning claim and every cashout.
                </p>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
                  Fee (basis points) — max 1000 bps = 10%
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    step={10}
                    value={feeBps}
                    onChange={(e) => setFeeBps(Number(e.target.value))}
                    className="w-32 font-mono text-[13px] bg-background border border-line rounded-lg px-3 py-2.5 text-foreground focus:outline-none focus:border-amber/60 transition"
                  />
                  <div className="flex-1 h-2 bg-background rounded-full overflow-hidden border border-line">
                    <div
                      className="h-full bg-amber rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (feeBps / 1000) * 100)}%` }}
                    />
                  </div>
                  <span className="font-mono text-[14px] font-bold text-amber w-12 text-right">
                    {(feeBps / 100).toFixed(1)}%
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  On a 1 SOL win: you collect <span className="text-amber font-mono">{(1 * feeBps / 10000).toFixed(4)} SOL</span>, user receives <span className="text-foreground font-mono">{(1 - feeBps / 10000).toFixed(4)} SOL</span>.
                </p>
              </div>

              {contractMsg && (
                <div className={`rounded-lg border px-4 py-3 text-[12px] font-mono break-all ${contractMsg.type === "ok" ? "border-green-500/30 bg-green-500/5 text-green-400" : "border-red-500/30 bg-red-500/5 text-red-400"}`}>
                  {contractMsg.type === "ok" ? <CheckCircle className="inline h-3.5 w-3.5 mr-1.5" /> : <CloseCircle className="inline h-3.5 w-3.5 mr-1.5" />}
                  {contractMsg.text}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                {!configState?.exists ? (
                  <button
                    onClick={handleInitialize}
                    disabled={contractLoading}
                    className="flex-1 rounded-lg bg-amber py-2.5 text-sm font-bold text-background hover:bg-amber/90 transition cursor-pointer disabled:opacity-50"
                  >
                    {contractLoading ? "Initializing…" : "Initialize Program"}
                  </button>
                ) : (
                  <button
                    onClick={handleUpdateConfig}
                    disabled={contractLoading}
                    className="flex-1 rounded-lg bg-amber py-2.5 text-sm font-bold text-background hover:bg-amber/90 transition cursor-pointer disabled:opacity-50"
                  >
                    {contractLoading ? "Updating…" : "Update Config"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-line bg-surface/30 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-amber" />
            <h2 className="font-bold text-[15px]">Supabase Database</h2>
          </div>
          <button
            onClick={testSupabase}
            disabled={dbLoading}
            className="text-[11px] text-muted-foreground hover:text-foreground transition flex items-center gap-1 cursor-pointer"
          >
            <Refresh className={`h-3 w-3 ${dbLoading ? "animate-spin" : ""}`} /> Test
          </button>
        </div>

        {dbLoading ? (
          <p className="text-[12px] text-muted-foreground animate-pulse">Testing connection…</p>
        ) : dbStatus === null ? (
          <p className="text-[12px] text-muted-foreground">Click Test to verify connection.</p>
        ) : dbStatus.connected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[12px] text-green-400">
              <CheckCircle className="h-4 w-4" />
              <span className="font-semibold">Connected to Supabase</span>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Tables found ({dbStatus.tables.length})</p>
              <div className="flex flex-wrap gap-2">
                {dbStatus.tables.length === 0 ? (
                  <div className="text-[12px] text-yellow-400 flex items-center gap-1.5">
                    <DangerTriangle className="h-3.5 w-3.5" />
                    No tables found — apply <code className="bg-surface px-1 rounded">supabase-schema.sql</code> in the SQL Editor.
                  </div>
                ) : (
                  dbStatus.tables.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 rounded border border-green-500/30 bg-green-500/5 px-2 py-0.5 text-[11px] font-mono text-green-400">
                      <CheckCircle className="h-2.5 w-2.5" /> {t}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[12px] text-red-400">
              <CloseCircle className="h-4 w-4" />
              <span className="font-semibold">Connection failed</span>
            </div>
            {dbStatus.error && (
              <p className="text-[11px] font-mono text-red-400/80 bg-red-500/5 border border-red-500/20 rounded p-2 break-all">
                {dbStatus.error}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-line bg-surface/30 p-5">
        <div className="flex items-center gap-2 mb-4">
          <GraphUp className="h-4 w-4 text-amber" />
          <h2 className="font-bold text-[15px]">Revenue Breakdown</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: "Fee Rate", value: `${(feeBps / 100).toFixed(1)}%`, sub: `${feeBps} bps` },
            { label: "Per 1 SOL win", value: `${(feeBps / 10000).toFixed(4)} SOL`, sub: "≈ protocol fee" },
            { label: "Per 10 SOL win", value: `${(10 * feeBps / 10000).toFixed(4)} SOL`, sub: "≈ protocol fee" },
          ].map(({ label, value, sub }) => (
            <div key={label} className="rounded-lg border border-line/50 bg-background p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
              <div className="font-mono text-[16px] font-bold text-amber mt-1">{value}</div>
              <div className="text-[10px] text-muted-foreground">{sub}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
