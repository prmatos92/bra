import { Link } from "@tanstack/react-router";
import logoFutebolCard from "@/assets/logo-futebolcard.svg";

export function Footer() {
  return (
    <footer className="mt-0">
      <div className="h-2 bg-cbf-yellow" />
      <div className="h-2 bg-cbf-green" />

      <div className="bg-primary text-primary-foreground">
        <div className="flex flex-col items-center text-center px-6 py-14 gap-5">
          <img src={logoFutebolCard} alt="FutebolCard" style={{ height: "40px", width: "auto" }} />
          <p className="max-w-xs text-sm" style={{ color: "#f5f5f5", letterSpacing: "0.02em" }}>
            A plataforma oficial de venda de ingressos para o futebol brasileiro
          </p>
          <div className="flex items-center gap-3">
            <SocialIcon href="https://www.instagram.com/" label="Instagram">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 18, height: 18 }}>
                <rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="1.8"/>
                <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.8"/>
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor"/>
              </svg>
            </SocialIcon>
            <SocialIcon href="https://www.linkedin.com/" label="LinkedIn">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 18, height: 18 }}>
                <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
                <rect x="2" y="9" width="4" height="12" stroke="currentColor" strokeWidth="1.8"/>
                <circle cx="4" cy="4" r="2" stroke="currentColor" strokeWidth="1.8"/>
              </svg>
            </SocialIcon>
            <SocialIcon href="https://x.com/" label="X / Twitter">
              <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" style={{ width: 18, height: 18 }}>
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L2.25 2.25h6.802l4.26 5.632 4.932-5.632Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z"/>
              </svg>
            </SocialIcon>
          </div>
        </div>

        <div className="mx-auto h-px max-w-5xl" style={{ background: "linear-gradient(to right, transparent, #ff6b8a 20%, #ff6b8a 80%, transparent)" }} />

        <div className="mx-auto grid max-w-5xl gap-8 px-6 py-10 text-center md:grid-cols-3 md:text-left">
          <FooterCol title="Institucional">
            <FootLink to="/termos">Termos de uso</FootLink>
          </FooterCol>
          <FooterCol title="Segurança">
            <FootLink to="/ajuda">Perguntas frequentes</FootLink>
            <FootLink to="/ajuda">Canal de Denúncias</FootLink>
            <FootLink to="/ajuda">Evite sites falsos e golpes</FootLink>
          </FooterCol>
          <FooterCol title="Acesso">
            <FootLink to="/login">Entre ou cadastre-se</FootLink>
          </FooterCol>
        </div>

        <div style={{ background: "rgba(0,0,0,0.15)" }}>
          <div className="mx-auto max-w-5xl px-4 py-5 text-center text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>
            © {new Date().getFullYear()}{" "}
            <strong className="font-extrabold text-white">FutebolCard</strong>. Todos os direitos reservados.
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 md:items-start">
      <h4 className="text-xs font-bold uppercase" style={{ letterSpacing: "0.15em", color: "#ffffff" }}>
        {title}
      </h4>
      <ul className="flex flex-col gap-2" style={{ fontSize: "0.82rem", color: "#ffffff" }}>{children}</ul>
    </div>
  );
}

function FootLink({
  to,
  children,
}: {
  to: "/ | /jogos | /login | /cadastro | /ajuda | /termos | /privacidade | /meus-ingressos";
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link to={to} className="transition hover:text-white hover:underline">
        {children}
      </Link>
    </li>
  );
}

function SocialIcon({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="flex items-center justify-center rounded-full transition hover:bg-white hover:text-primary"
      style={{ width: 40, height: 40, border: "1px solid rgba(255,255,255,0.5)", color: "rgba(255,255,255,0.7)" }}
    >
      {children}
    </a>
  );
}
