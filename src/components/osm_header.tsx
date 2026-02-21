interface OsmHeaderProps {
  user: any;
  onLogin: () => Promise<void>;
  onLogout: () => Promise<void>;
}

export default function OsmHeader({ user, onLogin, onLogout }: OsmHeaderProps) {
  return (
    <header className="app-header">
      <div className="header-container">
        <div className="logo">
          <div className="logo-shield">🎯</div>
          <div className="logo-text">
            <h1>OSM Master Strategist</h1>
            <p>v3.0</p>
          </div>
        </div>

        <div className="auth-section">
          {user ? (
            <div className="user-menu">
              <span>{user.email}</span>
              <button onClick={onLogout}>Sign Out</button>
            </div>
          ) : (
            <button className="login-btn" onClick={onLogin}>
              🔐 Sign In with Google
            </button>
          )}
        </div>
      </div>
    </header>
  );
}