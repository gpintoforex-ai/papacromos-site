import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import StickerCard from "../components/StickerCard";
import { Search, Camera, ArrowLeft, X, Mic, ClipboardCheck } from "lucide-react";

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
type VoiceMarkMode = "have" | "want";

interface AlbumTeamPage {
  teamName: string;
  groupName: string;
  flag: string;
  flagCode: string;
  flagUrl: string;
  stickers: Sticker[];
}

const collectionFallbackImage =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23f3f4f6'/%3E%3Crect x='92' y='70' width='216' height='260' rx='18' fill='%23ffffff' stroke='%23d1d5db' stroke-width='10'/%3E%3Cpath d='M132 132h136v24H132zm0 58h136v24H132zm0 58h92v24h-92z' fill='%239ca3af'/%3E%3C/svg%3E";

const teamFlags: Record<string, string> = {
  Portugal: "🇵🇹",
  Brasil: "🇧🇷",
  Argentina: "🇦🇷",
  Franca: "🇫🇷",
  França: "🇫🇷",
  Espanha: "🇪🇸",
  Alemanha: "🇩🇪",
  Inglaterra: "🏴",
  Italia: "🇮🇹",
  Holanda: "🇳🇱",
  "Paises Baixos": "🇳🇱",
  Belgica: "🇧🇪",
  Bélgica: "🇧🇪",
  Croacia: "🇭🇷",
  Croácia: "🇭🇷",
  Uruguai: "🇺🇾",
  Mexico: "🇲🇽",
  México: "🇲🇽",
  "Estados Unidos": "🇺🇸",
  Japao: "🇯🇵",
  Japão: "🇯🇵",
  Marrocos: "🇲🇦",
  Canada: "🇨🇦",
  Canadá: "🇨🇦",
  Suica: "🇨🇭",
  Suíça: "🇨🇭",
  Turquia: "🇹🇷",
  Senegal: "🇸🇳",
  Argelia: "🇩🇿",
  Argélia: "🇩🇿",
  "Congo DR": "🇨🇩",
  "RD do Congo": "🇨🇩",
  "Coreia do Sul": "🇰🇷",
  "República da Coreia": "🇰🇷",
  Australia: "🇦🇺",
  Austrália: "🇦🇺",
  Dinamarca: "🇩🇰",
  Suecia: "🇸🇪",
  Suécia: "🇸🇪",
  Noruega: "🇳🇴",
  Colombia: "🇨🇴",
  Colômbia: "🇨🇴",
  Equador: "🇪🇨",
  Paraguai: "🇵🇾",
  Panama: "🇵🇦",
  Panamá: "🇵🇦",
  Egito: "🇪🇬",
  Gana: "🇬🇭",
  Tunisia: "🇹🇳",
  Tunísia: "🇹🇳",
  "Africa do Sul": "🇿🇦",
  "África do Sul": "🇿🇦",
  "Arabia Saudita": "🇸🇦",
  "Arábia Saudita": "🇸🇦",
  Iraque: "🇮🇶",
  Qatar: "🇶🇦",
  Catar: "🇶🇦",
  "Nova Zelandia": "🇳🇿",
  "Nova Zelândia": "🇳🇿",
  "Bósnia e Herzegovina": "🇧🇦",
  Tchéquia: "🇨🇿",
  Haiti: "🇭🇹",
  Escócia: "🏴",
  Curaçau: "🇨🇼",
  "Costa do Marfim": "🇨🇮",
  "RI do Irã": "🇮🇷",
  "Cabo Verde": "🇨🇻",
  Áustria: "🇦🇹",
  Jordânia: "🇯🇴",
  Uzbequistão: "🇺🇿",
};

const flagCodeByTeam: Record<string, string> = {
  Portugal: "pt",
  Brasil: "br",
  Argentina: "ar",
  Franca: "fr",
  França: "fr",
  Espanha: "es",
  Alemanha: "de",
  Inglaterra: "gb-eng",
  Italia: "it",
  Holanda: "nl",
  "Paises Baixos": "nl",
  Belgica: "be",
  Bélgica: "be",
  Croacia: "hr",
  Croácia: "hr",
  Uruguai: "uy",
  Mexico: "mx",
  México: "mx",
  "Estados Unidos": "us",
  Japao: "jp",
  Japão: "jp",
  Marrocos: "ma",
  Canada: "ca",
  Canadá: "ca",
  Suica: "ch",
  Suíça: "ch",
  Turquia: "tr",
  Senegal: "sn",
  Argelia: "dz",
  Argélia: "dz",
  "Congo DR": "cd",
  "RD do Congo": "cd",
  "Coreia do Sul": "kr",
  "República da Coreia": "kr",
  Australia: "au",
  Austrália: "au",
  Dinamarca: "dk",
  Suecia: "se",
  Suécia: "se",
  Noruega: "no",
  Colombia: "co",
  Colômbia: "co",
  Equador: "ec",
  Paraguai: "py",
  Panama: "pa",
  Panamá: "pa",
  Egito: "eg",
  Gana: "gh",
  Tunisia: "tn",
  Tunísia: "tn",
  "Africa do Sul": "za",
  "África do Sul": "za",
  "Arabia Saudita": "sa",
  "Arábia Saudita": "sa",
  Iraque: "iq",
  Qatar: "qa",
  Catar: "qa",
  "Nova Zelandia": "nz",
  "Nova Zelândia": "nz",
  "Bósnia e Herzegovina": "ba",
  Tchéquia: "cz",
  Haiti: "ht",
  Escócia: "gb-sct",
  Curaçau: "cw",
  "Costa do Marfim": "ci",
  "RI do Irã": "ir",
  "Cabo Verde": "cv",
  Áustria: "at",
  Jordânia: "jo",
  Uzbequistão: "uz",
};

const groupByTeam: Record<string, string> = {
  México: "Grupo A",
  Mexico: "Grupo A",
  "África do Sul": "Grupo A",
  "Africa do Sul": "Grupo A",
  "República da Coreia": "Grupo A",
  "Coreia do Sul": "Grupo A",
  Tchéquia: "Grupo A",
  Canadá: "Grupo B",
  Canada: "Grupo B",
  "Bósnia e Herzegovina": "Grupo B",
  Catar: "Grupo B",
  Qatar: "Grupo B",
  Suíça: "Grupo B",
  Suica: "Grupo B",
  Brasil: "Grupo C",
  Marrocos: "Grupo C",
  Haiti: "Grupo C",
  Escócia: "Grupo C",
  "Estados Unidos": "Grupo D",
  Austrália: "Grupo D",
  Australia: "Grupo D",
  Paraguai: "Grupo D",
  Turquia: "Grupo D",
  Dinamarca: "Grupo D",
  Alemanha: "Grupo E",
  Curaçau: "Grupo E",
  "Costa do Marfim": "Grupo E",
  Equador: "Grupo E",
  Holanda: "Grupo F",
  "Paises Baixos": "Grupo F",
  Japão: "Grupo F",
  Japao: "Grupo F",
  Suécia: "Grupo F",
  Suecia: "Grupo F",
  Tunísia: "Grupo F",
  Tunisia: "Grupo F",
  Bélgica: "Grupo G",
  Belgica: "Grupo G",
  Egito: "Grupo G",
  "RI do Irã": "Grupo G",
  "Nova Zelândia": "Grupo G",
  "Nova Zelandia": "Grupo G",
  Espanha: "Grupo H",
  "Cabo Verde": "Grupo H",
  "Arábia Saudita": "Grupo H",
  "Arabia Saudita": "Grupo H",
  Uruguai: "Grupo H",
  França: "Grupo I",
  Franca: "Grupo I",
  Iraque: "Grupo I",
  Noruega: "Grupo I",
  Senegal: "Grupo I",
  Argentina: "Grupo J",
  Argélia: "Grupo J",
  Argelia: "Grupo J",
  Áustria: "Grupo J",
  Jordânia: "Grupo J",
  Portugal: "Grupo K",
  "RD do Congo": "Grupo K",
  "Congo DR": "Grupo K",
  Uzbequistão: "Grupo K",
  Colômbia: "Grupo K",
  Colombia: "Grupo K",
  Inglaterra: "Grupo L",
  Croácia: "Grupo L",
  Croacia: "Grupo L",
  Gana: "Grupo L",
  Panamá: "Grupo L",
  Panama: "Grupo L",
};

function getStickerTeamName(stickerName: string) {
  return stickerName.includes(" - ") ? stickerName.split(" - ")[0].trim() : "Cromos";
}

function getAlbumLocalNumber(sticker: Sticker) {
  const slot = ((sticker.number - 1) % 20) + 1;
  if (sticker.name.includes("Escudo")) return 1;
  if (sticker.name.includes("Foto de equipa")) return 13;
  return slot;
}

function buildAlbumTeamPages(stickers: Sticker[]): AlbumTeamPage[] {
  const teams = new Map<string, Sticker[]>();
  stickers.forEach((sticker) => {
    const teamName = getStickerTeamName(sticker.name);
    teams.set(teamName, [...(teams.get(teamName) || []), sticker]);
  });

  return Array.from(teams.entries()).map(([teamName, teamStickers], index) => ({
    teamName,
    groupName: groupByTeam[teamName] || `Grupo ${String.fromCharCode(65 + Math.floor(index / 4))}`,
    flag: teamFlags[teamName] || "🏳️",
    flagCode: flagCodeByTeam[teamName] || "",
    flagUrl: flagCodeByTeam[teamName] ? `https://flagcdn.com/w160/${flagCodeByTeam[teamName]}.png` : "",
    stickers: teamStickers.sort((a, b) => getAlbumLocalNumber(a) - getAlbumLocalNumber(b)),
  }));
}

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
  const [selectedAlbumTeamName, setSelectedAlbumTeamName] = useState<string | null>(null);
  const [uploadingImageId, setUploadingImageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voicePanelOpen, setVoicePanelOpen] = useState(false);
  const [voiceMode, setVoiceMode] = useState<VoiceMarkMode>("have");
  const [voiceText, setVoiceText] = useState("");
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceResult, setVoiceResult] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [user]);

  useEffect(() => {
    setSelectedCollectionId(null);
    setSearch("");
    setFilter("all");
    setSelectedStickerId(null);
    setSelectedAlbumTeamName(null);
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
        const { error: insertError } = await supabase.from("user_stickers").upsert({
          user_id: user.id,
          sticker_id: stickerId,
          status,
          quantity: 1,
        }, {
          onConflict: "user_id,sticker_id,status",
          ignoreDuplicates: true,
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

    const { error: insertError } = await supabase.from("user_stickers").upsert({
      user_id: user.id,
      sticker_id: stickerId,
      status: "want",
      quantity: 1,
    }, {
      onConflict: "user_id,sticker_id,status",
      ignoreDuplicates: true,
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
        const { error: insertError } = await supabase.from("user_stickers").upsert(wantsToCreate, {
          onConflict: "user_id,sticker_id,status",
          ignoreDuplicates: true,
        });
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

  const getStickerBySpokenNumber = (number: number) => {
    const collectionStickers = stickers.filter((sticker) => sticker.collection_id === selectedCollectionId);
    if (isWorldAlbum && selectedAlbumTeamName && number >= 1 && number <= 20) {
      const teamSticker = collectionStickers.find(
        (sticker) => getStickerTeamName(sticker.name) === selectedAlbumTeamName && getAlbumLocalNumber(sticker) === number
      );
      if (teamSticker) return teamSticker;
    }

    return collectionStickers.find((sticker) => sticker.number === number) || null;
  };

  const parseSpokenStickerCounts = (text: string) => {
    const counts = new Map<number, number>();
    const matches = text.match(/\d+/g) || [];

    matches.forEach((match) => {
      const number = Number.parseInt(match, 10);
      if (!Number.isFinite(number) || number <= 0) return;
      counts.set(number, (counts.get(number) || 0) + 1);
    });

    return counts;
  };

  const markSpokenStickers = async () => {
    setError(null);
    setVoiceResult(null);
    try {
      if (!user?.id) throw new Error("Sessao expirada. Entra novamente.");
      if (!selectedCollectionId) throw new Error("Abre uma colecao primeiro.");

      const spokenCounts = parseSpokenStickerCounts(voiceText);
      if (spokenCounts.size === 0) {
        throw new Error("Nao encontrei numeros de cromos no texto.");
      }

      const matched = Array.from(spokenCounts.entries())
        .map(([number, count]) => ({ number, count, sticker: getStickerBySpokenNumber(number) }))
        .filter((item): item is { number: number; count: number; sticker: Sticker } => Boolean(item.sticker));
      const missingNumbers = Array.from(spokenCounts.keys())
        .filter((number) => !matched.some((item) => item.number === number));

      if (matched.length === 0) {
        throw new Error("Nenhum dos numeros indicados pertence a esta caderneta.");
      }

      if (voiceMode === "have") {
        const existingHaveByStickerId = new Map(
          userStickers
            .filter((userSticker) => userSticker.user_id === user.id && userSticker.status === "have")
            .map((userSticker) => [userSticker.sticker_id, userSticker])
        );
        const updates = matched
          .filter((item) => existingHaveByStickerId.has(item.sticker.id))
          .map((item) => {
            const existing = existingHaveByStickerId.get(item.sticker.id)!;
            return supabase
              .from("user_stickers")
              .update({ quantity: Math.max(existing.quantity, item.count) })
              .eq("id", existing.id);
          });
        const inserts = matched
          .filter((item) => !existingHaveByStickerId.has(item.sticker.id))
          .map((item) => ({
            user_id: user.id,
            sticker_id: item.sticker.id,
            status: "have",
            quantity: item.count,
          }));

        for (const update of updates) {
          const { error: updateError } = await update;
          if (updateError) throw updateError;
        }

        if (inserts.length > 0) {
          const { error: insertError } = await supabase.from("user_stickers").upsert(inserts, {
            onConflict: "user_id,sticker_id,status",
          });
          if (insertError) throw insertError;
        }

        const wantIdsToRemove = userStickers
          .filter((userSticker) =>
            userSticker.user_id === user.id &&
            userSticker.status === "want" &&
            matched.some((item) => item.sticker.id === userSticker.sticker_id)
          )
          .map((userSticker) => userSticker.id);
        if (wantIdsToRemove.length > 0) {
          const { error: deleteWantError } = await supabase.from("user_stickers").delete().in("id", wantIdsToRemove);
          if (deleteWantError) throw deleteWantError;
        }
      } else {
        const existingWantIds = new Set(
          userStickers
            .filter((userSticker) => userSticker.user_id === user.id && userSticker.status === "want")
            .map((userSticker) => userSticker.sticker_id)
        );
        const haveIdsToRemove = userStickers
          .filter((userSticker) =>
            userSticker.user_id === user.id &&
            userSticker.status === "have" &&
            matched.some((item) => item.sticker.id === userSticker.sticker_id)
          )
          .map((userSticker) => userSticker.id);
        if (haveIdsToRemove.length > 0) {
          const { error: deleteHaveError } = await supabase.from("user_stickers").delete().in("id", haveIdsToRemove);
          if (deleteHaveError) throw deleteHaveError;
        }

        const wantsToInsert = matched
          .filter((item) => !existingWantIds.has(item.sticker.id))
          .map((item) => ({
            user_id: user.id,
            sticker_id: item.sticker.id,
            status: "want",
            quantity: 1,
          }));
        if (wantsToInsert.length > 0) {
          const { error: insertWantError } = await supabase.from("user_stickers").upsert(wantsToInsert, {
            onConflict: "user_id,sticker_id,status",
            ignoreDuplicates: true,
          });
          if (insertWantError) throw insertWantError;
        }
      }

      await loadData();
      onCollectionChange?.();
      setVoiceResult(`${matched.length} cromo${matched.length === 1 ? "" : "s"} marcado${matched.length === 1 ? "" : "s"}${missingNumbers.length ? `. Nao encontrei: ${missingNumbers.join(", ")}.` : "."}`);
    } catch (err: any) {
      setError(err.message || "Erro ao marcar cromos automaticamente.");
    }
  };

  const startVoiceRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setError(null);
    setVoiceResult(null);

    if (!SpeechRecognition) {
      setError("Este browser nao suporta reconhecimento de voz. Podes escrever os numeros na caixa.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-PT";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setVoiceListening(true);

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0]?.transcript || "")
        .join(" ");
      setVoiceText((current) => [current, transcript].filter(Boolean).join(" "));
    };
    recognition.onerror = () => {
      setError("Nao foi possivel reconhecer a voz. Tenta novamente ou escreve os numeros.");
    };
    recognition.onend = () => {
      setVoiceListening(false);
    };
    recognition.start();
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
        const { error: insertHaveError } = await supabase.from("user_stickers").upsert({
          user_id: user.id,
          sticker_id: stickerId,
          status: "have",
          quantity: 1,
        }, {
          onConflict: "user_id,sticker_id,status",
          ignoreDuplicates: true,
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
  const repeatedCount = selectedUserStickers
    .filter((us) => us.status === "have")
    .reduce((total, us) => total + Math.max(0, (us.quantity || 0) - 1), 0);
  const totalCount = Math.max(selectedStickers.length, selectedCollection?.total_stickers || 0);
  const wantCount = Math.max(0, totalCount - haveCount);
  const progress = totalCount > 0 ? Math.round((haveCount / totalCount) * 100) : 0;
  const isWorldAlbum = selectedCollection?.name.toLowerCase().includes("mundial") || false;
  const albumTeamButtons = isWorldAlbum ? buildAlbumTeamPages(selectedStickers) : [];
  const albumTeamPages = isWorldAlbum
    ? buildAlbumTeamPages(filteredStickers).filter((teamPage) => !selectedAlbumTeamName || teamPage.teamName === selectedAlbumTeamName)
    : [];
  const selectedAlbumTeamIndex = albumTeamButtons.findIndex((teamPage) => teamPage.teamName === selectedAlbumTeamName);
  const previousAlbumTeam = selectedAlbumTeamIndex > 0 ? albumTeamButtons[selectedAlbumTeamIndex - 1] : null;
  const nextAlbumTeam =
    selectedAlbumTeamIndex >= 0 && selectedAlbumTeamIndex < albumTeamButtons.length - 1
      ? albumTeamButtons[selectedAlbumTeamIndex + 1]
      : null;

  const openAlbumTeam = (teamName: string) => {
    setSelectedAlbumTeamName(teamName);
    setSearch("");
    setFilter("all");
    setSelectedStickerId(null);
  };

  const renderSticker = (sticker: Sticker, compact = false) => {
    const us = getUserSticker(sticker.id);
    const photoInputId = `photo-${sticker.id}`;

    return (
      <StickerCard
        key={sticker.id}
        number={isWorldAlbum ? getAlbumLocalNumber(sticker) : sticker.number}
        name={sticker.name}
        imageUrl={sticker.image_url}
        rarity={sticker.rarity}
        status={us ? "have" : "want"}
        quantity={us?.quantity}
        stickerId={sticker.id}
        selected={selectedStickerId === sticker.id}
        compact={compact}
        onClick={() => {
          setSelectedStickerId(sticker.id);
          us ? addQuantity(us.id) : addSticker(sticker.id, "have");
        }}
        onReduceQuantity={us ? () => reduceQuantity(us.id) : undefined}
      >
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
  };

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
                setSelectedAlbumTeamName(null);
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
        <div className="collection-header-side">
          <button
            className="btn btn-collection-back"
            type="button"
            onClick={() => {
              setSelectedCollectionId(null);
              setSearch("");
              setFilter("all");
              setSelectedAlbumTeamName(null);
            }}
          >
            <ArrowLeft size={16} /> Coleções
          </button>
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
      </div>

      <div className="progress-label">
        <strong>{progress}%</strong>
        <span>Completa</span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
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
        <button className="btn btn-voice-toggle btn-sm" type="button" onClick={() => setVoicePanelOpen((open) => !open)}>
          <Mic size={14} /> Marcar por voz
        </button>
      </div>

      {voicePanelOpen && (
        <div className="voice-mark-panel">
          <div className="voice-mark-header">
            <div>
              <strong>Marcar cromos automaticamente</strong>
              <span>Diz ou escreve os numeros dos cromos, por exemplo: 48, 226, 98.</span>
            </div>
            <div className="voice-mark-mode">
              <button
                type="button"
                className={voiceMode === "have" ? "active" : ""}
                onClick={() => setVoiceMode("have")}
              >
                Tenho
              </button>
              <button
                type="button"
                className={voiceMode === "want" ? "active" : ""}
                onClick={() => setVoiceMode("want")}
              >
                Procuro
              </button>
            </div>
          </div>
          <textarea
            value={voiceText}
            placeholder="Ex.: 48 226 98"
            onChange={(event) => setVoiceText(event.target.value)}
          />
          <div className="voice-mark-actions">
            <button className="btn btn-ghost btn-sm" type="button" onClick={startVoiceRecognition} disabled={voiceListening}>
              <Mic size={14} /> {voiceListening ? "A ouvir..." : "Ditar"}
            </button>
            <button className="btn btn-primary btn-sm" type="button" onClick={markSpokenStickers} disabled={!voiceText.trim()}>
              <ClipboardCheck size={14} /> Marcar
            </button>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setVoiceText("")}>
              Limpar
            </button>
          </div>
          {voiceResult && <p className="success-text">{voiceResult}</p>}
          {isWorldAlbum && selectedAlbumTeamName && (
            <p className="muted-text">Nesta selecao tambem podes dizer numeros locais de 1 a 20.</p>
          )}
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      {isWorldAlbum && !selectedAlbumTeamName ? (
        <div className="album-team-selector">
          {albumTeamButtons.map((teamPage, pageIndex) => {
            const teamHaveCount = teamPage.stickers.filter((sticker) => getUserSticker(sticker.id)).length;
            const teamProgress = Math.round((teamHaveCount / Math.max(1, teamPage.stickers.length)) * 100);

            return (
              <button
                className="album-team-button"
                key={teamPage.teamName}
                type="button"
                onClick={() => {
                  openAlbumTeam(teamPage.teamName);
                }}
              >
                {teamPage.flagUrl && (
                  <img className="album-team-bg-flag" src={teamPage.flagUrl} alt="" loading="lazy" aria-hidden="true" />
                )}
                <span className="album-team-button-number">{String(pageIndex + 1).padStart(2, "0")}</span>
                <strong>
                  {teamPage.flagUrl && <img className="album-team-mini-flag" src={teamPage.flagUrl} alt="" loading="lazy" />}
                  {teamPage.teamName}
                </strong>
                <span>{teamPage.groupName}</span>
                <em>{teamHaveCount}/{teamPage.stickers.length}</em>
                <div className="album-team-button-progress">
                  <span style={{ width: `${teamProgress}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      ) : isWorldAlbum ? (
        <div className="album-page-list">
          <div className="album-page-nav">
            <button
              className="btn btn-album-back"
              type="button"
              onClick={() => {
                setSelectedAlbumTeamName(null);
                setSearch("");
                setFilter("all");
                setSelectedStickerId(null);
              }}
            >
              <ArrowLeft size={16} /> Seleções
            </button>
            <div className="album-page-nav-arrows">
              <button
                className="btn btn-album-nav"
                type="button"
                onClick={() => previousAlbumTeam && openAlbumTeam(previousAlbumTeam.teamName)}
                disabled={!previousAlbumTeam}
              >
                <ArrowLeft size={14} /> Anterior
              </button>
              <button
                className="btn btn-album-nav"
                type="button"
                onClick={() => nextAlbumTeam && openAlbumTeam(nextAlbumTeam.teamName)}
                disabled={!nextAlbumTeam}
              >
                Seguinte <ArrowLeft className="icon-flip-horizontal" size={14} />
              </button>
            </div>
          </div>
          {albumTeamPages.map((teamPage) => {
            const pageIndex = Math.max(0, albumTeamButtons.findIndex((albumTeam) => albumTeam.teamName === teamPage.teamName));
            const teamHaveCount = teamPage.stickers.filter((sticker) => getUserSticker(sticker.id)).length;
            const teamProgress = Math.round((teamHaveCount / Math.max(1, teamPage.stickers.length)) * 100);
            const teamPhoto = teamPage.stickers.find((sticker) => getAlbumLocalNumber(sticker) === 13);
            const playerStickers = teamPage.stickers.filter((sticker) => !sticker.name.includes("Foto de equipa"));

            return (
              <section className="album-spread" key={teamPage.teamName}>
                <div className="album-team-hero">
                  <span className="album-page-number">{String(pageIndex + 1).padStart(2, "0")}</span>
                  <div>
                    <p>NOS SOMOS</p>
                    <h3><span className="album-team-hero-flag">{teamPage.flag}</span>{teamPage.teamName}</h3>
                    <span>{teamPage.groupName}</span>
                  </div>
                  <div className="album-team-badge">
                    {teamPage.flagUrl ? <img src={teamPage.flagUrl} alt={`Bandeira ${teamPage.teamName}`} /> : teamPage.flag}
                  </div>
                </div>

                <div className="album-spread-body">
                  <aside className="album-team-info">
                    {teamPhoto && (
                      <div className="album-team-photo-slot">
                        {renderSticker(teamPhoto, true)}
                      </div>
                    )}
                    <div>
                      <strong>Federacao</strong>
                      <span>{teamPage.teamName} Football Association</span>
                    </div>
                    <div>
                      <strong>Progresso</strong>
                      <span>{teamHaveCount}/{teamPage.stickers.length} cromos</span>
                    </div>
                    <div className="album-team-progress">
                      <span style={{ width: `${teamProgress}%` }} />
                    </div>
                  </aside>
                  <div className="album-sticker-grid">
                    {playerStickers.map((sticker) => renderSticker(sticker, true))}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="sticker-grid">
          {filteredStickers.map((sticker) => renderSticker(sticker))}
        </div>
      )}

      {filteredStickers.length === 0 && (
        <div className="empty-state">
          <p>Nenhum cromo encontrado</p>
        </div>
      )}
    </div>
  );
}
