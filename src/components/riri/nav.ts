// ─────────────────────────────────────────────────────────────────────────────
// THE DEVICE'S NAVIGATION STACK — why Back is a real button.
//
// Ported from connected-suite/src/components/os/nav.ts. Push goes deeper, pop goes
// back exactly one level, home clears to the root. A plain reducer over an array,
// not a router: this is a 400-pixel panel with a handful of destinations, and a
// URL-backed router inside a floating dock would fight the app's own routes for the
// address bar.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useMemo, useState } from "react";

export type Route =
  | { name: "home" }
  | { name: "ask" }
  | { name: "account" }
  | { name: "inbox" }
  | { name: "help" }
  | { name: "settings" };

export type RouteName = Route["name"];

export const ROUTE_TITLES: Record<RouteName, string> = {
  home: "",
  ask: "Ask Riri",
  account: "My account",
  inbox: "Messages",
  help: "Help",
  settings: "Settings",
};

const HOME: Route = { name: "home" };

export function useOsNav(initial: Route = { name: "ask" }) {
  // The device opens on the CONVERSATION, not the home grid: Riri is the first
  // contact, and a customer who came to ask something should find her already
  // listening. Home is one press of the home button away.
  const [stack, setStack] = useState<Route[]>(initial.name === "home" ? [HOME] : [HOME, initial]);
  const route = stack[stack.length - 1];
  const depth = stack.length - 1;
  const parent = depth > 0 ? stack[stack.length - 2] : null;

  const push = useCallback((next: Route) => {
    setStack((s) => (s[s.length - 1].name === next.name ? [...s.slice(0, -1), next] : [...s, next]));
  }, []);
  const pop = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);
  const home = useCallback(() => setStack([HOME]), []);
  const launch = useCallback((next: Route) => setStack(next.name === "home" ? [HOME] : [HOME, next]), []);

  const backLabel = useMemo(() => (parent ? (parent.name === "home" ? "Home" : ROUTE_TITLES[parent.name]) : null), [parent]);

  return { route, depth, push, pop, home, launch, backLabel, atHome: depth === 0 };
}

export type OsNav = ReturnType<typeof useOsNav>;
