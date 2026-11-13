import type { ReactNode } from "react";

export function Aviso({
  tipo = "info",
  children,
}: {
  tipo?: "info" | "erro" | "sucesso" | "alerta";
  children: ReactNode;
}) {
  const estilos = {
    info: "bg-marca-clara text-marca-escura border-marca/20",
    erro: "bg-perigo-claro text-perigo border-perigo/20",
    sucesso: "bg-sucesso-claro text-sucesso border-sucesso/20",
    alerta: "bg-alerta-claro text-[#8a5a00] border-alerta/30",
  }[tipo];
  return (
    <div role={tipo === "erro" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${estilos}`}>
      {children}
    </div>
  );
}

export function Campo({
  rotulo,
  dica,
  children,
}: {
  rotulo: string;
  dica?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-texto">{rotulo}</span>
      {children}
      {dica && <span className="block text-xs text-suave">{dica}</span>}
    </label>
  );
}

export function Cartao({ className = "", children, id }: { className?: string; children: ReactNode; id?: string }) {
  return (
    <div id={id} className={`rounded-2xl border border-borda bg-cartao p-5 shadow-[0_1px_2px_rgba(11,18,32,0.04)] ${className}`}>
      {children}
    </div>
  );
}
