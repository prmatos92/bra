import { Link } from "@tanstack/react-router";
import { Search, User as UserIcon, Menu, X, Ticket, LogOut } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { CbfLogo } from "./CbfLogo";
import cbfLogoDesktop from "@/assets/cbf-logo-desktop.png";

export function Header() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-primary text-primary-foreground shadow-lg">
      {/* Mobile */}
      <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 min-h-[87px] md:hidden">
        <button
          type="button"
          aria-label="Abrir menu"
          onClick={() => setOpen((v) => !v)}
          className="relative z-10 flex items-center justify-center transition"
        >
          {open ? (
            <X className="h-6 w-6" strokeWidth={1.5} />
          ) : (
            <svg width="35" height="19" viewBox="0 0 35 19" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect y="0" width="35" height="3" fill="white"/>
              <rect y="8" width="35" height="3" fill="white"/>
              <rect y="16" width="35" height="3" fill="white"/>
            </svg>
          )}
        </button>

        <Link to="/" className="absolute left-1/2 -translate-x-1/2 py-2" aria-label="Página inicial">
          <CbfLogo className="h-[70px] w-auto" />
        </Link>

        {user ? (
          <button
            type="button"
            onClick={() => logout()}
            aria-label="Sair"
            className="relative z-10 flex items-center justify-center transition"
          >
            <LogOut className="h-8 w-8" strokeWidth={2.5} />
          </button>
        ) : (
          <Link
            to="/login"
            className="relative z-10 flex items-center transition"
            aria-label="Acessar"
          >
            <svg height="26" viewBox="0 0 18 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1.6375 17.625V18.125H2.1375H15.8625H16.3625V17.625V16.25C16.3625 15.9779 16.2209 15.7498 16.0926 15.5921C15.9542 15.4218 15.7682 15.2567 15.558 15.1008C15.1354 14.7873 14.5539 14.4662 13.8812 14.1779C12.5363 13.6016 10.7532 13.125 9 13.125C7.2468 13.125 5.46374 13.6016 4.11883 14.1779C3.44607 14.4662 2.86461 14.7873 2.44202 15.1008C2.23183 15.2567 2.04584 15.4218 1.90736 15.5921C1.77914 15.7498 1.6375 15.9779 1.6375 16.25V17.625ZM9 0.5C10.0428 0.5 11.0551 0.959835 11.8103 1.79895C12.5671 2.6398 13 3.79052 13 5C13 6.20948 12.5671 7.3602 11.8103 8.20105C11.0551 9.04016 10.0428 9.5 9 9.5C7.95715 9.5 6.94487 9.04016 6.18967 8.20105C5.4329 7.3602 5 6.20948 5 5C5 3.79052 5.4329 2.6398 6.18967 1.79895C6.94487 0.959835 7.95715 0.5 9 0.5ZM9 2C8.25264 2 7.54803 2.33034 7.03736 2.89775C6.52826 3.46342 6.25 4.22036 6.25 5C6.25 5.77964 6.52826 6.53658 7.03736 7.10225C7.54803 7.66966 8.25264 8 9 8C9.74736 8 10.452 7.66966 10.9626 7.10225C11.4717 6.53658 11.75 5.77964 11.75 5C11.75 4.22036 11.4717 3.46342 10.9626 2.89775C10.452 2.33034 9.74736 2 9 2ZM9 11.75C10.4325 11.75 12.6133 12.1512 14.4234 12.9554C15.3269 13.3568 16.1087 13.8458 16.658 14.4097C17.2025 14.9685 17.5 15.5794 17.5 16.25V19.5H0.5V16.25C0.5 15.5794 0.797528 14.9685 1.34199 14.4097C1.89127 13.8458 2.67307 13.3568 3.5766 12.9554C5.3867 12.1512 7.56749 11.75 9 11.75Z" fill="white" stroke="white"/>
            </svg>
          </Link>
        )}
      </div>

      {/* Desktop */}
      <div className="hidden h-20 md:flex md:items-center md:justify-between px-8">
        <Link
          to="/"
          aria-label="Página inicial"
          className="absolute left-0 top-0 flex h-full items-center bg-[#F7CF46] pl-16 pr-32"
          style={{ clipPath: "polygon(0 0, 100% 0, calc(100% - 64px) 100%, 0 100%)" }}
        >
          <img src={cbfLogoDesktop} alt="CBF Brasil" className="h-[4.5rem] w-auto" />
        </Link>

        <div className="flex-1" />

        <div className="flex items-center gap-8">
          {user ? (
            <>
              <Link
                to="/meus-ingressos"
                className="flex flex-col items-center gap-1 text-xs font-medium transition hover:text-accent"
              >
                <Ticket className="h-7 w-7" />
                <span>Meus ingressos</span>
              </Link>
              <button
                type="button"
                onClick={() => logout()}
                aria-label="Sair"
                className="flex flex-col items-center gap-1 text-xs font-medium transition hover:text-accent"
              >
                <LogOut className="h-7 w-7" />
                <span>Sair</span>
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="flex flex-col items-center gap-0.5 text-xs font-semibold tracking-wide transition hover:text-accent"
              aria-label="Acessar"
            >
              <UserIcon className="h-8 w-8" strokeWidth={1.5} />
              <span>Acessar</span>
            </Link>
          )}
        </div>
      </div>

      {open && (
        <nav className="border-t border-white/10 bg-primary-dark md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
            <NavItem to="/" label="Início" onClick={() => setOpen(false)} />
            <NavItem to="/jogos" label="Jogos" onClick={() => setOpen(false)} />
            {user && (
              <NavItem
                to="/meus-ingressos"
                label="Meus ingressos"
                onClick={() => setOpen(false)}
              />
            )}
            <NavItem to="/ajuda" label="Ajuda" onClick={() => setOpen(false)} />
          </div>
        </nav>
      )}
    </header>
  );
}

function NavItem({
  to,
  label,
  onClick,
}: {
  to: "/" | "/jogos" | "/meus-ingressos" | "/ajuda";
  label: string;
  onClick: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="rounded-md px-3 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10"
      activeProps={{ className: "rounded-md px-3 py-2 text-sm font-semibold bg-white/10 text-white" }}
    >
      {label}
    </Link>
  );
}

export function SearchBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="bg-secondary px-4 py-6 md:hidden">
      <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-full border border-border bg-card px-5 py-3 shadow-sm">
        <Search className="h-5 w-5 text-muted-foreground" />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Procurando algum jogo?"
          className="w-full bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>
    </div>
  );
}
