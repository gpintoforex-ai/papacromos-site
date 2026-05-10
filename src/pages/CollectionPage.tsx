import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import StickerCard from "../components/StickerCard";
import { Search, BookOpen, Camera, ArrowLeft, X } from "lucide-react";

interface Collection {
  id: string;
  name: string;
  description: string;
  image_url: string;
  total_stickers: number;
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
  stickers: Sticker;
}

type FilterMode = "all" | "have" | "repeated" | "want" | "missing";

const collectionFallbackImage =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23f3f4f6'/%3E%3Crect x='92' y='70' width='216' height='260' rx='18' fill='%23ffffff' stroke='%23d1d5db' stroke-width='10'/%3E%3Cpath d='M132 132h136v24H132zm0 58h136v24H132zm0 58h92v24h-92z' fill='%239ca3af'/%3E%3C/svg%3E";

interface CollectionPageProps {
  homeKey: number;
  onCollectionChange?: () => void;
}

export default function CollectionPage({ homeKey, onCollectionChange }: CollectionPageProps) {
  const { user, profile } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [userStickers, setUserStickers] = useState<UserSticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [uploadingImageId, setUploadingImageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [user]);

  useEffect(() => {
    setSelectedCollectionId(null);
    setSearch("");
    setFilter("all");
    setSelectedStickerId(null);
  }, [homeKey]);

  useEffect(() => {
    if (!selectedCollectionId || !user?.id || stickers.length === 0) return;
    syncWantedForCollection(selectedCollectionId);
  }, [selectedCollectionId, stickers.length, userStickers.length, user?.id]);

  useEffect(() => {
    if (!selectedStickerId) return;

    const timeoutId = window.setTimeout(() => {
      const card = document.querySelector(`[data-sticker-id="${selectedStickerId}"]`);
      card?.scrollIntoView({ block: "center", inline: "nearest" });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [selectedStickerId, userStickers]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!user?.id) {
        setCollections([]);
        setStickers([]);
        setUserStickers([]);
        return;
      }

      const [collectionsRes, stickersRes, userStickersRes] = await Promise.all([
        supabase.from("collections").select("*").order("created_at", { ascending: false }),
        supabase.from("stickers").select("*").order("number", { ascending: true }),
        supabase
          .from("user_stickers")
          .select("id, user_id, sticker_id, status, quantity, stickers(*)")
          .eq("user_id", user.id),
      ]);

      if (collectionsRes.error) throw collectionsRes.error;
      if (stickersRes.error) throw stickersRes.error;
      if (userStickersRes.error) throw userStickersRes.error;

      if (collectionsRes.data) setCollections(collectionsRes.data);
      if (stickersRes.data) setStickers(stickersRes.data);
      if (userStickersRes.data) {
        const ownStickers = (userStickersRes.data as unknown as UserSticker[]).filter(
          (userSticker) => userSticker.user_id === user.id
        );
        setUserStickers(ownStickers);
      }
    } catch (err: any) {
      setError(err.message || "Erro ao carregar caderneta.");
    } finally {
      setLoading(false);
    }
  };

  const getUserSticker = (stickerId: string) => {
    return userStickers.find((us) => us.user_id === user?.id && us.sticker_id === stickerId && us.status === "have");
  };

  const hasUserStickerStatus = (stickerId: string, status: "have" | "want") => {
    return userStickers.some((us) => us.user_id === user?.id && us.sticker_id === stickerId && us.status === status);
  };

  const addSticker = async (stickerId: string, status: "have" | "want") => {
    setError(null);
    try {
      if (!user?.id) throw new Error("Sessao expirada. Entra novamente.");

      const existing = userStickers.find((us) => us.user_id === user.id && us.sticker_id === stickerId && us.status === status);
      if (existing) {
        const { error: updateError } = await supabase
          .from("user_stickers")
          .update({ quantity: existing.quantity + 1 })
          .eq("id", existing.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("user_stickers").insert({
          user_id: user.id,
          sticker_id: stickerId,
          status,
          quantity: 1,
        });
        if (insertError) throw insertError;
      }

      if (status === "have") {
        const existingWant = userStickers.find((us) => us.user_id === user.id && us.sticker_id === stickerId && us.status === "want");
        if (existingWant) {
          const { error: deleteWantError } = await supabase.from("user_stickers").delete().eq("id", existingWant.id);
          if (deleteWantError) throw deleteWantError;
        }
      }
      await loadData();
      onCollectionChange?.();
    } catch (err: any) {
      setError(err.message || "Erro ao atualizar cromo.");
    }
  };

  const ensureWantSticker = async (stickerId: string) => {
    if (!user?.id) return;
    const existingWant = userStickers.find((us) => us.user_id === user.id && us.sticker_id === stickerId && us.status === "want");
    if (existingWant) return;

    const { error: insertError } = await supabase.from("user_stickers").insert({
      user_id: user.id,
      sticker_id: stickerId,
      status: "want",
      quantity: 1,
    });
    if (insertError) throw insertError;
  };

  const syncWantedForCollection = async (collectionId: string) => {
    if (!user?.id) return;

    const collectionStickers = stickers.filter((sticker) => sticker.collection_id === collectionId);
    if (collectionStickers.length === 0) return;

    const haveIds = new Set(
      userStickers
        .filter((us) => us.user_id === user.id && us.status === "have")
        .map((us) => us.sticker_id)
    );
    const wantIds = new Set(
      userStickers
        .filter((us) => us.user_id === user.id && us.status === "want")
        .map((us) => us.sticker_id)
    );

    const wantsToCreate = collectionStickers
      .filter((sticker) => !haveIds.has(sticker.id) && !wantIds.has(sticker.id))
      .map((sticker) => ({
        user_id: user.id,
        sticker_id: sticker.id,
        status: "want",
        quantity: 1,
      }));

    const wantsToRemove = userStickers.filter(
      (us) => us.user_id === user.id && us.status === "want" && haveIds.has(us.sticker_id)
    );

    if (wantsToCreate.length === 0 && wantsToRemove.length === 0) return;

    try {
      if (wantsToCreate.length > 0) {
        const { error: insertError } = await supabase.from("user_stickers").insert(wantsToCreate);
        if (insertError) throw insertError;
      }

      if (wantsToRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from("user_stickers")
          .delete()
          .in("id", wantsToRemove.map((want) => want.id));
        if (deleteError) throw deleteError;
      }

      await loadData();
      onCollectionChange?.();
    } catch (err: any) {
      setError(err.message || "Erro ao sincronizar cromos em falta.");
    }
  };

  const removeSticker = async (userStickerId: string) => {
    const userSticker = userStickers.find((us) => us.user_id === user?.id && us.id === userStickerId);
    const { error: deleteError } = await supabase.from("user_stickers").delete().eq("id", userStickerId);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    if (userSticker?.status === "have") {
      await ensureWantSticker(userSticker.sticker_id);
    }
    await loadData();
    onCollectionChange?.();
  };

  const addQuantity = async (userStickerId: string) => {
    setError(null);
    try {
      const us = userStickers.find((u) => u.user_id === user?.id && u.id === userStickerId);
      if (us) {
        const { error: updateError } = await supabase
          .from("user_stickers")
          .update({ quantity: us.quantity + 1 })
          .eq("id", userStickerId);
        if (updateError) throw updateError;
        await loadData();
        onCollectionChange?.();
      }
    } catch (err: any) {
      setError(err.message || "Erro ao atualizar quantidade.");
    }
  };

  const reduceQuantity = async (userStickerId: string) => {
    setError(null);
    try {
      const us = userStickers.find((u) => u.user_id === user?.id && u.id === userStickerId);
      if (us) {
        if (us.quantity <= 1) {
          await removeSticker(userStickerId);
        } else {
          const { error: updateError } = await supabase
            .from("user_stickers")
            .update({ quantity: us.quantity - 1 })
            .eq("id", userStickerId);
          if (updateError) throw updateError;
          await loadData();
          onCollectionChange?.();
        }
      }
    } catch (err: any) {
      setError(err.message || "Erro ao atualizar quantidade.");
    }
  };

  const uploadStickerImage = async (stickerId: string, file: File | null) => {
    if (!file || !user?.id) return;

    setUploadingImageId(stickerId);
    setError(null);
    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${stickerId}/${Date.now()}-${user.id}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("sticker-images")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from("sticker-images").getPublicUrl(filePath);
      const { error: updateImageError } = await supabase.rpc("update_sticker_image", {
        p_sticker_id: stickerId,
        p_image_url: publicUrlData.publicUrl,
      });
      if (updateImageError) throw updateImageError;

      const existingHave = userStickers.find(
        (userSticker) => userSticker.user_id === user.id && userSticker.sticker_id === stickerId && userSticker.status === "have"
      );
      if (!existingHave) {
        const { error: insertHaveError } = await supabase.from("user_stickers").insert({
          user_id: user.id,
          sticker_id: stickerId,
          status: "have",
          quantity: 1,
        });
        if (insertHaveError) throw insertHaveError;
      }

      const existingWant = userStickers.find(
        (userSticker) => userSticker.user_id === user.id && userSticker.sticker_id === stickerId && userSticker.status === "want"
      );
      if (existingWant) {
        const { error: deleteWantError } = await supabase.from("user_stickers").delete().eq("id", existingWant.id);
        if (deleteWantError) throw deleteWantError;
      }

      await loadData();
      onCollectionChange?.();
    } catch (err: any) {
      setError(err.message || "Erro ao atualizar imagem global do cromo.");
    } finally {
      setUploadingImageId(null);
    }
  };

  const removeStickerImage = async (stickerId: string) => {
    if (!profile?.is_admin) return;

    setUploadingImageId(stickerId);
    setError(null);
    try {
      const { error: updateImageError } = await supabase.rpc("update_sticker_image", {
        p_sticker_id: stickerId,
        p_image_url: "",
      });
      if (updateImageError) throw updateImageError;

      await loadData();
    } catch (err: any) {
      setError(err.message || "Erro ao remover imagem global do cromo.");
    } finally {
      setUploadingImageId(null);
    }
  };

  const filteredStickers = stickers.filter((s) => {
    if (!selectedCollectionId || s.collection_id !== selectedCollectionId) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "have") return hasUserStickerStatus(s.id, "have");
    if (filter === "repeated") {
      const ownHave = userStickers.find(
        (us) => us.user_id === user?.id && us.sticker_id === s.id && us.status === "have"
      );
      return Boolean(ownHave && ownHave.quantity > 1);
    }
    if (filter === "want") return !getUserSticker(s.id);
    if (filter === "missing") return !getUserSticker(s.id);
    return true;
  });

  const selectedCollection = collections.find((collection) => collection.id === selectedCollectionId);
  const selectedStickers = stickers.filter((sticker) => sticker.collection_id === selectedCollectionId);
  const selectedStickerIds = new Set(selectedStickers.map((sticker) => sticker.id));
  const selectedUserStickers = userStickers.filter((us) => us.user_id === user?.id && selectedStickerIds.has(us.sticker_id));
  const haveCount = selectedUserStickers.filter((us) => us.status === "have").length;
  const wantCount = Math.max(0, selectedStickers.length - haveCount);
  const repeatedCount = selectedUserStickers
    .filter((us) => us.status === "have")
    .reduce((total, us) => total + Math.max(0, (us.quantity || 0) - 1), 0);
  const totalCount = selectedCollection?.total_stickers || selectedStickers.length;
  const progress = totalCount > 0 ? Math.round((haveCount / totalCount) * 100) : 0;

  if (loading) return <div className="loading">A carregar colecao...</div>;

  if (collections.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-icon">!</span>
        <h3>Sem colecoes</h3>
        <p>Cria uma colecao na area Admin para comecar.</p>
      </div>
    );
  }

  if (!selectedCollectionId) {
    return (
      <div className="collection-page">
        <div className="collection-header">
          <div>
            <h2>Colecoes</h2>
            <p>Escolhe uma colecao para abrir a tua caderneta.</p>
          </div>
        </div>

        <div className="collection-cover-grid">
          {collections.map((collection) => (
            <button
              key={collection.id}
              className="collection-cover-card"
              type="button"
              onClick={() => {
                setSelectedCollectionId(collection.id);
                setSearch("");
                setFilter("all");
              }}
            >
              <div className="collection-cover-image">
                <img
                  src={collection.image_url || collectionFallbackImage}
                  alt={collection.name}
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.src = collectionFallbackImage;
                  }}
                />
              </div>
              <div className="collection-cover-body">
                <strong>{collection.name}</strong>
                <span>{collection.total_stickers || 0} cromos</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="collection-page">
      <div className="collection-header">
        <div>
          <h2>{selectedCollection?.name || "Colecao"}</h2>
          <p>{totalCount} cromos para colecionar</p>
        </div>
        <div className="collection-stats">
          <button
            className={`stat stat-button ${filter === "all" ? "active" : ""}`}
            type="button"
            onClick={() => setFilter("all")}
          >
            <span className="stat-value">{totalCount}</span>
            <span className="stat-label">Todos</span>
          </button>
          <button
            className={`stat stat-button ${filter === "have" ? "active" : ""}`}
            type="button"
            onClick={() => setFilter("have")}
          >
            <span className="stat-value">{haveCount}</span>
            <span className="stat-label">Tenho</span>
          </button>
          <button
            className={`stat stat-button ${filter === "repeated" ? "active" : ""}`}
            type="button"
            onClick={() => setFilter("repeated")}
          >
            <span className="stat-value">{repeatedCount}</span>
            <span className="stat-label">Repetidos</span>
          </button>
          <button
            className={`stat stat-button ${filter === "want" ? "active" : ""}`}
            type="button"
            onClick={() => setFilter("want")}
          >
            <span className="stat-value">{wantCount}</span>
            <span className="stat-label">Procuro</span>
          </button>
        </div>
      </div>

      <div className="progress-label">
        <strong>{progress}%</strong>
        <span>Completa</span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="collection-picker">
        <button
          className="btn btn-ghost btn-sm"
          type="button"
          onClick={() => {
            setSelectedCollectionId(null);
            setSearch("");
            setFilter("all");
          }}
        >
          <ArrowLeft size={14} /> Colecoes
        </button>
        <BookOpen size={16} />
        <span>{selectedCollection?.name || "Colecao"}</span>
      </div>

      <div className="collection-toolbar">
        <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Procurar cromo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="sticker-grid">
        {filteredStickers.map((sticker) => {
          const us = getUserSticker(sticker.id);
          const photoInputId = `photo-${sticker.id}`;
          return (
            <StickerCard
              key={sticker.id}
              number={sticker.number}
              name={sticker.name}
              imageUrl={sticker.image_url}
              rarity={sticker.rarity}
              status={us ? "have" : "want"}
              quantity={us?.quantity}
              stickerId={sticker.id}
              selected={selectedStickerId === sticker.id}
              onClick={() => {
                setSelectedStickerId(sticker.id);
                us ? addQuantity(us.id) : addSticker(sticker.id, "have");
              }}
              onReduceQuantity={us ? () => reduceQuantity(us.id) : undefined}
            >
              {!us ? (
                <>
                  <label className="btn btn-photo btn-xs" htmlFor={photoInputId}>
                    <Camera size={12} /> Foto
                  </label>
                  {profile?.is_admin && sticker.image_url && (
                    <button
                      className="btn btn-danger-soft btn-xs"
                      type="button"
                      onClick={() => removeStickerImage(sticker.id)}
                      disabled={uploadingImageId === sticker.id}
                    >
                      <X size={12} /> Remover foto
                    </button>
                  )}
                </>
              ) : (
                <>
                  <label className="btn btn-photo btn-xs" htmlFor={photoInputId}>
                    <Camera size={12} /> {uploadingImageId === sticker.id ? "A enviar..." : "Foto"}
                  </label>
                  {profile?.is_admin && sticker.image_url && (
                    <button
                      className="btn btn-danger-soft btn-xs"
                      type="button"
                      onClick={() => removeStickerImage(sticker.id)}
                      disabled={uploadingImageId === sticker.id}
                    >
                      <X size={12} /> Remover foto
                    </button>
                  )}
                </>
              )}
              <input
                id={photoInputId}
                className="sticker-photo-input"
                type="file"
                accept="image/*"
                capture="environment"
                disabled={uploadingImageId === sticker.id}
                onChange={(event) => {
                  uploadStickerImage(sticker.id, event.target.files?.[0] || null);
                  event.target.value = "";
                }}
              />
            </StickerCard>
          );
        })}
      </div>

      {filteredStickers.length === 0 && (
        <div className="empty-state">
          <p>Nenhum cromo encontrado</p>
        </div>
      )}
    </div>
  );
}
