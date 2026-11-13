"use client";

import { CampoDinheiro } from "@/components/CampoDinheiro";
import { useActionState, useState } from "react";
import type { EstadoForm } from "@/app/(auth)/actions";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { Aviso, Campo } from "@/components/ui";
import { CATEGORIAS, formatarValor, type Categoria } from "@/lib/garagem";
import { arred, lerNumero, type Produto, type ServicoCatalogo } from "@/lib/gestao";
import { salvarServicoCatalogo } from "./actions";

type Linha = { chave: number; produto_id: string; quantidade: string };
let chave = 1;

export function FormServico({ servico, produtos }: { servico?: ServicoCatalogo; produtos: Produto[] }) {
  const [estado, acao] = useActionState<EstadoForm, FormData>(salvarServicoCatalogo, {});
  const [preco, setPreco] = useState(servico?.preco ?? 0);
  const [linhas, setLinhas] = useState<Linha[]>(() =>
    (servico?.consumo ?? []).map((c) => ({ chave: chave++, produto_id: c.produto_id, quantidade: String(c.quantidade).replace(".", ",") })),
  );
  const custo = arred(
    linhas.reduce((t, l) => t + (lerNumero(l.quantidade) ?? 0) * (produtos.find((p) => p.id === l.produto_id)?.custo_medio ?? 0), 0),
  );
  const p = preco;
  const consumo = linhas.map((l) => ({ produto_id: l.produto_id, quantidade: lerNumero(l.quantidade) ?? 0 }));

  return (
    <form action={acao} className="ficha">
      {servico && <input type="hidden" name="id" value={servico.id} />}
      <input type="hidden" name="consumo" value={JSON.stringify(consumo)} />
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      {estado.sucesso && <Aviso tipo="sucesso">{estado.sucesso}</Aviso>}
      <Campo rotulo="Nome do serviço">
        <input name="nome" defaultValue={servico?.nome} required className="campo" placeholder="Ex.: Lavagem completa" />
      </Campo>
        <Campo rotulo="Preço (R$)" obrigatorio>
          <CampoDinheiro name="preco" valor={preco} aoMudar={setPreco} />
        </Campo>
        <Campo rotulo="Categoria">
          <select name="categoria" defaultValue={servico?.categoria ?? "estetica"} className="campo px-3">
            {(Object.keys(CATEGORIAS) as Categoria[]).map((c) => <option key={c} value={c}>{CATEGORIAS[c].rotulo}</option>)}
          </select>
        </Campo>
      {servico && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="ativo" defaultChecked={servico.ativo} className="h-4 w-4 accent-marca" /> Ativo (aparece na hora de abrir OS)
        </label>
      )}

      <fieldset className="space-y-2 rounded-xl bg-fundo p-3">
        <legend className="sr-only">Consumo de produtos</legend>
        <p className="text-sm font-medium">Produtos gastos em cada serviço</p>
        <p className="text-xs text-suave">Quando a OS fica pronta, essas quantidades saem do estoque e viram o custo do serviço.</p>
        {linhas.map((l) => {
          const prod = produtos.find((x) => x.id === l.produto_id);
          return (
            <div key={l.chave} className="flex items-center gap-2">
              <select
                className="campo min-w-0 flex-1 px-3 py-2"
                value={l.produto_id}
                aria-label="Produto"
                onChange={(e) => setLinhas((ls) => ls.map((x) => (x.chave === l.chave ? { ...x, produto_id: e.target.value } : x)))}
              >
                <option value="">Escolha…</option>
                {produtos.map((pr) => <option key={pr.id} value={pr.id}>{pr.nome}</option>)}
              </select>
              <input
                className="campo w-24 px-3 py-2 text-right"
                inputMode="decimal"
                value={l.quantidade}
                aria-label="Quantidade"
                onChange={(e) => setLinhas((ls) => ls.map((x) => (x.chave === l.chave ? { ...x, quantidade: e.target.value } : x)))}
              />
              <span className="w-8 text-xs text-suave">{prod?.unidade ?? ""}</span>
              <button type="button" aria-label="Remover" className="px-1 text-lg text-suave hover:text-perigo" onClick={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))}>×</button>
            </div>
          );
        })}
        {produtos.length === 0 ? (
          <p className="text-xs text-suave">Cadastre os produtos em Estoque para ligar ao serviço.</p>
        ) : (
          <button type="button" className="text-sm font-semibold text-marca-escura" onClick={() => setLinhas((ls) => [...ls, { chave: chave++, produto_id: "", quantidade: "" }])}>
            + Adicionar produto
          </button>
        )}
      </fieldset>

      <dl className="grid grid-cols-3 gap-2 rounded-xl border border-borda p-3 text-center text-sm">
        <div><dt className="text-xs text-suave">Preço</dt><dd className="font-semibold tabular-nums">{formatarValor(p)}</dd></div>
        <div><dt className="text-xs text-suave">Custo de produtos</dt><dd className="font-semibold tabular-nums">{formatarValor(custo)}</dd></div>
        <div><dt className="text-xs text-suave">Margem</dt><dd className="font-semibold tabular-nums">{formatarValor(p - custo)}{p > 0 && <span className="block text-xs font-normal text-suave">{Math.round(((p - custo) / p) * 100)}%</span>}</dd></div>
      </dl>
      <BotaoEnviar pendente="Salvando…">{servico ? "Salvar" : "Cadastrar serviço"}</BotaoEnviar>
    </form>
  );
}
