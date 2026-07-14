import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { getSession, onAuthStateChange, signOut as supabaseSignOut } from "@/lib/supabase/auth";
import { hasSupabaseConfig } from "@/lib/supabase/client";

interface AuthContextValue {
  session: unknown;
  isLoading: boolean;
  signOut: () => Promise<void>;
  isConfigured: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!hasSupabaseConfig()) {
      setIsLoading(false);
      navigate("/login");
      return;
    }

    getSession().then((s) => {
      setSession(s);
      setIsLoading(false);
      if (!s) navigate("/login");
    }).catch(() => {
      setIsLoading(false);
      navigate("/login");
    });

    const { data: listener } = onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) navigate("/login");
    });

    return () => listener?.subscription.unsubscribe();
  }, [navigate]);

  async function signOut() {
    await supabaseSignOut();
    navigate("/login");
  }

  return (
    <AuthContext.Provider value={{ session, isLoading, signOut, isConfigured: hasSupabaseConfig() }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
