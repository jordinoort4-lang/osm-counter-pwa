import { useState } from "react";
import { supabase } from "../supabase";

interface ExitIntentPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ExitIntentPopup({
  isOpen,
  onClose,
}: ExitIntentPopupProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    setError("");

    // Validate email
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    if (!email.includes("@") || !email.includes(".")) {
      setError("Please enter a valid email address.");
      return;
    }

    try {
      // Send magic link via Supabase
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (otpError) {
        setError(otpError.message);
        return;
      }

      // Mark as submitted
      setSubmitted(true);
      localStorage.setItem("exitIntentEmailSubmitted", "true");

      // Also mark in sessionStorage so it doesn't show again
      sessionStorage.setItem("exitIntentShown", "true");
    } catch (err: any) {
      setError(err?.message || "Failed to send magic link. Please try again.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        background: "rgba(0, 0, 0, 0.85)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "linear-gradient(160deg, #0d1e3a 0%, #091528 100%)",
          borderRadius: "20px",
          padding: "40px 32px",
          maxWidth: "420px",
          width: "100%",
          textAlign: "center",
          border: "2px solid #ffb400",
          boxShadow: "0 0 60px rgba(255, 180, 0, 0.3)",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "12px",
            right: "16px",
            background: "rgba(255, 255, 255, 0.1)",
            border: "none",
            color: "#a0b4c8",
            fontSize: "24px",
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          aria-label="Close popup"
        >
          ×
        </button>

        {!submitted ? (
          <>
            <div style={{ fontSize: "2.8em", marginBottom: "16px" }}>⚔️</div>
            <h2
              style={{
                color: "#ffb400",
                fontSize: "1.7em",
                margin: "0 0 12px",
                fontWeight: 800,
              }}
            >
              Annihilate your opponent tonight.
            </h2>
            <p
              style={{
                color: "#ffffff",
                fontSize: "1.05em",
                marginBottom: "24px",
                lineHeight: 1.5,
              }}
            >
              Get one free Advanced Tactical Analysis — see the full counter
              your opponents never prepared for.
            </p>

            <input
              type="email"
              placeholder="Enter your email to unlock instantly"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                width: "100%",
                padding: "14px 18px",
                borderRadius: "10px",
                border: "2px solid rgba(0, 174, 239, 0.5)",
                background: "rgba(0, 0, 0, 0.4)",
                color: "#ffffff",
                fontSize: "1em",
                marginBottom: "16px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />

            {error && (
              <p
                style={{
                  color: "#ff6b6b",
                  fontSize: "0.9em",
                  marginBottom: "12px",
                }}
              >
                {error}
              </p>
            )}

            <button
              onClick={handleSubmit}
              style={{
                width: "100%",
                padding: "16px 24px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #ffb400, #ffa000)",
                color: "#002c62",
                border: "none",
                fontWeight: 800,
                fontSize: "1.1em",
                cursor: "pointer",
                boxShadow: "0 8px 24px rgba(255, 180, 0, 0.4)",
              }}
            >
              🔓 Get My Free Analysis
            </button>

            <p
              style={{
                marginTop: "16px",
                color: "#a0b4c8",
                fontSize: "0.85em",
              }}
            >
              One-time. No credit card. Instant access via magic link.
            </p>
          </>
        ) : (
          <>
            <div style={{ fontSize: "3em", marginBottom: "16px" }}>✅</div>
            <h2
              style={{
                color: "#00c864",
                fontSize: "1.5em",
                margin: "0 0 12px",
                fontWeight: 800,
              }}
            >
              Magic link sent!
            </h2>
            <p
              style={{
                color: "#ffffff",
                fontSize: "1.05em",
                marginBottom: "20px",
                lineHeight: 1.5,
              }}
            >
              Check your inbox — click the link to unlock your free analysis.
            </p>
            <p
              style={{
                color: "#a0b4c8",
                fontSize: "0.9em",
              }}
            >
              The link expires in 24 hours.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
