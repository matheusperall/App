// Regras da agenda da Sempre Zero (podem ser ajustadas aqui).

/** Funcionamento: segunda (1) a sexta (5), das 8h às 18h (horário de Brasília). */
export const FUNCIONAMENTO = { dias: [1, 2, 3, 4, 5], abre: 8, fecha: 18 };
/** Duração de uma lavagem, em minutos. */
export const LAVAGEM_MINUTOS = 60;
/** De quanto em quanto tempo começa um horário de lavagem. */
export const INTERVALO_MINUTOS = 60;
/** Antecedência mínima para agendar online (horas). */
export const ANTECEDENCIA_HORAS = 2;
/** Quantos dias à frente mostrar horários. */
export const DIAS_A_FRENTE = 14;

/** Brasília não tem horário de verão desde 2019: UTC−3 fixo. */
export const FUSO = "-03:00";

export const PERIODOS = {
  manha: { rotulo: "Manhã (8h–12h)" },
  tarde: { rotulo: "Tarde (13h–18h)" },
  qualquer: { rotulo: "Qualquer horário" },
} as const;
export type Periodo = keyof typeof PERIODOS;
export type Preferencia = { data: string; periodo: Periodo };

export const SITUACOES_AGENDAMENTO = {
  solicitado: { rotulo: "Aguardando confirmação", rotuloEmpresa: "A confirmar", classe: "bg-alerta-claro text-[#8a5a00]" },
  confirmado: { rotulo: "Confirmado", rotuloEmpresa: "Confirmado", classe: "bg-sucesso-claro text-sucesso" },
  concluido: { rotulo: "Concluído", rotuloEmpresa: "Concluído", classe: "bg-fundo text-suave" },
  recusado: { rotulo: "Não foi possível", rotuloEmpresa: "Recusado", classe: "bg-fundo text-suave" },
  cancelado: { rotulo: "Cancelado", rotuloEmpresa: "Cancelado", classe: "bg-fundo text-suave" },
} as const;
export type SituacaoAgendamento = keyof typeof SITUACOES_AGENDAMENTO;

export type Agendamento = {
  id: string;
  veiculo_id: string;
  tipo: "lavagem" | "servico";
  servico: string;
  categoria: string;
  situacao: SituacaoAgendamento;
  inicio: string | null;
  fim: string | null;
  preferencias: Preferencia[];
  observacoes: string | null;
  resposta: string | null;
  orcamento_id: string | null;
  apontamento_id: string | null;
  google_evento_id: string | null;
  criado_em: string;
};

export type Intervalo = { inicio: Date; fim: Date };

/** "2026-11-20" + "09:30" → Date (horário de Brasília) */
export const dataHora = (dia: string, hora: string) => new Date(`${dia}T${hora}:00${FUSO}`);

/** Dia (AAAA-MM-DD) e hora (HH:MM) de uma data, no horário de Brasília. */
export function partesBrasilia(d: Date) {
  const local = new Date(d.getTime() - 3 * 3600_000);
  const iso = local.toISOString();
  return { dia: iso.slice(0, 10), hora: iso.slice(11, 16), semana: local.getUTCDay() };
}

const doisDigitos = (n: number) => String(n).padStart(2, "0");

/**
 * Horários livres para lavagem: dias úteis, dentro do funcionamento,
 * sem conflito com os intervalos ocupados (Google Agenda + agendamentos do app).
 */
export function horariosLivres(ocupados: Intervalo[], agora = new Date()) {
  const minimo = agora.getTime() + ANTECEDENCIA_HORAS * 3600_000;
  const hojeBr = partesBrasilia(agora).dia;
  const dias: { dia: string; horarios: string[] }[] = [];

  for (let n = 0; n <= DIAS_A_FRENTE; n++) {
    const base = new Date(`${hojeBr}T12:00:00${FUSO}`);
    base.setUTCDate(base.getUTCDate() + n);
    const { dia, semana } = partesBrasilia(base);
    if (!FUNCIONAMENTO.dias.includes(semana)) continue;

    const horarios: string[] = [];
    for (let min = FUNCIONAMENTO.abre * 60; min + LAVAGEM_MINUTOS <= FUNCIONAMENTO.fecha * 60; min += INTERVALO_MINUTOS) {
      const hora = `${doisDigitos(Math.floor(min / 60))}:${doisDigitos(min % 60)}`;
      const inicio = dataHora(dia, hora);
      const fim = new Date(inicio.getTime() + LAVAGEM_MINUTOS * 60_000);
      if (inicio.getTime() < minimo) continue;
      if (ocupados.some((o) => inicio < o.fim && fim > o.inicio)) continue;
      horarios.push(hora);
    }
    if (horarios.length) dias.push({ dia, horarios });
  }
  return dias;
}

const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function formatarDiaSemana(dia: string) {
  return maiuscula(
    new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit" })
      .format(new Date(`${dia}T12:00:00Z`))
      .replace(".", ""),
  );
}

export function formatarQuando(inicio: string | null, fim?: string | null) {
  if (!inicio) return "—";
  const i = partesBrasilia(new Date(inicio));
  const diaTxt = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "long", day: "2-digit", month: "long" }).format(
    new Date(`${i.dia}T12:00:00Z`),
  );
  const f = fim ? partesBrasilia(new Date(fim)) : null;
  return `${maiuscula(diaTxt)}, ${i.hora}${f && f.dia === i.dia ? `–${f.hora}` : ""}`;
}
