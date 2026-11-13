import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Voltar } from "@/components/garagem";
import { Dinheiro, SeloProduto } from "@/components/gestao";
import { FormAcao } from "@/components/gestao/FormAcao";
import { Campo, Cartao } from "@/components/ui";
import { exigirAdmin } from "@/lib/auth";
import { formatarDataHora } from "@/lib/garagem";
import { formatarQtd } from "@/lib/gestao";
import { listarCatalogo, listarContas, listarProdutos, movimentosEstoque } from "@/lib/gestao-dados";
import { ajustarProduto, salvarProduto } from "../actions";
import { CamposProduto } from "../CamposProduto";
import { FormRepor } from "./FormRepor";

export const metadata: Metadata = { title: "Produto" };

const ROTULO_MOV = { baixa: "Baixa", reposicao: "Reposição", ajuste: "Ajuste" } as const;

export default async function ProdutoPage({ params }: PageProps<"/gestao/estoque/[produtoId]">) {
  const [{ produtoId }] = await Promise.all([params, exigirAdmin()]);
  const [produtos, movimentos, contas, catalogo] = await Promise.all([listarProdutos(), movimentosEstoque(produtoId), listarContas(), listarCatalogo()]);
  const p = produtos.find((x) => x.id === produtoId);
  if (!p) notFound();
  const usadoEm = catalogo.filter((s) => s.consumo.some((c) => c.produto_id === p.id));

  return (
    <div className="space-y-4">
      <Voltar href="/gestao/estoque">Estoque</Voltar>
      <Cartao className="space-y-1">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold">{p.nome}</h1>
          <SeloProduto p={p} />
        </div>
        <p className="font-titulo text-3xl font-bold tabular-nums">{formatarQtd(p.saldo, p.unidade)}</p>
        <p className="text-sm text-suave">
          Mínimo {formatarQtd(p.minimo, p.unidade)} · custo médio <Dinheiro valor={p.custo_medio} /> por {p.unidade} · valor em estoque{" "}
          <Dinheiro valor={Math.max(0, p.saldo) * p.custo_medio} />
        </p>
        {usadoEm.length > 0 && (
          <p className="text-sm text-suave">
            Usado em: {usadoEm.map((s, i) => <span key={s.id}>{i > 0 && ", "}<Link href={`/gestao/catalogo/${s.id}`} className="underline">{s.nome}</Link></span>)}
          </p>
        )}
      </Cartao>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
        <Cartao className="p-0">
          <h2 className="px-5 pt-5 font-semibold">Histórico</h2>
          {movimentos.length === 0 ? (
            <p className="px-5 py-4 text-sm text-suave">Nenhuma movimentação.</p>
          ) : (
            <ul className="mt-2 divide-y divide-borda text-sm">
              {movimentos.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                  <span className="min-w-0">
                    {ROTULO_MOV[m.tipo]} · {m.os_id ? <Link href={`/gestao/os/${m.os_id}`} className="underline">{m.origem}</Link> : m.origem}
                    {m.observacao && ` — ${m.observacao}`}
                    <span className="block text-xs text-suave">{formatarDataHora(m.criado_em)} · saldo {formatarQtd(m.saldo_apos, p.unidade)}</span>
                  </span>
                  <span className={`shrink-0 font-semibold tabular-nums ${m.quantidade < 0 ? "text-perigo" : "text-sucesso"}`}>
                    {m.quantidade > 0 ? "+" : ""}{formatarQtd(m.quantidade, p.unidade)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
        </div>
        <div className="min-w-0 space-y-4">
        <Cartao className="space-y-3">
          <h2 className="font-semibold">Repor (compra)</h2>
          <FormRepor produto={p} contas={contas.filter((c) => c.ativa)} />
        </Cartao>
        <Cartao className="space-y-3">
          <h2 className="font-semibold">Ajustar saldo (contagem)</h2>
          <FormAcao acao={ajustarProduto} campos={{ id: p.id }} botao="Ajustar saldo" classeBotao="botao-escuro w-full" limparAoConcluir>
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo={`Saldo contado (${p.unidade})`}>
                <input name="saldo" inputMode="decimal" className="campo" required />
              </Campo>
              <Campo rotulo="Motivo (opcional)">
                <input name="observacao" className="campo" placeholder="Contagem, perda…" />
              </Campo>
            </div>
          </FormAcao>
        </Cartao>
        <Cartao className="space-y-3">
          <h2 className="font-semibold">Dados do produto</h2>
          <FormAcao acao={salvarProduto} campos={{ id: p.id }} botao="Salvar" classeBotao="botao-contorno w-full">
            <CamposProduto p={p} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="ativo" defaultChecked={p.ativo} className="h-4 w-4 accent-marca" /> Produto ativo
            </label>
          </FormAcao>
        </Cartao>
        </div>
      </div>



    </div>
  );
}
