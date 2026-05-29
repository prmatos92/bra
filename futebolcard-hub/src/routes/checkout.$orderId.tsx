import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { CheckCircle2, Copy, Loader2, Camera, Upload } from "lucide-react";
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
  const [holderPhotos, setHolderPhotos] = useState<(string | null)[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraTargetIdx, setCameraTargetIdx] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
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
          setPaid(true);          const totalHolders = o.items.reduce((sum, item) => sum + item.qty, 0);
          setHolderPhotos(Array.from({ length: totalHolders }, () => null));          sessionStorage.removeItem(`order_cache_${orderId}`);
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
          setPaid(true);          const totalHolders = o.items.reduce((sum, item) => sum + item.qty, 0);
          setHolderPhotos(Array.from({ length: totalHolders }, () => null));          return;
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

  if (paid) {
    // Calculate total holders
    const totalHolders = order.items.reduce((sum, item) => sum + item.qty, 0);
    const allPhotosCapture = holderPhotos.every((p) => p !== null);

    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
          <div className="mb-8 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
            <h1 className="mt-4 text-2xl font-extrabold">Pagamento confirmado!</h1>
            <p className="mt-2 text-muted-foreground">
              Agora é necessário capturar a foto biométrica dos portadores para liberar acesso ao evento.
            </p>
          </div>

          {/* Photo capture section */}
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm mb-6">
            <h2 className="mb-6 text-lg font-bold text-foreground">Fotos dos portadores</h2>
            <div className="space-y-6">
              {order.items.map((item, itemIdx) => {
                let holderStartIdx = 0;
                for (let i = 0; i < itemIdx; i++) {
                  holderStartIdx += order.items[i].qty;
                }

                return (
                  <div key={itemIdx} className="space-y-3">
                    {Array.from({ length: item.qty }).map((_, qtyIdx) => {
                      const holderIdx = holderStartIdx + qtyIdx;
                      return (
                        <div
                          key={holderIdx}
                          className={`rounded-xl border-2 border-dashed p-4 ${
                            holderPhotos[holderIdx]
                              ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                              : "border-amber-400 bg-amber-50 dark:bg-amber-950/20"
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            {holderPhotos[holderIdx] ? (
                              <img
                                src={holderPhotos[holderIdx]!}
                                alt={`Foto portador ${holderIdx + 1}`}
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
                                📸 Portador {holderIdx + 1}
                                <span className="ml-2 text-xs font-normal text-muted-foreground">
                                  ({item.sectorName} – {item.ticketType === "meia" ? "Meia" : "Inteira"})
                                </span>
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                Use uma foto recente, com rosto visível e fundo neutro.
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => openCamera(holderIdx)}
                                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                    holderPhotos[holderIdx]
                                      ? "border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                                  }`}
                                >
                                  <Camera className="h-3.5 w-3.5" />
                                  {holderPhotos[holderIdx] ? "Tirar nova foto" : "Câmera"}
                                </button>
                                <label className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold border border-border bg-background hover:bg-muted cursor-pointer transition">
                                  <Upload className="h-3.5 w-3.5" />
                                  Upload
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handlePhotoChange(holderIdx, e)}
                                    className="hidden"
                                  />
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </section>

          {/* CTA button */}
          <button
            type="button"
            onClick={() => {
              if (allPhotosCapture) {
                navigate({ to: "/meus-ingressos" });
              } else {
                toast.error("Preencha todas as fotos biométricas antes de continuar");
              }
            }}
            disabled={!allPhotosCapture}
            className="w-full rounded-full bg-primary py-4 text-base font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          >
            {allPhotosCapture ? "Continuar para meus ingressos" : "Capture todas as fotos para continuar"}
          </button>
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

