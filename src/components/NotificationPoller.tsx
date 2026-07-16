import { useEffect } from "react";

const STORAGE_KEY = "ninety_notifyFixtures";

// Mounted once in the root layout — polls every 60s and fires browser notifications
// for fixtures kicking off within the next 2 minutes.
export function NotificationPoller() {
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    const check = () => {
      if (Notification.permission !== "granted") return;
      try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
        const now = Date.now();
        const due = stored.filter(
          (f: any) =>
            f.kickoffAt - now < 2 * 60 * 1000 && f.kickoffAt > now - 30000
        );
        due.forEach((f: any) => {
          new Notification("⚽ Ninety — match starting now", {
            body: `${f.label} — Markets are opening. Tap to stake.`,
            icon: "/icon.png",
            tag: f.fixtureId,
          });
        });
        const remaining = stored.filter(
          (f: any) => !due.some((d: any) => d.fixtureId === f.fixtureId)
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
      } catch {}
    };

    check();
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
  }, []);

  return null;
}
