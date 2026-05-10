import { useState } from "react";
import { useAuth } from "../lib/auth";
import { Handshake, LogOut, RefreshCw, Shield, Trophy, Users } from "lucide-react";

type Page = "collection" | "matches" | "trades" | "partners" | "admin";

interface LayoutProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  matchCount: number;
  children: React.ReactNode;
}

export default function Layout({ currentPage, onNavigate, matchCount, children }: LayoutProps) {
  const { user, profile, signOut } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const displayName = profile?.username || user?.email?.split("@")[0] || "Utilizador";
  const displayEmail = profile?.email || user?.email || "-";
  const accountCreatedAt = profile?.created_at || user?.created_at;
  const createdLabel = accountCreatedAt
    ? new Date(accountCreatedAt).toLocaleDateString("pt-PT")
    : "-";

  const navItems: { page: Page; label: string; icon: React.ReactNode; badge?: number }[] = [
    { page: "collection", label: "Colecao", icon: <Trophy size={18} /> },
    { page: "matches", label: "Matches", icon: <RefreshCw size={18} />, badge: matchCount },
    { page: "trades", label: "Trocas", icon: <Users size={18} /> },
    { page: "partners", label: "Parceiros", icon: <Handshake size={18} /> },
    ...(profile?.is_admin ? [{ page: "admin" as Page, label: "Admin", icon: <Shield size={18} /> }] : []),
  ];

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="header-inner">
          <div className="header-brand" onClick={() => onNavigate("collection")}>
            <img className="brand-logo" src="/logo.png" alt="Papa Cromos" />
            <h1>Papa Cromos</h1>
          </div>
          <nav className="header-nav">
            {navItems.map((item) => (
              <button
                key={item.page}
                className={`nav-btn ${currentPage === item.page ? "active" : ""}`}
                onClick={() => onNavigate(item.page)}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
              </button>
            ))}
          </nav>
          <div className="header-actions">
            <div className="profile-menu">
              <button
                className="user-id"
                type="button"
                title={displayName}
                onClick={() => setProfileOpen((open) => !open)}
              >
                {displayName}
              </button>
              {profileOpen && (
                <div className="profile-popover">
                  <div className="profile-popover-header">
                    <strong>{displayName}</strong>
                    <span>{profile?.is_admin ? "Administrador" : "Utilizador"}</span>
                  </div>
                  <dl className="profile-details">
                    <div>
                      <dt>Email</dt>
                      <dd>{displayEmail}</dd>
                    </div>
                    <div>
                      <dt>Telefone</dt>
                      <dd>{profile?.phone || "-"}</dd>
                    </div>
                    <div>
                      <dt>Cidade</dt>
                      <dd>{profile?.city || "-"}</dd>
                    </div>
                    <div>
                      <dt>Perfil</dt>
                      <dd>{profile?.is_admin ? "Admin" : "Colecionador"}</dd>
                    </div>
                    <div>
                      <dt>Registo</dt>
                      <dd>{createdLabel}</dd>
                    </div>
                    <div>
                      <dt>ID da conta</dt>
                      <dd className="profile-account-id">{user?.id || "-"}</dd>
                    </div>
                  </dl>
                </div>
              )}
            </div>
            <button className="header-icon-btn header-logout-btn" onClick={signOut} title="Sair">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>
      <main className="app-main">{children}</main>
      <nav className="bottom-nav" aria-label="Menu principal">
        {navItems.map((item) => (
          <button
            key={item.page}
            className={`bottom-nav-btn ${currentPage === item.page ? "active" : ""}`}
            onClick={() => onNavigate(item.page)}
            type="button"
            title={item.label}
            aria-label={item.label}
          >
            {item.icon}
            {item.badge ? <span className="bottom-nav-badge">{item.badge}</span> : null}
          </button>
        ))}
      </nav>
    </div>
  );
}
