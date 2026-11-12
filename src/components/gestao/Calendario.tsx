import Link from "next/link";
import { nomeMes } from "@/lib/gestao";

/** Calendário do mês: hoje em destaque e bolinha nos dias com agendamento. */
export function CalendarioMes({ mes, hoje, marcados }: { mes: string; hoje: string; marcados: Record<string, number> }) {
  const [a, m] = mes.split("-").map(Number);
  const primeiro = new Date(Date.UTC(a, m - 1, 1)).getUTCDay();
  const total = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const celulas: (number | null)[] = [...Array(primeiro).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">{nomeMes(mes)}</p>
      <div className="grid grid-cols-7 gap-1 text-center text-xs [&>*]:min-w-0">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => <span key={d} className="py-1 text-suave">{d}</span>)}
        {celulas.map((d, i) => {
          if (!d) return <span key={i} />;
          const dia = `${mes}-${String(d).padStart(2, "0")}`;
          const n = marcados[dia] ?? 0;
          const ehHoje = dia === hoje;
          return (
            <Link
              key={i}
              href="/agendamentos"
              title={n ? `${n} agendamento(s)` : undefined}
              className={`relative rounded-lg py-2 font-medium transition ${ehHoje ? "bg-tinta text-white" : dia < hoje ? "bg-fundo text-suave" : "bg-fundo hover:bg-marca-clara"}`}
            >
              {d}
              {n > 0 && <span className={`absolute right-1 bottom-1 h-1.5 w-1.5 rounded-full ${ehHoje ? "bg-white" : "bg-marca"}`} />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
