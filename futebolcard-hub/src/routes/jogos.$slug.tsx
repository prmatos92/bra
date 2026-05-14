import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MapPin, Calendar, Clock, Minus, Plus, AlertCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { findMatchBySlug } from "@/data/matches";
import { formatBRL, formatMatchDate, formatMatchTime } from "@/lib/format";

export const Route = createFileRoute("/jogos/$slug")({
  head: ({ params }) => {
    const m = findMatchBySlug(params.slug);
    const title = m
      ? `${m.homeTeam} x ${m.awayTeam} — ${m.venue}`
      : "Jogo da Seleção Brasileira";
    return {
      meta: [
        { title },
        {
          name: "description",
          content: m
            ? `Compre seu ingresso para ${m.homeTeam} x ${m.awayTeam} no ${m.venue} (${m.city}).`
            : "Ingressos da Seleção Brasileira.",
        },
        { property: "og:title", content: title },
      ],
    };
  },
  component: MatchDetailPage,
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto max-w-2xl flex-1 px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Jogo não encontrado</h1>
        <Link to="/jogos" className="mt-4 inline-block text-primary underline">
          Ver todos os jogos
        </Link>
      </main>
      <Footer />
    </div>
  ),
});

const MAX_TICKETS = 4;

function MatchDetailPage() {
  const { slug } = Route.useParams();
  const match = findMatchBySlug(slug);
  const navigate = useNavigate();
  // qty por setor: { [sectorId]: { inteira: number; meia: number } }
  const [qty, setQty] = useState<Record<string, { inteira: number; meia: number }>>({});
  const [submitting, setSubmitting] = useState(false);

  const totalQty = useMemo(
    () => Object.values(qty).reduce((s, v) => s + v.inteira + v.meia, 0),
    [qty],
  );

  const items = useMemo(
    () =>
      (match?.sectors ?? []).flatMap((s) => {
        const sQty = qty[s.id] ?? { inteira: 0, meia: 0 };
        const list: { sector: typeof s; qty: number; type: "inteira" | "meia"; unitPrice: number }[] = [];
        if (sQty.inteira > 0)
          list.push({ sector: s, qty: sQty.inteira, type: "inteira", unitPrice: s.price });
        if (sQty.meia > 0)
          list.push({ sector: s, qty: sQty.meia, type: "meia", unitPrice: Math.round(s.price / 2) });
        return list;
      }),
    [qty, match?.sectors],
  );

  if (!match) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="mx-auto max-w-2xl flex-1 px-4 py-20 text-center">
          <h1 className="text-2xl font-bold">Jogo não encontrado</h1>
          <Link to="/jogos" className="mt-4 inline-block text-primary underline">
            Ver todos os jogos
          </Link>
        </main>
        <Footer />
      </div>
    );
  }
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const fee = Math.round(subtotal * 0.18 * 100) / 100;
  const total = subtotal + fee;

  const onChangeQty = (id: string, type: "inteira" | "meia", delta: number) => {
    setQty((prev) => {
      const current = prev[id] ?? { inteira: 0, meia: 0 };
      if (delta > 0 && totalQty >= MAX_TICKETS) return prev;
      const next = Math.max(0, current[type] + delta);
      return { ...prev, [id]: { ...current, [type]: next } };
    });
  };

  const onContinue = () => {
    if (totalQty === 0) {
      toast.error("Selecione ao menos um ingresso");
      return;
    }
    if (!match) return;
    setSubmitting(true);
    try {
      const cart = {
        matchSlug: match.slug,
        matchId: match.id,
        matchTitle: `${match.homeTeam} x ${match.awayTeam}`,
        items: items.map((i) => ({
          sectorId: i.sector.id,
          sectorName: i.sector.name,
          qty: i.qty,
          ticketType: i.type,
          unitPrice: i.unitPrice,
        })),
      };
      sessionStorage.setItem("futebolcard_cart", JSON.stringify(cart));
      void navigate({ to: "/comprar/$slug", params: { slug: match.slug } });
    } catch (e) {
      const err = e as Error;
      toast.error(err.message ?? "Erro ao processar carrinho");
    } finally {
      setSubmitting(false);
    }
  };

  const isClosed = match.status === "esgotado" || match.status === "em_breve";

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <section
        className="relative overflow-hidden"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-10">
          <p className="text-xs font-bold uppercase tracking-widest text-white/80">
            {match.competition}
          </p>
          <div className="flex items-center gap-4 sm:gap-8">
            <img src={match.homeBadge} alt={match.homeTeam} className="h-24 w-auto sm:h-32" />
            <div className="flex h-12 w-12 shrink-0 items-center justify-center self-center rounded-full border-2 border-white/40 bg-white/20 shadow-lg backdrop-blur-sm mr-[-32px] sm:mr-[-48px] sm:h-16 sm:w-16">
              <span className="text-lg font-black tracking-tight text-white sm:text-2xl">VS</span>
            </div>
            <img src={match.awayBadge} alt={match.awayTeam} className="h-28 w-auto sm:h-40" />
          </div>
          <h1 className="text-center text-2xl font-extrabold text-white sm:text-3xl">
            {match.homeTeam} x {match.awayTeam}
          </h1>
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm font-medium">
            <span className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-foreground">
              <MapPin className="h-4 w-4 text-primary" />
              {match.venue} — {match.city}
            </span>
            <span className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-foreground">
              <Calendar className="h-4 w-4 text-primary" />
              {formatMatchDate(match.datetime)}
            </span>
            <span className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-foreground">
              <Clock className="h-4 w-4 text-primary" />
              {formatMatchTime(match.datetime)}
            </span>
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        {isClosed && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm text-foreground">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <div>
              <p className="font-bold">
                {match.status === "em_breve"
                  ? "Vendas em breve"
                  : "Ingressos esgotados"}
              </p>
              <p className="text-muted-foreground">
                {match.status === "em_breve"
                  ? "Os ingressos serão liberados em breve. Cadastre-se para receber avisos."
                  : "Todos os setores estão esgotados para este jogo."}
              </p>
            </div>
          </div>
        )}

        <h2 className="mb-4 text-xl font-extrabold text-foreground">Selecione seus ingressos</h2>
        <p className="mb-4 text-sm text-muted-foreground">Limite de {MAX_TICKETS} ingressos por compra.</p>
        <div className="space-y-3">
          {match.sectors.map((s) => {
            const remaining = s.capacity - s.sold;
            const sectorClosed = isClosed || remaining <= 0;
            const sQty = qty[s.id] ?? { inteira: 0, meia: 0 };
            const meiaPrice = Math.round(s.price / 2);
            return (
              <div
                key={s.id}
                className="rounded-2xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-bold text-foreground">{s.name}</p>
                  {sectorClosed && (
                    <p className="text-xs text-muted-foreground">
                      {match.status === "em_breve" ? "Em breve" : "Esgotado"}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  {/* Inteira */}
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <span className="text-sm font-semibold text-foreground">Inteira</span>
                      <span className="ml-2 text-base font-extrabold text-primary">{formatBRL(s.price)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={sectorClosed || sQty.inteira === 0}
                        onClick={() => onChangeQty(s.id, "inteira", -1)}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-foreground transition hover:bg-muted disabled:opacity-40"
                        aria-label="Diminuir inteira"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-6 text-center font-bold">{sQty.inteira}</span>
                      <button
                        type="button"
                        disabled={sectorClosed || totalQty >= MAX_TICKETS || sQty.inteira >= remaining}
                        onClick={() => onChangeQty(s.id, "inteira", +1)}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-foreground transition hover:bg-muted disabled:opacity-40"
                        aria-label="Aumentar inteira"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {/* Meia-Entrada */}
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <span className="text-sm font-semibold text-foreground">Meia-Entrada</span>
                      <span className="ml-2 text-base font-extrabold text-primary">{formatBRL(meiaPrice)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={sectorClosed || sQty.meia === 0}
                        onClick={() => onChangeQty(s.id, "meia", -1)}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-foreground transition hover:bg-muted disabled:opacity-40"
                        aria-label="Diminuir meia"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-6 text-center font-bold">{sQty.meia}</span>
                      <button
                        type="button"
                        disabled={sectorClosed || totalQty >= MAX_TICKETS || sQty.meia >= remaining}
                        onClick={() => onChangeQty(s.id, "meia", +1)}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-foreground transition hover:bg-muted disabled:opacity-40"
                        aria-label="Aumentar meia"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 rounded-2xl bg-secondary p-5">
          <div className="space-y-1 text-sm text-muted-foreground">
            <div className="flex justify-between">
              <span>Subtotal ({totalQty} ingresso{totalQty !== 1 ? "s" : ""})</span>
              <span className="font-semibold text-foreground">{formatBRL(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Taxa de serviço (18%)</span>
              <span className="font-semibold text-foreground">{formatBRL(fee)}</span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-3">
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-2xl font-extrabold text-foreground">{formatBRL(total)}</p>
            </div>
            <button
              type="button"
              onClick={onContinue}
              disabled={isClosed || totalQty === 0 || submitting}
              className="rounded-full bg-primary px-8 py-3 text-sm font-bold text-primary-foreground shadow-md transition hover:bg-primary-dark disabled:opacity-50"
            >
              {submitting ? "Processando..." : "Continuar para pagamento"}
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
