import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import TradeCard from "../components/TradeCard";
import { RefreshCw } from "lucide-react";
import type { DeliveryMethod } from "../lib/trades";

interface TradeWithDetails {
  id: string;
  from_user_id: string;
  to_user_id: string;
  offered_sticker_id: string;
  requested_sticker_id: string;
  status: string;
  partner_id?: string | null;
  logistics_status?: string;
  delivery_method: DeliveryMethod;
  note: string;
  created_at: string;
  from_username?: string;
  from_avatar_seed?: string;
  to_username?: string;
  to_avatar_seed?: string;
  offered_sticker: { name: string; number: number; image_url: string; rarity: string };
  requested_sticker: { name: string; number: number; image_url: string; rarity: string };
  messages: TradeMessage[];
}

interface TradeMessage {
  id: string;
  trade_id: string;
  user_id: string;
  message: string;
  created_at: string;
  username?: string;
}

type TradeFilter = "all" | "pending" | "accepted" | "completed" | "rejected";

export default function TradesPage() {
  const { user, profile } = useAuth();
  const [trades, setTrades] = useState<TradeWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TradeFilter>("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTrades();
  }, [user]);

  const loadTrades = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!user?.id) {
        setTrades([]);
        return;
      }

      const { data, error: tradesError } = await supabase
        .from("trade_offers")
        .select("*, offered_sticker:stickers!trade_offers_offered_sticker_id_fkey(name, number, image_url, rarity), requested_sticker:stickers!trade_offers_requested_sticker_id_fkey(name, number, image_url, rarity)")
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
        .order("created_at", { ascending: false });
      if (tradesError) throw tradesError;

      const trades = (data as any[]) || [];
      const tradeIds = trades.map((trade) => trade.id);
      const messagesByTradeId = new Map<string, TradeMessage[]>();
      let messages: TradeMessage[] = [];
      if (tradeIds.length) {
        const { data: messageRows, error: messagesError } = await supabase
          .from("trade_messages")
          .select("*")
          .in("trade_id", tradeIds)
          .order("created_at", { ascending: true });
        if (messagesError) throw messagesError;
        messages = (messageRows as TradeMessage[]) || [];
      }

      const userIds = Array.from(new Set([
        ...trades.flatMap((trade) => [trade.from_user_id, trade.to_user_id]),
        ...messages.map((message) => message.user_id),
      ]));

      const profilesById = new Map<string, { username?: string; avatar_seed?: string }>();
      if (userIds.length) {
        const { data: profiles, error: profilesError } = await supabase
          .from("user_profiles")
          .select("id, username, avatar_seed")
          .in("id", userIds);
        if (profilesError) throw profilesError;

        (profiles || []).forEach((profile: any) => profilesById.set(profile.id, profile));
      }

      messages.forEach((message) => {
        const enrichedMessage = {
          ...message,
          username: profilesById.get(message.user_id)?.username,
        };
        const existing = messagesByTradeId.get(message.trade_id) || [];
        messagesByTradeId.set(message.trade_id, [...existing, enrichedMessage]);
      });

      const enriched = trades.map(t => ({
        ...t,
        from_username: profilesById.get(t.from_user_id)?.username,
        from_avatar_seed: profilesById.get(t.from_user_id)?.avatar_seed,
        to_username: profilesById.get(t.to_user_id)?.username,
        to_avatar_seed: profilesById.get(t.to_user_id)?.avatar_seed,
        messages: messagesByTradeId.get(t.id) || [],
      }));
      setTrades(enriched as TradeWithDetails[]);
    } catch (err: any) {
      setTrades([]);
      setError(err.message || "Erro ao carregar trocas.");
    } finally {
      setLoading(false);
    }
  };

  const findNearestPartner = async () => {
    const { data, error } = await supabase
      .from("partners")
      .select("id, name, city, address")
      .eq("active", true)
      .order("city", { ascending: true })
      .order("name", { ascending: true });
    if (error) return null;

    const partners = data || [];
    const userCity = profile?.city?.trim().toLowerCase();
    return partners.find((partner: any) => userCity && partner.city?.trim().toLowerCase() === userCity) || partners[0] || null;
  };

  const updateTradeStatus = async (tradeId: string, status: string) => {
    const updates: Record<string, any> = { status, updated_at: new Date().toISOString() };
    const existingTrade = trades.find((trade) => trade.id === tradeId);

    if (status === "accepted") {
      if (existingTrade?.partner_id) {
        updates.logistics_status = "awaiting_deliveries";
      } else {
        const partner = await findNearestPartner();
        if (partner?.id) {
          updates.partner_id = partner.id;
          updates.logistics_status = "awaiting_deliveries";
        }
      }
    }

    const { error } = await supabase.from("trade_offers").update(updates).eq("id", tradeId);
    if (error) {
      setError(error.message || "Erro ao atualizar troca.");
      return;
    }

    if (status === "accepted" && updates.partner_id) {
      await supabase.from("trade_messages").insert({
        trade_id: tradeId,
        user_id: user?.id,
        message: "Troca aceite. O sistema atribuiu um parceiro para entrega e recolha dos cromos.",
      });
    }

    await loadTrades();
  };

  const sendTradeMessage = async (tradeId: string, message: string) => {
    if (!user?.id) {
      setError("Sessao expirada. Entra novamente.");
      return;
    }

    const { error } = await supabase.from("trade_messages").insert({
      trade_id: tradeId,
      user_id: user.id,
      message,
    });
    if (error) {
      setError(error.message || "Erro ao enviar mensagem.");
      return;
    }
    await loadTrades();
  };

  const filteredTrades = trades.filter((t) => filter === "all" || t.status === filter);
  const incomingCount = trades.filter((t) => t.to_user_id === user?.id && t.status === "pending").length;

  if (loading) return <div className="loading">A carregar trocas...</div>;

  return (
    <div className="trades-page">
      <div className="trades-header">
        <div>
          <h2>Trocas</h2>
          <p>{incomingCount > 0 ? `Tens ${incomingCount} proposta(s) pendente(s)` : "Sem propostas pendentes"}</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={loadTrades}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      <div className="filter-group">
        {(["all", "pending", "accepted", "completed", "rejected"] as TradeFilter[]).map((f) => (
          <button
            key={f}
            className={`filter-btn ${filter === f ? "active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "Todas" : f === "pending" ? "Pendentes" : f === "accepted" ? "Aceites" : f === "completed" ? "Concluidas" : "Anuladas"}
          </button>
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}

      {filteredTrades.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">&#x1F91D;</span>
          <h3>Sem trocas</h3>
          <p>Encontra matches e propoe trocas para comecar</p>
        </div>
      ) : (
        <div className="trades-list">
          {filteredTrades.map((trade) => (
            <TradeCard
              key={trade.id}
              id={trade.id}
              offeredSticker={{
                name: trade.offered_sticker.name,
                number: trade.offered_sticker.number,
                imageUrl: trade.offered_sticker.image_url,
                rarity: trade.offered_sticker.rarity,
              }}
              requestedSticker={{
                name: trade.requested_sticker.name,
                number: trade.requested_sticker.number,
                imageUrl: trade.requested_sticker.image_url,
                rarity: trade.requested_sticker.rarity,
              }}
              fromUser={trade.from_user_id === user?.id ? trade.to_user_id : trade.from_user_id}
              fromUsername={trade.from_user_id === user?.id ? trade.to_username : trade.from_username}
              fromAvatarSeed={trade.from_user_id === user?.id ? trade.to_avatar_seed : trade.from_avatar_seed}
              status={trade.status}
              isIncoming={trade.to_user_id === user?.id}
              currentUserId={user?.id}
              deliveryMethod={trade.delivery_method}
              note={trade.note}
              messages={trade.messages}
              onAccept={(id) => updateTradeStatus(id, "accepted")}
              onReject={(id) => updateTradeStatus(id, "rejected")}
              onCancel={(id) => updateTradeStatus(id, "rejected")}
              onComplete={(id) => updateTradeStatus(id, "completed")}
              onSendMessage={sendTradeMessage}
            />
          ))}
        </div>
      )}
    </div>
  );
}
