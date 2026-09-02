"use client";
import { useCallback, useEffect, useState } from "react";
import { getStoredUsername, saveUsername } from "@/lib/player";

type Profile = {
  /** null once resolved and no name is set; undefined while still loading. */
  username: string | null | undefined;
  /** True only when we know the wallet has no name yet — never while loading. */
  needsSignUp: boolean;
  saving: boolean;
  error: string | null;
  setUsername: (name: string) => Promise<boolean>;
};

/**
 * Username for a connected wallet, resolved server-side so it survives reinstalls and
 * follows the player across devices. The cookie is kept in sync so the rest of the app —
 * which reads `getStoredUsername()` synchronously — sees the same value.
 */
export function useProfile(address?: string): Profile {
  const [username, setUsernameState] = useState<string | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) { setUsernameState(undefined); return; }
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/profile?address=${address}`);
        const data = await res.json();
        if (cancelled) return;
        if (data?.username) {
          // Server wins: it is the cross-device source of truth.
          saveUsername(data.username);
          setUsernameState(data.username);
          return;
        }
        // No server profile. A cookie from a previous guest session on this device is a
        // reasonable default to offer, but the wallet is not signed up until it is saved.
        setUsernameState(null);
      } catch {
        if (!cancelled) setUsernameState(getStoredUsername());
      }
    })();

    return () => { cancelled = true; };
  }, [address]);

  const setUsername = useCallback(async (name: string): Promise<boolean> => {
    if (!address) return false;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, username: name }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data?.error ?? "Could not save"); return false; }
      saveUsername(data.username);
      setUsernameState(data.username);
      return true;
    } catch {
      setError("Could not save. Check your connection and try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }, [address]);

  return {
    username,
    needsSignUp: !!address && username === null,
    saving,
    error,
    setUsername,
  };
}
