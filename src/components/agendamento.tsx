import Link from "next/link";
import { PERIODOS, SITUACOES_AGENDAMENTO, formatarDiaSemana, formatarQuando, partesBrasilia, type Agendamento } from "@/lib/agenda";
import type { AgendamentoComVeiculo } from "@/lib/dados";
import { nomeVeiculo } from "@/lib/garagem";

export function SeloAgendamento({ a, empresa = false }: { a: Pick<Agendamento, "situacao">; empresa?: boolean }) {
  const s = SITUACOES_AGENDAMENTO[a.situacao];
  return <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.classe}`}>{empresa ? s.rotuloEmpresa : s.rotulo}</span>;
}

export function descreverPreferencias(a: Pick<Agendamento, "preferencias">) {
  return a.preferencias.map((p) => `${formatarDiaSemana(p.data)} · ${PERIODOS[p.periodo]?.rotulo ?? p.periodo}`);
}

export function ItemAgendamento({ a, empresa = false }: { a: AgendamentoComVeiculo; empresa?: boolean }) {
  const dia = a.inicio ? partesBrasilia(new Date(a.inicio)) : null;
  return (
    <li>
      <Link href={`/agendamentos/${a.id}`} className="flex gap-3 px-5 py-4 transition hover:bg-fundo">
        <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-fundo leading-none">
          {dia ? (
            <>
              <span className="font-titulo text-lg font-bold">{dia.dia.slice(8)}</span>
              <span className="text-[10px] uppercase text-suave">
                {new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" }).format(new Date(`${dia.dia}T12:00:00Z`)).replace(".", "")}
              </span>
            </>
          ) : (
            <span className="text-lg" aria-hidden="true">📅</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium">{a.tipo === "lavagem" ? "🧽 " : ""}{a.servico}</p>
            <SeloAgendamento a={a} empresa={empresa} />
          </div>
          <p className="truncate text-sm text-suave">
            {empresa && a.veiculo?.dono?.nome ? `${a.veiculo.dono.nome} · ` : ""}
            {a.veiculo ? `${nomeVeiculo(a.veiculo)} (${a.veiculo.placa})` : ""}
          </p>
          <p className="text-xs text-suave">
            {a.inicio ? formatarQuando(a.inicio, a.fim) : `Sugestões: ${descreverPreferencias(a).join(" · ") || "—"}`}
          </p>
        </div>
      </Link>
    </li>
  );
}
