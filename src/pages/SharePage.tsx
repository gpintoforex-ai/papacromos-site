import { useEffect, useMemo, useState } from "react";
import { Copy, ExternalLink, Phone, QrCode, RefreshCw, Send, Share2, Trash2, UserPlus } from "lucide-react";
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
}

interface UserStickerRow {
  user_id: string;
  sticker_id: string;
  status: "have" | "want";
  quantity: number;
  stickers: StickerInfo | StickerInfo[];
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

const stickerSelect = "user_id, sticker_id, status, quantity, stickers(id, name, number, image_url, rarity)";

function getSticker(row: UserStickerRow) {
  return Array.isArray(row.stickers) ? row.stickers[0] : row.stickers;
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

export default function SharePage({ sharedUserId, onOpenSharedUser }: SharePageProps) {
  const { user, profile } = useAuth();
  const [shareUrl, setShareUrl] = useState("");
  const [friendPhone, setFriendPhone] = useState("");
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [friendProfile, setFriendProfile] = useState<SharedProfile | null>(null);
  const [friendRows, setFriendRows] = useState<UserStickerRow[]>([]);
  const [myRows, setMyRows] = useState<UserStickerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [addingFriend, setAddingFriend] = useState(false);
  const [removingFriendId, setRemovingFriendId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proposingKey, setProposingKey] = useState<string | null>(null);
  const viewingFriend = Boolean(sharedUserId && sharedUserId !== user?.id);

  useEffect(() => {
    setShareUrl(buildShareUrl(user?.id));
  }, [user?.id]);

  useEffect(() => {
    if (viewingFriend) {
      loadSharedAlbum();
    } else {
      setFriendProfile(null);
      setFriendRows([]);
      setMyRows([]);
      loadFriends();
    }
  }, [sharedUserId, user?.id]);

  const qrUrl = shareUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=12&data=${encodeURIComponent(shareUrl)}`
    : "";
  const shareText = `Ve a minha caderneta no Papa Cromos e propoe uma troca.`;

  const friendExtras = useMemo(() => friendRows
    .filter((row) => row.status === "have" && row.quantity > 1)
    .map((row) => ({ ...getSticker(row), availableQuantity: row.quantity - 1 })), [friendRows]);

  const myHaveStickerIds = useMemo(() => new Set(
    myRows.filter((row) => row.status === "have").map((row) => row.sticker_id)
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

      const { data: friendData, error: friendError } = await supabase
        .from("user_stickers")
        .select(stickerSelect)
        .eq("user_id", sharedUserId);
      if (friendError) throw friendError;

      const { data: myData, error: myError } = await supabase
        .from("user_stickers")
        .select(stickerSelect)
        .eq("user_id", user.id);
      if (myError) throw myError;

      setFriendProfile(profileData as SharedProfile | null);
      setFriendRows((friendData || []) as UserStickerRow[]);
      setMyRows((myData || []) as UserStickerRow[]);
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
      setMessage(`${friend.username || "Amigo"} adicionado.`);
      await loadFriends();
    } catch (err: any) {
      setError(err.message || "Erro ao adicionar amigo.");
    } finally {
      setAddingFriend(false);
    }
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
    onOpenSharedUser?.(friendId);
  };

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
            {error && <p className="error-text">{error}</p>}
          </div>
        </section>

        <section className="share-panel share-friends-panel">
          <div className="share-section-heading">
            <h3>Amigos</h3>
            <p>Adiciona amigos pelo numero de telefone associado ao perfil.</p>
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
                  onChange={(event) => setFriendPhone(event.target.value)}
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

          {loadingFriends ? (
            <div className="loading share-inline-loading">A carregar amigos...</div>
          ) : friends.length === 0 ? (
            <p className="muted-text">Ainda nao adicionaste amigos.</p>
          ) : (
            <div className="share-friend-list">
              {friends.map((friend) => (
                <div className="share-friend-card" key={friend.friend_id}>
                  <button type="button" onClick={() => openFriendAlbum(friend.friend_id)}>
                    <strong>{friend.profile?.username || "Utilizador"}</strong>
                    <span>{friend.profile?.city || "Cidade por definir"}</span>
                    <em>{friend.profile?.phone || "Sem telefone"}</em>
                  </button>
                  <button
                    className="btn btn-ghost btn-xs"
                    type="button"
                    onClick={() => removeFriend(friend.friend_id)}
                    disabled={removingFriendId === friend.friend_id}
                    title="Remover amigo"
                  >
                    <Trash2 size={12} /> Remover
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="share-page">
      <div className="share-header">
        <div>
          <h2>Caderneta partilhada</h2>
          <p>{friendProfile?.username ? `Caderneta de ${friendProfile.username}` : "Caderneta de outro colecionador"}</p>
        </div>
        <button className="btn btn-primary btn-sm" type="button" onClick={loadSharedAlbum}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {loading && <div className="loading">A carregar caderneta...</div>}
      {error && <p className="error-text">{error}</p>}
      {message && <p className="success-text">{message}</p>}

      {!loading && (
        <>
          <section className="shared-album-grid">
            <SharedStickerSection
              title="Repetidos do amigo"
              stickers={friendExtras}
              emptyText="Este utilizador ainda nao marcou repetidos."
              missingStickerIds={myHaveStickerIds}
              missingNotice="Nao tens este cromo"
            />
            <SharedStickerSection title="Cromos que procura" stickers={friendWants} emptyText="Este utilizador ainda nao marcou cromos procurados." />
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
}: {
  title: string;
  stickers: StickerInfo[];
  emptyText: string;
  missingStickerIds?: Set<string>;
  missingNotice?: string;
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
            />
          ))}
        </div>
      )}
    </section>
  );
}

function MiniSticker({ sticker, label, notice }: { sticker: StickerInfo; label?: string; notice?: string }) {
  return (
    <div className={`shared-mini-sticker ${notice ? "has-notice" : ""}`}>
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
    </div>
  );
}
