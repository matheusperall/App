/**
 * Logo provisória: um marcador (velocímetro/hodômetro) com o ponteiro no zero.
 * A ideia: o carro do cliente "sempre zero", sempre com cara de novo.
 */
export function LogoSimbolo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#0b1220" />
      <path
        d="M16.44 47.56 A22 22 0 1 1 47.56 47.56"
        fill="none"
        stroke="#ffffff"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M16.44 47.56 A22 22 0 0 1 11.33 39.52"
        fill="none"
        stroke="#12b5b0"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <line x1="32" y1="32" x2="20.7" y2="43.3" stroke="#12b5b0" strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="32" cy="32" r="4.5" fill="#12b5b0" />
    </svg>
  );
}

export function Logo({
  className = "",
  claro = false,
  compacto = false,
}: {
  className?: string;
  /** true para usar sobre fundo escuro */
  claro?: boolean;
  /** Versão menor, para o topo do app */
  compacto?: boolean;
}) {
  return (
    <span className={`inline-flex items-center ${compacto ? "gap-2" : "gap-2.5"} ${className}`}>
      <LogoSimbolo className={compacto ? "h-7 w-7" : "h-9 w-9"} />
      <span
        className={`font-titulo ${compacto ? "text-base" : "text-lg"} font-bold tracking-tight ${claro ? "text-white" : "text-tinta"}`}
      >
        Sempre<span className="text-marca">Zero</span>
      </span>
    </span>
  );
}
