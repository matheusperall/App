import type { Metadata } from "next";
import Link from "next/link";
import { Dinheiro, Indicador, SeloProduto, Titulo, Vazio } from "@/components/gestao";
import { Cartao } from "@/components/ui";
import { exigirAdmin } from "@/lib/auth";
import { formatarDataHora } from "@/lib/garagem";
import { arred, formatarQtd, situacaoProduto } from "@/lib/gestao";
import { listarProdutos, movimentosEstoque } from "@/lib/gestao-dados";

export const metadata: Metadata = { title: "Estoque" };

const ROTULO_MOV = { baixa: "Baixa", reposicao: "Reposição", ajuste: "Ajuste" } as const;

export default async function EstoquePage() {
  await exigirAdmin();
  const [produtos, movimentos] = await Promise.all([listarProdutos(), movimentosEstoque()]);
  const ativos = produtos.filter((p) => p.ativo);
  const ordem = { sem: 0, critico: 1, ok: 2 };
  ativos.sort((a, b) => ordem[situacaoProduto(a).chave] - ordem[situacaoProduto(b).chave] || a.nome.localeCompare(b.nome));
  const valorEstoque = arred(ativos.reduce((t, p) => t + Math.max(0, p.saldo) * p.custo_medio, 0));
  const criticos = ativos.filter((p) => situacaoProduto(p).chave !== "ok").length;

  return (
    <div className="space-y-4">
      <Titulo pre="Gestão" titulo="Estoque">
        <Link href="/gestao/estoque/novo" className="botao-primario px-4 py-2.5 text-sm">+ Produto</Link>
      </Titulo>

      <div className="grid grid-cols-2 gap-3">
        <Indicador rotulo="Valor em estoque" valor={<Dinheiro valor={valorEstoque} />} detalhe="pelo custo médio" />
        <Indicador rotulo="Críticos ou sem estoque" valor={criticos} destaque={criticos > 0} />
      </div>

      <Cartao className="p-0">
        {ativos.length === 0 ? (
          <Vazio>Nenhum produto cadastrado. Cadastre os produtos que você usa (shampoo, cera, panos…) para controlar o consumo.</Vazio>
        ) : (
          <ul className="divide-y divide-borda">
            {ativos.map((p) => (
              <li key={p.id}>
                <Link href={`/gestao/estoque/${p.id}`} className="flex items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-fundo">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.nome}</p>
                    <p className="text-xs text-suave">mínimo {formatarQtd(p.minimo, p.unidade)} · custo médio <Dinheiro valor={p.custo_medio} />/{p.unidade}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-semibold tabular-nums">{formatarQtd(p.saldo, p.unidade)}</span>
                    <SeloProduto p={p} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      {produtos.some((p) => !p.ativo) && (
        <p className="text-sm text-suave">Inativos: {produtos.filter((p) => !p.ativo).map((p) => <Link key={p.id} href={`/gestao/estoque/${p.id}`} className="mr-2 underline">{p.nome}</Link>)}</p>
      )}

      <Cartao className="p-0">
        <h2 className="px-5 pt-5 font-semibold">Últimas movimentações</h2>
        {movimentos.length === 0 ? (
          <Vazio>Nenhuma movimentação ainda.</Vazio>
        ) : (
          <ul className="mt-2 divide-y divide-borda text-sm">
            {movimentos.slice(0, 30).map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <span className="min-w-0">
                  <span className="font-medium">{m.produto?.nome}</span>
                  <span className="block text-xs text-suave">{ROTULO_MOV[m.tipo]} · {m.origem} · {formatarDataHora(m.criado_em)}</span>
                </span>
                <span className={`shrink-0 tabular-nums font-semibold ${m.quantidade < 0 ? "text-perigo" : "text-sucesso"}`}>
                  {m.quantidade > 0 ? "+" : ""}{formatarQtd(m.quantidade, m.produto?.unidade ?? "un")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </div>
  );
}
