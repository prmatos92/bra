import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/ajuda")({
  head: () => ({ meta: [{ title: "FutebolCard | Ajuda" }] }),
  component: HelpPage,
});

const FAQ = [
  {
    q: "Como compro um ingresso?",
    a: "Escolha o jogo na home, selecione o setor e a quantidade de ingressos e finalize o pagamento via Pix.",
  },
  {
    q: "Posso transferir meu ingresso?",
    a: "Não. O ingresso é vinculado ao CPF do comprador e a entrada no Maracanã é feita por reconhecimento facial biométrico. Não é possível transferir nem emprestar para outra pessoa.",
  },
  {
    q: "Como recebo meus ingressos?",
    a: "Os ingressos ficam disponíveis em 'Meus ingressos' assim que o pagamento é confirmado.",
  },
  {
    q: "Posso cancelar uma compra?",
    a: "Você pode solicitar cancelamento em até 7 dias após a compra, conforme o Código de Defesa do Consumidor.",
  },
];

function HelpPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <h1 className="text-3xl font-extrabold text-foreground">Central de ajuda</h1>
        <p className="mt-2 text-muted-foreground">
          Tire suas principais dúvidas sobre compras e ingressos.
        </p>
        <div className="mt-8 space-y-3">
          {FAQ.map((f) => (
            <details
              key={f.q}
              className="group rounded-2xl border border-border bg-card p-4 shadow-sm"
            >
              <summary className="cursor-pointer list-none font-bold text-foreground">
                {f.q}
              </summary>
              <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
