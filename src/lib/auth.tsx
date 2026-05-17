import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import type { User } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (profile: SignUpProfile) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
}

interface UserProfile {
  first_name: string | null;
  last_name: string | null;
  username: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  avatar_seed: string;
  is_admin: boolean;
  is_blocked: boolean;
  created_at: string | null;
}

interface SignUpProfile {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  phone: string;
  city: string;
}

interface SignUpResult {
  needsEmailConfirmation: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => ({ needsEmailConfirmation: false }),
  signOut: async () => {},
});

const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS || "admin@admin.pt")
  .split(",")
  .map((email: string) => email.trim().toLowerCase())
  .filter(Boolean);

function isBootstrapAdmin(email: string) {
  return adminEmails.includes(email.trim().toLowerCase());
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        (async () => {
          try {
            const nextProfile = await createOrUpdateProfile(currentUser);
            setProfile(nextProfile);
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
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
  };

  const signUp = async ({ firstName, lastName, username, email, password, phone, city }: SignUpProfile) => {
    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const cleanUsername = username.trim();
    const cleanEmail = email.trim();
    const cleanPhone = phone.trim();
    const cleanCity = city.trim();

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          first_name: cleanFirstName,
          last_name: cleanLastName,
          username: cleanUsername,
          phone: cleanPhone,
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

  const createOrUpdateProfile = async (currentUser: User) => {
    const userId = currentUser.id;
    const metadata = currentUser.user_metadata || {};
    const email = currentUser.email || "";

    let supportsNameFields = true;
    let existing: any = null;
    const { data: selectedProfile, error: profileSelectError } = await supabase
      .from("user_profiles")
      .select("id, first_name, last_name, username, email, phone, city, avatar_seed, is_admin, is_blocked, created_at")
      .eq("id", userId)
      .maybeSingle();
    existing = selectedProfile;

    if (profileSelectError) {
      const message = String(profileSelectError.message || "").toLowerCase();
      const nameFieldsMissing = message.includes("first_name") || message.includes("last_name") || profileSelectError.code === "42703" || profileSelectError.code === "PGRST204";
      if (!nameFieldsMissing) throw profileSelectError;

      supportsNameFields = false;
      const fallback = await supabase
        .from("user_profiles")
        .select("id, username, email, phone, city, avatar_seed, is_admin, is_blocked, created_at")
        .eq("id", userId)
        .maybeSingle();
      if (fallback.error) throw fallback.error;
      existing = fallback.data;
    }

    const firstName = String(metadata.first_name || (supportsNameFields ? existing?.first_name : "") || "").trim();
    const lastName = String(metadata.last_name || (supportsNameFields ? existing?.last_name : "") || "").trim();
    const username = String(metadata.username || existing?.username || email.split("@")[0] || "utilizador").trim();
    const phone = String(metadata.phone || existing?.phone || "").trim();
    const city = String(metadata.city || existing?.city || "").trim();
    const avatarSeed = username;
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
        city,
        avatar_seed: avatarSeed,
        is_admin: isAdmin,
        is_blocked: false,
      };

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
        city,
        avatar_seed: avatarSeed,
        is_admin: isAdmin,
        is_blocked: false,
        created_at: insertedProfile?.created_at || null,
      };
    }

    const profileUpdates: Record<string, any> = {
      email,
      phone,
      city,
      ...(isAdmin && !existing.is_admin ? { is_admin: true } : {}),
    };

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
      city,
      avatar_seed: existing.avatar_seed || avatarSeed,
      is_admin: isAdmin,
      is_blocked: isBlocked,
      created_at: existing.created_at || null,
    };
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
