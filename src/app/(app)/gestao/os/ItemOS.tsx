import Link from "next/link";
import { Dinheiro, Selo, SeloStatus } from "@/components/gestao";
import { formatarData } from "@/lib/garagem";
import type { OrdemServico } from "@/lib/gestao";

export function ItemOS({ os, comData = false }: { os: OrdemServico; comData?: boolean }) {
  const situacaoPagamento = os.status === "cancelada" ? null : os.pago ? (
    <Selo classe="bg-sucesso-claro text-sucesso">Pago</Selo>
  ) : (os.valor_pago ?? 0) > 0 ? (
    <Selo classe="bg-alerta-claro text-[#8a5a00]">Parcial</Selo>
  ) : os.cliente?.lojista ? (
    <Selo classe="bg-marca-clara text-marca-escura">{os.fatura_id ? "Na fatura" : "Lojista"}</Selo>
  ) : os.status === "pronta" || os.status === "entregue" ? (
    <Selo classe="bg-alerta-claro text-[#8a5a00]">A receber</Selo>
  ) : null;
  return (
    <li>
      <Link href={`/gestao/os/${os.id}`} className="flex items-start justify-between gap-3 px-5 py-4 transition hover:bg-fundo">
        <div className="min-w-0">
          <p className="font-medium">
            <span className="text-suave">#{os.numero}</span> {os.cliente?.nome ?? "Cliente"}
          </p>
          <p className="truncate text-sm text-suave">
            {[os.placa, os.veiculo_nome].filter(Boolean).join(" · ")}
            {os.itens.length > 0 && ` — ${os.itens.map((i) => i.nome).join(", ")}`}
          </p>
          {comData && <p className="text-xs text-suave">{formatarData(os.data)}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Dinheiro valor={os.total} className="font-semibold" />
          <SeloStatus status={os.status} />
          {situacaoPagamento}
        </div>
      </Link>
    </li>
  );
}
