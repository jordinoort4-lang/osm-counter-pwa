export default function OsmFooter() {
  return (
    <footer className="app-footer">
      <div className="footer-inner">
        {/* Brand */}
        <div className="footer-brand">
          <span className="footer-logo-text">OSM</span>
          <span className="footer-logo-sub">Master Strategist</span>
        </div>

        {/* Tagline */}
        <p className="footer-tagline">
          AI-Powered Tactical Analysis Engine — Outsmart Every Opponent.
        </p>

        {/* Links */}
        <nav className="footer-links">
          <a href="#pricing">Pricing</a>
          <span className="footer-divider">·</span>
          <a href="mailto:support@osmstrategist.com">Support</a>
          <span className="footer-divider">·</span>
          <a href="#privacy">Privacy Policy</a>
          <span className="footer-divider">·</span>
          <a href="#terms">Terms of Service</a>
        </nav>

        {/* Social / badges */}
        <div className="footer-badges">
          <span className="footer-badge">⚡ Real-Time AI</span>
          <span className="footer-badge">🔒 Secure &amp; Private</span>
          <span className="footer-badge">🏆 Trusted by 10 000+ Managers</span>
        </div>

        {/* Copyright */}
        <p className="footer-copy">
          © {new Date().getFullYear()} OSM Master Strategist. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
