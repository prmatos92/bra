import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { CheckCircle2, Copy, Loader2 } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { StepIndicator } from "@/components/StepIndicator";
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
  const pixFiredRef = useRef(false);

  // Camera and photo state
  const [holderPhotos, setHolderPhotos] = useState<(string | null)[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraTargetIdx, setCameraTargetIdx] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!paid || !order || pixFiredRef.current) return;
    pixFiredRef.current = true;
    (window as Window & { fbq?: Function }).fbq?.('track', 'Purchase', {
      value: order.total,
      currency: 'BRL',
      content_ids: [order.matchId],
      content_name: order.matchTitle,
      content_type: 'product',
      num_items: order.items.reduce((s, i) => s + i.qty, 0),
    });
  }, [paid, order]);

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

  // Initialize holderPhotos when order loads
  useEffect(() => {
    if (order && paid) {
      setHolderPhotos(Array.from({ length: order.items.reduce((s, i) => s + i.qty, 0) }, () => null));
    }
  }, [order, paid]);

  // Camera functions
  const openCamera = async (idx: number) => {
    setCameraTargetIdx(idx);
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      cameraStreamRef.current = stream;
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      toast.error("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
      setCameraOpen(false);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setHolderPhoto(cameraTargetIdx, dataUrl);
    closeCamera();
    toast.success("Foto capturada com sucesso!");
  };

  const closeCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    setCameraOpen(false);
  };

  const setHolderPhoto = (idx: number, dataUrl: string | null) => {
    setHolderPhotos((prev) => {
      const next = [...prev];
      next[idx] = dataUrl;
      return next;
    });
  };

  const handlePhotoChange = (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setHolderPhoto(idx, reader.result as string);
    reader.readAsDataURL(file);
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

  const orderCode = "BFC-" + order.id.slice(0, 8).toUpperCase();

  if (paid) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="mx-auto w-full max-w-xl flex-1 px-4 py-12">
          <StepIndicator steps={["Ingresso", "Dados", "Pagamento", "Confirmação"]} currentStep={4} />
          <div className="text-center">
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
          </div>

          {/* Código do pedido */}
          <div className="mt-6 rounded-2xl border-2 border-primary bg-primary/5 p-5 text-center">
            <p className="text-xs font-semibold text-muted-foreground">Código do seu pedido</p>
            <p className="mt-1 font-mono text-3xl font-extrabold tracking-widest text-primary">
              {orderCode}
            </p>
            <button
              type="button"
              onClick={() => { navigator.clipboard.writeText(orderCode); toast.success("Código copiado!"); }}
              className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Copy className="h-3 w-3" /> Copiar código
            </button>
            <p className="mt-2 text-xs text-muted-foreground">
              Guarde este código para consultar seus ingressos em{" "}
              <strong>Ver meus ingressos</strong>.
            </p>
          </div>

          {/* Captura de fotos dos portadores */}
          <div className="mt-8 space-y-4">
            <h2 className="text-lg font-extrabold text-foreground">📸 Enviar fotos para acesso biométrico</h2>
            {order.items.map((item, itemIdx) => {
              let holderIdx = 0;
              for (let i = 0; i < itemIdx; i++) {
                holderIdx += order.items[i].qty;
              }
              return Array.from({ length: item.qty }, (_, i) => {
                const idx = holderIdx + i;
                return (
                  <div
                    key={idx}
                    className={`rounded-xl border-2 border-dashed p-4 ${
                      holderPhotos[idx]
                        ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                        : "border-amber-400 bg-amber-50 dark:bg-amber-950/20"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {holderPhotos[idx] ? (
                        <img
                          src={holderPhotos[idx]!}
                          alt={`Foto portador ${idx + 1}`}
                          className="h-20 w-20 rounded-full object-cover border-2 border-green-500 shadow"
                        />
                      ) : (
                        <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full bg-muted border-2 border-dashed border-border">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-9 w-9 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          Portador {idx + 1} {holderPhotos[idx] && "✓"}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Use uma foto recente, com rosto visível e fundo neutro.
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openCamera(idx)}
                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                              holderPhotos[idx]
                                ? "border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                                : "bg-primary text-primary-foreground hover:bg-primary/90"
                            }`}
                          >
                            📷 {holderPhotos[idx] ? "Tirar nova foto" : "Câmera ao vivo"}
                          </button>
                          <label className="inline-block">
                            <input
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              onChange={(e) => handlePhotoChange(idx, e)}
                            />
                            <span className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted/70">
                              📁 {holderPhotos[idx] ? "Trocar arquivo" : "Escolher arquivo"}
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              });
            })}
          </div>

          {/* Aviso de entrada biométrica */}
          <div className="mt-8 rounded-2xl border-2 border-blue-500 bg-blue-50 dark:bg-blue-950/30 p-5">
            <div className="flex items-start gap-3">
              <span className="text-3xl">&#x1F5C2;&#xFE0F;</span>
              <div>
                <p className="font-extrabold text-blue-800 dark:text-blue-300 text-base">
                  Entrada exclusiva por biometria facial
                </p>
                <p className="mt-1 text-sm text-blue-700 dark:text-blue-400">
                  No Maracanã, <strong>não há ingresso físico ou QR Code na catraca</strong>. As fotos que você está enviando são usadas para liberar o acesso automaticamente.
                </p>
                <ul className="mt-3 space-y-1.5 text-sm text-blue-700 dark:text-blue-400">
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-blue-500">&#10003;</span>
                    Dirija-se à catraca biométrica com a foto do rosto visível
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-blue-500">&#10003;</span>
                    Não use boné, óculos escuros ou máscara no momento do acesso
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-blue-500">&#10003;</span>
                    Cada portador deve passar individualmente pelo leitor
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-blue-500">&#10003;</span>
                    Leve um documento de identidade como comprovante de apoio
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </main>

        {/* Camera overlay */}
        {cameraOpen && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4">
            <div className="w-full max-w-lg space-y-4">
              <p className="text-center text-sm font-semibold text-white">
                Posicione seu rosto no centro e clique em <strong>Tirar foto</strong>
              </p>
              <div className="relative overflow-hidden rounded-2xl bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full rounded-2xl"
                />
                {/* Face guide */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-52 w-40 rounded-full border-4 border-white/60 shadow-lg" />
                </div>
              </div>
              <canvas ref={canvasRef} className="hidden" />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeCamera}
                  className="flex-1 rounded-full border border-white/30 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="flex-1 rounded-full bg-white py-3 text-sm font-bold text-black transition hover:bg-white/90"
                >
                  📸 Tirar foto
                </button>
              </div>
            </div>
          </div>
        )}

        <Footer />
      </div>
    );
  }

  const pixCode = order.pixQrCode ?? "";
  const pixUrl = order.pixQrCodeUrl ?? "";

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
        <StepIndicator steps={["Ingresso", "Dados", "Pagamento", "Confirmação"]} currentStep={3} />

        <h1 className="text-2xl font-extrabold text-foreground">Finalizar pagamento</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pedido <span className="font-mono">{order.id}</span>
        </p>

        <div className="mt-6 space-y-6">
          {/* PIX QR Code — topo */}
          <section className="rounded-2xl border-2 border-green-400 bg-card p-6 shadow-sm text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="text-2xl">⚡</span>
              <h2 className="text-lg font-extrabold text-foreground">Pague com PIX</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Escaneie o QR Code ou copie o código abaixo
            </p>
            <div className="flex justify-center">
              <div className="rounded-2xl bg-white p-4 shadow-inner">
                {pixUrl ? (
                  <img src={pixUrl} alt="QR Code Pix" className="h-[200px] w-[200px]" />
                ) : pixCode ? (
                  <QRCodeSVG value={pixCode} size={200} />
                ) : (
                  <div className="flex h-[200px] w-[200px] items-center justify-center text-muted-foreground text-sm">
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
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-green-400 bg-green-50 dark:bg-green-950/20 px-4 py-2 text-sm font-semibold text-green-700 dark:text-green-300 transition hover:bg-green-100 dark:hover:bg-green-900/30"
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
              className="mt-3 text-xs text-muted-foreground hover:underline"
            >
              Cancelar pedido
            </button>
          </section>

          {/* Dados do pedido — abaixo */}
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

            <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
              <p className="text-[10px] text-muted-foreground">Código do pedido</p>
              <p className="font-mono text-sm font-bold text-primary">{orderCode}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Guarde para consultar seus ingressos</p>
            </div>

            {/* Aviso biometria */}
            <div className="mt-4 rounded-xl border border-blue-400 bg-blue-50 dark:bg-blue-950/30 p-3">
              <p className="text-xs font-extrabold text-blue-800 dark:text-blue-300">
                &#x1F465; Entrada por biometria facial
              </p>
              <p className="mt-1 text-xs text-blue-700 dark:text-blue-400">
                Não há ingresso físico. Sua foto cadastrada libera o acesso automaticamente nas catracas biométricas do Maracanã.
              </p>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

