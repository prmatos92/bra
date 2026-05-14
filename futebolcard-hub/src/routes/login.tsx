import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/lib/auth-context";
import bannerLogin from "@/assets/banner-login.png";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : "/",
  }),
  head: () => ({ meta: [{ title: "FutebolCard | Entrar" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { signIn, configured } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!configured) {
      toast.error("Supabase não configurado. Preencha o arquivo .env.");
      return;
    }
    setBusy(true);
    try {
      await signIn(email, password);
      toast.success("Bem-vindo de volta!");
      navigate({ to: search.redirect as "/" });
    } catch (err) {
      const e = err as Error;
      toast.error(e.message ?? "Falha ao entrar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />

      <div className="w-full">
        <img
          src={bannerLogin}
          alt="Brasil x Panamá"
          className="block w-full object-cover"
        />
      </div>

      <main className="mx-auto w-full max-w-[440px] flex-1 px-6 py-10">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-black">ACESSAR</h1>
          <p className="mt-2 text-base text-gray-700">
            Digite seus dados
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-10 space-y-6">
          <Field
            label="E-mail"
            icon={Mail}
            type="email"
            value={email}
            onChange={setEmail}
            required
            autoComplete="username"
          />

          <div className="space-y-4">
            <Field
              label="Senha"
              icon={Lock}
              type="password"
              value={password}
              onChange={setPassword}
              required
              autoComplete="current-password"
              showToggle
            />
            <div className="flex justify-start">
              <button
                type="button"
                className="text-sm font-medium text-gray-500 hover:text-black transition"
              >
                Esqueceu a senha?
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-primary px-6 py-4 text-base font-bold text-primary-foreground shadow-lg transition hover:bg-primary-dark disabled:opacity-60"
          >
            {busy ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-10 text-center text-base text-black">
          Não possui uma conta?{" "}
          <Link to="/cadastro" className="font-bold text-primary hover:underline">
            Crie agora
          </Link>
        </p>
      </main>
      <Footer />
    </div>
  );
}

interface FieldProps {
  label: string;
  icon: any;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  autoComplete?: string;
  showToggle?: boolean;
}

export function Field({
  label,
  icon: Icon,
  type = "text",
  value,
  onChange,
  required,
  autoComplete,
  showToggle,
}: FieldProps) {
  const [show, setShow] = useState(false);
  const inputType = showToggle ? (show ? "text" : "password") : type;

  return (
    <div className="group relative">
      <div className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 text-primary transition-colors">
        <Icon className="h-5 w-5" strokeWidth={1.5} />
      </div>
      <label className="absolute left-14 top-3 text-[10px] font-semibold text-primary/80">
        {label}
      </label>
      <input
        type={inputType}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoComplete={autoComplete}
        className="w-full rounded-[2rem] border-2 border-transparent bg-[#efefef] pb-2.5 pl-14 pr-12 pt-7 text-base font-medium text-black transition focus:border-primary focus:bg-white focus:outline-none"
      />
      {showToggle && (
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-500 transition hover:text-black"
        >
          {show ? <EyeOff className="h-5 w-5" strokeWidth={1.5} /> : <Eye className="h-5 w-5" strokeWidth={1.5} />}
        </button>
      )}
    </div>
  );
}
