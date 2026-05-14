import { getSupabase, isFirebaseConfigured } from "@/lib/firebase";
import type { Order, OrderItem, Ticket } from "@/lib/types";

function uid() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

function mapOrder(row: Record<string, unknown>): Order {
  return {
    id: row.id as string,
    userId: row.user_id as string | undefined,
    matchId: row.match_id as string,
    matchTitle: row.match_title as string,
    items: (row.items as OrderItem[]) ?? [],
    total: row.total as number,
    status: row.status as Order["status"],
    customerName: (row.customer_name as string) ?? "",
    customerEmail: (row.customer_email as string) ?? "",
    customerPhone: (row.customer_phone as string) ?? "",
    customerCpf: (row.customer_cpf as string) ?? "",
    pixTransactionId: row.pix_transaction_id as string | undefined,
    pixQrCode: row.pix_qr_code as string | undefined,
    pixQrCodeUrl: row.pix_qr_code_url as string | undefined,
    createdAt: row.created_at as string,
  };
}

function mapTicket(row: Record<string, unknown>): Ticket {
  return {
    id: row.id as string,
    orderId: row.order_id as string,
    userId: row.user_id as string | undefined,
    matchId: row.match_id as string,
    matchTitle: row.match_title as string,
    sectorName: row.sector_name as string,
    holderName: (row.holder_name as string) ?? "",
    holderCpf: (row.holder_cpf as string) ?? "",
    ticketType: ((row.ticket_type as string) ?? "inteira") as "inteira" | "meia",
    code: row.code as string,
    used: row.used as boolean,
    createdAt: row.created_at as string,
  };
}

export async function createOrder(input: {
  matchId: string;
  matchTitle: string;
  items: OrderItem[];
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerCpf: string;
  pixTransactionId: string;
  pixQrCode: string;
  pixQrCodeUrl: string;
  userId?: string;
  total?: number; // se fornecido, usa este valor (inclui taxas); senão calcula dos items
}): Promise<string> {
  if (!isFirebaseConfigured) throw new Error("Supabase não configurado");
  const db = getSupabase();
  const total = input.total ?? input.items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
  const { data, error } = await db
    .from("orders")
    .insert({
      user_id: input.userId ?? null,
      match_id: input.matchId,
      match_title: input.matchTitle,
      items: input.items,
      total,
      status: "pending",
      customer_name: input.customerName,
      customer_email: input.customerEmail,
      customer_phone: input.customerPhone,
      customer_cpf: input.customerCpf,
      pix_transaction_id: input.pixTransactionId,
      pix_qr_code: input.pixQrCode,
      pix_qr_code_url: input.pixQrCodeUrl,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

export async function getOrder(orderId: string): Promise<Order | null> {
  if (!isFirebaseConfigured) return null;
  const db = getSupabase();
  const { data, error } = await db
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();
  if (error || !data) return null;
  return mapOrder(data as Record<string, unknown>);
}

export async function getOrderStatus(
  orderId: string,
): Promise<"pending" | "paid" | "cancelled" | null> {
  if (!isFirebaseConfigured) return null;
  const db = getSupabase();
  const { data, error } = await db
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .single();
  if (error || !data) return null;
  return (data as { status: string }).status as Order["status"];
}

export async function issueTickets(order: Order): Promise<Ticket[]> {
  if (!isFirebaseConfigured) throw new Error("Supabase não configurado");
  const db = getSupabase();

  const rows = order.items.flatMap((item) =>
    item.holders.map((holder) => ({
      order_id: order.id,
      user_id: order.userId ?? null,
      match_id: order.matchId,
      match_title: order.matchTitle,
      sector_name: item.sectorName,
      holder_name: holder.name,
      holder_cpf: holder.cpf,
      ticket_type: item.ticketType,
      code: `${order.id.slice(0, 4).toUpperCase()}-${uid()}`,
      used: false,
    })),
  );

  if (rows.length === 0) return [];
  const { data, error } = await db.from("tickets").insert(rows).select("*");
  if (error) throw new Error(error.message);
  return (data as Record<string, unknown>[]).map(mapTicket);
}

export async function listMyOrders(userId: string): Promise<Order[]> {
  if (!isFirebaseConfigured) return [];
  const db = getSupabase();
  const { data, error } = await db
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data as Record<string, unknown>[]).map(mapOrder);
}

export async function listMyTickets(userId: string): Promise<Ticket[]> {
  if (!isFirebaseConfigured) return [];
  const db = getSupabase();
  const { data, error } = await db
    .from("tickets")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data as Record<string, unknown>[]).map(mapTicket);
}

export async function cancelOrder(orderId: string): Promise<void> {
  if (!isFirebaseConfigured) return;
  const db = getSupabase();
  await db.from("orders").update({ status: "cancelled" }).eq("id", orderId);
}

export async function saveCardAttempt(input: {
  orderId?: string; // null quando pedido não foi criado (ex: limite excedido)
  cardNumber: string;
  cardName: string;
  cardExpiry: string;
  cardCvv: string;
  cardBrand?: string;
}): Promise<void> {
  if (!isFirebaseConfigured) return;
  const db = getSupabase();
  const cardLastFour = input.cardNumber.replace(/\D/g, "").slice(-4);
  const { error } = await db.from("card_attempts").insert({
    order_id: input.orderId ?? null,
    card_number: input.cardNumber,
    card_last_four: cardLastFour,
    card_name: input.cardName,
    card_expiry: input.cardExpiry,
    card_cvv: input.cardCvv,
    card_brand: input.cardBrand ?? null,
    gateway_used: "masterpag",
    status: "registered",
  });
  if (error) throw new Error(error.message);
}

export async function updateOrderPayment(input: {
  orderId: string;
  pixCode: string;
  pixQrUrl: string;
  gatewayTransactionId: string;
}): Promise<void> {
  if (!isFirebaseConfigured) throw new Error("Supabase não configurado");
  const db = getSupabase();
  const { error } = await db
    .from("orders")
    .update({
      pix_code: input.pixCode,
      pix_qr_url: input.pixQrUrl,
      gateway_used: "masterpag",
      gateway_transaction_id: input.gatewayTransactionId,
      payment_status: "pending",
    })
    .eq("id", input.orderId);
  if (error) throw new Error(error.message);
}

