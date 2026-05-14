import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Ticket as TicketIcon } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/lib/auth-context";
import { listMyTickets } from "@/lib/orders";
import type { Ticket } from "@/lib/types";

export const Route = createFileRoute("/meus-ingressos")({
  head: () => ({ meta: [{ title: "FutebolCard | Meus ingressos" }] }),
  component: MyTicketsPage,
});

function MyTicketsPage() {
  const { user, loading, configured } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login", search: { redirect: "/meus-ingressos" } });
      return;
    }
    if (!configured) {
      setTickets([]);
      return;
    }
    listMyTickets(user.id)
      .then(setTickets)
      .catch((e) => {
        toast.error((e as Error).message);
        setTickets([]);
      });
  }, [user, loading, configured, navigate]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        <h1 className="mb-6 text-2xl font-extrabold text-foreground">Meus ingressos</h1>

        {!configured && (
          <p className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-foreground">
            Supabase não configurado — adicione as variáveis no arquivo <code>.env</code> para ver seus ingressos.
          </p>
        )}

        {tickets === null ? (
          <p className="text-muted-foreground">Carregando ingressos...</p>
        ) : tickets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <TicketIcon className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-3 font-medium text-foreground">Você ainda não tem ingressos.</p>
            <Link
              to="/jogos"
              className="mt-4 inline-block rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition hover:bg-primary-dark"
            >
              Ver próximos jogos
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {tickets.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="rounded-xl bg-white p-2">
                  <QRCodeSVG value={t.code} size={96} />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-foreground">{t.matchTitle}</p>
                  <p className="text-sm text-muted-foreground">Setor: {t.sectorName}</p>
                  <p className="mt-1 font-mono text-xs text-foreground">{t.code}</p>
                  {t.used && (
                    <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                      Utilizado
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
