"use client";

import { useActionState, useState } from "react";
import type { EstadoForm } from "@/app/(auth)/actions";
import { salvarDocumento } from "@/app/(app)/garagem/documentos-actions";
import { SeloSituacao } from "@/components/garagem";
import { Campo } from "@/components/ui";
import { TIPOS_DOCUMENTO, formatarData, situacaoDocumento, type Documento, type TipoDocumento } from "@/lib/garagem";

export function FormDocumento({
  tipo,
  veiculoId,
  atual,
  novoOutro = false,
}: {
  tipo: TipoDocumento;
  veiculoId?: string;
  atual: Documento | null;
  novoOutro?: boolean;
}) {
  const info = TIPOS_DOCUMENTO[tipo];
  const [aberto, setAberto] = useState(false);
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(async (e, f) => {
    const r = await salvarDocumento(e, f);
    if (r.sucesso) setAberto(false);
    return r;
  }, {});
  const s = atual ? situacaoDocumento(atual.vencimento) : null;
  const titulo = novoOutro ? "+ Outro vencimento" : tipo === "outro" ? atual?.descricao ?? info.rotulo : info.rotulo;

  return (
    <div className="rounded-2xl border border-borda bg-white">
      <button type="button" onClick={() => setAberto((a) => !a)} aria-expanded={aberto} className="flex w-full items-center justify-between gap-3 p-4 text-left">
        <div className="min-w-0">
          <p className={`font-medium ${novoOutro ? "text-marca-escura" : ""}`}>
            {!novoOutro && <span aria-hidden="true">{info.icone} </span>}
            {titulo}
          </p>
          {atual ? (
            <p className="text-sm text-suave">
              Vence em {formatarData(atual.vencimento)}
              {tipo === "seguro" && atual.descricao && ` · ${atual.descricao}`}
            </p>
          ) : (
            !novoOutro && <p className="text-sm text-suave">Não informado</p>
          )}
        </div>
        {s ? <SeloSituacao situacao={s.situacao} /> : !novoOutro && <span className="text-sm font-semibold text-marca-escura">Informar</span>}
      </button>
      {estado.sucesso && !aberto && <p className="px-4 pb-3 text-sm text-sucesso">{estado.sucesso}</p>}

      {aberto && (
        <form action={acao} className="space-y-3 border-t border-borda p-4">
          <input type="hidden" name="tipo" value={tipo} />
          {veiculoId && <input type="hidden" name="veiculo_id" value={veiculoId} />}
          {atual && <input type="hidden" name="id" value={atual.id} />}
          {(tipo === "outro" || tipo === "seguro" || tipo === "cnh") && (
            <Campo rotulo={tipo === "seguro" ? "Seguradora (opcional)" : tipo === "cnh" ? "Categoria (opcional)" : "Qual vencimento?"}>
              <input
                name="descricao"
                defaultValue={atual?.descricao ?? ""}
                required={tipo === "outro"}
                className="campo"
                placeholder={tipo === "seguro" ? "Ex.: Porto Seguro" : tipo === "cnh" ? "Ex.: AB" : "Ex.: Vistoria, garantia da pintura"}
              />
            </Campo>
          )}
          <Campo rotulo="Data de vencimento" dica={info.dica || undefined}>
            <input name="vencimento" type="date" required defaultValue={atual?.vencimento ?? ""} className="campo" />
          </Campo>
          {estado.erro && <p className="text-sm text-perigo">{estado.erro}</p>}
          <div className="flex gap-2">
            <button type="submit" name="acao" value="salvar" disabled={pendente} className="botao-escuro flex-1 py-2.5 text-sm">
              {pendente ? "Salvando…" : "Salvar"}
            </button>
            {atual && (
              <button type="submit" name="acao" value="remover" disabled={pendente} className="botao px-4 py-2.5 text-sm text-perigo hover:bg-perigo-claro">
                Remover
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
