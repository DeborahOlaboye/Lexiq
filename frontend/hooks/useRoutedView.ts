"use client";
import { useCallback, useEffect, useState } from "react";

/**
 * Keeps a view in the address bar.
 *
 * Every screen used to be one route holding its position in React state, so the URL never
 * changed. Nothing could be linked to, a refresh dropped you back at the lobby, and on a phone
 * the back button left the app entirely rather than going back a screen — which is the single
 * most common way someone exits a mini app by accident.
 *
 * This uses the History API rather than the router on purpose. Every path here renders the same
 * component, so routing through Next would unmount and remount the whole tree — losing an
 * in-progress round to change a URL that describes it. pushState moves the address bar and
 * leaves the tree alone, and popstate carries the back button into the same state change.
 *
 * The routes exist as real files, so these paths also survive a hard refresh and give a crawler
 * more than one page to read.
 */
export function useRoutedView<V extends string>(opts: {
  paths: Record<V, string>;
  fallback: V;
  /** Views with no URL of their own — overlays and interstitials. They leave the path alone. */
  transient?: readonly V[];
}): [V, (v: V) => void] {
  const { paths, fallback, transient } = opts;

  const viewForPath = useCallback((path: string): V | null => {
    const hit = (Object.keys(paths) as V[]).find((v) => paths[v] === path);
    return hit ?? null;
  }, [paths]);

  // Read on first render so a deep link opens on the right screen rather than flashing the
  // lobby and then moving.
  const [view, setViewState] = useState<V>(() => {
    if (typeof window === "undefined") return fallback;
    return viewForPath(window.location.pathname) ?? fallback;
  });

  const setView = useCallback((next: V) => {
    setViewState(next);
    if (typeof window === "undefined") return;
    if (transient?.includes(next)) return;
    const path = paths[next];
    if (path && window.location.pathname !== path) {
      window.history.pushState({ view: next }, "", path + window.location.search);
    }
  }, [paths, transient]);

  // The back button is a navigation like any other; without this it would leave the app.
  useEffect(() => {
    const onPop = () => {
      const next = viewForPath(window.location.pathname);
      if (next) setViewState(next);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [viewForPath]);

  return [view, setView];
}
