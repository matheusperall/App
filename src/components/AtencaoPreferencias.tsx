/** Ponto de atenção: preferências do cliente para o veículo (na OS e na página do veículo). */
export function AtencaoPreferencias({
  preferencias,
  className = "",
  titulo = "Ponto de atenção · preferências do cliente",
  acao,
}: {
  preferencias?: string[] | null;
  className?: string;
  titulo?: string;
  acao?: React.ReactNode;
}) {
  if (!preferencias?.length) return null;
  return (
    <div className={`rounded-xl border border-[#e3a008]/50 bg-alerta-claro p-3 text-sm ${className}`} role="note">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-[#8a5a00]">⚠️ {titulo}</p>
        {acao}
      </div>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {preferencias.map((p) => (
          <li key={p} className="rounded-full bg-white/70 px-2.5 py-0.5 font-medium text-[#8a5a00]">{p}</li>
        ))}
      </ul>
    </div>
  );
}
