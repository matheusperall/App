import type { Metadata } from "next";
import { CampoDinheiro } from "@/components/CampoDinheiro";
import { PaginaFicha } from "@/components/PaginaFicha";
import { FormAcao } from "@/components/gestao/FormAcao";
import { Campo, Cartao } from "@/components/ui";
import { exigirAdmin } from "@/lib/auth";
import { salvarProduto } from "../actions";
import { CamposProduto } from "../CamposProduto";

export const metadata: Metadata = { title: "Novo produto" };

export default async function NovoProdutoPage() {
  await exigirAdmin();
  return (
    <PaginaFicha voltar={{ href: "/gestao/estoque", rotulo: "Estoque" }} icone="estoque" titulo="Novo produto" descricao="Produtos que a loja usa nos serviços (shampoo, cera, panos…).">
      <Cartao>
        <FormAcao acao={salvarProduto} botao="Cadastrar produto" pendente="Cadastrando…" className="ficha">
          <CamposProduto />
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-fundo p-3">
            <Campo rotulo="Quanto tem hoje" dica="Na unidade escolhida (ex.: 5000 ml)">
              <input name="saldo_inicial" inputMode="decimal" className="campo" placeholder="0" />
            </Campo>
            <Campo rotulo="Quanto custou (R$)" dica="Valor total dessa quantidade">
              <CampoDinheiro name="valor_inicial" />
            </Campo>
          </div>
        </FormAcao>
      </Cartao>
    </PaginaFicha>
  );
}
