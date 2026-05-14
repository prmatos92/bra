import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/privacidade")({
  head: () => ({ meta: [{ title: "FutebolCard | Política de privacidade" }] }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <h1 className="text-3xl font-extrabold text-foreground">Política de privacidade</h1>
        <p className="mt-4 text-muted-foreground">
          Coletamos apenas os dados necessários para emitir e validar ingressos: nome, e-mail e
          informações de pagamento. Os dados são armazenados de forma segura no Firebase
          (Google Cloud) e não são compartilhados com terceiros sem autorização.
        </p>
        <h2 className="mt-6 text-xl font-bold">Direitos do titular</h2>
        <p className="text-muted-foreground">
          Conforme a LGPD, você pode solicitar acesso, correção ou exclusão dos seus dados
          enviando um e-mail para privacidade@brasil.com.br.
        </p>
      </main>
      <Footer />
    </div>
  );
}
