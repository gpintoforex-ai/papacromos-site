import { useState } from "react";
import { useAuth } from "../lib/auth";
import { ChevronDown, Handshake, KeyRound, LifeBuoy, LogOut, QrCode, RefreshCw, Shield, Trash2, Trophy, UserRound, Users, X } from "lucide-react";
import LegalFooter from "./LegalFooter";
import { supabase } from "../lib/supabase";

type Page = "collection" | "matches" | "trades" | "share" | "partners" | "support" | "admin";

interface LayoutProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  matchCount: number;
  pendingTradeCount: number;
  children: React.ReactNode;
}

export default function Layout({ currentPage, onNavigate, matchCount, pendingTradeCount, children }: LayoutProps) {
  const { user, profile, signOut } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileActionsOpen, setProfileActionsOpen] = useState(false);
  const [dataModalOpen, setDataModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const displayName = profile?.username || user?.email?.split("@")[0] || "Utilizador";
  const displayEmail = profile?.email || user?.email || "-";
  const accountCreatedAt = profile?.created_at || user?.created_at;
  const createdLabel = accountCreatedAt
    ? new Date(accountCreatedAt).toLocaleDateString("pt-PT")
    : "-";

  const navItems: { page: Page; label: string; icon: React.ReactNode; badge?: number; alert?: boolean }[] = [
    { page: "collection", label: "Colecao", icon: <Trophy size={18} /> },
    { page: "matches", label: "Matches", icon: <RefreshCw size={18} />, badge: matchCount },
    { page: "trades", label: "Trocas", icon: <Users size={18} />, badge: pendingTradeCount, alert: pendingTradeCount > 0 },
    { page: "share", label: "Partilhar", icon: <QrCode size={18} /> },
    { page: "partners", label: "Parceiros", icon: <Handshake size={18} /> },
    { page: "support", label: "Suporte", icon: <LifeBuoy size={18} /> },
    ...(profile?.is_admin ? [{ page: "admin" as Page, label: "Admin", icon: <Shield size={18} /> }] : []),
  ];

  const deleteOwnAccount = async () => {
    if (!window.confirm("Eliminar a tua conta e todos os dados associados?")) return;
    if (!window.confirm("Confirmas mesmo? Esta acao e permanente e remove colecoes, cromos e trocas associados a tua conta.")) return;

    setDeletingAccount(true);
    setAccountError(null);
    try {
      const { error } = await supabase.rpc("delete_own_account");
      if (error) {
        const missingRpc = String(error.message || "").includes("delete_own_account");
        if (missingRpc) {
          throw new Error("A funcao delete_own_account ainda nao existe no Supabase. Aplica a migration 20260512103000_add_user_self_delete_account.sql.");
        }
        throw error;
      }

      await signOut();
    } catch (err: any) {
      setAccountError(err.message || "Erro ao eliminar a conta.");
      setDeletingAccount(false);
    }
  };

  const closePasswordModal = () => {
    setPasswordModalOpen(false);
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError(null);
    setPasswordSuccess(null);
  };

  const changePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanPassword = newPassword.trim();

    setPasswordError(null);
    setPasswordSuccess(null);

    if (cleanPassword.length < 6) {
      setPasswordError("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (cleanPassword !== confirmPassword.trim()) {
      setPasswordError("As senhas nao coincidem.");
      return;
    }

    setPasswordSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: cleanPassword });
      if (error) throw error;

      setPasswordSuccess("Senha alterada com sucesso.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordError(err.message || "Erro ao alterar senha.");
    } finally {
      setPasswordSaving(false);
    }
  };

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
                {item.badge ? <span className={`nav-badge ${item.alert ? "alert" : ""}`}>{item.badge}</span> : null}
              </button>
            ))}
          </nav>
          <div className="header-actions">
            <div className="profile-menu">
              <button
                className={`user-id user-menu-trigger ${profileOpen ? "open" : ""}`}
                type="button"
                title={displayName}
                onClick={() => setProfileOpen((open) => !open)}
                aria-expanded={profileOpen}
                aria-label="Abrir opcoes de utilizador"
              >
                <span className="user-menu-name">{displayName}</span>
                <ChevronDown className="user-menu-chevron" size={14} />
                <span className="user-menu-avatar">
                  <UserRound size={15} />
                </span>
              </button>
              {profileOpen && (
                <div className="profile-popover">
                  <div className="profile-popover-header">
                    <div>
                      <strong>{displayName}</strong>
                      <span>{profile?.is_admin ? "Administrador" : "Utilizador"}</span>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm profile-logout-btn"
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        signOut();
                      }}
                    >
                      <LogOut size={14} /> Sair
                    </button>
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
                  </dl>
                  {accountError && <p className="profile-error">{accountError}</p>}
                  <div className={`profile-actions ${profileActionsOpen ? "open" : ""}`}>
                    <button
                      className="btn btn-ghost btn-sm profile-actions-toggle"
                      type="button"
                      onClick={() => setProfileActionsOpen((open) => !open)}
                      aria-expanded={profileActionsOpen}
                      aria-controls="profile-actions-panel"
                    >
                      <UserRound size={14} /> Opcoes <ChevronDown size={14} />
                    </button>
                    <div id="profile-actions-panel" className="profile-actions-panel" aria-hidden={!profileActionsOpen}>
                      <button
                        className="btn btn-ghost btn-sm"
                        type="button"
                        onClick={() => {
                          setDataModalOpen(true);
                          setProfileOpen(false);
                        }}
                      >
                        <UserRound size={14} /> Os meus dados
                      </button>
                      <button
                        className="btn btn-password-soft btn-sm"
                        type="button"
                        onClick={() => {
                          setPasswordModalOpen(true);
                          setProfileOpen(false);
                        }}
                      >
                        <KeyRound size={14} /> Alterar senha
                      </button>
                      <button
                        className="btn btn-danger-soft btn-sm"
                        type="button"
                        onClick={deleteOwnAccount}
                        disabled={deletingAccount}
                      >
                        <Trash2 size={14} /> {deletingAccount ? "A eliminar..." : "Eliminar conta"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <main className="app-main">{children}</main>
      <LegalFooter />
      {dataModalOpen && (
        <div className="account-data-overlay" role="dialog" aria-modal="true" aria-labelledby="account-data-title">
          <div className="account-data-modal">
            <div className="account-data-header">
              <div>
                <h2 id="account-data-title">Os meus dados</h2>
                <p>Consulta os dados associados a tua conta.</p>
              </div>
              <button className="header-icon-btn" type="button" onClick={() => setDataModalOpen(false)} title="Fechar">
                <X size={18} />
              </button>
            </div>

            <dl className="account-data-list">
              <div>
                <dt>Nome de utilizador</dt>
                <dd>{displayName}</dd>
              </div>
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
                <dd>{profile?.is_admin ? "Administrador" : "Colecionador"}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>{profile?.is_blocked ? "Bloqueado" : "Ativo"}</dd>
              </div>
              <div>
                <dt>Data de registo</dt>
                <dd>{createdLabel}</dd>
              </div>
              <div>
                <dt>ID da conta</dt>
                <dd className="profile-account-id">{user?.id || "-"}</dd>
              </div>
            </dl>

            <div className="account-data-note">
              <strong>Dados de utilizacao</strong>
              <p>
                A tua caderneta, cromos marcados, repetidos, pedidos de troca, mensagens e registos de parceiros ficam
                associados ao ID da tua conta e sao removidos quando eliminas a conta.
              </p>
            </div>
          </div>
        </div>
      )}
      {passwordModalOpen && (
        <div className="account-data-overlay" role="dialog" aria-modal="true" aria-labelledby="password-title">
          <div className="account-data-modal account-password-modal">
            <div className="account-data-header">
              <div>
                <h2 id="password-title">Alterar senha</h2>
                <p>Define uma nova senha para entrar na tua conta.</p>
              </div>
              <button className="header-icon-btn" type="button" onClick={closePasswordModal} title="Fechar">
                <X size={18} />
              </button>
            </div>

            <form className="account-password-form" onSubmit={changePassword}>
              <label>
                Nova senha
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  minLength={6}
                  autoComplete="new-password"
                  required
                />
              </label>
              <label>
                Confirmar nova senha
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  minLength={6}
                  autoComplete="new-password"
                  required
                />
              </label>

              {passwordError && <p className="profile-error">{passwordError}</p>}
              {passwordSuccess && <p className="profile-success">{passwordSuccess}</p>}

              <div className="account-password-actions">
                <button className="btn btn-ghost" type="button" onClick={closePasswordModal} disabled={passwordSaving}>
                  Cancelar
                </button>
                <button className="btn btn-primary" type="submit" disabled={passwordSaving}>
                  <KeyRound size={16} /> {passwordSaving ? "A alterar..." : "Alterar senha"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
            {item.badge ? <span className={`bottom-nav-badge ${item.alert ? "alert" : ""}`}>{item.badge}</span> : null}
          </button>
        ))}
      </nav>
    </div>
  );
}
