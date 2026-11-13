"use client";

import { useActionState, useState } from "react";
import type { EstadoForm } from "@/app/(auth)/actions";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { Aviso, Campo } from "@/components/ui";
import { CampoEscolha, ListaBusca, type OpcaoBusca } from "@/components/ListaBusca";
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
  catalogo = [],
  jaEnviado = false,
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
  /** Serviços cadastrados, para montar os itens com o preço do catálogo */
  catalogo?: { id: string; nome: string; preco: number }[];
  /** O orçamento já foi enviado ao cliente antes (aí dá para só salvar alterações, sem avisar de novo) */
  jaEnviado?: boolean;
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
  const precoFmt = (v: number) => v.toFixed(2).replace(".", ",");
  /** Coloca um serviço do catálogo: preenche a primeira linha vazia ou cria uma nova */
  function adicionarDoCatalogo(idServico: string) {
    const sv = catalogo.find((c) => c.id === idServico);
    if (!sv) return;
    setLinhas((ls) => {
      const vazia = ls.find((l) => !l.descricao.trim() && !l.valor.trim());
      if (vazia) return ls.map((l) => (l === vazia ? { ...l, descricao: sv.nome, valor: precoFmt(sv.preco) } : l));
      return [...ls, { chave: Math.max(0, ...ls.map((x) => x.chave)) + 1, descricao: sv.nome, valor: precoFmt(sv.preco) }];
    });
  }
  /** Ao escrever o nome exato de um serviço cadastrado, já traz o preço (se o valor estiver vazio) */
  function mudarDescricao(chave: number, v: string) {
    const sv = catalogo.find((c) => c.nome.toLowerCase() === v.trim().toLowerCase());
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, descricao: v, valor: sv && !l.valor.trim() ? precoFmt(sv.preco) : l.valor } : l)));
  }
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
        {catalogo.length > 0 && (
          <ListaBusca
            opcoes={catalogo.map((c) => ({ id: c.id, titulo: c.nome, extra: <span className="tabular-nums text-suave">{formatarValor(c.preco)}</span> }))}
            aoEscolher={adicionarDoCatalogo}
            placeholder="Buscar serviço cadastrado (ex.: polimento)"
            rotuloAcessivel="Buscar serviço cadastrado para o orçamento"
            vazio="Nenhum serviço com esse nome. Escreva o item à mão abaixo."
          />
        )}
        {linhas.map((l, n) => (
          <div key={l.chave} className="flex gap-2">
            <input
              name="item_descricao"
              value={l.descricao}
              onChange={(e) => mudarDescricao(l.chave, e.target.value)}
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

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        {jaEnviado && (
          <BotaoEnviar pendente="Salvando…" className="botao-contorno sm:min-w-56" name="enviar" value="nao">
            Salvar alterações
          </BotaoEnviar>
        )}
        <BotaoEnviar pendente="Salvando…" className="botao-primario sm:min-w-64" name="enviar" value="sim">
          Salvar e enviar ao cliente
        </BotaoEnviar>
      </div>
      <p className="-mt-2 text-right text-xs text-suave">
        Ao enviar, o cliente é avisado no app e a mensagem de WhatsApp fica pronta para você mandar.
        {jaEnviado ? " “Salvar alterações” só guarda, sem avisar de novo." : ""}
      </p>
    </form>
  );
}
