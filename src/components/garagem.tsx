import Link from "next/link";
import { documentosAutomaticos } from "@/lib/calendarios";
import {
  CATEGORIAS,
  PRESTADORES,
  PRIORIDADES,
  SITUACOES_APONTAMENTO,
  TIPOS_DOCUMENTO,
  apontamentoAberto,
  hojeISO,
  situacaoDocumento,
  ritmoDoVeiculo,
  type Ritmo,
  type Apontamento,
  type Documento,
  descreverPrazo,
  formatarData,
  formatarKm,
  formatarPlaca,
  nomeVeiculo,
  rotuloManutencao,
  situacaoManutencao,
  type Manutencao,
  type Servico,
  type Situacao,
  type Veiculo,
} from "@/lib/garagem";

/** Placa no estilo Mercosul */
export function Placa({ placa, tamanho = "md" }: { placa: string; tamanho?: "sm" | "md" }) {
  const sm = tamanho === "sm";
  return (
    <span
      className={`inline-flex flex-col overflow-hidden rounded-md border-2 border-tinta bg-white text-center font-mono leading-none font-bold text-tinta ${
        sm ? "text-xs" : "text-sm"
      }`}
    >
      <span className={`bg-[#1e4fa3] text-white ${sm ? "px-1.5 py-[1px] text-[6px]" : "px-2 py-[2px] text-[7px]"} tracking-widest`}>
        BRASIL
      </span>
      <span className={`whitespace-nowrap ${sm ? "px-1.5 py-0.5" : "px-2 py-1 tracking-wider"}`}>{formatarPlaca(placa)}</span>
    </span>
  );
}

export function FotoVeiculo({ url, className = "" }: { url?: string; className?: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className={`object-cover ${className}`} />;
  }
  return (
    <div className={`flex items-center justify-center bg-gradient-to-br from-tinta to-tinta-2 ${className}`}>
      <svg viewBox="0 0 64 32" className="w-1/2 max-w-32 text-white/25" fill="currentColor" aria-hidden="true">
        <path d="M6 22c0-3 1-5 4-6l6-1 7-6c2-1.5 4-2 6-2h10c3 0 5 1 7 3l5 5 6 1c3 .5 4 2.5 4 5v3c0 1-1 2-2 2h-4a6 6 0 0 0-12 0H23a6 6 0 0 0-12 0H8c-1 0-2-1-2-2zm19-7h10V9h-5c-1 0-2 .5-3 1zm13 0h10l-3-3c-1-1-2-2-4-2h-3zM17 31a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm32 0a4 4 0 1 1 0-8 4 4 0 0 1 0 8z" />
      </svg>
    </div>
  );
}

const ESTILO_SITUACAO: Record<Situacao, { texto: string; classe: string }> = {
  vencida: { texto: "Vencida", classe: "bg-perigo-claro text-perigo" },
  em_breve: { texto: "Em breve", classe: "bg-alerta-claro text-[#8a5a00]" },
  em_dia: { texto: "Em dia", classe: "bg-sucesso-claro text-sucesso" },
  sem_dados: { texto: "Sem dados", classe: "bg-fundo text-suave" },
};

export function SeloSituacao({ situacao }: { situacao: Situacao }) {
  const e = ESTILO_SITUACAO[situacao];
  return <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${e.classe}`}>{e.texto}</span>;
}

/** Resumo de pendências de um veículo, para o cartão da lista */
export function contarAlertas(manutencoes: Manutencao[], kmAtual: number, ritmo?: Ritmo) {
  let vencidas = 0;
  let emBreve = 0;
  for (const m of manutencoes) {
    const s = situacaoManutencao(m, kmAtual, undefined, ritmo).situacao;
    if (s === "vencida") vencidas++;
    if (s === "em_breve") emBreve++;
  }
  return { vencidas, emBreve };
}

export function CartaoVeiculo({
  veiculo,
  fotoUrl,
  manutencoes,
  apontamentos = [],
  documentos = [],
}: {
  veiculo: Veiculo;
  fotoUrl?: string;
  manutencoes: Manutencao[];
  apontamentos?: Apontamento[];
  documentos?: Documento[];
}) {
  const m = contarAlertas(manutencoes, veiculo.km_atual, ritmoDoVeiculo(veiculo));
  const docs = [...documentosAutomaticos(veiculo, documentos, hojeISO()), ...documentos].map((d) => situacaoDocumento(d.vencimento).situacao);
  const vencidas = m.vencidas + docs.filter((x) => x === "vencida").length;
  const emBreve = m.emBreve + docs.filter((x) => x === "em_breve").length;
  const abertos = apontamentos.filter(apontamentoAberto).length;
  return (
    <Link
      href={`/garagem/${veiculo.id}`}
      className="group block overflow-hidden rounded-2xl border border-borda bg-white transition hover:border-marca/50 hover:shadow-lg hover:shadow-tinta/5"
    >
      <div className="flex gap-3 p-4">
      <div className="shrink-0 overflow-hidden rounded-xl">
        <FotoVeiculo url={fotoUrl} className="h-20 w-20 sm:h-24 sm:w-24" />
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-semibold">{nomeVeiculo(veiculo)}</h3>
            <p className="text-sm text-suave">
              {[veiculo.ano, veiculo.cor].filter(Boolean).join(" · ") || "—"} · {formatarKm(veiculo.km_atual)}
            </p>
          </div>
          <span className="shrink-0">
            <Placa placa={veiculo.placa} tamanho="sm" />
          </span>
        </div>
        {vencidas + emBreve + abertos > 0 ? (
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            {abertos > 0 && (
              <span className="rounded-full bg-tinta px-2.5 py-1 text-white">
                📍 {abertos} {abertos === 1 ? "apontamento" : "apontamentos"}
              </span>
            )}
            {vencidas > 0 && (
              <span className="rounded-full bg-perigo-claro px-2.5 py-1 text-perigo">
                {vencidas} {vencidas === 1 ? "item vencido" : "itens vencidos"}
              </span>
            )}
            {emBreve > 0 && (
              <span className="rounded-full bg-alerta-claro px-2.5 py-1 text-[#8a5a00]">
                {emBreve} {emBreve === 1 ? "vence em breve" : "vencem em breve"}
              </span>
            )}
          </div>
        ) : (
          <p className="text-xs font-semibold text-sucesso">✓ Tudo em dia</p>
        )}
      </div>
      </div>
    </Link>
  );
}

export function ItemManutencao({ m, kmAtual, ritmo }: { m: Manutencao; kmAtual: number; ritmo?: Ritmo }) {
  const { situacao, dias, kmRestante, dataKm } = situacaoManutencao(m, kmAtual, undefined, ritmo);
  const proxima = [m.proxima_data && formatarData(m.proxima_data), m.proximo_km != null && formatarKm(m.proximo_km)]
    .filter(Boolean)
    .join(" ou ");
  return (
    <li className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="font-medium">{rotuloManutencao(m.tipo)}</p>
        <p className="text-sm text-suave">
          Próxima: {proxima || "—"}
          {situacao !== "sem_dados" && <span className="block text-xs">{descreverPrazo(dias, kmRestante)}</span>}
          {dataKm && <span className="block text-xs text-marca-escura">Previsão para {formatarKm(m.proximo_km)}: ~{formatarData(dataKm)}</span>}
        </p>
      </div>
      <SeloSituacao situacao={situacao} />
    </li>
  );
}

export function SeloPrestador({ servico }: { servico: Pick<Servico, "prestador" | "pela_empresa"> }) {
  const empresa = servico.pela_empresa;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        empresa ? "bg-marca-clara text-marca-escura" : "bg-fundo text-suave"
      }`}
    >
      {empresa ? PRESTADORES[servico.prestador === "externo" ? "proprio" : servico.prestador] : PRESTADORES.externo}
    </span>
  );
}

export function ItemServico({ servico, veiculoId }: { servico: Servico; veiculoId: string }) {
  const cat = CATEGORIAS[servico.categoria];
  return (
    <li>
      <Link
        href={`/garagem/${veiculoId}/servicos/${servico.id}`}
        className="flex gap-3 rounded-xl px-2 py-3 transition hover:bg-fundo"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fundo text-lg" aria-hidden="true">
          {cat.icone}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium">{servico.titulo}</p>
            <span className="shrink-0 text-xs text-suave">{formatarData(servico.data)}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-suave">
            <span>{cat.rotulo}</span>
            {servico.km != null && <span>· {formatarKm(servico.km)}</span>}
            {servico.fotos.length > 0 && <span>· 📷 {servico.fotos.length}</span>}
            <SeloPrestador servico={servico} />
          </div>
        </div>
      </Link>
    </li>
  );
}

export function Voltar({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-suave hover:text-texto">
      <span aria-hidden="true">←</span> {children}
    </Link>
  );
}

export function SeloPrioridade({ prioridade }: { prioridade: Apontamento["prioridade"] }) {
  const p = PRIORIDADES[prioridade];
  return <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${p.classe}`}>{p.rotulo}</span>;
}

export function ItemApontamento({ a, empresa = false }: { a: Apontamento; empresa?: boolean }) {
  const cat = CATEGORIAS[a.categoria];
  const sit = SITUACOES_APONTAMENTO[a.situacao];
  return (
    <li>
      <Link
        href={`/garagem/${a.veiculo_id}/apontamentos/${a.id}`}
        className="flex gap-3 rounded-xl px-2 py-3 transition hover:bg-fundo"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fundo text-lg" aria-hidden="true">
          {cat.icone}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium">{a.titulo}</p>
            <SeloPrioridade prioridade={a.prioridade} />
          </div>
          <p className="mt-1 text-xs text-suave">
            {cat.rotulo} · {formatarData(a.criado_em)} ·{" "}
            <span className={a.situacao === "pendente" && !empresa ? "font-semibold text-marca-escura" : ""}>
              {empresa ? sit.rotuloEmpresa : sit.rotulo}
            </span>
            {a.fotos.length > 0 && <> · 📷 {a.fotos.length}</>}
          </p>
        </div>
      </Link>
    </li>
  );
}

export function ItemDocumento({ d }: { d: Documento }) {
  const info = TIPOS_DOCUMENTO[d.tipo];
  const { situacao, dias } = situacaoDocumento(d.vencimento);
  return (
    <li className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="font-medium">
          <span aria-hidden="true">{info.icone} </span>
          {d.tipo === "outro" && d.descricao ? d.descricao : info.rotulo}
        </p>
        {d.automatico && d.descricao && <p className="text-xs text-suave">{d.descricao}{d.previsao ? " · previsão" : ""}</p>}
        <p className="text-sm text-suave">
          Vence em {formatarData(d.vencimento)}
          <span className="block text-xs">{descreverPrazo(dias, null)}</span>
        </p>
      </div>
      <SeloSituacao situacao={situacao} />
    </li>
  );
}
