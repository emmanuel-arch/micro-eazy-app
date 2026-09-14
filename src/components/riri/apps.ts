// ─────────────────────────────────────────────────────────────────────────────
// THE CUSTOMER'S APPS — what is on Riri's phone for a borrower.
//
// The console's registry (connected-suite/src/components/os/apps.ts) names apps
// after what an officer does at 8am: Due Today, Arrears, Promises. A customer's day
// with a lender asks different questions — what do I owe, where is my application,
// did anyone reply — so the icons are those, in the same visual language.
//
// Two kinds of app, and the difference is honest:
//   · `route`  opens a screen INSIDE the phone (Ask, My account, Messages, Help…)
//   · `href`   takes the page behind the phone somewhere (Repay, Application, Score)
//     — the phone stays open, and the "why you are here" bar says Riri moved it.
//
// The gradients are fixed and do not follow --brand, for the console's reason: a
// lender's brown must not turn eight icons brown and destroy the only thing that
// distinguishes them. The wallpaper carries the lender's colour instead.
// ─────────────────────────────────────────────────────────────────────────────
import type { RouteName } from "./nav";

export type DeviceApp = {
  id: string;
  name: string;
  icon: string;
  tile: { from: string; to: string };
  blurb: string;
  route?: RouteName;
  href?: string;
  dock?: boolean;
  dockOnly?: boolean;
};

export const DEVICE_APPS: DeviceApp[] = [
  { id: "ask", name: "Ask Riri", icon: "MessageCircle", tile: { from: "#6366f1", to: "#4338ca" }, blurb: "Ask anything about your loan. A person is one message away.", route: "ask", dock: true },
  { id: "account", name: "My account", icon: "Wallet", tile: { from: "#14b8a6", to: "#0f766e" }, blurb: "What you owe, what you can borrow, your savings and score.", route: "account", dock: true },
  { id: "repay", name: "Repay", icon: "Banknote", tile: { from: "#22c55e", to: "#15803d" }, blurb: "Pay with an M-PESA prompt.", href: "/repay" },
  { id: "track", name: "Application", icon: "Route", tile: { from: "#f59e0b", to: "#b45309" }, blurb: "Which desk your application is on.", href: "/track" },
  { id: "score", name: "Score", icon: "Gauge", tile: { from: "#f97316", to: "#9a3412" }, blurb: "Your score and the reasons behind it.", href: "/score" },
  { id: "apply", name: "Apply", icon: "HandCoins", tile: { from: "#8b5cf6", to: "#5b21b6" }, blurb: "Choose a product and apply.", href: "/apply" },
  { id: "ladder", name: "Limit", icon: "TrendingUp", tile: { from: "#ec4899", to: "#9d174d" }, blurb: "How your limit got here.", href: "/ladder" },
  { id: "help", name: "Help", icon: "LifeBuoy", tile: { from: "#0ea5e9", to: "#0369a1" }, blurb: "The questions people ring the office about, answered.", route: "help" },
  { id: "inbox", name: "Messages", icon: "MessageSquare", tile: { from: "#10b981", to: "#065f46" }, blurb: "Replies from the team.", route: "inbox", dock: true, dockOnly: true },
  { id: "settings", name: "Settings", icon: "Settings", tile: { from: "#64748b", to: "#334155" }, blurb: "Voice, language and Autopilot.", route: "settings", dock: true, dockOnly: true },
];

export const GRID_APPS = DEVICE_APPS.filter((a) => !a.dockOnly);
export const DOCK_APPS = DEVICE_APPS.filter((a) => a.dock);
export const appByRoute = (r: RouteName) => DEVICE_APPS.find((a) => a.route === r);
