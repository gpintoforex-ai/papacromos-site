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

export async function findUserMatches(userId: string): Promise<Match[]> {
  const { data: myHaves, error: myHavesError } = await supabase
    .from("user_stickers")
    .select("user_id, sticker_id, quantity, stickers(id, name, number, image_url, rarity)")
    .eq("user_id", userId)
    .eq("status", "have");
  if (myHavesError) throw myHavesError;

  const { data: myWants, error: myWantsError } = await supabase
    .from("user_stickers")
    .select("user_id, sticker_id, stickers(id, name, number, image_url, rarity)")
    .eq("user_id", userId)
    .eq("status", "want");
  if (myWantsError) throw myWantsError;

  const ownHaves = (myHaves || []).filter((item: any) => item.user_id === userId);
  const ownWants = (myWants || []).filter((item: any) => item.user_id === userId);
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

  const { data: otherUsersWant, error: otherUsersWantError } = await supabase
    .from("user_stickers")
    .select("user_id, sticker_id, quantity, stickers(id, name, number, image_url, rarity)")
    .in("sticker_id", myHaveIds)
    .eq("status", "want")
    .neq("user_id", userId);
  if (otherUsersWantError) throw otherUsersWantError;

  const { data: otherUsersHave, error: otherUsersHaveError } = await supabase
    .from("user_stickers")
    .select("user_id, sticker_id, quantity, stickers(id, name, number, image_url, rarity)")
    .in("sticker_id", myWantIds)
    .eq("status", "have")
    .gt("quantity", 1)
    .neq("user_id", userId);
  if (otherUsersHaveError) throw otherUsersHaveError;

  const otherUserIds = Array.from(new Set([
    ...(otherUsersWant || []).map((item: any) => item.user_id),
    ...(otherUsersHave || []).map((item: any) => item.user_id),
  ]));

  const profilesById = new Map<string, { username?: string; avatar_seed?: string }>();
  if (otherUserIds.length) {
    const { data: profiles, error: profilesError } = await supabase
      .from("user_profiles")
      .select("id, username, avatar_seed")
      .in("id", otherUserIds);
    if (profilesError) throw profilesError;

    (profiles || []).forEach((profile: any) => {
      profilesById.set(profile.id, profile);
    });
  }

  const matchList: Match[] = [];
  const haveByUser = new Map<string, any[]>();
  for (const h of otherUsersHave || []) {
    const list = haveByUser.get(h.user_id) || [];
    list.push(h);
    haveByUser.set(h.user_id, list);
  }

  const seenMatchKeys = new Set<string>();
  for (const w of otherUsersWant || []) {
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
