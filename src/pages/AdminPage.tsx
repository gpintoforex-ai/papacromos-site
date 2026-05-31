import { useEffect, useRef, useState } from "react";
import { Activity, ArrowRightLeft, Ban, BookOpen, Camera, ChevronDown, Download, Inbox, KeyRound, Mail, MessageSquare, PackagePlus, Pencil, RefreshCw, RotateCcw, Send, Settings, Star, Trash2, UserCheck, UserPlus, Users, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { logAuditEvent } from "../lib/audit";
import { flushPushNotificationsInBackground } from "../lib/pushDelivery";

interface Collection {
  id: string;
  name: string;
  description: string;
  image_url: string;
  total_stickers: number;
  created_at: string;
}

interface RegisteredUser {
  id: string;
  username: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  status: "member" | "king_cromo";
  is_admin: boolean;
  is_blocked: boolean;
  created_at: string;
}

interface UserDraft {
  username: string;
  phone: string;
  city: string;
  status: "member" | "king_cromo";
  is_admin: boolean;
  is_blocked: boolean;
}

interface Sticker {
  id: string;
  number: number;
  name: string;
  image_url: string;
  rarity: string;
  collection_id: string;
}

interface UserSticker {
  id: string;
  user_id: string;
  sticker_id: string;
  status: "have" | "want";
  quantity: number;
  stickers: Sticker | null;
}

interface AuditLog {
  id: string;
  actor_user_id: string | null;
  target_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  user_agent: string | null;
  created_at: string;
}

interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  status: "open" | "answered" | "closed";
  created_at: string;
  updated_at: string;
}

interface SupportMessage {
  id: string;
  ticket_id: string;
  user_id: string;
  message: string;
  created_at: string;
}

interface AdminTradeOffer {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: string;
  note: string;
  created_at: string;
  offered_sticker?: { name: string; number: number } | null;
  requested_sticker?: { name: string; number: number } | null;
}

interface AdminTradeMessage {
  id: string;
  trade_id: string;
  user_id: string;
  message: string;
  created_at: string;
  is_read?: boolean;
}

type AdminStatsPanel = "users" | "new-users" | "activity" | "logins";
type AdminInboxFilter = "all" | "inbox" | "archived" | "reviews" | "reports" | "trades";
type AdminCategory = "overview" | "messages" | "collections" | "users" | "communication" | "system";

const emptyCollection = {
  name: "",
  description: "",
  image_url: "",
  total_stickers: "24",
};

const weekdayOptions = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sab" },
  { value: 0, label: "Dom" },
];

const defaultStickerImage =
  "https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch.jpg?auto=compress&cs=tinysrgb&w=400";

const appLogoUrl = "https://hwqexlticbsokpqpqdvk.supabase.co/storage/v1/object/public/sticker-images/collections/new-1760223165876-105a2aec-9f65-47f0-adf1-b44b781e9ae6.png";
const stickerAssetVersion = "20260523-mexico-names";
const auditRetentionOptions = [
  { value: 15, label: "15 dias" },
  { value: 30, label: "1 mes" },
  { value: 180, label: "6 meses" },
  { value: 365, label: "1 ano" },
];

function getStickerPreviewImageUrl(imageUrl: string) {
  const match = imageUrl.match(/^\/stickers\/([^/]+)\/([^/.]+)\.(png|jpe?g|webp)$/i);
  if (!match) return "";
  return `/sticker-previews/${match[1]}/${match[2]}.jpg?v=${stickerAssetVersion}`;
}

function getAdminStickerImageUrl(imageUrl: string) {
  return getStickerPreviewImageUrl(imageUrl) || imageUrl || appLogoUrl;
}

function buildGeneratedStickers(collectionId: string, collectionName: string, total: number, imageUrl: string) {
  return Array.from({ length: total }, (_, index) => {
    const number = index + 1;
    return {
      collection_id: collectionId,
      number,
      name: `${collectionName} #${String(number).padStart(3, "0")}`,
      image_url: imageUrl || defaultStickerImage,
      rarity: "common",
    };
  });
}

function buildMissingGeneratedStickers(
  collectionId: string,
  collectionName: string,
  fromNumber: number,
  toNumber: number,
  imageUrl: string
) {
  return Array.from({ length: toNumber - fromNumber + 1 }, (_, index) => {
    const number = fromNumber + index;
    return {
      collection_id: collectionId,
      number,
      name: `${collectionName} #${String(number).padStart(3, "0")}`,
      image_url: imageUrl || defaultStickerImage,
      rarity: "common",
    };
  });
}

function getWorldAlbumLocalNumber(stickerNumber: number) {
  return ((stickerNumber - 1) % 20) + 1;
}

function formatAdminDate(dateValue: string | null | undefined) {
  if (!dateValue) return "-";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-PT");
}

function formatAdminDateTime(dateValue: string | null | undefined) {
  if (!dateValue) return "-";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isDateWithinDays(dateValue: string | null | undefined, days: number) {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() >= Date.now() - days * 24 * 60 * 60 * 1000;
}

function csvField(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function AdminPage() {
  const { user, profile } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);
  const [selectedSupportTicketId, setSelectedSupportTicketId] = useState<string | null>(null);
  const [tradeOffers, setTradeOffers] = useState<AdminTradeOffer[]>([]);
  const [tradeMessages, setTradeMessages] = useState<AdminTradeMessage[]>([]);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [activeAdminCategory, setActiveAdminCategory] = useState<AdminCategory>("overview");
  const [supportReply, setSupportReply] = useState("");
  const [adminInboxReadKeys, setAdminInboxReadKeys] = useState<string[]>([]);
  const [adminInboxReadItemKeys, setAdminInboxReadItemKeys] = useState<string[]>([]);
  const [adminInboxArchivedKeys, setAdminInboxArchivedKeys] = useState<string[]>([]);
  const [adminInboxModalOpen, setAdminInboxModalOpen] = useState(false);
  const [adminInboxFilter, setAdminInboxFilter] = useState<AdminInboxFilter>("inbox");
  const [adminMessageNotice, setAdminMessageNotice] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [openAuditActorIds, setOpenAuditActorIds] = useState<string[]>([]);
  const [auditRetentionDays, setAuditRetentionDays] = useState(180);
  const [activeStatsPanel, setActiveStatsPanel] = useState<AdminStatsPanel | null>(null);
  const [draft, setDraft] = useState(emptyCollection);
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);
  const [openCollectionSettingsId, setOpenCollectionSettingsId] = useState<string | null>(null);
  const [openUserDetailsId, setOpenUserDetailsId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [selectedCollectionUserId, setSelectedCollectionUserId] = useState<string | null>(null);
  const [selectedUserStickers, setSelectedUserStickers] = useState<UserSticker[]>([]);
  const [pushUserId, setPushUserId] = useState<string | null>(null);
  const [pushTitle, setPushTitle] = useState("Papa Cromos");
  const [pushMessage, setPushMessage] = useState("");
  const [pushScheduledAt, setPushScheduledAt] = useState("");
  const [broadcastPushOpen, setBroadcastPushOpen] = useState(false);
  const [matchAlertOpen, setMatchAlertOpen] = useState(false);
  const [matchAlertTitle, setMatchAlertTitle] = useState("Trocas possiveis perto de ti");
  const [matchAlertMessage, setMatchAlertMessage] = useState("Tens matches disponiveis. Abre a app e combina uma troca.");
  const [matchAlertScheduledAt, setMatchAlertScheduledAt] = useState("");
  const [matchAlertWeekdays, setMatchAlertWeekdays] = useState<number[]>([]);
  const [imageSwapCollection, setImageSwapCollection] = useState<Collection | null>(null);
  const [imageSwapStickers, setImageSwapStickers] = useState<Sticker[]>([]);
  const [imageSwapTeamFilter, setImageSwapTeamFilter] = useState("");
  const [loadingImageSwap, setLoadingImageSwap] = useState(false);
  const [draggedStickerId, setDraggedStickerId] = useState<string | null>(null);
  const draggedStickerIdRef = useRef<string | null>(null);
  const [selectedSwapStickerId, setSelectedSwapStickerId] = useState<string | null>(null);
  const [loadingUserCollection, setLoadingUserCollection] = useState(false);
  const [userDraft, setUserDraft] = useState<UserDraft>({
    username: "",
    phone: "",
    city: "",
    status: "member",
    is_admin: false,
    is_blocked: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadAdminData();
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setAdminInboxReadKeys([]);
      return;
    }

    try {
      const stored = localStorage.getItem(`papacromos:admin-inbox-read:${user.id}`);
      setAdminInboxReadKeys(stored ? JSON.parse(stored) : []);
      const itemStored = localStorage.getItem(`papacromos:admin-inbox-read-items:${user.id}`);
      setAdminInboxReadItemKeys(itemStored ? JSON.parse(itemStored) : []);
      const archivedStored = localStorage.getItem(`papacromos:admin-inbox-archived:${user.id}`);
      setAdminInboxArchivedKeys(archivedStored ? JSON.parse(archivedStored) : []);
    } catch {
      setAdminInboxReadKeys([]);
      setAdminInboxReadItemKeys([]);
      setAdminInboxArchivedKeys([]);
    }
  }, [user?.id]);

  const loadAdminData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [collectionsRes, usersRes] = await Promise.all([
        supabase.from("collections").select("*").order("name", { ascending: true }),
        supabase
          .from("user_profiles")
          .select("id, username, email, phone, city, status, is_admin, is_blocked, created_at")
          .order("created_at", { ascending: false }),
      ]);

      if (collectionsRes.error) throw collectionsRes.error;
      if (usersRes.error) throw usersRes.error;

      setCollections((collectionsRes.data || []) as Collection[]);
      setUsers((usersRes.data || []) as RegisteredUser[]);
      if (profile?.is_admin) {
        const [auditLogsRes, retentionRes, supportTicketsRes, tradeOffersRes] = await Promise.all([
          supabase.rpc("admin_list_audit_logs", { p_limit: 1000 }),
          supabase.rpc("admin_get_audit_log_retention_days"),
          supabase
            .from("support_tickets")
            .select("id, user_id, subject, status, created_at, updated_at")
            .order("updated_at", { ascending: false }),
          supabase
            .from("trade_offers")
            .select("id, from_user_id, to_user_id, status, note, created_at, offered_sticker:stickers!trade_offers_offered_sticker_id_fkey(name, number), requested_sticker:stickers!trade_offers_requested_sticker_id_fkey(name, number)")
            .order("created_at", { ascending: false }),
        ]);

        if (auditLogsRes.error) throw auditLogsRes.error;
        if (retentionRes.error) throw retentionRes.error;
        if (supportTicketsRes.error) throw supportTicketsRes.error;
        if (tradeOffersRes.error) throw tradeOffersRes.error;

        setAuditLogs((auditLogsRes.data || []) as AuditLog[]);
        setAuditRetentionDays(Number(retentionRes.data) || 180);

        const loadedSupportTickets = (supportTicketsRes.data || []) as SupportTicket[];
        const loadedTradeOffers = ((tradeOffersRes.data || []) as Array<Omit<AdminTradeOffer, "offered_sticker" | "requested_sticker"> & {
          offered_sticker?: AdminTradeOffer["offered_sticker"] | AdminTradeOffer["offered_sticker"][];
          requested_sticker?: AdminTradeOffer["requested_sticker"] | AdminTradeOffer["requested_sticker"][];
        }>).map((trade) => ({
          ...trade,
          offered_sticker: Array.isArray(trade.offered_sticker) ? trade.offered_sticker[0] || null : trade.offered_sticker || null,
          requested_sticker: Array.isArray(trade.requested_sticker) ? trade.requested_sticker[0] || null : trade.requested_sticker || null,
        }));
        setSupportTickets(loadedSupportTickets);
        setTradeOffers(loadedTradeOffers);
        if (!selectedSupportTicketId && loadedSupportTickets.length > 0) {
          setSelectedSupportTicketId(loadedSupportTickets[0].id);
        }

        const supportTicketIds = loadedSupportTickets.map((ticket) => ticket.id);
        if (supportTicketIds.length > 0) {
          const { data: supportMessageRows, error: supportMessagesError } = await supabase
            .from("support_ticket_messages")
            .select("id, ticket_id, user_id, message, created_at")
            .in("ticket_id", supportTicketIds)
            .order("created_at", { ascending: true });
          if (supportMessagesError) throw supportMessagesError;
          setSupportMessages((supportMessageRows || []) as SupportMessage[]);
        } else {
          setSupportMessages([]);
        }

        const tradeOfferIds = loadedTradeOffers.map((trade) => trade.id);
        if (tradeOfferIds.length > 0) {
          const { data: tradeMessageRows, error: tradeMessagesError } = await supabase
            .from("trade_messages")
            .select("id, trade_id, user_id, message, created_at, is_read")
            .in("trade_id", tradeOfferIds)
            .order("created_at", { ascending: true });
          if (tradeMessagesError) throw tradeMessagesError;
          const loadedTradeMessages = (tradeMessageRows || []) as AdminTradeMessage[];
          setTradeMessages(loadedTradeMessages);
          if (!selectedSupportTicketId && !selectedTradeId && loadedSupportTickets.length === 0) {
            const firstTradeMessage = loadedTradeMessages[0];
            const firstTradeWithNote = loadedTradeOffers.find((trade) => trade.note.trim());
            setSelectedTradeId(firstTradeMessage?.trade_id || firstTradeWithNote?.id || null);
          }
        } else {
          setTradeMessages([]);
          if (!selectedSupportTicketId && !selectedTradeId && loadedSupportTickets.length === 0) {
            const firstTradeWithNote = loadedTradeOffers.find((trade) => trade.note.trim());
            setSelectedTradeId(firstTradeWithNote?.id || null);
          }
        }

        if (loadedSupportTickets.length === 0 && loadedTradeOffers.length === 0) {
          setSelectedSupportTicketId(null);
          setSelectedTradeId(null);
        }
      }
    } catch (err: any) {
      setError(err.message || "Erro ao carregar area de admin.");
    } finally {
      setLoading(false);
    }
  };

  const createCollection = async () => {
    setError(null);
    setSuccess(null);

    const name = draft.name.trim();
    const totalStickers = Number(draft.total_stickers) || 0;
    if (!name) {
      setError("Indica o nome da colecao.");
      return;
    }
    if (totalStickers <= 0) {
      setError("Indica um numero de cromos maior que zero.");
      return;
    }

    setSaving(true);
    try {
      const imageUrl = draft.image_url.trim();
      const { data: collection, error } = await supabase.from("collections").insert({
        name,
        description: draft.description.trim(),
        image_url: imageUrl,
        total_stickers: totalStickers,
      }).select("id").single();
      if (error) throw error;

      const stickers = buildGeneratedStickers(collection.id, name, totalStickers, imageUrl);
      const { error: stickersError } = await supabase.from("stickers").insert(stickers);
      if (stickersError) throw stickersError;
      await logAuditEvent({
        action: "admin_collection_created",
        entityType: "collection",
        entityId: collection.id,
        metadata: { name, total_stickers: totalStickers },
      });

      setDraft(emptyCollection);
      setSuccess(`Colecao adicionada com ${totalStickers} cromos.`);
      await loadAdminData();
    } catch (err: any) {
      setError(err.message || "Erro ao adicionar colecao.");
    } finally {
      setSaving(false);
    }
  };

  const startEditingCollection = (collection: Collection) => {
    setError(null);
    setSuccess(null);
    setEditingCollectionId(collection.id);
    setDraft({
      name: collection.name || "",
      description: collection.description || "",
      image_url: collection.image_url || "",
      total_stickers: String(collection.total_stickers || 0),
    });
  };

  const cancelEditingCollection = () => {
    setEditingCollectionId(null);
    setDraft(emptyCollection);
    setError(null);
    setSuccess(null);
  };

  const deleteCollection = async (collection: Collection) => {
    if (!window.confirm(`Eliminar a colecao "${collection.name}" e todos os seus cromos?`)) return;
    if (!window.confirm("Confirmas mesmo? Esta acao tambem remove os cromos desta colecao dos utilizadores.")) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { error: deleteError } = await supabase
        .from("collections")
        .delete()
        .eq("id", collection.id);
      if (deleteError) throw deleteError;
      await logAuditEvent({
        action: "admin_collection_deleted",
        entityType: "collection",
        entityId: collection.id,
        metadata: { name: collection.name, total_stickers: collection.total_stickers },
      });

      if (editingCollectionId === collection.id) {
        setEditingCollectionId(null);
        setDraft(emptyCollection);
      }
      setSuccess("Colecao removida com sucesso.");
      await loadAdminData();
    } catch (err: any) {
      setError(err.message || "Erro ao remover colecao.");
    } finally {
      setSaving(false);
    }
  };

  const clearCollectionStickerImages = async (collection: Collection) => {
    if (!window.confirm(`Remover todas as imagens dos cromos da colecao "${collection.name}"?`)) return;
    if (!window.confirm("Confirmas mesmo? A capa da colecao nao sera alterada, apenas as imagens dos cromos. A reposicao exata so sera possivel se houver backup dos URLs anteriores.")) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { error: clearError } = await supabase
        .from("stickers")
        .update({ image_url: "" })
        .eq("collection_id", collection.id);
      if (clearError) throw clearError;
      await logAuditEvent({
        action: "admin_collection_sticker_images_cleared",
        entityType: "collection",
        entityId: collection.id,
        metadata: { name: collection.name },
      });

      setSuccess("Imagens dos cromos removidas.");
    } catch (err: any) {
      setError(err.message || "Erro ao remover imagens dos cromos.");
    } finally {
      setSaving(false);
    }
  };

  const restoreCollectionStickerImages = async (collection: Collection, source: "cover" | "logo") => {
    const imageUrl = source === "cover" ? collection.image_url : appLogoUrl;
    const sourceLabel = source === "cover" ? "imagem da capa" : "logotipo da app";

    if (!imageUrl) {
      setError("Esta colecao nao tem imagem de capa para repor nos cromos.");
      setSuccess(null);
      return;
    }

    if (!window.confirm(`Substituir a imagem de todos os cromos da colecao "${collection.name}" por ${sourceLabel}?`)) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { error: restoreError } = await supabase
        .from("stickers")
        .update({ image_url: imageUrl })
        .eq("collection_id", collection.id);
      if (restoreError) throw restoreError;
      await logAuditEvent({
        action: "admin_collection_sticker_images_restored",
        entityType: "collection",
        entityId: collection.id,
        metadata: { name: collection.name, source, image_url: imageUrl },
      });

      setSuccess(`Imagens dos cromos substituidas por ${sourceLabel}.`);
    } catch (err: any) {
      setError(err.message || "Erro ao repor imagens dos cromos.");
    } finally {
      setSaving(false);
    }
  };

  const openImageSwap = async (collection: Collection) => {
    setImageSwapCollection(collection);
    setLoadingImageSwap(true);
    setDraggedStickerId(null);
    draggedStickerIdRef.current = null;
    setSelectedSwapStickerId(null);
    setImageSwapTeamFilter("");
    setError(null);
    setSuccess(null);
    try {
      const { data, error: stickersError } = await supabase
        .from("stickers")
        .select("id, number, name, image_url, rarity, collection_id")
        .eq("collection_id", collection.id)
        .order("number", { ascending: true });
      if (stickersError) throw stickersError;
      setImageSwapStickers((data || []) as Sticker[]);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar cromos para troca de imagens.");
      setImageSwapStickers([]);
    } finally {
      setLoadingImageSwap(false);
    }
  };

  const reloadImageSwapStickers = async (collectionId = imageSwapCollection?.id) => {
    if (!collectionId) return;

    const { data, error: stickersError } = await supabase
      .from("stickers")
      .select("id, number, name, image_url, rarity, collection_id")
      .eq("collection_id", collectionId)
      .order("number", { ascending: true });
    if (stickersError) throw stickersError;
    setImageSwapStickers((data || []) as Sticker[]);
  };

  const closeImageSwap = () => {
    setImageSwapCollection(null);
    setImageSwapStickers([]);
    setImageSwapTeamFilter("");
    setDraggedStickerId(null);
    setSelectedSwapStickerId(null);
  };

  const swapStickerImages = async (sourceStickerId: string | null, targetStickerId: string) => {
    if (!sourceStickerId || sourceStickerId === targetStickerId) {
      setDraggedStickerId(null);
      setSelectedSwapStickerId(null);
      return;
    }

    const sourceSticker = imageSwapStickers.find((sticker) => sticker.id === sourceStickerId);
    const targetSticker = imageSwapStickers.find((sticker) => sticker.id === targetStickerId);
    if (!sourceSticker || !targetSticker) {
      setDraggedStickerId(null);
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { error: sourceRpcError } = await supabase.rpc("update_sticker_image", {
        p_sticker_id: sourceSticker.id,
        p_image_url: targetSticker.image_url || "",
      });
      if (sourceRpcError) throw sourceRpcError;

      const { error: targetRpcError } = await supabase.rpc("update_sticker_image", {
        p_sticker_id: targetSticker.id,
        p_image_url: sourceSticker.image_url || "",
      });
      if (targetRpcError) throw targetRpcError;
      await logAuditEvent({
        action: "admin_sticker_images_swapped",
        entityType: "collection",
        entityId: sourceSticker.collection_id,
        metadata: {
          source_sticker_id: sourceSticker.id,
          source_number: sourceSticker.number,
          target_sticker_id: targetSticker.id,
          target_number: targetSticker.number,
        },
      });

      await reloadImageSwapStickers(sourceSticker.collection_id);
      setSuccess(`Imagens trocadas entre #${sourceSticker.number} e #${targetSticker.number}.`);
    } catch (err: any) {
      setError(err.message || "Erro ao trocar imagens dos cromos.");
    } finally {
      setSaving(false);
      setDraggedStickerId(null);
      setSelectedSwapStickerId(null);
    }
  };

  const selectStickerForImageSwap = (stickerId: string) => {
    if (saving) return;
    if (!selectedSwapStickerId) {
      setSelectedSwapStickerId(stickerId);
      return;
    }
    swapStickerImages(selectedSwapStickerId, stickerId);
  };

  const saveCollection = async () => {
    if (!editingCollectionId) {
      await createCollection();
      return;
    }

    setError(null);
    setSuccess(null);

    const name = draft.name.trim();
    const totalStickers = Number(draft.total_stickers) || 0;
    if (!name) {
      setError("Indica o nome da colecao.");
      return;
    }
    if (totalStickers <= 0) {
      setError("Indica um numero de cromos maior que zero.");
      return;
    }

    setSaving(true);
    try {
      const imageUrl = draft.image_url.trim();
      const { error: updateError } = await supabase
        .from("collections")
        .update({
          name,
          description: draft.description.trim(),
          image_url: imageUrl,
          total_stickers: totalStickers,
        })
        .eq("id", editingCollectionId);
      if (updateError) throw updateError;

      const { data: existingStickers, error: stickersLoadError } = await supabase
        .from("stickers")
        .select("number")
        .eq("collection_id", editingCollectionId)
        .order("number", { ascending: false });
      if (stickersLoadError) throw stickersLoadError;

      const highestStickerNumber = Math.max(0, ...((existingStickers || []).map((sticker: any) => Number(sticker.number) || 0)));
      if (totalStickers > highestStickerNumber) {
        const missingStickers = buildMissingGeneratedStickers(
          editingCollectionId,
          name,
          highestStickerNumber + 1,
          totalStickers,
          imageUrl
        );
        const { error: missingStickersError } = await supabase.from("stickers").insert(missingStickers);
      if (missingStickersError) throw missingStickersError;
      }
      await logAuditEvent({
        action: "admin_collection_updated",
        entityType: "collection",
        entityId: editingCollectionId,
        metadata: { name, total_stickers: totalStickers, image_url: imageUrl },
      });

      setEditingCollectionId(null);
      setDraft(emptyCollection);
      setSuccess("Colecao atualizada com sucesso.");
      await loadAdminData();
    } catch (err: any) {
      setError(err.message || "Erro ao atualizar colecao.");
    } finally {
      setSaving(false);
    }
  };

  const uploadCollectionCover = async (file: File | null) => {
    if (!file || !user?.id) return;

    setUploadingCover(true);
    setError(null);
    setSuccess(null);
    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const collectionKey = editingCollectionId || `new-${Date.now()}`;
      const filePath = `collections/${collectionKey}-${Date.now()}-${user.id}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("sticker-images")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from("sticker-images").getPublicUrl(filePath);
      setDraft((prev) => ({ ...prev, image_url: publicUrlData.publicUrl }));
      setSuccess("Foto da capa carregada. Guarda a colecao para aplicar.");
    } catch (err: any) {
      setError(err.message || "Erro ao carregar foto da capa.");
    } finally {
      setUploadingCover(false);
    }
  };

  const clearCollectionCover = () => {
    setDraft((prev) => ({ ...prev, image_url: "" }));
    setSuccess("Foto da capa removida. Guarda a colecao para aplicar.");
  };

  const startEditingUser = (registeredUser: RegisteredUser) => {
    setEditingUserId(registeredUser.id);
    setUserDraft({
      username: registeredUser.username || "",
      phone: registeredUser.phone || "",
      city: registeredUser.city || "",
      status: registeredUser.status || "member",
      is_admin: Boolean(registeredUser.is_admin),
      is_blocked: Boolean(registeredUser.is_blocked),
    });
    setError(null);
    setSuccess(null);
  };

  const cancelEditingUser = () => {
    setEditingUserId(null);
    setError(null);
    setSuccess(null);
  };

  const saveUser = async (userId: string) => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { error: rpcError } = await supabase.rpc("admin_update_user_profile", {
        p_user_id: userId,
        p_username: userDraft.username.trim(),
        p_phone: userDraft.phone.trim(),
        p_city: userDraft.city.trim(),
        p_status: userDraft.status,
        p_is_admin: userId === user?.id ? true : userDraft.is_admin,
        p_is_blocked: userId === user?.id ? false : userDraft.is_blocked,
      });
      if (rpcError) throw rpcError;

      setEditingUserId(null);
      setSuccess("Utilizador atualizado.");
      await loadAdminData();
    } catch (err: any) {
      setError(err.message || "Erro ao atualizar utilizador.");
    } finally {
      setSaving(false);
    }
  };

  const toggleBlockUser = async (registeredUser: RegisteredUser) => {
    if (registeredUser.id === user?.id) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { error: rpcError } = await supabase.rpc("admin_update_user_profile", {
        p_user_id: registeredUser.id,
        p_username: registeredUser.username,
        p_phone: registeredUser.phone || "",
        p_city: registeredUser.city || "",
        p_is_admin: registeredUser.is_admin,
        p_is_blocked: !registeredUser.is_blocked,
      });
      if (rpcError) throw rpcError;

      setSuccess(registeredUser.is_blocked ? "Utilizador desbloqueado." : "Utilizador bloqueado.");
      await loadAdminData();
    } catch (err: any) {
      setError(err.message || "Erro ao bloquear utilizador.");
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (registeredUser: RegisteredUser) => {
    if (registeredUser.id === user?.id) return;
    if (!window.confirm(`Eliminar o utilizador ${registeredUser.email || registeredUser.username}?`)) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { error: rpcError } = await supabase.rpc("admin_delete_user", {
        p_user_id: registeredUser.id,
      });
      if (rpcError) throw rpcError;

      setSuccess("Utilizador eliminado.");
      await loadAdminData();
    } catch (err: any) {
      setError(err.message || "Erro ao eliminar utilizador.");
    } finally {
      setSaving(false);
    }
  };

  const sendPasswordReset = async (registeredUser: RegisteredUser) => {
    if (!registeredUser.email) {
      setError("Este utilizador nao tem email associado.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(registeredUser.email, {
        redirectTo: window.location.origin,
      });
      if (resetError) throw resetError;

      setSuccess(`Email de recuperacao de senha enviado para ${registeredUser.email}.`);
    } catch (err: any) {
      setError(err.message || "Erro ao enviar recuperacao de senha.");
    } finally {
      setSaving(false);
    }
  };

  const openPushComposer = (registeredUser: RegisteredUser) => {
    setOpenUserDetailsId(registeredUser.id);
    setBroadcastPushOpen(false);
    setPushUserId(registeredUser.id);
    setPushTitle("Papa Cromos");
    setPushMessage("");
    setPushScheduledAt("");
    setError(null);
    setSuccess(null);
  };

  const closePushComposer = () => {
    setPushUserId(null);
    setPushTitle("Papa Cromos");
    setPushMessage("");
    setPushScheduledAt("");
  };

  const openBroadcastPushComposer = () => {
    setPushUserId(null);
    setBroadcastPushOpen(true);
    setPushTitle("Papa Cromos");
    setPushMessage("");
    setPushScheduledAt("");
    setError(null);
    setSuccess(null);
  };

  const closeBroadcastPushComposer = () => {
    setBroadcastPushOpen(false);
    setPushTitle("Papa Cromos");
    setPushMessage("");
    setPushScheduledAt("");
  };

  const openMatchAlertComposer = () => {
    setMatchAlertOpen(true);
    setMatchAlertTitle("Trocas possiveis perto de ti");
    setMatchAlertMessage("Tens matches disponiveis. Abre a app e combina uma troca.");
    setMatchAlertScheduledAt("");
    setMatchAlertWeekdays([]);
    setError(null);
    setSuccess(null);
  };

  const closeMatchAlertComposer = () => {
    setMatchAlertOpen(false);
    setMatchAlertTitle("Trocas possiveis perto de ti");
    setMatchAlertMessage("Tens matches disponiveis. Abre a app e combina uma troca.");
    setMatchAlertScheduledAt("");
    setMatchAlertWeekdays([]);
  };

  const getPushScheduledAtIso = () => {
    if (!pushScheduledAt) return null;
    const date = new Date(pushScheduledAt);
    if (Number.isNaN(date.getTime())) {
      throw new Error("Data/hora de envio invalida.");
    }
    return date.toISOString();
  };

  const getMatchAlertScheduledAtIso = () => {
    if (!matchAlertScheduledAt) {
      throw new Error("Define o dia e a hora do alerta de matches.");
    }
    const date = new Date(matchAlertScheduledAt);
    if (Number.isNaN(date.getTime())) {
      throw new Error("Data/hora do alerta invalida.");
    }
    return date.toISOString();
  };

  const toggleMatchAlertWeekday = (weekday: number) => {
    setMatchAlertWeekdays((current) =>
      current.includes(weekday)
        ? current.filter((value) => value !== weekday)
        : [...current, weekday].sort((a, b) => a - b)
    );
  };

  const sendPushMessage = async (registeredUser: RegisteredUser) => {
    const title = pushTitle.trim();
    const body = pushMessage.trim();

    if (!title) {
      setError("Indica o titulo da notificacao.");
      return;
    }

    if (!body) {
      setError("Escreve a mensagem da notificacao.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { error: queueError } = await supabase.rpc("admin_queue_push_notification", {
        p_user_id: registeredUser.id,
        p_title: title,
        p_body: body,
        p_data: {
          type: "admin_message",
          sent_by: user?.id || null,
        },
        p_scheduled_at: getPushScheduledAtIso(),
      });
      if (queueError) throw queueError;

      const scheduled = Boolean(pushScheduledAt);
      const { error: invokeError } = scheduled
        ? { error: null }
        : await supabase.functions.invoke("send-push-notifications");
      if (scheduled) {
        setSuccess(`Push agendado para ${registeredUser.username || registeredUser.email || "utilizador"}.`);
      } else if (invokeError) {
        setSuccess("Notificacao guardada na fila. A entrega sera tentada pelo servidor.");
      } else {
        setSuccess(`Push enviado para ${registeredUser.username || registeredUser.email || "utilizador"}.`);
      }
      await logAuditEvent({
        action: scheduled ? "admin_push_scheduled" : "admin_push_sent",
        entityType: "push_notification",
        targetUserId: registeredUser.id,
        metadata: { title, body_length: body.length, scheduled_at: getPushScheduledAtIso() },
      });

      closePushComposer();
    } catch (err: any) {
      setError(err.message || "Erro ao enviar push.");
    } finally {
      setSaving(false);
    }
  };

  const sendBroadcastPushMessage = async () => {
    const title = pushTitle.trim();
    const body = pushMessage.trim();

    if (!title) {
      setError("Indica o titulo da notificacao.");
      return;
    }

    if (!body) {
      setError("Escreve a mensagem da notificacao.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const scheduledAt = getPushScheduledAtIso();
      const scheduled = Boolean(scheduledAt);
      if (!window.confirm(`${scheduled ? "Agendar" : "Enviar"} esta mensagem push para todos os utilizadores ativos?`)) {
        setSaving(false);
        return;
      }

      const { data: queued, error: queueError } = await supabase.rpc("admin_queue_broadcast_push_notification", {
        p_title: title,
        p_body: body,
        p_data: {
          type: "admin_broadcast",
          sent_by: user?.id || null,
        },
        p_scheduled_at: scheduledAt,
      });
      if (queueError) throw queueError;

      const queuedCount = Number(queued || 0);
      if (!scheduled) {
        await supabase.functions.invoke("send-push-notifications");
      }

      await logAuditEvent({
        action: scheduled ? "admin_broadcast_push_scheduled" : "admin_broadcast_push_sent",
        entityType: "push_notification",
        metadata: { title, body_length: body.length, queued_count: queuedCount, scheduled_at: scheduledAt },
      });

      setSuccess(scheduled
        ? `Push agendado para ${queuedCount} utilizador(es).`
        : `Push colocado em envio para ${queuedCount} utilizador(es).`);
      closeBroadcastPushComposer();
    } catch (err: any) {
      setError(err.message || "Erro ao enviar push.");
    } finally {
      setSaving(false);
    }
  };

  const scheduleMatchAlerts = async () => {
    const title = matchAlertTitle.trim();
    const body = matchAlertMessage.trim();

    if (!title) {
      setError("Indica o titulo do alerta de matches.");
      return;
    }

    if (!body) {
      setError("Escreve a mensagem do alerta de matches.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const scheduledAt = getMatchAlertScheduledAtIso();
      if (!window.confirm("Agendar alerta apenas para utilizadores com matches disponiveis?")) {
        setSaving(false);
        return;
      }

      const { data: queued, error: queueError } = await supabase.rpc("admin_queue_match_alert_notifications", {
        p_title: title,
        p_body: body,
        p_scheduled_at: scheduledAt,
        p_weekdays: matchAlertWeekdays.length ? matchAlertWeekdays : null,
      });
      if (queueError) throw queueError;

      const queuedCount = Number(queued || 0);
      const recurring = matchAlertWeekdays.length > 0;
      await logAuditEvent({
        action: "admin_match_alert_scheduled",
        entityType: "push_notification",
        metadata: { title, body_length: body.length, target_count: queuedCount, scheduled_at: scheduledAt, weekdays: matchAlertWeekdays, recurring },
      });

      setSuccess(recurring
        ? `Agendamento recorrente guardado. Neste momento existem ${queuedCount} utilizador(es) com matches.`
        : `Alerta de matches agendado para ${queuedCount} utilizador(es).`);
      closeMatchAlertComposer();
    } catch (err: any) {
      setError(err.message || "Erro ao agendar alertas de matches.");
    } finally {
      setSaving(false);
    }
  };

  const sendRepeatedStickersEmail = async () => {
    if (!window.confirm("Enviar por email a lista atual de repetidos para todos os utilizadores registados com email?")) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("send-repeated-stickers-email", {
        body: {},
      });
      if (invokeError) throw invokeError;

      const sent = Number(data?.sent || 0);
      const recipients = Number(data?.recipients || 0);
      const repeatedStickers = Number(data?.repeated_stickers || 0);
      const failed = Number(data?.failed || 0);

      await logAuditEvent({
        action: "admin_repeated_stickers_email_sent",
        entityType: "email",
        metadata: { sent, recipients, repeated_stickers: repeatedStickers, failed },
      });

      setSuccess(
        failed > 0
          ? `Emails enviados para ${sent} de ${recipients} utilizadores. ${failed} falharam.`
          : `Emails enviados para ${sent} utilizadores com ${repeatedStickers} repetidos listados.`
      );
    } catch (err: any) {
      const message = err?.context?.error || err?.message || "Erro ao enviar emails dos repetidos.";
      setError(String(message).includes("RESEND_API_KEY")
        ? "Falta configurar RESEND_API_KEY na Edge Function para enviar emails."
        : message);
    } finally {
      setSaving(false);
    }
  };

  const exportUserEmails = async () => {
    const usersWithEmail = users.filter((registeredUser) => registeredUser.email?.trim());

    if (usersWithEmail.length === 0) {
      setError("Nao existem utilizadores com email para exportar.");
      return;
    }

    const header = ["email", "username", "city", "status", "is_admin", "is_blocked", "created_at"];
    const rows = usersWithEmail.map((registeredUser) => [
      registeredUser.email,
      registeredUser.username,
      registeredUser.city,
      registeredUser.status,
      registeredUser.is_admin ? "sim" : "nao",
      registeredUser.is_blocked ? "sim" : "nao",
      registeredUser.created_at,
    ]);
    const csv = [
      header.map(csvField).join(","),
      ...rows.map((row) => row.map(csvField).join(",")),
    ].join("\n");
    const dateKey = new Date().toISOString().slice(0, 10);

    downloadTextFile(`papacromos-emails-utilizadores-${dateKey}.csv`, `\ufeff${csv}`, "text/csv;charset=utf-8");
    setError(null);
    setSuccess(`Exportados ${usersWithEmail.length} emails de utilizadores.`);

    await logAuditEvent({
      action: "admin_user_emails_exported",
      entityType: "user_profiles",
      metadata: { users_with_email: usersWithEmail.length, total_users: users.length },
    });
  };

  const loadUserCollection = async (registeredUser: RegisteredUser) => {
    setSelectedCollectionUserId(registeredUser.id);
    setSelectedUserStickers([]);
    setLoadingUserCollection(true);
    setError(null);
    setSuccess(null);

    try {
      const { data, error: stickersError } = await supabase
        .from("user_stickers")
        .select("id, user_id, sticker_id, status, quantity, stickers(id, number, name, image_url, rarity, collection_id)")
        .eq("user_id", registeredUser.id);
      if (stickersError) throw stickersError;

      setSelectedUserStickers((data || []) as unknown as UserSticker[]);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar a colecao do utilizador.");
    } finally {
      setLoadingUserCollection(false);
    }
  };

  const closeUserCollection = () => {
    setSelectedCollectionUserId(null);
    setSelectedUserStickers([]);
    setLoadingUserCollection(false);
  };

  const resetTradeData = async () => {
    if (!window.confirm("Reinicializar todos os dados das trocas? Isto elimina propostas, mensagens e eventos de parceiros.")) return;
    if (!window.confirm("Confirmas mesmo? Esta acao nao altera utilizadores nem colecoes, mas apaga o historico de trocas.")) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { error: rpcError } = await supabase.rpc("admin_reset_trade_data");
      if (rpcError) {
        const missingRpc = String(rpcError.message || "").includes("admin_reset_trade_data");
        if (missingRpc) {
          throw new Error("Funcao admin_reset_trade_data ainda nao existe no Supabase. Aplica a migration 20260510123000_add_admin_reset_trade_data_rpc.sql e tenta novamente.");
        }
        throw rpcError;
      }

      setSuccess("Dados das trocas reinicializados.");
    } catch (err: any) {
      setError(err.message || "Erro ao reinicializar dados das trocas.");
    } finally {
      setSaving(false);
    }
  };

  const updateAuditRetentionDays = async (retentionDays: number) => {
    const previousRetentionDays = auditRetentionDays;
    setAuditRetentionDays(retentionDays);
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { data, error: updateError } = await supabase.rpc("admin_set_audit_log_retention_days", {
        p_retention_days: retentionDays,
      });
      if (updateError) throw updateError;

      const { data: savedRetentionDays, error: readError } = await supabase.rpc("admin_get_audit_log_retention_days");
      if (readError) throw readError;

      const savedDays = Number(savedRetentionDays) || retentionDays;
      setAuditRetentionDays(savedDays);
      if (savedDays !== retentionDays) {
        throw new Error("A base de dados nao confirmou o periodo selecionado.");
      }

      setOpenAuditActorIds([]);
      setSuccess(`Retencao de logs atualizada. ${Number(data) || 0} log${Number(data) === 1 ? "" : "s"} antigo${Number(data) === 1 ? "" : "s"} eliminado${Number(data) === 1 ? "" : "s"}.`);
      await loadAdminData();
    } catch (err: any) {
      setAuditRetentionDays(previousRetentionDays);
      setError(err.message || "Erro ao atualizar retencao dos logs.");
    } finally {
      setSaving(false);
    }
  };

  const updateSupportTicketStatus = async (ticket: SupportTicket, status: SupportTicket["status"]) => {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from("support_tickets")
        .update({ status })
        .eq("id", ticket.id);
      if (updateError) throw updateError;

      await logAuditEvent({
        action: `admin_support_ticket_${status}`,
        entityType: "support_ticket",
        entityId: ticket.id,
        targetUserId: ticket.user_id,
        metadata: { subject: ticket.subject },
      });

      setSuccess(status === "closed" ? "Mensagem arquivada." : "Mensagem reaberta.");
      await loadAdminData();
    } catch (err: any) {
      setError(err.message || "Erro ao atualizar mensagem.");
    } finally {
      setSaving(false);
    }
  };

  const sendSupportReply = async () => {
    const selectedTicket = supportTickets.find((ticket) => ticket.id === selectedSupportTicketId);
    const cleanReply = supportReply.trim();
    if (!selectedTicket || !user?.id) return;

    setError(null);
    setSuccess(null);
    if (!cleanReply) {
      setError("Escreve uma resposta.");
      return;
    }
    if (cleanReply.length > 4000) {
      setError("A resposta deve ter no maximo 4000 caracteres.");
      return;
    }

    setSaving(true);
    try {
      const { error: messageError } = await supabase.from("support_ticket_messages").insert({
        ticket_id: selectedTicket.id,
        user_id: user.id,
        message: cleanReply,
      });
      if (messageError) throw messageError;
      flushPushNotificationsInBackground();

      const { error: ticketError } = await supabase
        .from("support_tickets")
        .update({ status: "answered" })
        .eq("id", selectedTicket.id);
      if (ticketError) throw ticketError;

      await logAuditEvent({
        action: "admin_support_reply_sent",
        entityType: "support_ticket",
        entityId: selectedTicket.id,
        targetUserId: selectedTicket.user_id,
        metadata: { subject: selectedTicket.subject, message_length: cleanReply.length },
      });

      setSupportReply("");
      setSuccess("Resposta enviada.");
      await loadAdminData();
    } catch (err: any) {
      setError(err.message || "Erro ao responder a mensagem.");
    } finally {
      setSaving(false);
    }
  };

  const markAdminInboxItemRead = (readKey: string, itemKey?: string) => {
    if (!user?.id) return;

    setAdminInboxReadKeys((currentKeys) => {
      if (currentKeys.includes(readKey)) return currentKeys;
      const nextKeys = [...currentKeys, readKey];
      localStorage.setItem(`papacromos:admin-inbox-read:${user.id}`, JSON.stringify(nextKeys));
      return nextKeys;
    });

    if (itemKey) {
      setAdminInboxReadItemKeys((currentKeys) => {
        if (currentKeys.includes(itemKey)) return currentKeys;
        const nextKeys = [...currentKeys, itemKey];
        localStorage.setItem(`papacromos:admin-inbox-read-items:${user.id}`, JSON.stringify(nextKeys));
        return nextKeys;
      });
    }
  };

  const archiveAdminInboxItem = (readKey: string) => {
    if (!user?.id) return;

    markAdminInboxItemRead(readKey);
    setAdminInboxArchivedKeys((currentKeys) => {
      if (currentKeys.includes(readKey)) return currentKeys;
      const nextKeys = [...currentKeys, readKey];
      localStorage.setItem(`papacromos:admin-inbox-archived:${user.id}`, JSON.stringify(nextKeys));
      return nextKeys;
    });
    setAdminInboxModalOpen(false);
  };

  const restoreAdminInboxItem = (readKey: string) => {
    if (!user?.id) return;

    setAdminInboxArchivedKeys((currentKeys) => {
      const nextKeys = currentKeys.filter((key) => key !== readKey);
      localStorage.setItem(`papacromos:admin-inbox-archived:${user.id}`, JSON.stringify(nextKeys));
      return nextKeys;
    });
  };

  const openPreparedEmail = async (email: string | null | undefined, subject: string, body: string) => {
    if (!email) {
      setAdminMessageNotice({ type: "error", text: "Este utilizador nao tem email associado." });
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    setAdminMessageNotice({ type: "info", text: "A enviar email..." });
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("send-admin-message-email", {
        body: {
          to: email,
          subject,
          message: body,
        },
      });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      setSuccess(`Email enviado para ${email}.`);
      setAdminMessageNotice({ type: "success", text: `Email enviado para ${email}.` });
    } catch (err: any) {
      let message = err?.context?.error || err?.message || "Erro ao enviar email.";
      if (err?.context instanceof Response) {
        try {
          const payload = await err.context.clone().json();
          message = payload?.error || message;
        } catch {
          message = err.context.statusText || message;
        }
      }
      const finalMessage = String(message).includes("SMTP")
        ? "Falta configurar a conta SMTP nas secrets do Supabase."
        : String(message);
      setError(finalMessage);
      setAdminMessageNotice({ type: "error", text: finalMessage });
    } finally {
      setSaving(false);
    }
  };

  const openPreparedWhatsApp = (phone: string | null | undefined, message: string) => {
    const digits = (phone || "").replace(/\D/g, "");
    if (!digits) {
      setAdminMessageNotice({ type: "error", text: "Este utilizador nao tem telefone associado." });
      return;
    }

    const normalizedPhone = digits.startsWith("351") || digits.length > 9 ? digits : `351${digits}`;
    window.open(`https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
    setAdminMessageNotice({ type: "success", text: "WhatsApp aberto numa nova aba." });
  };

  const selectedCollectionUser = users.find((registeredUser) => registeredUser.id === selectedCollectionUserId);
  const usersById = new Map(users.map((registeredUser) => [registeredUser.id, registeredUser]));
  const selectedSupportTicket = selectedSupportTicketId
    ? supportTickets.find((ticket) => ticket.id === selectedSupportTicketId) || null
    : selectedTradeId
      ? null
      : supportTickets[0] || null;
  const selectedSupportMessages = selectedSupportTicket
    ? supportMessages.filter((message) => message.ticket_id === selectedSupportTicket.id)
    : [];
  const tradeConversations = tradeOffers
    .map((trade) => {
      const initialMessages: AdminTradeMessage[] = trade.note.trim()
        ? [{
            id: `trade-note-${trade.id}`,
            trade_id: trade.id,
            user_id: trade.from_user_id,
            message: trade.note.trim(),
            created_at: trade.created_at,
            is_read: true,
          }]
        : [];

      return {
        trade,
        messages: [
          ...initialMessages,
          ...tradeMessages.filter((message) => message.trade_id === trade.id),
        ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
      };
    })
    .filter((conversation) => conversation.messages.length > 0)
    .sort((a, b) => {
      const latestA = a.messages[a.messages.length - 1]?.created_at || a.trade.created_at;
      const latestB = b.messages[b.messages.length - 1]?.created_at || b.trade.created_at;
      return new Date(latestB).getTime() - new Date(latestA).getTime();
    });
  const selectedTradeConversation = selectedTradeId
    ? tradeConversations.find((conversation) => conversation.trade.id === selectedTradeId) || null
    : null;
  const supportReviewCount = supportTickets.filter((ticket) => ticket.subject.toLowerCase().includes("avaliacao")).length;
  const supportReportCount = supportTickets.filter((ticket) => ticket.subject.toLowerCase().includes("report")).length;
  const tradeMessageCount = tradeMessages.length;
  const adminInboxItems = [
    ...supportTickets.map((ticket) => {
      const ticketMessages = supportMessages.filter((message) => message.ticket_id === ticket.id);
      const latestMessage = ticketMessages[ticketMessages.length - 1];
      const ticketUser = usersById.get(ticket.user_id);
      const isReview = ticket.subject.toLowerCase().includes("avaliacao");
      const isReport = ticket.subject.toLowerCase().includes("report");
      const readKey = `support:${ticket.id}:${latestMessage?.id || ticket.updated_at}`;

      return {
        key: `support-${ticket.id}`,
        readKey,
        type: "support" as const,
        title: ticket.subject,
        sender: ticketUser?.username || ticketUser?.email || "Utilizador",
        preview: latestMessage?.message || "Sem mensagem.",
        updatedAt: latestMessage?.created_at || ticket.updated_at,
        badge: isReview ? "Avaliacao" : isReport ? "Revisao" : "Mensagem",
        unread: !adminInboxReadKeys.includes(readKey) && !adminInboxReadItemKeys.includes(`support-${ticket.id}`),
        archived: adminInboxArchivedKeys.includes(readKey),
        supportTicket: ticket,
        tradeConversation: null,
      };
    }),
    ...tradeConversations.map((conversation) => {
      const latestMessage = conversation.messages[conversation.messages.length - 1];
      const sender = usersById.get(latestMessage.user_id);
      const fromUser = usersById.get(conversation.trade.from_user_id);
      const toUser = usersById.get(conversation.trade.to_user_id);
      const readKey = `trade:${conversation.trade.id}:${latestMessage.id}`;

      return {
        key: `trade-${conversation.trade.id}`,
        readKey,
        type: "trade" as const,
        title: `Troca: ${fromUser?.username || fromUser?.email || "Utilizador"} -> ${toUser?.username || toUser?.email || "Utilizador"}`,
        sender: sender?.username || sender?.email || "Utilizador",
        preview: latestMessage.message,
        updatedAt: latestMessage.created_at,
        badge: "Troca",
        unread: !adminInboxReadKeys.includes(readKey) && !adminInboxReadItemKeys.includes(`trade-${conversation.trade.id}`),
        archived: adminInboxArchivedKeys.includes(readKey),
        supportTicket: null,
        tradeConversation: conversation,
      };
    }),
  ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const adminVisibleInboxItems = adminInboxItems.filter((item) => !item.archived);
  const adminArchivedInboxItems = adminInboxItems.filter((item) => item.archived);
  const adminUnreadInboxItems = adminVisibleInboxItems.filter((item) => item.unread);
  const filteredAdminInboxItems = adminInboxItems.filter((item) => {
    if (adminInboxFilter === "all") return !item.archived;
    if (adminInboxFilter === "inbox") return item.unread && !item.archived;
    if (adminInboxFilter === "archived") return item.archived;
    if (adminInboxFilter === "reviews") return item.badge === "Avaliacao" && !item.archived;
    if (adminInboxFilter === "reports") return item.badge === "Revisao" && !item.archived;
    if (adminInboxFilter === "trades") return item.type === "trade" && !item.archived;
    return true;
  });
  const adminInboxFilterLabels: Record<AdminInboxFilter, string> = {
    all: "Total",
    inbox: "Inbox",
    archived: "Arquivadas",
    reviews: "Avaliacoes",
    reports: "Revisoes",
    trades: "Msgs trocas",
  };
  const openAdminInboxItem = (item: (typeof adminInboxItems)[number]) => {
    markAdminInboxItemRead(item.readKey, item.key);
    setAdminMessageNotice(null);
    if (item.type === "support" && item.supportTicket) {
      setSelectedSupportTicketId(item.supportTicket.id);
      setSelectedTradeId(null);
    } else if (item.type === "trade" && item.tradeConversation) {
      setSelectedTradeId(item.tradeConversation.trade.id);
      setSelectedSupportTicketId(null);
    }
    setSupportReply("");
    setAdminInboxModalOpen(true);
  };
  const auditGroups = Array.from(
    auditLogs.reduce((groups, log) => {
      const key = log.actor_user_id || "system";
      const current = groups.get(key) || [];
      current.push(log);
      groups.set(key, current);
      return groups;
    }, new Map<string, AuditLog[]>())
  ).map(([actorId, logs]) => {
    const actor = actorId === "system" ? null : usersById.get(actorId);
    return {
      actorId,
      actor,
      logs,
      latestLog: logs[0],
    };
  });

  const toggleAuditActor = (actorId: string) => {
    setOpenAuditActorIds((currentIds) =>
      currentIds.includes(actorId)
        ? currentIds.filter((currentId) => currentId !== actorId)
        : [...currentIds, actorId]
    );
  };

  const activeUsersCount = users.filter((registeredUser) => !registeredUser.is_blocked).length;
  const blockedUsersCount = users.filter((registeredUser) => registeredUser.is_blocked).length;
  const adminUsersCount = users.filter((registeredUser) => registeredUser.is_admin).length;
  const newUsersLast7DaysList = users.filter((registeredUser) => isDateWithinDays(registeredUser.created_at, 7));
  const newUsersLast7Days = newUsersLast7DaysList.length;
  const auditLogsLast7Days = auditLogs.filter((log) => isDateWithinDays(log.created_at, 7));
  const loginLogsLast7Days = auditLogsLast7Days.filter((log) => log.action === "user_login");
  const loginsLast7Days = loginLogsLast7Days.length;
  const activeActorIdsLast7Days = new Set(
    auditLogsLast7Days
      .map((log) => log.actor_user_id || log.target_user_id)
      .filter((actorId): actorId is string => Boolean(actorId))
  );
  const lastActivityLog = auditLogs[0] || null;
  const adminStats = [
    {
      id: "users" as const,
      label: "Utilizadores",
      value: users.length,
      detail: `${activeUsersCount} ativos · ${blockedUsersCount} bloqueados`,
      icon: <Users size={18} />,
    },
    {
      id: "new-users" as const,
      label: "Novos 7 dias",
      value: newUsersLast7Days,
      detail: `${adminUsersCount} administradores no total`,
      icon: <UserPlus size={18} />,
    },
    {
      id: "activity" as const,
      label: "Atividade 7 dias",
      value: auditLogsLast7Days.length,
      detail: `${activeActorIdsLast7Days.size} utilizadores com atividade`,
      icon: <Activity size={18} />,
    },
    {
      id: "logins" as const,
      label: "Entradas 7 dias",
      value: loginsLast7Days,
      detail: lastActivityLog ? `Ultima: ${formatAdminDateTime(lastActivityLog.created_at)}` : "Sem atividade registada",
      icon: <UserCheck size={18} />,
    },
  ];
  const activeStatsTitle = adminStats.find((stat) => stat.id === activeStatsPanel)?.label || "";
  const adminCategories = [
    { id: "overview" as const, label: "Resumo", detail: "Indicadores", icon: <Activity size={16} /> },
    { id: "messages" as const, label: "Mensagens", detail: `${adminUnreadInboxItems.length} por ler`, icon: <Inbox size={16} /> },
    { id: "collections" as const, label: "Colecoes", detail: `${collections.length} ativas`, icon: <PackagePlus size={16} /> },
    { id: "users" as const, label: "Utilizadores", detail: `${users.length} contas`, icon: <Users size={16} /> },
    { id: "communication" as const, label: "Comunicacao", detail: "Email e push", icon: <Mail size={16} /> },
    { id: "system" as const, label: "Sistema", detail: "Auditoria", icon: <Settings size={16} /> },
  ];
  const openAdminCategory = (category: AdminCategory) => {
    setActiveAdminCategory(category);
    if (category !== "messages") setAdminInboxModalOpen(false);
  };

  const selectedUserCollectionSummaries = collections.map((collection) => {
    const collectionEntries = selectedUserStickers.filter((entry) => entry.stickers?.collection_id === collection.id);
    const haveEntries = collectionEntries.filter((entry) => entry.status === "have");
    const haveCount = haveEntries.length;
    const repeatedCount = haveEntries.reduce((total, entry) => total + Math.max(0, (entry.quantity || 0) - 1), 0);
    const wantedCount = collectionEntries.filter((entry) => entry.status === "want").length;
    const totalCount = collection.total_stickers || 0;
    const missingCount = Math.max(0, totalCount - haveCount);
    const progress = totalCount > 0 ? Math.round((haveCount / totalCount) * 100) : 0;

    return {
      collection,
      entries: collectionEntries.sort((a, b) => (a.stickers?.number || 0) - (b.stickers?.number || 0)),
      haveCount,
      repeatedCount,
      wantedCount,
      missingCount,
      progress,
    };
  });
  const imageSwapIsWorldAlbum = imageSwapCollection?.name.toLowerCase().includes("mundial") || false;
  const imageSwapTeams = Array.from(
    new Set(
      imageSwapStickers
        .map((sticker) => sticker.name.split(" - ")[0]?.trim())
        .filter(Boolean)
    )
  );
  const filteredImageSwapStickers =
    imageSwapIsWorldAlbum && imageSwapTeamFilter
      ? imageSwapStickers.filter((sticker) => sticker.name.startsWith(`${imageSwapTeamFilter} - `))
      : imageSwapStickers;
  const selectedSupportUser = selectedSupportTicket ? usersById.get(selectedSupportTicket.user_id) : null;
  const selectedTradeLatestMessage = selectedTradeConversation?.messages[selectedTradeConversation.messages.length - 1] || null;
  const selectedTradeEmailRecipient = selectedTradeConversation && selectedTradeLatestMessage
    ? usersById.get(
        selectedTradeLatestMessage.user_id === selectedTradeConversation.trade.from_user_id
          ? selectedTradeConversation.trade.to_user_id
          : selectedTradeConversation.trade.from_user_id
      )
    : null;

  if (!profile?.is_admin) {
    return (
      <div className="empty-state">
        <span className="empty-icon">!</span>
        <h3>Acesso reservado</h3>
        <p>Esta area esta disponivel apenas para administradores.</p>
        <p className="muted-text">
          Sessao atual: {profile?.email || user?.email || "sem email"}.
          Tipo: {profile ? "utilizador normal" : "perfil nao carregado"}.
        </p>
      </div>
    );
  }

  if (loading) return <div className="loading">A carregar admin...</div>;

  return (
    <div className={`admin-page admin-category-${activeAdminCategory}`}>
      <div className="admin-header">
        <div>
          <h2>Admin</h2>
          <p>Gerir colecoes e consultar utilizadores registados.</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={loadAdminData}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}
      {success && <p className="success-text">{success}</p>}

      <nav className="admin-category-nav" aria-label="Categorias de administracao">
        {adminCategories.map((category) => (
          <button
            className={activeAdminCategory === category.id ? "active" : ""}
            key={category.id}
            type="button"
            onClick={() => openAdminCategory(category.id)}
            aria-pressed={activeAdminCategory === category.id}
          >
            {category.icon}
            <span>{category.label}</span>
            <em>{category.detail}</em>
          </button>
        ))}
      </nav>

      <section className="admin-stats-grid" aria-label="Resumo de utilizacao">
        {adminStats.map((stat) => (
          <button
            className={`admin-stat-card ${activeStatsPanel === stat.id ? "active" : ""}`}
            key={stat.label}
            type="button"
            onClick={() => setActiveStatsPanel((currentPanel) => currentPanel === stat.id ? null : stat.id)}
            aria-pressed={activeStatsPanel === stat.id}
          >
            <span className="admin-stat-icon">{stat.icon}</span>
            <div>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <em>{stat.detail}</em>
            </div>
          </button>
        ))}
      </section>

      {activeStatsPanel && (
        <section className="admin-panel admin-stats-results">
          <div className="admin-panel-title admin-stats-results-title">
            <span>
              <Activity size={18} />
              <h3>Resultados - {activeStatsTitle}</h3>
            </span>
            <button className="btn btn-ghost btn-xs" type="button" onClick={() => setActiveStatsPanel(null)}>
              <X size={12} /> Fechar
            </button>
          </div>

          {activeStatsPanel === "users" && (
            <div className="admin-stats-result-list">
              {users.map((registeredUser) => (
                <div className="admin-stats-result-row" key={registeredUser.id}>
                  <div>
                    <strong>{registeredUser.username || registeredUser.email || "Utilizador"}</strong>
                    <span>{registeredUser.email || "-"}{registeredUser.city ? ` - ${registeredUser.city}` : ""}</span>
                  </div>
                  <em className={registeredUser.is_blocked ? "status-blocked" : "status-active"}>
                    {registeredUser.is_blocked ? "Bloqueado" : "Ativo"}
                  </em>
                  <small>{formatAdminDate(registeredUser.created_at)}</small>
                </div>
              ))}
            </div>
          )}

          {activeStatsPanel === "new-users" && (
            <div className="admin-stats-result-list">
              {newUsersLast7DaysList.map((registeredUser) => (
                <div className="admin-stats-result-row" key={registeredUser.id}>
                  <div>
                    <strong>{registeredUser.username || registeredUser.email || "Utilizador"}</strong>
                    <span>{registeredUser.email || "-"}{registeredUser.city ? ` - ${registeredUser.city}` : ""}</span>
                  </div>
                  <em>{registeredUser.is_admin ? "Admin" : "Utilizador"}</em>
                  <small>{formatAdminDateTime(registeredUser.created_at)}</small>
                </div>
              ))}
              {newUsersLast7DaysList.length === 0 && <p className="muted-text">Sem novos utilizadores nos ultimos 7 dias.</p>}
            </div>
          )}

          {(activeStatsPanel === "activity" || activeStatsPanel === "logins") && (
            <div className="admin-stats-result-list">
              {(activeStatsPanel === "activity" ? auditLogsLast7Days : loginLogsLast7Days).map((log) => {
                const actor = log.actor_user_id ? usersById.get(log.actor_user_id) : null;
                const target = log.target_user_id ? usersById.get(log.target_user_id) : null;
                return (
                  <div className="admin-stats-result-row" key={log.id}>
                    <div>
                      <strong>{log.action}</strong>
                      <span>{actor?.username || actor?.email || target?.username || target?.email || log.actor_user_id || log.target_user_id || "Sistema"}</span>
                    </div>
                    <em>{log.entity_type}</em>
                    <small>{formatAdminDateTime(log.created_at)}</small>
                  </div>
                );
              })}
              {(activeStatsPanel === "activity" ? auditLogsLast7Days : loginLogsLast7Days).length === 0 && (
                <p className="muted-text">Sem resultados nos ultimos 7 dias.</p>
              )}
            </div>
          )}
        </section>
      )}

      <section className="admin-panel admin-inbox-panel">
        <div className="admin-panel-title admin-inbox-title">
          <span>
            <Inbox size={18} />
            <h3>Caixa de mensagens</h3>
          </span>
          <div className="admin-inbox-counters" aria-label="Filtros das mensagens">
            {([
              ["all", adminVisibleInboxItems.length],
              ["inbox", adminUnreadInboxItems.length],
              ["archived", adminArchivedInboxItems.length],
              ["reviews", supportReviewCount],
              ["reports", supportReportCount],
              ["trades", tradeMessageCount],
            ] as Array<[AdminInboxFilter, number]>).map(([filterId, count]) => (
              <button
                className={adminInboxFilter === filterId ? "active" : ""}
                key={filterId}
                type="button"
                onClick={() => setAdminInboxFilter(filterId)}
                aria-pressed={adminInboxFilter === filterId}
              >
                {count} {adminInboxFilterLabels[filterId]}
              </button>
            ))}
          </div>
        </div>
        <p className="muted-text">
          Entram aqui as mensagens dos utilizadores, pedidos para rever, avaliacoes da app e conversas das trocas.
        </p>

        <div className="admin-mailbox">
          <section>
            <div className="admin-mailbox-section-title">
              <strong>{adminInboxFilterLabels[adminInboxFilter]}</strong>
              <span>{filteredAdminInboxItems.length}</span>
            </div>
            <div className={`admin-mailbox-list ${adminInboxFilter === "archived" ? "archived" : ""}`} role="list" aria-label={`Mensagens - ${adminInboxFilterLabels[adminInboxFilter]}`}>
              {filteredAdminInboxItems.map((item) => (
                <button className={`admin-mailbox-row ${item.archived ? "archived" : item.unread ? "unread" : "read"}`} key={item.key} type="button" role="listitem" onClick={() => openAdminInboxItem(item)}>
                  <span className={`admin-mailbox-type ${item.type}`}>{item.type === "trade" ? <ArrowRightLeft size={14} /> : item.badge === "Avaliacao" ? <Star size={14} /> : <MessageSquare size={14} />}</span>
                  <strong>{item.sender}</strong>
                  <span>{item.title}</span>
                  <p>{item.preview}</p>
                  <em>{item.badge}</em>
                  <time>{formatAdminDateTime(item.updatedAt)}</time>
                </button>
              ))}
              {filteredAdminInboxItems.length === 0 && <p className="admin-mailbox-empty">Sem mensagens neste filtro.</p>}
            </div>
          </section>
        </div>
      </section>

      {adminInboxModalOpen && (selectedTradeConversation || selectedSupportTicket) && (
        <div className="account-data-overlay" role="dialog" aria-modal="true" aria-labelledby="admin-message-modal-title">
          <div className="account-data-modal admin-message-modal">
            {selectedTradeConversation ? (
              <>
                <div className="admin-inbox-reader-header">
                  <div>
                    <span className="support-status support-status-answered">Troca monitorizada</span>
                    <h3 id="admin-message-modal-title">
                      {usersById.get(selectedTradeConversation.trade.from_user_id)?.username || usersById.get(selectedTradeConversation.trade.from_user_id)?.email || "Utilizador"}
                      {" -> "}
                      {usersById.get(selectedTradeConversation.trade.to_user_id)?.username || usersById.get(selectedTradeConversation.trade.to_user_id)?.email || "Utilizador"}
                    </h3>
                    <p>
                      Estado: {selectedTradeConversation.trade.status}
                      {selectedTradeConversation.trade.offered_sticker ? ` - Oferece ${selectedTradeConversation.trade.offered_sticker.number} ${selectedTradeConversation.trade.offered_sticker.name}` : ""}
                      {selectedTradeConversation.trade.requested_sticker ? ` - Pede ${selectedTradeConversation.trade.requested_sticker.number} ${selectedTradeConversation.trade.requested_sticker.name}` : ""}
                    </p>
                  </div>
                  <div className="admin-inbox-reader-actions">
                    <button
                      className="btn btn-ghost btn-xs"
                      type="button"
                      disabled={saving}
                      onClick={() => openPreparedEmail(
                        selectedTradeEmailRecipient?.email,
                        "Tens uma mensagem sobre uma troca no Papa Cromos",
                        [
                          `Ola ${selectedTradeEmailRecipient?.username || ""}`.trim(),
                          "",
                          "Tens uma mensagem numa troca no Papa Cromos:",
                          "",
                          selectedTradeLatestMessage?.message || "",
                          "",
                          "Entra na app para veres a conversa e responderes.",
                        ].join("\n")
                      )}
                    >
                      <Mail size={12} /> {saving ? "A enviar..." : "Enviar email"}
                    </button>
                    <button
                      className="btn btn-ghost btn-xs"
                      type="button"
                      onClick={() => openPreparedWhatsApp(
                        selectedTradeEmailRecipient?.phone,
                        [
                          `Ola ${selectedTradeEmailRecipient?.username || ""}`.trim(),
                          "",
                          "Tens uma mensagem numa troca no Papa Cromos:",
                          "",
                          selectedTradeLatestMessage?.message || "",
                          "",
                          "Entra na app para veres a conversa e responderes.",
                        ].join("\n")
                      )}
                    >
                      WhatsApp
                    </button>
                    <button className="btn btn-ghost btn-xs" type="button" onClick={() => archiveAdminInboxItem(`trade:${selectedTradeConversation.trade.id}:${selectedTradeConversation.messages[selectedTradeConversation.messages.length - 1].id}`)}>
                      Arquivar
                    </button>
                    <button className="btn btn-ghost btn-xs" type="button" onClick={() => restoreAdminInboxItem(`trade:${selectedTradeConversation.trade.id}:${selectedTradeConversation.messages[selectedTradeConversation.messages.length - 1].id}`)}>
                      Repor
                    </button>
                    <button className="header-icon-btn" type="button" onClick={() => setAdminInboxModalOpen(false)} title="Fechar" aria-label="Fechar mensagem">
                      <X size={18} />
                    </button>
                  </div>
                </div>
                <div className="admin-inbox-thread">
                  {selectedTradeConversation.messages.map((message) => {
                    const messageUser = usersById.get(message.user_id);
                    return (
                      <article className="admin-inbox-message" key={message.id}>
                        <div>
                          <strong>{messageUser?.username || messageUser?.email || "Utilizador"}</strong>
                          <span>{formatAdminDateTime(message.created_at)}</span>
                        </div>
                        <p>{message.message}</p>
                      </article>
                    );
                  })}
                </div>
                {adminMessageNotice && (
                  <p className={`admin-message-notice ${adminMessageNotice.type}`}>{adminMessageNotice.text}</p>
                )}
                <div className="admin-inbox-monitor-note">
                  <MessageSquare size={14} />
                  <span>Vista apenas para monitorizacao. As respostas devem ser dadas pelos participantes da troca.</span>
                </div>
              </>
            ) : selectedSupportTicket ? (
              <>
                <div className="admin-inbox-reader-header">
                  <div>
                    <span className={`support-status support-status-${selectedSupportTicket.status}`}>
                      {selectedSupportTicket.status === "open" ? "Para rever" : selectedSupportTicket.status === "answered" ? "Respondida" : "Arquivada"}
                    </span>
                    <h3 id="admin-message-modal-title">{selectedSupportTicket.subject}</h3>
                    <p>
                      {usersById.get(selectedSupportTicket.user_id)?.username || usersById.get(selectedSupportTicket.user_id)?.email || "Utilizador"}
                      {" - "}
                      {formatAdminDateTime(selectedSupportTicket.updated_at)}
                    </p>
                  </div>
                  <div className="admin-inbox-reader-actions">
                    <button
                      className="btn btn-ghost btn-xs"
                      type="button"
                      disabled={saving}
                      onClick={() => openPreparedEmail(
                        selectedSupportUser?.email,
                        selectedSupportTicket.subject,
                        [
                          `Ola ${selectedSupportUser?.username || ""}`.trim(),
                          "",
                          "Tens uma mensagem do Papa Cromos:",
                          "",
                          selectedSupportMessages[selectedSupportMessages.length - 1]?.message || selectedSupportTicket.subject,
                          "",
                          "Entra na app para veres a conversa completa.",
                        ].join("\n")
                      )}
                    >
                      <Mail size={12} /> {saving ? "A enviar..." : "Enviar email"}
                    </button>
                    <button
                      className="btn btn-ghost btn-xs"
                      type="button"
                      onClick={() => openPreparedWhatsApp(
                        selectedSupportUser?.phone,
                        [
                          `Ola ${selectedSupportUser?.username || ""}`.trim(),
                          "",
                          "Tens uma mensagem do Papa Cromos:",
                          "",
                          selectedSupportMessages[selectedSupportMessages.length - 1]?.message || selectedSupportTicket.subject,
                          "",
                          "Entra na app para veres a conversa completa.",
                        ].join("\n")
                      )}
                    >
                      WhatsApp
                    </button>
                    <button className="btn btn-ghost btn-xs" type="button" onClick={() => archiveAdminInboxItem(`support:${selectedSupportTicket.id}:${selectedSupportMessages[selectedSupportMessages.length - 1]?.id || selectedSupportTicket.updated_at}`)}>
                      Arquivar
                    </button>
                    <button className="btn btn-ghost btn-xs" type="button" onClick={() => restoreAdminInboxItem(`support:${selectedSupportTicket.id}:${selectedSupportMessages[selectedSupportMessages.length - 1]?.id || selectedSupportTicket.updated_at}`)}>
                      Repor
                    </button>
                    {selectedSupportTicket.status === "closed" ? (
                      <button className="btn btn-ghost btn-xs" type="button" onClick={() => updateSupportTicketStatus(selectedSupportTicket, "open")} disabled={saving}>
                        Reabrir ticket
                      </button>
                    ) : (
                      <button className="btn btn-ghost btn-xs" type="button" onClick={() => updateSupportTicketStatus(selectedSupportTicket, "closed")} disabled={saving}>
                        Fechar ticket
                      </button>
                    )}
                    <button className="header-icon-btn" type="button" onClick={() => setAdminInboxModalOpen(false)} title="Fechar" aria-label="Fechar mensagem">
                      <X size={18} />
                    </button>
                  </div>
                </div>
                <div className="admin-inbox-thread">
                  {selectedSupportMessages.map((message) => {
                    const messageUser = usersById.get(message.user_id);
                    const isAdminMessage = Boolean(messageUser?.is_admin);
                    return (
                      <article className={`admin-inbox-message ${isAdminMessage ? "admin" : ""}`} key={message.id}>
                        <div>
                          <strong>{isAdminMessage ? "Admin" : messageUser?.username || messageUser?.email || "Utilizador"}</strong>
                          <span>{formatAdminDateTime(message.created_at)}</span>
                        </div>
                        <p>{message.message}</p>
                      </article>
                    );
                  })}
                </div>
                {adminMessageNotice && (
                  <p className={`admin-message-notice ${adminMessageNotice.type}`}>{adminMessageNotice.text}</p>
                )}
                <div className="admin-inbox-reply">
                  <textarea
                    className="admin-table-input"
                    value={supportReply}
                    onChange={(event) => setSupportReply(event.target.value)}
                    placeholder="Responder ao utilizador..."
                    disabled={saving || selectedSupportTicket.status === "closed"}
                  />
                  <button className="btn btn-primary btn-sm" type="button" onClick={sendSupportReply} disabled={saving || selectedSupportTicket.status === "closed"}>
                    <Send size={14} /> {saving ? "A enviar..." : "Responder"}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      <div className="admin-grid">
        <section className="admin-panel">
          <div className="admin-panel-title">
            {editingCollectionId ? <Pencil size={18} /> : <PackagePlus size={18} />}
            <h3>{editingCollectionId ? "Editar colecao" : "Adicionar colecao"}</h3>
          </div>

          <div className="admin-form">
            <input
              type="text"
              placeholder="Nome da colecao"
              value={draft.name}
              onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
              disabled={saving}
            />
            <textarea
              placeholder="Descricao"
              value={draft.description}
              onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
              disabled={saving}
            />
            <input
              type="url"
              placeholder="URL da imagem"
              value={draft.image_url}
              onChange={(e) => setDraft((prev) => ({ ...prev, image_url: e.target.value }))}
              disabled={saving || uploadingCover}
            />
            {draft.image_url && (
              <>
                <div className="admin-cover-preview">
                  <img src={draft.image_url} alt={draft.name || "Capa da colecao"} />
                </div>
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={clearCollectionCover}
                  disabled={saving || uploadingCover}
                >
                  <X size={16} /> Remover foto da capa
                </button>
              </>
            )}
            <label className="btn btn-ghost admin-upload-btn" htmlFor="collection-cover-input">
              <Camera size={16} /> {uploadingCover ? "A carregar foto..." : "Adicionar foto da capa"}
            </label>
            <input
              id="collection-cover-input"
              className="sticker-photo-input"
              type="file"
              accept="image/*"
              capture="environment"
              disabled={saving || uploadingCover}
              onChange={(event) => {
                uploadCollectionCover(event.target.files?.[0] || null);
                event.target.value = "";
              }}
            />
            <input
              type="number"
              min="0"
              placeholder="Total de cromos"
              value={draft.total_stickers}
              onChange={(e) => setDraft((prev) => ({ ...prev, total_stickers: e.target.value }))}
              disabled={saving}
            />
            <button className="btn btn-primary" onClick={saveCollection} disabled={saving}>
              {editingCollectionId ? <Pencil size={16} /> : <PackagePlus size={16} />}
              {saving ? "A guardar..." : editingCollectionId ? "Guardar alteracoes" : "Adicionar colecao"}
            </button>
            {editingCollectionId && (
              <button className="btn btn-ghost" onClick={cancelEditingCollection} disabled={saving}>
                <X size={16} /> Cancelar edicao
              </button>
            )}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-title">
            <PackagePlus size={18} />
            <h3>Colecoes</h3>
          </div>

          <div className="admin-list">
            {collections.map((collection) => {
              const isSettingsOpen = openCollectionSettingsId === collection.id;
              const settingsPanelId = `collection-settings-${collection.id}`;

              return (
                <div className="admin-list-row" key={collection.id}>
                  <div>
                    <strong>{collection.name}</strong>
                    <span>{collection.description || "Sem descricao"}</span>
                  </div>
                  <div className="admin-list-actions admin-collection-actions">
                    <em>{collection.total_stickers} cromos</em>
                    <button
                      className={`btn btn-ghost btn-xs admin-collection-settings-toggle ${isSettingsOpen ? "open" : ""}`}
                      type="button"
                      aria-expanded={isSettingsOpen}
                      aria-controls={settingsPanelId}
                      onClick={() => setOpenCollectionSettingsId((currentId) => currentId === collection.id ? null : collection.id)}
                    >
                      <Settings size={12} /> Definicoes <ChevronDown size={12} />
                    </button>
                    <div
                      id={settingsPanelId}
                      className={`admin-collection-settings-panel ${isSettingsOpen ? "open" : ""}`}
                      aria-hidden={!isSettingsOpen}
                    >
                      <div className="admin-collection-action-grid">
                        <button
                          className="btn btn-ghost btn-xs"
                          type="button"
                          onClick={() => startEditingCollection(collection)}
                          disabled={saving || !isSettingsOpen}
                        >
                          <Pencil size={12} /> Editar
                        </button>
                        <button
                          className="btn btn-danger-soft btn-xs"
                          type="button"
                          onClick={() => deleteCollection(collection)}
                          disabled={saving || !isSettingsOpen}
                        >
                          <Trash2 size={12} /> Remover
                        </button>
                        <button
                          className="btn btn-ghost btn-xs"
                          type="button"
                          onClick={() => clearCollectionStickerImages(collection)}
                          disabled={saving || !isSettingsOpen}
                        >
                          <X size={12} /> Remover imagens
                        </button>
                        <button
                          className="btn btn-ghost btn-xs"
                          type="button"
                          onClick={() => restoreCollectionStickerImages(collection, "cover")}
                          disabled={saving || !collection.image_url || !isSettingsOpen}
                        >
                          <RefreshCw size={12} /> Repor capa
                        </button>
                        <button
                          className="btn btn-ghost btn-xs"
                          type="button"
                          onClick={() => restoreCollectionStickerImages(collection, "logo")}
                          disabled={saving || !isSettingsOpen}
                        >
                          <RefreshCw size={12} /> Repor logo
                        </button>
                        <button
                          className="btn btn-ghost btn-xs"
                          type="button"
                          onClick={() => openImageSwap(collection)}
                          disabled={saving || loadingImageSwap || !isSettingsOpen}
                        >
                          <ArrowRightLeft size={12} /> Trocar imagens
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {collections.length === 0 && <p className="muted-text">Sem colecoes.</p>}
          </div>
        </section>
      </div>

      {imageSwapCollection && (
        <section className="admin-panel admin-image-swap-panel">
          <div className="admin-panel-title admin-image-swap-title">
            <span>
              <ArrowRightLeft size={18} />
              <h3>Trocar imagens - {imageSwapCollection.name}</h3>
            </span>
            <button className="btn btn-ghost btn-xs" type="button" onClick={closeImageSwap} disabled={saving}>
              <X size={12} /> Fechar
            </button>
          </div>
          <p className="muted-text">
            Arrasta um cromo para cima de outro para trocar apenas as imagens. Os numeros, nomes e cromos dos utilizadores nao mudam.
            {imageSwapIsWorldAlbum ? " No album Mundial, o numero grande corresponde a selecao e o numero global aparece abaixo." : ""}
          </p>
          {imageSwapIsWorldAlbum && (
            <div className="admin-image-swap-filter">
              <label>
                Selecao
                <select
                  value={imageSwapTeamFilter}
                  onChange={(event) => {
                    setImageSwapTeamFilter(event.target.value);
                    setDraggedStickerId(null);
                    setSelectedSwapStickerId(null);
                  }}
                  disabled={saving || loadingImageSwap}
                >
                  <option value="">Todas</option>
                  {imageSwapTeams.map((teamName) => (
                    <option key={teamName} value={teamName}>
                      {teamName}
                    </option>
                  ))}
                </select>
              </label>
              {imageSwapTeamFilter && <span>{filteredImageSwapStickers.length} cromos</span>}
            </div>
          )}

          {loadingImageSwap ? (
            <div className="loading admin-inline-loading">A carregar cromos...</div>
          ) : (
            <div className="admin-image-swap-grid">
              {filteredImageSwapStickers.map((sticker) => (
                <button
                  key={sticker.id}
                  className={`admin-image-swap-card ${draggedStickerId === sticker.id ? "dragging" : ""} ${selectedSwapStickerId === sticker.id ? "selected" : ""}`}
                  type="button"
                  draggable
                  onClick={() => selectStickerForImageSwap(sticker.id)}
                  onDragStart={(event) => {
                    setDraggedStickerId(sticker.id);
                    draggedStickerIdRef.current = sticker.id;
                    try {
                      event.dataTransfer.setData("text/plain", sticker.id);
                      event.dataTransfer.effectAllowed = "move";
                    } catch (e) {
                      // ignore if dataTransfer is not writable in this environment
                    }
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const sourceId = draggedStickerIdRef.current || (() => {
                      try { return event.dataTransfer.getData("text/plain"); } catch (e) { return null; }
                    })();
                    swapStickerImages(sourceId, sticker.id);
                  }}
                  onDragEnd={() => {
                    setDraggedStickerId(null);
                    draggedStickerIdRef.current = null;
                  }}
                  disabled={saving}
                  title={sticker.name}
                >
                  <span className="admin-image-swap-number">
                    #{imageSwapIsWorldAlbum ? getWorldAlbumLocalNumber(sticker.number) : sticker.number}
                  </span>
                  <img
                    src={getAdminStickerImageUrl(sticker.image_url)}
                    alt={sticker.name}
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.src = appLogoUrl;
                    }}
                  />
                  {imageSwapIsWorldAlbum && (
                    <span className="admin-image-swap-global-number">Global #{sticker.number}</span>
                  )}
                  <strong>{sticker.name}</strong>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="admin-panel admin-audit-panel">
        <div className="admin-panel-title">
          <Settings size={18} />
          <h3>Logs de auditoria</h3>
        </div>
        <p className="muted-text">Registo das acoes criticas de utilizadores e administradores.</p>
        <div className="admin-audit-cleanup">
          <label>
            Eliminar automaticamente apos
            <select
              value={auditRetentionDays}
              onChange={(event) => updateAuditRetentionDays(Number(event.target.value))}
              disabled={saving}
            >
              {auditRetentionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <span>A limpeza e aplicada automaticamente quando novos logs sao registados.</span>
        </div>
        <div className="admin-audit-list">
          {auditGroups.map((group) => {
            const isOpen = openAuditActorIds.includes(group.actorId);
            const actorLabel = group.actor
              ? group.actor.username || group.actor.email || group.actor.id
              : group.actorId === "system"
                ? "Sistema"
                : group.actorId;
            const actorEmail = group.actor?.email || (group.actorId !== "system" ? group.actorId : "");

            return (
              <article className={`admin-audit-group ${isOpen ? "open" : ""}`} key={group.actorId}>
                <button
                  className="admin-audit-group-trigger"
                  type="button"
                  onClick={() => toggleAuditActor(group.actorId)}
                  aria-expanded={isOpen}
                >
                  <div>
                    <strong>{actorLabel}</strong>
                    <span>{actorEmail}</span>
                  </div>
                  <em>{group.logs.length} evento{group.logs.length === 1 ? "" : "s"}</em>
                  <small>{formatAdminDateTime(group.latestLog?.created_at)}</small>
                  <ChevronDown size={16} />
                </button>

                {isOpen && (
                  <div className="admin-audit-group-body">
                    {group.logs.map((log) => (
                      <div className="admin-audit-row" key={log.id}>
                        <div>
                          <strong>{log.action}</strong>
                          <span>{log.entity_type}{log.entity_id ? ` - ${log.entity_id}` : ""}</span>
                        </div>
                        <small>{formatAdminDateTime(log.created_at)}</small>
                        {log.target_user_id && <em>alvo {log.target_user_id}</em>}
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
          {auditLogs.length === 0 && <p className="muted-text">Ainda nao ha logs ou a migration de auditoria ainda nao foi aplicada.</p>}
        </div>
      </section>

      <section className="admin-panel admin-maintenance-panel">
        <div className="admin-panel-title">
          <RotateCcw size={18} />
          <h3>Manutencao</h3>
        </div>
        <p className="muted-text">
          Reinicializa propostas, mensagens e registos de entrega/recolha das trocas.
        </p>
        <button className="btn btn-danger-soft admin-maintenance-btn" type="button" onClick={resetTradeData} disabled={saving}>
          <RotateCcw size={16} /> Reinicializar dados das trocas
        </button>
      </section>

      <section className="admin-panel admin-email-panel">
        <div className="admin-panel-title">
          <Mail size={18} />
          <h3>Email de repetidos</h3>
        </div>
        <p className="muted-text">
          Envia a todos os utilizadores registados a lista atual de cromos repetidos disponiveis na aplicacao, com um template moderno e pronto para combinar trocas.
        </p>
        <button className="btn btn-primary admin-email-btn" type="button" onClick={sendRepeatedStickersEmail} disabled={saving}>
          <Mail size={16} /> {saving ? "A enviar..." : "Enviar lista de repetidos"}
        </button>
      </section>

      <section className="admin-panel admin-email-panel">
        <div className="admin-panel-title">
          <span>
            <RefreshCw size={18} />
            <h3>Alertas de matches</h3>
          </span>
          <button className="btn btn-ghost btn-xs" type="button" onClick={openMatchAlertComposer} disabled={saving}>
            <Send size={12} /> Agendar
          </button>
        </div>
        <p className="muted-text">
          Agenda um aviso apenas para utilizadores que tenham trocas possiveis. Define o dia e a hora para evitar incomodar fora do momento certo.
        </p>

        {matchAlertOpen && (
          <div className="admin-push-composer admin-push-broadcast">
            <div className="admin-push-composer-title">
              <strong>Agendar alerta de matches</strong>
              <button className="btn btn-ghost btn-xs" type="button" onClick={closeMatchAlertComposer} disabled={saving}>
                <X size={12} /> Fechar
              </button>
            </div>
            <input
              className="admin-table-input"
              type="text"
              value={matchAlertTitle}
              onChange={(event) => setMatchAlertTitle(event.target.value)}
              placeholder="Titulo"
              disabled={saving}
            />
            <textarea
              className="admin-table-input"
              value={matchAlertMessage}
              onChange={(event) => setMatchAlertMessage(event.target.value)}
              placeholder="Mensagem para utilizadores com matches"
              disabled={saving}
            />
            <label className="admin-push-schedule">
              <span>Dia e hora do aviso</span>
              <input
                className="admin-table-input"
                type="datetime-local"
                value={matchAlertScheduledAt}
                onChange={(event) => setMatchAlertScheduledAt(event.target.value)}
                disabled={saving}
              />
              <em>Obrigatorio para nao enviar imediatamente.</em>
            </label>
            <div className="admin-match-weekdays" role="group" aria-label="Dias da semana">
              <span>Dias da semana</span>
              <div>
                {weekdayOptions.map((weekday) => (
                  <label key={weekday.value}>
                    <input
                      type="checkbox"
                      checked={matchAlertWeekdays.includes(weekday.value)}
                      onChange={() => toggleMatchAlertWeekday(weekday.value)}
                      disabled={saving}
                    />
                    {weekday.label}
                  </label>
                ))}
              </div>
              <em>Se nao escolheres dias, agenda apenas para a data/hora acima. Se escolheres dias, guarda um agendamento recorrente semanal nessa hora.</em>
            </div>
            <button className="btn btn-primary btn-xs" type="button" onClick={scheduleMatchAlerts} disabled={saving}>
              <Send size={12} /> {saving ? "A guardar..." : matchAlertWeekdays.length ? "Guardar recorrencia" : "Agendar alerta"}
            </button>
          </div>
        )}
      </section>

      <section className="admin-panel admin-users-panel">
        <div className="admin-panel-title">
          <span>
            <Users size={18} />
            <h3>Utilizadores registados</h3>
          </span>
          <div className="admin-panel-title-actions">
            <button className="btn btn-ghost btn-xs" type="button" onClick={exportUserEmails} disabled={saving || users.length === 0}>
              <Download size={12} /> Exportar emails
            </button>
            <button className="btn btn-ghost btn-xs" type="button" onClick={openBroadcastPushComposer} disabled={saving}>
              <Send size={12} /> Push global
            </button>
          </div>
        </div>

        {broadcastPushOpen && (
          <div className="admin-push-composer admin-push-broadcast">
            <div className="admin-push-composer-title">
              <strong>Mensagem push para todos</strong>
              <button className="btn btn-ghost btn-xs" type="button" onClick={closeBroadcastPushComposer} disabled={saving}>
                <X size={12} /> Fechar
              </button>
            </div>
            <input
              className="admin-table-input"
              type="text"
              value={pushTitle}
              onChange={(event) => setPushTitle(event.target.value)}
              placeholder="Titulo"
              disabled={saving}
            />
            <textarea
              className="admin-table-input"
              value={pushMessage}
              onChange={(event) => setPushMessage(event.target.value)}
              placeholder="Mensagem para os utilizadores"
              disabled={saving}
            />
            <label className="admin-push-schedule">
              <span>Agendar envio</span>
              <input
                className="admin-table-input"
                type="datetime-local"
                value={pushScheduledAt}
                onChange={(event) => setPushScheduledAt(event.target.value)}
                disabled={saving}
              />
              <em>Deixa vazio para enviar agora.</em>
            </label>
            <button className="btn btn-primary btn-xs" type="button" onClick={sendBroadcastPushMessage} disabled={saving}>
              <Send size={12} /> {saving ? "A guardar..." : pushScheduledAt ? "Agendar push" : "Enviar agora"}
            </button>
          </div>
        )}

        <div className="admin-users-list">
          {users.map((registeredUser) => {
            const isDetailsOpen = openUserDetailsId === registeredUser.id || editingUserId === registeredUser.id;
            const userDetailsPanelId = `user-details-${registeredUser.id}`;

            return (
              <article className="admin-user-card" key={registeredUser.id}>
                <button
                  className={`admin-user-card-summary ${isDetailsOpen ? "open" : ""}`}
                  type="button"
                  aria-expanded={isDetailsOpen}
                  aria-controls={userDetailsPanelId}
                  onClick={() => setOpenUserDetailsId((currentId) => currentId === registeredUser.id ? null : registeredUser.id)}
                >
                  <div className="admin-user-card-main">
                    <div className="admin-user-field primary">
                      <span>Utilizador</span>
                      <strong>{registeredUser.username || "-"}</strong>
                    </div>
                  <div className="admin-user-field">
                    <span>Cidade</span>
                    <strong>{registeredUser.city || "-"}</strong>
                  </div>
                  <div className="admin-user-field compact">
                    <span>Estado</span>
                    <strong className={registeredUser.is_blocked ? "status-blocked" : "status-active"}>
                      {registeredUser.is_blocked ? "Bloqueado" : "Ativo"}
                    </strong>
                  </div>
                  <div className="admin-user-field compact">
                    <span>Estatuto</span>
                    <strong>{registeredUser.status === "king_cromo" ? "King Cromo" : "Membro"}</strong>
                  </div>
                </div>
                <ChevronDown size={16} />
              </button>

                <div
                  id={userDetailsPanelId}
                  className={`admin-user-details-panel ${isDetailsOpen ? "open" : ""}`}
                  aria-hidden={!isDetailsOpen}
                >
                  <div className="admin-user-details-inner">
                    <div className="admin-user-details-grid">
                      {editingUserId === registeredUser.id && (
                        <>
                          <div className="admin-user-field primary">
                            <span>Utilizador</span>
                            <input
                              className="admin-table-input"
                              value={userDraft.username}
                              onChange={(e) => setUserDraft((prev) => ({ ...prev, username: e.target.value }))}
                            />
                          </div>
                          <div className="admin-user-field">
                            <span>Cidade</span>
                            <input
                              className="admin-table-input"
                              value={userDraft.city}
                              onChange={(e) => setUserDraft((prev) => ({ ...prev, city: e.target.value }))}
                            />
                          </div>
                        </>
                      )}
                      <div className="admin-user-field email">
                        <span>Email</span>
                        <strong>{registeredUser.email || "-"}</strong>
                      </div>
                      <div className="admin-user-field">
                        <span>Telefone</span>
                        {editingUserId === registeredUser.id ? (
                          <input
                            className="admin-table-input"
                            value={userDraft.phone}
                            onChange={(e) => setUserDraft((prev) => ({ ...prev, phone: e.target.value }))}
                          />
                        ) : (
                          <strong>{registeredUser.phone || "-"}</strong>
                        )}
                      </div>
                      <div className="admin-user-field compact">
                        <span>Tipo</span>
                        {editingUserId === registeredUser.id ? (
                          <label className="admin-check">
                            <input
                              type="checkbox"
                              checked={userDraft.is_admin}
                              disabled={registeredUser.id === user?.id}
                              onChange={(e) => setUserDraft((prev) => ({ ...prev, is_admin: e.target.checked }))}
                            />
                            Admin
                          </label>
                        ) : (
                          <strong>{registeredUser.is_admin ? "Admin" : "Utilizador"}</strong>
                        )}
                      </div>
                      <div className="admin-user-field compact">
                        <span>Estatuto</span>
                        {editingUserId === registeredUser.id ? (
                          <select
                            className="admin-table-input"
                            value={userDraft.status}
                            onChange={(e) => setUserDraft((prev) => ({ ...prev, status: e.target.value as "member" | "king_cromo" }))}
                          >
                            <option value="member">Membro</option>
                            <option value="king_cromo">King Cromo</option>
                          </select>
                        ) : (
                          <strong>{registeredUser.status === "king_cromo" ? "King Cromo" : "Membro"}</strong>
                        )}
                      </div>
                      {editingUserId === registeredUser.id && (
                        <div className="admin-user-field compact">
                          <span>Estado</span>
                          <label className="admin-check">
                            <input
                              type="checkbox"
                              checked={userDraft.is_blocked}
                              disabled={registeredUser.id === user?.id}
                              onChange={(e) => setUserDraft((prev) => ({ ...prev, is_blocked: e.target.checked }))}
                            />
                            Bloqueado
                          </label>
                        </div>
                      )}
                      <div className="admin-user-field compact">
                        <span>Registo</span>
                        <strong>{formatAdminDate(registeredUser.created_at)}</strong>
                      </div>
                    </div>

                    {pushUserId === registeredUser.id && (
                      <div className="admin-push-composer">
                        <div className="admin-push-composer-title">
                          <strong>Mensagem push</strong>
                          <button className="btn btn-ghost btn-xs" type="button" onClick={closePushComposer} disabled={saving}>
                            <X size={12} /> Fechar
                          </button>
                        </div>
                        <input
                          className="admin-table-input"
                          type="text"
                          value={pushTitle}
                          onChange={(event) => setPushTitle(event.target.value)}
                          placeholder="Titulo"
                          disabled={saving}
                        />
                        <textarea
                          className="admin-table-input"
                          value={pushMessage}
                          onChange={(event) => setPushMessage(event.target.value)}
                          placeholder="Mensagem para o utilizador"
                          disabled={saving}
                        />
                        <label className="admin-push-schedule">
                          <span>Agendar envio</span>
                          <input
                            className="admin-table-input"
                            type="datetime-local"
                            value={pushScheduledAt}
                            onChange={(event) => setPushScheduledAt(event.target.value)}
                            disabled={saving}
                          />
                          <em>Deixa vazio para enviar agora.</em>
                        </label>
                        <button className="btn btn-primary btn-xs" type="button" onClick={() => sendPushMessage(registeredUser)} disabled={saving}>
                          <Send size={12} /> {saving ? "A guardar..." : pushScheduledAt ? "Agendar push" : "Enviar agora"}
                        </button>
                      </div>
                    )}

                    <div className="admin-table-actions admin-user-card-actions">
                      {editingUserId === registeredUser.id ? (
                        <>
                          <button className="btn btn-primary btn-xs" onClick={() => saveUser(registeredUser.id)} disabled={saving}>
                            Guardar
                          </button>
                          <button className="btn btn-ghost btn-xs" onClick={cancelEditingUser} disabled={saving}>
                            <X size={12} /> Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => {
                              setOpenUserDetailsId(registeredUser.id);
                              startEditingUser(registeredUser);
                            }}
                            disabled={saving}
                          >
                            <Pencil size={12} /> Editar
                          </button>
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => loadUserCollection(registeredUser)}
                            disabled={saving || loadingUserCollection}
                          >
                            <BookOpen size={12} /> Colecao
                          </button>
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => sendPasswordReset(registeredUser)}
                            disabled={saving || !registeredUser.email}
                          >
                            <KeyRound size={12} /> Reset senha
                          </button>
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => openPushComposer(registeredUser)}
                            disabled={saving}
                          >
                            <Send size={12} /> Push
                          </button>
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => toggleBlockUser(registeredUser)}
                            disabled={saving || registeredUser.id === user?.id}
                          >
                            <Ban size={12} /> {registeredUser.is_blocked ? "Desbloquear" : "Bloquear"}
                          </button>
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => deleteUser(registeredUser)}
                            disabled={saving || registeredUser.id === user?.id}
                          >
                            <Trash2 size={12} /> Eliminar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
          {users.length === 0 && <p className="muted-text">Sem utilizadores registados.</p>}
        </div>
      </section>

      {selectedCollectionUser && (
        <section className="admin-panel admin-user-collection-panel">
          <div className="admin-panel-title admin-user-collection-title">
            <span>
              <BookOpen size={18} />
              <h3>Colecao de {selectedCollectionUser.username || selectedCollectionUser.email || "utilizador"}</h3>
            </span>
            <button className="btn btn-ghost btn-xs" type="button" onClick={closeUserCollection}>
              <X size={12} /> Fechar
            </button>
          </div>

          {loadingUserCollection ? (
            <div className="loading admin-inline-loading">A carregar colecao...</div>
          ) : (
            <div className="admin-user-collection-list">
              {selectedUserCollectionSummaries.map((summary) => (
                <div className="admin-user-collection-card" key={summary.collection.id}>
                  <div className="admin-user-collection-card-header">
                    <div>
                      <strong>{summary.collection.name}</strong>
                      <span>{summary.haveCount} de {summary.collection.total_stickers || 0} cromos</span>
                    </div>
                    <em>{summary.progress}%</em>
                  </div>

                  <div className="admin-user-collection-progress">
                    <span style={{ width: `${summary.progress}%` }} />
                  </div>

                  <div className="admin-user-collection-stats">
                    <span>Tenho: {summary.haveCount}</span>
                    <span>Repetidos: {summary.repeatedCount}</span>
                    <span>Procuro: {summary.wantedCount || summary.missingCount}</span>
                  </div>

                  <div className="admin-user-sticker-list">
                    {summary.entries.length > 0 ? (
                      summary.entries.map((entry) => (
                        <span
                          className={`admin-user-sticker-pill ${entry.status === "have" ? "have" : "want"}`}
                          key={entry.id}
                          title={entry.stickers?.name || "Cromo"}
                        >
                          #{entry.stickers?.number || "-"} {entry.status === "have" ? `x${entry.quantity}` : "procura"}
                        </span>
                      ))
                    ) : (
                      <span className="muted-text">Sem cromos registados nesta colecao.</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
