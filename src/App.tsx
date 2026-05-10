import { AuthProvider, useAuth } from "./lib/auth";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import CollectionPage from "./pages/CollectionPage";
import MatchesPage from "./pages/MatchesPage";
import TradesPage from "./pages/TradesPage";
import AdminPage from "./pages/AdminPage";
import PartnersPage from "./pages/PartnersPage";
import { useEffect, useState } from "react";
import { findUserMatches } from "./lib/matches";

type Page = "collection" | "matches" | "trades" | "partners" | "admin";

function AppContent() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState<Page>("collection");
  const [collectionHomeKey, setCollectionHomeKey] = useState(0);
  const [matchCount, setMatchCount] = useState(0);

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

  useEffect(() => {
    refreshMatchCount();
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
    return <LoginPage />;
  }

  return (
    <Layout currentPage={page} onNavigate={navigate} matchCount={matchCount}>
      {page === "collection" && <CollectionPage homeKey={collectionHomeKey} onCollectionChange={refreshMatchCount} />}
      {page === "matches" && <MatchesPage onMatchesChange={setMatchCount} />}
      {page === "trades" && <TradesPage />}
      {page === "partners" && <PartnersPage />}
      {page === "admin" && <AdminPage />}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
