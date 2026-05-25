import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { getAvatarColor, getAvatarInitial } from "../lib/avatar";
import { ArrowRightLeft, ChevronDown, MapPin, MessageCircle, Minus, Plus, RefreshCw } from "lucide-react";
import { countUniqueRequestedStickers, findUserMatches, type Match } from "../lib/matches";
import type { DeliveryMethod } from "../lib/trades";

interface MatchesPageProps {
  onMatchesChange?: (count: number) => void;
}

type MatchDetailTab = "suggested" | "offer" | "receive";

interface Partner {
  id: string;
  name: string;
  city: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
}

interface UserLocation {
  latitude: number;
  longitude: number;
}

interface MatchSticker {
  id: string;
  name: string;
  number: number;
  image_url: string;
  rarity: string;
  available_quantity?: number;
}

interface MatchUserGroup {
  otherUserId: string;
  otherUsername: string;
  otherAvatarSeed: string;
  otherCity: string;
  otherRegion: string;
  offeredStickers: MatchSticker[];
  requestedStickers: MatchSticker[];
  matchCount: number;
}

type MatchLocationFilter = "all" | "near";

function normalizeLocation(value: string | null | undefined) {
  return (value || "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

function distanceKm(from: UserLocation, partner: Partner) {
  if (partner.latitude === null || partner.longitude === null) return null;

  const earthRadiusKm = 6371;
  const lat1 = from.latitude * Math.PI / 180;
  const lat2 = Number(partner.latitude) * Math.PI / 180;
  const deltaLat = (Number(partner.latitude) - from.latitude) * Math.PI / 180;
  const deltaLon = (Number(partner.longitude) - from.longitude) * Math.PI / 180;
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function MatchesPage({ onMatchesChange }: MatchesPageProps) {
  const { user, profile } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [proposing, setProposing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sentTradeKeys, setSentTradeKeys] = useState<Set<string>>(new Set());
  const [openUserId, setOpenUserId] = useState<string | null>(null);
  const [offeredQuantities, setOfferedQuantities] = useState<Record<string, number>>({});
  const [requestedQuantities, setRequestedQuantities] = useState<Record<string, number>>({});
  const [deliveryMethods, setDeliveryMethods] = useState<Record<string, DeliveryMethod>>({});
  const [selectedPartners, setSelectedPartners] = useState<Record<string, string>>({});
  const [tradeNotes, setTradeNotes] = useState<Record<string, string>>({});
  const [tradeErrors, setTradeErrors] = useState<Record<string, string>>({});
  const [tradeSuccesses, setTradeSuccesses] = useState<Record<string, string>>({});
  const [activeMatchTabs, setActiveMatchTabs] = useState<Record<string, MatchDetailTab>>({});
  const [locationFilter, setLocationFilter] = useState<MatchLocationFilter>("all");

  useEffect(() => {
    findMatches();
    loadPartners();
  }, [user]);

  const matchGroups = useMemo(() => {
    const groups = new Map<string, MatchUserGroup>();

    matches.forEach((match) => {
      const group = groups.get(match.otherUserId) || {
        otherUserId: match.otherUserId,
        otherUsername: match.otherUsername,
        otherAvatarSeed: match.otherAvatarSeed,
        otherCity: match.otherCity || "",
        otherRegion: match.otherRegion || "",
        offeredStickers: [],
        requestedStickers: [],
        matchCount: 0,
      };

      if (!group.offeredStickers.some((sticker) => sticker.id === match.offeredSticker.id)) {
        group.offeredStickers.push(match.offeredSticker);
      }
      if (!group.requestedStickers.some((sticker) => sticker.id === match.requestedSticker.id)) {
        group.requestedStickers.push(match.requestedSticker);
      }
      group.matchCount += 1;
      groups.set(match.otherUserId, group);
    });

    return Array.from(groups.values()).sort((a, b) => b.matchCount - a.matchCount);
  }, [matches]);

  const currentUserCity = normalizeLocation(profile?.city);
  const currentUserRegion = normalizeLocation(profile?.region);
  const hasOwnLocation = Boolean(currentUserCity || currentUserRegion);
  const isNearMatch = (group: MatchUserGroup) => {
    const otherCity = normalizeLocation(group.otherCity);
    const otherRegion = normalizeLocation(group.otherRegion);
    if (currentUserCity && otherCity && currentUserCity === otherCity) return true;
    if (currentUserRegion && otherRegion && currentUserRegion === otherRegion) return true;
    return false;
  };
  const visibleMatchGroups = locationFilter === "near"
    ? matchGroups.filter(isNearMatch)
    : matchGroups;

  const loadPartners = async () => {
    const { data, error } = await supabase
      .from("partners")
      .select("id, name, city, address, latitude, longitude")
      .eq("active", true)
      .order("city", { ascending: true })
      .order("name", { ascending: true });
    if (!error) setPartners((data || []) as Partner[]);
  };

  const requestLocation = () => {
    if (!navigator.geolocation || userLocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => undefined,
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 }
    );
  };

  const findMatches = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (!user?.id) {
        setMatches([]);
        onMatchesChange?.(0);
        return;
      }

      const matchList = await findUserMatches(user.id);
      setMatches(matchList);
      onMatchesChange?.(countUniqueRequestedStickers(matchList));
      setOpenUserId(null);
      setOfferedQuantities({});
      setRequestedQuantities({});
      setActiveMatchTabs({});
    } catch (err: any) {
      setMatches([]);
      onMatchesChange?.(0);
      setError(err.message || "Erro ao procurar matches.");
    } finally {
      setLoading(false);
    }
  };

  const quantityKey = (userId: string, stickerId: string) => `${userId}:${stickerId}`;

  const updateQuantity = (
    setter: Dispatch<SetStateAction<Record<string, number>>>,
    key: string,
    max: number,
    delta: number,
  ) => {
    setter((current) => {
      const next = Math.min(max, Math.max(0, (current[key] || 0) + delta));
      return { ...current, [key]: next };
    });
  };

  const expandSelectedStickers = (
    group: MatchUserGroup,
    quantities: Record<string, number>,
    stickers: MatchSticker[],
  ) => stickers.flatMap((sticker) => {
    const qty = quantities[quantityKey(group.otherUserId, sticker.id)] || 0;
    return Array.from({ length: qty }, () => sticker);
  });

  const countSuggestedUnits = (stickers: MatchSticker[]) => stickers.length;

  const buildSuggestedQuantities = (group: MatchUserGroup, stickers: MatchSticker[], targetUnits: number) => {
    const next: Record<string, number> = {};
    let remaining = targetUnits;

    stickers.forEach((sticker) => {
      if (remaining <= 0) return;
      const quantity = Math.min(1, remaining);
      if (quantity > 0) {
        next[quantityKey(group.otherUserId, sticker.id)] = quantity;
        remaining -= quantity;
      }
    });

    return next;
  };

  const applySuggestedTrade = (group: MatchUserGroup) => {
    const suggestedCount = Math.min(
      countSuggestedUnits(group.offeredStickers),
      countSuggestedUnits(group.requestedStickers),
    );
    const groupStickerIds = new Set([
      ...group.offeredStickers.map((sticker) => quantityKey(group.otherUserId, sticker.id)),
      ...group.requestedStickers.map((sticker) => quantityKey(group.otherUserId, sticker.id)),
    ]);

    setOfferedQuantities((current) => ({
      ...Object.fromEntries(Object.entries(current).filter(([key]) => !groupStickerIds.has(key))),
      ...buildSuggestedQuantities(group, group.offeredStickers, suggestedCount),
    }));
    setRequestedQuantities((current) => ({
      ...Object.fromEntries(Object.entries(current).filter(([key]) => !groupStickerIds.has(key))),
      ...buildSuggestedQuantities(group, group.requestedStickers, suggestedCount),
    }));
    setActiveMatchTabs((current) => ({ ...current, [group.otherUserId]: "suggested" }));
  };

  const openMatchGroup = (group: MatchUserGroup, isOpen: boolean) => {
    if (isOpen) {
      setOpenUserId(null);
      return;
    }

    setOpenUserId(group.otherUserId);
    applySuggestedTrade(group);
  };

  const proposeUserTrade = async (group: MatchUserGroup) => {
    const tradeKey = group.otherUserId;
    setProposing(tradeKey);
    setError(null);
    setSuccess(null);
    setTradeErrors((current) => ({ ...current, [tradeKey]: "" }));
    setTradeSuccesses((current) => ({ ...current, [tradeKey]: "" }));
    try {
      if (!user?.id) throw new Error("Sessao expirada. Entra novamente.");
      const offeredUnits = expandSelectedStickers(group, offeredQuantities, group.offeredStickers);
      const requestedUnits = expandSelectedStickers(group, requestedQuantities, group.requestedStickers);
      if (offeredUnits.length === 0 || requestedUnits.length === 0) {
        throw new Error("Escolhe os cromos e as quantidades para propor a troca.");
      }

      const deliveryMethod = deliveryMethods[tradeKey] || "presencial";
      const partnerId = selectedPartners[tradeKey] || (deliveryMethod === "outro" && partners.length === 1 ? partners[0].id : "");
      if (deliveryMethod === "outro" && !partnerId) {
        throw new Error("Escolhe um parceiro para esta troca.");
      }
      const databaseDeliveryMethod: DeliveryMethod = deliveryMethod === "outro" ? "presencial" : deliveryMethod;

      const selectedPartner = partners.find((partner) => partner.id === partnerId);
      const baseNote = tradeNotes[tradeKey]?.trim() || "";
      const partnerNote = selectedPartner ? `Parceiro pretendido: ${selectedPartner.name}${selectedPartner.city ? ` (${selectedPartner.city})` : ""}.` : "";
      const tradeCount = Math.max(offeredUnits.length, requestedUnits.length);
      const proposalSummary = `Troca proposta: ${offeredUnits.length} cromo${offeredUnits.length === 1 ? "" : "s"} por ${requestedUnits.length} cromo${requestedUnits.length === 1 ? "" : "s"}.`;
      const payloads = Array.from({ length: tradeCount }, (_, index) => {
        const offeredSticker = offeredUnits[Math.min(index, offeredUnits.length - 1)];
        const requestedSticker = requestedUnits[Math.min(index, requestedUnits.length - 1)];

        return {
          from_user_id: user.id,
          to_user_id: group.otherUserId,
          offered_sticker_id: offeredSticker.id,
          requested_sticker_id: requestedSticker.id,
          delivery_method: databaseDeliveryMethod,
          ...(deliveryMethod === "outro" ? { partner_id: partnerId } : {}),
          note: [
            baseNote,
            proposalSummary,
            deliveryMethod === "outro" ? partnerNote : "",
          ].filter(Boolean).join(" "),
          status: "pending",
        };
      });

      let { error } = await supabase.from("trade_offers").insert(payloads);
      if (error && deliveryMethod === "outro" && error.message?.toLowerCase().includes("partner_id")) {
        const fallbackPayloads = payloads.map((payload) => {
          const fallbackPayload = { ...payload };
          delete (fallbackPayload as any).partner_id;
          return fallbackPayload;
        });
        const fallbackResult = await supabase.from("trade_offers").insert(fallbackPayloads);
        error = fallbackResult.error;
      }
      if (error) {
        throw new Error(error.message || "Erro ao criar proposta de troca.");
      }

      setSentTradeKeys((prev) => new Set(prev).add(tradeKey));
      const successMessage = `${payloads.length} proposta${payloads.length === 1 ? "" : "s"} enviada${payloads.length === 1 ? "" : "s"} para ${group.otherUsername}.`;
      setSuccess(successMessage);
      setTradeSuccesses((current) => ({ ...current, [tradeKey]: successMessage }));
    } catch (err: any) {
      const message = err.message || "Erro ao propor troca.";
      setError(message);
      setTradeErrors((current) => ({ ...current, [tradeKey]: message }));
    } finally {
      setProposing(null);
    }
  };

  if (loading) return <div className="loading">A procurar matches...</div>;

  return (
    <div className="matches-page">
      <div className="matches-header">
        <div>
          <h2>Matches</h2>
          <p>Utilizadores com cromos compativeis com os teus</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={findMatches}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      <div className="matches-filter-bar">
        <div className="delivery-toggle matches-location-filter" role="group" aria-label="Filtro de localizacao">
          <button
            type="button"
            className={`delivery-toggle-btn ${locationFilter === "all" ? "active" : ""}`}
            onClick={() => setLocationFilter("all")}
          >
            Todos
          </button>
          <button
            type="button"
            className={`delivery-toggle-btn ${locationFilter === "near" ? "active" : ""}`}
            onClick={() => setLocationFilter("near")}
            disabled={!hasOwnLocation}
            title={hasOwnLocation ? "Mostrar utilizadores da mesma cidade ou distrito" : "Completa a tua cidade ou distrito no perfil"}
          >
            <MapPin size={14} /> Perto de mim
          </button>
        </div>
        <span>
          {locationFilter === "near"
            ? `${visibleMatchGroups.length} perto de ${profile?.city || profile?.region || "ti"}`
            : `${matchGroups.length} utilizador${matchGroups.length === 1 ? "" : "es"} com matches`}
        </span>
      </div>
      {!hasOwnLocation && (
        <p className="muted-text matches-location-hint">Completa a tua cidade ou distrito no perfil para ativar o filtro perto de mim.</p>
      )}

      {error && <p className="error-text">{error}</p>}
      {success && <p className="success-text">{success}</p>}

      {matches.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">&#x1F50D;</span>
          <h3>Sem matches</h3>
          <p>Adiciona cromos que tens e que procuras para encontrar trocas possiveis</p>
        </div>
      ) : (
        <div className="matches-list">
          {visibleMatchGroups.map((group) => {
            const tradeKey = group.otherUserId;
            const isOpen = openUserId === group.otherUserId;
            const selectedMethod = deliveryMethods[tradeKey] || "presencial";
            const sortedPartners = [...partners].sort((a, b) => {
              const distanceA = userLocation ? distanceKm(userLocation, a) : null;
              const distanceB = userLocation ? distanceKm(userLocation, b) : null;
              if (distanceA !== null && distanceB !== null) return distanceA - distanceB;
              if (distanceA !== null) return -1;
              if (distanceB !== null) return 1;
              return `${a.city} ${a.name}`.localeCompare(`${b.city} ${b.name}`);
            });
            const offeredTotal = group.offeredStickers.reduce((total, sticker) => total + (offeredQuantities[quantityKey(group.otherUserId, sticker.id)] || 0), 0);
            const requestedTotal = group.requestedStickers.reduce((total, sticker) => total + (requestedQuantities[quantityKey(group.otherUserId, sticker.id)] || 0), 0);
            return (
              <div key={group.otherUserId} className="match-user-card">
                <button className="match-user-summary" type="button" onClick={() => openMatchGroup(group, isOpen)}>
                  <div className="match-user-info">
                    <div className="match-avatar" style={{ background: getAvatarColor(group.otherAvatarSeed) }}>
                      {getAvatarInitial(group.otherUsername)}
                    </div>
                    <div>
                      <span className="match-username">{group.otherUsername}</span>
                      <small>{group.matchCount} match{group.matchCount === 1 ? "" : "es"} possiveis</small>
                    </div>
                  </div>
                  <span className="match-location match-location-summary">
                    <MapPin size={12} />
                    {group.otherCity || group.otherRegion || "Localidade nao indicada"}
                  </span>
                  <div className="match-user-counts">
                    <span className="match-count-gives">{group.offeredStickers.length} para entregar</span>
                    <ArrowRightLeft size={15} className="match-count-swap-icon" aria-hidden="true" />
                    <span className="match-count-receives">{group.requestedStickers.length} para receber</span>
                    <ChevronDown size={18} className={isOpen ? "open" : ""} />
                  </div>
                </button>

                {isOpen && (
                  <div className="match-user-panel">
                    <div className="match-detail-tabs" role="tablist" aria-label="Detalhe do match">
                      {[
                        { value: "suggested" as MatchDetailTab, label: "Troca sugerida" },
                        { value: "offer" as MatchDetailTab, label: `Posso dar (${group.offeredStickers.length})` },
                        { value: "receive" as MatchDetailTab, label: `Posso receber (${group.requestedStickers.length})` },
                      ].map((tab) => (
                        <button
                          key={tab.value}
                          type="button"
                          className={`match-detail-tab ${((activeMatchTabs[tradeKey] || "suggested") === tab.value) ? "active" : ""}`}
                          onClick={() => setActiveMatchTabs((current) => ({ ...current, [tradeKey]: tab.value }))}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {(activeMatchTabs[tradeKey] || "suggested") === "suggested" && (
                      <div className="match-suggestion-panel">
                        <div className="match-suggestion-header">
                          <div>
                            <strong>Proposta pronta</strong>
                            <span>Revê as quantidades e envia quando estiver equilibrada.</span>
                          </div>
                          <button className="btn btn-ghost btn-sm" type="button" onClick={() => applySuggestedTrade(group)}>
                            Sugerir outra vez
                          </button>
                        </div>
                        <div className="match-suggestion-grid">
                          <div className="match-suggestion-column gives">
                            <span className="match-label">Tu das</span>
                            <MatchStickerSelectorList
                              group={group}
                              stickers={group.offeredStickers.filter((sticker) => (offeredQuantities[quantityKey(group.otherUserId, sticker.id)] || 0) > 0)}
                              quantities={offeredQuantities}
                              onUpdate={setOfferedQuantities}
                              quantityKey={quantityKey}
                              updateQuantity={updateQuantity}
                              emptyText="Sem cromos selecionados para entregar."
                            />
                          </div>
                          <div className="match-suggestion-swap-icon" aria-hidden="true">
                            <ArrowRightLeft size={18} />
                          </div>
                          <div className="match-suggestion-column receives">
                            <span className="match-label">Tu recebes</span>
                            <MatchStickerSelectorList
                              group={group}
                              stickers={group.requestedStickers.filter((sticker) => (requestedQuantities[quantityKey(group.otherUserId, sticker.id)] || 0) > 0)}
                              quantities={requestedQuantities}
                              onUpdate={setRequestedQuantities}
                              quantityKey={quantityKey}
                              updateQuantity={updateQuantity}
                              emptyText="Sem cromos selecionados para receber."
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {(activeMatchTabs[tradeKey] || "suggested") === "offer" && (
                      <div>
                        <span className="match-label">Minhas repetidas procuradas</span>
                        <MatchStickerSelectorList
                          group={group}
                          stickers={group.offeredStickers}
                          quantities={offeredQuantities}
                          onUpdate={setOfferedQuantities}
                          quantityKey={quantityKey}
                          updateQuantity={updateQuantity}
                        />
                      </div>
                    )}

                    {(activeMatchTabs[tradeKey] || "suggested") === "receive" && (
                      <div>
                        <span className="match-label">Cromos dele que eu procuro</span>
                        <MatchStickerSelectorList
                          group={group}
                          stickers={group.requestedStickers}
                          quantities={requestedQuantities}
                          onUpdate={setRequestedQuantities}
                          quantityKey={quantityKey}
                          updateQuantity={updateQuantity}
                        />
                      </div>
                    )}

                    <div className="match-balance-row">
                      <span>Proponho: <strong>{offeredTotal}</strong></span>
                      <ArrowRightLeft size={16} />
                      <span>Peço: <strong>{requestedTotal}</strong></span>
                    </div>

                    <div className="match-proposal-fields">
                      <div className="delivery-toggle" role="group" aria-label="Metodo de troca">
                        {[
                          { value: "presencial" as DeliveryMethod, label: "Presencial" },
                          { value: "outro" as DeliveryMethod, label: "Parceiro perto de mim" },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={`delivery-toggle-btn ${(deliveryMethods[tradeKey] || "presencial") === option.value ? "active" : ""}`}
                            onClick={() => {
                              setDeliveryMethods((current) => ({
                                ...current,
                                [tradeKey]: option.value,
                              }));
                              if (option.value === "outro") {
                                requestLocation();
                                if (!selectedPartners[tradeKey] && sortedPartners[0]?.id) {
                                  setSelectedPartners((current) => ({
                                    ...current,
                                    [tradeKey]: sortedPartners[0].id,
                                  }));
                                }
                              }
                            }}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <div className="message-textarea-wrap">
                        <MessageCircle size={15} aria-hidden="true" />
                        <textarea
                          value={tradeNotes[tradeKey] || ""}
                          placeholder="Mensagem para negociar..."
                          onChange={(event) =>
                            setTradeNotes((current) => ({
                              ...current,
                              [tradeKey]: event.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>

                    {selectedMethod === "outro" && (
                      <div className="partner-choice-list">
                        {sortedPartners.map((partner) => {
                          const distance = userLocation ? distanceKm(userLocation, partner) : null;
                          return (
                            <button
                              key={partner.id}
                              type="button"
                              className={`partner-choice-btn ${selectedPartners[tradeKey] === partner.id ? "active" : ""}`}
                              onClick={() =>
                                setSelectedPartners((current) => ({
                                  ...current,
                                  [tradeKey]: partner.id,
                                }))
                              }
                            >
                              <strong>{partner.name}</strong>
                              <span>
                                {partner.city || "Sem cidade"}
                                {distance !== null ? ` - ${distance.toFixed(distance < 10 ? 1 : 0)} km` : ""}
                              </span>
                              {partner.address && <em>{partner.address}</em>}
                            </button>
                          );
                        })}
                        {partners.length === 0 && <p className="muted-text">Ainda nao existem parceiros ativos.</p>}
                      </div>
                    )}

                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => proposeUserTrade(group)}
                      disabled={proposing === tradeKey || sentTradeKeys.has(tradeKey)}
                    >
                      <ArrowRightLeft size={14} /> {
                        proposing === tradeKey
                          ? "A enviar..."
                          : sentTradeKeys.has(tradeKey)
                            ? "Proposta enviada"
                            : "Propor troca"
                      }
                    </button>
                    {tradeSuccesses[tradeKey] && <p className="match-inline-success">{tradeSuccesses[tradeKey]}</p>}
                    {tradeErrors[tradeKey] && <p className="match-inline-error">{tradeErrors[tradeKey]}</p>}
                  </div>
                )}
              </div>
            );
          })}
          {visibleMatchGroups.length === 0 && locationFilter === "near" && (
            <div className="empty-state">
              <span className="empty-icon">⌖</span>
              <h3>Sem matches perto de ti</h3>
              <p>Nao ha utilizadores da mesma cidade ou distrito com troca possivel neste momento.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MatchStickerSelectorList({
  group,
  stickers,
  quantities,
  onUpdate,
  quantityKey,
  updateQuantity,
  emptyText = "Sem cromos nesta lista.",
}: {
  group: MatchUserGroup;
  stickers: MatchSticker[];
  quantities: Record<string, number>;
  onUpdate: Dispatch<SetStateAction<Record<string, number>>>;
  quantityKey: (userId: string, stickerId: string) => string;
  updateQuantity: (
    setter: Dispatch<SetStateAction<Record<string, number>>>,
    key: string,
    max: number,
    delta: number,
  ) => void;
  emptyText?: string;
}) {
  if (stickers.length === 0) return <p className="muted-text">{emptyText}</p>;

  return (
    <div className="match-sticker-list">
      {stickers.map((sticker) => {
        const key = quantityKey(group.otherUserId, sticker.id);
        const quantity = quantities[key] || 0;
        const max = sticker.available_quantity || 1;
        return (
          <MatchStickerSelector
            key={sticker.id}
            sticker={sticker}
            quantity={quantity}
            max={max}
            onMinus={() => updateQuantity(onUpdate, key, max, -1)}
            onPlus={() => updateQuantity(onUpdate, key, max, 1)}
          />
        );
      })}
    </div>
  );
}

function MatchStickerSelector({
  sticker,
  quantity,
  max,
  onMinus,
  onPlus,
}: {
  sticker: MatchSticker;
  quantity: number;
  max: number;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <div className={`match-sticker-option ${quantity > 0 ? "selected" : ""}`}>
      <img src={sticker.image_url || "/logo.png"} alt={sticker.name} loading="lazy" />
      <div>
        <strong>{sticker.name}</strong>
        <span>#{String(sticker.number).padStart(3, "0")} Â· disponiveis {max}</span>
      </div>
      <div className="match-quantity-stepper">
        <button type="button" onClick={onMinus} disabled={quantity <= 0}>
          <Minus size={14} />
        </button>
        <strong>{quantity}</strong>
        <button type="button" onClick={onPlus} disabled={quantity >= max}>
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}
