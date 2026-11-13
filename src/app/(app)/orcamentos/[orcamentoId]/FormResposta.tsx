"use client";

import { useActionState, useState } from "react";
import type { EstadoForm } from "@/app/(auth)/actions";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { Aviso, Campo } from "@/components/ui";
import { CampoEscolha, type OpcaoBusca } from "@/components/ListaBusca";
import { CATEGORIAS, formatarValor, type Categoria, type ItemOrcamento } from "@/lib/garagem";
import { responderOrcamento } from "../actions";

type Linha = { chave: number; descricao: string; valor: string };

const paraNumero = (s: string) => {
  const limpo = s.replace(/[^\d,.-]/g, "");
  const v = limpo.includes(",") ? Number(limpo.replace(/\./g, "").replace(",", ".")) : Number(limpo);
  return Number.isFinite(v) ? v : 0;
};

export function FormResposta({
  id,
  veiculoId,
  itens = [],
  prazo,
  validadePadrao,
  observacoes,
  novo = false,
  veiculos,
}: {
  id?: string;
  veiculoId?: string;
  itens?: ItemOrcamento[];
  prazo?: number | null;
  validadePadrao: string;
  observacoes?: string | null;
  novo?: boolean;
  /** Novo orçamento sem veículo definido: a empresa escolhe o veículo do cliente aqui */
  veiculos?: OpcaoBusca[];
}) {
  const [estado, acao] = useActionState<EstadoForm, FormData>(responderOrcamento, {});
  const [linhas, setLinhas] = useState<Linha[]>(
    itens.length
      ? itens.map((i, n) => ({ chave: n, descricao: i.descricao, valor: i.valor.toFixed(2).replace(".", ",") }))
      : [{ chave: 0, descricao: "", valor: "" }],
  );
  const [categoria, setCategoria] = useState<Categoria>("estetica");
  const [veiculoEscolhido, setVeiculoEscolhido] = useState("");
  const total = linhas.reduce((s, l) => s + paraNumero(l.valor), 0);
  const atualizar = (chave: number, campo: "descricao" | "valor", v: string) =>
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, [campo]: v } : l)));

  return (
    <form action={acao} className="ficha">
      {id && <input type="hidden" name="id" value={id} />}
      {veiculoId && <input type="hidden" name="veiculo_id" value={veiculoId} />}
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}

      {!veiculoId && veiculos && (
        <CampoEscolha
          rotulo="Cliente e veículo"
          nome="veiculo_id"
          opcoes={veiculos}
          valor={veiculoEscolhido}
          mudar={setVeiculoEscolhido}
          placeholder="Digite a placa, o modelo, o nome ou o telefone"
          vazio="Nenhum veículo encontrado. Cadastre o cliente em Gestão › Clientes."
        />
      )}

      {novo && (
        <>
          <Campo rotulo="Tipo de serviço">
            <select name="categoria" value={categoria} onChange={(e) => setCategoria(e.target.value as Categoria)} className="campo">
              {Object.entries(CATEGORIAS).map(([k, v]) => <option key={k} value={k}>{v.icone} {v.rotulo}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Assunto" dica="Opcional. Ex.: Revisão dos 50 mil km.">
            <input name="pedido" className="campo" />
          </Campo>
        </>
      )}

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">Itens do orçamento<span className="ml-0.5 text-perigo" aria-hidden="true">*</span></legend>
        {linhas.map((l, n) => (
          <div key={l.chave} className="flex gap-2">
            <input
              name="item_descricao"
              value={l.descricao}
              onChange={(e) => atualizar(l.chave, "descricao", e.target.value)}
              className="campo min-w-0 flex-1 py-2.5"
              placeholder={n === 0 ? "Ex.: Polimento técnico 3 etapas" : "Serviço ou peça"}
              aria-label={`Descrição do item ${n + 1}`}
            />
            <input
              name="item_valor"
              value={l.valor}
              onChange={(e) => atualizar(l.chave, "valor", e.target.value)}
              inputMode="decimal"
              className="campo w-28 py-2.5 text-right"
              placeholder="0,00"
              aria-label={`Valor do item ${n + 1}`}
            />
            {linhas.length > 1 && (
              <button type="button" onClick={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))} className="px-1 text-xl text-suave" aria-label="Remover item">
                ×
              </button>
            )}
          </div>
        ))}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => setLinhas((ls) => [...ls, { chave: Math.max(...ls.map((x) => x.chave)) + 1, descricao: "", valor: "" }])}
            className="text-sm font-semibold text-marca-escura"
          >
            + Adicionar item
          </button>
          <p className="text-sm">
            Total: <strong className="font-titulo text-lg">{formatarValor(total)}</strong>
          </p>
        </div>
      </fieldset>

        <Campo rotulo="Prazo de execução (dias)">
          <input name="prazo_dias" type="number" min={0} inputMode="numeric" defaultValue={prazo ?? ""} className="campo" placeholder="Ex.: 2" />
        </Campo>
        <Campo rotulo="Válido até">
          <input name="validade" type="date" required defaultValue={validadePadrao} className="campo" />
        </Campo>

      <Campo rotulo="Observações" dica="Opcional. Condições de pagamento, o que está incluso, garantia…">
        <textarea name="observacoes" rows={3} defaultValue={observacoes ?? ""} className="campo" />
      </Campo>

      <BotaoEnviar pendente="Enviando…">{novo ? "Enviar orçamento ao cliente" : id && itens.length ? "Atualizar orçamento" : "Enviar resposta ao cliente"}</BotaoEnviar>
    </form>
  );
}
