import { isValidElement, type ReactNode } from "react";

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
  obrigatorio,
  largo,
  children,
}: {
  rotulo: string;
  dica?: string;
  /** Mostra o * vermelho. Se não for informado, aparece sozinho quando o campo tem `required`. */
  obrigatorio?: boolean;
  /** Na ficha de cadastro, ocupa a linha inteira (opções em grade, fotos…) */
  largo?: boolean;
  children: ReactNode;
}) {
  const exigido = obrigatorio ?? (isValidElement(children) && Boolean((children.props as { required?: boolean }).required));
  return (
    <label className={`block space-y-1.5 ${largo ? "inteira" : ""}`}>
      <span className="text-sm font-medium text-texto">
        {rotulo}
        {exigido && <span className="ml-0.5 text-perigo" aria-hidden="true">*</span>}
      </span>
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
