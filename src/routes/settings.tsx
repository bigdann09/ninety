import { createFileRoute } from "@tanstack/react-router";
import { useApp } from "@/lib/app-context";
import { useState, useEffect } from "react";
import { Copy, Check, ShieldCheck, Globe, Cpu } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Ninety" },
      {
        name: "description",
        content: "Configure node client parameters, transaction slippage, display preferences, and notification routing.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const {
    isConnected,
    walletAddress,
    connectWallet,
    disconnectWallet,
    slippage,
    setSlippage,
    priorityFee,
    setPriorityFee,
    reducedMotion,
    setReducedMotion,
    highContrast,
    setHighContrast,
    liveTelemetry,
    setLiveTelemetry,
  } = useApp();

  const [network, setNetwork] = useState<string>(() => localStorage.getItem("ninety_network") || "devnet");
  const [notifications, setNotifications] = useState<boolean>(() => localStorage.getItem("ninety_notifications") === "true");
  const [timezone, setTimezone] = useState<string>(() => localStorage.getItem("ninety_timezone") || Intl.DateTimeFormat().resolvedOptions().timeZone);

  const [localSlippage, setLocalSlippage] = useState<number>(slippage);
  const [localPriority, setLocalPriority] = useState<string>(priorityFee);
  const [copied, setCopied] = useState<boolean>(false);

  // Sync network & notifications to localStorage
  const handleNetworkChange = (net: string) => {
    setNetwork(net);
    localStorage.setItem("ninety_network", net);
  };

  const handleNotificationsToggle = async (val: boolean) => {
    if (val && "Notification" in window) {
      const res = await Notification.requestPermission();
      if (res !== "granted") {
        toast.error("Notification permissions denied in browser settings.");
        setNotifications(false);
        localStorage.setItem("ninety_notifications", "false");
        return;
      }
    }
    setNotifications(val);
    localStorage.setItem("ninety_notifications", String(val));
  };

  const handleTimezoneChange = (tz: string) => {
    setTimezone(tz);
    localStorage.setItem("ninety_timezone", tz);
  };

  const handleSaveSlippage = (v: number) => {
    setLocalSlippage(v);
    setSlippage(v);
    localStorage.setItem("ninety_slippage", String(v));
    toast.success("Saved ✓");
  };

  const handleSavePriority = (lvl: string) => {
    setLocalPriority(lvl);
    setPriorityFee(lvl);
    localStorage.setItem("ninety_priority", lvl);
    toast.success("Saved ✓");
  };

  // Sync reduced motion attribute to document element
  useEffect(() => {
    if (reducedMotion) {
      document.documentElement.setAttribute("data-reduce-motion", "true");
    } else {
      document.documentElement.removeAttribute("data-reduce-motion");
    }
  }, [reducedMotion]);

  const copyWallet = () => {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="mx-auto max-w-[1080px] px-4 pb-32 pt-6 sm:px-6 flex flex-col gap-6">
      {/* Connected Identity Header Card */}
      <section className="rounded-md border border-line bg-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5 text-amber" /> Connected Identity
          </h2>
          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded border border-amber/30 bg-amber/10 text-amber">
            Network: {network}
          </span>
        </div>
        <h3 className="mt-2 font-display text-[22px] font-extrabold uppercase tracking-tight text-foreground" style={{ fontFamily: "var(--font-display)" }}>
          {isConnected ? `Wallet: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-6)}` : "Not Connected"}
        </h3>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {isConnected ? (
            <>
              <button
                onClick={copyWallet}
                className="flex items-center gap-1.5 rounded-sm border border-line bg-background px-3 py-1.5 num font-mono text-[12px] hover:border-foreground transition cursor-pointer"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-cyan" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                {walletAddress}
              </button>
              <button
                onClick={disconnectWallet}
                className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground hover:text-amber transition cursor-pointer"
              >
                Disconnect wallet
              </button>
            </>
          ) : (
            <button
              onClick={connectWallet}
              className="rounded bg-amber px-4 py-2 text-[12px] font-bold uppercase tracking-[0.12em] text-background hover:bg-amber/90 transition cursor-pointer"
            >
              Connect wallet
            </button>
          )}
        </div>
      </section>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-6">
        {/* Transaction & Node Settings */}
        <section className="rounded-md border border-line bg-surface p-5 flex flex-col justify-between gap-6">
          <div>
            <h2 className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Node & Transaction Execution
            </h2>

            {/* Network Cluster Toggle */}
            <div className="mt-4 flex items-center justify-between border-b border-line pb-4">
              <span className="text-[13px] text-muted-foreground flex items-center gap-2">
                <Globe className="h-4 w-4 text-amber" /> Solana Cluster
              </span>
              <div className="flex gap-1">
                {["devnet", "mainnet-beta"].map((net) => (
                  <button
                    key={net}
                    onClick={() => handleNetworkChange(net)}
                    className={`num font-mono text-[11px] rounded-sm border px-2.5 py-1 transition cursor-pointer uppercase ${
                      network === net
                        ? "border-amber bg-amber/10 text-amber font-bold"
                        : "border-line text-muted-foreground hover:border-foreground hover:text-foreground"
                    }`}
                  >
                    {net}
                  </button>
                ))}
              </div>
            </div>

            {/* Slippage tolerance */}
            <div className="mt-4 flex items-center justify-between border-b border-line pb-4">
              <span className="text-[13px] text-muted-foreground">Slippage tolerance (%)</span>
              <div className="flex gap-1">
                {[0.1, 0.5, 1.0].map((v) => (
                  <button
                    key={v}
                    onClick={() => handleSaveSlippage(v)}
                    className={`num font-mono text-[11px] rounded-sm border px-2 py-1 transition cursor-pointer ${
                      localSlippage === v
                        ? "border-amber bg-amber/10 text-amber font-bold"
                        : "border-line text-muted-foreground hover:border-foreground hover:text-foreground"
                    }`}
                  >
                    {v}%
                  </button>
                ))}
              </div>
            </div>

            {/* Priority Fee Slider */}
            <div className="mt-6">
              <div className="flex justify-between items-baseline mb-3">
                <span className="text-[13px] text-muted-foreground">Priority fee level</span>
                <span className="num font-mono text-[11px] font-bold text-amber">
                  {localPriority}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex gap-1 h-3">
                  {["LOW", "MEDIUM", "ACCELERATED"].map((lvl, index) => {
                    const isCurrent = localPriority === lvl;
                    const isPassed =
                      (localPriority === "MEDIUM" && index <= 1) ||
                      (localPriority === "ACCELERATED" && index <= 2);
                    return (
                      <button
                        key={lvl}
                        onClick={() => handleSavePriority(lvl)}
                        className={`flex-1 rounded-sm transition-all border cursor-pointer ${
                          isCurrent
                            ? "bg-amber border-amber"
                            : isPassed
                              ? "bg-amber/40 border-amber/35"
                              : "bg-background border-line"
                        }`}
                        title={lvl}
                      />
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Boosts landing speed during high traffic on Solana validator nodes.
                </p>
              </div>
            </div>

            {/* Timezone Preference — label and select are separate elements */}
            <div className="mt-6 border-t border-line pt-4 flex items-center justify-between">
              <label htmlFor="tz-select" className="text-[13px] text-muted-foreground">
                Local Timezone
              </label>
              <select
                id="tz-select"
                value={timezone}
                onChange={(e) => {
                  handleTimezoneChange(e.target.value);
                  toast.success("Saved ✓");
                }}
                className="text-[12px] font-mono bg-background border border-line px-2 py-1 rounded text-foreground focus:outline-none"
              >
                <option value="">Local (browser default)</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">EST — New York</option>
                <option value="Europe/London">GMT — London</option>
                <option value="Europe/Paris">CET — Paris</option>
                <option value="Asia/Tokyo">JST — Tokyo</option>
              </select>
            </div>
          </div>
        </section>

        {/* Display & Notification Settings */}
        <section className="rounded-md border border-line bg-surface p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Display & Routing
            </h2>
            <ul className="mt-4 divide-y divide-line">
              <ToggleRow
                label="Match Notifications"
                sub="Browser push alerts for market resolution"
                checked={notifications}
                onChange={handleNotificationsToggle}
              />
              <ToggleRow
                label="Reduced Motion"
                sub="Disable pitch animations and smooth transitions"
                checked={reducedMotion}
                onChange={setReducedMotion}
              />
              <ToggleRow
                label="High Contrast"
                sub="Pitch-side visibility high legibility mode"
                checked={highContrast}
                onChange={setHighContrast}
              />
              <ToggleRow
                label="Live Telemetry"
                sub="Show raw on-chain events stream"
                checked={liveTelemetry}
                onChange={setLiveTelemetry}
              />
            </ul>
          </div>
        </section>
      </div>

      {/* Security Status Bottom Footer */}
      <footer className="rounded-md border border-line bg-surface px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full border border-cyan/20 bg-cyan/5 text-cyan shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-cyan flex items-center gap-1.5">
              Security Status <span className="h-1.5 w-1.5 rounded-full bg-cyan pip-live" /> Solana Devnet Verified
            </h4>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              All settlements audited by Solana runtime program <code className="text-amber">7uRe...PLHHjN</code>.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}

interface ToggleRowProps {
  label: string;
  sub: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}

function ToggleRow({ label, sub, checked, onChange }: ToggleRowProps) {
  return (
    <li className="py-4 flex items-center justify-between gap-4">
      <div>
        <h3 className="text-[13px] font-semibold text-foreground">{label}</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full relative transition-colors duration-200 cursor-pointer ${
          checked ? "bg-amber" : "bg-line border border-line"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-background transition-transform duration-200 shadow-sm ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </li>
  );
}
