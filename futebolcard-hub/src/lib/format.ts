// Formatação determinística (timezone fixo) para evitar mismatch entre SSR e cliente.
const TZ = "America/Sao_Paulo";

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatMatchDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatMatchDateShort(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(iso));
}

export function formatMatchTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}
