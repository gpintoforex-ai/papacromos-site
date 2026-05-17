import { useEffect, useState } from "react";
import { ArrowRightLeft, Ban, BookOpen, Camera, ChevronDown, KeyRound, PackagePlus, Pencil, RefreshCw, RotateCcw, Settings, Trash2, Users, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

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
  is_admin: boolean;
  is_blocked: boolean;
  created_at: string;
}

interface UserDraft {
  username: string;
  phone: string;
  city: string;
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

const emptyCollection = {
  name: "",
  description: "",
  image_url: "",
  total_stickers: "24",
};

const defaultStickerImage =
  "https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch.jpg?auto=compress&cs=tinysrgb&w=400";

const appLogoUrl = "https://hwqexlticbsokpqpqdvk.supabase.co/storage/v1/object/public/sticker-images/collections/new-1760223165876-105a2aec-9f65-47f0-adf1-b44b781e9ae6.png";

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

export default function AdminPage() {
  const { user, profile } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [draft, setDraft] = useState(emptyCollection);
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);
  const [openCollectionSettingsId, setOpenCollectionSettingsId] = useState<string | null>(null);
  const [openUserDetailsId, setOpenUserDetailsId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [selectedCollectionUserId, setSelectedCollectionUserId] = useState<string | null>(null);
  const [selectedUserStickers, setSelectedUserStickers] = useState<UserSticker[]>([]);
  const [imageSwapCollection, setImageSwapCollection] = useState<Collection | null>(null);
  const [imageSwapStickers, setImageSwapStickers] = useState<Sticker[]>([]);
  const [imageSwapTeamFilter, setImageSwapTeamFilter] = useState("");
  const [loadingImageSwap, setLoadingImageSwap] = useState(false);
  const [draggedStickerId, setDraggedStickerId] = useState<string | null>(null);
  const [selectedSwapStickerId, setSelectedSwapStickerId] = useState<string | null>(null);
  const [loadingUserCollection, setLoadingUserCollection] = useState(false);
  const [userDraft, setUserDraft] = useState<UserDraft>({
    username: "",
    phone: "",
    city: "",
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

  const loadAdminData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [collectionsRes, usersRes] = await Promise.all([
        supabase.from("collections").select("*").order("created_at", { ascending: false }),
        supabase
          .from("user_profiles")
          .select("id, username, email, phone, city, is_admin, is_blocked, created_at")
          .order("created_at", { ascending: false }),
      ]);

      if (collectionsRes.error) throw collectionsRes.error;
      if (usersRes.error) throw usersRes.error;

      setCollections((collectionsRes.data || []) as Collection[]);
      setUsers((usersRes.data || []) as RegisteredUser[]);
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
      const { error: sourceError } = await supabase
        .from("stickers")
        .update({ image_url: targetSticker.image_url || "" })
        .eq("id", sourceSticker.id);
      if (sourceError) throw sourceError;

      const { error: targetError } = await supabase
        .from("stickers")
        .update({ image_url: sourceSticker.image_url || "" })
        .eq("id", targetSticker.id);
      if (targetError) throw targetError;

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

  const selectedCollectionUser = users.find((registeredUser) => registeredUser.id === selectedCollectionUserId);
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
    <div className="admin-page">
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
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    swapStickerImages(draggedStickerId, sticker.id);
                  }}
                  onDragEnd={() => setDraggedStickerId(null)}
                  disabled={saving}
                  title={sticker.name}
                >
                  <span className="admin-image-swap-number">
                    #{imageSwapIsWorldAlbum ? getWorldAlbumLocalNumber(sticker.number) : sticker.number}
                  </span>
                  <img src={sticker.image_url || appLogoUrl} alt={sticker.name} loading="lazy" />
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

      <section className="admin-panel admin-users-panel">
        <div className="admin-panel-title">
          <Users size={18} />
          <h3>Utilizadores registados</h3>
        </div>

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
