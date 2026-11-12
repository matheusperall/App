"use client";

import { useActionState, useMemo, useState } from "react";
import type { EstadoForm } from "@/app/(auth)/actions";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { ResumoFipe, SeletorFipe, type Escolha } from "@/components/SeletorFipe";
import { Aviso, Campo, Cartao } from "@/components/ui";
import { CATEGORIAS, formatarValor, normalizarPlaca, placaValida, type Categoria } from "@/lib/garagem";
import { arred, combina } from "@/lib/gestao";
import { CampoDinheiro } from "@/components/CampoDinheiro";
import { salvarOS, type DadosOS } from "./actions";

export type OpcaoCliente = {
  id: string;
  nome: string;
  telefone: string | null;
  lojista: boolean;
  veiculos: { id: string; placa: string; nome: string }[];
};
export type OpcaoServico = { id: string; nome: string; preco: number; categoria: Categoria };

type Item = { chave: number; catalogo_id: string | null; nome: string; preco: number; novo?: { categoria: Categoria } };

export type InicialOS = {
  id?: string;
  clienteId?: string | null;
  veiculoId?: string | null;
  itens?: { catalogo_id: string | null; nome: string; preco: number }[];
  desconto?: number;
  data: string;
  km?: number | null;
  observacoes?: string | null;
  agendamento_id?: string | null;
  orcamento_id?: string | null;
};

let proximaChave = 1;

export function FormOS({
  clientes,
  catalogo,
  inicial,
  placaApi,
}: {
  clientes: OpcaoCliente[];
  catalogo: OpcaoServico[];
  inicial: InicialOS;
  placaApi: boolean;
}) {
  const [estado, acao] = useActionState<EstadoForm, FormData>(salvarOS, {});
  const editando = Boolean(inicial.id);
  const anoAtual = new Date().getFullYear();

  // ---------------- Cliente ----------------
  const [clienteId, setClienteId] = useState<string | null>(inicial.clienteId ?? null);
  const [novoCliente, setNovoCliente] = useState<{ nome: string; telefone: string; lojista: boolean } | null>(null);
  const [buscaCliente, setBuscaCliente] = useState("");
  const cliente = clientes.find((c) => c.id === clienteId) ?? null;
  const clientesFiltrados = useMemo(() => {
    if (!buscaCliente.trim()) return clientes.slice(0, 6);
    const placa = normalizarPlaca(buscaCliente);
    return clientes
      .filter((c) => combina(`${c.nome} ${c.telefone ?? ""}`, buscaCliente) || (placa.length >= 3 && c.veiculos.some((v) => v.placa.includes(placa))))
      .slice(0, 8);
  }, [buscaCliente, clientes]);

  // ---------------- Veículo ----------------
  const [veiculoId, setVeiculoId] = useState<string | null>(inicial.veiculoId ?? null);
  const [novoVeiculo, setNovoVeiculo] = useState(false);
  const [placa, setPlaca] = useState("");
  const [escolhaFipe, setEscolhaFipe] = useState<Escolha | null>(null);
  const [modoVeiculo, setModoVeiculo] = useState<"fipe" | "manual">("fipe");
  const [manual, setManual] = useState({ marca: "", modelo: "", ano: "" });
  const [consultandoPlaca, setConsultandoPlaca] = useState(false);
  const [avisoPlaca, setAvisoPlaca] = useState("");

  async function buscarPelaPlaca() {
    setConsultandoPlaca(true);
    setAvisoPlaca("");
    try {
      const r = await fetch(`/api/placa?placa=${normalizarPlaca(placa)}`);
      if (!r.ok) throw new Error();
      const d = (await r.json()) as { marca: string; modelo: string; ano: number | null };
      setModoVeiculo("manual");
      setManual({ marca: d.marca, modelo: d.modelo, ano: d.ano ? String(d.ano) : "" });
    } catch {
      setAvisoPlaca("Não encontramos dados para esta placa. Escolha pela tabela FIPE.");
    } finally {
      setConsultandoPlaca(false);
    }
  }

  // ---------------- Serviços ----------------
  const [itens, setItens] = useState<Item[]>(() =>
    (inicial.itens ?? []).map((i) => ({ chave: proximaChave++, catalogo_id: i.catalogo_id, nome: i.nome, preco: i.preco })),
  );
  const [buscaServico, setBuscaServico] = useState("");
  const [cadastrando, setCadastrando] = useState<{ nome: string; preco: number; categoria: Categoria } | null>(null);
  const servicosFiltrados = useMemo(
    () => (buscaServico.trim() ? catalogo.filter((s) => combina(s.nome, buscaServico)).slice(0, 10) : catalogo.slice(0, 8)),
    [buscaServico, catalogo],
  );

  function adicionar(s: { id: string | null; nome: string; preco: number; novo?: { categoria: Categoria } }) {
    setItens((l) => [...l, { chave: proximaChave++, catalogo_id: s.id, nome: s.nome, preco: s.preco, novo: s.novo }]);
    setBuscaServico("");
  }

  // ---------------- Valores ----------------
  const [desconto, setDesconto] = useState(inicial.desconto ?? 0);
  const [data, setData] = useState(inicial.data);
  const [km, setKm] = useState(inicial.km ? String(inicial.km) : "");
  const [observacoes, setObservacoes] = useState(inicial.observacoes ?? "");
  const subtotal = arred(itens.reduce((t, i) => t + Math.max(0, i.preco), 0));
  const descontoNum = Math.min(Math.max(0, desconto), subtotal);
  const total = arred(subtotal - descontoNum);

  // ---------------- Montagem dos dados ----------------
  const placaOk = placaValida(placa);
  const d = escolhaFipe?.detalhe;
  const veiculoNovoPronto = novoVeiculo && placaOk && (modoVeiculo === "fipe" ? Boolean(d) : Boolean(manual.marca.trim() && manual.modelo.trim()));
  const dados: DadosOS = {
    id: inicial.id,
    cliente: novoCliente ? { novo: novoCliente } : { id: clienteId ?? "" },
    veiculo: novoVeiculo
      ? {
          novo:
            modoVeiculo === "fipe" && d && escolhaFipe
              ? {
                  placa,
                  marca: d.marca,
                  modelo: d.modelo,
                  ano: d.ano,
                  tipo: escolhaFipe.tipo,
                  combustivel: d.combustivel,
                  codigo_fipe: d.codigoFipe,
                  valor_fipe: d.valor,
                  fipe_referencia: d.referencia,
                  fipe_marca_cod: escolhaFipe.marcaCod,
                  fipe_modelo_cod: escolhaFipe.modeloCod,
                  fipe_ano_cod: escolhaFipe.anoCod,
                }
              : { placa, marca: manual.marca, modelo: manual.modelo, ano: Number(manual.ano) || null },
        }
      : veiculoId
        ? { id: veiculoId }
        : null,
    itens: itens.map((i) => ({ catalogo_id: i.catalogo_id, nome: i.nome, preco: Math.max(0, i.preco), novo: i.novo })),
    desconto: descontoNum,
    data,
    km: km ? Number(km.replace(/\D/g, "")) : null,
    observacoes,
    agendamento_id: inicial.agendamento_id ?? null,
    orcamento_id: inicial.orcamento_id ?? null,
  };

  const temCliente = Boolean(novoCliente ? novoCliente.nome.trim().length >= 2 : clienteId);
  const temVeiculo = novoVeiculo ? veiculoNovoPronto : Boolean(veiculoId);
  const faltando = !temCliente ? "Escolha o cliente" : !temVeiculo ? "Escolha ou cadastre o veículo" : itens.length === 0 ? "Adicione os serviços" : "";

  const veiculosDoCliente = novoCliente ? [] : (cliente?.veiculos ?? []);

  return (
    <form action={acao} className="space-y-4">
      <input type="hidden" name="dados" value={JSON.stringify(dados)} />
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}

      {/* 1. Cliente */}
      <Cartao className="space-y-3">
        <h2 className="font-semibold">1. Cliente</h2>
        {editando || (cliente && !novoCliente) ? (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-fundo px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-medium">
                {cliente?.nome ?? "Cliente"} {cliente?.lojista && <span className="text-xs font-semibold text-marca-escura">· lojista (fatura)</span>}
              </p>
              {cliente?.telefone && <p className="text-sm text-suave">{cliente.telefone}</p>}
            </div>
            {!editando && (
              <button
                type="button"
                className="shrink-0 text-sm font-semibold text-marca-escura"
                onClick={() => {
                  setClienteId(null);
                  setVeiculoId(null);
                  setNovoVeiculo(false);
                }}
              >
                Trocar
              </button>
            )}
          </div>
        ) : novoCliente ? (
          <div className="space-y-3 rounded-xl border border-marca/30 bg-marca-clara/40 p-4">
            <p className="text-sm font-semibold text-marca-escura">Novo cliente</p>
            <Campo rotulo="Nome">
              <input className="campo" value={novoCliente.nome} onChange={(e) => setNovoCliente({ ...novoCliente, nome: e.target.value })} autoFocus />
            </Campo>
            <Campo rotulo="Celular (WhatsApp)">
              <input className="campo" type="tel" inputMode="tel" placeholder="(17) 99999-0000" value={novoCliente.telefone} onChange={(e) => setNovoCliente({ ...novoCliente, telefone: e.target.value })} />
            </Campo>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-marca" checked={novoCliente.lojista} onChange={(e) => setNovoCliente({ ...novoCliente, lojista: e.target.checked })} />
              Lojista (revenda de carros — paga por fatura mensal)
            </label>
            <button type="button" className="text-sm font-medium text-suave underline" onClick={() => setNovoCliente(null)}>
              Voltar e escolher um cliente cadastrado
            </button>
          </div>
        ) : (
          <>
            <input
              type="search"
              className="campo"
              placeholder="Buscar por nome, telefone ou placa"
              value={buscaCliente}
              onChange={(e) => setBuscaCliente(e.target.value)}
              aria-label="Buscar cliente"
            />
            <ul className="divide-y divide-borda overflow-hidden rounded-xl border border-borda">
              {clientesFiltrados.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-fundo"
                    onClick={() => {
                      setClienteId(c.id);
                      setVeiculoId(c.veiculos.length === 1 ? c.veiculos[0].id : null);
                      setNovoVeiculo(c.veiculos.length === 0);
                    }}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{c.nome || "Sem nome"}{c.lojista && <span className="text-xs text-marca-escura"> · lojista</span>}</span>
                      <span className="block truncate text-xs text-suave">{[c.telefone, ...c.veiculos.map((v) => v.placa)].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span className="text-sm font-semibold text-marca-escura">Escolher</span>
                  </button>
                </li>
              ))}
              {clientesFiltrados.length === 0 && <li className="px-4 py-3 text-sm text-suave">Nenhum cliente encontrado.</li>}
            </ul>
            <button
              type="button"
              className="botao-contorno w-full text-sm"
              onClick={() => {
                setNovoCliente({ nome: buscaCliente.trim() && !placaValida(buscaCliente) ? buscaCliente.trim() : "", telefone: "", lojista: false });
                setClienteId(null);
                setVeiculoId(null);
                setNovoVeiculo(true);
                if (placaValida(buscaCliente)) setPlaca(normalizarPlaca(buscaCliente));
              }}
            >
              + Cadastrar novo cliente
            </button>
          </>
        )}
      </Cartao>

      {/* 2. Veículo */}
      <Cartao className="space-y-3">
          <h2 className="font-semibold">2. Veículo</h2>
          {!temCliente ? (
            <p className="text-sm text-suave">Escolha ou cadastre o cliente primeiro.</p>
          ) : editando && !novoVeiculo ? (
            <p className="rounded-xl bg-fundo px-4 py-3 text-sm">
              {veiculosDoCliente.find((v) => v.id === veiculoId)?.nome ?? "Veículo"}{" "}
              <span className="font-mono">{veiculosDoCliente.find((v) => v.id === veiculoId)?.placa}</span>
            </p>
          ) : (
            <>
              {veiculosDoCliente.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {veiculosDoCliente.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        setVeiculoId(v.id);
                        setNovoVeiculo(false);
                      }}
                      className={`rounded-xl border px-3 py-2 text-left text-sm transition ${veiculoId === v.id && !novoVeiculo ? "border-marca bg-marca-clara" : "border-borda bg-white hover:border-marca/50"}`}
                    >
                      <span className="block font-mono font-semibold tracking-wider">{v.placa}</span>
                      <span className="block text-xs text-suave">{v.nome}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setNovoVeiculo(true);
                      setVeiculoId(null);
                    }}
                    className={`rounded-xl border border-dashed px-3 py-2 text-sm font-semibold ${novoVeiculo ? "border-marca bg-marca-clara text-marca-escura" : "border-borda text-suave"}`}
                  >
                    + Outro veículo
                  </button>
                </div>
              )}

              {novoVeiculo && (
                <div className="space-y-3">
                  <Campo rotulo="Placa" dica={placa && !placaOk ? "Formato ABC1234 ou ABC1D23" : undefined}>
                    <div className="flex gap-2">
                      <input
                        className="campo font-mono uppercase tracking-wider"
                        maxLength={8}
                        autoCapitalize="characters"
                        autoComplete="off"
                        placeholder="ABC1D23"
                        value={placa}
                        onChange={(e) => setPlaca(normalizarPlaca(e.target.value))}
                      />
                      {placaApi && (
                        <button type="button" disabled={!placaOk || consultandoPlaca} onClick={buscarPelaPlaca} className="botao-escuro shrink-0 px-4 text-sm">
                          {consultandoPlaca ? "Buscando…" : "Buscar"}
                        </button>
                      )}
                    </div>
                  </Campo>
                  {avisoPlaca && <Aviso tipo="alerta">{avisoPlaca}</Aviso>}

                  {modoVeiculo === "fipe" ? (
                    d ? (
                      <ResumoFipe d={d} aoAlterar={() => setEscolhaFipe(null)} />
                    ) : (
                      <>
                        <SeletorFipe anoAtual={anoAtual} aoConcluir={setEscolhaFipe} aoFalhar={() => setModoVeiculo("manual")} />
                        <button type="button" onClick={() => setModoVeiculo("manual")} className="text-sm font-medium text-suave underline">
                          Não achei na tabela FIPE — preencher à mão
                        </button>
                      </>
                    )
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <Campo rotulo="Marca">
                          <input className="campo" value={manual.marca} onChange={(e) => setManual({ ...manual, marca: e.target.value })} />
                        </Campo>
                        <Campo rotulo="Ano">
                          <input className="campo" inputMode="numeric" maxLength={4} value={manual.ano} onChange={(e) => setManual({ ...manual, ano: e.target.value.replace(/\D/g, "") })} />
                        </Campo>
                      </div>
                      <Campo rotulo="Modelo">
                        <input className="campo" value={manual.modelo} onChange={(e) => setManual({ ...manual, modelo: e.target.value })} />
                      </Campo>
                      <button type="button" onClick={() => setModoVeiculo("fipe")} className="text-sm font-medium text-suave underline">
                        Escolher pela tabela FIPE
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </Cartao>

      {/* 3. Serviços */}
      <Cartao className="space-y-3">
        <h2 className="font-semibold">3. Serviços</h2>

        {itens.length > 0 && (
          <ul className="space-y-2">
            {itens.map((i) => (
              <li key={i.chave} className="flex items-center gap-2 rounded-xl bg-fundo p-2 pl-3">
                <span className="min-w-0 flex-1 text-sm font-medium">
                  {i.nome}
                  {i.novo && <span className="block text-xs font-normal text-marca-escura">novo no catálogo</span>}
                </span>
                <label className="flex items-center gap-1 text-sm text-suave">
                  R$
                  <CampoDinheiro
                    className="w-28 rounded-lg border border-borda bg-white px-2 py-1.5 text-base text-texto outline-none focus:border-marca"
                    valor={i.preco}
                    aria-label={`Preço de ${i.nome}`}
                    aoMudar={(v) => setItens((l) => l.map((x) => (x.chave === i.chave ? { ...x, preco: v } : x)))}
                  />
                </label>
                <button
                  type="button"
                  aria-label={`Remover ${i.nome}`}
                  className="rounded-lg px-2 py-1 text-lg leading-none text-suave hover:text-perigo"
                  onClick={() => setItens((l) => l.filter((x) => x.chave !== i.chave))}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        {cadastrando ? (
          <div className="space-y-3 rounded-xl border border-marca/30 bg-marca-clara/40 p-4">
            <p className="text-sm font-semibold text-marca-escura">Novo serviço (entra no catálogo)</p>
            <Campo rotulo="Nome do serviço">
              <input className="campo" value={cadastrando.nome} onChange={(e) => setCadastrando({ ...cadastrando, nome: e.target.value })} autoFocus />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Preço (R$)">
                <CampoDinheiro valor={cadastrando.preco} aoMudar={(v) => setCadastrando({ ...cadastrando, preco: v })} />
              </Campo>
              <Campo rotulo="Categoria">
                <select className="campo px-3" value={cadastrando.categoria} onChange={(e) => setCadastrando({ ...cadastrando, categoria: e.target.value as Categoria })}>
                  {(Object.keys(CATEGORIAS) as Categoria[]).map((c) => (
                    <option key={c} value={c}>{CATEGORIAS[c].rotulo}</option>
                  ))}
                </select>
              </Campo>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="botao-primario flex-1 text-sm"
                disabled={cadastrando.nome.trim().length < 2}
                onClick={() => {
                  adicionar({ id: null, nome: cadastrando.nome.trim(), preco: Math.max(0, cadastrando.preco), novo: { categoria: cadastrando.categoria } });
                  setCadastrando(null);
                }}
              >
                Adicionar à OS
              </button>
              <button type="button" className="botao-contorno text-sm" onClick={() => setCadastrando(null)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            <input
              type="search"
              className="campo"
              placeholder="Buscar serviço (ex.: lavagem, polimento)"
              value={buscaServico}
              onChange={(e) => setBuscaServico(e.target.value)}
              aria-label="Buscar serviço no catálogo"
            />
            <ul className="divide-y divide-borda overflow-hidden rounded-xl border border-borda">
              {servicosFiltrados.map((s) => (
                <li key={s.id}>
                  <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-fundo" onClick={() => adicionar(s)}>
                    <span className="min-w-0 truncate text-sm">{s.nome}</span>
                    <span className="flex shrink-0 items-center gap-3 text-sm">
                      <span className="tabular-nums text-suave">{formatarValor(s.preco)}</span>
                      <span className="font-semibold text-marca-escura">+<span className="hidden sm:inline"> Adicionar</span></span>
                    </span>
                  </button>
                </li>
              ))}
              {servicosFiltrados.length === 0 && <li className="px-4 py-3 text-sm text-suave">Nenhum serviço com esse nome no catálogo.</li>}
            </ul>
            <button
              type="button"
              className="botao-contorno w-full text-sm"
              onClick={() => setCadastrando({ nome: buscaServico.trim(), preco: 0, categoria: "estetica" })}
            >
              + {buscaServico.trim() ? `Cadastrar “${buscaServico.trim()}” como serviço novo` : "Cadastrar serviço novo"}
            </button>
          </>
        )}
      </Cartao>

      {/* 4. Detalhes e total */}
      <Cartao className="space-y-3">
        <h2 className="font-semibold">4. Detalhes</h2>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Data">
            <input type="date" className="campo" value={data} onChange={(e) => setData(e.target.value)} required />
          </Campo>
          <Campo rotulo="Km (opcional)">
            <input className="campo" inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value.replace(/\D/g, ""))} placeholder="48.200" />
          </Campo>
        </div>
        <Campo rotulo="Desconto (R$)">
          <CampoDinheiro valor={desconto} aoMudar={setDesconto} />
        </Campo>
        <Campo rotulo="Observações (opcional)">
          <textarea className="campo min-h-20" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Ex.: cliente pediu atenção ao banco do motorista" />
        </Campo>
        <dl className="space-y-1 rounded-xl bg-fundo p-4 text-sm">
          <div className="flex justify-between"><dt className="text-suave">Subtotal</dt><dd className="tabular-nums">{formatarValor(subtotal)}</dd></div>
          {descontoNum > 0 && <div className="flex justify-between"><dt className="text-suave">Desconto</dt><dd className="tabular-nums">−{formatarValor(descontoNum)}</dd></div>}
          <div className="flex justify-between pt-1 text-lg font-bold"><dt>Total</dt><dd className="tabular-nums">{formatarValor(total)}</dd></div>
          {(cliente?.lojista || novoCliente?.lojista) && <p className="text-xs text-marca-escura">Cliente lojista: o valor entra na fatura do mês.</p>}
        </dl>
      </Cartao>

      {faltando && <p className="text-center text-sm text-suave">{faltando} para continuar.</p>}
      <BotaoEnviar pendente="Salvando…" className={`botao-primario w-full ${faltando ? "pointer-events-none opacity-50" : ""}`}>
        {editando ? "Salvar alterações" : "Abrir OS"}
      </BotaoEnviar>
    </form>
  );
}
