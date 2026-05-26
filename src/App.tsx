import { AuthProvider, useAuth } from "./lib/auth";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import CollectionPage from "./pages/CollectionPage";
import MatchesPage from "./pages/MatchesPage";
import TradesPage from "./pages/TradesPage";
import AdminPage from "./pages/AdminPage";
import PartnersPage from "./pages/PartnersPage";
import SharePage from "./pages/SharePage";
import SupportPage from "./pages/SupportPage";
import ScannerPage from "./pages/ScannerPage";
import CookieConsent from "./components/CookieConsent";
import InstallAppPrompt from "./components/InstallAppPrompt";
import ProfileCompletionGate from "./components/ProfileCompletionGate";
import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type MouseEvent } from "react";
import { countUniqueRequestedStickers, findUserMatches } from "./lib/matches";
import { supabase } from "./lib/supabase";
import { getPushPermissionState, setupPushNotifications } from "./lib/pushNotifications";

type Page = "collection" | "scanner" | "matches" | "trades" | "share" | "partners" | "support" | "admin";

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [page, setPage] = useState<Page>("collection");
  const [collectionHomeKey, setCollectionHomeKey] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const [pendingTradeCount, setPendingTradeCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [messageRefreshKey, setMessageRefreshKey] = useState(0);
  const [sharedUserId, setSharedUserId] = useState<string | null>(null);
  const [pendingTradesAlertOpen, setPendingTradesAlertOpen] = useState(false);
  const [pendingTradesAlertCount, setPendingTradesAlertCount] = useState(0);
  const [notificationPromptOpen, setNotificationPromptOpen] = useState(false);
  const [notificationPromptBusy, setNotificationPromptBusy] = useState(false);
  const [notificationPromptError, setNotificationPromptError] = useState<string | null>(null);
  const pendingTradesAlertShown = useRef(false);
  const previousUserId = useRef<string | null>(null);

  const refreshUnreadMessageCount = useCallback(async () => {
    if (!user?.id) {
      setUnreadMessageCount(0);
      return;
    }

    try {
      const { data: trades, error: tradesError } = await supabase
        .from("trade_offers")
        .select("id")
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`);
      if (tradesError) throw tradesError;

      const tradeIds = (trades || []).map((trade) => trade.id);
      if (!tradeIds.length) {
        setUnreadMessageCount(0);
        return;
      }

      const { count, error: messagesError } = await supabase
        .from("trade_messages")
        .select("id", { count: "exact", head: true })
        .in("trade_id", tradeIds)
        .neq("user_id", user.id)
        .eq("is_read", false);
      if (messagesError) throw messagesError;

      setUnreadMessageCount(count || 0);
    } catch {
      setUnreadMessageCount(0);
    }
  }, [user?.id]);

  const refreshMatchCount = async () => {
    if (!user?.id) {
      setMatchCount(0);
      return;
    }

    try {
      const matches = await findUserMatches(user.id);
      setMatchCount(countUniqueRequestedStickers(matches));
    } catch {
      setMatchCount(0);
    }
  };

  const refreshPendingTradeCount = async (): Promise<number> => {
    if (!user?.id) {
      setPendingTradeCount(0);
      return 0;
    }

    try {
      const { data, error } = await supabase
        .from("trade_offers")
        .select("id")
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
        .eq("status", "pending");
      if (error) throw error;
      const count = data?.length || 0;
      setPendingTradeCount(count);
      return count;
    } catch {
      setPendingTradeCount(0);
      return 0;
    }
  };

  useEffect(() => {
    const isFirstLogin = !!user?.id && !previousUserId.current;

    if (user?.id) {
      setPage("collection");
      setSharedUserId(null);
      setCollectionHomeKey((key) => key + 1);

      const url = new URL(window.location.href);
      if (url.searchParams.has("share")) {
        url.searchParams.delete("share");
        window.history.replaceState({}, "", url.toString());
      }
    }

    refreshMatchCount();
    refreshPendingTradeCount().then((count) => {
      if (isFirstLogin && count > 0 && !pendingTradesAlertShown.current) {
        pendingTradesAlertShown.current = true;
        setPendingTradesAlertCount(count);
        setPendingTradesAlertOpen(true);
      }
    });
    refreshUnreadMessageCount();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshPendingTradeCount();
        refreshUnreadMessageCount();
      }
    };
    const intervalId = window.setInterval(refreshPendingTradeCount, 30000);
    const messageIntervalId = window.setInterval(refreshUnreadMessageCount, 30000);

    document.addEventListener("visibilitychange", handleVisibilityChange);

    previousUserId.current = user?.id || null;

    return () => {
      window.clearInterval(intervalId);
      window.clearInterval(messageIntervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user]);

  useEffect(() => {
    if (!user?.id) return;

    let cleanup: (() => Promise<void>) | undefined;
    let cancelled = false;

    setupPushNotifications(user.id)
      .then((removeListeners) => {
        if (cancelled) {
          removeListeners();
          return;
        }
        cleanup = removeListeners;
      })
      .catch((error) => {
        console.error("Failed to initialize push notifications", error);
      });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setNotificationPromptOpen(false);
      return;
    }

    const dismissedKey = `papacromos:notification-prompt-dismissed:${user.id}`;
    if (sessionStorage.getItem(dismissedKey) === "true") return;

    getPushPermissionState()
      .then((permissionState) => {
        setNotificationPromptOpen(permissionState === "prompt");
      })
      .catch(() => setNotificationPromptOpen(false));
  }, [user?.id]);

  const refreshMessageState = useCallback(async () => {
    await refreshUnreadMessageCount();
    setMessageRefreshKey((key) => key + 1);
  }, [refreshUnreadMessageCount]);

  useEffect(() => {
    if (!user?.id) return;

    const openNotificationTarget = () => {
      setPage("trades");
      refreshMessageState();
      refreshPendingTradeCount();
    };
    const handleWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === "push-notification-click") {
        openNotificationTarget();
      }
    };

    window.addEventListener("papa-cromos:open-notifications", openNotificationTarget);
    navigator.serviceWorker?.addEventListener("message", handleWorkerMessage);

    return () => {
      window.removeEventListener("papa-cromos:open-notifications", openNotificationTarget);
      navigator.serviceWorker?.removeEventListener("message", handleWorkerMessage);
    };
  }, [refreshMessageState, user?.id]);

  const navigate = (nextPage: Page) => {
    if (nextPage === "collection") {
      setCollectionHomeKey((key) => key + 1);
    }
    if (nextPage === "share") {
      setSharedUserId(null);
      const url = new URL(window.location.href);
      url.searchParams.delete("share");
      window.history.replaceState({}, "", url.toString());
    }
    setPage(nextPage);
  };

  const allowNotifications = async () => {
    if (!user?.id) return;

    setNotificationPromptBusy(true);
    setNotificationPromptError(null);
    try {
      await setupPushNotifications(user.id, { requestPermission: true });
      const permissionState = await getPushPermissionState();
      if (permissionState === "granted") {
        setNotificationPromptOpen(false);
        return;
      }
      if (permissionState === "denied") {
        setNotificationPromptError("As notificacoes foram bloqueadas no browser. Podes ativar nas definicoes do site.");
        return;
      }
      setNotificationPromptError("Nao foi possivel ativar as notificacoes neste dispositivo.");
    } catch (err: any) {
      setNotificationPromptError(err.message || "Nao foi possivel ativar notificacoes.");
    } finally {
      setNotificationPromptBusy(false);
    }
  };

  const dismissNotificationPrompt = () => {
    if (user?.id) {
      sessionStorage.setItem(`papacromos:notification-prompt-dismissed:${user.id}`, "true");
    }
    setNotificationPromptOpen(false);
    setNotificationPromptError(null);
  };

  const blockProtectedContextMenu = (event: MouseEvent) => {
    if (isEditableTarget(event.target)) return;
    event.preventDefault();
  };

  const blockProtectedCopy = (event: ClipboardEvent) => {
    if (isEditableTarget(event.target)) return;
    event.preventDefault();
  };

  const blockProtectedDrag = (event: DragEvent) => {
    if (event.target instanceof Node && event.currentTarget.contains(event.target)) {
      event.preventDefault();
    }
  };

  if (loading) {
    return <div className="loading-screen">A carregar...</div>;
  }

  if (!user) {
    return (
      <>
        <LoginPage />
        <InstallAppPrompt />
        <CookieConsent />
      </>
    );
  }

  if (profile && (!profile.region?.trim() || !profile.city?.trim())) {
    return (
      <>
        <ProfileCompletionGate
          requiredFields={["region", "city"]}
          title="Completa a tua localizacao"
          description="Indica distrito e cidade para podermos sugerir trocas e parceiros proximos."
        />
        <CookieConsent />
      </>
    );
  }

  return (
    <div
      className="app-protection-shell"
      onContextMenuCapture={blockProtectedContextMenu}
      onCopyCapture={blockProtectedCopy}
      onDragStartCapture={blockProtectedDrag}
    >
      <Layout
        currentPage={page}
        onNavigate={navigate}
        matchCount={matchCount}
        pendingTradeCount={pendingTradeCount}
        unreadMessageCount={unreadMessageCount}
        onMessagesChange={refreshMessageState}
      >
        {page === "collection" && (
          <CollectionPage
            homeKey={collectionHomeKey}
            onCollectionChange={refreshMatchCount}
            onOpenSharedUser={(userId) => {
              setSharedUserId(userId);
              setPage("share");
            }}
          />
        )}
        {page === "scanner" && <ScannerPage onCollectionChange={refreshMatchCount} onClose={() => setPage("collection")} />}
        {page === "matches" && (
          profile?.phone?.trim() ? (
            <MatchesPage onMatchesChange={setMatchCount} />
          ) : (
            <ProfileCompletionGate
              requiredFields={["phone"]}
              title="Adiciona o teu telemovel"
              description="Para aceder aos Matches, associa um numero de telemovel ao teu perfil. Isto ajuda a validar contactos para trocas."
              submitLabel="Guardar e ver Matches"
              showSignOut={false}
            />
          )
        )}
        {page === "trades" && (
          <TradesPage
            onPendingTradeCountChange={setPendingTradeCount}
            onMessagesChange={refreshUnreadMessageCount}
            refreshKey={messageRefreshKey}
          />
        )}
        {page === "share" && <SharePage sharedUserId={sharedUserId} onOpenSharedUser={setSharedUserId} />}
        {page === "partners" && <PartnersPage />}
        {page === "support" && <SupportPage />}
        {page === "admin" && <AdminPage />}
      </Layout>
      <InstallAppPrompt />
      <CookieConsent />
      {notificationPromptOpen && (
        <div className="account-data-overlay" role="dialog" aria-modal="true" aria-labelledby="notification-permission-title">
          <div className="account-data-modal notification-permission-modal">
            <div className="account-data-header">
              <div>
                <h2 id="notification-permission-title">Ativar notificacoes</h2>
                <p>Recebe alertas quando tiveres novas propostas, respostas e mensagens de outros utilizadores.</p>
              </div>
              <button className="header-icon-btn" type="button" onClick={dismissNotificationPrompt} title="Fechar" aria-label="Fechar pedido">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <div className="notification-permission-body">
              <p>As notificacoes ajudam-te a responder mais depressa e a nao perder trocas importantes.</p>
              {notificationPromptError && <p className="profile-error">{notificationPromptError}</p>}
              <div className="notification-permission-actions">
                <button className="btn btn-primary btn-sm" type="button" onClick={allowNotifications} disabled={notificationPromptBusy}>
                  {notificationPromptBusy ? "A ativar..." : "Permitir notificacoes"}
                </button>
                <button className="btn btn-ghost btn-sm" type="button" onClick={dismissNotificationPrompt} disabled={notificationPromptBusy}>
                  Agora nao
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {pendingTradesAlertOpen && (
        <div className="account-data-overlay" role="dialog" aria-modal="true" aria-labelledby="pending-trades-alert-title">
          <div className="account-data-modal pending-trades-alert-modal">
            <div className="account-data-header">
              <div>
                <h2 id="pending-trades-alert-title">Tem propostas pendentes</h2>
                <p><strong>{pendingTradesAlertCount}</strong> proposta{pendingTradesAlertCount === 1 ? " pendente" : "s pendentes"} esperando a tua decisao.</p>
              </div>
              <button className="header-icon-btn" type="button" onClick={() => setPendingTradesAlertOpen(false)} title="Fechar" aria-label="Fechar aviso">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <div className="pending-trades-alert-body">
              <p>Para manteres o controlo das tuas trocas, vê as propostas pendentes agora mesmo.</p>
              <div className="pending-trades-alert-actions">
                <button className="btn btn-primary btn-sm" type="button" onClick={() => { setPendingTradesAlertOpen(false); setPage("trades"); }}>
                  Ver trocas pendentes
                </button>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => setPendingTradesAlertOpen(false)}>
                  Mais tarde
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
