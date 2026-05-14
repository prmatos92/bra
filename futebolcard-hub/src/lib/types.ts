export type MatchStatus = "em_breve" | "a_venda" | "esgotado";

export type Sector = {
  id: string;
  name: string;
  price: number;
  capacity: number;
  sold: number;
};

export type Match = {
  id: string;
  slug: string;
  title: string;
  homeTeam: string;
  awayTeam: string;
  homeBadge: string;
  awayBadge: string;
  venue: string;
  city: string;
  datetime: string; // ISO
  status: MatchStatus;
  bannerUrl?: string;
  competition?: string;
  sectors: Sector[];
};

export type TicketHolder = {
  name: string;
  cpf: string;
  photo?: string; // base64 data URL da foto do rosto (biometria Maracanã)
};

export type OrderItem = {
  sectorId: string;
  sectorName: string;
  qty: number;
  unitPrice: number;
  ticketType: "inteira" | "meia";
  holders: TicketHolder[];
};

export type Order = {
  id: string;
  userId?: string;
  matchId: string;
  matchTitle: string;
  items: OrderItem[];
  total: number;
  status: "pending" | "paid" | "cancelled";
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerCpf: string;
  pixTransactionId?: string;
  pixQrCode?: string;
  pixQrCodeUrl?: string;
  createdAt: string;
};

export type Ticket = {
  id: string;
  orderId: string;
  userId?: string;
  matchId: string;
  matchTitle: string;
  sectorName: string;
  holderName: string;
  holderCpf: string;
  ticketType: "inteira" | "meia";
  code: string;
  used: boolean;
  createdAt: string;
};
