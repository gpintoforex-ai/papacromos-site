import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import type { User } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (profile: SignUpProfile) => Promise<void>;
  signOut: () => Promise<void>;
}

interface UserProfile {
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
  username: string;
  email: string;
  password: string;
  phone: string;
  city: string;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async ({ username, email, password, phone, city }: SignUpProfile) => {
    const cleanUsername = username.trim();
    const cleanEmail = email.trim();
    const cleanPhone = phone.trim();
    const cleanCity = city.trim();

    const { error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          username: cleanUsername,
          phone: cleanPhone,
          city: cleanCity,
        },
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const createOrUpdateProfile = async (currentUser: User) => {
    const userId = currentUser.id;
    const metadata = currentUser.user_metadata || {};
    const email = currentUser.email || "";

    const { data: existing } = await supabase
      .from("user_profiles")
      .select("id, username, email, phone, city, avatar_seed, is_admin, is_blocked, created_at")
      .eq("id", userId)
      .maybeSingle();

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
      const { error } = await supabase.from("user_profiles").insert({
        id: userId,
        username,
        email,
        phone,
        city,
        avatar_seed: avatarSeed,
        is_admin: isAdmin,
        is_blocked: false,
      });
      if (error) throw error;

      return { username, email, phone, city, avatar_seed: avatarSeed, is_admin: isAdmin, is_blocked: false, created_at: null };
    }

    const { error } = await supabase
      .from("user_profiles")
      .update({
        email,
        phone,
        city,
        ...(isAdmin && !existing.is_admin ? { is_admin: true } : {}),
      })
      .eq("id", userId);
    if (error) throw error;

    return {
      username,
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
