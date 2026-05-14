import { createFileRoute, Outlet, useChildMatches } from "@tanstack/react-router";
import { useState } from "react";
import { Header, SearchBar } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MatchCard } from "@/components/MatchCard";
import { MATCHES } from "@/data/matches";

export const Route = createFileRoute("/jogos")({
  head: () => ({
    meta: [
      { title: "FutebolCard | Próximos jogos" },
      {
        name: "description",
        content:
          "Veja a agenda dos próximos jogos da Seleção Brasileira e compre seus ingressos.",
      },
    ],
  }),
  component: JogosLayout,
});

function JogosLayout() {
  const childMatches = useChildMatches();
  if (childMatches.length > 0) return <Outlet />;
  return <ListPage />;
}

function ListPage() {
  const [q, setQ] = useState("");
  const list = MATCHES.filter((m) => {
    const s = q.toLowerCase();
    return (
      !s ||
      m.title.toLowerCase().includes(s) ||
      m.awayTeam.toLowerCase().includes(s) ||
      m.venue.toLowerCase().includes(s) ||
      m.city.toLowerCase().includes(s)
    );
  });

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <SearchBar value={q} onChange={setQ} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <h1 className="mb-8 text-3xl font-extrabold text-foreground">Próximos jogos</h1>
        <div className="grid place-items-center gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {list.length === 0 ? (
            <p className="col-span-full py-16 text-center text-muted-foreground">
              Nenhum jogo encontrado.
            </p>
          ) : (
            list.map((m) => <MatchCard key={m.id} match={m} />)
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
