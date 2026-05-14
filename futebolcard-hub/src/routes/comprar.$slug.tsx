import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
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

function maskCep(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
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

function ComprarPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const match = findMatchBySlug(slug);
  const { user } = useAuth();

  const [cart, setCart] = useState<Cart | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(10 * 60); // 10 minutos em segundos
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
  const [custZip, setCustZip] = useState("");
  const [custAddress, setCustAddress] = useState("");
  const [custCity, setCustCity] = useState("");
  const [custState, setCustState] = useState("");
  const [custNumber, setCustNumber] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");
  const [holders, setHolders] = useState<TicketHolder[]>([]);
  const [holderPhotos, setHolderPhotos] = useState<(string | null)[]>([]);

  // Payment step
  const [step, setStep] = useState<"form" | "payment">("form");
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

  const fetchAddress = async (rawCep: string) => {
    const digits = rawCep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    setCepError("");
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json() as { erro?: boolean; logradouro?: string; localidade?: string; uf?: string };
      if (data.erro) {
        setCepError("CEP não encontrado.");
      } else {
        setCustAddress(data.logradouro ?? "");
        setCustCity(data.localidade ?? "");
        setCustState(data.uf ?? "");
        setCepError("");
      }
    } catch {
      setCepError("Erro ao buscar CEP.");
    } finally {
      setCepLoading(false);
    }
  };

  // Validações
  const nameError = custName && !validateName(custName) ? "Digite o nome completo (apenas letras)" : "";
  const emailError = custEmail && !validateEmail(custEmail) ? "E-mail inválido" : "";
  const phoneError = custPhone && !validatePhone(custPhone) ? "Telefone inválido. Use (99) 99999-9999" : "";
  const cpfError = custCpf && !validateCpf(custCpf) ? "CPF inválido" : "";
  const addressInvalid =
    !custZip.replace(/\D/g, "").length ||
    !custAddress.trim() ||
    !custNumber.trim() ||
    !custCity.trim() ||
    !custState.trim();
  const holdersInvalid = holders.some(
    (h) => !h.name.trim() || h.cpf.replace(/\D/g, "").length !== 11,
  );
  const formInvalid =
    !!(nameError || emailError || phoneError || cpfError) || !holderPhotos[0] || addressInvalid || holdersInvalid;

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
    } catch {
      void navigate({ to: `/jogos/${slug}` });
    }
  }, [slug, navigate]);

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

  const setHolder = (idx: number, field: keyof TicketHolder, value: string) => {
    setHolders((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: field === "cpf" ? maskCpf(value) : value };
      return next;
    });
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
      if (!cardNumber.replace(/\D/g, "") || !cardName.trim() || !cardExpiry || !cardCvv) {
        toast.error("Preencha todos os dados do cartão");
        return;
      }
      if (!validateLuhn(cardNumber)) {
        setPayError("Número de cartão inválido. Verifique os dados e tente novamente.");
        return;
      }
      const [expM, expY] = cardExpiry.split("/");
      const expMonth = parseInt(expM, 10);
      const expYear = 2000 + parseInt(expY ?? "0", 10);
      const now = new Date();
      const thisYear = now.getFullYear();
      const thisMonth = now.getMonth() + 1;
      if (!expMonth || expMonth < 1 || expMonth > 12 || expYear < thisYear || (expYear === thisYear && expMonth < thisMonth)) {
        setPayError("Cartão vencido ou data de validade inválida.");
        return;
      }
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
      };
      if (payMethod === "card") {
        body.cardData = {
          number: cardNumber,
          name: cardName,
          expiry: cardExpiry,
          cvv: cardCvv,
          brand: detectBrand(cardNumber) || undefined,
        };
      }
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
      // Cache order data so checkout page shows QR immediately (avoids RLS SELECT issue)
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
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep("form")}
                className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition"
              >
                ← Voltar
              </button>
              <div>
                <h1 className="text-xl font-extrabold text-foreground">Pagamento</h1>
                <p className="text-xs text-muted-foreground">{match.homeTeam} x {match.awayTeam} · {match.venue}</p>
              </div>
            </div>
            <div className={`flex flex-col items-center rounded-xl border px-4 py-2 text-center ${
              timerUrgent ? "border-red-500 bg-red-500/10 text-red-500" : "border-amber-500 bg-amber-500/10 text-amber-500"
            }`}>
              <span className="text-xs font-semibold uppercase tracking-wide">{timerUrgent ? "⚠ Expira em" : "Reservado por"}</span>
              <span className="font-mono text-2xl font-extrabold">{timerMinutes}:{timerSeconds}</span>
            </div>
          </div>

          {/* Total */}
          <div className="mb-6 flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
            <span className="text-sm font-medium text-muted-foreground">Total a pagar</span>
            <span className="text-xl font-extrabold text-primary">{formatBRL(total)}</span>
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="mb-3 font-bold text-foreground">Forma de pagamento</h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPayMethod("pix")}
                  className={`flex flex-col items-center gap-2 rounded-2xl border-2 px-4 py-5 transition ${
                    payMethod === "pix"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-card text-foreground hover:border-primary/40"
                  }`}
                >
                  <span className="text-3xl">⚡</span>
                  <span className="font-bold">PIX</span>
                  <span className="text-xs text-muted-foreground">Pagamento imediato</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPayMethod("card")}
                  className={`flex flex-col items-center gap-2 rounded-2xl border-2 px-4 py-5 transition ${
                    payMethod === "card"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-card text-foreground hover:border-primary/40"
                  }`}
                >
                  <span className="text-3xl">💳</span>
                  <span className="font-bold">Cartão de crédito</span>
                  <span className="text-xs text-muted-foreground">Visa, Master, Elo</span>
                </button>
              </div>
            </div>

            {payMethod === "pix" && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
                <p className="font-semibold">✓ PIX — pagamento instantâneo</p>
                <p className="mt-1 text-xs">Você receberá um QR Code. O código expira em 24 horas após a confirmação.</p>
              </div>
            )}

            {payMethod === "card" && (
              <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
                <h3 className="font-semibold text-foreground">Dados do cartão</h3>
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">Número do cartão</label>
                  <div className="relative">
                    <input
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono text-foreground outline-none focus:ring-2 focus:ring-primary"
                      type="text"
                      inputMode="numeric"
                      placeholder="0000 0000 0000 0000"
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
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">Nome no cartão</label>
                  <input
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
                    type="text"
                    placeholder="Como impresso no cartão"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value.toUpperCase())}
                    autoComplete="cc-name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">Validade</label>
                    <input
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
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
                    <label className="mb-1 block text-sm font-medium text-foreground">CVV</label>
                    <input
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
                      type="text"
                      inputMode="numeric"
                      placeholder="123"
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      maxLength={4}
                      autoComplete="cc-csc"
                    />
                  </div>
                </div>
              </section>
            )}

            {payError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
                {payError}
              </div>
            )}

            <button
              type="button"
              onClick={onPay}
              disabled={!payMethod || submitting}
              className="w-full rounded-full bg-primary py-4 text-base font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
            >
              {submitting ? "Processando..." : "Confirmar pagamento"}
            </button>
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

          {/* Endereço */}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-4 font-bold text-foreground">Endereço</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">CEP <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input
                    className={`w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary ${cepError ? "border-red-500" : "border-input"}`}
                    type="text"
                    value={custZip}
                    onChange={(e) => {
                      const masked = maskCep(e.target.value);
                      setCustZip(masked);
                      setCepError("");
                      if (masked.replace(/\D/g, "").length === 8) fetchAddress(masked);
                    }}
                    placeholder="00000-000"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    maxLength={9}
                  />
                  {cepLoading && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground animate-pulse">
                      buscando…
                    </span>
                  )}
                </div>
                {cepError && <div className="mt-1 text-xs text-red-500">{cepError}</div>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Logradouro <span className="text-red-500">*</span></label>
                <input
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
                  type="text"
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  placeholder="Rua, Avenida…"
                  autoComplete="street-address"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Número <span className="text-red-500">*</span></label>
                <input
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
                  type="text"
                  value={custNumber}
                  onChange={(e) => setCustNumber(e.target.value)}
                  placeholder="123"
                  autoComplete="address-line2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Cidade <span className="text-red-500">*</span></label>
                <input
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
                  type="text"
                  value={custCity}
                  onChange={(e) => setCustCity(e.target.value)}
                  placeholder="São Paulo"
                  autoComplete="address-level2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Estado (UF) <span className="text-red-500">*</span></label>
                <input
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
                  type="text"
                  value={custState}
                  onChange={(e) => setCustState(e.target.value.toUpperCase().slice(0, 2))}
                  placeholder="SP"
                  maxLength={2}
                  autoComplete="address-level1"
                />
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

              {/* Foto biométrica */}
              <div className={`mb-4 rounded-xl border-2 border-dashed p-4 ${
                idx === 0 && !holderPhotos[0]
                  ? "border-amber-400 bg-amber-50 dark:bg-amber-950/20"
                  : holderPhotos[idx]
                  ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                  : "border-border bg-muted/30"
              }`}>
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
                      📸 Foto do rosto
                      {idx === 0 && <span className="ml-1 text-xs font-bold text-amber-600 dark:text-amber-400">• Obrigatório</span>}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Exigida para acesso biométrico ao Maracanã. Use uma foto recente, com rosto visível e fundo neutro.
                    </p>
                    <label className="mt-2 inline-block">
                      <input
                        type="file"
                        accept="image/*"
                        capture="user"
                        className="sr-only"
                        onChange={(e) => handlePhotoChange(idx, e)}
                      />
                      <span className={`inline-flex cursor-pointer items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition ${
                        holderPhotos[idx]
                          ? "bg-green-600 text-white hover:bg-green-700"
                          : "bg-primary text-primary-foreground hover:bg-primary/90"
                      }`}>
                        {holderPhotos[idx] ? "✓ Trocar foto" : "Selecionar foto"}
                      </span>
                    </label>
                  </div>
                </div>
                {idx === 0 && !holderPhotos[0] && (
                  <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                    ⚠ A foto do Portador 1 (titular) é obrigatória para prosseguir.
                  </p>
                )}
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

          {ticketList.length > 0 && !holderPhotos[0] && (
            <p className="text-center text-sm font-medium text-amber-600 dark:text-amber-400">
              ⚠ Adicione a foto do rosto do Portador 1 para continuar
            </p>
          )}

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
