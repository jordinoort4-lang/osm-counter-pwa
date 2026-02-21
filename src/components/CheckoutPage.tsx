import { useState, useCallback, useMemo } from "react";
import {
  STRIPE_PAYMENT_LINKS,
  TIER_CONFIGS,
  type TierKey,
  type TierConfig,
} from "../lib/stripe_config";

// ─────────────────────────────────────────────────────────────────────────────
//  SAFETY PROTOCOLS & VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

/** Email validation regex - RFC 5322 compliant simplified */
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/** Maximum email length to prevent DOS */
const MAX_EMAIL_LENGTH = 254;

/** Minimum email length */
const MIN_EMAIL_LENGTH = 5;

/** Stripe payment link URL pattern - supports alphanumeric, underscores, and hyphens */
const STRIPE_PAYMENT_LINK_REGEX = /^https:\/\/buy\.stripe\.com\/[a-zA-Z0-9_-]+$/;

/** Rate limiting: track checkout attempts */
const CHECKOUT_ATTEMPTS_KEY = "osm_checkout_attempts";
const MAX_CHECKOUT_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

/**
 * Validates email address with comprehensive checks
 */
function validateEmail(email: string): { valid: boolean; error?: string } {
  // Trim whitespace
  const trimmed = email.trim();
  
  // Check length
  if (trimmed.length < MIN_EMAIL_LENGTH) {
    return { valid: false, error: "Email address is too short." };
  }
  if (trimmed.length > MAX_EMAIL_LENGTH) {
    return { valid: false, error: "Email address is too long." };
  }
  
  // Check format
  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, error: "Please enter a valid email address." };
  }
  
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /\.\./,           // Double dots
    /@.*@/,           // Multiple @ symbols
    /^\.|\.$/,        // Starting or ending with dot (after split)
    /<script/i,       // Script injection attempt
    /javascript:/i,   // JavaScript protocol
    /data:/i,         // Data URI
  ];
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(trimmed)) {
      return { valid: false, error: "Invalid email format." };
    }
  }
  
  return { valid: true };
}

/**
 * Validates Stripe payment link URL
 */
function validatePaymentLink(url: string): { valid: boolean; error?: string } {
  // Check if it's a valid URL
  try {
    const parsed = new URL(url);
    
    // Must be HTTPS
    if (parsed.protocol !== "https:") {
      return { valid: false, error: "Payment link must use HTTPS." };
    }
    
    // Must be Stripe domain
    if (parsed.hostname !== "buy.stripe.com") {
      return { valid: false, error: "Invalid payment provider domain." };
    }
    
    // Check against expected pattern
    if (!STRIPE_PAYMENT_LINK_REGEX.test(url)) {
      return { valid: false, error: "Invalid Stripe payment link format." };
    }
    
    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid payment link URL." };
  }
}

/**
 * Rate limiting for checkout attempts
 */
function checkRateLimit(): { allowed: boolean; remainingAttempts: number; resetIn?: number } {
  try {
    const stored = localStorage.getItem(CHECKOUT_ATTEMPTS_KEY);
    if (!stored) {
      return { allowed: true, remainingAttempts: MAX_CHECKOUT_ATTEMPTS };
    }
    
    const { attempts, firstAttemptAt } = JSON.parse(stored);
    const now = Date.now();
    
    // Reset if window has passed
    if (now - firstAttemptAt > RATE_LIMIT_WINDOW_MS) {
      localStorage.removeItem(CHECKOUT_ATTEMPTS_KEY);
      return { allowed: true, remainingAttempts: MAX_CHECKOUT_ATTEMPTS };
    }
    
    const remainingAttempts = MAX_CHECKOUT_ATTEMPTS - attempts;
    const resetIn = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - firstAttemptAt)) / 1000);
    
    return {
      allowed: attempts < MAX_CHECKOUT_ATTEMPTS,
      remainingAttempts: Math.max(0, remainingAttempts),
      resetIn,
    };
  } catch {
    // If we can't read localStorage, allow the attempt
    return { allowed: true, remainingAttempts: MAX_CHECKOUT_ATTEMPTS };
  }
}

/**
 * Record a checkout attempt for rate limiting
 */
function recordCheckoutAttempt(): void {
  try {
    const stored = localStorage.getItem(CHECKOUT_ATTEMPTS_KEY);
    const now = Date.now();
    
    if (!stored) {
      localStorage.setItem(CHECKOUT_ATTEMPTS_KEY, JSON.stringify({
        attempts: 1,
        firstAttemptAt: now,
      }));
      return;
    }
    
    const { attempts, firstAttemptAt } = JSON.parse(stored);
    
    // Reset if window has passed
    if (now - firstAttemptAt > RATE_LIMIT_WINDOW_MS) {
      localStorage.setItem(CHECKOUT_ATTEMPTS_KEY, JSON.stringify({
        attempts: 1,
        firstAttemptAt: now,
      }));
      return;
    }
    
    localStorage.setItem(CHECKOUT_ATTEMPTS_KEY, JSON.stringify({
      attempts: attempts + 1,
      firstAttemptAt,
    }));
  } catch {
    // Silently fail if localStorage is not available
  }
}

/**
 * Sanitize email for URL parameter (prevent injection)
 */
function sanitizeEmailForUrl(email: string): string {
  return encodeURIComponent(email.trim().toLowerCase());
}

// ─────────────────────────────────────────────────────────────────────────────
//  CHECKOUT PAGE — full-screen overlay, one tier at a time
//  Ready for Stripe integration: just fill in STRIPE_PAYMENT_LINKS in
//  src/lib/stripe_config.ts and the buttons will redirect to Stripe Checkout.
// ─────────────────────────────────────────────────────────────────────────────

interface CheckoutPageProps {
  tier: TierKey;
  userEmail?: string;
  onClose: () => void;
}

export default function CheckoutPage({
  tier,
  userEmail,
  onClose,
}: CheckoutPageProps) {
  const cfg: TierConfig = TIER_CONFIGS.find((t) => t.key === tier)!;
  
  // Use memoized initial email to prevent re-renders
  const initialEmail = useMemo(() => {
    if (userEmail && validateEmail(userEmail).valid) {
      return userEmail;
    }
    return "";
  }, [userEmail]);
  
  const [email, setEmail] = useState(initialEmail);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [hoveredTier, setHoveredTier] = useState<TierKey | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState<{ remaining: number; resetIn?: number }>({ 
    remaining: MAX_CHECKOUT_ATTEMPTS 
  });

  const paymentLink = STRIPE_PAYMENT_LINKS[tier];
  const isConfigured = !paymentLink.includes("REPLACE_WITH");

  // Check rate limit on mount
  useMemo(() => {
    const rateLimit = checkRateLimit();
    setRateLimitInfo({ remaining: rateLimit.remainingAttempts, resetIn: rateLimit.resetIn });
  }, []);

  // Handle email change with validation
  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Limit input length
    if (value.length > MAX_EMAIL_LENGTH) {
      return;
    }
    
    setEmail(value);
    
    // Clear error when user starts typing
    if (emailError) {
      setEmailError(null);
    }
  }, [emailError]);

  // Handle checkout with all safety protocols
  const handleCheckout = useCallback(() => {
    // Prevent double submission
    if (isSubmitting) {
      return;
    }
    
    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      setEmailError(emailValidation.error || "Invalid email address.");
      return;
    }
    
    // Check terms agreement
    if (!agreedToTerms) {
      alert("Please accept the terms to continue.");
      return;
    }
    
    // Check rate limit
    const rateLimit = checkRateLimit();
    if (!rateLimit.allowed) {
      alert(
        `Too many checkout attempts. Please wait ${rateLimit.resetIn} seconds before trying again.`
      );
      setRateLimitInfo({ remaining: 0, resetIn: rateLimit.resetIn });
      return;
    }
    
    // Check payment link configuration
    if (!isConfigured) {
      alert(
        "⚠️ Stripe not yet configured.\n\n" +
          "Open: src/lib/stripe_config.ts\n" +
          "Replace STRIPE_PAYMENT_LINKS." +
          tier +
          " with your Stripe Payment Link.\n\n" +
          "Get your link at: dashboard.stripe.com → Payment Links"
      );
      return;
    }
    
    // Validate payment link URL
    const linkValidation = validatePaymentLink(paymentLink);
    if (!linkValidation.valid) {
      console.error("Payment link validation failed:", linkValidation.error);
      alert(
        "Unable to process checkout. Please contact support if this issue persists."
      );
      return;
    }
    
    // Set submitting state
    setIsSubmitting(true);
    
    // Record checkout attempt for rate limiting
    recordCheckoutAttempt();
    
    try {
      // Build secure URL with sanitized email
      const url = new URL(paymentLink);
      url.searchParams.set("prefilled_email", sanitizeEmailForUrl(email));
      
      // Add client_reference_id for fraud prevention (unique per session)
      const clientId = `osm_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      url.searchParams.set("client_reference_id", clientId);
      
      // Open in new tab with security attributes
      const newWindow = window.open(url.toString(), "_blank", "noopener,noreferrer");
      
      // Check if popup was blocked
      if (!newWindow) {
        alert(
          "Popup blocked. Please allow popups for this site and try again."
        );
        setIsSubmitting(false);
        return;
      }
      
      // Close the checkout overlay after successful redirect
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (error) {
      console.error("Checkout error:", error);
      alert("An error occurred. Please try again or contact support.");
      setIsSubmitting(false);
    }
  }, [email, agreedToTerms, isSubmitting, isConfigured, paymentLink, tier, onClose]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(5,15,35,0.97)",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "24px 16px 48px",
      }}
    >
      {/* ── Top bar ── */}
      <div
        style={{
          width: "100%",
          maxWidth: 900,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "1.4em" }}>🎯</span>
          <span
            style={{
              fontWeight: 700,
              color: "var(--text-bright)",
              fontSize: "1.1em",
            }}
          >
            OSM Counter NG
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "rgba(255,255,255,.08)",
            border: "1px solid rgba(255,255,255,.15)",
            borderRadius: 8,
            color: "var(--text-bright)",
            padding: "8px 18px",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.9em",
          }}
        >
          ← Back
        </button>
      </div>

      {/* ── Tier switcher ── */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 32,
          background: "rgba(255,255,255,.05)",
          borderRadius: 12,
          padding: 6,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {TIER_CONFIGS.map((t) => (
          <button
            key={t.key}
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("checkout-tier-change", { detail: t.key })
              )
            }
            onMouseEnter={() => setHoveredTier(t.key)}
            onMouseLeave={() => setHoveredTier(null)}
            style={{
              padding: "8px 20px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: "0.88em",
              transition: "all 0.15s",
              background:
                t.key === tier
                  ? cfg.accent
                  : hoveredTier === t.key
                    ? "rgba(255,255,255,.12)"
                    : "transparent",
              color:
                t.key === tier
                  ? t.key === "legendary"
                    ? "#000"
                    : "#fff"
                  : "var(--text-dim)",
            }}
          >
            {t.name}
          </button>
        ))}
      </div>

      {/* ── Main checkout card ── */}
      <div
        style={{
          width: "100%",
          maxWidth: 900,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 0,
          borderRadius: 20,
          overflow: "hidden",
          border: `2px solid ${cfg.accent}44`,
          boxShadow: `0 0 60px ${cfg.accent}22`,
        }}
      >
        {/* LEFT — tier info */}
        <div
          style={{
            background: "linear-gradient(160deg, #0a1628 0%, #071020 100%)",
            borderRight: `1px solid ${cfg.accent}33`,
            padding: "40px 36px",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {/* Tag badge */}
          {cfg.tag && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 12px",
                borderRadius: 20,
                background: `${cfg.tag.color}22`,
                border: `1px solid ${cfg.tag.color}66`,
                color: cfg.tag.color,
                fontWeight: 700,
                fontSize: "0.75em",
                letterSpacing: "0.08em",
                width: "fit-content",
              }}
            >
              ⭐ {cfg.tag.label}
            </div>
          )}

          {/* Tier image with pulse animation */}
          <div
            style={{
              position: "relative",
              width: 100,
              height: 100,
            }}
          >
            {/* Glow effect */}
            <div
              style={{
                position: "absolute",
                inset: -8,
                borderRadius: 24,
                background: `radial-gradient(circle, ${cfg.accent}40 0%, transparent 70%)`,
                animation: "logoPulse 3s ease-in-out infinite",
              }}
            />
            <img
              src={cfg.image}
              alt={`${cfg.name} tier`}
              loading="lazy"
              style={{
                width: 100,
                height: 100,
                objectFit: "contain",
                borderRadius: 16,
                border: `2px solid ${cfg.accent}44`,
                background: "rgba(0,0,0,.3)",
                padding: 8,
                position: "relative",
                zIndex: 1,
                animation: "logoFloat 4s ease-in-out infinite",
              }}
            />
          </div>

          {/* Name & tagline */}
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "2em",
                fontWeight: 800,
                color: cfg.accent,
                lineHeight: 1.1,
              }}
            >
              {cfg.name}
            </h2>
            <p
              style={{
                margin: "6px 0 0",
                color: "var(--text-dim)",
                fontSize: "0.95em",
              }}
            >
              {cfg.tagline}
            </p>
          </div>

          {/* Price */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span
              style={{
                fontSize: "3em",
                fontWeight: 900,
                color: "var(--text-bright)",
                lineHeight: 1,
              }}
            >
              {cfg.price}
            </span>
            <span
              style={{ color: "var(--text-dim)", fontSize: "0.9em" }}
            >
              {cfg.period}
            </span>
          </div>

          {/* Feature list */}
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {cfg.features.map((f, i) => (
              <li
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  fontSize: "0.9em",
                  color: "var(--text-bright)",
                  lineHeight: 1.4,
                }}
              >
                <span
                  style={{
                    color: cfg.accent,
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  ✓
                </span>
                {f}
              </li>
            ))}
          </ul>

          {/* Trust badges */}
          <div
            style={{
              marginTop: "auto",
              paddingTop: 20,
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            {(cfg.period === "one-time" 
              ? ["🔒 Secure payment", "∞ Lifetime access", "🌍 VAT incl.", "🚀 Free updates"]
              : ["🔒 Secure payment", "↩️ Cancel anytime", "🌍 VAT incl."]
            ).map(
              (badge) => (
                <span
                  key={badge}
                  style={{
                    fontSize: "0.75em",
                    color: "var(--text-dim)",
                    background: "rgba(255,255,255,.05)",
                    border: "1px solid rgba(255,255,255,.08)",
                    borderRadius: 6,
                    padding: "3px 8px",
                  }}
                >
                  {badge}
                </span>
              )
            )}
          </div>
        </div>

        {/* RIGHT — checkout form */}
        <div
          style={{
            background: "linear-gradient(160deg,#0d1e3a 0%,#091528 100%)",
            padding: "40px 36px",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <h3
            style={{
              margin: 0,
              color: "var(--text-bright)",
              fontSize: "1.3em",
              fontWeight: 700,
            }}
          >
            {cfg.period === "one-time" ? "Complete your purchase" : "Complete your subscription"}
          </h3>

          {/* Email */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label
              htmlFor="checkout-email"
              style={{
                fontSize: "0.85em",
                color: "var(--text-dim)",
                fontWeight: 600,
              }}
            >
              Email address
            </label>
            <input
              id="checkout-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={handleEmailChange}
              autoComplete="email"
              disabled={isSubmitting}
              style={{
                padding: "12px 16px",
                borderRadius: 10,
                border: emailError 
                  ? "1.5px solid #ff6b6b" 
                  : `1.5px solid ${cfg.accent}55`,
                background: "rgba(0,0,0,.35)",
                color: "var(--text-bright)",
                fontSize: "1em",
                outline: "none",
                transition: "border-color 0.2s",
              }}
            />
            {emailError && (
              <span
                style={{
                  fontSize: "0.8em",
                  color: "#ff6b6b",
                  marginTop: 2,
                }}
              >
                ⚠️ {emailError}
              </span>
            )}
          </div>

          {/* Rate limit warning */}
          {rateLimitInfo.remaining < MAX_CHECKOUT_ATTEMPTS && (
            <div
              style={{
                padding: "8px 12px",
                background: "rgba(255,152,0,.1)",
                borderRadius: 8,
                border: "1px solid rgba(255,152,0,.3)",
                fontSize: "0.8em",
                color: "#ff9800",
              }}
            >
              ⏱️ {rateLimitInfo.remaining} checkout attempts remaining
              {rateLimitInfo.resetIn && ` (resets in ${rateLimitInfo.resetIn}s)`}
            </div>
          )}

          {/* Terms checkbox */}
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              cursor: "pointer",
              fontSize: "0.88em",
              color: "var(--text-dim)",
            }}
          >
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              style={{
                width: 18,
                height: 18,
                marginTop: 2,
                accentColor: cfg.accent,
                cursor: "pointer",
                flexShrink: 0,
              }}
            />
            <span>
              I agree to the{" "}
              <a
                href="/terms"
                target="_blank"
                style={{ color: cfg.accent, textDecoration: "underline" }}
              >
                Terms of Service
              </a>{" "}
              and{" "}
              <a
                href="/privacy"
                target="_blank"
                style={{ color: cfg.accent, textDecoration: "underline" }}
              >
                Privacy Policy
              </a>
            </span>
          </label>

          {/* Stripe badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 14px",
              background: "rgba(255,255,255,.05)",
              borderRadius: 8,
              fontSize: "0.8em",
              color: "var(--text-dim)",
            }}
          >
            <span style={{ fontSize: "1.2em" }}>💳</span>
            <span>
              Secure checkout powered by{" "}
              <strong style={{ color: "#635bff" }}>Stripe</strong>
            </span>
          </div>

          {/* Checkout button */}
          <button
            onClick={handleCheckout}
            disabled={!email || !agreedToTerms || isSubmitting || rateLimitInfo.remaining <= 0}
            style={{
              marginTop: "auto",
              padding: "16px 24px",
              borderRadius: 12,
              background: isConfigured
                ? `linear-gradient(135deg, ${cfg.accent}, ${cfg.accent}cc)`
                : "rgba(255,255,255,.1)",
              color: tier === "legendary" ? "#000" : "#fff",
              border: "none",
              fontWeight: "bold",
              fontSize: "1.1em",
              cursor: email && agreedToTerms && !isSubmitting ? "pointer" : "not-allowed",
              opacity: email && agreedToTerms && !isSubmitting ? 1 : 0.6,
              transition: "all 0.2s",
              position: "relative",
            }}
          >
            {isSubmitting ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <span 
                  style={{
                    width: 16,
                    height: 16,
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "currentColor",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                Processing...
              </span>
            ) : rateLimitInfo.remaining <= 0 ? (
              `Rate limited — wait ${rateLimitInfo.resetIn}s`
            ) : isConfigured ? (
              cfg.period === "one-time" 
                ? `Purchase — ${cfg.price} one-time`
                : `Subscribe — ${cfg.price}/mo`
            ) : (
              "⚠️ Configure Stripe First"
            )}
          </button>
          
          {/* Add CSS animations for spinner, pulse, and float */}
          <style>
            {`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
              @keyframes logoPulse {
                0%, 100% {
                  opacity: 0.4;
                  transform: scale(1);
                }
                50% {
                  opacity: 0.8;
                  transform: scale(1.15);
                }
              }
              @keyframes logoFloat {
                0%, 100% {
                  transform: translateY(0);
                }
                50% {
                  transform: translateY(-4px);
                }
              }
            `}
          </style>

          {/* Money-back guarantee */}
          <p
            style={{
              margin: "8px 0 0",
              fontSize: "0.78em",
              color: "var(--text-dim)",
              textAlign: "center",
            }}
          >
            🛡️ 30-day money-back guarantee. Cancel anytime from your account.
          </p>
        </div>
      </div>

      {/* ── Footer info ── */}
      <p
        style={{
          marginTop: 24,
          fontSize: "0.85em",
          color: "var(--text-dim)",
          textAlign: "center",
          maxWidth: 600,
        }}
      >
        Questions? Contact us at{" "}
        <a
          href="mailto:support@osmcounter.com"
          style={{ color: "var(--osm-cyan)" }}
        >
          support@osmcounter.com
        </a>
      </p>
    </div>
  );
}