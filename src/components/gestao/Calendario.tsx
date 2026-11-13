import Link from "next/link";
import { nomeMes, somarMes } from "@/lib/gestao";

/**
 * Calendário do mês: hoje em destaque e, embaixo de cada dia, quantos agendamentos ele tem.
 * Tocar num dia abre a Agenda naquele dia.
 */
export function CalendarioMes({
  mes,
  hoje,
  marcados,
  selecionado,
  navegar = false,
}: {
  mes: string;
  hoje: string;
  marcados: Record<string, number>;
  selecionado?: string;
  /** Mostra as setas para trocar de mês (na própria Agenda). */
  navegar?: boolean;
}) {
  const [a, m] = mes.split("-").map(Number);
  const primeiro = new Date(Date.UTC(a, m - 1, 1)).getUTCDay();
  const total = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const celulas: (number | null)[] = [...Array(primeiro).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{nomeMes(mes)}</p>
        {navegar && (
          <div className="flex gap-1">
            <Link href={`/agendamentos?mes=${somarMes(mes, -1)}`} className="rounded-lg px-2 py-0.5 text-suave hover:bg-fundo hover:text-texto" aria-label="Mês anterior">‹</Link>
            <Link href={`/agendamentos?mes=${somarMes(mes, 1)}`} className="rounded-lg px-2 py-0.5 text-suave hover:bg-fundo hover:text-texto" aria-label="Próximo mês">›</Link>
          </div>
        )}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs [&>*]:min-w-0">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => <span key={d} className="py-1 text-suave">{d}</span>)}
        {celulas.map((d, i) => {
          if (!d) return <span key={i} />;
          const dia = `${mes}-${String(d).padStart(2, "0")}`;
          const n = marcados[dia] ?? 0;
          const ehHoje = dia === hoje;
          const ativo = dia === selecionado;
          return (
            <Link
              key={i}
              href={`/agendamentos?dia=${dia}#dia`}
              aria-current={ativo ? "date" : undefined}
              title={n ? `${n} ${n === 1 ? "agendamento" : "agendamentos"}` : undefined}
              className={`flex flex-col items-center rounded-lg pt-1.5 pb-1 font-medium transition ${
                ativo
                  ? "bg-marca text-white"
                  : ehHoje
                    ? "bg-tinta text-white"
                    : dia < hoje
                      ? "bg-fundo text-suave hover:bg-marca-clara"
                      : "bg-fundo hover:bg-marca-clara"
              }`}
            >
              <span>{d}</span>
              <span className={`h-3.5 text-[10px] leading-3.5 font-bold tabular-nums ${ativo || ehHoje ? "text-white" : "text-marca-escura"}`}>{n > 0 ? n : ""}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
