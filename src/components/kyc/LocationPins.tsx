// ─────────────────────────────────────────────────────────────────────────────
// WHERE YOU WORK, AND WHERE YOU LIVE — a pin from the phone, with permission.
//
// Asked only when the lender's onboarding asks for it, and only for the places
// the lender named. The pin is taken from the handset's own location at the
// moment the customer presses the button — which is why the button says "I am
// at my business now" rather than offering a map to drop a pin anywhere. A pin
// dropped from a sofa on the far side of town is the pin a field officer drives
// to and finds nobody.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { Crosshair, Loader2, MapPin } from "lucide-react";
import type { GeoPin } from "../../lib/api/portal";

type Place = "business" | "home";

const PLACE: Record<Place, { title: string; action: string }> = {
  business: { title: "Your business", action: "I am at my business now" },
  home: { title: "Your home", action: "I am at home now" },
};

export function LocationPins({
  places,
  value,
  onChange,
}: {
  places: Place[];
  value: Partial<Record<Place, GeoPin | null>>;
  onChange: (place: Place, pin: GeoPin | null) => void;
}) {
  const [busy, setBusy] = useState<Place | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pin = (place: Place) => {
    if (!navigator.geolocation) {
      setError("This browser cannot share your location. Open the app in Chrome or Safari on your phone.");
      return;
    }
    setBusy(place);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setBusy(null);
        onChange(place, {
          lat: Number(p.coords.latitude.toFixed(6)),
          lng: Number(p.coords.longitude.toFixed(6)),
          accuracy: Math.round(p.coords.accuracy),
        });
      },
      (e) => {
        setBusy(null);
        setError(
          e.code === e.PERMISSION_DENIED
            ? "Location permission was refused. Allow location for this site in your browser settings, then try again."
            : "We could not get a location fix. Step outside or near a window and try again.",
        );
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  };

  return (
    <div className="space-y-2.5">
      {places.map((place) => {
        const got = value[place];
        return (
          <div key={place} className="rounded-xl border p-3.5" style={{ borderColor: "var(--line-strong)" }}>
            <div className="flex items-center gap-3">
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                style={{
                  background: got ? "color-mix(in oklab, var(--green) 16%, transparent)" : "var(--surface-sunk)",
                  color: got ? "var(--green-ink)" : "var(--ink-faint)",
                }}
              >
                <MapPin className="h-[18px] w-[18px]" strokeWidth={2.2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold">{PLACE[place].title}</span>
                <span className="tnum mt-0.5 block text-[11.5px] text-ink-faint">
                  {got ? `Pinned · ${got.lat}, ${got.lng}${got.accuracy ? ` · within ${got.accuracy} m` : ""}` : "Not pinned yet"}
                </span>
              </span>
            </div>
            <button
              type="button"
              disabled={busy != null}
              onClick={() => pin(place)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[12.5px] font-semibold transition-opacity disabled:opacity-60"
              style={got ? { border: "1px solid var(--line-strong)" } : { background: "var(--brand)", color: "var(--brand-on)" }}
            >
              {busy === place ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
              {got ? "Pin it again" : PLACE[place].action}
            </button>
          </div>
        );
      })}
      {error && (
        <p role="alert" className="text-[12.5px] font-medium" style={{ color: "#e11d48" }}>
          {error}
        </p>
      )}
    </div>
  );
}

export default LocationPins;
