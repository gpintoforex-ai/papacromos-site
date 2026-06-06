import { useEffect, useMemo, useState } from "react";
import { Gift, History, Loader2, Sparkles, Trophy } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

type PackReward = {
  pack_id: string;
  reward_date: string;
  reward_type: "sticker" | "collector";
  sticker_id: string | null;
  sticker_number: number | null;
  sticker_name: string | null;
  sticker_image_url: string | null;
  sticker_rarity: string | null;
  collection_name: string | null;
  collector_user_id: string | null;
  collector_username: string | null;
  collector_avatar_image_url: string | null;
  collector_city: string | null;
  collector_status: string | null;
  points: number;
  already_opened: boolean;
  created_at: string;
};

type PackHistoryRow = {
  id: string;
  reward_date: string;
  reward_type: "sticker" | "collector";
  points: number;
  created_at: string;
  stickers: {
    number: number;
    name: string;
    image_url: string;
    rarity: string;
    collections: {
      name: string;
    } | null;
  } | null;
  collector: {
    username: string;
    avatar_image_url: string | null;
    city: string | null;
    status: string | null;
  } | null;
};

const stickerAssetVersion = "20260523-mexico-names";

const rarityLabels: Record<string, string> = {
  common: "Comum",
  uncommon: "Especial",
  rare: "Raro",
  legendary: "Lendario",
};

function getStickerPreviewImageUrl(imageUrl: string | null | undefined) {
  const match = String(imageUrl || "").match(/^\/stickers\/([^/]+)\/([^/.]+)\.(png|jpe?g|webp)$/i);
  if (!match) return imageUrl || "/logo.png";
  return `/sticker-previews/${match[1]}/${match[2]}.jpg?v=${stickerAssetVersion}`;
}

function formatPackDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function DailyPackPage() {
  const { user } = useAuth();
  const [todayReward, setTodayReward] = useState<PackReward | null>(null);
  const [history, setHistory] = useState<PackHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPoints = useMemo(
    () => history.reduce((total, row) => total + (row.points || 0), 0),
    [history],
  );

  const loadPacks = async () => {
    if (!user?.id) {
      setTodayReward(null);
      setHistory([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: historyError } = await supabase
        .from("user_virtual_packs")
        .select("id, reward_date, reward_type, points, created_at, stickers(number, name, image_url, rarity, collections(name)), collector:user_profiles!user_virtual_packs_collector_user_id_fkey(username, avatar_image_url, city, status)")
        .eq("user_id", user.id)
        .order("reward_date", { ascending: false })
        .limit(12);
      if (historyError) throw historyError;

      const rows = (data || []) as unknown as PackHistoryRow[];
      setHistory(rows);

      const todayKey = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Lisbon" });
      const todayRow = rows.find((row) => row.reward_date === todayKey);
      if (todayRow) {
        setTodayReward({
          pack_id: todayRow.id,
          reward_date: todayRow.reward_date,
          reward_type: todayRow.reward_type || "sticker",
          sticker_id: null,
          sticker_number: todayRow.stickers?.number || null,
          sticker_name: todayRow.stickers?.name || null,
          sticker_image_url: todayRow.stickers?.image_url || null,
          sticker_rarity: todayRow.stickers?.rarity || null,
          collection_name: todayRow.stickers?.collections?.name || null,
          collector_user_id: null,
          collector_username: todayRow.collector?.username || null,
          collector_avatar_image_url: todayRow.collector?.avatar_image_url || null,
          collector_city: todayRow.collector?.city || null,
          collector_status: todayRow.collector?.status || null,
          points: todayRow.points,
          already_opened: true,
          created_at: todayRow.created_at,
        });
        setRevealed(true);
      } else {
        setTodayReward(null);
        setRevealed(false);
      }
    } catch (err: any) {
      setError(err.message || "Erro ao carregar a saqueta diaria.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPacks();
  }, [user?.id]);

  const openDailyPack = async () => {
    setOpening(true);
    setError(null);
    setRevealed(false);

    try {
      await new Promise((resolve) => window.setTimeout(resolve, 850));
      const { data, error: openError } = await supabase.rpc("open_daily_virtual_pack");
      if (openError) throw openError;

      const reward = ((data || []) as PackReward[])[0];
      if (!reward) throw new Error("Nao foi possivel abrir a saqueta.");

      setTodayReward(reward);
      setRevealed(true);
      await loadPacks();
      setTodayReward(reward);
      setRevealed(true);
    } catch (err: any) {
      setError(err.message || "Erro ao abrir a saqueta diaria.");
      setRevealed(Boolean(todayReward));
    } finally {
      setOpening(false);
    }
  };

  const rarity = todayReward?.reward_type === "collector"
    ? (todayReward.collector_status === "king_cromo" ? "legendary" : "rare")
    : todayReward?.sticker_rarity || "common";

  if (loading) {
    return <div className="loading">A carregar saqueta...</div>;
  }

  return (
    <div className="daily-pack-page">
      <section className="daily-pack-hero">
        <div className="daily-pack-hero-copy">
          <span><Gift size={18} /> Saqueta diaria</span>
          <h2>Abre uma recompensa virtual por dia</h2>
          <p>Ganha pontos e descobre um cromo virtual para manter a colecao em movimento.</p>
        </div>
        <div className="daily-pack-stats">
          <div>
            <strong>{totalPoints}</strong>
            <span>pontos totais</span>
          </div>
          <div>
            <strong>{history.length}</strong>
            <span>saquetas abertas</span>
          </div>
        </div>
      </section>

      {error && <p className="error-message">{error}</p>}

      <section className={`daily-pack-stage ${opening ? "opening" : ""} ${revealed ? "revealed" : ""}`}>
        <div className="daily-pack-visual" aria-live="polite">
          {!revealed ? (
            <button className="daily-pack-envelope" type="button" onClick={openDailyPack} disabled={opening}>
              <span className="daily-pack-shine" />
              <Gift size={58} />
              <strong>{opening ? "A abrir..." : "Abrir saqueta"}</strong>
              <em>Disponivel hoje</em>
              {opening && <Loader2 className="daily-pack-loader" size={22} />}
            </button>
          ) : todayReward ? (
            <article className={`daily-pack-reward rarity-${rarity}`}>
              <div className="daily-pack-card-image">
                <img
                  src={todayReward.reward_type === "collector"
                    ? todayReward.collector_avatar_image_url || "/logo.png"
                    : getStickerPreviewImageUrl(todayReward.sticker_image_url)}
                  alt={todayReward.reward_type === "collector"
                    ? todayReward.collector_username || "Colecionador"
                    : todayReward.sticker_name || "Cromo virtual"}
                  onError={(event) => {
                    event.currentTarget.src = "/logo.png";
                  }}
                />
              </div>
              <div className="daily-pack-card-copy">
                <span><Sparkles size={15} /> {todayReward.reward_type === "collector" ? "Colecionador" : rarityLabels[rarity] || rarity}</span>
                <h3>{todayReward.reward_type === "collector" ? todayReward.collector_username || "Colecionador" : todayReward.sticker_name || "Cromo virtual"}</h3>
                <p>
                  {todayReward.reward_type === "collector"
                    ? `${todayReward.collector_city || "Papa Cromos"} - Album de Colecionadores`
                    : `#${todayReward.sticker_number || "-"} - ${todayReward.collection_name || "Colecao"}`}
                </p>
                <strong><Trophy size={16} /> +{todayReward.points} pontos</strong>
              </div>
            </article>
          ) : null}
        </div>

        <div className="daily-pack-action-panel">
          <h3>{todayReward ? "Saqueta de hoje aberta" : "A tua saqueta esta pronta"}</h3>
          <p>
            {todayReward
              ? "Volta amanha para abrir outra recompensa virtual."
              : "Cada dia traz um cromo virtual aleatorio e pontos para o teu progresso."}
          </p>
          <button className="btn btn-primary" type="button" onClick={openDailyPack} disabled={opening || Boolean(todayReward)}>
            {todayReward ? "Disponivel amanha" : opening ? "A abrir..." : "Abrir agora"}
          </button>
        </div>
      </section>

      <section className="daily-pack-history">
        <div className="daily-pack-section-title">
          <History size={18} />
          <h3>Historico recente</h3>
        </div>
        <div className="daily-pack-history-list">
          {history.map((row) => (
            <article className="daily-pack-history-row" key={row.id}>
              <img
                src={row.reward_type === "collector" ? row.collector?.avatar_image_url || "/logo.png" : getStickerPreviewImageUrl(row.stickers?.image_url)}
                alt={row.reward_type === "collector" ? row.collector?.username || "Colecionador" : row.stickers?.name || "Cromo virtual"}
                onError={(event) => {
                  event.currentTarget.src = "/logo.png";
                }}
              />
              <div>
                <strong>{row.reward_type === "collector" ? row.collector?.username || "Colecionador" : row.stickers?.name || "Cromo virtual"}</strong>
                <span>
                  {formatPackDate(row.reward_date)} - {row.reward_type === "collector"
                    ? "Album de Colecionadores"
                    : row.stickers?.collections?.name || "Colecao"}
                </span>
              </div>
              <em>+{row.points}</em>
            </article>
          ))}
          {history.length === 0 && <p className="muted-text">Ainda nao abriste nenhuma saqueta.</p>}
        </div>
      </section>
    </div>
  );
}
