import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import TradeCard from "../components/TradeCard";
import { RefreshCw } from "lucide-react";
import type { DeliveryMethod } from "../lib/trades";
import { flushPushNotificationsInBackground } from "../lib/pushDelivery";
import { flushEmailNotificationsInBackground } from "../lib/emailDelivery";

interface TradesPageProps {
  onPendingTradeCountChange?: (count: number) => void;
  onMessagesChange?: () => void;
  refreshKey?: number;
}

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
  from_status?: string;
  to_username?: string;
  to_avatar_seed?: string;
  to_status?: string;
  offered_sticker: { name: string; number: number; image_url: string; rarity: string };
  requested_sticker: { name: string; number: number; image_url: string; rarity: string };
  messages: TradeMessage[];
}

interface TradeStickerDetails {
  name: string;
  number: number;
  imageUrl: string;
  rarity: string;
}

interface TradeProposalItem {
  id: string;
  offeredSticker: TradeStickerDetails;
  requestedSticker: TradeStickerDetails;
}

interface GroupedTradeWithDetails extends Omit<TradeWithDetails, "id" | "offered_sticker" | "requested_sticker" | "messages"> {
  id: string;
  ids: string[];
  offeredStickers: TradeStickerDetails[];
  requestedStickers: TradeStickerDetails[];
  items: TradeProposalItem[];
  messages: TradeMessage[];
}

interface TradeMessage {
  id: string;
  trade_id: string;
  user_id: string;
  message: string;
  created_at: string;
  is_read?: boolean;
  username?: string;
}

type TradeFilter = "all" | "pending" | "accepted" | "completed" | "rejected";

function proposalKey(trade: TradeWithDetails) {
  return [
    trade.from_user_id,
    trade.to_user_id,
    trade.status,
    trade.delivery_method,
    trade.partner_id || "",
    trade.note || "",
    trade.created_at,
  ].join("|");
}

function groupTradeProposals(trades: TradeWithDetails[]): GroupedTradeWithDetails[] {
  const groups = new Map<string, GroupedTradeWithDetails>();

  trades.forEach((trade) => {
    const key = proposalKey(trade);
    const existing = groups.get(key);
    const offeredSticker = {
      name: trade.offered_sticker.name,
      number: trade.offered_sticker.number,
      imageUrl: trade.offered_sticker.image_url,
      rarity: trade.offered_sticker.rarity,
    };
    const requestedSticker = {
      name: trade.requested_sticker.name,
      number: trade.requested_sticker.number,
      imageUrl: trade.requested_sticker.image_url,
      rarity: trade.requested_sticker.rarity,
    };

    if (!existing) {
      groups.set(key, {
        ...trade,
        id: trade.id,
        ids: [trade.id],
        offeredStickers: [offeredSticker],
        requestedStickers: [requestedSticker],
        items: [{
          id: trade.id,
          offeredSticker,
          requestedSticker,
        }],
        messages: trade.messages,
      });
      return;
    }

    const messageIds = new Set(existing.messages.map((message) => message.id));
    existing.ids.push(trade.id);
    existing.offeredStickers.push(offeredSticker);
    existing.requestedStickers.push(requestedSticker);
    existing.items.push({
      id: trade.id,
      offeredSticker,
      requestedSticker,
    });
    existing.messages = [
      ...existing.messages,
      ...trade.messages.filter((message) => !messageIds.has(message.id)),
    ].sort((a, b) => a.created_at.localeCompare(b.created_at));
  });

  return Array.from(groups.values());
}

export default function TradesPage({ onPendingTradeCountChange, onMessagesChange, refreshKey }: TradesPageProps) {
  const { user, profile } = useAuth();
  const [trades, setTrades] = useState<TradeWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TradeFilter>("pending");
  const [error, setError] = useState<string | null>(null);
  const [openTradeId, setOpenTradeId] = useState<string | null>(null);
  const [openMessageId, setOpenMessageId] = useState<string | null>(null);

  useEffect(() => {
    loadTrades();
  }, [user, refreshKey]);

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

      const profilesById = new Map<string, { username?: string; avatar_seed?: string; status?: string; city?: string }>();
      if (userIds.length) {
        const { data: profiles, error: profilesError } = await supabase
          .from("user_profiles")
          .select("id, username, avatar_seed, status, city")
          .in("id", userIds);
        if (profilesError) throw profilesError;

        (profiles || []).forEach((profile: any) => profilesById.set(profile.id, profile));
      }

      messages.forEach((message) => {
        const profile = profilesById.get(message.user_id);
        const enrichedMessage = {
          ...message,
          username: profile
            ? (profile.username ? (profile.city ? `${profile.username} — ${profile.city}` : profile.username) : (profile.city || undefined))
            : undefined,
        };
        const existing = messagesByTradeId.get(message.trade_id) || [];
        messagesByTradeId.set(message.trade_id, [...existing, enrichedMessage]);
      });

      const enriched = trades.map(t => {
        const fromProfile = profilesById.get(t.from_user_id);
        const toProfile = profilesById.get(t.to_user_id);
        const fromUsername = fromProfile
          ? (fromProfile.username ? (fromProfile.city ? `${fromProfile.username} — ${fromProfile.city}` : fromProfile.username) : (fromProfile.city || undefined))
          : undefined;
        const toUsername = toProfile
          ? (toProfile.username ? (toProfile.city ? `${toProfile.username} — ${toProfile.city}` : toProfile.username) : (toProfile.city || undefined))
          : undefined;

        return {
          ...t,
          from_username: fromUsername,
          from_avatar_seed: fromProfile?.avatar_seed,
          from_status: fromProfile?.status,
          to_username: toUsername,
          to_avatar_seed: toProfile?.avatar_seed,
          to_status: toProfile?.status,
          messages: messagesByTradeId.get(t.id) || [],
        } as TradeWithDetails;
      });
      setTrades(enriched as TradeWithDetails[]);
      // check URL params for openTradeId/openMessageId
      try {
        const params = new URL(window.location.href).searchParams;
        const t = params.get("openTradeId");
        const m = params.get("openMessageId");
        if (t && m) {
          setOpenTradeId(t);
          setOpenMessageId(m);
          // remove params so they don't persist
          params.delete("openTradeId");
          params.delete("openMessageId");
          const url = new URL(window.location.href);
          url.search = params.toString();
          window.history.replaceState({}, "", url.toString());
        }
      } catch (e) {
        // ignore
      }
      onPendingTradeCountChange?.(groupTradeProposals(enriched as TradeWithDetails[]).filter((trade) => trade.status === "pending").length);
    } catch (err: any) {
      setTrades([]);
      onPendingTradeCountChange?.(0);
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

  const updateTradeStatus = async (tradeIds: string | string[], status: string) => {
    const ids = Array.isArray(tradeIds) ? tradeIds : [tradeIds];
    const updates: Record<string, any> = { status, updated_at: new Date().toISOString() };
    const existingTrade = trades.find((trade) => trade.id === ids[0]);

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

    const { error } = await supabase.from("trade_offers").update(updates).in("id", ids);
    if (error) {
      setError(error.message || "Erro ao atualizar troca.");
      return;
    }

    if (status === "accepted" && updates.partner_id) {
      await supabase.from("trade_messages").insert({
        trade_id: ids[0],
        user_id: user?.id,
        message: "Troca aceite. O sistema atribuiu um parceiro para entrega e recolha dos cromos.",
      });
    }

    flushPushNotificationsInBackground();
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
    flushPushNotificationsInBackground();
    flushEmailNotificationsInBackground();
    await loadTrades();
    onMessagesChange?.();
  };

  const toggleTradeReadStatus = async (tradeIds: string | string[], read: boolean) => {
    if (!user?.id) return;
    const ids = Array.isArray(tradeIds) ? tradeIds : [tradeIds];
    const { error } = await supabase
      .from("trade_messages")
      .update({ is_read: read })
      .in("trade_id", ids)
      .neq("user_id", user.id);
    if (error) {
      setError(error.message || "Erro ao atualizar estado da mensagem.");
      return;
    }
    await loadTrades();
    onMessagesChange?.();
  };

  const groupedTrades = groupTradeProposals(trades);
  const filteredTrades = groupedTrades.filter((t) => filter === "all" || t.status === filter);
  const pendingCount = groupedTrades.filter((t) => t.status === "pending").length;

  // clear open ids once used
  useEffect(() => {
    if (openTradeId && openMessageId) {
      // after giving to TradeCard, clear so repeated renders don't re-open
      setOpenTradeId(null);
      setOpenMessageId(null);
    }
  }, [trades]);

  if (loading) return <div className="loading">A carregar trocas...</div>;

  return (
    <div className="trades-page">
      <div className="trades-header">
        <div>
          <h2>Trocas</h2>
          <p>{pendingCount > 0 ? `Tens ${pendingCount} proposta(s) pendente(s)` : "Sem propostas pendentes"}</p>
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
          {filteredTrades.map((trade) => {
            const unreadCount = trade.messages.filter((message) => message.user_id !== user?.id && !message.is_read).length;
            return (
              <TradeCard
                key={trade.id}
                id={trade.id}
                ids={trade.ids}
                offeredStickers={trade.offeredStickers}
                requestedStickers={trade.requestedStickers}
                proposalItems={trade.items}
                fromUser={trade.from_user_id === user?.id ? trade.to_user_id : trade.from_user_id}
                fromUsername={trade.from_user_id === user?.id ? trade.to_username : trade.from_username}
                fromAvatarSeed={trade.from_user_id === user?.id ? trade.to_avatar_seed : trade.from_avatar_seed}
                fromStatus={trade.from_user_id === user?.id ? trade.to_status : trade.from_status}
                status={trade.status}
                isIncoming={trade.to_user_id === user?.id}
                currentUserId={user?.id}
                deliveryMethod={trade.delivery_method}
                note={trade.note}
                messages={trade.messages}
                unreadCount={unreadCount}
                onToggleReadStatus={toggleTradeReadStatus}
                onAccept={(id) => updateTradeStatus(id, "accepted")}
                onReject={(id) => updateTradeStatus(id, "rejected")}
                onCancel={(id) => updateTradeStatus(id, "rejected")}
                onComplete={(id) => updateTradeStatus(id, "completed")}
                onSendMessage={sendTradeMessage}
                openModal={openTradeId === trade.id && Boolean(openMessageId)}
                openMessageId={openTradeId === trade.id ? openMessageId : null}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
