import logo from "@/assets/logo-brasil-new.png";

export function CbfLogo({ className }: { className?: string }) {
  return (
    <img
      src={logo}
      alt="CBF Brasil"
      className={className}
      loading="lazy"
    />
  );
}
