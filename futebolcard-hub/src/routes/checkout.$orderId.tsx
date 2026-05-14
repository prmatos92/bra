import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { CheckCircle2, Copy, Loader2 } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getOrder, getOrderStatus, cancelOrder } from "@/lib/orders";
import { formatBRL } from "@/lib/format";
import type { Order } from "@/lib/types";

export const Route = createFileRoute("/checkout/$orderId")({
  head: () => ({ meta: [{ title: "Pagamento — Brasil Ingressos" }] }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { orderId } = Route.useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [paid, setPaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const startPolling = () => {
      pollRef.current = setInterval(async () => {
        const status = await getOrderStatus(orderId);
        if (status === "paid") {
          setPaid(true);
          sessionStorage.removeItem(`order_cache_${orderId}`);
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }, 5000);
    };

    // Try sessionStorage cache first — avoids RLS SELECT issue on initial page load
    try {
      const cached = sessionStorage.getItem(`order_cache_${orderId}`);
      if (cached) {
        const o = JSON.parse(cached) as Order;
        setOrder(o);
        if (o.status === "paid") {
          setPaid(true);
          sessionStorage.removeItem(`order_cache_${orderId}`);
        } else {
          startPolling();
        }
        return;
      }
    } catch {}

    // Fall back to DB fetch (for page refresh / direct URL access)
    getOrder(orderId)
      .then((o) => {
        if (!o) {
          toast.error("Pedido não encontrado");
          navigate({ to: "/" });
          return;
        }
        setOrder(o);
        if (o.status === "paid") {
          setPaid(true);
          return;
        }
        startPolling();
      })
      .catch((e) => toast.error((e as Error).message));

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [orderId, navigate]);

  const onCancel = async () => {
    setBusy(true);
    try {
      await cancelOrder(orderId);
      toast.message("Pedido cancelado");
      navigate({ to: "/" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!order) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="mx-auto max-w-2xl flex-1 px-4 py-20 text-center text-muted-foreground">
          Carregando pedido...
        </main>
        <Footer />
      </div>
    );
  }

  if (paid) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="mx-auto w-full max-w-xl flex-1 px-4 py-12 text-center">
          <CheckCircle2 className="mx-auto h-16 w-16 text-success" />
          <h1 className="mt-4 text-2xl font-extrabold">Pagamento confirmado!</h1>
          <p className="mt-2 text-muted-foreground">
            Seus ingressos para <strong>{order.matchTitle}</strong> foram emitidos.
          </p>
          <Link
            to="/meus-ingressos"
            className="mt-6 inline-block rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition hover:bg-primary-dark"
          >
            Ver meus ingressos
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const pixCode = order.pixQrCode ?? "";
  const pixUrl = order.pixQrCodeUrl ?? "";

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <h1 className="text-2xl font-extrabold text-foreground">Finalizar pagamento</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pedido <span className="font-mono">{order.id}</span>
        </p>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-bold text-foreground">{order.matchTitle}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {order.items.map((it) => (
                <li key={it.sectorId} className="flex justify-between text-foreground">
                  <span>
                    {it.qty}× {it.sectorName}{" "}
                    <span className="text-muted-foreground">
                      ({it.ticketType === "meia" ? "Meia" : "Inteira"})
                    </span>
                  </span>
                  <span className="font-semibold">{formatBRL(it.unitPrice * it.qty)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
              <span className="font-bold">Total</span>
              <span className="text-xl font-extrabold text-primary">
                {formatBRL(order.total)}
              </span>
            </div>
            <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground space-y-1">
              <p><span className="font-semibold">Comprador:</span> {order.customerName}</p>
              <p><span className="font-semibold">E-mail:</span> {order.customerEmail}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm text-center">
            <h2 className="font-bold text-foreground">Pague com Pix</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Escaneie o QR Code abaixo ou copie o código
            </p>
            <div className="my-4 flex justify-center">
              <div className="rounded-2xl bg-white p-3">
                {pixUrl ? (
                  <img src={pixUrl} alt="QR Code Pix" className="h-[180px] w-[180px]" />
                ) : pixCode ? (
                  <QRCodeSVG value={pixCode} size={180} />
                ) : (
                  <div className="flex h-[180px] w-[180px] items-center justify-center text-muted-foreground text-sm">
                    QR Code indisponível
                  </div>
                )}
              </div>
            </div>
            {pixCode && (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(pixCode);
                  toast.success("Código Pix copiado");
                }}
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                <Copy className="h-4 w-4" /> Copiar código Pix
              </button>
            )}

            <div className="mt-5 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Aguardando confirmação do pagamento...
            </div>

            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="mt-4 text-xs text-muted-foreground hover:underline"
            >
              Cancelar pedido
            </button>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

