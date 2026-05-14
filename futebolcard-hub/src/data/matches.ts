import type { Match } from "@/lib/types";
import logoBrasil from "@/assets/logo-brasil.png";
import logoPanama from "@/assets/logo-panama.png";

const CBF_BADGE = logoBrasil;
const PANAMA_BADGE = logoPanama;

export const MATCHES: Match[] = [
  {
    id: "brasil-x-panama",
    slug: "brasil-x-panama",
    title: "Brasil x Panamá",
    competition: "Amistoso Internacional",
    homeTeam: "Brasil",
    awayTeam: "Panamá",
    homeBadge: CBF_BADGE,
    awayBadge: PANAMA_BADGE,
    venue: "Maracanã",
    city: "Rio de Janeiro - RJ",
    datetime: "2026-05-31T18:30:00-03:00",
    status: "a_venda",
    sectors: [
      { id: "norte", name: "Norte", price: 100, capacity: 12000, sold: 0 },
      { id: "sul", name: "Sul", price: 150, capacity: 12000, sold: 0 },
      { id: "leste-superior", name: "Leste Superior", price: 200, capacity: 10000, sold: 0 },
      { id: "leste-inferior", name: "Leste Inferior", price: 300, capacity: 8000, sold: 0 },
      { id: "oeste-inferior", name: "Oeste Inferior", price: 400, capacity: 6000, sold: 0 },
    ],
  },
];

export function findMatchBySlug(slug: string): Match | undefined {
  return MATCHES.find((m) => m.slug === slug);
}
