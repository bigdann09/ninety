import { useCallback } from "react";

const STORAGE_KEY = "ninety_notifyFixtures";

export interface NotifyFixture {
  fixtureId: string;
  kickoffAt: number;
  label: string;
}

export function useMatchNotification(
  fixtureId: string,
  kickoffAt: number,
  label: string
) {
  const isSubscribed = (): boolean => {
    if (typeof window === "undefined") return false;
    try {
      const stored: NotifyFixture[] = JSON.parse(
        localStorage.getItem(STORAGE_KEY) ?? "[]"
      );
      return stored.some((f) => f.fixtureId === fixtureId);
    } catch {
      return false;
    }
  };

  const subscribe = useCallback(async () => {
    if (typeof window === "undefined") return false;

    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
    if (!("Notification" in window) || Notification.permission !== "granted") {
      return false;
    }

    try {
      const stored: NotifyFixture[] = JSON.parse(
        localStorage.getItem(STORAGE_KEY) ?? "[]"
      );
      if (!stored.some((f) => f.fixtureId === fixtureId)) {
        stored.push({ fixtureId, kickoffAt, label });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      }
      return true;
    } catch {
      return false;
    }
  }, [fixtureId, kickoffAt, label]);

  const unsubscribe = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const stored: NotifyFixture[] = JSON.parse(
        localStorage.getItem(STORAGE_KEY) ?? "[]"
      );
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(stored.filter((f) => f.fixtureId !== fixtureId))
      );
    } catch {}
  }, [fixtureId]);

  return { isSubscribed, subscribe, unsubscribe };
}
