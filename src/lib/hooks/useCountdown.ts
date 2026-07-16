import { useState, useEffect, useRef } from "react";

export function useCountdown(targetMs: number) {
  const [remaining, setRemaining] = useState(() => targetMs - Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const tick = () => {
      const r = targetMs - Date.now();
      setRemaining(r);
      if (r <= 0 && intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };

    tick();

    // Tick every second if under 1 hour, every 30s otherwise
    const interval = targetMs - Date.now() < 3600000 ? 1000 : 30000;
    intervalRef.current = setInterval(tick, interval);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [targetMs]);

  return remaining;
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "LIVE";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
