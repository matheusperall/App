"use client";

import { useState } from "react";
import { FormDocumento } from "@/components/FormDocumento";
import { SeloSituacao } from "@/components/garagem";
import type { CalendarioIpva, DataCalendario } from "@/lib/calendarios";
import { descreverPrazo, formatarData, situacaoDocumento, type Documento } from "@/lib/garagem";

const Previsao = () => (
  <span className="rounded-full bg-fundo px-2 py-0.5 text-[11px] font-semibold text-suave">previsão</span>
);

/** Licenciamento: vencimento pelo final da placa, com opção de informar outra data. */
export function CartaoLicenciamento({
  veiculoId,
  final,
  calendario,
  manual,
}: {
  veiculoId: string;
  final: number | null;
  calendario: (DataCalendario & { ano: number }) | null;
  manual: Documento | null;
}) {
  const [editar, setEditar] = useState(false);
  if (manual || editar || !calendario) {
    return (
      <div className="space-y-1">
        <FormDocumento tipo="licenciamento" veiculoId={veiculoId} atual={manual} />
        {calendario && (
          <p className="px-1 text-xs text-suave">
            Pelo calendário de SP (placa final {final}): até {formatarData(calendario.data)}.
            {manual ? " Para voltar a usar o calendário automático, remova a data acima." : ""}
          </p>
        )}
      </div>
    );
  }
  const { situacao, dias } = situacaoDocumento(calendario.data);
  return (
    <div className="space-y-2 rounded-2xl border border-borda bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">📄 Licenciamento (CRLV) {calendario.ano}</p>
          <p className="text-sm text-suave">
            Placa final <strong className="text-texto">{final}</strong> · vence até <strong className="text-texto">{formatarData(calendario.data)}</strong>
          </p>
          <p className="text-xs text-suave">{descreverPrazo(dias, null)}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <SeloSituacao situacao={situacao} />
          {calendario.previsao && <Previsao />}
        </div>
      </div>
      <p className="text-xs text-suave">
        Calculado pelo calendário do Detran-SP. Avisamos 30 dias, 7 dias e 1 dia antes.{" "}
        <button type="button" onClick={() => setEditar(true)} className="font-semibold text-marca-escura underline">
          Usar outra data
        </button>
      </p>
    </div>
  );
}

/** IPVA: cota única com desconto, sem desconto e parcelas, pelo final da placa. */
export function CartaoIpva({
  veiculoId,
  final,
  calendario,
  manual,
  hoje,
}: {
  veiculoId: string;
  final: number | null;
  calendario: CalendarioIpva | null;
  manual: Documento | null;
  hoje: string;
}) {
  const [editar, setEditar] = useState(false);
  if (manual || editar || !calendario) {
    return (
      <div className="space-y-1">
        <FormDocumento tipo="ipva" veiculoId={veiculoId} atual={manual} />
        {calendario && (
          <p className="px-1 text-xs text-suave">
            Pelo calendário de SP (placa final {final}): cota única em {formatarData(calendario.cotaUnicaDesconto)}.
            {manual ? " Para voltar a usar o calendário automático, remova a data acima." : ""}
          </p>
        )}
      </div>
    );
  }
  const linha = (rotulo: string, data: string, destaque = false) => {
    const passou = data < hoje;
    return (
      <li key={rotulo + data} className={`flex items-center justify-between gap-3 py-1.5 text-sm ${passou ? "text-suave line-through" : ""}`}>
        <span className={destaque ? "font-medium" : ""}>{rotulo}</span>
        <span className={`whitespace-nowrap ${destaque && !passou ? "font-semibold" : ""}`}>{formatarData(data)}</span>
      </li>
    );
  };
  const proxima = calendario.parcelas.find((p) => p >= hoje) ?? calendario.cotaUnicaDesconto;
  const { situacao } = situacaoDocumento(proxima);

  return (
    <div className="space-y-2 rounded-2xl border border-borda bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">💰 IPVA {calendario.ano}</p>
          <p className="text-sm text-suave">Placa final <strong className="text-texto">{final}</strong> · calendário da Sefaz-SP</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <SeloSituacao situacao={situacao} />
          {calendario.previsao && <Previsao />}
        </div>
      </div>

      <div className="rounded-xl bg-fundo px-3 py-2">
        <p className="text-xs font-semibold tracking-wide text-suave uppercase">À vista</p>
        <ul>
          {linha(`Cota única${calendario.desconto ? ` com ${calendario.desconto}% de desconto` : " com desconto"}`, calendario.cotaUnicaDesconto, true)}
          {linha("Cota única sem desconto", calendario.cotaUnicaSemDesconto)}
        </ul>
      </div>
      <div className="rounded-xl bg-fundo px-3 py-2">
        <p className="text-xs font-semibold tracking-wide text-suave uppercase">Parcelado (até {calendario.parcelas.length}x, sem desconto)</p>
        <ul>{calendario.parcelas.map((p, i) => linha(`${i + 1}ª parcela`, p))}</ul>
      </div>

      <p className="text-xs text-suave">
        {calendario.previsao
          ? `O governo ainda não divulgou o calendário de ${calendario.ano}: datas estimadas pelo calendário do ano anterior. Atualizamos assim que sair o oficial.`
          : "As datas de fevereiro a maio podem variar alguns dias; confira no site da Sefaz-SP."}{" "}
        O número de parcelas depende do valor do imposto.{" "}
        <button type="button" onClick={() => setEditar(true)} className="font-semibold text-marca-escura underline">
          Usar outra data
        </button>
      </p>
    </div>
  );
}
