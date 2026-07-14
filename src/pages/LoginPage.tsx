import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signIn } from "@/lib/supabase/auth";
import { configureSupabase, hasSupabaseConfig, getSupabaseUrl, getSupabaseAnonKey } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function LoginPage() {
  const [step, setStep] = useState<"setup" | "login">(
    hasSupabaseConfig() ? "login" : "setup"
  );
  const [setupUrl, setSetupUrl] = useState(getSupabaseUrl());
  const [setupKey, setSetupKey] = useState(getSupabaseAnonKey());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  function handleSaveConfig() {
    if (!setupUrl.trim() || !setupKey.trim()) {
      toast.warning("Preencha URL e anon key do Supabase");
      return;
    }
    configureSupabase(setupUrl, setupKey);
    setStep("login");
    toast.success("Configuração salva");
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      navigate("/");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao fazer login"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-femic-navy via-femic-navy/90 to-femic-cyan p-5">
      <div className="w-full max-w-sm rounded-2xl border border-white/20 bg-white/95 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-black tracking-wider text-femic-navy">
            FEMIC
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sistema FEMIC · Araraquara, SP
          </p>
        </div>

        {step === "setup" ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
              <strong>Primeiro acesso</strong>
              <p className="mt-1 text-xs text-sky-700">
                Informe as credenciais do Supabase. Isso é feito uma única
                vez.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-bold text-slate-600">
                URL do projeto Supabase
              </label>
              <input
                type="url"
                placeholder="https://xxxx.supabase.co"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition focus:border-femic-cyan focus:ring-2 focus:ring-femic-cyan/20"
                value={setupUrl}
                onChange={(e) => setSetupUrl(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-bold text-slate-600">
                Anon Key
              </label>
              <input
                type="text"
                placeholder="sua-anon-key"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition focus:border-femic-cyan focus:ring-2 focus:ring-femic-cyan/20"
                value={setupKey}
                onChange={(e) => setSetupKey(e.target.value)}
              />
            </div>

            <Button className="w-full" size="lg" onClick={handleSaveConfig}>
              Salvar e continuar
            </Button>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-bold text-slate-600">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition focus:border-femic-cyan focus:ring-2 focus:ring-femic-cyan/20"
                placeholder="seu@email.com"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-bold text-slate-600">
                Senha
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition focus:border-femic-cyan focus:ring-2 focus:ring-femic-cyan/20"
                placeholder="••••••••"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={loading}
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>

            <button
              type="button"
              className="w-full text-center text-xs text-muted-foreground hover:underline"
              onClick={() => setStep("setup")}
            >
              Configurar Supabase
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
