import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MatchCard } from "@/components/MatchCard";
import { MATCHES } from "@/data/matches";
import bannerBrasilPanama from "@/assets/banner-brasil-panama.jpg";
import bannerMobileNew from "@/assets/banner-mobile-new.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FutebolCard | O Maior Portal de Venda de Ingresso de Futebol do Brasil" },
      {
        name: "description",
        content:
          "Compre seus ingressos para os jogos da Seleção Brasileira: Brasil x Panamá no Maracanã.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const featured = MATCHES[0];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <div className="md:hidden">
        <img
          src={bannerMobileNew}
          alt="Brasil x Panamá - Maracanã"
          className="block w-full"
        />
      </div>

      <div className="hidden md:block">
        <img
          src={bannerBrasilPanama}
          alt="Brasil x Panamá - Maracanã, Rio de Janeiro - 31/05 18h30"
          className="block w-full"
        />
      </div>

      <div className="h-8 w-full bg-white md:h-12" />
      <div className="h-1 bg-white" />

      <section className="relative bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center px-4 pt-12 pb-24">
          <MatchCard match={featured} />
        </div>
      </section>

      <Footer />
    </div>
  );
}
