// ============================================================================
// Calculator Component
// Location: frontend/src/components/osm_calculator.tsx
// 
// This is just an INPUT FORM
// Takes user selection, sends to backend
// NO tactical logic here
// ============================================================================

import { useState } from "react";
import { AVAILABLE_FORMATIONS, STRENGTH_OPTIONS } from "../lib/osm_api_client";

interface OsmCalculatorProps {
  onSubmit: (formation: string, strength: string) => Promise<void>;
  loading: boolean;
  user: any;
  onLogin: () => Promise<void>;
}

export default function OsmCalculator({
  onSubmit,
  loading,
  user,
  onLogin
}: OsmCalculatorProps) {
  const [formation, setFormation] = useState("");
  const [strength, setStrength] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formation || !strength) {
      alert("Please select both options");
      return;
    }

    if (!user) {
      alert("Please log in first");
      await onLogin();
      return;
    }

    // Call the backend (via App.tsx)
    await onSubmit(formation, strength);
  };

  return (
    <div className="calculator-card">
      <h3>⚙️ Tactical Configuration</h3>

      <form onSubmit={handleSubmit}>
        <div className="input-grid">
          {/* Formation dropdown */}
          <div className="input-group">
            <label>Your Formation</label>
            <select
              value={formation}
              onChange={(e) => setFormation(e.target.value)}
              disabled={loading}
            >
              <option value="">Select Formation</option>
              {AVAILABLE_FORMATIONS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          {/* Strength dropdown */}
          <div className="input-group">
            <label>Opponent Strength</label>
            <select
              value={strength}
              onChange={(e) => setStrength(e.target.value)}
              disabled={loading}
            >
              <option value="">Select Strength</option>
              {STRENGTH_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Submit button */}
        <button type="submit" disabled={loading || !formation || !strength}>
          {loading ? "Analyzing..." : "🎯 GENERATE STRATEGY"}
        </button>
      </form>
    </div>
  );
}