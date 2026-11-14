import { BANDEIRAS, type Bandeira } from "@/lib/gestao";

/** Símbolo simples da bandeira do cartão (Visa, Mastercard, Elo, Amex, Hipercard). */
export function BandeiraCartao({ bandeira, className = "h-6 w-9" }: { bandeira?: Bandeira | null; className?: string }) {
  if (!bandeira) return null;
  const rotulo = BANDEIRAS[bandeira];
  return (
    <svg viewBox="0 0 48 32" className={`shrink-0 ${className}`} role="img" aria-label={rotulo}>
      <title>{rotulo}</title>
      {bandeira === "visa" && (
        <>
          <rect width="48" height="32" rx="5" fill="#ffffff" stroke="#e2e7ee" />
          <text x="24" y="21" textAnchor="middle" fontSize="13" fontWeight="800" fontStyle="italic" fill="#1a1f71" fontFamily="Arial, sans-serif">VISA</text>
        </>
      )}
      {bandeira === "mastercard" && (
        <>
          <rect width="48" height="32" rx="5" fill="#ffffff" stroke="#e2e7ee" />
          <circle cx="19" cy="16" r="9" fill="#eb001b" />
          <circle cx="29" cy="16" r="9" fill="#f79e1b" fillOpacity="0.9" />
        </>
      )}
      {bandeira === "elo" && (
        <>
          <rect width="48" height="32" rx="5" fill="#111111" />
          <circle cx="12" cy="16" r="2.4" fill="#ffcb05" />
          <circle cx="12" cy="9.5" r="2.4" fill="#00a4e0" />
          <circle cx="12" cy="22.5" r="2.4" fill="#ef4123" />
          <text x="29" y="21" textAnchor="middle" fontSize="13" fontWeight="700" fill="#ffffff" fontFamily="Arial, sans-serif">elo</text>
        </>
      )}
      {bandeira === "amex" && (
        <>
          <rect width="48" height="32" rx="5" fill="#2e77bc" />
          <text x="24" y="20.5" textAnchor="middle" fontSize="10.5" fontWeight="800" fill="#ffffff" fontFamily="Arial, sans-serif">AMEX</text>
        </>
      )}
      {bandeira === "hipercard" && (
        <>
          <rect width="48" height="32" rx="5" fill="#b3131b" />
          <text x="24" y="19.5" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#ffffff" fontFamily="Arial, sans-serif">Hipercard</text>
        </>
      )}
    </svg>
  );
}
