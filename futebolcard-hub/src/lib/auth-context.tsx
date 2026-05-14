import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase, isFirebaseConfigured } from "@/lib/firebase";

type AuthState = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = isFirebaseConfigured;

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [configured]);

  const signIn = useCallback(async (email: string, password: string) => {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Tempo limite excedido. Verifique sua conexão ou tente novamente.")), 15000)
    );
    const request = getSupabase().auth.signInWithPassword({ email, password }).then(({ error }) => {
      if (error) throw new Error(error.message);
    });
    await Promise.race([request, timeout]);
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Tempo limite excedido. Verifique sua conexão ou tente novamente.")), 15000)
    );
    const request = getSupabase().auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    }).then(({ error }) => {
      if (error) throw new Error(error.message);
    });
    await Promise.race([request, timeout]);
  }, []);

  const logout = useCallback(async () => {
    await getSupabase().auth.signOut();
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, configured, signIn, signUp, logout }),
    [user, loading, configured, signIn, signUp, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}
