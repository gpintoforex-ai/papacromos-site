import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import type { Provider, User } from "@supabase/supabase-js";
import { logAuditEvent } from "./audit";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithProvider: (provider: Provider) => Promise<void>;
  signUp: (profile: SignUpProfile) => Promise<SignUpResult>;
  updateProfileDetails: (details: ProfileDetailsUpdate) => Promise<void>;
  signOut: () => Promise<void>;
}

interface UserProfile {
  first_name: string | null;
  last_name: string | null;
  username: string;
  email: string | null;
  phone: string | null;
  region: string | null;
  city: string | null;
  avatar_seed: string;
  status: "member" | "king_cromo";
  is_admin: boolean;
  is_blocked: boolean;
  created_at: string | null;
}

function normalizeProfileStatus(status: unknown): UserProfile["status"] {
  return status === "king_cromo" ? "king_cromo" : "member";
}

interface SignUpProfile {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  phone: string;
  region: string;
  city: string;
}

interface SignUpResult {
  needsEmailConfirmation: boolean;
}

interface ProfileDetailsUpdate {
  phone: string;
  region: string;
  city: string;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signIn: async () => {},
  signInWithProvider: async () => {},
  signUp: async () => ({ needsEmailConfirmation: false }),
  updateProfileDetails: async () => {},
  signOut: async () => {},
});

const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS || "admin@admin.pt")
  .split(",")
  .map((email: string) => email.trim().toLowerCase())
  .filter(Boolean);

function isBootstrapAdmin(email: string) {
  return adminEmails.includes(email.trim().toLowerCase());
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function logUserLogin(currentUser: User) {
  logAuditEvent({
    action: "user_login",
    entityType: "auth",
    targetUserId: currentUser.id,
    metadata: {
      email: currentUser.email || null,
      provider: currentUser.app_metadata?.provider || "email",
    },
  });
}

async function ensurePhoneAvailable(phone: string, currentUserId?: string) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return;

  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, phone")
    .not("phone", "is", null);
  if (error) throw error;

  const phoneOwner = (data || []).find((row: any) => {
    if (currentUserId && row.id === currentUserId) return false;
    return normalizePhone(row.phone || "") === normalizedPhone;
  });

  if (phoneOwner) {
    throw new Error("Este telemovel ja esta associado a outra conta.");
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        try {
          setProfile(await createOrUpdateProfile(currentUser));
        } catch (error) {
          console.error("Failed to load user profile", error);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        (async () => {
          try {
            const nextProfile = await createOrUpdateProfile(currentUser);
            setProfile(nextProfile);
            if (event === "SIGNED_IN") {
              logUserLogin(currentUser);
            }
          } catch (error) {
            console.error("Failed to load user profile", error);
            setProfile(null);
          }
        })();
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    if (!data.user) {
      throw new Error("Nao foi possivel iniciar sessao. Tenta novamente.");
    }

    const nextProfile = await createOrUpdateProfile(data.user);
    setUser(data.user);
    setProfile(nextProfile);
  };

  const signInWithProvider = async (provider: Provider) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  };

  const signUp = async ({ firstName, lastName, username, email, password, phone, region, city }: SignUpProfile) => {
    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const cleanUsername = username.trim();
    const cleanEmail = email.trim();
    const cleanPhone = phone.trim();
    const cleanRegion = region.trim();
    const cleanCity = city.trim();

    await ensurePhoneAvailable(cleanPhone);

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          first_name: cleanFirstName,
          last_name: cleanLastName,
          username: cleanUsername,
          phone: cleanPhone,
          region: cleanRegion,
          city: cleanCity,
        },
      },
    });
    if (error) throw error;
    if (!data.user) {
      throw new Error("Nao foi possivel criar a conta. Tenta novamente.");
    }

    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error("Este email ja esta registado. Usa a opcao Entrar ou recupera a senha.");
    }

    if (data.user && data.session) {
      setUser(data.user);
      setProfile(await createOrUpdateProfile(data.user));
    }

    return { needsEmailConfirmation: !data.session };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const updateProfileDetails = async ({ phone, region, city }: ProfileDetailsUpdate) => {
    if (!user?.id || !profile) throw new Error("Sessao invalida.");

    const cleanPhone = phone.trim();
    const cleanRegion = region.trim();
    const cleanCity = city.trim();

    await ensurePhoneAvailable(cleanPhone, user.id);

    const { error } = await supabase
      .from("user_profiles")
      .update({ phone: cleanPhone, region: cleanRegion, city: cleanCity })
      .eq("id", user.id);
    if (error) throw error;

    setProfile({ ...profile, phone: cleanPhone, region: cleanRegion, city: cleanCity });
  };

  const createOrUpdateProfile = async (currentUser: User): Promise<UserProfile> => {
    const userId = currentUser.id;
    const metadata = currentUser.user_metadata || {};
    const email = currentUser.email || "";

    let supportsNameFields = true;
    let supportsRegionField = true;
    let supportsStatusField = true;
    let existing: any = null;
    const { data: selectedProfile, error: profileSelectError } = await supabase
      .from("user_profiles")
      .select("id, first_name, last_name, username, email, phone, region, city, avatar_seed, status, is_admin, is_blocked, created_at")
      .eq("id", userId)
      .maybeSingle();
    existing = selectedProfile;

    if (profileSelectError) {
      const message = String(profileSelectError.message || "").toLowerCase();
      const unknownColumnMissing = profileSelectError.code === "42703" || profileSelectError.code === "PGRST204";
      const optionalFieldMissing = unknownColumnMissing || message.includes("first_name") || message.includes("last_name") || message.includes("region") || message.includes("status");
      if (!optionalFieldMissing) throw profileSelectError;

      supportsNameFields = !unknownColumnMissing && !message.includes("first_name") && !message.includes("last_name");
      supportsRegionField = !unknownColumnMissing && !message.includes("region");
      supportsStatusField = !unknownColumnMissing && !message.includes("status");
      const fallbackFields = [
        "id",
        ...(supportsNameFields ? ["first_name", "last_name"] : []),
        "username",
        "email",
        "phone",
        ...(supportsRegionField ? ["region"] : []),
        "city",
        "avatar_seed",
        ...(supportsStatusField ? ["status"] : []),
        "is_admin",
        "is_blocked",
        "created_at",
      ].join(", ");
      const fallback = await supabase
        .from("user_profiles")
        .select(fallbackFields)
        .eq("id", userId)
        .maybeSingle();
      if (fallback.error) throw fallback.error;
      existing = fallback.data;
    }

    const fullName = String(metadata.full_name || metadata.name || "").trim();
    const [oauthFirstName = "", ...oauthLastNameParts] = fullName.split(/\s+/).filter(Boolean);
    const firstName = String(metadata.first_name || (supportsNameFields ? existing?.first_name : "") || oauthFirstName || "").trim();
    const lastName = String(metadata.last_name || (supportsNameFields ? existing?.last_name : "") || oauthLastNameParts.join(" ") || "").trim();
    const username = String(metadata.username || existing?.username || fullName || email.split("@")[0] || "utilizador").trim();
    const phone = String(metadata.phone || existing?.phone || "").trim();
    const region = String(metadata.region || (supportsRegionField ? existing?.region : "") || "").trim();
    const city = String(metadata.city || existing?.city || "").trim();
    const avatarSeed = username;
    const status = normalizeProfileStatus(supportsStatusField ? existing?.status : "member");
    const isAdmin = Boolean(existing?.is_admin) || isBootstrapAdmin(email);
    const isBlocked = Boolean(existing?.is_blocked);

    if (isBlocked) {
      await supabase.auth.signOut();
      throw new Error("Conta bloqueada.");
    }

    if (!existing) {
      const insertProfile: Record<string, any> = {
        id: userId,
        username,
        email,
        phone,
        avatar_seed: avatarSeed,
        is_admin: isAdmin,
        is_blocked: false,
      };

      if (supportsRegionField) {
        insertProfile.region = region;
      }

      insertProfile.city = city;

      if (supportsNameFields) {
        insertProfile.first_name = firstName || null;
        insertProfile.last_name = lastName || null;
      }

      const { data: insertedProfile, error } = await supabase
        .from("user_profiles")
        .insert(insertProfile)
        .select("created_at")
        .single();
      if (error) throw error;

      return {
        first_name: firstName || null,
        last_name: lastName || null,
        username,
        email,
        phone,
        region,
        city,
        avatar_seed: avatarSeed,
        status: "member",
        is_admin: isAdmin,
        is_blocked: false,
        created_at: insertedProfile?.created_at || null,
      };
    }

    const profileUpdates: Record<string, any> = {
      email,
      phone,
      ...(isAdmin && !existing.is_admin ? { is_admin: true } : {}),
    };

    if (supportsRegionField) {
      profileUpdates.region = region;
    }

    profileUpdates.city = city;

    if (supportsNameFields) {
      profileUpdates.first_name = firstName || null;
      profileUpdates.last_name = lastName || null;
    }

    const { error } = await supabase
      .from("user_profiles")
      .update(profileUpdates)
      .eq("id", userId);
    if (error) throw error;

    return {
      username,
      first_name: firstName || null,
      last_name: lastName || null,
      email,
      phone,
      region,
      city,
      avatar_seed: existing.avatar_seed || avatarSeed,
      status,
      is_admin: isAdmin,
      is_blocked: isBlocked,
      created_at: existing.created_at || null,
    };
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signInWithProvider, signUp, updateProfileDetails, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
