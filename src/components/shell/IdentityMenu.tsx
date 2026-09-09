// ─────────────────────────────────────────────────────────────────────────────
// WHO IS HOLDING THE PHONE — and the way out.
//
// The console's floating identity pill (connected-suite IdentityMenu), reduced
// to what a borrower actually has: the number they verified, their account
// screen, and sign out. No org, no role, no system launcher.
//
// ── THE PHONE SHOWN HERE IS MASKED, AND THAT IS NOT COSMETIC ────────────────
// `phoneMasked` is display text ("0758 ••• 032") minted by the server. The real
// msisdn is never re-issued to the client — the cookie is the credential — so
// this string must never be sent back to an endpoint that expects a number.
// See lib/api/portal.ts → Session.
//
// ── TWO SHAPES, ONE COMPONENT ───────────────────────────────────────────────
//   pill     the floating control top-right, on a laptop. Opens a menu.
//   inline   the foot of the mobile drawer, where there is room to render the
//            same actions as plain rows. A dropdown inside a drawer is a menu
//            inside a menu, and on a handset it is a menu you cannot dismiss
//            without closing both.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, User, ChevronDown } from "lucide-react";
import { useSession } from "../../lib/session";

export function IdentityMenu({
  inline = false,
  onNavigate,
}: {
  inline?: boolean;
  onNavigate?: () => void;
}) {
  const navigate = useNavigate();
  const { phoneMasked, firstName, signOut } = useSession();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  // Close on an outside click and on Escape. Both, because a menu that only
  // closes one way is a menu somebody gets stuck in.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = firstName || phoneMasked || "Your account";

  async function onSignOut() {
    setOpen(false);
    onNavigate?.();
    await signOut();
    // The guard in App.tsx sends an anonymous session to /welcome on the next
    // render, so there is no navigate() here — one place decides that.
  }

  const actions = (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          onNavigate?.();
          navigate("/you");
        }}
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-[13px] font-medium text-ink-soft transition-colors hover:bg-surface-sunk hover:text-ink"
      >
        <User className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={2.2} />
        Account settings
      </button>
      <button
        type="button"
        onClick={onSignOut}
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-[13px] font-medium transition-colors hover:bg-surface-sunk"
        style={{ color: "#e11d48" }}
      >
        <LogOut className="h-4 w-4 shrink-0" strokeWidth={2.2} />
        Sign out
      </button>
    </>
  );

  if (inline) {
    return (
      <div>
        <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
          {phoneMasked ? `Signed in · ${phoneMasked}` : "Signed in"}
        </p>
        {actions}
      </div>
    );
  }

  return (
    <div className="relative" ref={wrap}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="card flex items-center gap-2 rounded-2xl px-2 py-[5px] transition-colors hover:bg-surface-sunk"
      >
        <span
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
          style={{ background: "var(--navy)" }}
        >
          {(firstName?.[0] ?? "•").toUpperCase()}
        </span>
        {/* The number is the identity a borrower recognises, so it is on the
            control itself on a wide screen rather than hidden behind it. */}
        <span className="hidden max-w-[140px] truncate text-[12.5px] font-semibold text-ink sm:block">{label}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-faint" strokeWidth={2.4} />
      </button>

      {open && (
        <div
          role="menu"
          className="card absolute right-0 z-50 mt-2 w-56 rounded-xl p-1.5"
          style={{ boxShadow: "var(--shadow-lift)" }}
        >
          <p className="truncate px-2.5 pb-1.5 pt-1 text-[11px] text-ink-faint">
            {phoneMasked ? `Signed in · ${phoneMasked}` : "Signed in"}
          </p>
          {actions}
        </div>
      )}
    </div>
  );
}

export default IdentityMenu;
