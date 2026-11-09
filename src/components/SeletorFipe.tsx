"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  TIPOS_VEICULO,
  agruparModelos,
  lerDetalhe,
  nomeMarca,
  type AnoComVersoes,
  type DetalheFipe,
  type ItemFipe,
  type ModeloBasico,
  type TipoVeiculo,
} from "@/lib/fipe";
import { formatarValor } from "@/lib/garagem";

async function buscar<T>(caminho: string): Promise<T> {
  const r = await fetch(`/api/fipe/${caminho}`);
  if (!r.ok) throw new Error("indisponível");
  return r.json() as Promise<T>;
}

/** Lista com busca (marcas e modelos podem ter centenas de itens). */
function Combo({
  rotulo,
  itens,
  valor,
  aoEscolher,
  carregando,
  desabilitado,
  formatar = (n: string) => n,
  placeholder,
}: {
  rotulo: string;
  itens: ItemFipe[];
  valor: ItemFipe | null;
  aoEscolher: (i: ItemFipe) => void;
  carregando?: boolean;
  desabilitado?: boolean;
  formatar?: (nome: string) => string;
  placeholder: string;
}) {
  const [texto, setTexto] = useState("");
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const idLista = useId();

  useEffect(() => {
    const fechar = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, []);

  const filtrados = useMemo(() => {
    const t = texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    const partes = t.split(/\s+/).filter(Boolean);
    return itens
      .filter((i) => {
        const n = formatar(i.nome).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
        return partes.every((p) => n.includes(p));
      })
      .slice(0, 80);
  }, [itens, texto, formatar]);

  return (
    <div ref={caixa} className="relative space-y-1.5">
      <span className="text-sm font-medium">{rotulo}</span>
      <input
        type="text"
        disabled={desabilitado || carregando}
        value={aberto ? texto : valor ? formatar(valor.nome) : ""}
        onFocus={() => {
          setTexto("");
          setAberto(true);
        }}
        onChange={(e) => {
          setTexto(e.target.value);
          setAberto(true);
        }}
        placeholder={carregando ? "Carregando…" : placeholder}
        className="campo disabled:bg-fundo"
        autoComplete="off"
        role="combobox"
        aria-expanded={aberto}
        aria-controls={idLista}
        aria-label={rotulo}
      />
      {aberto && !carregando && (
        <ul id={idLista} role="listbox" className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-borda bg-white py-1 shadow-xl">
          {filtrados.length === 0 ? (
            <li className="px-4 py-2.5 text-sm text-suave">Nada encontrado</li>
          ) : (
            filtrados.map((i) => (
              <li key={i.codigo}>
                <button
                  type="button"
                  role="option"
                  aria-selected={valor?.codigo === i.codigo}
                  onClick={() => {
                    aoEscolher(i);
                    setAberto(false);
                  }}
                  className="block w-full px-4 py-2.5 text-left text-sm hover:bg-marca-clara"
                >
                  {formatar(i.nome)}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export type Escolha = { tipo: TipoVeiculo; marcaCod: string; modeloCod: string; anoCod: string; detalhe: DetalheFipe };

/**
 * Escolha guiada pela tabela FIPE: tipo → marca → modelo básico (ex.: Polo) → ano → versão.
 * Ao final, devolve os dados completos do veículo (marca, modelo, ano, combustível, código e valor FIPE).
 */
export function SeletorFipe({
  aoConcluir,
  aoFalhar,
  anoAtual,
}: {
  aoConcluir: (e: Escolha) => void;
  aoFalhar: () => void;
  anoAtual: number;
}) {
  const [tipo, setTipo] = useState<TipoVeiculo>("carro");
  const [marcas, setMarcas] = useState<ItemFipe[]>([]);
  const [modelos, setModelos] = useState<ModeloBasico[]>([]);
  const [anos, setAnos] = useState<AnoComVersoes[]>([]);
  const [marca, setMarca] = useState<ItemFipe | null>(null);
  const [modelo, setModelo] = useState<ModeloBasico | null>(null);
  const [ano, setAno] = useState<AnoComVersoes | null>(null);
  const [carregando, setCarregando] = useState<"" | "marcas" | "modelos" | "anos" | "detalhe">("marcas");
  const [incompleto, setIncompleto] = useState(false);
  const [erro, setErro] = useState(false);
  const caminho = TIPOS_VEICULO[tipo].caminho;

  useEffect(() => {
    let ativo = true;
    buscar<ItemFipe[]>(`${caminho}/marcas`)
      .then((m) => ativo && setMarcas(m.map((x) => ({ codigo: String(x.codigo), nome: x.nome }))))
      .catch(() => ativo && setErro(true))
      .finally(() => ativo && setCarregando(""));
    return () => {
      ativo = false;
    };
  }, [caminho]);

  function trocarTipo(t: TipoVeiculo) {
    if (t === tipo) return;
    setTipo(t);
    setMarcas([]);
    setMarca(null);
    setModelo(null);
    setModelos([]);
    setAno(null);
    setAnos([]);
    setErro(false);
    setCarregando("marcas");
  }

  async function escolherMarca(m: ItemFipe) {
    setMarca(m);
    setModelo(null);
    setAno(null);
    setAnos([]);
    setCarregando("modelos");
    try {
      const r = await buscar<{ modelos: ItemFipe[] }>(`${caminho}/marcas/${m.codigo}/modelos`);
      setModelos(agruparModelos(r.modelos.map((x) => ({ codigo: String(x.codigo), nome: x.nome }))));
    } catch {
      setErro(true);
    } finally {
      setCarregando("");
    }
  }

  async function escolherModelo(m: ModeloBasico) {
    setModelo(m);
    setAno(null);
    setAnos([]);
    setCarregando("anos");
    try {
      const r = await fetch(`/api/fipe-versoes?tipo=${caminho}&marca=${marca!.codigo}&modelo=${encodeURIComponent(m.chave)}`);
      if (!r.ok) throw new Error();
      const dados = (await r.json()) as { anos: AnoComVersoes[]; incompleto?: boolean };
      setAnos(dados.anos);
      setIncompleto(Boolean(dados.incompleto));
    } catch {
      setErro(true);
    } finally {
      setCarregando("");
    }
  }

  async function escolherVersao(v: AnoComVersoes["versoes"][number]) {
    setCarregando("detalhe");
    try {
      const d = await buscar<Record<string, unknown>>(`${caminho}/marcas/${marca!.codigo}/modelos/${v.modeloCod}/anos/${v.anoCod}`);
      aoConcluir({ tipo, marcaCod: marca!.codigo, modeloCod: v.modeloCod, anoCod: v.anoCod, detalhe: lerDetalhe(d, anoAtual) });
    } catch {
      setErro(true);
    } finally {
      setCarregando("");
    }
  }

  if (erro) {
    return (
      <div className="space-y-2 rounded-xl border border-alerta/40 bg-alerta-claro p-4 text-sm text-[#8a5a00]">
        <p>A tabela FIPE não respondeu agora. Você pode preencher os dados manualmente.</p>
        <button type="button" onClick={aoFalhar} className="font-semibold underline">Preencher manualmente</button>
      </div>
    );
  }

  const itensModelo: ItemFipe[] = modelos.map((m) => ({ codigo: m.chave, nome: m.nome }));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tipo de veículo">
        {(Object.keys(TIPOS_VEICULO) as TipoVeiculo[]).map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={tipo === t}
            onClick={() => trocarTipo(t)}
            className={`rounded-xl border px-2 py-2.5 text-sm transition ${
              tipo === t ? "border-marca bg-marca-clara font-semibold text-marca-escura" : "border-borda bg-white"
            }`}
          >
            <span aria-hidden="true">{TIPOS_VEICULO[t].icone}</span> {TIPOS_VEICULO[t].rotulo}
          </button>
        ))}
      </div>

      <Combo
        rotulo="1. Marca"
        itens={marcas}
        valor={marca}
        aoEscolher={escolherMarca}
        carregando={carregando === "marcas"}
        formatar={nomeMarca}
        placeholder="Digite ou escolha a marca"
      />
      <Combo
        rotulo="2. Modelo"
        itens={itensModelo}
        valor={modelo ? { codigo: modelo.chave, nome: modelo.nome } : null}
        aoEscolher={(i) => escolherModelo(modelos.find((m) => m.chave === i.codigo)!)}
        carregando={carregando === "modelos"}
        desabilitado={!marca}
        placeholder={marca ? "Ex.: Polo, Gol, HB20" : "Escolha a marca primeiro"}
      />

      {modelo && (
        <div className="space-y-1.5">
          <span className="text-sm font-medium">3. Ano</span>
          {carregando === "anos" ? (
            <p className="rounded-xl bg-fundo px-4 py-3 text-sm text-suave">Buscando anos e versões do {modelo.nome}…</p>
          ) : anos.length === 0 ? (
            <p className="text-sm text-suave">Nenhum ano encontrado para este modelo.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {anos.map((a) => {
                const chave = a.zeroKm ? "0km" : String(a.ano);
                const ativo = ano && (ano.zeroKm ? "0km" : String(ano.ano)) === chave;
                return (
                  <button
                    key={chave}
                    type="button"
                    onClick={() => setAno(a)}
                    className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                      ativo ? "border-marca bg-marca text-white" : "border-borda bg-white hover:border-marca"
                    }`}
                  >
                    {a.zeroKm ? "Zero km" : a.ano}
                  </button>
                );
              })}
            </div>
          )}
          {incompleto && <p className="text-xs text-suave">Alguns anos podem não ter carregado. Se não achar, tente de novo em instantes.</p>}
        </div>
      )}

      {ano && (
        <div className="space-y-1.5">
          <span className="text-sm font-medium">
            4. Versão {ano.zeroKm ? "zero km" : ano.ano} <span className="font-normal text-suave">({ano.versoes.length})</span>
          </span>
          <ul className="max-h-80 divide-y divide-borda overflow-auto rounded-xl border border-borda bg-white">
            {ano.versoes.map((v) => (
              <li key={`${v.modeloCod}-${v.anoCod}`}>
                <button
                  type="button"
                  disabled={carregando === "detalhe"}
                  onClick={() => escolherVersao(v)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-marca-clara disabled:opacity-60"
                >
                  <span>{v.nome}</span>
                  {v.combustivel && <span className="shrink-0 rounded-full bg-fundo px-2 py-0.5 text-xs text-suave">{v.combustivel}</span>}
                </button>
              </li>
            ))}
          </ul>
          {carregando === "detalhe" && <p className="text-sm text-suave">Carregando dados da versão…</p>}
        </div>
      )}
    </div>
  );
}

export function ResumoFipe({ d, aoAlterar }: { d: DetalheFipe; aoAlterar?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-marca/30 bg-marca-clara/60 p-4">
      <div className="min-w-0 text-sm">
        <p className="font-semibold text-tinta">{d.marca} {d.modelo}</p>
        <p className="text-suave">
          {d.ano} · {d.combustivel || "—"}
          {d.valor != null && <> · FIPE {formatarValor(d.valor)}</>}
        </p>
        {d.codigoFipe && <p className="text-xs text-suave">Código FIPE {d.codigoFipe}{d.referencia && ` · ref. ${d.referencia}`}</p>}
      </div>
      {aoAlterar && (
        <button type="button" onClick={aoAlterar} className="shrink-0 text-sm font-semibold text-marca-escura hover:underline">
          Alterar
        </button>
      )}
    </div>
  );
}
