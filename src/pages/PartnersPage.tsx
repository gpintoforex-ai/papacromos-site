import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Ban, Check, ChevronDown, MapPin, Pencil, Plus, QrCode, RefreshCw, Trash2, UserPlus, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

interface Partner {
  id: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  latitude: number | string | null;
  longitude: number | string | null;
  active: boolean;
}

interface PartnerAccess {
  partner_id: string;
  partner?: Partner;
}

interface PartnerStaffMember {
  partner_id: string;
  user_id: string;
  profile?: RegisteredUser;
}

interface RegisteredUser {
  id: string;
  username: string;
  email: string | null;
  city: string | null;
  phone: string | null;
}

interface LocationSearchResult {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    road?: string;
    house_number?: string;
  };
}

interface PartnerTrade {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: string;
  logistics_status: string;
  partner_id: string | null;
  from_user_delivered_at: string | null;
  to_user_delivered_at: string | null;
  from_user_collected_at: string | null;
  to_user_collected_at: string | null;
  offered_sticker: { name: string; number: number };
  requested_sticker: { name: string; number: number };
  partner?: Partner;
  from_username?: string;
  to_username?: string;
}

const emptyPartner = {
  name: "",
  city: "",
  address: "",
  phone: "",
  latitude: "",
  longitude: "",
};

const cityCoordinates: Record<string, { latitude: number; longitude: number }> = {
  lisboa: { latitude: 38.7223, longitude: -9.1393 },
  lisbon: { latitude: 38.7223, longitude: -9.1393 },
  pombal: { latitude: 39.9167, longitude: -8.6285 },
  leiria: { latitude: 39.7436, longitude: -8.8071 },
  porto: { latitude: 41.1579, longitude: -8.6291 },
  coimbra: { latitude: 40.2033, longitude: -8.4103 },
  aveiro: { latitude: 40.6405, longitude: -8.6538 },
  braga: { latitude: 41.5454, longitude: -8.4265 },
  faro: { latitude: 37.0194, longitude: -7.9304 },
  setubal: { latitude: 38.5244, longitude: -8.8882 },
};

function parseCoordinate(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function getPartnerCoordinates(partner: Partner) {
  const latitude = parseCoordinate(partner.latitude);
  const longitude = parseCoordinate(partner.longitude);
  if (latitude !== null && longitude !== null) return { latitude, longitude };
  return cityCoordinates[partner.city.trim().toLowerCase()] || null;
}

const partnerLeafletIcon = L.divIcon({
  className: "partner-leaflet-marker",
  html: '<span></span>',
  iconSize: [22, 32],
  iconAnchor: [11, 32],
  popupAnchor: [0, -30],
});

const selectedPartnerLeafletIcon = L.divIcon({
  className: "partner-leaflet-marker selected",
  html: '<span></span>',
  iconSize: [30, 42],
  iconAnchor: [15, 42],
  popupAnchor: [0, -38],
});

function qrUrl(data: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=10&data=${encodeURIComponent(data)}`;
}

function tradeCode(tradeId: string, userId: string) {
  return `papacromos:trade:${tradeId}:user:${userId}`;
}

function partnerCode(partnerId: string) {
  return `papacromos:partner:${partnerId}`;
}

function parseTradeCode(code: string) {
  const match = code.trim().match(/^papacromos:trade:([^:]+):user:([^:]+)$/);
  if (!match) return null;
  return { tradeId: match[1], userId: match[2] };
}

export default function PartnersPage() {
  const { user, profile } = useAuth();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [access, setAccess] = useState<PartnerAccess[]>([]);
  const [partnerStaff, setPartnerStaff] = useState<PartnerStaffMember[]>([]);
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [trades, setTrades] = useState<PartnerTrade[]>([]);
  const [draft, setDraft] = useState(emptyPartner);
  const [editingPartnerId, setEditingPartnerId] = useState<string | null>(null);
  const [staffPartnerId, setStaffPartnerId] = useState("");
  const [staffUserId, setStaffUserId] = useState("");
  const [staffUserSearch, setStaffUserSearch] = useState("");
  const [staffPickerOpen, setStaffPickerOpen] = useState(false);
  const [partnerFilter, setPartnerFilter] = useState("");
  const [openPartnerRegions, setOpenPartnerRegions] = useState<Record<string, boolean>>({});
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [locationSearch, setLocationSearch] = useState("");
  const [locationResults, setLocationResults] = useState<LocationSearchResult[]>([]);
  const [locationSearching, setLocationSearching] = useState(false);
  const [scanCode, setScanCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isAdmin = Boolean(profile?.is_admin);
  const partnerIds = useMemo(() => access.map((row) => row.partner_id), [access]);
  const operationalTrades = trades.filter((trade) => trade.partner_id && partnerIds.includes(trade.partner_id));
  const myTrades = trades.filter((trade) => trade.from_user_id === user?.id || trade.to_user_id === user?.id);
  const partnerNames = access
    .map((row) => row.partner?.name)
    .filter(Boolean)
    .join(", ");
  const selectedStaffUser = users.find((registeredUser) => registeredUser.id === staffUserId);
  const partnerMapPoints = useMemo(() => partners
    .map((partner) => {
      const coordinates = getPartnerCoordinates(partner);
      return coordinates ? { partner, ...coordinates } : null;
    })
    .filter(Boolean) as Array<{ partner: Partner; latitude: number; longitude: number }>, [partners]);
  const filteredPartners = useMemo(() => {
    const search = partnerFilter.trim().toLowerCase();
    if (!search) return partners;

    return partners.filter((partner) => [
      partner.name,
      partner.city,
      partner.address,
      partner.phone,
    ].some((value) => value?.toLowerCase().includes(search)));
  }, [partnerFilter, partners]);
  const partnersByRegion = useMemo(() => {
    const groups = new Map<string, Partner[]>();
    filteredPartners.forEach((partner) => {
      const region = partner.city?.trim() || "Sem regiao";
      const key = region.toLowerCase();
      const group = groups.get(key) || [];
      group.push(partner);
      groups.set(key, group);
    });

    return Array.from(groups.entries())
      .map(([key, rows]) => ({
        key,
        name: rows[0]?.city?.trim() || "Sem regiao",
        partners: rows.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredPartners]);
  const filteredUsers = useMemo(() => {
    const search = staffUserSearch.trim().toLowerCase();
    if (!search) return [];

    return users
      .filter((registeredUser) => {
        if (!search) return true;
        return [
          registeredUser.username,
          registeredUser.email,
          registeredUser.city,
          registeredUser.phone,
        ].some((value) => value?.toLowerCase().includes(search));
      })
      .slice(0, 8);
  }, [staffUserSearch, users]);

  useEffect(() => {
    loadData();
  }, [user, profile?.is_admin]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: partnerRows, error: partnersError } = await supabase
        .from("partners")
        .select("*")
        .order("city", { ascending: true })
        .order("name", { ascending: true });
      if (partnersError) throw partnersError;
      setPartners((partnerRows || []) as Partner[]);

      if (isAdmin) {
        const [usersRes, staffRes] = await Promise.all([
          supabase
            .from("user_profiles")
            .select("id, username, email, city, phone")
            .order("username", { ascending: true }),
          supabase
            .from("partner_staff")
            .select("partner_id, user_id")
            .order("created_at", { ascending: false }),
        ]);
        if (usersRes.error) throw usersRes.error;
        if (staffRes.error) throw staffRes.error;
        const registeredUsers = (usersRes.data || []) as RegisteredUser[];
        const usersById = new Map(registeredUsers.map((registeredUser) => [registeredUser.id, registeredUser]));
        setUsers(registeredUsers);
        setPartnerStaff(((staffRes.data || []) as any[]).map((row) => ({
          partner_id: row.partner_id,
          user_id: row.user_id,
          profile: usersById.get(row.user_id),
        })));
      } else {
        setUsers([]);
        setPartnerStaff([]);
      }

      let accessRows: PartnerAccess[] = [];
      if (user?.id) {
        const { data, error: accessError } = await supabase
          .from("partner_staff")
          .select("partner_id, partner:partners(*)")
          .eq("user_id", user.id);
        if (accessError) throw accessError;
        accessRows = ((data || []) as any[]).map((row) => ({
          partner_id: row.partner_id,
          partner: Array.isArray(row.partner) ? row.partner[0] : row.partner,
        }));
        setAccess(accessRows);
      }

      await loadTrades(accessRows.map((row) => row.partner_id));
    } catch (err: any) {
      setError(err.message || "Erro ao carregar parceiros.");
    } finally {
      setLoading(false);
    }
  };

  const loadTrades = async (currentPartnerIds = partnerIds) => {
    if (!user?.id) {
      setTrades([]);
      return;
    }

    let query = supabase
      .from("trade_offers")
      .select("*, partner:partners(*), offered_sticker:stickers!trade_offers_offered_sticker_id_fkey(name, number), requested_sticker:stickers!trade_offers_requested_sticker_id_fkey(name, number)")
      .not("partner_id", "is", null)
      .order("updated_at", { ascending: false });

    if (!isAdmin && currentPartnerIds.length === 0) {
      query = query.or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`);
    }

    const { data, error: tradesError } = await query;
    if (tradesError) throw tradesError;

    const rows = ((data || []) as any[]) as PartnerTrade[];
    const userIds = Array.from(new Set(rows.flatMap((trade) => [trade.from_user_id, trade.to_user_id])));
    const profilesById = new Map<string, { username?: string }>();
    if (userIds.length) {
      const { data: profiles, error: profilesError } = await supabase
        .from("user_profiles")
        .select("id, username")
        .in("id", userIds);
      if (profilesError) throw profilesError;
      (profiles || []).forEach((profileRow: any) => profilesById.set(profileRow.id, profileRow));
    }

    setTrades(rows.map((trade) => ({
      ...trade,
      partner: Array.isArray((trade as any).partner) ? (trade as any).partner[0] : (trade as any).partner,
      from_username: profilesById.get(trade.from_user_id)?.username,
      to_username: profilesById.get(trade.to_user_id)?.username,
    })));
  };

  const createPartner = async () => {
    if (editingPartnerId) {
      await savePartner();
      return;
    }

    if (!isAdmin) return;
    const name = draft.name.trim();
    const city = draft.city.trim();
    if (!name || !city) {
      setError("Indica pelo menos o nome e a cidade do parceiro.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const latitude = parseCoordinate(draft.latitude);
      const longitude = parseCoordinate(draft.longitude);
      const { error: insertError } = await supabase.from("partners").insert({
        name,
        city,
        address: draft.address.trim(),
        phone: draft.phone.trim(),
        latitude,
        longitude,
      });
      if (insertError) throw insertError;
      setDraft(emptyPartner);
      setSuccess("Parceiro criado.");
      await loadData();
    } catch (err: any) {
      setError(err.message || "Erro ao criar parceiro.");
    } finally {
      setSaving(false);
    }
  };

  const startEditingPartner = (partner: Partner) => {
    setEditingPartnerId(partner.id);
    setDraft({
      name: partner.name || "",
      city: partner.city || "",
      address: partner.address || "",
      phone: partner.phone || "",
      latitude: partner.latitude !== null && partner.latitude !== undefined ? String(partner.latitude) : "",
      longitude: partner.longitude !== null && partner.longitude !== undefined ? String(partner.longitude) : "",
    });
    setError(null);
    setSuccess(null);
  };

  const cancelEditingPartner = () => {
    setEditingPartnerId(null);
    setDraft(emptyPartner);
    setError(null);
    setSuccess(null);
  };

  const savePartner = async () => {
    if (!isAdmin || !editingPartnerId) return;
    const name = draft.name.trim();
    const city = draft.city.trim();
    if (!name || !city) {
      setError("Indica pelo menos o nome e a cidade do parceiro.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const latitude = parseCoordinate(draft.latitude);
      const longitude = parseCoordinate(draft.longitude);
      const { error: updateError } = await supabase
        .from("partners")
        .update({
          name,
          city,
          address: draft.address.trim(),
          phone: draft.phone.trim(),
          latitude,
          longitude,
        })
        .eq("id", editingPartnerId);
      if (updateError) throw updateError;

      setEditingPartnerId(null);
      setDraft(emptyPartner);
      setSuccess("Parceiro atualizado.");
      await loadData();
    } catch (err: any) {
      setError(err.message || "Erro ao atualizar parceiro.");
    } finally {
      setSaving(false);
    }
  };

  const searchPartnerLocation = async () => {
    const query = (locationSearch || `${draft.name} ${draft.address} ${draft.city}`).trim();
    if (!query) {
      setError("Indica uma loja, morada ou cidade para pesquisar.");
      return;
    }

    setLocationSearching(true);
    setError(null);
    setSuccess(null);
    try {
      const params = new URLSearchParams({
        format: "json",
        addressdetails: "1",
        limit: "6",
        countrycodes: "pt",
        q: query,
      });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`);
      if (!response.ok) throw new Error("Erro ao pesquisar localizacao.");
      const results = (await response.json()) as LocationSearchResult[];
      setLocationResults(results);
      if (results.length === 0) setError("Sem resultados para essa pesquisa.");
    } catch (err: any) {
      setError(err.message || "Erro ao pesquisar localizacao.");
    } finally {
      setLocationSearching(false);
    }
  };

  const applyLocationResult = (result: LocationSearchResult) => {
    const city =
      result.address?.city ||
      result.address?.town ||
      result.address?.village ||
      result.address?.municipality ||
      result.address?.county ||
      draft.city;
    const road = [result.address?.road, result.address?.house_number].filter(Boolean).join(", ");

    setDraft((prev) => ({
      ...prev,
      address: road || result.display_name,
      city,
      latitude: result.lat,
      longitude: result.lon,
    }));
    setLocationSearch(result.display_name);
    setLocationResults([]);
    setSuccess("Localizacao aplicada ao parceiro.");
  };

  const togglePartnerBlocked = async (partner: Partner) => {
    if (!isAdmin) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { error: updateError } = await supabase
        .from("partners")
        .update({ active: !partner.active })
        .eq("id", partner.id);
      if (updateError) throw updateError;

      setSuccess(partner.active ? "Parceiro bloqueado." : "Parceiro ativado.");
      await loadData();
    } catch (err: any) {
      setError(err.message || "Erro ao atualizar estado do parceiro.");
    } finally {
      setSaving(false);
    }
  };

  const removePartner = async (partner: Partner) => {
    if (!isAdmin) return;
    const confirmed = window.confirm(`Remover o parceiro "${partner.name}"?`);
    if (!confirmed) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { error: deleteError } = await supabase
        .from("partners")
        .delete()
        .eq("id", partner.id);
      if (deleteError) throw deleteError;

      if (editingPartnerId === partner.id) {
        cancelEditingPartner();
      }
      setSuccess("Parceiro removido.");
      await loadData();
    } catch (err: any) {
      setError(err.message || "Erro ao remover parceiro.");
    } finally {
      setSaving(false);
    }
  };

  const togglePartnerRegion = (regionKey: string) => {
    setOpenPartnerRegions((prev) => ({
      ...prev,
      [regionKey]: !(prev[regionKey] ?? true),
    }));
  };

  const addStaff = async () => {
    if (!isAdmin || !staffPartnerId || !staffUserId) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { error: staffError } = await supabase.from("partner_staff").upsert({
        partner_id: staffPartnerId,
        user_id: staffUserId,
      });
      if (staffError) throw staffError;
      setStaffUserId("");
      setStaffUserSearch("");
      setStaffPickerOpen(false);
      setSuccess("Utilizador associado ao parceiro.");
      await loadData();
    } catch (err: any) {
      setError(err.message || "Erro ao associar parceiro.");
    } finally {
      setSaving(false);
    }
  };

  const recordDeliveryFromCode = async () => {
    const parsed = parseTradeCode(scanCode);
    if (!parsed) {
      setError("Codigo invalido. Usa o codigo QR da troca apresentado ao utilizador.");
      return;
    }

    const trade = operationalTrades.find((item) => item.id === parsed.tradeId);
    if (!trade || !trade.partner_id) {
      setError("Esta troca nao esta atribuida a este parceiro.");
      return;
    }
    await recordTradeEvent(trade, parsed.userId, "delivered");
    setScanCode("");
  };

  const recordTradeEvent = async (trade: PartnerTrade, targetUserId: string, eventType: "delivered" | "collected") => {
    if (!user?.id || !trade.partner_id) return;
    if (targetUserId !== trade.from_user_id && targetUserId !== trade.to_user_id) {
      setError("O utilizador nao pertence a esta troca.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const isFromUser = targetUserId === trade.from_user_id;
      const updates: Record<string, string> = { updated_at: new Date().toISOString() };

      if (eventType === "delivered") {
        updates[isFromUser ? "from_user_delivered_at" : "to_user_delivered_at"] = new Date().toISOString();
        if ((isFromUser && trade.to_user_delivered_at) || (!isFromUser && trade.from_user_delivered_at)) {
          updates.logistics_status = "ready_for_pickup";
        }
      } else {
        updates[isFromUser ? "from_user_collected_at" : "to_user_collected_at"] = new Date().toISOString();
        if ((isFromUser && trade.to_user_collected_at) || (!isFromUser && trade.from_user_collected_at)) {
          updates.logistics_status = "completed";
          updates.status = "completed";
        }
      }

      const { error: updateError } = await supabase.from("trade_offers").update(updates).eq("id", trade.id);
      if (updateError) throw updateError;

      const { error: eventError } = await supabase.from("trade_partner_events").insert({
        trade_id: trade.id,
        partner_id: trade.partner_id,
        user_id: targetUserId,
        event_type: eventType,
        created_by: user.id,
      });
      if (eventError) throw eventError;

      const username = targetUserId === trade.from_user_id ? trade.from_username : trade.to_username;
      const message =
        eventType === "delivered"
          ? `${username || "Utilizador"} entregou os cromos no parceiro ${trade.partner?.name || ""}.`
          : `${username || "Utilizador"} recolheu os cromos no parceiro ${trade.partner?.name || ""}.`;
      await supabase.from("trade_messages").insert({ trade_id: trade.id, user_id: user.id, message });

      setSuccess(eventType === "delivered" ? "Entrega registada." : "Recolha registada.");
      await loadTrades();
    } catch (err: any) {
      setError(err.message || "Erro ao registar movimento.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading">A carregar parceiros...</div>;

  return (
    <div className="partners-page">
      <div className="partners-header">
        <div>
          <h2>Parceiros</h2>
          <p>Pontos de entrega e recolha para trocas de cromos.</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={loadData}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}
      {success && <p className="success-text">{success}</p>}

      <section className="partners-grid">
        <div className="partner-panel">
          <div className="admin-panel-title">
            <MapPin size={18} />
            <h3>Pontos disponiveis</h3>
          </div>
          <div className="partner-map">
            <PartnerLeafletMap points={partnerMapPoints} selectedPartnerId={selectedPartnerId} />
            {partnerMapPoints.length === 0 && (
              <div className="partner-map-empty">
                Adiciona latitude e longitude nos parceiros para os ver no mapa.
              </div>
            )}
          </div>
          <div className="partner-filter">
            <input
              placeholder="Filtrar por parceiro, regiao, morada ou telefone"
              value={partnerFilter}
              onChange={(e) => setPartnerFilter(e.target.value)}
            />
          </div>
          <div className="partner-list">
            {partnersByRegion.map((region) => {
              const isOpen = openPartnerRegions[region.key] ?? false;

              return (
                <section className="partner-region" key={region.key}>
                  <button className="partner-region-header" type="button" onClick={() => togglePartnerRegion(region.key)}>
                    <span>
                      <strong>{region.name}</strong>
                      <em>{region.partners.length} parceiro{region.partners.length === 1 ? "" : "s"}</em>
                    </span>
                    <ChevronDown size={18} className={isOpen ? "open" : ""} />
                  </button>
                  {isOpen && (
                    <div className="partner-region-body">
                      {region.partners.map((partner) => (
                        <article
                          className={`partner-card ${selectedPartnerId === partner.id ? "selected" : ""}`}
                          key={partner.id}
                          onClick={() => setSelectedPartnerId(partner.id)}
                        >
                          <div className="partner-card-header">
                            <div>
                              <strong>{partner.name}</strong>
                              <span>{partner.city}</span>
                            </div>
                            {isAdmin && (
                              <div className="partner-card-actions">
                                <button className="btn btn-ghost btn-xs" type="button" onClick={() => startEditingPartner(partner)} disabled={saving}>
                                  <Pencil size={12} /> Editar
                                </button>
                                <button className="btn btn-ghost btn-xs" type="button" onClick={() => togglePartnerBlocked(partner)} disabled={saving}>
                                  <Ban size={12} /> {partner.active ? "Bloquear" : "Ativar"}
                                </button>
                                <button className="btn btn-danger-soft btn-xs" type="button" onClick={() => removePartner(partner)} disabled={saving}>
                                  <Trash2 size={12} /> Remover
                                </button>
                              </div>
                            )}
                          </div>
                          <p>{partner.address || "Morada por definir"}</p>
                          {partner.phone && <em>{partner.phone}</em>}
                          {isAdmin && (
                            <div className="partner-staff-list">
                              <strong>Utilizadores associados</strong>
                              {partnerStaff.filter((staff) => staff.partner_id === partner.id).map((staff) => (
                                <span key={`${staff.partner_id}:${staff.user_id}`}>
                                  {staff.profile?.username || "Utilizador"} - {staff.profile?.email || "sem email"}
                                </span>
                              ))}
                              {partnerStaff.filter((staff) => staff.partner_id === partner.id).length === 0 && (
                                <span>Sem utilizadores associados</span>
                              )}
                            </div>
                          )}
                          <div className="partner-qr">
                            <img src={qrUrl(partnerCode(partner.id))} alt={`QR do parceiro ${partner.name}`} />
                            <code>{partnerCode(partner.id)}</code>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
            {partners.length === 0 && <p className="muted-text">Ainda nao existem parceiros ativos.</p>}
            {partners.length > 0 && filteredPartners.length === 0 && <p className="muted-text">Sem parceiros para esse filtro.</p>}
          </div>
        </div>

        {isAdmin && (
          <div className="partner-panel">
            <div className="admin-panel-title">
              {editingPartnerId ? <Pencil size={18} /> : <Plus size={18} />}
              <h3>{editingPartnerId ? "Editar parceiro" : "Adicionar parceiro"}</h3>
            </div>
            <div className="admin-form">
              <input placeholder="Nome do parceiro" value={draft.name} onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))} />
              <div className="partner-location-search">
                <input
                  placeholder="Pesquisar loja ou morada"
                  value={locationSearch}
                  onChange={(e) => setLocationSearch(e.target.value)}
                />
                <button className="btn btn-ghost" type="button" onClick={searchPartnerLocation} disabled={locationSearching}>
                  <MapPin size={16} /> {locationSearching ? "A pesquisar..." : "Procurar"}
                </button>
              </div>
              {locationResults.length > 0 && (
                <div className="partner-location-results">
                  {locationResults.map((result) => (
                    <button
                      key={`${result.lat}:${result.lon}:${result.display_name}`}
                      type="button"
                      onClick={() => applyLocationResult(result)}
                    >
                      <strong>{result.address?.road || result.address?.city || result.address?.town || result.display_name}</strong>
                      <span>{result.display_name}</span>
                    </button>
                  ))}
                </div>
              )}
              <input placeholder="Cidade" value={draft.city} onChange={(e) => setDraft((prev) => ({ ...prev, city: e.target.value }))} />
              <input placeholder="Morada" value={draft.address} onChange={(e) => setDraft((prev) => ({ ...prev, address: e.target.value }))} />
              <input placeholder="Telefone" value={draft.phone} onChange={(e) => setDraft((prev) => ({ ...prev, phone: e.target.value }))} />
              <div className="partner-coordinate-row">
                <input placeholder="Latitude" value={draft.latitude} onChange={(e) => setDraft((prev) => ({ ...prev, latitude: e.target.value }))} />
                <input placeholder="Longitude" value={draft.longitude} onChange={(e) => setDraft((prev) => ({ ...prev, longitude: e.target.value }))} />
              </div>
              <button className="btn btn-primary" onClick={createPartner} disabled={saving}>
                {editingPartnerId ? <Pencil size={16} /> : <Plus size={16} />}
                {editingPartnerId ? "Guardar parceiro" : "Criar parceiro"}
              </button>
              {editingPartnerId && (
                <button className="btn btn-ghost" type="button" onClick={cancelEditingPartner} disabled={saving}>
                  <X size={16} /> Cancelar edicao
                </button>
              )}
            </div>

            <div className="partner-staff-form">
              <div className="admin-panel-title">
                <UserPlus size={18} />
                <h3>Associar utilizador</h3>
              </div>
              <select value={staffPartnerId} onChange={(e) => setStaffPartnerId(e.target.value)}>
                <option value="">Escolher parceiro</option>
                {partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}
              </select>
              <div className="partner-user-search">
                <input
                  placeholder="Filtrar por nome, email, cidade ou telefone"
                  value={staffUserSearch}
                  onFocus={() => setStaffPickerOpen(Boolean(staffUserSearch.trim()))}
                  onChange={(e) => {
                    setStaffUserSearch(e.target.value);
                    setStaffUserId("");
                    setStaffPickerOpen(Boolean(e.target.value.trim()));
                  }}
                />
                {staffPickerOpen && (
                  <div className="partner-user-picker">
                    {filteredUsers.map((registeredUser) => (
                      <button
                        key={registeredUser.id}
                        type="button"
                        className={`partner-user-option ${staffUserId === registeredUser.id ? "active" : ""}`}
                        onClick={() => {
                          setStaffUserId(registeredUser.id);
                          setStaffUserSearch(registeredUser.username || registeredUser.email || "");
                          setStaffPickerOpen(false);
                        }}
                      >
                        <strong>{registeredUser.username || registeredUser.email || "Utilizador"}</strong>
                        <span>{registeredUser.email || "Sem email"}{registeredUser.city ? ` - ${registeredUser.city}` : ""}</span>
                      </button>
                    ))}
                    {filteredUsers.length === 0 && <p className="muted-text">Sem utilizadores encontrados.</p>}
                  </div>
                )}
              </div>
              {selectedStaffUser && (
                <p className="partner-selected-user">
                  Selecionado: <strong>{selectedStaffUser.username || selectedStaffUser.email}</strong>
                </p>
              )}
              <button className="btn btn-ghost" onClick={addStaff} disabled={saving || !staffPartnerId || !staffUserId}>
                <UserPlus size={16} /> Associar
              </button>
            </div>
          </div>
        )}
      </section>

      {access.length > 0 && (
        <section className="partner-panel partner-operations">
          <div className="partners-section-header">
            <div>
              <h3>Area reservada do parceiro</h3>
              <p>{partnerNames ? `Acesso operacional: ${partnerNames}.` : "Acesso operacional aos teus pontos de parceiro."}</p>
            </div>
            <QrCode size={22} />
          </div>
          <p className="partner-operation-note">
            O registo de entrega e recolha deve ser feito pelo parceiro onde os cromos foram entregues.
            Ao receber cromos, le o QR da troca do utilizador ou cola o codigo aqui.
          </p>
          <div className="partner-scan-row">
            <input
              placeholder="papacromos:trade:...:user:..."
              value={scanCode}
              onChange={(e) => setScanCode(e.target.value)}
            />
            <button className="btn btn-primary" onClick={recordDeliveryFromCode} disabled={saving || !scanCode.trim()}>
              <Check size={16} /> Registar entrega
            </button>
          </div>

          <div className="partner-trade-list">
            {operationalTrades.map((trade) => (
              <PartnerTradeCard
                key={trade.id}
                trade={trade}
                currentUserId={user?.id}
                saving={saving}
                onDelivery={(userId) => recordTradeEvent(trade, userId, "delivered")}
                onCollection={(userId) => recordTradeEvent(trade, userId, "collected")}
              />
            ))}
            {operationalTrades.length === 0 && <p className="muted-text">Sem trocas atribuidas aos teus parceiros.</p>}
          </div>
        </section>
      )}

      {isAdmin && access.length === 0 && (
        <section className="partner-panel">
          <div className="partners-section-header">
            <div>
              <h3>Operacao de parceiros</h3>
              <p>Esta area aparece apenas a contas associadas a um parceiro.</p>
            </div>
            <QrCode size={22} />
          </div>
          <p className="muted-text">
            Como admin, podes criar parceiros e associar utilizadores. Para registar entregas neste dispositivo,
            associa esta conta ao parceiro correspondente.
          </p>
        </section>
      )}

      {myTrades.length > 0 && (
        <section className="partner-panel">
          <div className="partners-section-header">
            <div>
              <h3>As minhas entregas</h3>
              <p>Mostra o QR ao parceiro para entregar. Depois le o QR do parceiro e confirma a recolha.</p>
            </div>
            <QrCode size={22} />
          </div>
          <div className="partner-trade-list">
            {myTrades.map((trade) => {
              const code = tradeCode(trade.id, user?.id || "");
              return (
                <article className="partner-user-trade" key={trade.id}>
                  <div>
                    <strong>{trade.offered_sticker.name} por {trade.requested_sticker.name}</strong>
                    <span>{trade.partner?.name || "Parceiro por definir"} - {trade.partner?.city || ""}</span>
                  </div>
                  <div className="partner-qr">
                    <img src={qrUrl(code)} alt="QR da troca" />
                    <code>{code}</code>
                  </div>
                  {trade.logistics_status === "ready_for_pickup" && (
                    <button className="btn btn-success btn-sm" disabled={saving} onClick={() => recordTradeEvent(trade, user?.id || "", "collected")}>
                      <Check size={14} /> Confirmar recolha
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function PartnerLeafletMap({
  points,
  selectedPartnerId,
}: {
  points: Array<{ partner: Partner; latitude: number; longitude: number }>;
  selectedPartnerId: string | null;
}) {
  const center = points.length > 0
    ? [points[0].latitude, points[0].longitude] as [number, number]
    : [39.6, -8.0] as [number, number];

  return (
    <MapContainer className="partner-leaflet-map" center={center} zoom={points.length === 1 ? 13 : 7} scrollWheelZoom={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <PartnerMapBounds points={points} />
      <PartnerMapSelection points={points} selectedPartnerId={selectedPartnerId} />
      {points.map((point) => (
        <Marker
          key={point.partner.id}
          position={[point.latitude, point.longitude]}
          icon={selectedPartnerId === point.partner.id ? selectedPartnerLeafletIcon : partnerLeafletIcon}
          zIndexOffset={selectedPartnerId === point.partner.id ? 1000 : 0}
        >
          <Popup>
            <strong>{point.partner.name}</strong>
            <br />
            {point.partner.address || point.partner.city}
            {point.partner.phone && (
              <>
                <br />
                {point.partner.phone}
              </>
            )}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

function PartnerMapSelection({
  points,
  selectedPartnerId,
}: {
  points: Array<{ partner: Partner; latitude: number; longitude: number }>;
  selectedPartnerId: string | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!selectedPartnerId) return;
    const selectedPoint = points.find((point) => point.partner.id === selectedPartnerId);
    if (!selectedPoint) return;
    map.flyTo([selectedPoint.latitude, selectedPoint.longitude], Math.max(map.getZoom(), 15), {
      duration: 0.7,
    });
  }, [map, points, selectedPartnerId]);

  return null;
}

function PartnerMapBounds({
  points,
}: {
  points: Array<{ latitude: number; longitude: number }>;
}) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;

    if (points.length === 1) {
      map.setView([points[0].latitude, points[0].longitude], 13);
      return;
    }

    map.fitBounds(points.map((point) => [point.latitude, point.longitude] as [number, number]), {
      padding: [42, 42],
      maxZoom: 14,
    });
  }, [map, points]);

  return null;
}

function PartnerTradeCard({
  trade,
  currentUserId,
  saving,
  onDelivery,
  onCollection,
}: {
  trade: PartnerTrade;
  currentUserId?: string;
  saving: boolean;
  onDelivery: (userId: string) => void;
  onCollection: (userId: string) => void;
}) {
  const fromDelivered = Boolean(trade.from_user_delivered_at);
  const toDelivered = Boolean(trade.to_user_delivered_at);
  const fromCollected = Boolean(trade.from_user_collected_at);
  const toCollected = Boolean(trade.to_user_collected_at);

  return (
    <article className="partner-trade-card">
      <div className="partner-trade-main">
        <strong>{trade.offered_sticker.name} por {trade.requested_sticker.name}</strong>
        <span>{trade.partner?.name || "Parceiro"} - {trade.logistics_status.replaceAll("_", " ")}</span>
      </div>
      <div className="partner-trade-users">
        <UserMovement
          label={trade.from_username || "Utilizador A"}
          delivered={fromDelivered}
          collected={fromCollected}
          canCollect={trade.logistics_status === "ready_for_pickup" || trade.logistics_status === "completed"}
          saving={saving}
          isCurrentUser={trade.from_user_id === currentUserId}
          onDelivery={() => onDelivery(trade.from_user_id)}
          onCollection={() => onCollection(trade.from_user_id)}
        />
        <UserMovement
          label={trade.to_username || "Utilizador B"}
          delivered={toDelivered}
          collected={toCollected}
          canCollect={trade.logistics_status === "ready_for_pickup" || trade.logistics_status === "completed"}
          saving={saving}
          isCurrentUser={trade.to_user_id === currentUserId}
          onDelivery={() => onDelivery(trade.to_user_id)}
          onCollection={() => onCollection(trade.to_user_id)}
        />
      </div>
    </article>
  );
}

function UserMovement({
  label,
  delivered,
  collected,
  canCollect,
  saving,
  isCurrentUser,
  onDelivery,
  onCollection,
}: {
  label: string;
  delivered: boolean;
  collected: boolean;
  canCollect: boolean;
  saving: boolean;
  isCurrentUser: boolean;
  onDelivery: () => void;
  onCollection: () => void;
}) {
  return (
    <div className="partner-user-row">
      <div>
        <strong>{label}</strong>
        <span>{delivered ? "Entregue" : "Por entregar"} · {collected ? "Recolhido" : "Por recolher"}</span>
      </div>
      <div>
        {!delivered && (
          <button className="btn btn-primary btn-xs" onClick={onDelivery} disabled={saving}>
            Entrega
          </button>
        )}
        {canCollect && !collected && (
          <button className="btn btn-success btn-xs" onClick={onCollection} disabled={saving && !isCurrentUser}>
            Recolha
          </button>
        )}
      </div>
    </div>
  );
}
