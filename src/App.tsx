import { AuthProvider, useAuth } from "./lib/auth";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import CollectionPage from "./pages/CollectionPage";
import MatchesPage from "./pages/MatchesPage";
import TradesPage from "./pages/TradesPage";
import AdminPage from "./pages/AdminPage";
import PartnersPage from "./pages/PartnersPage";
import CookieConsent from "./components/CookieConsent";
import InstallAppPrompt from "./components/InstallAppPrompt";
import { useEffect, useState } from "react";
import { findUserMatches } from "./lib/matches";
import { supabase } from "./lib/supabase";

type Page = "collection" | "matches" | "trades" | "partners" | "admin";

function AppContent() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState<Page>("collection");
  const [collectionHomeKey, setCollectionHomeKey] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const [pendingTradeCount, setPendingTradeCount] = useState(0);

  const refreshMatchCount = async () => {
    if (!user?.id) {
      setMatchCount(0);
      return;
    }

    try {
      const matches = await findUserMatches(user.id);
      setMatchCount(matches.length);
    } catch {
      setMatchCount(0);
    }
  };

  const refreshPendingTradeCount = async () => {
    if (!user?.id) {
      setPendingTradeCount(0);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("trade_offers")
        .select("id")
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
        .eq("status", "pending");
      if (error) throw error;
      setPendingTradeCount(data?.length || 0);
    } catch {
      setPendingTradeCount(0);
    }
  };

  useEffect(() => {
    refreshMatchCount();
    refreshPendingTradeCount();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshPendingTradeCount();
      }
    };
    const intervalId = window.setInterval(refreshPendingTradeCount, 30000);

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user]);

  const navigate = (nextPage: Page) => {
    if (nextPage === "collection") {
      setCollectionHomeKey((key) => key + 1);
    }
    setPage(nextPage);
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

  return (
    <>
      <Layout currentPage={page} onNavigate={navigate} matchCount={matchCount} pendingTradeCount={pendingTradeCount}>
        {page === "collection" && <CollectionPage homeKey={collectionHomeKey} onCollectionChange={refreshMatchCount} />}
        {page === "matches" && <MatchesPage onMatchesChange={setMatchCount} />}
        {page === "trades" && <TradesPage onPendingTradeCountChange={setPendingTradeCount} />}
        {page === "partners" && <PartnersPage />}
        {page === "admin" && <AdminPage />}
      </Layout>
      <InstallAppPrompt />
      <CookieConsent />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
