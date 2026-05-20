import { useEffect, useMemo, useState } from "react";
import { Contacts } from "@capacitor-community/contacts";
import { Capacitor } from "@capacitor/core";
import { BookOpen, Copy, ExternalLink, Phone, QrCode, RefreshCw, Send, Share2, Trash2, UserPlus, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";

interface SharePageProps {
  sharedUserId?: string | null;
  onOpenSharedUser?: (userId: string) => void;
}

interface StickerInfo {
  id: string;
  name: string;
  number: number;
  image_url: string;
  rarity: string;
  collection_id?: string;
}

interface UserStickerRow {
  user_id: string;
  sticker_id: string;
  status: "have" | "want";
  quantity: number;
  stickers: StickerInfo | StickerInfo[];
}

interface Collection {
  id: string;
  name: string;
  description?: string | null;
  total_stickers: number;
}

interface SharedProfile {
  id: string;
  username?: string;
  avatar_seed?: string;
  city?: string | null;
  phone?: string | null;
}

interface FriendRow {
  friend_id: string;
  created_at: string;
  profile: SharedProfile | null;
}

interface TradeOption {
  friendExtra: StickerInfo;
  myExtra: StickerInfo;
}

const stickerSelect = "user_id, sticker_id, status, quantity, stickers(id, name, number, image_url, rarity, collection_id)";
const DATA_PAGE_SIZE = 1000;

function WhatsAppIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      focusable="false"
    >
      <path d="M20.52 3.48A11.85 11.85 0 0 0 12.08 0C5.49 0 .12 5.36.12 11.96c0 2.11.55 4.17 1.6 5.99L0 24l6.2-1.63a11.95 11.95 0 0 0 5.88 1.5h.01c6.6 0 11.96-5.36 11.96-11.96 0-3.19-1.24-6.19-3.53-8.43ZM12.09 21.85h-.01a9.93 9.93 0 0 1-5.06-1.38l-.36-.21-3.68.96.98-3.58-.23-.37a9.9 9.9 0 0 1-1.52-5.31c0-5.48 4.46-9.93 9.95-9.93 2.65 0 5.15 1.03 7.02 2.91a9.86 9.86 0 0 1 2.91 7.01c0 5.48-4.46 9.9-9.99 9.9Zm5.47-7.42c-.3-.15-1.78-.88-2.06-.98-.28-.1-.48-.15-.68.15-.2.3-.78.98-.95 1.18-.18.2-.35.23-.65.08-.3-.15-1.27-.47-2.42-1.49-.89-.79-1.49-1.77-1.67-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.53.15-.17.2-.3.3-.5.1-.2.05-.38-.03-.53-.08-.15-.68-1.64-.93-2.25-.25-.59-.5-.51-.68-.52h-.58c-.2 0-.53.08-.8.38-.28.3-1.05 1.02-1.05 2.49s1.08 2.9 1.23 3.1c.15.2 2.12 3.24 5.13 4.54.72.31 1.28.5 1.72.64.72.23 1.38.2 1.9.12.58-.09 1.78-.73 2.03-1.43.25-.7.25-1.31.18-1.43-.08-.14-.28-.21-.58-.36Z" />
    </svg>
  );
}

function getSticker(row: UserStickerRow) {
  return Array.isArray(row.stickers) ? row.stickers[0] : row.stickers;
}

async function fetchUserStickerRows(userId: string) {
  const rows: UserStickerRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("user_stickers")
      .select(stickerSelect)
      .eq("user_id", userId)
      .order("status", { ascending: true })
      .order("created_at", { ascending: true })
      .range(from, from + DATA_PAGE_SIZE - 1);

    if (error) throw error;
    rows.push(...((data || []) as UserStickerRow[]));

    if (!data || data.length < DATA_PAGE_SIZE) break;
    from += DATA_PAGE_SIZE;
  }

  return rows;
}

function buildShareUrl(userId?: string) {
  if (!userId || typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("share", userId);
  return url.toString();
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function getWhatsappPhone(phone: string) {
  const cleanPhone = normalizePhone(phone);
  if (cleanPhone.length === 9 && cleanPhone.startsWith("9")) {
    return `351${cleanPhone}`;
  }
  return cleanPhone;
}

export default function SharePage({ sharedUserId, onOpenSharedUser }: SharePageProps) {
  const { user, profile } = useAuth();
  const [shareUrl, setShareUrl] = useState("");
  const [friendPhone, setFriendPhone] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [showFriendsPage, setShowFriendsPage] = useState(false);
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [friendProfile, setFriendProfile] = useState<SharedProfile | null>(null);
  const [friendRows, setFriendRows] = useState<UserStickerRow[]>([]);
  const [myRows, setMyRows] = useState<UserStickerRow[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedFriendCollectionId, setSelectedFriendCollectionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [addingFriend, setAddingFriend] = useState(false);
  const [removingFriendId, setRemovingFriendId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proposingKey, setProposingKey] = useState<string | null>(null);
  const viewingFriend = Boolean(sharedUserId && sharedUserId !== user?.id);
  const friendDisplayName = friendProfile?.username || "amigo";
  const friendDisplayNameWithArticle = friendProfile?.username ? `o ${friendProfile.username}` : "o amigo";

  useEffect(() => {
    setShareUrl(buildShareUrl(user?.id));
  }, [user?.id]);

  useEffect(() => {
    if (viewingFriend) {
      setSelectedFriendCollectionId(null);
      loadSharedAlbum();
    } else {
      setFriendProfile(null);
      setFriendRows([]);
      setMyRows([]);
      setCollections([]);
      setSelectedFriendCollectionId(null);
      loadFriends();
    }
  }, [sharedUserId, user?.id]);

  const qrUrl = shareUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=12&data=${encodeURIComponent(shareUrl)}`
    : "";
  const shareText = `Ve a minha caderneta no Papa Cromos e propoe uma troca.`;
  const hasInvitePhone = normalizePhone(friendPhone) === invitePhone && invitePhone.length >= 6;
  const canPickNativeContacts = Capacitor.isNativePlatform();
  const canPickContacts = typeof navigator !== "undefined"
    && "contacts" in navigator
    && typeof (navigator as any).contacts?.select === "function";

  const friendExtras = useMemo(() => friendRows
    .filter((row) => row.status === "have" && row.quantity > 1)
    .map((row) => ({ ...getSticker(row), availableQuantity: row.quantity - 1 })), [friendRows]);

  const myHaveStickerIds = useMemo(() => new Set(
    myRows.filter((row) => row.status === "have" && (row.quantity || 0) > 0).map((row) => row.sticker_id)
  ), [myRows]);

  const myExtraStickerIds = useMemo(() => new Set(
    myRows.filter((row) => row.status === "have" && row.quantity > 1).map((row) => row.sticker_id)
  ), [myRows]);

  const friendWants = useMemo(() => friendRows
    .filter((row) => row.status === "want")
    .map((row) => getSticker(row)), [friendRows]);

  const tradeOptions = useMemo(() => {
    const myWantIds = new Set(myRows.filter((row) => row.status === "want").map((row) => row.sticker_id));
    const myExtras = myRows
      .filter((row) => row.status === "have" && row.quantity > 1)
      .map((row) => getSticker(row));
    const friendWantIds = new Set(friendRows.filter((row) => row.status === "want").map((row) => row.sticker_id));
    const matchingFriendExtras = friendExtras.filter((sticker) => myWantIds.has(sticker.id));
    const matchingMyExtras = myExtras.filter((sticker) => friendWantIds.has(sticker.id));
    const options: TradeOption[] = [];

    matchingFriendExtras.forEach((friendExtra) => {
      matchingMyExtras.forEach((myExtra) => {
        options.push({ friendExtra, myExtra });
      });
    });

    return options;
  }, [friendRows, friendExtras, myRows]);

  const copyShareLink = async () => {
    if (!shareUrl) return;
    setMessage(null);
    setError(null);
    try {
      await navigator.clipboard.writeText(shareUrl);
      setMessage("Link copiado.");
    } catch {
      setError("Nao foi possivel copiar automaticamente. Seleciona e copia o link.");
    }
  };

  const nativeShare = async () => {
    if (!shareUrl || !navigator.share) return;
    setMessage(null);
    setError(null);
    try {
      await navigator.share({
        title: "A minha caderneta Papa Cromos",
        text: shareText,
        url: shareUrl,
      });
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setError("Nao foi possivel abrir a partilha.");
      }
    }
  };

  const buildFriendExportText = () => {
    const friendHaveStickerIds = new Set(
      friendRows.filter((row) => row.status === "have" && row.quantity > 0).map((row) => row.sticker_id)
    );

    const myRepeatedThatFriendDoesNotHave = myRows
      .filter((row) => row.status === "have" && row.quantity > 1 && !friendHaveStickerIds.has(row.sticker_id))
      .map((row) => ({ sticker: getSticker(row), quantity: row.quantity - 1 }));

    const friendRepeated = friendRows
      .filter((row) => row.status === "have" && row.quantity > 1)
      .map((row) => ({ sticker: getSticker(row), quantity: row.quantity - 1 }));

    const friendName = friendProfile?.username || "esse amigo";
    const repeatedLines = myRepeatedThatFriendDoesNotHave.length
      ? myRepeatedThatFriendDoesNotHave
          .map((item) => `- #${String(item.sticker.number).padStart(3, "0")} ${item.sticker.name} (x${item.quantity})`)
          .join("\n")
      : "Nenhum repetido disponível que o amigo nao tem.";

    const friendOfferLines = friendRepeated.length
      ? friendRepeated
          .map((item) => `- #${String(item.sticker.number).padStart(3, "0")} ${item.sticker.name} (x${item.quantity})`)
          .join("\n")
      : "O amigo ainda nao tem repetidos para oferecer.";

    return [
      `Papa Cromos — Exportação de cromos para ${friendName}`,
      "",
      "Cromos repetidos que tenho e o amigo nao tem:",
      repeatedLines,
      "",
      `Cromos repetidos que ${friendName} pode oferecer:`,
      friendOfferLines,
      "",
      "Partilha este resumo para encontrar trocas mais rapido.",
    ].join("\n");
  };

  const copyTextToClipboard = async (text: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } finally {
      document.body.removeChild(textarea);
    }

    return copied;
  };

  const openWhatsappShare = (text: string) => {
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  const exportFriendStickers = async () => {
    setMessage(null);
    setError(null);
    const exportText = buildFriendExportText();

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Cromos repetidos e procurados de ${friendProfile?.username || "amigo"}`,
          text: exportText,
        });
        return;
      } catch (err: any) {
        if (err?.name === "AbortError") {
          return;
        }
      }
    }

    openWhatsappShare(exportText);

    const copied = await copyTextToClipboard(exportText).catch(() => false);
    if (copied) {
      setMessage("Resumo copiado para a área de transferência. O WhatsApp foi aberto em nova aba.");
      return;
    }

    setError("Nao foi possível copiar automaticamente. O WhatsApp foi aberto em nova aba; se não funcionar, copie manualmente o texto.");
  };

  const loadSharedAlbum = async () => {
    if (!sharedUserId || !user?.id) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { data: profileData, error: profileError } = await supabase
        .from("user_profiles")
        .select("id, username, avatar_seed, city")
        .eq("id", sharedUserId)
        .maybeSingle();
      if (profileError) throw profileError;

      const [friendData, myData, collectionsData] = await Promise.all([
        fetchUserStickerRows(sharedUserId),
        fetchUserStickerRows(user.id),
        supabase.from("collections").select("id, name, description, total_stickers").order("name", { ascending: true }),
      ]);

      if (collectionsData.error) throw collectionsData.error;

      setFriendProfile(profileData as SharedProfile | null);
      setFriendRows(friendData);
      setMyRows(myData);
      setCollections((collectionsData.data || []) as Collection[]);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar caderneta partilhada.");
    } finally {
      setLoading(false);
    }
  };

  const loadFriends = async () => {
    if (!user?.id) return;
    setLoadingFriends(true);
    try {
      const { data: friendRowsData, error: friendsError } = await supabase
        .from("user_friends")
        .select("friend_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (friendsError) throw friendsError;

      const friendIds = (friendRowsData || []).map((row: any) => row.friend_id);
      let profilesById = new Map<string, SharedProfile>();
      if (friendIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("user_profiles")
          .select("id, username, avatar_seed, city, phone")
          .in("id", friendIds);
        if (profilesError) throw profilesError;
        profilesById = new Map(((profiles || []) as SharedProfile[]).map((row) => [row.id, row]));
      }

      setFriends(((friendRowsData || []) as any[]).map((row) => ({
        friend_id: row.friend_id,
        created_at: row.created_at,
        profile: profilesById.get(row.friend_id) || null,
      })));
    } catch (err: any) {
      setError(err.message || "Erro ao carregar amigos.");
    } finally {
      setLoadingFriends(false);
    }
  };

  const addFriendByPhone = async () => {
    if (!user?.id) return;
    const cleanPhone = normalizePhone(friendPhone);
    setError(null);
    setMessage(null);
    setInvitePhone("");

    if (cleanPhone.length < 6) {
      setError("Indica um numero de telefone valido.");
      return;
    }

    setAddingFriend(true);
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("user_profiles")
        .select("id, username, avatar_seed, city, phone")
        .not("phone", "is", null);
      if (profilesError) throw profilesError;

      const friend = ((profiles || []) as SharedProfile[]).find((row) =>
        row.id !== user.id && normalizePhone(row.phone || "") === cleanPhone
      );

      if (!friend) {
        setInvitePhone(cleanPhone);
        setError("Nao encontrei nenhum utilizador com esse telefone.");
        return;
      }

      const { error: insertError } = await supabase.from("user_friends").insert({
        user_id: user.id,
        friend_id: friend.id,
      });
      if (insertError) {
        if (insertError.code === "23505") {
          setMessage("Esse amigo ja esta na tua lista.");
          return;
        }
        throw insertError;
      }

      setFriendPhone("");
      setInvitePhone("");
      setShowAddFriendModal(false);
      setMessage(`${friend.username || "Amigo"} adicionado.`);
      await loadFriends();
    } catch (err: any) {
      setError(err.message || "Erro ao adicionar amigo.");
    } finally {
      setAddingFriend(false);
    }
  };

  const openAddFriendModal = () => {
    setShowAddFriendModal(true);
    setInvitePhone("");
    setError(null);
    setMessage(null);
  };

  const closeAddFriendModal = () => {
    setShowAddFriendModal(false);
    setInvitePhone("");
    setError(null);
  };

  const openFriendsPage = () => {
    setShowFriendsPage(true);
    setError(null);
    loadFriends();
  };

  const closeFriendsPage = () => {
    setShowFriendsPage(false);
  };

  const pickFriendContact = async () => {
    if (canPickNativeContacts) {
      try {
        const permission = await Contacts.requestPermissions();
        if (permission.contacts !== "granted" && permission.contacts !== "limited") {
          setError("Permite o acesso aos contactos para escolher um amigo.");
          return;
        }

        const result = await Contacts.pickContact({ projection: { name: true, phones: true } });
        const phone = result.contact.phones?.find((item) => item.number)?.number || "";
        if (!phone) {
          setError("Esse contacto nao tem telefone disponivel.");
          return;
        }

        setFriendPhone(phone);
        setInvitePhone("");
        setError(null);
        return;
      } catch (err: any) {
        if (err?.name === "AbortError" || err?.message?.toLowerCase?.().includes("cancel")) return;
        setError("Nao foi possivel aceder aos contactos.");
        return;
      }
    }

    const contactsApi = (navigator as any).contacts;
    if (!contactsApi?.select) {
      setError("A lista de contactos nao esta disponivel neste dispositivo.");
      return;
    }

    try {
      const contacts = await contactsApi.select(["tel"], { multiple: false });
      const phone = contacts?.[0]?.tel?.[0] || "";
      if (!phone) {
        setError("Esse contacto nao tem telefone disponivel.");
        return;
      }

      setFriendPhone(phone);
      setInvitePhone("");
      setError(null);
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setError("Nao foi possivel aceder aos contactos.");
    }
  };

  const inviteFriendByWhatsapp = () => {
    const whatsappPhone = getWhatsappPhone(invitePhone || friendPhone);
    if (!whatsappPhone) return;

    const text = [
      "Instala o Papa Cromos para veres a minha caderneta e fazermos trocas.",
      shareUrl ? `Acede aqui: ${shareUrl}` : "",
    ].filter(Boolean).join("\n\n");
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${whatsappPhone}&text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  const removeFriend = async (friendId: string) => {
    if (!user?.id) return;
    setRemovingFriendId(friendId);
    setError(null);
    setMessage(null);
    try {
      const { error: deleteError } = await supabase
        .from("user_friends")
        .delete()
        .eq("user_id", user.id)
        .eq("friend_id", friendId);
      if (deleteError) throw deleteError;
      setFriends((current) => current.filter((row) => row.friend_id !== friendId));
      setMessage("Amigo removido.");
    } catch (err: any) {
      setError(err.message || "Erro ao remover amigo.");
    } finally {
      setRemovingFriendId(null);
    }
  };

  const openFriendAlbum = (friendId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("share", friendId);
    window.history.replaceState({}, "", url.toString());
    setShowFriendsPage(false);
    onOpenSharedUser?.(friendId);
  };

  const friendCollectionSummaries = useMemo(() => {
    const collectionMap = new Map<string, {
      collection: Collection;
      have: number;
      repeated: number;
      want: number;
      stickers: StickerInfo[];
    }>();

    collections.forEach((collection) => {
      collectionMap.set(collection.id, {
        collection,
        have: 0,
        repeated: 0,
        want: 0,
        stickers: [],
      });
    });

    friendRows.forEach((row) => {
      const sticker = getSticker(row);
      if (!sticker || !sticker.collection_id) return;
      const summary = collectionMap.get(sticker.collection_id);
      if (!summary) return;

      summary.stickers.push(sticker);
      if (row.status === "have") {
        summary.have += row.quantity || 0;
        if (row.quantity > 1) {
          summary.repeated += row.quantity - 1;
        }
      }
      if (row.status === "want") {
        summary.want += 1;
      }
    });

    return Array.from(collectionMap.values()).sort((a, b) => a.collection.name.localeCompare(b.collection.name));
  }, [collections, friendRows]);

  const selectedFriendCollection = useMemo(() => {
    if (!selectedFriendCollectionId) return friendCollectionSummaries[0] || null;
    return friendCollectionSummaries.find((item) => item.collection.id === selectedFriendCollectionId) || null;
  }, [friendCollectionSummaries, selectedFriendCollectionId]);

  useEffect(() => {
    if (!selectedFriendCollectionId && friendCollectionSummaries.length > 0) {
      setSelectedFriendCollectionId(friendCollectionSummaries[0].collection.id);
    }
  }, [friendCollectionSummaries, selectedFriendCollectionId]);

  const proposeTrade = async (option: TradeOption) => {
    if (!user?.id || !sharedUserId) return;
    const key = `${option.myExtra.id}:${option.friendExtra.id}`;
    setProposingKey(key);
    setError(null);
    setMessage(null);
    try {
      const { error: tradeError } = await supabase.from("trade_offers").insert({
        from_user_id: user.id,
        to_user_id: sharedUserId,
        offered_sticker_id: option.myExtra.id,
        requested_sticker_id: option.friendExtra.id,
        delivery_method: "presencial",
        note: `Proposta criada pela partilha de caderneta: ofereco ${option.myExtra.name} e procuro ${option.friendExtra.name}.`,
        status: "pending",
      });
      if (tradeError) throw tradeError;
      setMessage("Proposta enviada.");
    } catch (err: any) {
      setError(err.message || "Erro ao enviar proposta.");
    } finally {
      setProposingKey(null);
    }
  };

  if (!viewingFriend) {
    return (
      <div className="share-page">
        <div className="share-header">
          <div>
            <h2>Partilhar caderneta</h2>
            <p>Mostra este QR para outro colecionador abrir a tua caderneta e propor trocas.</p>
          </div>
          <div className="share-header-actions">
            <button className="btn btn-secondary btn-sm share-main-friends-btn" type="button" onClick={openFriendsPage}>
              <BookOpen size={14} /> Amigos
            </button>
          </div>
        </div>

        <section className="share-panel">
          <div className="share-qr-card">
            {qrUrl ? <img src={qrUrl} alt="QR da tua caderneta" /> : <QrCode size={120} />}
          </div>
          <div className="share-details">
            <span>A tua caderneta</span>
            <strong>{profile?.username || user?.email?.split("@")[0] || "Utilizador"}</strong>
            <input value={shareUrl} readOnly onFocus={(event) => event.currentTarget.select()} />
            <div className="share-actions">
              {"share" in navigator && (
                <button className="btn btn-primary" type="button" onClick={nativeShare}>
                  <Share2 size={16} /> Partilhar
                </button>
              )}
              <button className="btn btn-primary" type="button" onClick={copyShareLink}>
                <Copy size={16} /> Copiar link
              </button>
              <a className="btn btn-ghost" href={shareUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={16} /> Abrir
              </a>
            </div>
            {message && <p className="success-text">{message}</p>}
            {error && !showAddFriendModal && !showFriendsPage && !hasInvitePhone && <p className="error-text">{error}</p>}
          </div>
        </section>

        <section className="share-panel share-friends-panel">
          <div className="share-section-heading">
            <h3>Amigos</h3>
            <p>Adiciona amigos pelo numero de telefone associado ao perfil.</p>
          </div>

          {loadingFriends ? (
            <div className="loading share-inline-loading">A carregar amigos...</div>
          ) : friends.length === 0 ? (
            <p className="muted-text">Ainda nao adicionaste amigos.</p>
          ) : (
            <div className="share-friend-list">
              {friends.map((friend) => (
                <div className="share-friend-card" key={friend.friend_id}>
                  <div className="share-friend-info">
                    <strong>{friend.profile?.username || "Utilizador"}</strong>
                    <span>{friend.profile?.city || "Cidade por definir"}</span>
                    <em>{friend.profile?.phone || "Sem telefone"}</em>
                  </div>
                  <div className="share-friend-actions">
                    <button
                      className="btn btn-secondary btn-sm"
                      type="button"
                      onClick={() => openFriendAlbum(friend.friend_id)}
                    >
                      <BookOpen size={14} /> Coleção
                    </button>
                    <button
                      className="btn btn-danger-soft btn-xs"
                      type="button"
                      onClick={() => removeFriend(friend.friend_id)}
                      disabled={removingFriendId === friend.friend_id}
                      title="Remover amigo"
                      aria-label="Remover amigo"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {showAddFriendModal && (
          <div className="share-add-friend-backdrop" role="presentation" onClick={closeAddFriendModal}>
            <div className="share-add-friend-modal" role="dialog" aria-modal="true" aria-labelledby="add-friend-title" onClick={(event) => event.stopPropagation()}>
              <div className="share-add-friend-header">
                <div>
                  <h3 id="add-friend-title">Adicionar amigo</h3>
                  <p>Escolhe um contacto ou escreve o telefone.</p>
                </div>
                <button className="btn btn-ghost btn-xs" type="button" onClick={closeAddFriendModal} aria-label="Fechar">
                  <X size={16} />
                </button>
              </div>

              <div className="share-friend-form">
                <label>
                  Telefone do amigo
                  <span>
                    <Phone size={16} />
                    <input
                      value={friendPhone}
                      inputMode="tel"
                      placeholder="Ex.: 966456332"
                      autoFocus
                      onChange={(event) => {
                        setFriendPhone(event.target.value);
                        if (invitePhone && normalizePhone(event.target.value) !== invitePhone) {
                          setInvitePhone("");
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") addFriendByPhone();
                      }}
                    />
                  </span>
                </label>
                <button className="btn btn-primary" type="button" onClick={addFriendByPhone} disabled={addingFriend}>
                  <UserPlus size={16} /> {addingFriend ? "A adicionar..." : "Adicionar amigo"}
                </button>
              </div>

              <button className="btn btn-secondary share-contact-picker-btn" type="button" onClick={pickFriendContact} disabled={!canPickNativeContacts && !canPickContacts}>
                <Phone size={16} /> Lista de contactos
              </button>

              {error && !hasInvitePhone && <p className="error-text">{error}</p>}
              {!canPickNativeContacts && !canPickContacts && <p className="muted-text">A lista de contactos so aparece em dispositivos e browsers compatíveis.</p>}

              {hasInvitePhone && (
                <div className="share-whatsapp-invite-panel" role="status" aria-live="polite">
                  <button className="btn btn-secondary share-whatsapp-invite" type="button" onClick={inviteFriendByWhatsapp}>
                    <WhatsAppIcon size={16} /> Convidar por WhatsApp
                  </button>
                  {error && <p className="error-text">{error}</p>}
                </div>
              )}
            </div>
          </div>
        )}

        {showFriendsPage && (
          <div className="share-friends-page" role="dialog" aria-modal="true" aria-labelledby="friends-page-title">
            <div className="share-friends-page-header">
              <div>
                <h3 id="friends-page-title">Amigos</h3>
                <p>Abre a caderneta de um amigo ou remove-o da tua lista.</p>
              </div>
              <div className="share-header-actions">
                <button className="btn btn-primary btn-sm" type="button" onClick={openAddFriendModal}>
                  <UserPlus size={14} /> Adicionar amigo
                </button>
                <button className="btn btn-ghost btn-xs" type="button" onClick={closeFriendsPage} aria-label="Fechar">
                  <X size={16} />
                </button>
              </div>
            </div>

            {message && <p className="success-text">{message}</p>}
            {error && !showAddFriendModal && <p className="error-text">{error}</p>}

            {loadingFriends ? (
              <div className="loading share-inline-loading">A carregar amigos...</div>
            ) : friends.length === 0 ? (
              <p className="muted-text">Ainda nao adicionaste amigos.</p>
            ) : (
              <div className="share-friend-list">
                {friends.map((friend) => (
                  <div className="share-friend-card" key={friend.friend_id}>
                    <div className="share-friend-info">
                      <strong>{friend.profile?.username || "Utilizador"}</strong>
                      <span>{friend.profile?.city || "Cidade por definir"}</span>
                      <em>{friend.profile?.phone || "Sem telefone"}</em>
                    </div>
                    <div className="share-friend-actions">
                      <button
                        className="btn btn-secondary btn-sm"
                        type="button"
                        onClick={() => openFriendAlbum(friend.friend_id)}
                      >
                        <BookOpen size={14} /> Colecao
                      </button>
                      <button
                        className="btn btn-danger-soft btn-xs"
                        type="button"
                        onClick={() => removeFriend(friend.friend_id)}
                        disabled={removingFriendId === friend.friend_id}
                        title="Remover amigo"
                        aria-label="Remover amigo"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="share-page">
      <div className="share-header share-shared-header">
        <div>
          <div className="share-shared-title-row">
            <h2>Caderneta partilhada</h2>
            <button className="btn btn-primary btn-sm" type="button" onClick={loadSharedAlbum}>
              <RefreshCw size={14} /> Atualizar
            </button>
          </div>
          <p>{friendProfile?.username ? `Caderneta do ${friendProfile.username}` : "Caderneta de outro colecionador"}</p>
        </div>
        <div className="share-header-actions share-shared-header-actions">
          <button className="btn btn-secondary btn-sm share-export-stickers-btn" type="button" onClick={exportFriendStickers}>
            <WhatsAppIcon size={14} /> Exportar cromos
          </button>
        </div>
      </div>

      {loading && <div className="loading">A carregar caderneta...</div>}
      {error && <p className="error-text">{error}</p>}
      {message && <p className="success-text">{message}</p>}

      {!loading && (
        <>
          <section className="shared-album-grid">
            <SharedStickerSection
              title={`Repetidos do ${friendDisplayName}`}
              stickers={friendExtras}
              emptyText="Este utilizador ainda nao marcou repetidos."
              missingStickerIds={myHaveStickerIds}
              missingNotice="Nao tens este cromo"
            />
            <SharedStickerSection
              title={`Cromos que ${friendDisplayNameWithArticle} procura`}
              stickers={friendWants}
              emptyText="Este utilizador ainda nao marcou cromos procurados."
              highlightedStickerIds={myExtraStickerIds}
              highlightedNotice="Tens repetido para oferecer"
            />
          </section>

          <section className="share-panel share-trade-panel">
            <div className="share-section-heading">
              <h3>Trocas compativeis</h3>
              <p>Propostas possiveis entre os teus repetidos e os cromos que ambos procuram.</p>
            </div>
            {tradeOptions.length === 0 ? (
              <p className="muted-text">Sem trocas compativeis de momento.</p>
            ) : (
              <div className="share-trade-list">
                {tradeOptions.map((option) => {
                  const key = `${option.myExtra.id}:${option.friendExtra.id}`;
                  return (
                    <div className="share-trade-option" key={key}>
                      <MiniSticker sticker={option.myExtra} label="Ofereces" />
                      <span className="share-trade-arrow">↔</span>
                      <MiniSticker sticker={option.friendExtra} label="Recebes" />
                      <button className="btn btn-primary btn-sm" type="button" onClick={() => proposeTrade(option)} disabled={proposingKey === key}>
                        <Send size={14} /> {proposingKey === key ? "A enviar..." : "Propor"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="share-panel share-collections-panel">
            <div className="admin-panel-title">
              <BookOpen size={18} />
              <h3>Coleções</h3>
            </div>

            <div className="admin-list">
              {friendCollectionSummaries.length === 0 && (
                <p className="muted-text">Sem coleções disponíveis para este utilizador.</p>
              )}
              {friendCollectionSummaries.map(({ collection, have }) => (
                <button
                  key={collection.id}
                  className={`admin-list-row ${selectedFriendCollectionId === collection.id ? "selected" : ""}`}
                  type="button"
                  onClick={() => setSelectedFriendCollectionId(collection.id)}
                >
                  <div>
                    <strong>{collection.name}</strong>
                    <span>{collection.description || "Sem descricao"}</span>
                  </div>
                  <div className="admin-list-actions">
                    <em>{have} de {collection.total_stickers} cromos</em>
                  </div>
                </button>
              ))}
            </div>

            {selectedFriendCollection ? (
              <div className="share-collection-details">
                <div className="share-collection-summary">
                  <div>
                    <strong>{selectedFriendCollection.collection.name}</strong>
                    <p>{selectedFriendCollection.have} de {selectedFriendCollection.collection.total_stickers} cromos</p>
                  </div>
                  <div className="collection-progress-bar">
                    <div style={{ width: `${Math.min(100, selectedFriendCollection.collection.total_stickers ? (selectedFriendCollection.have / selectedFriendCollection.collection.total_stickers) * 100 : 0)}%` }} />
                  </div>
                  <div className="collection-summary pills">
                    <span className="admin-user-sticker-pill have">Tenho {selectedFriendCollection.have}</span>
                    <span className="admin-user-sticker-pill have multi">Repetidos {selectedFriendCollection.repeated}</span>
                    <span className="admin-user-sticker-pill want">Procuro {selectedFriendCollection.want}</span>
                  </div>
                </div>

                <div className="share-collection-stickers">
                  {selectedFriendCollection.stickers.length === 0 ? (
                    <p className="muted-text">Nenhum cromo registado nesta colecao.</p>
                  ) : (
                    <div className="admin-user-sticker-pill-list">
                      {selectedFriendCollection.stickers
                        .sort((a, b) => a.number - b.number)
                        .map((sticker) => {
                          const isWant = friendRows.some(
                            (row) => row.sticker_id === sticker.id && row.status === "want"
                          );
                          const quantity = friendRows
                            .find((row) => row.sticker_id === sticker.id && row.status === "have")?.quantity || 0;
                          const label = isWant ? "procura" : quantity > 1 ? "repetido" : "tenho";
                          const pillClass = isWant ? "admin-user-sticker-pill want" : quantity > 1 ? "admin-user-sticker-pill have multi" : "admin-user-sticker-pill have";

                          return (
                            <span key={sticker.id} className={pillClass} title={`${sticker.name} (#${String(sticker.number).padStart(3, "0")})`}>
                              #{String(sticker.number).padStart(3, "0")} {label}
                            </span>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}

function SharedStickerSection({
  title,
  stickers,
  emptyText,
  missingStickerIds,
  missingNotice,
  highlightedStickerIds,
  highlightedNotice,
}: {
  title: string;
  stickers: StickerInfo[];
  emptyText: string;
  missingStickerIds?: Set<string>;
  missingNotice?: string;
  highlightedStickerIds?: Set<string>;
  highlightedNotice?: string;
}) {
  return (
    <section className="share-panel">
      <div className="share-section-heading">
        <h3>{title}</h3>
        <p>{stickers.length} cromo{stickers.length === 1 ? "" : "s"}</p>
      </div>
      {stickers.length === 0 ? (
        <p className="muted-text">{emptyText}</p>
      ) : (
        <div className="shared-sticker-grid">
          {stickers.map((sticker) => (
            <MiniSticker
              key={sticker.id}
              sticker={sticker}
              notice={missingStickerIds && !missingStickerIds.has(sticker.id) ? missingNotice : undefined}
              highlightNotice={highlightedStickerIds?.has(sticker.id) ? highlightedNotice : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function MiniSticker({
  sticker,
  label,
  notice,
  highlightNotice,
}: {
  sticker: StickerInfo;
  label?: string;
  notice?: string;
  highlightNotice?: string;
}) {
  const cardStateClass = notice ? "has-notice" : highlightNotice ? "has-positive-notice" : "";

  return (
    <div className={`shared-mini-sticker ${cardStateClass}`}>
      {label && <em>{label}</em>}
      <img
        src={sticker.image_url || "/logo.png"}
        alt={sticker.name}
        onError={(event) => {
          event.currentTarget.src = "/logo.png";
        }}
      />
      <strong>#{String(sticker.number).padStart(3, "0")}</strong>
      <span>{sticker.name}</span>
      {notice && <small>{notice}</small>}
      {highlightNotice && <small>{highlightNotice}</small>}
    </div>
  );
}
