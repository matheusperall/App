"use client";

import { useActionState, useState } from "react";
import type { EstadoForm } from "@/app/(auth)/actions";
import { SeloSituacao } from "@/components/garagem";
import { Campo } from "@/components/ui";
import {
  TIPOS_MANUTENCAO,
  calcularProxima,
  formatarData,
  formatarKm,
  situacaoManutencao,
  type Manutencao,
  type TipoManutencao,
} from "@/lib/garagem";
import { salvarManutencao } from "../../actions";

export function FormManutencao({
  veiculoId,
  tipo,
  kmAtual,
  atual,
}: {
  veiculoId: string;
  tipo: TipoManutencao;
  kmAtual: number;
  atual: Manutencao | null;
}) {
  const padrao = TIPOS_MANUTENCAO[tipo];
  const [aberto, setAberto] = useState(false);
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(async (e, f) => {
    const r = await salvarManutencao(e, f);
    if (r.sucesso) setAberto(false);
    return r;
  }, {});

  const [ultimaData, setUltimaData] = useState(atual?.ultima_data ?? "");
  const [ultimoKm, setUltimoKm] = useState(atual?.ultimo_km != null ? String(atual.ultimo_km) : "");
  const [meses, setMeses] = useState(String(atual?.intervalo_meses ?? padrao.meses ?? ""));
  const [intervaloKm, setIntervaloKm] = useState(String(atual?.intervalo_km ?? padrao.km ?? ""));
  const sugestao = calcularProxima(
    ultimaData || null,
    ultimoKm ? Number(ultimoKm.replace(/\D/g, "")) : null,
    meses ? Number(meses) : null,
    intervaloKm ? Number(intervaloKm) : null,
  );

  const situacao = atual ? situacaoManutencao(atual, kmAtual).situacao : null;

  return (
    <div className="rounded-2xl border border-borda bg-white">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
        aria-expanded={aberto}
      >
        <div className="min-w-0">
          <p className="font-medium">{padrao.rotulo}</p>
          <p className="text-sm text-suave">
            {atual
              ? `Próxima: ${[atual.proxima_data && formatarData(atual.proxima_data), atual.proximo_km != null && formatarKm(atual.proximo_km)].filter(Boolean).join(" ou ") || "—"}`
              : `Sugestão: a cada ${[padrao.meses && `${padrao.meses} meses`, padrao.km && `${padrao.km.toLocaleString("pt-BR")} km`].filter(Boolean).join(" ou ")}`}
          </p>
          {atual?.definido_pela_empresa && <p className="text-xs font-medium text-marca-escura">Definido pela oficina</p>}
        </div>
        {situacao ? <SeloSituacao situacao={situacao} /> : <span className="text-sm font-semibold text-marca-escura">Ativar</span>}
      </button>

      {estado.sucesso && !aberto && <p className="px-4 pb-3 text-sm text-sucesso">{estado.sucesso}</p>}

      {aberto && (
        <form action={acao} className="space-y-3 border-t border-borda p-4">
          <input type="hidden" name="veiculo_id" value={veiculoId} />
          <input type="hidden" name="tipo" value={tipo} />
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Última vez (data)">
              <input name="ultima_data" type="date" value={ultimaData} onChange={(e) => setUltimaData(e.target.value)} className="campo" />
            </Campo>
            <Campo rotulo="Última vez (km)">
              <input name="ultimo_km" inputMode="numeric" value={ultimoKm} onChange={(e) => setUltimoKm(e.target.value)} className="campo" />
            </Campo>
            <Campo rotulo="A cada (meses)">
              <input name="intervalo_meses" inputMode="numeric" value={meses} onChange={(e) => setMeses(e.target.value)} className="campo" />
            </Campo>
            <Campo rotulo="Ou a cada (km)">
              <input name="intervalo_km" inputMode="numeric" value={intervaloKm} onChange={(e) => setIntervaloKm(e.target.value)} className="campo" />
            </Campo>
          </div>
          <p className="rounded-lg bg-fundo px-3 py-2 text-sm text-suave">
            Próxima:{" "}
            <strong className="text-texto">
              {[sugestao.proxima_data && formatarData(sugestao.proxima_data), sugestao.proximo_km != null && formatarKm(sugestao.proximo_km)]
                .filter(Boolean)
                .join(" ou ") || "informe a última data e/ou km"}
            </strong>
          </p>
          {estado.erro && <p className="text-sm text-perigo">{estado.erro}</p>}
          <div className="flex gap-2">
            <button type="submit" name="acao" value="salvar" disabled={pendente} className="botao-escuro flex-1 py-2.5 text-sm">
              {pendente ? "Salvando…" : "Salvar lembrete"}
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
