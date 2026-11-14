"use client";

import { useActionState, useState } from "react";
import type { EstadoForm } from "@/app/(auth)/actions";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { Aviso, Campo } from "@/components/ui";
import type { CategoriaFinanceira } from "@/lib/gestao";
import { salvarCategoria } from "./actions";
import { GRUPOS_DRE } from "./grupos";

/** Nova categoria ou edição de uma categoria do financeiro. */
export function FormCategoria({ categoria, tipoInicial = "saida" }: { categoria?: CategoriaFinanceira; tipoInicial?: "entrada" | "saida" }) {
  const [estado, acao] = useActionState<EstadoForm, FormData>(salvarCategoria, {});
  const [tipo, setTipo] = useState<"entrada" | "saida">(categoria?.tipo ?? tipoInicial);
  const sistema = Boolean(categoria?.sistema);
  return (
    <form action={acao} className="ficha">
      {categoria && <input type="hidden" name="id" value={categoria.id} />}
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      <Campo rotulo="Nome">
        <input name="nome" defaultValue={categoria?.nome} required maxLength={60} className="campo" placeholder="Ex.: Peças para revenda" />
      </Campo>
      <Campo rotulo="Tipo" obrigatorio>
        <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as "entrada" | "saida")} disabled={sistema} className="campo">
          <option value="entrada">Entrada</option>
          <option value="saida">Saída</option>
        </select>
      </Campo>
      {sistema && <input type="hidden" name="tipo" value={tipo} />}
      <Campo rotulo="No resultado (DRE)" obrigatorio dica="Define em qual linha do Resultado (DRE) os valores desta categoria aparecem.">
        <select name="dre" key={tipo} defaultValue={categoria?.tipo === tipo ? categoria.dre : GRUPOS_DRE[tipo][0].valor} disabled={sistema} className="campo">
          {GRUPOS_DRE[tipo].map((g) => <option key={g.valor} value={g.valor}>{g.rotulo}</option>)}
        </select>
      </Campo>
      {sistema && <input type="hidden" name="dre" value={categoria?.dre} />}
      {categoria && !sistema && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="ativa" defaultChecked={categoria.ativa} className="h-4 w-4 accent-marca" /> Categoria ativa (aparece ao lançar)
        </label>
      )}
      {sistema && <p className="text-xs text-suave">Categoria usada automaticamente pelo sistema: dá para mudar só o nome.</p>}
      <BotaoEnviar pendente="Salvando…" className="botao-primario w-full text-sm">{categoria ? "Salvar categoria" : "Criar categoria"}</BotaoEnviar>
    </form>
  );
}
