import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/termos")({
  head: () => ({ meta: [{ title: "FutebolCard | Termos de uso" }] }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 prose prose-neutral">
        <h1 className="text-3xl font-extrabold text-foreground">Termos de uso</h1>
        <p className="mt-4 text-muted-foreground">
          Ao utilizar este site você concorda com os termos descritos abaixo. Este é um modelo
          inicial — substitua pelo texto jurídico definitivo antes de publicar em produção.
        </p>
        <h2 className="mt-6 text-xl font-bold">1. Cadastro</h2>
        <p className="text-muted-foreground">
          O usuário é responsável pela veracidade das informações cadastradas e pela guarda de
          suas credenciais.
        </p>
        <h2 className="mt-6 text-xl font-bold">2. Ingressos</h2>
        <p className="text-muted-foreground">
          Cada ingresso é nominal e intransferível, identificado por QR Code único validado na
          entrada do estádio.
        </p>
        <h2 className="mt-6 text-xl font-bold">3. Pagamentos</h2>
        <p className="text-muted-foreground">
          Pagamentos são processados por meios de pagamento integrados (Pix). Cobranças não
          autorizadas devem ser reportadas em até 24h.
        </p>
      </main>
      <Footer />
    </div>
  );
}
