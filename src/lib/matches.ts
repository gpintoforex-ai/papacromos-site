import { supabase } from "./supabase";

export interface Match {
  otherUserId: string;
  otherUsername: string;
  otherAvatarSeed: string;
  offeredSticker: {
    id: string;
    name: string;
    number: number;
    image_url: string;
    rarity: string;
    available_quantity?: number;
  };
  requestedSticker: {
    id: string;
    name: string;
    number: number;
    image_url: string;
    rarity: string;
    available_quantity?: number;
  };
}

export function countUniqueRequestedStickers(matches: Match[]) {
  return new Set(matches.map((match) => match.requestedSticker.id)).size;
}

const userStickerSelect = "user_id, sticker_id, quantity, stickers(id, name, number, image_url, rarity, collection_id)";
const queryChunkSize = 80;

function chunkIds(ids: string[]) {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += queryChunkSize) {
    chunks.push(ids.slice(index, index + queryChunkSize));
  }
  return chunks;
}

async function fetchUserStickersByStickerIds(stickerIds: string[], status: "have" | "want", currentUserId: string) {
  const rows: any[] = [];

  for (const chunk of chunkIds(stickerIds)) {
    let query = supabase
      .from("user_stickers")
      .select(userStickerSelect)
      .in("sticker_id", chunk)
      .eq("status", status)
      .neq("user_id", currentUserId);

    if (status === "have") {
      query = query.gt("quantity", 1);
    }

    const { data, error } = await query;
    if (error) throw error;
    rows.push(...(data || []));
  }

  return rows;
}

async function fetchProfilesByIds(userIds: string[]) {
  const profilesById = new Map<string, { username?: string; avatar_seed?: string }>();

  for (const chunk of chunkIds(userIds)) {
    const { data: profiles, error: profilesError } = await supabase
      .from("user_profiles")
      .select("id, username, avatar_seed")
      .in("id", chunk);
    if (profilesError) throw profilesError;

    (profiles || []).forEach((profile: any) => {
      profilesById.set(profile.id, profile);
    });
  }

  return profilesById;
}

function getStickerCollectionId(row: any) {
  const sticker = Array.isArray(row.stickers) ? row.stickers[0] : row.stickers;
  return sticker?.collection_id || "";
}

async function fetchInactiveCollectionIdsByUser(userIds: string[]) {
  const inactiveByUser = new Map<string, Set<string>>();
  const uniqueUserIds = Array.from(new Set(userIds)).filter(Boolean);

  for (const chunk of chunkIds(uniqueUserIds)) {
    const { data, error } = await supabase
      .from("user_collection_preferences")
      .select("user_id, collection_id")
      .in("user_id", chunk)
      .eq("is_active", false);
    if (error) throw error;

    (data || []).forEach((preference: any) => {
      const inactiveIds = inactiveByUser.get(preference.user_id) || new Set<string>();
      inactiveIds.add(preference.collection_id);
      inactiveByUser.set(preference.user_id, inactiveIds);
    });
  }

  return inactiveByUser;
}

function filterActiveCollectionRows(rows: any[], inactiveByUser: Map<string, Set<string>>) {
  return rows.filter((row) => {
    const collectionId = getStickerCollectionId(row);
    return !collectionId || !inactiveByUser.get(row.user_id)?.has(collectionId);
  });
}

export async function findUserMatches(userId: string): Promise<Match[]> {
  const { data: myHaves, error: myHavesError } = await supabase
    .from("user_stickers")
    .select(userStickerSelect)
    .eq("user_id", userId)
    .eq("status", "have");
  if (myHavesError) throw myHavesError;

  const { data: myWants, error: myWantsError } = await supabase
    .from("user_stickers")
    .select(userStickerSelect)
    .eq("user_id", userId)
    .eq("status", "want");
  if (myWantsError) throw myWantsError;

  const inactiveOwnCollections = await fetchInactiveCollectionIdsByUser([userId]);
  const ownHaves = filterActiveCollectionRows(
    (myHaves || []).filter((item: any) => item.user_id === userId),
    inactiveOwnCollections
  );
  const ownWants = filterActiveCollectionRows(
    (myWants || []).filter((item: any) => item.user_id === userId),
    inactiveOwnCollections
  );
  if (!ownHaves.length || !ownWants.length) return [];

  const myHaveIds = ownHaves
    .filter((h: any) => h.quantity && h.quantity > 1)
    .map((h: any) => h.sticker_id);
  if (!myHaveIds.length) return [];
  const myHaveQuantities = new Map<string, number>();
  ownHaves.forEach((h: any) => {
    myHaveQuantities.set(h.sticker_id, Math.max(0, (h.quantity || 0) - 1));
  });

  const myWantIds = ownWants.map((w: any) => w.sticker_id);

  const otherUsersWantRows = await fetchUserStickersByStickerIds(myHaveIds, "want", userId);
  const otherUsersHaveRows = await fetchUserStickersByStickerIds(myWantIds, "have", userId);

  const otherUserIds = Array.from(new Set([
    ...otherUsersWantRows.map((item: any) => item.user_id),
    ...otherUsersHaveRows.map((item: any) => item.user_id),
  ]));

  const inactiveOtherCollections = await fetchInactiveCollectionIdsByUser(otherUserIds);
  const otherUsersWant = filterActiveCollectionRows(otherUsersWantRows, inactiveOtherCollections);
  const otherUsersHave = filterActiveCollectionRows(otherUsersHaveRows, inactiveOtherCollections);

  const profilesById = otherUserIds.length ? await fetchProfilesByIds(otherUserIds) : new Map<string, { username?: string; avatar_seed?: string }>();

  const matchList: Match[] = [];
  const haveByUser = new Map<string, any[]>();
  for (const h of otherUsersHave) {
    const list = haveByUser.get(h.user_id) || [];
    list.push(h);
    haveByUser.set(h.user_id, list);
  }

  const seenMatchKeys = new Set<string>();
  for (const w of otherUsersWant) {
    const theirHaves = haveByUser.get(w.user_id) || [];
    for (const th of theirHaves) {
      const matchKey = `${w.user_id}:${w.sticker_id}:${th.sticker_id}`;
      if (seenMatchKeys.has(matchKey)) continue;
      seenMatchKeys.add(matchKey);

      const profile = profilesById.get(w.user_id);
      const offeredSticker = Array.isArray(w.stickers) ? w.stickers[0] : w.stickers;
      const requestedSticker = Array.isArray(th.stickers) ? th.stickers[0] : th.stickers;
      matchList.push({
        otherUserId: w.user_id,
        otherUsername: profile?.username || "Utilizador",
        otherAvatarSeed: profile?.avatar_seed || w.user_id,
        offeredSticker: {
          ...offeredSticker,
          available_quantity: myHaveQuantities.get(w.sticker_id) || 1,
        },
        requestedSticker: {
          ...requestedSticker,
          available_quantity: Math.max(0, (th.quantity || 0) - 1),
        },
      });
    }
  }

  return matchList;
}
