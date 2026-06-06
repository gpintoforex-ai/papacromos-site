import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { Bell, Camera, ChevronDown, Gift, Handshake, KeyRound, LifeBuoy, LogOut, Mail, MessageCircle, Moon, MoreHorizontal, QrCode, RefreshCw, ScanLine, Shield, Sparkles, Sun, Trash2, Trophy, UserRound, Users, X } from "lucide-react";
import { supabase } from "../lib/supabase";

type Page = "collection" | "scanner" | "matches" | "trades" | "share" | "partners" | "daily-pack" | "support" | "admin";
type ThemeMode = "light" | "dark";

const themeStorageKey = "papacromos:theme";

function getInitialTheme(): ThemeMode {
  if (typeof localStorage === "undefined") return "light";
  return localStorage.getItem(themeStorageKey) === "dark" ? "dark" : "light";
}

interface LayoutProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  matchCount: number;
  pendingTradeCount: number;
  unreadMessageCount: number;
  onMessagesChange?: () => void;
  children: React.ReactNode;
}

export default function Layout({ currentPage, onNavigate, matchCount, pendingTradeCount, unreadMessageCount, onMessagesChange, children }: LayoutProps) {
  const { user, profile, updateProfileAvatar, signOut } = useAuth();
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
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
  const [messagesModalOpen, setMessagesModalOpen] = useState(false);
  const [recentMessages, setRecentMessages] = useState<any[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarStage, setAvatarStage] = useState<string | null>(null);
  const [avatarRemoving, setAvatarRemoving] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarSuccess, setAvatarSuccess] = useState<string | null>(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const displayName = profile?.username || user?.email?.split("@")[0] || "Utilizador";
  const displayEmail = profile?.email || user?.email || "-";
  const displayStatus = profile?.status === "king_cromo" ? "King Cromo" : profile?.is_admin ? "Administrador" : "Utilizador";
  const accountCreatedAt = profile?.created_at || user?.created_at;
  const createdLabel = accountCreatedAt
    ? new Date(accountCreatedAt).toLocaleDateString("pt-PT")
    : "-";
  const isDarkTheme = theme === "dark";

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(themeStorageKey, theme);
  }, [theme]);

  useEffect(() => {
    if (!moreMenuOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      if (!event.target.closest(".nav-more, .bottom-nav-more")) {
        setMoreMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreMenuOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [moreMenuOpen]);

  const primaryNavItems: { page: Page; label: string; icon: React.ReactNode; badge?: number; alert?: boolean }[] = [
    { page: "collection", label: "Colecao", icon: <Trophy size={18} /> },
    { page: "scanner", label: "Scanner", icon: <ScanLine size={18} /> },
    { page: "matches", label: "Matches", icon: <RefreshCw size={18} />, badge: matchCount },
    { page: "trades", label: "Trocas", icon: <Users size={18} />, badge: pendingTradeCount, alert: pendingTradeCount > 0 },
    { page: "daily-pack", label: "Saqueta", icon: <Gift size={18} /> },
  ];
  const secondaryNavGroups: { label: string; items: { page: Page; label: string; icon: React.ReactNode }[] }[] = [
    {
      label: "Comunidade",
      items: [
        { page: "share", label: "Partilhar", icon: <QrCode size={18} /> },
        { page: "partners", label: "Parceiros", icon: <Handshake size={18} /> },
      ],
    },
    {
      label: "Ajuda",
      items: [
        { page: "support", label: "Suporte", icon: <LifeBuoy size={18} /> },
      ],
    },
    ...(profile?.is_admin ? [{
      label: "Gestao",
      items: [
        { page: "admin" as Page, label: "Administracao", icon: <Shield size={18} /> },
      ],
    }] : []),
  ];
  const secondaryNavItems = secondaryNavGroups.flatMap((group) => group.items);
  const secondaryPageActive = secondaryNavItems.some((item) => item.page === currentPage);
  const secondaryActiveItem = secondaryNavItems.find((item) => item.page === currentPage);

  const navigateFromMenu = (page: Page) => {
    setMoreMenuOpen(false);
    onNavigate(page);
  };

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

  const deleteOwnMessages = async () => {
    if (!window.confirm("Apagar todas as tuas mensagens de troca?")) return;
    if (!user?.id) return;

    setAccountError(null);
    try {
      const { error } = await supabase
        .from("trade_messages")
        .delete()
        .eq("user_id", user.id);
      if (error) throw error;
      await onMessagesChange?.();
      setProfileOpen(false);
    } catch (err: any) {
      setAccountError(err.message || "Erro ao apagar mensagens.");
    }
  };

  const closePasswordModal = () => {
    setPasswordModalOpen(false);
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError(null);
    setPasswordSuccess(null);
  };

  const requestNotificationPermission = () => {
    window.dispatchEvent(new CustomEvent("papa-cromos:request-notification-permission"));
    setProfileOpen(false);
  };

  const prepareCollectorPhoto = async (file: File): Promise<File> => {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Nao foi possivel ler a imagem."));
      };
      img.src = url;
    });

    const maxDimension = 2048;
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Este browser nao consegue preparar a fotografia.");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Nao foi possivel preparar a fotografia."));
      }, "image/jpeg", 0.9);
    });
    return new File([blob], "portrait.jpg", { type: "image/jpeg" });
  };

  const uploadCollectorAvatar = async (file: File | null) => {
    if (!file || !user?.id) return;
    if (file.type && !file.type.startsWith("image/")) {
      setAvatarError("Escolhe uma imagem valida.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setAvatarError("A fotografia deve ter menos de 20 MB.");
      return;
    }

    setAvatarSaving(true);
    setAvatarStage("A preparar a fotografia...");
    setAvatarError(null);
    setAvatarSuccess(null);
    try {
      const preparedPhoto = await prepareCollectorPhoto(file);
      setAvatarStage("A transformar a fotografia com IA...");
      const payload = new FormData();
      payload.append("image", preparedPhoto);

      const { data, error: functionError } = await supabase.functions.invoke("generate-collector-avatar", {
        body: payload,
      });
      if (functionError) {
        let message = functionError.message;
        const response = (functionError as any)?.context;
        if (response instanceof Response) {
          const errorPayload = await response.json().catch(() => null);
          message = errorPayload?.error || message;
        }
        throw new Error(message);
      }

      const imageUrl = String(data?.imageUrl || "");
      if (!imageUrl) throw new Error("A IA nao devolveu o avatar.");

      setAvatarStage("A atualizar o perfil...");
      await updateProfileAvatar(imageUrl);
      setAvatarSuccess("Avatar criado por IA. Ja pode sair nas saquetas virtuais.");
    } catch (err: any) {
      setAvatarError(err.message || "Nao foi possivel guardar o avatar.");
    } finally {
      setAvatarSaving(false);
      setAvatarStage(null);
    }
  };

  const removeCollectorAvatar = async () => {
    if (!user?.id || !profile?.avatar_image_url || avatarSaving || avatarRemoving) return;
    if (!window.confirm("Remover o teu avatar e deixar de o disponibilizar nas novas saquetas virtuais?")) return;

    setAvatarRemoving(true);
    setAvatarError(null);
    setAvatarSuccess(null);
    setAvatarStage("A remover o avatar...");
    try {
      const marker = "/storage/v1/object/public/collector-avatars/";
      const markerIndex = profile.avatar_image_url.indexOf(marker);
      if (markerIndex >= 0) {
        const encodedPath = profile.avatar_image_url.slice(markerIndex + marker.length).split("?")[0];
        const filePath = decodeURIComponent(encodedPath);
        if (filePath.startsWith(`${user.id}/`)) {
          const { error: removeError } = await supabase.storage
            .from("collector-avatars")
            .remove([filePath]);
          if (removeError) throw removeError;
        }
      }

      await updateProfileAvatar(null);
      setAvatarSuccess("Avatar removido. Podes criar outro quando quiseres.");
    } catch (err: any) {
      setAvatarError(err.message || "Nao foi possivel remover o avatar.");
    } finally {
      setAvatarRemoving(false);
      setAvatarStage(null);
    }
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
            {primaryNavItems.map((item) => (
              <button
                key={item.page}
                className={`nav-btn ${currentPage === item.page ? "active" : ""}`}
                onClick={() => onNavigate(item.page)}
                type="button"
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge ? <span className={`nav-badge ${item.alert ? "alert" : ""}`}>{item.badge}</span> : null}
              </button>
            ))}
            <div className="nav-more">
              <button
                className={`nav-btn nav-more-trigger ${secondaryPageActive ? "active" : ""}`}
                type="button"
                onClick={() => setMoreMenuOpen((open) => !open)}
                aria-expanded={moreMenuOpen}
                aria-haspopup="menu"
              >
                <MoreHorizontal size={18} />
                <span>{secondaryActiveItem?.label || "Mais"}</span>
                <ChevronDown size={14} />
              </button>
              {moreMenuOpen && (
                <div className="nav-more-menu" role="menu">
                  {secondaryNavGroups.map((group) => (
                    <div className="nav-more-group" key={group.label} role="group" aria-label={group.label}>
                      <span className="nav-more-group-label">{group.label}</span>
                      {group.items.map((item) => (
                        <button
                          key={item.page}
                          className={currentPage === item.page ? "active" : ""}
                          type="button"
                          role="menuitem"
                          onClick={() => navigateFromMenu(item.page)}
                        >
                          {item.icon}
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </nav>
          <div className="header-actions">
            <button
              className="header-icon-btn theme-toggle-btn"
              type="button"
              onClick={() => setTheme((currentTheme) => currentTheme === "dark" ? "light" : "dark")}
              title={isDarkTheme ? "Mudar para tema claro" : "Mudar para tema escuro"}
              aria-label={isDarkTheme ? "Mudar para tema claro" : "Mudar para tema escuro"}
              aria-pressed={isDarkTheme}
            >
              {isDarkTheme ? <Sun size={17} /> : <Moon size={17} />}
            </button>
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
                  {profile?.avatar_image_url ? (
                    <img src={profile.avatar_image_url} alt="" />
                  ) : (
                    <UserRound size={15} />
                  )}
                </span>
              </button>
              {profileOpen && (
                <div className="profile-popover">
                  <div className="profile-popover-header">
                    <div>
                      <strong>{displayName}</strong>
                      <span>{displayStatus}</span>
                    </div>
                    <button
                      className="header-icon-btn profile-popover-close"
                      type="button"
                      onClick={() => setProfileOpen(false)}
                      title="Fechar"
                      aria-label="Fechar janela"
                    >
                      <X size={16} />
                    </button>
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
                      <dt>Distrito</dt>
                      <dd>{profile?.region || "-"}</dd>
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
                      <dt>Estatuto</dt>
                      <dd>{profile?.status === "king_cromo" ? "King Cromo" : "Membro"}</dd>
                    </div>
                    <div>
                      <dt>Registo</dt>
                      <dd>{createdLabel}</dd>
                    </div>
                    <div>
                      <dt>vr</dt>
                      <dd>2026.16</dd>
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
                        className="btn btn-ghost btn-sm"
                        type="button"
                        onClick={requestNotificationPermission}
                      >
                        <Bell size={14} /> Ativar notificacoes
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        type="button"
                        onClick={deleteOwnMessages}
                      >
                        <Mail size={14} /> Apagar mensagens
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
      {unreadMessageCount > 0 && (
        <button
          className="global-message-shortcut"
          type="button"
            onClick={async () => {
              // load unread messages summary and show simple list entries
              setMessagesModalOpen(true);
              try {
                setMessagesError(null);
                setMessagesLoading(true);
                if (!user?.id) {
                  setRecentMessages([]);
                  return;
                }

                const { data: msgs, error: msgsError } = await supabase
                  .from("trade_messages")
                  .select("id, trade_id, user_id, created_at, is_read")
                  .neq("user_id", user.id)
                  .eq("is_read", false)
                  .order("created_at", { ascending: false })
                  .limit(50);
                if (msgsError) throw msgsError;

                setRecentMessages((msgs || []) as any[]);
              } catch (err: any) {
                setMessagesError(err.message || "Erro ao carregar mensagens.");
                setRecentMessages([]);
              } finally {
                setMessagesLoading(false);
              }
            }}
          title={`${unreadMessageCount} mensagem${unreadMessageCount === 1 ? "" : "s"} nova${unreadMessageCount === 1 ? "" : "s"}`}
          aria-label={`Abrir mensagens. ${unreadMessageCount} mensagem${unreadMessageCount === 1 ? "" : "s"} nova${unreadMessageCount === 1 ? "" : "s"}.`}
        >
          <MessageCircle size={22} />
          <span>{unreadMessageCount > 99 ? "99+" : unreadMessageCount}</span>
        </button>
      )}
      {messagesModalOpen && (
        <div className="trade-message-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="recent-messages-title" onClick={() => setMessagesModalOpen(false)}>
          <div className="trade-message-modal" onClick={(e) => e.stopPropagation()}>
            <div className="trade-message-modal-header">
              <div>
                <h3 id="recent-messages-title">Mensagens recentes</h3>
                <span>{recentMessages.length} mensagem{recentMessages.length === 1 ? "" : "s"}</span>
              </div>
              <button className="header-icon-btn" type="button" onClick={() => setMessagesModalOpen(false)} title="Fechar" aria-label="Fechar mensagens">
                <X size={18} />
              </button>
            </div>
            <div className="trade-chat trade-chat-modal">
              <div className="trade-messages">
                {messagesLoading ? (
                  <span className="trade-empty-message">A carregar...</span>
                ) : messagesError ? (
                  <p className="profile-error">{messagesError}</p>
                ) : recentMessages.length === 0 ? (
                  <span className="trade-empty-message">Sem mensagens.</span>
                ) : (
                  <div className="trade-messages-list">
                    {recentMessages.map((m) => (
                      <div
                        key={m.id}
                        className={`trade-message-summary-row ${m.is_read ? "read" : "unread"}`}
                        onClick={() => {
                          // navigate to Trades page and include params to open specific message
                          const url = new URL(window.location.href);
                          url.searchParams.set("openTradeId", m.trade_id);
                          url.searchParams.set("openMessageId", m.id);
                          window.history.replaceState({}, "", url.toString());
                          setMessagesModalOpen(false);
                          onNavigate("trades");
                        }}
                      >
                        <span className="unread-pill">Tem mensagens não lidas</span>
                        <time className="trade-message-time">{new Date(m.created_at).toLocaleString()}</time>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
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
                <dt>Distrito</dt>
                <dd>{profile?.region || "-"}</dd>
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

            <div className="collector-avatar-panel">
              <div className="collector-avatar-preview">
                {profile?.avatar_image_url ? (
                  <img src={profile.avatar_image_url} alt="Cromo de colecionador" />
                ) : (
                  <div>
                    <UserRound size={42} />
                    <span>Sem cromo</span>
                  </div>
                )}
              </div>
              <div className="collector-avatar-copy">
                <strong>Cromo de colecionador</strong>
                <p>Tira ou escolhe uma foto. A IA cria um avatar ilustrado para sair nas saquetas virtuais dos outros colecionadores.</p>
                {avatarError && <p className="profile-error">{avatarError}</p>}
                {avatarSuccess && <p className="profile-success">{avatarSuccess}</p>}
                {avatarStage && <p className="collector-avatar-stage">{avatarStage}</p>}
                <div className="collector-avatar-actions">
                  <label className="btn btn-primary btn-sm collector-avatar-upload" htmlFor="collector-avatar-input">
                    <Camera size={15} /> {avatarSaving ? "A criar..." : profile?.avatar_image_url ? "Criar novo avatar" : "Criar avatar com IA"}
                  </label>
                  {profile?.avatar_image_url && (
                    <button
                      className="btn btn-danger-soft btn-sm"
                      type="button"
                      onClick={removeCollectorAvatar}
                      disabled={avatarSaving || avatarRemoving}
                    >
                      <Trash2 size={15} /> {avatarRemoving ? "A remover..." : "Remover foto"}
                    </button>
                  )}
                </div>
                <input
                  id="collector-avatar-input"
                  className="sticker-photo-input"
                  type="file"
                  accept="image/*"
                  capture="user"
                  disabled={avatarSaving || avatarRemoving}
                  onChange={(event) => {
                    uploadCollectorAvatar(event.target.files?.[0] || null);
                    event.currentTarget.value = "";
                  }}
                />
                <span><Sparkles size={14} /> O avatar fica publico apenas como cromo virtual.</span>
              </div>
            </div>

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
        {primaryNavItems.map((item) => (
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
        <div className="bottom-nav-more">
          <button
            className={`bottom-nav-btn ${secondaryPageActive ? "active" : ""}`}
            type="button"
            title="Mais"
            aria-label={secondaryActiveItem ? `${secondaryActiveItem.label}. Abrir mais opcoes` : "Abrir mais opcoes"}
            aria-expanded={moreMenuOpen}
            onClick={() => setMoreMenuOpen((open) => !open)}
          >
            <MoreHorizontal size={20} />
          </button>
          {moreMenuOpen && (
            <div className="bottom-nav-more-menu">
              {secondaryNavGroups.map((group) => (
                <div className="nav-more-group" key={group.label}>
                  <span className="nav-more-group-label">{group.label}</span>
                  {group.items.map((item) => (
                    <button
                      key={item.page}
                      className={currentPage === item.page ? "active" : ""}
                      type="button"
                      onClick={() => navigateFromMenu(item.page)}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </nav>
    </div>
  );
}
