import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import type { Match } from "@/lib/types";
import { CbfLogo } from "./CbfLogo";
import { formatMatchDateShort, formatMatchTime } from "@/lib/format";

const STATUS_LABEL: Record<Match["status"], string> = {
  em_breve: "Em breve",
  a_venda: "À venda",
  esgotado: "Esgotado",
};

const STATUS_COLOR: Record<Match["status"], string> = {
  em_breve: "bg-warning text-warning-foreground",
  a_venda: "bg-success text-success-foreground",
  esgotado: "bg-muted text-muted-foreground",
};

export function MatchHeroBanner({ match }: { match: Match }) {
  return (
    <section
      className="relative overflow-hidden"
      style={{ background: "var(--gradient-hero)" }}
    >
      <div className="absolute inset-0 opacity-20 mix-blend-overlay">
        <div className="absolute -left-20 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-success blur-3xl" />
        <div className="absolute -right-20 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-accent blur-3xl" />
      </div>

      <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-12 sm:py-16 md:flex-row md:justify-between">
        <div className="text-center md:text-left">
          <p className="text-sm font-bold uppercase tracking-widest text-white/80">
            {match.competition ?? "Seleção Brasileira"}
          </p>
          <h1
            className="mt-2 font-extrabold leading-none text-white drop-shadow-lg"
            style={{ fontSize: "clamp(2.5rem, 8vw, 5.5rem)" }}
          >
            BATE NO
            <br />
            <span className="text-accent">PEITO</span>
          </h1>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-4 sm:gap-6">
            <TeamShield name={match.homeTeam} src={match.homeBadge} />
            <span className="text-3xl font-extrabold text-white sm:text-4xl">VS</span>
            <TeamShield name={match.awayTeam} src={match.awayBadge} />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-full bg-accent px-4 py-1.5 text-sm font-bold text-accent-foreground">
              {match.venue}
            </span>
            <span className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-foreground">
              {match.city.split(" - ")[0]}
            </span>
            <span className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-foreground">
              {formatMatchDateShort(match.datetime)}
            </span>
            <span className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-foreground">
              {formatMatchTime(match.datetime)}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function TeamShield({ name, src }: { name: string; src: string }) {
  return (
    <div className="flex flex-col items-center">
      <img
        src={src}
        alt={`Escudo ${name}`}
        className="h-20 w-20 object-contain drop-shadow-xl sm:h-28 sm:w-28"
        loading="lazy"
      />
      <span className="mt-1 text-xs font-bold uppercase tracking-wide text-white/90">
        {name}
      </span>
    </div>
  );
}

function BuyButton({ match }: { match: Match }) {
  const btnClass =
    "block w-full rounded-full px-6 py-3.5 text-center text-base font-bold italic shadow-md transition";
  const style = { fontFamily: '"Montserrat", sans-serif' };

  if (match.status === "esgotado") {
    return (
      <span className={`${btnClass} cursor-not-allowed bg-gray-300 text-gray-500`} style={style}>
        Esgotado
      </span>
    );
  }
  if (match.status === "em_breve") {
    return (
      <span className={`${btnClass} cursor-not-allowed bg-gray-300 text-gray-500`} style={style}>
        Em breve
      </span>
    );
  }
  return (
    <Link
      to="/jogos/$slug"
      params={{ slug: match.slug }}
      className={`${btnClass} bg-white text-primary hover:bg-gray-100`}
      style={style}
    >
      Comprar Ingresso
    </Link>
  );
}

export function MatchCard({ match }: { match: Match }) {
  return (
    <article className="relative w-full max-w-[340px] overflow-hidden rounded-3xl bg-card shadow-[var(--shadow-card)] transition-all duration-300 hover:scale-105 hover:shadow-[var(--shadow-card-hover)]">
      <div className="px-5 pt-8 pb-3 text-center">
        <h3 className="text-base font-bold tracking-tight text-black">
          {match.title}
        </h3>
      </div>

      <div className="flex items-center justify-around px-5 pb-3">
        <img
          src={match.homeBadge}
          alt={match.homeTeam}
          className="h-28 w-28 object-contain"
          loading="lazy"
        />
        <span className="text-3xl font-black text-foreground">X</span>
        <img
          src={match.awayBadge}
          alt={match.awayTeam}
          className="h-28 w-28 object-contain"
          loading="lazy"
        />
      </div>

      <div
        className="flex flex-col items-center gap-1 px-5 pb-8"
        style={{ fontFamily: '"Montserrat", sans-serif' }}
      >
        <div className="flex items-center justify-center gap-1.5 text-base font-normal text-muted-foreground">
          <MapPin className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
          {match.venue} - {match.city.split(" - ")[1] ?? match.city}
        </div>
        <p className="text-sm font-semibold text-foreground">
          {formatMatchDateShort(match.datetime)} · {formatMatchTime(match.datetime)}
        </p>
      </div>

      <div className="rounded-b-3xl bg-primary px-6 py-5">
        <BuyButton match={match} />
      </div>
    </article>
  );
}

export function ComingSoonHeading() {
  return (
    <div className="flex items-center justify-center gap-3 py-6 text-white">
      <CbfLogo className="h-10 w-auto" />
      <h2 className="text-2xl font-extrabold uppercase tracking-wider sm:text-3xl">
        Em breve
      </h2>
      <CbfLogo className="h-10 w-auto" />
    </div>
  );
}
