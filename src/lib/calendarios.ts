// Calendários oficiais de IPVA e licenciamento pelo final da placa.
// Hoje: São Paulo. Para outros estados, o cliente informa as datas manualmente.
//
// FONTES (atualize todo ano quando o governo divulgar o novo calendário):
// - IPVA SP 2026: Decreto nº 70.087/2025 — cota única com 3% de desconto em janeiro
//   (finais 1–0: dias 12, 13, 14, 15, 16, 19, 20, 21, 22, 23), sem desconto até fevereiro,
//   ou em até 5 parcelas de janeiro a maio, nas mesmas datas de cada mês.
// - Licenciamento SP: finais 1 e 2 até julho, 3 e 4 agosto, 5 e 6 setembro, 7 e 8 outubro,
//   9 novembro e 0 dezembro (até o último dia do mês).

import { somarDias } from "@/lib/garagem";

export const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB",
  "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
] as const;

export const temCalendario = (uf: string | null | undefined) => (uf ?? "SP").toUpperCase() === "SP";

/** Último dígito da placa (vale para o padrão antigo e o Mercosul). */
export function finalPlaca(placa: string) {
  const digitos = placa.replace(/\D/g, "");
  return digitos ? Number(digitos[digitos.length - 1]) : null;
}

const doisDigitos = (n: number) => String(n).padStart(2, "0");
const diaSemana = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();

/** Se cair no fim de semana, passa para segunda-feira (feriados não são considerados). */
function proximoDiaUtil(iso: string) {
  let d = iso;
  while (diaSemana(d) === 0 || diaSemana(d) === 6) d = somarDias(d, 1);
  return d;
}

function ultimoDiaDoMes(ano: number, mes: number) {
  return new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Licenciamento (SP)
// ---------------------------------------------------------------------------
const MES_LICENCIAMENTO_SP: Record<number, number> = { 1: 7, 2: 7, 3: 8, 4: 8, 5: 9, 6: 9, 7: 10, 8: 10, 9: 11, 0: 12 };
/** Anos em que o calendário acima foi confirmado pelo Detran-SP. */
const LICENCIAMENTO_SP_CONFIRMADO = [2026];

export type DataCalendario = { data: string; previsao: boolean };

export function licenciamentoSP(placa: string, ano: number): DataCalendario | null {
  const f = finalPlaca(placa);
  if (f == null) return null;
  return { data: ultimoDiaDoMes(ano, MES_LICENCIAMENTO_SP[f]), previsao: !LICENCIAMENTO_SP_CONFIRMADO.includes(ano) };
}

/** Próximo vencimento do licenciamento (deste ano, ou do próximo se já passou). */
export function proximoLicenciamento(placa: string, hoje: string) {
  const ano = Number(hoje.slice(0, 4));
  const deste = licenciamentoSP(placa, ano);
  if (!deste) return null;
  return deste.data >= hoje ? { ...deste, ano } : { ...licenciamentoSP(placa, ano + 1)!, ano: ano + 1 };
}

// ---------------------------------------------------------------------------
// IPVA (SP)
// ---------------------------------------------------------------------------
/** Dia de vencimento em janeiro por final de placa, por ano (oficial). */
const IPVA_SP_DIAS: Record<number, Record<number, number>> = {
  2026: { 1: 12, 2: 13, 3: 14, 4: 15, 5: 16, 6: 19, 7: 20, 8: 21, 9: 22, 0: 23 },
};
const IPVA_SP_DESCONTO: Record<number, number> = { 2026: 3 };
const PARCELAS = 5;

export type CalendarioIpva = {
  ano: number;
  cotaUnicaDesconto: string; // janeiro
  desconto: number | null; // % (null = ainda não divulgado)
  cotaUnicaSemDesconto: string; // fevereiro
  parcelas: string[]; // janeiro a maio
  /** true = calendário do ano ainda não divulgado: datas estimadas pelo ano anterior */
  previsao: boolean;
};

export function ipvaSP(placa: string, ano: number): CalendarioIpva | null {
  const f = finalPlaca(placa);
  if (f == null) return null;
  const anosOficiais = Object.keys(IPVA_SP_DIAS).map(Number).sort();
  const oficial = IPVA_SP_DIAS[ano];
  const base = oficial ?? IPVA_SP_DIAS[anosOficiais.filter((a) => a < ano).pop() ?? anosOficiais[0]];
  const dia = base[f];
  const data = (mes: number) => proximoDiaUtil(`${ano}-${doisDigitos(mes)}-${doisDigitos(dia)}`);
  const janeiro = oficial ? `${ano}-01-${doisDigitos(dia)}` : data(1);
  return {
    ano,
    cotaUnicaDesconto: janeiro,
    desconto: IPVA_SP_DESCONTO[ano] ?? null,
    cotaUnicaSemDesconto: data(2),
    parcelas: [janeiro, ...[2, 3, 4, 5].map(data)].slice(0, PARCELAS),
    previsao: !oficial,
  };
}

/** Calendário do IPVA em andamento (até a última parcela) ou o do próximo ano. */
export function calendarioIpvaAtual(placa: string, hoje: string) {
  const ano = Number(hoje.slice(0, 4));
  const deste = ipvaSP(placa, ano);
  if (!deste) return null;
  return deste.parcelas[deste.parcelas.length - 1] >= hoje ? deste : ipvaSP(placa, ano + 1);
}

// ---------------------------------------------------------------------------
// Documentos automáticos (usados quando o cliente não informou uma data própria)
// ---------------------------------------------------------------------------
export type DocumentoAutomatico = {
  id: string;
  dono_id: string;
  veiculo_id: string;
  tipo: "licenciamento" | "ipva";
  descricao: string;
  vencimento: string;
  automatico: true;
  previsao: boolean;
};

export function documentosAutomaticos(
  v: { id: string; dono_id: string; placa: string; uf?: string | null },
  manuais: { veiculo_id: string | null; tipo: string }[],
  hoje: string,
): DocumentoAutomatico[] {
  if (!temCalendario(v.uf)) return [];
  const tem = (tipo: string) => manuais.some((d) => d.veiculo_id === v.id && d.tipo === tipo);
  const lista: DocumentoAutomatico[] = [];
  const f = finalPlaca(v.placa);

  if (!tem("licenciamento")) {
    const l = proximoLicenciamento(v.placa, hoje);
    if (l)
      lista.push({
        id: `auto-licenciamento-${v.id}`,
        dono_id: v.dono_id,
        veiculo_id: v.id,
        tipo: "licenciamento",
        descricao: `${l.ano} · placa final ${f}`,
        vencimento: l.data,
        automatico: true,
        previsao: l.previsao,
      });
  }
  if (!tem("ipva")) {
    const c = calendarioIpvaAtual(v.placa, hoje);
    if (c) {
      // Próxima data relevante: cota única/1ª parcela, ou a próxima parcela em aberto
      const proxima = c.parcelas.find((p) => p >= hoje) ?? c.cotaUnicaDesconto;
      const primeira = proxima === c.cotaUnicaDesconto;
      lista.push({
        id: `auto-ipva-${v.id}`,
        dono_id: v.dono_id,
        veiculo_id: v.id,
        tipo: "ipva",
        descricao: primeira
          ? `${c.ano} · cota única${c.desconto ? ` com ${c.desconto}% de desconto` : ""} ou 1ª parcela`
          : `${c.ano} · ${c.parcelas.indexOf(proxima) + 1}ª parcela (se parcelado)`,
        vencimento: proxima,
        automatico: true,
        previsao: c.previsao,
      });
    }
  }
  return lista;
}
