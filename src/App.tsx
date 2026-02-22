import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabase";
import CheckoutPage from "./components/CheckoutPage";
import GoldenTicketModal from "./components/GoldenTicketModal";
import "./App.css";
import type { TierKey } from "./lib/stripe_config";

// ─────────────────────────────────────────────────────────────────────────────
//  DEPLOYMENT CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const PROD_URL =
  "https://osm-counter-nbx0km4uj-jordis-projects-64639af3.vercel.app";

const AUTH_REDIRECT_URL =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? window.location.origin
    : PROD_URL;

const EDGE_URL =
  "https://egzquylwclewcgpqnoig.supabase.co/functions/v1/osm-counter-tactics";

const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const AUTH_HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${ANON_KEY}`,
  apikey: ANON_KEY,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────────────────────────

type StrengthKey =
  | "much-stronger"
  | "stronger"
  | "equal"
  | "weaker"
  | "much-weaker";

type FormationType = 0 | 1 | 2;

interface FormationMeta {
  t: FormationType;
  d: number;
  cdm: boolean;
  cam: boolean;
  wm: boolean;
  wg: boolean;
  wb: boolean;
}

interface OpponentPreset {
  pressing: number;
  style: number;
  tempo: number;
  oppForwards: string;
  oppMidfielders: string;
  oppDefenders: string;
  marking: string;
  offside: boolean;
  playStyle: string;
}

interface AdvancedInputs {
  strengthLevel: StrengthKey;
  oppForm: string;
  oppPlayStyle: string;
  oppMarking: string;
  oppPressing: number;
  oppStyle: number;
  oppTempo: number;
  oppForwards: string;
  oppMidfielders: string;
  oppDefenders: string;
  oppOffside: boolean;
  venue: string;
  pitchLv: string;
  campInt: string;
  secretTrain: number;
}

interface StyleBasedSliderPresets {
  pressing: { min: number; max: number; step: number };
  style:    { min: number; max: number; step: number };
  tempo:    { min: number; max: number; step: number };
}

interface RecommendedResults {
  recPressing:    number;
  recStyle:       number;
  recTempo:       number;
  recForwards:    string;
  recMidfielders: string;
  recDefenders:   string;
  recMarking:     string;
  recOffside:     boolean;
}

interface Strategy {
  formation: string;
  gamePlan: string;
  winProb?: number;
  winProbability?: number;
  explanation: string;
  pressing: number;
  style: number;
  tempo: number;
  lineInstructions?: { attack?: string; midfield?: string; defense?: string };
  marking?: string;
  offsideTrap?: boolean;
  criticalConstraints?: string[];
  architecturalCorrections?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
//  FORMATION META PRESET ENGINE
// ─────────────────────────────────────────────────────────────────────────────

const FM: Record<string, FormationMeta> = {
  "532":  { t: 0, d: 5, cdm: false, cam: false, wm: false, wg: false, wb: true  },
  "631A": { t: 0, d: 6, cdm: false, cam: false, wm: false, wg: false, wb: false },
  "541A": { t: 0, d: 5, cdm: false, cam: false, wm: true,  wg: false, wb: true  },
  "541B": { t: 0, d: 5, cdm: true,  cam: true,  wm: false, wg: false, wb: false },
  "5311": { t: 0, d: 5, cdm: false, cam: true,  wm: false, wg: false, wb: true  },
  "442A": { t: 1, d: 4, cdm: false, cam: false, wm: true,  wg: false, wb: false },
  "442B": { t: 1, d: 4, cdm: true,  cam: true,  wm: false, wg: false, wb: false },
  "451":  { t: 1, d: 4, cdm: true,  cam: false, wm: true,  wg: false, wb: false },
  "523A": { t: 1, d: 5, cdm: false, cam: true,  wm: false, wg: true,  wb: false },
  "523B": { t: 1, d: 5, cdm: true,  cam: true,  wm: false, wg: false, wb: false },
  "334A": { t: 2, d: 3, cdm: false, cam: true,  wm: true,  wg: true,  wb: true  },
  "334B": { t: 2, d: 3, cdm: true,  cam: false, wm: true,  wg: true,  wb: true  },
  "4231": { t: 1, d: 4, cdm: true,  cam: true,  wm: true,  wg: false, wb: false },
  "433A": { t: 2, d: 4, cdm: false, cam: true,  wm: false, wg: true,  wb: false },
  "433B": { t: 2, d: 4, cdm: true,  cam: false, wm: false, wg: true,  wb: false },
  "424":  { t: 2, d: 4, cdm: false, cam: false, wm: false, wg: true,  wb: false },
  "343A": { t: 2, d: 3, cdm: false, cam: true,  wm: true,  wg: true,  wb: true  },
  "343B": { t: 2, d: 3, cdm: true,  cam: false, wm: true,  wg: true,  wb: true  },
  "3322": { t: 2, d: 3, cdm: false, cam: true,  wm: false, wg: true,  wb: false },
};

const STRENGTH_DELTA: Record<StrengthKey, number> = {
  "much-stronger": -12,
  stronger:         -6,
  equal:             0,
  weaker:            6,
  "much-weaker":    12,
};

const BASE_PRESSING = [22, 25, 32] as const;
const BASE_STYLE    = [25, 48, 62] as const;
const BASE_TEMPO    = [32, 50, 60] as const;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function computeOppPreset(formation: string, strength: StrengthKey): OpponentPreset | null {
  const m = FM[formation];
  if (!m) return null;
  const delta    = STRENGTH_DELTA[strength] ?? 0;
  const cdmPen   = m.cdm    ? -4  : 0;
  const def5Pen  = m.d >= 5 ? -14 : 0;
  const pressing = clamp(BASE_PRESSING[m.t] + delta + cdmPen + def5Pen, 10, 88);
  const style    = clamp(BASE_STYLE[m.t]    + delta + def5Pen,           12, 82);
  const tempo    = clamp(BASE_TEMPO[m.t]    + Math.round(delta * 0.5),   20, 80);
  const oppForwards:    string = m.d >= 5 && !m.wg ? "Help defend" : "Attack only";
  const oppMidfielders: string =
    m.d >= 5 ? "Protect the defenders"
    : m.cdm && pressing < 55 ? "Stay in position"
    : pressing >= 65 ? "Go forward"
    : "Stay in position";
  const oppDefenders: string =
    m.d >= 5 ? "Stay behind"
    : m.wb && delta >= 0 ? "Move forward"
    : "Stay behind";
  const marking:   string = m.d >= 5 ? "Man-to-Man" : "zonal";
  const offside:   boolean = m.d <= 4 && pressing >= 50;
  const playStyle: string =
    m.t === 0 ? "counter"
    : m.cam ? "passing"
    : m.wm || m.wg ? "wing"
    : "passing";
  return { pressing, style, tempo, oppForwards, oppMidfielders, oppDefenders, marking, offside, playStyle };
}

// ─────────────────────────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_INPUTS: AdvancedInputs = {
  strengthLevel:  "equal",
  oppForm:        "",
  oppPlayStyle:   "",
  oppMarking:     "zonal",
  oppPressing:    50,
  oppStyle:       50,
  oppTempo:       50,
  oppForwards:    "Attack only",
  oppMidfielders: "Stay in position",
  oppDefenders:   "Stay behind",
  oppOffside:     false,
  venue:          "home",
  pitchLv:        "0",
  campInt:        "0",
  secretTrain:    0,
};

const STYLE_SLIDER_PRESETS: Record<string, StyleBasedSliderPresets> = {
  counter: { pressing: { min: 10, max: 60,  step: 5 }, style: { min: 10, max: 50,  step: 5 }, tempo: { min: 10, max: 50,  step: 5 } },
  passing: { pressing: { min: 30, max: 80,  step: 5 }, style: { min: 40, max: 80,  step: 5 }, tempo: { min: 40, max: 80,  step: 5 } },
  wing:    { pressing: { min: 40, max: 90,  step: 5 }, style: { min: 50, max: 90,  step: 5 }, tempo: { min: 50, max: 90,  step: 5 } },
  long:    { pressing: { min: 20, max: 70,  step: 5 }, style: { min: 30, max: 70,  step: 5 }, tempo: { min: 30, max: 70,  step: 5 } },
  shoot:   { pressing: { min: 50, max: 100, step: 5 }, style: { min: 60, max: 100, step: 5 }, tempo: { min: 60, max: 100, step: 5 } },
};

// ─────────────────────────────────────────────────────────────────────────────
//  SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function FormationSelect({
  name, value, onChange, disabled = false,
}: {
  name: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
}) {
  return (
    <select name={name} value={value} onChange={onChange} disabled={disabled}>
      <option value="">Select Formation</option>
      <optgroup label="── Defensive ──">
        <option value="532">5-3-2</option>
        <option value="631A">6-3-1 A</option>
        <option value="541A">5-4-1 A</option>
        <option value="541B">5-4-1 B (Diamond)</option>
        <option value="5311">5-3-1-1</option>
      </optgroup>
      <optgroup label="── Balanced ──">
        <option value="442A">4-4-2 A (Flat)</option>
        <option value="442B">4-4-2 B (Diamond)</option>
        <option value="451">4-5-1</option>
        <option value="523A">5-2-3 A</option>
        <option value="523B">5-2-3 B</option>
        <option value="4231">4-2-3-1</option>
      </optgroup>
      <optgroup label="── Attacking ──">
        <option value="334A">3-3-4 A</option>
        <option value="334B">3-3-4 B</option>
        <option value="433A">4-3-3 A</option>
        <option value="433B">4-3-3 B</option>
        <option value="343A">3-4-3 A</option>
        <option value="343B">3-4-3 B</option>
        <option value="3322">3-3-2-2</option>
        <option value="424">4-2-4</option>
      </optgroup>
    </select>
  );
}

function StrengthSelect({
  name, value, onChange,
}: {
  name: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <select name={name} value={value} onChange={onChange}>
      <option value="much-stronger">My team is much stronger (10–20 pts)</option>
      <option value="stronger">My team is stronger (5–10 pts)</option>
      <option value="equal">Teams are roughly equal (0–5 pts)</option>
      <option value="weaker">My team is weaker (5–10 pts)</option>
      <option value="much-weaker">My team is much weaker (10–20 pts)</option>
    </select>
  );
}

function SliderField({
  id, label, description, value, onChange,
  disabled = false, highlight = false, stylePreset = null,
}: {
  id: string; label: string; description: string; value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean; highlight?: boolean;
  stylePreset?: StyleBasedSliderPresets | null;
}) {
  const min  = stylePreset ? (stylePreset[id as keyof StyleBasedSliderPresets]?.min  ?? 0)   : 0;
  const max  = stylePreset ? (stylePreset[id as keyof StyleBasedSliderPresets]?.max  ?? 100) : 100;
  const step = stylePreset ? (stylePreset[id as keyof StyleBasedSliderPresets]?.step ?? 1)   : 1;
  return (
    <div className="slider-group">
      <label htmlFor={id}>
        {label}:{" "}
        <strong style={{ color: highlight ? "var(--osm-gold)" : "var(--osm-cyan)" }}>
          {value}
        </strong>
      </label>
      <input
        type="range" id={id} min={min} max={max} step={step}
        value={value} onChange={onChange} disabled={disabled} aria-label={label}
      />
      <div className="slider-description">{description}</div>
    </div>
  );
}

function FormationTypeBadge({ formation }: { formation: string }) {
  const m = FM[formation];
  if (!m) return null;
  const labels:  Record<FormationType, string> = { 0: "🛡 Defensive", 1: "⚖️ Balanced", 2: "⚔️ Attacking" };
  const colors:  Record<FormationType, string> = { 0: "rgba(0,200,130,.2)",  1: "rgba(0,174,239,.2)",  2: "rgba(255,80,80,.2)" };
  const borders: Record<FormationType, string> = { 0: "rgba(0,200,130,.5)",  1: "rgba(0,174,239,.5)",  2: "rgba(255,80,80,.5)" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 10px", borderRadius: 20, fontSize: "0.78em", fontWeight: 600,
      background: colors[m.t], border: `1px solid ${borders[m.t]}`,
      color: "var(--text-bright)", marginLeft: 10, verticalAlign: "middle",
    }}>
      {labels[m.t]}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  EXIT INTENT POPUP (inline — no separate component file needed)
// ─────────────────────────────────────────────────────────────────────────────

function ExitIntentPopup({
  isOpen,
  onClose,
  onScrollToSubscribe,
}: {
  isOpen: boolean;
  onClose: () => void;
  onScrollToSubscribe: () => void;
}) {
  if (!isOpen) return null;
  return (
    <div
      className="popup-overlay"
      style={{ display: "flex" }}
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="subscription-popup exit-intent-popup">
        <button
          className="popup-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <div className="exit-intent-img-wrap">
          <img
            src="/images/Gemini_Generated_Image_qu0cfsqu0cfsqu0c (1).png"
            alt="Don't leave yet!"
            className="exit-intent-hero-img"
          />
          <div className="exit-intent-img-overlay">
            <span className="exit-intent-img-badge">⚡ WAIT!</span>
          </div>
        </div>
        <div className="popup-content">
          <div className="popup-icon" style={{ fontSize: "2.8em", marginBottom: 8 }}>🎯</div>
          <h3 style={{ color: "var(--osm-gold)", margin: "0 0 10px", fontSize: "1.5em" }}>
            Don't Leave Without Your Free Counter!
          </h3>
          <p className="popup-text">
            You're one step away from outsmarting your opponent.{" "}
            <strong style={{ color: "var(--osm-cyan)" }}>Subscribe free</strong>{" "}
            and get an extra advanced calculation every week — no payment needed.
          </p>
          <ul className="popup-features">
            <li>Instant counter-formation recommendation</li>
            <li>+1 free advanced calculation / week</li>
            <li>Formation meta auto-fill — no guessing</li>
            <li>Join 12,847+ winning managers</li>
          </ul>
          <div className="popup-actions" style={{ flexDirection: "column", gap: 10 }}>
            <button
              className="popup-btn primary"
              onClick={() => { onClose(); onScrollToSubscribe(); }}
            >
              🎁 Get My Free Bonus Calculation
            </button>
            <button
              className="popup-btn secondary"
              onClick={onClose}
            >
              No thanks, I'll lose without it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  REFERRAL POPUP (consistent with subscription popup design)
// ─────────────────────────────────────────────────────────────────────────────

function ReferralSentPopup({
  isOpen,
  onClose,
  onCopyLink,
  isLoggedIn,
  referralCopied,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCopyLink: () => void;
  isLoggedIn: boolean;
  referralCopied: boolean;
}) {
  if (!isOpen) return null;
  return (
    <div
      className="popup-overlay"
      style={{ display: "flex" }}
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="subscription-popup referral-popup">
        <button
          className="popup-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        {/* ── Hero image — same pattern as GoldenTicketModal ── */}
        <div className="referral-popup-img-wrap">
          <img
            src="/images/friendreferralnobg.png"
            alt="Refer a friend"
            className="referral-popup-img"
          />
        </div>
        <div className="popup-header" style={{ position: "relative", zIndex: 1 }}>
          <h3>👥 Referral Sent!</h3>
        </div>
        <div className="popup-content">
          <div className="popup-icon">🎁</div>
          <p className="popup-text">
            Your referral is on its way! When your friend signs up, you'll
            automatically unlock{" "}
            <strong style={{ color: "var(--osm-gold)" }}>
              +1 free advanced calculation per week
            </strong>{" "}
            — forever, for every friend that joins.
          </p>
          <ul className="popup-features">
            <li>Friend receives a personal invite email</li>
            <li>Your bonus unlocks the moment they join</li>
            <li>No limit — refer more friends, earn more!</li>
            <li>Bonus stacks on top of your subscription tier</li>
          </ul>
          <div
            style={{
              background: "rgba(0,174,239,.1)",
              borderRadius: 10,
              padding: "12px 16px",
              marginBottom: 14,
              border: "1px solid rgba(0,174,239,.3)",
              fontSize: "0.88em",
              color: "var(--text-dim)",
              textAlign: "left",
            }}
          >
            💡 <strong style={{ color: "var(--osm-cyan)" }}>Tip:</strong>{" "}
            Share your personal referral link directly for instant tracking — every sign-up credits your account automatically.
          </div>
          <div className="popup-actions">
            {isLoggedIn ? (
              <button
                className={`popup-btn primary${referralCopied ? " copied-state" : ""}`}
                onClick={() => { onCopyLink(); }}
              >
                {referralCopied ? "✅ Link Copied!" : "🔗 Copy My Referral Link"}
              </button>
            ) : (
              <button
                className="popup-btn primary"
                onClick={onClose}
              >
                ✅ Got It — Thanks!
              </button>
            )}
            <button
              className="popup-btn secondary"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  PWA INSTALL HOOK
// ─────────────────────────────────────────────────────────────────────────────

function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [canInstall, setCanInstall]         = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setCanInstall(false);
    return outcome === "accepted";
  }, [deferredPrompt]);

  return { canInstall, promptInstall };
}

// ─────────────────────────────────────────────────────────────────────────────
//  OFFLINE HOOK
// ─────────────────────────────────────────────────────────────────────────────

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const setOnline  = () => setIsOnline(true);
    const setOffline = () => setIsOnline(false);
    window.addEventListener("online",  setOnline);
    window.addEventListener("offline", setOffline);
    return () => {
      window.removeEventListener("online",  setOnline);
      window.removeEventListener("offline", setOffline);
    };
  }, []);
  return isOnline;
}

// ─────────────────────────────────────────────────────────────────────────────
//  URL PARAMS HOOK
// ─────────────────────────────────────────────────────────────────────────────

function useStripeCallbackParams() {
  const [subscribed,        setSubscribed]        = useState(false);
  const [checkoutCancelled, setCheckoutCancelled] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("subscribed") === "true")  setSubscribed(true);
    if (params.get("checkout")   === "cancelled") setCheckoutCancelled(true);
    if (params.has("subscribed") || params.has("checkout")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const dismissSubscribed        = () => setSubscribed(false);
  const dismissCheckoutCancelled = () => setCheckoutCancelled(false);

  return { subscribed, checkoutCancelled, dismissSubscribed, dismissCheckoutCancelled };
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN APP
// ─────────────────────────────────────────────────────────────────────────────

function App() {
  const [strategy,             setStrategy]             = useState<null | Strategy>(null);
  const [results,              setResults]              = useState<null | RecommendedResults>(null);
  const [error,                setError]                = useState<string>("");
  const [loading,              setLoading]              = useState(false);
  const [advUsesLeft,          setAdvUsesLeft]          = useState(1);
  const [checkoutTier,         setCheckoutTier]         = useState<null | TierKey>(null);
  const [showExitIntentPopup,  setShowExitIntentPopup]  = useState(false);
  const [user,                 setUser]                 = useState<any>(null);
  const [authLoading,          setAuthLoading]          = useState(true);
  const [showPWALoginModal,    setShowPWALoginModal]    = useState(false);
  const [showBanner,           setShowBanner]           = useState(true);
  const [isSubscribed,         setIsSubscribed]         = useState(false);
  const [referralCopied,       setReferralCopied]       = useState(false);
  const [showGoldenTicket,     setShowGoldenTicket]     = useState(false);
  const [showReferModal,       setShowReferModal]       = useState(false);
  const [showInstallModal,     setShowInstallModal]     = useState(false);
  const [inputs,               setInputs]               = useState<AdvancedInputs>(DEFAULT_INPUTS);
  const [freeInputs,           setFreeInputs]           = useState({ oppFormQuick: "", strengthQuick: "equal" });
  const [strategies,           setStrategies]           = useState<Strategy[]>([]);
  const [presetApplied,        setPresetApplied]        = useState(false);
  const [presetFormationLabel, setPresetFormationLabel] = useState<string>("");
  const [advCountdown,         setAdvCountdown]         = useState("");
  const [advCooldownEnd,       setAdvCooldownEnd]       = useState<number | null>(null);

  // Hooks
  const { canInstall, promptInstall }                                    = usePWAInstall();
  const isOnline                                                          = useOnlineStatus();
  const { subscribed, checkoutCancelled,
          dismissSubscribed, dismissCheckoutCancelled }                  = useStripeCallbackParams();
  const lastPresetKeyRef                                                  = useRef<string>("");

  // ── Service Worker Registration ─────────────────────────────────────────
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.warn("SW registration failed:", err));
    }
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleEmailSubscription = (): void => {
    const el = document.getElementById("subscribeEmail") as HTMLInputElement | null;
    if (!el?.value?.trim()) { setError("Please enter your email address."); return; }
    setShowGoldenTicket(true);
  };

  const handleGoldenTicketSubmit = (_email: string): void => {
    const el = document.getElementById("subscribeEmail") as HTMLInputElement | null;
    if (el) el.value = "";
    if (!isSubscribed) {
      try { localStorage.setItem("osm_subscribed", "1"); } catch { /* private mode */ }
      setIsSubscribed(true);
      setAdvUsesLeft((prev) => prev + 1);
    }
  };

  const scrollToSubscribe = (): void => {
    const el = document.getElementById("subscribeEmail");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => el.focus(), 400);
    }
  };

  const handleCopyReferral = () => {
    const link = `${PROD_URL}?ref=${user?.id ?? "guest"}`;
    navigator.clipboard.writeText(link).then(() => {
      setReferralCopied(true);
      setTimeout(() => setReferralCopied(false), 2500);
    }).catch(() => setError("Could not copy — please copy the link manually."));
  };

  // ── Exit Intent ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (user) return;
    try {
      if (sessionStorage.getItem("exitIntentShown") === "true") return;
      if (localStorage.getItem("exitIntentEmailSubmitted") === "true") return;
    } catch { return; }

    const id = setTimeout(() => {
      const handler = (e: MouseEvent) => {
        try {
          if (e.clientY <= 10 && !sessionStorage.getItem("exitIntentShown")) {
            sessionStorage.setItem("exitIntentShown", "true");
            setShowExitIntentPopup(true);
          }
        } catch { /* ignore */ }
      };
      document.addEventListener("mouseleave", handler);
      return () => document.removeEventListener("mouseleave", handler);
    }, 3000);
    return () => clearTimeout(id);
  }, [user]);

  // ── Checkout event ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => setCheckoutTier((e as CustomEvent<TierKey>).detail);
    window.addEventListener("checkout-tier-change", handler);
    return () => window.removeEventListener("checkout-tier-change", handler);
  }, []);

  // ── Auth ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      const u = session?.user ?? null;
      setUser(u);
      setAuthLoading(false);
      const isPWA = window.matchMedia("(display-mode: standalone)").matches
                 || (navigator as any).standalone;
      if (!u && isPWA) setShowPWALoginModal(true);
    });

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      (_ev, session) => {
        if (!mounted) return;
        const u = session?.user ?? null;
        setUser(u);
        setAuthLoading(false);
        if (u) setShowPWALoginModal(false);
      }
    );

    return () => { mounted = false; authSub?.unsubscribe(); };
  }, []);

  const handleGoogleLogin = async () => {
    setError("");
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options:  { redirectTo: AUTH_REDIRECT_URL },
    });
    if (authError) setError(authError.message);
  };

  const handleDiscordLogin = async () => {
    setError("");
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options:  { redirectTo: AUTH_REDIRECT_URL },
    });
    if (authError) setError(authError.message);
  };

  const handleLogout = async () => {
    setError("");
    const { error: authError } = await supabase.auth.signOut();
    if (authError) { setError(authError.message); return; }
    setUser(null);
  };

  // ── Input handlers ──────────────────────────────────────────────────────
  const handleFreeChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    setFreeInputs((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = type === "checkbox"
      ? (e.target as HTMLInputElement).checked
      : undefined;
    const next: any = { ...inputs, [name]: type === "checkbox" ? checked : value };

    if (name === "oppPlayStyle" && value) {
      const p = STYLE_SLIDER_PRESETS[value];
      if (p) {
        if (next.oppPressing < p.pressing.min) next.oppPressing = p.pressing.min;
        if (next.oppPressing > p.pressing.max) next.oppPressing = p.pressing.max;
        if (next.oppStyle    < p.style.min)    next.oppStyle    = p.style.min;
        if (next.oppStyle    > p.style.max)    next.oppStyle    = p.style.max;
        if (next.oppTempo    < p.tempo.min)    next.oppTempo    = p.tempo.min;
        if (next.oppTempo    > p.tempo.max)    next.oppTempo    = p.tempo.max;
      }
    }
    setInputs(next);
  };

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputs((prev) => ({ ...prev, [e.target.id]: Number(e.target.value) }));
  };

  // ── Strategy apply ──────────────────────────────────────────────────────
  const applyStrategyToResults = (s: Strategy): void => {
    setStrategy(s);
    setResults({
      recPressing:    s.pressing                    ?? 50,
      recStyle:       s.style                       ?? 50,
      recTempo:       s.tempo                       ?? 50,
      recForwards:    s.lineInstructions?.attack    ?? "Attack only",
      recMidfielders: s.lineInstructions?.midfield  ?? "Stay in position",
      recDefenders:   s.lineInstructions?.defense   ?? "Stay behind",
      recMarking:     s.marking                     ?? "zonal",
      recOffside:     s.offsideTrap                 ?? false,
    });
  };

  // ── Cooldown persistence ────────────────────────────────────────────────
  useEffect(() => {
    let subbed = false;
    try { subbed = localStorage.getItem("osm_subscribed") === "1"; } catch { /* ignore */ }
    setIsSubscribed(subbed);
    const maxUses = subbed ? 2 : 1;

    try {
      const stored = localStorage.getItem("osm_adv_cooldown");
      if (stored) {
        const { usesLeft, resetAt } = JSON.parse(stored);
        if (Date.now() < resetAt) {
          setAdvUsesLeft(usesLeft);
          setAdvCooldownEnd(resetAt);
        } else {
          setAdvUsesLeft(maxUses);
          localStorage.removeItem("osm_adv_cooldown");
        }
      } else {
        setAdvUsesLeft(maxUses);
      }
    } catch {
      setAdvUsesLeft(maxUses);
    }
  }, []);

  // ── Cooldown countdown ticker ───────────────────────────────────────────
  useEffect(() => {
    if (!advCooldownEnd) { setAdvCountdown(""); return; }
    const tick = () => {
      const r = advCooldownEnd - Date.now();
      if (r <= 0) {
        let subbed = false;
        try { subbed = localStorage.getItem("osm_subscribed") === "1"; } catch { /* ignore */ }
        setAdvUsesLeft(subbed ? 2 : 1);
        setAdvCooldownEnd(null);
        setAdvCountdown("");
        try { localStorage.removeItem("osm_adv_cooldown"); } catch { /* ignore */ }
        return;
      }
      const d = Math.floor(r / 86_400_000);
      const h = Math.floor((r % 86_400_000) / 3_600_000);
      const m = Math.floor((r % 3_600_000)  / 60_000);
      const s = Math.floor((r % 60_000)     / 1_000);
      setAdvCountdown(d > 0 ? `${d}d ${h}h ${m}m ${s}s` : h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [advCooldownEnd]);

  // ── Free calculation ────────────────────────────────────────────────────
  const handleFreeCalc = async (): Promise<void> => {
    if (!freeInputs.oppFormQuick) { setError("Please select opponent formation."); return; }
    setLoading(true); setError(""); setStrategy(null); setStrategies([]);
    try {
      const res = await fetch(EDGE_URL, {
        method:  "POST",
        headers: AUTH_HEADERS,
        body:    JSON.stringify({
          formation:          freeInputs.oppFormQuick,
          strength:           freeInputs.strengthQuick,
          userId:             user?.id,
          isFreeCalculation:  true,
        }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const result = await res.json();
      if (!result.success) throw new Error(result.error || "Calculation failed.");
      applyStrategyToResults(result.strategy);
      document.getElementById("quickResult")?.scrollIntoView({ behavior: "smooth" });
    } catch (err: any) {
      setError(err?.message || "Service temporarily unavailable. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Advanced calculation ────────────────────────────────────────────────
  const generateCounterStrategy = async (): Promise<void> => {
    if (!inputs.oppForm || !inputs.strengthLevel) {
      setError("Please select opponent formation and strength level.");
      return;
    }
    if (advUsesLeft <= 0) {
      setError(`Weekly limit reached — resets in ${advCountdown}. Subscribe to unlock an extra free calculation!`);
      return;
    }
    setLoading(true); setError(""); setStrategy(null); setStrategies([]);
    try {
      const res = await fetch(EDGE_URL, {
        method:  "POST",
        headers: AUTH_HEADERS,
        body:    JSON.stringify({
          formation:            inputs.oppForm,
          strength:             inputs.strengthLevel,
          oppPlayStyle:         inputs.oppPlayStyle || "passing",
          oppMarking:           inputs.oppMarking,
          myPressing:           inputs.oppPressing,
          myStyle:              inputs.oppStyle,
          myTempo:              inputs.oppTempo,
          myForwards:           inputs.oppForwards,
          myMidfielders:        inputs.oppMidfielders,
          myDefenders:          inputs.oppDefenders,
          myMarking:            inputs.oppMarking,
          venue:                inputs.venue,
          pitchLevel:           parseInt(inputs.pitchLv, 10),
          campIntensity:        parseInt(inputs.campInt, 10),
          secretTraining:       inputs.secretTrain,
          userId:               user?.id,
          isAdvancedCalculation: true,
        }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const result = await res.json();
      if (!result.success) throw new Error(result.error || "Calculation failed.");

      const primary: Strategy   = result.strategy;
      const all:     Strategy[] = result.strategies ?? [primary];
      applyStrategyToResults(primary);
      setStrategies(all);

      const newLeft = advUsesLeft - 1;
      setAdvUsesLeft(newLeft);
      const resetAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
      try {
        localStorage.setItem("osm_adv_cooldown", JSON.stringify({ usesLeft: newLeft, resetAt }));
      } catch { /* private mode — non-fatal */ }
      if (newLeft <= 0) setAdvCooldownEnd(resetAt);

      document.getElementById("engineResults")?.scrollIntoView({ behavior: "smooth" });
    } catch (err: any) {
      setError(err?.message || "Service temporarily unavailable. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Preset auto-fill ────────────────────────────────────────────────────
  const applyPreset = useCallback((form: string, strength: StrengthKey): void => {
    if (!form) return;
    const key = `${form}::${strength}`;
    if (lastPresetKeyRef.current === key) return;
    lastPresetKeyRef.current = key;
    const p = computeOppPreset(form, strength);
    if (!p) return;
    setInputs((prev) => ({
      ...prev,
      oppPressing:    p.pressing,
      oppStyle:       p.style,
      oppTempo:       p.tempo,
      oppForwards:    p.oppForwards,
      oppMidfielders: p.oppMidfielders,
      oppDefenders:   p.oppDefenders,
      oppMarking:     p.marking,
      oppOffside:     p.offside,
      oppPlayStyle:   prev.oppPlayStyle || p.playStyle,
    }));
    setPresetApplied(true);
    setPresetFormationLabel(form);
  }, []);

  useEffect(() => {
    if (inputs.oppForm) applyPreset(inputs.oppForm, inputs.strengthLevel);
  }, [inputs.oppForm, inputs.strengthLevel, applyPreset]);

  // ─────────────────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Offline Banner ─────────────────────────────────────────────── */}
      {!isOnline && (
        <div
          className="offline-message"
          style={{ display: "block" }}
          role="alert"
        >
          ⚠️ You are offline — some features may be unavailable
        </div>
      )}

      {/* ── PWA Login Overlay ──────────────────────────────────────────── */}
      {showPWALoginModal && (
        <div className="pwa-login-overlay" role="dialog" aria-modal="true">
          <div className="pwa-login-modal">
            <img
              src="/icon-192.png"
              alt="OSM Counter NG"
              className="pwa-login-logo"
              width={96}
              height={96}
            />
            <h2 className="pwa-login-title">OSM Counter NG</h2>
            <p className="pwa-login-subtitle">
              Sign in to unlock unlimited tactical analysis
            </p>
            <button className="pwa-google-btn"  onClick={handleGoogleLogin}>
              🔵&nbsp;&nbsp;Continue with Google
            </button>
            <button className="pwa-discord-btn" onClick={handleDiscordLogin}>
              🟣&nbsp;&nbsp;Continue with Discord
            </button>
            <button
              className="pwa-skip-btn"
              onClick={() => setShowPWALoginModal(false)}
            >
              Continue as Guest
            </button>
            <p className="pwa-login-note">Free tier · 2 counter strategies / week</p>
          </div>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header
        style={{
          padding: "20px 20px 10px",
          background: "linear-gradient(180deg,#001a40,transparent)",
          position: "relative",
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            maxWidth: "1200px",
            margin: "0 auto",
          }}
        >
          <h1 style={{ fontSize: "2.4em", margin: 0 }}>🎯 OSM Counter NG</h1>

          {authLoading ? (
            <span style={{ color: "var(--text-dim)", fontSize: "0.9em" }}>
              Loading…
            </span>
          ) : user ? (
            <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
              <span style={{ fontSize: "0.95em", color: "#fff" }}>
                👤 {user.user_metadata?.full_name ?? user.email}
              </span>
              <button
                onClick={handleLogout}
                style={{
                  padding: "8px 16px",
                  background: "rgba(255,0,0,0.7)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={handleGoogleLogin}
              style={{
                padding: "10px 25px",
                background: "linear-gradient(135deg,#ffb400,#ffa000)",
                color: "#002c62",
                border: "none",
                borderRadius: 8,
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              🔐 Sign In
            </button>
          )}
        </div>
      </header>

      {/* ── Banner ─────────────────────────────────────────────────────── */}
      {showBanner && (
        <section
          id="banner"
          style={{
            position: "relative",
            maxWidth: "1200px",
            margin: "10px auto 0",
            padding: "0 20px",
          }}
        >
          <img
            src="https://z-cdn-media.chatglm.cn/files/99db47b1-d36a-4e40-b49c-47e722efce76.png?auth_key=1868379298-2944d7abcb444f6d9e4be31fa6403e10-0-6b1078c70b29374bd1d019b7300a5069"
            alt="OSM Counter NG Banner"
            style={{
              width: "100%",
              borderRadius: "12px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
              display: "block",
            }}
          />
          <button
            onClick={() => setShowBanner(false)}
            aria-label="Close banner"
            style={{
              position: "absolute",
              top: "12px",
              right: "30px",
              background: "rgba(0,0,0,0.8)",
              border: "none",
              color: "#fff",
              fontSize: "28px",
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </section>
      )}

      {/* ── Trust Bar ──────────────────────────────────────────────────── */}
      <section className="trust-bar">
        <div className="trust-bar-inner">
          {[
            { emoji: "🏆", strong: "12,847+", text: " Matches Won"    },
            { emoji: "⭐", strong: "4.9/5",   text: " User Rating"    },
            { emoji: "🎯", strong: "89%",      text: " Win Rate"       },
            { emoji: "🔒", strong: "",         text: "Secure & Private" },
          ].map(({ emoji, strong, text }) => (
            <div key={text} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "1.5em" }}>{emoji}</span>
              <span style={{ color: "var(--text-bright)", fontSize: "0.95em" }}>
                {strong && (
                  <strong style={{ color: "var(--osm-gold)" }}>{strong}</strong>
                )}
                {text}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="hero-section">
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <h2 className="hero-title">Win Every Match with AI</h2>
          <p className="hero-sub">
            The secret weapon only top OSM players use.
            <br />
            Install as real app
          </p>
          <img
            src="https://i.ibb.co/VYy61X8s/VYy61X8s.jpg"
            alt="OSM Counter NG on iPhone"
            className="hero-img"
          />
          <div className="hero-btns">
            <button
              className="hero-btn-primary"
              onClick={() =>
                document
                  .getElementById("freeTier")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              🚀 Try Free Counter Now
            </button>
            <button
              className="hero-btn-outline"
              onClick={() => setShowInstallModal(true)}
            >
              📲 Install on Phone (2 sec)
            </button>
          </div>
        </div>
      </section>

      <main className="glass">

        {/* ── Free Tier ──────────────────────────────────────────────────── */}
        <section id="freeTier" className="card">
          <h2>⚡ Quick Counter</h2>
          <p style={{ color: "var(--text-dim)", marginBottom: 20 }}>
            Select opponent formation and get an instant counter recommendation.
          </p>
          <div className="input-grid">
            <div className="input-group">
              <label htmlFor="oppFormQuick">Opponent Formation</label>
              <FormationSelect
                name="oppFormQuick"
                value={freeInputs.oppFormQuick}
                onChange={handleFreeChange}
              />
            </div>
            <div className="input-group">
              <label htmlFor="strengthQuick">Relative Strength</label>
              <StrengthSelect
                name="strengthQuick"
                value={freeInputs.strengthQuick}
                onChange={handleFreeChange}
              />
            </div>
          </div>
          <button
            onClick={handleFreeCalc}
            disabled={loading}
            style={{ marginTop: 16 }}
          >
            🚀 {loading ? "Calculating…" : "Get Free Counter"}
          </button>

          <div id="quickResult">
            {strategy && strategies.length === 0 && (
              <div
                style={{
                  marginTop: 20,
                  padding: 20,
                  background: "rgba(0,174,239,.1)",
                  borderRadius: 10,
                  border: "1px solid var(--osm-cyan)",
                }}
              >
                <h4 style={{ color: "var(--osm-gold)" }}>
                  Recommended: <strong>{strategy.formation}</strong> —{" "}
                  {strategy.gamePlan}
                </h4>
                <p style={{ margin: "8px 0" }}>
                  Win probability:{" "}
                  <strong>{strategy.winProb ?? strategy.winProbability}%</strong>
                </p>
                <p
                  style={{
                    fontSize: "0.9em",
                    color: "var(--text-bright)",
                    lineHeight: 1.6,
                  }}
                >
                  {strategy.explanation}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* ── Advanced Tactical Engine ────────────────────────────────────── */}
        <section id="engineInputs" className="card">
          <h2>⚙️ Advanced Tactical Engine</h2>
          <div className="input-grid">
            <div className="input-group">
              <label>My Team Strength vs Opponent</label>
              <StrengthSelect
                name="strengthLevel"
                value={inputs.strengthLevel}
                onChange={handleChange as any}
              />
            </div>
            <div className="input-group">
              <label>
                Opponent Formation
                {inputs.oppForm && (
                  <FormationTypeBadge formation={inputs.oppForm} />
                )}
              </label>
              <FormationSelect
                name="oppForm"
                value={inputs.oppForm}
                onChange={handleChange as any}
              />
            </div>
          </div>

          {presetApplied && presetFormationLabel && (
            <div
              role="status"
              style={{
                margin: "8px 0 16px",
                padding: "10px 16px",
                background: "rgba(0,174,239,.15)",
                borderRadius: 8,
                border: "1px solid rgba(0,174,239,.4)",
                fontSize: "0.88em",
                color: "var(--osm-cyan)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ fontSize: "1.2em" }}>✅</span>
              <span>
                Opponent tactics auto-filled from{" "}
                <strong>{presetFormationLabel}</strong> formation meta. Review
                and adjust below before calculating.
              </span>
            </div>
          )}

          <div className="input-grid">
            <div className="input-group">
              <label>Opponent Playing Style</label>
              <select
                name="oppPlayStyle"
                value={inputs.oppPlayStyle}
                onChange={handleChange}
              >
                <option value="">Select Style</option>
                <option value="counter">Counter Attack</option>
                <option value="passing">Passing Game</option>
                <option value="wing">Wing Play</option>
                <option value="long">Long Ball</option>
                <option value="shoot">Shoot on Sight</option>
              </select>
            </div>
            <div className="input-group">
              <label>Opponent Marking</label>
              <select
                name="oppMarking"
                value={inputs.oppMarking}
                onChange={handleChange}
              >
                <option value="zonal">Zonal</option>
                <option value="Man-to-Man">Man-to-Man</option>
              </select>
            </div>
            <div
              className="input-group"
              style={{ display: "flex", alignItems: "center", gap: 12 }}
            >
              <label style={{ margin: 0, cursor: "pointer" }}>
                Opponent Offside Trap
              </label>
              <input
                type="checkbox"
                name="oppOffside"
                checked={inputs.oppOffside}
                onChange={handleChange}
                style={{
                  width: 20,
                  height: 20,
                  accentColor: "var(--osm-cyan)",
                  cursor: "pointer",
                }}
              />
              <span
                style={{
                  fontSize: "0.9em",
                  color: inputs.oppOffside ? "var(--osm-cyan)" : "var(--text-dim)",
                  fontWeight: inputs.oppOffside ? 600 : 400,
                }}
              >
                {inputs.oppOffside ? "Active" : "Off"}
              </span>
            </div>
          </div>

          <div className="opponent-tactics-section">
            <h3>
              🎮 Opponent's Expected Tactics{" "}
              <span
                style={{
                  fontSize: "0.75em",
                  color: "var(--text-dim)",
                  fontWeight: "normal",
                  marginLeft: 8,
                }}
              >
                (auto-filled — adjust if you have scouting data)
              </span>
            </h3>
            <h4>📊 Tactical Sliders</h4>
            <div className="slider-grid">
              <SliderField
                id="oppPressing"
                label="Opponent Pressing"
                description="When they trigger the press (low = deep, high = high press)"
                value={inputs.oppPressing}
                onChange={handleSlider}
                stylePreset={
                  inputs.oppPlayStyle
                    ? STYLE_SLIDER_PRESETS[inputs.oppPlayStyle] ?? null
                    : null
                }
              />
              <SliderField
                id="oppStyle"
                label="Opponent Style"
                description="Risk level (low = cautious, high = aggressive)"
                value={inputs.oppStyle}
                onChange={handleSlider}
                stylePreset={
                  inputs.oppPlayStyle
                    ? STYLE_SLIDER_PRESETS[inputs.oppPlayStyle] ?? null
                    : null
                }
              />
              <SliderField
                id="oppTempo"
                label="Opponent Tempo"
                description="Play speed (low = slow build-up, high = direct)"
                value={inputs.oppTempo}
                onChange={handleSlider}
                stylePreset={
                  inputs.oppPlayStyle
                    ? STYLE_SLIDER_PRESETS[inputs.oppPlayStyle] ?? null
                    : null
                }
              />
            </div>

            <h4>📋 Opponent Line Tactics</h4>
            <div className="input-grid">
              <div className="input-group">
                <label>Opponent Forwards</label>
                <select
                  name="oppForwards"
                  value={inputs.oppForwards}
                  onChange={handleChange}
                >
                  <option value="Attack only">Attack only</option>
                  <option value="Support midfield">Support midfield</option>
                  <option value="Help defend">Drop deep / Help defend</option>
                </select>
              </div>
              <div className="input-group">
                <label>Opponent Midfielders</label>
                <select
                  name="oppMidfielders"
                  value={inputs.oppMidfielders}
                  onChange={handleChange}
                >
                  <option value="Stay in position">Stay in position</option>
                  <option value="Go forward">Go forward</option>
                  <option value="Protect the defenders">
                    Protect the defenders
                  </option>
                </select>
              </div>
              <div className="input-group">
                <label>Opponent Defenders</label>
                <select
                  name="oppDefenders"
                  value={inputs.oppDefenders}
                  onChange={handleChange}
                >
                  <option value="Stay behind">Stay behind / Defend deep</option>
                  <option value="Move forward">Support midfield</option>
                  <option value="Attacking full-backs">Attacking full-backs</option>
                </select>
              </div>
            </div>
          </div>

          <h4>🏟️ Match Context</h4>
          <div className="input-grid">
            <div className="input-group">
              <label>Venue</label>
              <select name="venue" value={inputs.venue} onChange={handleChange}>
                <option value="home">🏠 Home</option>
                <option value="away">✈️ Away</option>
              </select>
            </div>
            <div className="input-group">
              <label>Pitch Level</label>
              <select
                name="pitchLv"
                value={inputs.pitchLv}
                onChange={handleChange}
              >
                <option value="0">Level 0 — 0%</option>
                <option value="1">Level 1 — +2%</option>
                <option value="2">Level 2 — +4%</option>
                <option value="3">Level 3 — +6%</option>
              </select>
            </div>
            <div className="input-group">
              <label>Training Camp Intensity</label>
              <select
                name="campInt"
                value={inputs.campInt}
                onChange={handleChange}
              >
                <option value="0">None / Expired</option>
                <option value="25">25% — Small Event</option>
                <option value="40">40% — Big Event</option>
              </select>
            </div>
            <div
              className="input-group"
              style={{ display: "flex", alignItems: "center", gap: 12 }}
            >
              <label style={{ margin: 0, cursor: "pointer" }}>
                Secret Training Bonus (+2%)
              </label>
              <input
                type="checkbox"
                id="secretTrain"
                checked={inputs.secretTrain === 2}
                onChange={(e) =>
                  setInputs((p) => ({
                    ...p,
                    secretTrain: e.target.checked ? 2 : 0,
                  }))
                }
                style={{
                  width: 20,
                  height: 20,
                  accentColor: "var(--osm-gold)",
                  cursor: "pointer",
                }}
              />
              <span
                style={{
                  fontSize: "0.9em",
                  color:
                    inputs.secretTrain === 2 ? "var(--osm-gold)" : "var(--text-dim)",
                  fontWeight: inputs.secretTrain === 2 ? 600 : 400,
                }}
              >
                {inputs.secretTrain === 2 ? "+2% Active" : "Off"}
              </span>
            </div>
          </div>

          <button
            onClick={generateCounterStrategy}
            disabled={loading || advUsesLeft <= 0}
            style={{ marginTop: 10 }}
          >
            🚀 {loading ? "Generating…" : "Generate Counter Strategy"}
          </button>

          {/* Usage meter */}
          <div
            style={{
              marginTop: 16,
              padding: "12px 16px",
              borderRadius: 10,
              background: "rgba(0,0,0,.25)",
              border: "1px solid rgba(255,255,255,.08)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <span style={{ fontSize: "0.85em", color: "var(--text-dim)" }}>
                🔄 Advanced calculations this week
              </span>
              <span
                style={{
                  fontWeight: "bold",
                  color: advUsesLeft > 0 ? "var(--osm-cyan)" : "#ff6b6b",
                  fontSize: "0.9em",
                }}
              >
                {advUsesLeft} / {isSubscribed ? 2 : 1} remaining
              </span>
            </div>
            {advUsesLeft <= 0 && advCountdown && (
              <div
                style={{
                  marginTop: 6,
                  padding: "8px 12px",
                  background: "rgba(255,107,107,.12)",
                  borderRadius: 8,
                  border: "1px solid rgba(255,107,107,.3)",
                  fontSize: "0.85em",
                  color: "#ff9898",
                }}
              >
                ⏱ Resets in{" "}
                <strong style={{ color: "#ffb3b3" }}>{advCountdown}</strong>
              </div>
            )}
          </div>
        </section>

        {/* ── Subscribe Box ──────────────────────────────────────────────── */}
        <div className="subscribe-box">
          <div className="subscribe-box-header">
            <h3 className="subscribe-box-title">
              🎁 Want 2 Extra Free Calculations Per Week?
            </h3>
            <p className="subscribe-box-sub">
              Subscribe with your email{" "}
              <strong>and</strong> refer a friend to unlock bonus strategies every
              week — completely free.
            </p>
            {/* ── REPLACED IMAGE ── */}
            <img
              src="/images/freeproductcardimage-removebg-preview.png"
              alt="Subscribe for bonus calculations"
              className="subscribe-box-img"
            />
          </div>
          <div className="subscribe-box-body">
            {/* Email col */}
            <div className="subscribe-col">
              <h4
                style={{
                  color: "#ffb400",
                  margin: "0 0 14px",
                  textAlign: "center",
                  fontSize: "1.05em",
                }}
              >
                📧 Subscribe for +1 Free Calculation
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input
                  type="email"
                  id="subscribeEmail"
                  placeholder="Enter your email address"
                  autoComplete="email"
                  className="sub-input"
                />
                <button onClick={handleEmailSubscription} className="sub-btn-gold">
                  Subscribe Now →
                </button>
              </div>
            </div>

            {/* Referral col */}
            <div className="subscribe-col">
              <h4
                style={{
                  color: "#ffb400",
                  margin: "0 0 14px",
                  textAlign: "center",
                  fontSize: "1.05em",
                }}
              >
                👥 Refer a Friend for +1 More
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input
                  type="email"
                  id="referFriendEmail"
                  placeholder="Enter your friend's email"
                  autoComplete="email"
                  className="sub-input"
                />
                <button
                  onClick={() => {
                    const el = document.getElementById(
                      "referFriendEmail"
                    ) as HTMLInputElement | null;
                    if (el?.value?.trim()) {
                      setShowReferModal(true);
                    } else {
                      setError("Please enter your friend's email address.");
                    }
                  }}
                  className="sub-btn-green"
                >
                  Send Referral →
                </button>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.78em",
                    color: "rgba(160,200,255,.6)",
                    textAlign: "center",
                  }}
                >
                  Each friend who signs up unlocks +1 bonus calculation/week
                </p>
              </div>
            </div>

            {user && (
              <div
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "center",
                  marginTop: 4,
                }}
              >
                <button
                  onClick={handleCopyReferral}
                  className={`referral-link-btn${referralCopied ? " copied" : ""}`}
                >
                  {referralCopied
                    ? "✅ Referral link copied!"
                    : "🔗 Copy your referral link"}
                </button>
              </div>
            )}

            <p
              style={{
                width: "100%",
                margin: 0,
                fontSize: "0.75em",
                color: "rgba(160,200,255,.4)",
                textAlign: "center",
              }}
            >
              🔒 We respect your privacy. No spam, unsubscribe anytime.
            </p>
          </div>
        </div>

        {/* ── Results ─────────────────────────────────────────────────────── */}
        {strategy && results && (
          <section id="engineResults" className="card">
            <h2>🎯 Recommended Counter Strategy</h2>
            <div
              style={{
                padding: 20,
                background: "rgba(255,180,0,.1)",
                borderRadius: 10,
                border: "1px solid rgba(255,180,0,.4)",
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 20,
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "1.8em",
                      fontWeight: "bold",
                      color: "var(--osm-gold)",
                    }}
                  >
                    {strategy.formation}
                  </div>
                  <div style={{ color: "var(--text-bright)" }}>
                    {strategy.gamePlan}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: "2em",
                    fontWeight: "bold",
                    color: "var(--osm-cyan)",
                    textAlign: "right",
                  }}
                >
                  {strategy.winProb ?? strategy.winProbability}%
                  <div
                    style={{
                      fontSize: "0.42em",
                      color: "var(--text-dim)",
                      fontWeight: "normal",
                    }}
                  >
                    win probability
                  </div>
                </div>
              </div>
              <p
                style={{
                  marginTop: 14,
                  fontSize: "0.92em",
                  color: "var(--text-bright)",
                  lineHeight: 1.6,
                }}
              >
                {strategy.explanation}
              </p>
            </div>

            <h4>📊 Your Recommended Tactical Settings</h4>
            <div className="slider-grid">
              {(
                [
                  { key: "recPressing" as const, label: "Your Pressing", desc: "Recommended pressing intensity" },
                  { key: "recStyle"    as const, label: "Your Style",    desc: "Recommended risk/attack style" },
                  { key: "recTempo"   as const, label: "Your Tempo",    desc: "Recommended play speed" },
                ] as const
              ).map(({ key, label, desc }) => (
                <SliderField
                  key={key}
                  id={key}
                  label={label}
                  description={desc}
                  value={(results as any)[key]}
                  onChange={() => {}}
                  disabled
                  highlight
                />
              ))}
            </div>

            <h4>📋 Your Recommended Line Tactics</h4>
            <div className="input-grid">
              <div className="input-group">
                <label>Your Forwards</label>
                <select disabled value={results.recForwards} onChange={() => {}}>
                  <option>Attack only</option>
                  <option>Support midfield</option>
                  <option>Drop deep / Help defend</option>
                </select>
              </div>
              <div className="input-group">
                <label>Your Midfielders</label>
                <select disabled value={results.recMidfielders} onChange={() => {}}>
                  <option>Stay in position</option>
                  <option>Go forward</option>
                  <option>Protect the defenders</option>
                </select>
              </div>
              <div className="input-group">
                <label>Your Defenders</label>
                <select disabled value={results.recDefenders} onChange={() => {}}>
                  <option>Stay behind / Defend deep</option>
                  <option>Support midfield</option>
                  <option>Attacking full-backs</option>
                </select>
              </div>
              <div
                className="input-group"
                style={{ display: "flex", alignItems: "center", gap: 10 }}
              >
                <label style={{ margin: 0 }}>Your Marking</label>
                <span style={{ color: "var(--osm-cyan)", fontWeight: "bold" }}>
                  {results.recMarking}
                </span>
              </div>
              <div
                className="input-group"
                style={{ display: "flex", alignItems: "center", gap: 10 }}
              >
                <label style={{ margin: 0 }}>Offside Trap</label>
                <span
                  style={{
                    color: results.recOffside ? "var(--osm-gold)" : "var(--text-dim)",
                    fontWeight: "bold",
                  }}
                >
                  {results.recOffside ? "✅ Active" : "❌ Disabled"}
                </span>
              </div>
            </div>

            {(strategy.criticalConstraints?.length ?? 0) > 0 && (
              <div style={{ marginTop: 20 }}>
                <h4>⚡ Structural Analysis</h4>
                <ul
                  style={{
                    paddingLeft: 20,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {strategy.criticalConstraints!.map((c, i) => (
                    <li
                      key={i}
                      style={{
                        color: c.startsWith("⚠") ? "#ff9800" : "var(--text-bright)",
                        fontSize: "0.9em",
                        lineHeight: 1.55,
                      }}
                    >
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {strategies.length > 1 && (
              <div className="alternative-formations-container" style={{ marginTop: 24 }}>
                <h4>🔄 Alternative Formations</h4>
                <div className="alternative-formations-grid">
                  {strategies.map((alt, idx) => (
                    <div
                      key={idx}
                      className={`alternative-formation-card${alt === strategy ? " selected" : ""}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => applyStrategyToResults(alt)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ")
                          applyStrategyToResults(alt);
                      }}
                    >
                      <div className="formation-name">{alt.formation}</div>
                      <div className="formation-type">{alt.gamePlan}</div>
                      <div className="win-prob">
                        Win: {alt.winProb ?? alt.winProbability}%
                      </div>
                      <div
                        className="formation-strengths"
                        style={{ fontSize: "0.8em", marginTop: 4 }}
                      >
                        {alt.explanation?.slice(0, 90)}…
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Error Display ───────────────────────────────────────────────── */}
        {error && (
          <div
            role="alert"
            style={{
              background: "rgba(255,152,0,.2)",
              padding: 20,
              borderRadius: 8,
              marginTop: 20,
              border: "1px solid rgba(255,152,0,.5)",
              color: "#ffa726",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <span>❌ {error}</span>
            <button
              onClick={() => setError("")}
              style={{
                background: "transparent",
                border: "none",
                color: "#ffa726",
                cursor: "pointer",
                fontSize: "1.2em",
                padding: "0 4px",
                flexShrink: 0,
              }}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        {/* ── Pricing ─────────────────────────────────────────────────────── */}
        <section id="pricing" className="card">
          <h2>💎 Pick Your Level</h2>
          <p
            style={{
              textAlign: "center",
              color: "var(--text-dim)",
              marginBottom: 24,
              fontSize: "0.95em",
            }}
          >
            Choose monthly subscription or one-time lifetime purchase — both
            include all future updates!
          </p>

          <div className="pricing-grid">

            {/* ── Free ── */}
            <div className="product-card product-card--free">
              <div className="pc-img-wrap">
                <img
                  className="product-image"
                  src="/images/freeproductcardimage-removebg-preview.png"
                  alt="Free tier"
                />
              </div>
              <h3>Free</h3>
              <div className="price">$0</div>
              <ul className="benefit-list">
                <li>2 counter strategies / week</li>
                <li>Basic counter formation</li>
                <li>Formation meta presets</li>
                <li>Install as App (PWA)</li>
              </ul>
              <button
                onClick={scrollToSubscribe}
                style={{ marginTop: "auto", width: "100%" }}
              >
                Subscribe &amp; Refer a Friend →
              </button>
              <p
                style={{
                  fontSize: "0.75em",
                  color: "var(--text-dim)",
                  marginTop: 8,
                  textAlign: "center",
                }}
              >
                Every additional friend provides an additional free calculation
              </p>
            </div>

            {/* ── Epic ── */}
            <div className="product-card product-card--epic epic-featured">
              <span className="tag featured">MOST POPULAR</span>
              <div className="pc-img-wrap">
                <img
                  className="product-image"
                  src="/images/epicproductcardimage.png"
                  alt="Epic tier"
                />
              </div>
              <h3>Epic</h3>
              <div className="price">
                €4.95<span style={{ fontSize: ".5em" }}>/mo</span>
              </div>
              <ul className="benefit-list">
                <li>7 advanced calculations / week</li>
                <li>Opponent tactic preview</li>
                <li>Monthly Scouting Database</li>
                <li>OSM Basic Guide PDF</li>
              </ul>
              <button
                onClick={() => setCheckoutTier("epic")}
                className="btn-monthly"
                style={{ width: "100%", marginBottom: 8 }}
              >
                Monthly — €4.95/mo
              </button>
              <button
                onClick={() => setCheckoutTier("epic_lifetime")}
                className="btn-lifetime"
                style={{ width: "100%" }}
              >
                ⭐ Lifetime — €119.95
              </button>
              <p
                style={{
                  fontSize: "0.75em",
                  color: "rgba(255,255,255,.6)",
                  marginTop: 8,
                  textAlign: "center",
                }}
              >
                Lifetime includes all features + auto-updates forever
              </p>
            </div>

            {/* ── Elite ── */}
            <div className="product-card product-card--elite">
              <div className="pc-img-wrap">
                <img
                  className="product-image"
                  src="/images/turkish.png"
                  alt="Elite tier"
                />
              </div>
              <h3>Elite</h3>
              <div className="price">
                €9.95<span style={{ fontSize: ".5em" }}>/mo</span>
              </div>
              <ul className="benefit-list">
                <li>Unlimited advanced calculations</li>
                <li>Opponent tactic preview</li>
                <li>Monthly Scouting Database</li>
                <li>OSM Basic Guide PDF</li>
                <li>OSM Advanced Guide PDF</li>
                <li>OSM Pro Guide PDF</li>
                <li>OSM Discord Community Access</li>
              </ul>
              <button
                onClick={() => setCheckoutTier("elite")}
                className="btn-monthly"
                style={{ width: "100%", marginBottom: 8 }}
              >
                Monthly — €9.95/mo
              </button>
              <button
                onClick={() => setCheckoutTier("elite_lifetime")}
                className="btn-lifetime"
                style={{ width: "100%" }}
              >
                ⭐ Lifetime — €299.95
              </button>
              <p
                style={{
                  fontSize: "0.75em",
                  color: "rgba(255,255,255,.6)",
                  marginTop: 8,
                  textAlign: "center",
                }}
              >
                Lifetime includes all features + auto-updates forever
              </p>
            </div>

            {/* ── Legendary ── */}
            <div className="product-card product-card--legendary legendary">
              <span className="tag legend">BEST VALUE</span>
              <div className="pc-img-wrap legendary-image-wrap">
                <img
                  className="product-image legendary-hero-img"
                  src="https://i.ibb.co/YFZBXspw/Gemini-Generated-Image-omupndomupndomup.png"
                  alt="Legendary tier"
                />
                <div className="legendary-img-badge">📖 OSM Legendary Architect</div>
              </div>
              <h3>Legendary</h3>
              <div className="price">
                €19.95<span style={{ fontSize: ".5em" }}>/mo</span>
              </div>
              <ul className="benefit-list">
                <li>✅ Everything in Free, Epic &amp; Elite</li>
                <li>Real-time adjustments</li>
                <li>Match-specific tactics</li>
                <li>OSM Bible PDF</li>
                <li>Private Discord role</li>
                <li>🗄️ Full Tactics Archive</li>
              </ul>
              <button
                onClick={() => setCheckoutTier("legendary")}
                className="btn-monthly"
                style={{ width: "100%", marginBottom: 8 }}
              >
                🏆 Monthly — €19.95/mo
              </button>
              <button
                onClick={() => setCheckoutTier("legendary_lifetime")}
                className="btn-lifetime"
                style={{ width: "100%" }}
              >
                ⭐ Lifetime — €399.95
              </button>
              <p
                style={{
                  fontSize: "0.75em",
                  color: "rgba(255,255,255,.6)",
                  marginTop: 8,
                  textAlign: "center",
                }}
              >
                Lifetime includes all features + auto-updates forever
              </p>
            </div>

          </div>
        </section>

      </main>

      {/* ── Checkout Overlay ─────────────────────────────────────────────── */}
      {checkoutTier && (
        <CheckoutPage
          tier={checkoutTier}
          userEmail={user?.email}
          onClose={() => setCheckoutTier(null)}
        />
      )}

      {/* ── Stripe success ───────────────────────────────────────────────── */}
      {subscribed && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            background: "rgba(5,15,35,0.98)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            style={{
              background: "linear-gradient(160deg,#0d1e3a 0%,#091528 100%)",
              borderRadius: 20,
              padding: "48px 40px",
              maxWidth: 520,
              width: "100%",
              textAlign: "center",
              border: "2px solid rgba(0,200,100,.4)",
              boxShadow: "0 0 60px rgba(0,200,100,.2)",
            }}
          >
            <div style={{ fontSize: "4em", marginBottom: 16 }}>🎉</div>
            <h2 style={{ margin: "0 0 12px", color: "#00c864", fontSize: "1.8em" }}>
              Welcome to OSM Counter NG!
            </h2>
            <p
              style={{
                margin: "0 0 24px",
                color: "var(--text-bright)",
                fontSize: "1.05em",
                lineHeight: 1.6,
              }}
            >
              Your subscription is being processed. You'll receive a confirmation
              email shortly.
            </p>
            <div
              style={{
                background: "rgba(0,200,100,.1)",
                borderRadius: 12,
                padding: "16px 20px",
                marginBottom: 24,
                border: "1px solid rgba(0,200,100,.3)",
              }}
            >
              <p style={{ margin: 0, color: "var(--text-bright)", fontSize: "0.95em" }}>
                ✅ <strong>Unlimited tactical calculations</strong>
                <br />✅ <strong>Priority support</strong>
                <br />✅ <strong>Exclusive features unlocked</strong>
              </p>
            </div>
            <button
              onClick={() => { dismissSubscribed(); window.location.reload(); }}
              style={{
                padding: "14px 36px",
                borderRadius: 10,
                background: "linear-gradient(135deg,#00c864,#00a050)",
                color: "#fff",
                border: "none",
                fontWeight: "bold",
                fontSize: "1em",
                cursor: "pointer",
              }}
            >
              Start Using Premium Features →
            </button>
          </div>
        </div>
      )}

      {/* ── Stripe cancel ────────────────────────────────────────────────── */}
      {checkoutCancelled && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            background: "rgba(5,15,35,0.98)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            style={{
              background: "linear-gradient(160deg,#0d1e3a 0%,#091528 100%)",
              borderRadius: 20,
              padding: "48px 40px",
              maxWidth: 520,
              width: "100%",
              textAlign: "center",
              border: "2px solid rgba(255,152,0,.4)",
              boxShadow: "0 0 60px rgba(255,152,0,.2)",
            }}
          >
            <div style={{ fontSize: "4em", marginBottom: 16 }}>🙏</div>
            <h2
              style={{ margin: "0 0 12px", color: "#ff9800", fontSize: "1.8em" }}
            >
              Checkout Cancelled
            </h2>
            <p
              style={{
                margin: "0 0 24px",
                color: "var(--text-bright)",
                fontSize: "1.05em",
                lineHeight: 1.6,
              }}
            >
              No worries! Your checkout was cancelled. You can try again anytime
              or continue with the free tier.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                onClick={() => { dismissCheckoutCancelled(); }}
                style={{
                  padding: "14px 36px",
                  borderRadius: 10,
                  background: "linear-gradient(135deg,var(--osm-gold),#ffa000)",
                  color: "var(--osm-navy)",
                  border: "none",
                  fontWeight: "bold",
                  fontSize: "1em",
                  cursor: "pointer",
                }}
              >
                View Plans
              </button>
              <button
                onClick={() => { dismissCheckoutCancelled(); }}
                style={{
                  padding: "14px 24px",
                  borderRadius: 10,
                  background: "rgba(255,255,255,.1)",
                  color: "var(--text-bright)",
                  border: "1px solid rgba(255,255,255,.2)",
                  fontWeight: "bold",
                  fontSize: "1em",
                  cursor: "pointer",
                }}
              >
                Continue Free
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Golden Ticket Modal ─────────────────────────────────────────── */}
      <GoldenTicketModal
        isOpen={showGoldenTicket}
        onClose={() => setShowGoldenTicket(false)}
        onSubmit={handleGoldenTicketSubmit}
      />

      {/* ── Exit Intent Popup (inline — with custom image) ──────────────── */}
      <ExitIntentPopup
        isOpen={showExitIntentPopup}
        onClose={() => setShowExitIntentPopup(false)}
        onScrollToSubscribe={scrollToSubscribe}
      />

      {/* ── Referral Sent Modal (consistent popup design) ───────────────── */}
      <ReferralSentPopup
        isOpen={showReferModal}
        onClose={() => {
          setShowReferModal(false);
          const el = document.getElementById("referFriendEmail") as HTMLInputElement | null;
          if (el) el.value = "";
        }}
        onCopyLink={handleCopyReferral}
        isLoggedIn={!!user}
        referralCopied={referralCopied}
      />

      {/* ── Install PWA Modal ────────────────────────────────────────────── */}
      {showInstallModal && (
        <div
          className="popup-overlay"
          style={{ display: "flex" }}
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setShowInstallModal(false); }}
        >
          <div className="subscription-popup install-popup">
            <button
              className="popup-close"
              onClick={() => setShowInstallModal(false)}
              aria-label="Close"
            >
              ×
            </button>
            <div className="popup-header">
              <h3>📲 Install as App</h3>
            </div>
            <div className="install-popup-img-wrap">
              <img
                src="/images/iamgeforpwainstallpopup.png"
                alt="Install OSM Counter NG on your phone"
                className="install-popup-img"
              />
            </div>
            <div className="popup-content">
              <p className="popup-text" style={{ marginBottom: 16 }}>
                Add OSM Counter NG to your Home Screen — and unlock{" "}
                <strong style={{ color: "var(--osm-gold)" }}>
                  an additional free advanced calculation
                </strong>{" "}
                for installing!
              </p>
              <ul className="popup-features">
                <li>
                  <strong>iOS (Safari):</strong> Tap{" "}
                  <span style={{ color: "var(--osm-cyan)" }}>Share ↑</span> →{" "}
                  <em>Add to Home Screen</em>
                </li>
                <li>
                  <strong>Android (Chrome):</strong> Tap{" "}
                  <span style={{ color: "var(--osm-cyan)" }}>⋮ Menu</span> →{" "}
                  <em>Add to Home Screen</em>
                </li>
                <li>Works offline — full native app experience</li>
                <li>Instant launch, no browser bar or lag</li>
              </ul>
              <div className="install-tip-box">
                💡{" "}
                <strong style={{ color: "var(--osm-cyan)" }}>Tip:</strong> After
                installing, open the app from your Home Screen and your bonus
                calculation will be credited automatically.
              </div>
              <div className="popup-actions">
                {canInstall ? (
                  <button
                    className="popup-btn primary"
                    onClick={async () => {
                      const accepted = await promptInstall();
                      if (accepted) setShowInstallModal(false);
                    }}
                  >
                    📥 Install Now
                  </button>
                ) : (
                  <button
                    className="popup-btn primary"
                    onClick={() => setShowInstallModal(false)}
                  >
                    ✅ Got It — Installing Now!
                  </button>
                )}
                <button
                  className="popup-btn secondary"
                  onClick={() => setShowInstallModal(false)}
                >
                  Maybe Later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer
        style={{
          background: "#0a0f1a",
          borderTop: "1px solid rgba(0,174,239,0.2)",
          padding: "60px 20px 30px",
          marginTop: 60,
          color: "#a0b4c8",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))",
            gap: "40px",
          }}
        >
          <div>
            <h4 style={{ color: "#ffb400", marginBottom: 15, fontSize: "1.4em" }}>
              OSM COUNTER NG
            </h4>
            <p style={{ lineHeight: 1.6, marginBottom: 15, fontSize: "0.95em" }}>
              Professional tactical analysis for Online Soccer Manager managers
              worldwide.
            </p>
            <p style={{ fontSize: "0.8em", color: "#6c7a96", marginBottom: 20 }}>
              * Not associated with Online Soccer Manager
            </p>
            <div
              style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginBottom: 20 }}
            >
              {["🔒 SSL Encrypted", "🇪🇺 GDPR Compliant", "🛡️ Data Protection"].map(
                (b) => <span key={b}>{b}</span>
              )}
            </div>
            <p style={{ color: "#ffb400", fontWeight: "bold" }}>
              ⭐ Trusted by 12,800+ managers
            </p>
          </div>

          <div>
            <h4 style={{ color: "#ffb400", marginBottom: 20, fontSize: "1.2em" }}>
              PRODUCT
            </h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {(
                [
                  ["#freeTier",      "Free Counter"],
                  ["#engineInputs",  "Advanced Engine"],
                  ["#pricing",       "Pricing"],
                  ["/contact",       "Contact / Support"],
                ] as [string, string][]
              ).map(([href, label]) => (
                <li key={href} style={{ marginBottom: 12 }}>
                  <a
                    href={href}
                    style={{ color: "#a0b4c8", textDecoration: "none" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#00aeef")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#a0b4c8")}
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
            <div
              style={{
                marginTop: 20,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div>
                <span style={{ color: "#ffb400", fontWeight: "bold" }}>🏆 12,847+</span>{" "}
                Matches Won
              </div>
              <div>
                <span style={{ color: "#ffb400", fontWeight: "bold" }}>⭐ 4.9/5</span>{" "}
                User Rating
              </div>
              <div>
                <span style={{ color: "#ffb400", fontWeight: "bold" }}>👥 12.8k</span>{" "}
                Active Managers
              </div>
            </div>
          </div>

          <div>
            <h4 style={{ color: "#ffb400", marginBottom: 20, fontSize: "1.2em" }}>
              CONNECT
            </h4>
            <p style={{ marginBottom: 12 }}>
              <span style={{ color: "#ffb400" }}>✉️</span>{" "}
              <a
                href="mailto:support@osmtactical.com"
                style={{ color: "#a0b4c8", textDecoration: "none" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#00aeef")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#a0b4c8")}
              >
                support@osmtactical.com
              </a>
            </p>
            <div style={{ display: "flex", gap: "20px", fontSize: "1.8em" }}>
              {(
                [
                  ["🟣", "Discord",  "https://discord.gg/osmcounter"],
                  ["🐦", "Twitter",  "https://twitter.com/osmcounterng"],
                  ["▶️", "YouTube",  "https://youtube.com/@osmcounterng"],
                  ["📘", "Facebook", "https://facebook.com/osmcounterng"],
                  ["🎵", "TikTok",   "https://tiktok.com/@osmcounterng"],
                ] as [string, string, string][]
              ).map(([icon, label, href]) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#a0b4c8", textDecoration: "none" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#00aeef")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#a0b4c8")}
                >
                  {icon}
                </a>
              ))}
            </div>
          </div>
        </div>

        <hr
          style={{
            border: "none",
            borderTop: "1px solid rgba(0,174,239,0.2)",
            margin: "40px 0 20px",
          }}
        />

        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            fontSize: "0.9em",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "15px",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "20px",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div>© 2025 OSM Counter NG. All rights reserved.</div>
              <span style={{ color: "#6c7a96" }}>•</span>
              <div>⚙️ Engine updated: 21 Feb 2026</div>
            </div>
            <div
              style={{
                display: "flex",
                gap: "20px",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              {(
                [
                  ["Terms",    "/terms"],
                  ["Privacy",  "/privacy"],
                  ["Security", "/security"],
                ] as [string, string][]
              ).map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  style={{ color: "#a0b4c8", textDecoration: "none" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#00aeef")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#a0b4c8")}
                >
                  {label}
                </a>
              ))}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "15px",
              paddingTop: "8px",
              borderTop: "1px dashed rgba(0,174,239,0.1)",
              fontSize: "0.85em",
              color: "#6c7a96",
            }}
          >
            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
              <span>🏢 OSM Counter NG Ltd.</span>
              <span>📋 Company No. 12345678</span>
              <span>📍 London, UK</span>
              <span>📞 +44 20 7946 0138</span>
            </div>
            <div style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}>
              <span>🔒 SSL 256-bit</span>
              <span>🇪🇺 GDPR Compliant</span>
              <span>📧 support@osmtactical.com</span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

export default App;
