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

function mapRpcMatches(rows: any[]): Match[] {
  return rows.map((row) => ({
    otherUserId: row.other_user_id,
    otherUsername: row.other_username || "Utilizador",
    otherAvatarSeed: row.other_avatar_seed || row.other_user_id,
    offeredSticker: {
      id: row.offered_sticker_id,
      name: row.offered_sticker_name,
      number: row.offered_sticker_number,
      image_url: row.offered_sticker_image_url,
      rarity: row.offered_sticker_rarity,
      available_quantity: row.offered_available_quantity || 1,
    },
    requestedSticker: {
      id: row.requested_sticker_id,
      name: row.requested_sticker_name,
      number: row.requested_sticker_number,
      image_url: row.requested_sticker_image_url,
      rarity: row.requested_sticker_rarity,
      available_quantity: row.requested_available_quantity || 1,
    },
  }));
}

const userStickerSelect = "user_id, sticker_id, quantity, stickers(id, name, number, image_url, rarity, collection_id)";
const queryChunkSize = 80;
const dataPageSize = 1000;

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
    let from = 0;

    while (true) {
      let query = supabase
        .from("user_stickers")
        .select(userStickerSelect)
        .in("sticker_id", chunk)
        .eq("status", status)
        .neq("user_id", currentUserId)
        .range(from, from + dataPageSize - 1);

      if (status === "have") {
        query = query.gt("quantity", 1);
      }

      const { data, error } = await query;
      if (error) throw error;
      rows.push(...(data || []));

      if (!data || data.length < dataPageSize) break;
      from += dataPageSize;
    }
  }

  return rows;
}

async function fetchRowsByUser(userId: string, status: "have" | "want") {
  const rows: any[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("user_stickers")
      .select(userStickerSelect)
      .eq("user_id", userId)
      .eq("status", status)
      .range(from, from + dataPageSize - 1);
    if (error) throw error;

    rows.push(...(data || []));

    if (!data || data.length < dataPageSize) break;
    from += dataPageSize;
  }

  return rows;
}

async function fetchActiveCollectionStickers(userId: string) {
  const { data: collections, error: collectionsError } = await supabase
    .from("collections")
    .select("id");
  if (collectionsError) throw collectionsError;

  const { data: preferences, error: preferencesError } = await supabase
    .from("user_collection_preferences")
    .select("collection_id, is_active")
    .eq("user_id", userId);
  if (preferencesError) throw preferencesError;

  const inactiveCollectionIds = new Set(
    (preferences || [])
      .filter((preference: any) => preference.is_active === false)
      .map((preference: any) => preference.collection_id)
  );
  const activeCollectionIds = (collections || [])
    .map((collection: any) => collection.id)
    .filter((collectionId: string) => !inactiveCollectionIds.has(collectionId));

  const stickers: any[] = [];
  for (const chunk of chunkIds(activeCollectionIds)) {
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from("stickers")
        .select("id, name, number, image_url, rarity, collection_id")
        .in("collection_id", chunk)
        .range(from, from + dataPageSize - 1);
      if (error) throw error;

      stickers.push(...(data || []));

      if (!data || data.length < dataPageSize) break;
      from += dataPageSize;
    }
  }

  return stickers;
}

async function fetchUsersWhoMissStickerIds(stickerIds: string[], currentUserId: string) {
  const missingRows: any[] = [];
  if (stickerIds.length === 0) return missingRows;

  const { data: users, error: usersError } = await supabase
    .from("user_profiles")
    .select("id")
    .neq("id", currentUserId);
  if (usersError) throw usersError;

  for (const otherUser of users || []) {
    const [otherHaves, otherActiveStickers] = await Promise.all([
      fetchRowsByUser(otherUser.id, "have"),
      fetchActiveCollectionStickers(otherUser.id),
    ]);
    const otherHaveIds = new Set(otherHaves.filter((row: any) => (row.quantity || 0) > 0).map((row: any) => row.sticker_id));
    const activeStickerIds = new Set(otherActiveStickers.map((sticker: any) => sticker.id));

    stickerIds.forEach((stickerId) => {
      if (activeStickerIds.has(stickerId) && !otherHaveIds.has(stickerId)) {
        missingRows.push({ user_id: otherUser.id, sticker_id: stickerId });
      }
    });
  }

  return missingRows;
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
  const { data: rpcMatches, error: rpcError } = await supabase.rpc("find_user_matches", {
    p_user_id: userId,
  });

  if (!rpcError && rpcMatches) {
    return mapRpcMatches(rpcMatches as any[]);
  }

  const missingRpc =
    rpcError?.code === "42883" ||
    rpcError?.message?.toLowerCase().includes("function public.find_user_matches") ||
    rpcError?.message?.toLowerCase().includes("could not find the function");

  if (rpcError && !missingRpc) throw rpcError;

  const [myHaves, myWants, activeStickers] = await Promise.all([
    fetchRowsByUser(userId, "have"),
    fetchRowsByUser(userId, "want"),
    fetchActiveCollectionStickers(userId),
  ]);

  const inactiveOwnCollections = await fetchInactiveCollectionIdsByUser([userId]);
  const ownHaves = filterActiveCollectionRows(
    (myHaves || []).filter((item: any) => item.user_id === userId && (item.quantity || 0) > 0),
    inactiveOwnCollections
  );
  const ownWants = filterActiveCollectionRows(
    (myWants || []).filter((item: any) => item.user_id === userId),
    inactiveOwnCollections
  );
  if (!ownHaves.length) return [];

  const myHaveIds = ownHaves
    .filter((h: any) => h.quantity && h.quantity > 1)
    .map((h: any) => h.sticker_id);
  if (!myHaveIds.length) return [];
  const myHaveQuantities = new Map<string, number>();
  ownHaves.forEach((h: any) => {
    myHaveQuantities.set(h.sticker_id, Math.max(0, (h.quantity || 0) - 1));
  });

  const ownHaveIds = new Set(ownHaves.map((h: any) => h.sticker_id));
  const explicitWantIds = new Set(ownWants.map((w: any) => w.sticker_id));
  const activeMissingIds = activeStickers
    .filter((sticker: any) => !ownHaveIds.has(sticker.id))
    .map((sticker: any) => sticker.id);
  const myWantIds = Array.from(new Set([...explicitWantIds, ...activeMissingIds]));
  if (!myWantIds.length) return [];

  const [explicitOtherUsersWantRows, inferredOtherUsersWantRows] = await Promise.all([
    fetchUserStickersByStickerIds(myHaveIds, "want", userId),
    fetchUsersWhoMissStickerIds(myHaveIds, userId),
  ]);
  const otherUsersHaveRows = await fetchUserStickersByStickerIds(myWantIds, "have", userId);
  const stickersById = new Map(activeStickers.map((sticker: any) => [sticker.id, sticker]));
  const explicitOtherWantKeys = new Set(explicitOtherUsersWantRows.map((row: any) => `${row.user_id}:${row.sticker_id}`));
  const otherUsersWantRows = [
    ...explicitOtherUsersWantRows,
    ...inferredOtherUsersWantRows
      .filter((row: any) => !explicitOtherWantKeys.has(`${row.user_id}:${row.sticker_id}`))
      .map((row: any) => ({
        ...row,
        quantity: 1,
        stickers: stickersById.get(row.sticker_id),
      }))
      .filter((row: any) => row.stickers),
  ];

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
