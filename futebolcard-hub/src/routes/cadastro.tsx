import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { User, Mail, Lock } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/lib/auth-context";
import { Field } from "./login";

export const Route = createFileRoute("/cadastro")({
  head: () => ({ meta: [{ title: "FutebolCard | Criar conta" }] }),
  component: SignupPage,
});

function SignupPage() {
  const { signUp, configured } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!configured) {
      toast.error("Supabase não configurado. Preencha o arquivo .env.");
      return;
    }
    if (password.length < 6) {
      toast.error("A senha deve ter ao menos 6 caracteres.");
      return;
    }
    setBusy(true);
    try {
      await signUp(name, email, password);
      toast.success("Conta criada! Bem-vindo.");
      navigate({ to: "/" });
    } catch (err) {
      const e = err as Error;
      toast.error(e.message ?? "Falha ao cadastrar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main className="mx-auto w-full max-w-[440px] flex-1 px-6 py-10">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-black">CRIAR CONTA</h1>
          <p className="mt-2 text-base text-gray-700">Preencha seus dados</p>
        </div>

        <form onSubmit={onSubmit} className="mt-10 space-y-6">
          <Field label="Nome completo" icon={User} value={name} onChange={setName} required autoComplete="name" />
          <Field label="E-mail" icon={Mail} type="email" value={email} onChange={setEmail} required autoComplete="email" />
          <Field label="Senha" icon={Lock} type="password" value={password} onChange={setPassword} required autoComplete="new-password" showToggle />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-primary px-6 py-4 text-base font-bold text-primary-foreground shadow-lg transition hover:bg-primary-dark disabled:opacity-60"
          >
            {busy ? "Cadastrando..." : "Criar conta"}
          </button>
        </form>

        <p className="mt-10 text-center text-base text-black">
          Já tem conta?{" "}
          <Link to="/login" className="font-bold text-primary hover:underline">
            Entrar
          </Link>
        </p>
      </main>
      <Footer />
    </div>
  );
}
