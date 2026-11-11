"use client";

import { useActionState, useState } from "react";
import type { EstadoForm } from "@/app/(auth)/actions";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { Aviso, Campo } from "@/components/ui";
import { formatarData, formatarValor } from "@/lib/garagem";
import { arred } from "@/lib/gestao";
import { gerarFatura } from "./actions";

type OS = { id: string; numero: number; data: string; placa: string | null; veiculo_nome: string | null; servicos: string; total: number };

export function GerarFatura({ clienteId, nome, os, vencimentoPadrao }: { clienteId: string; nome: string; os: OS[]; vencimentoPadrao: string }) {
  const [estado, acao] = useActionState<EstadoForm, FormData>(gerarFatura, {});
  const [marcadas, setMarcadas] = useState<Set<string>>(() => new Set(os.map((o) => o.id)));
  const total = arred(os.filter((o) => marcadas.has(o.id)).reduce((t, o) => t + o.total, 0));
  const alternar = (id: string) =>
    setMarcadas((m) => {
      const n = new Set(m);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  return (
    <form action={acao} className="space-y-3">
      <input type="hidden" name="cliente_id" value={clienteId} />
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{nome}</h3>
        <span className="text-sm text-suave">{os.length} OS</span>
      </div>
      <ul className="divide-y divide-borda overflow-hidden rounded-xl border border-borda">
        {os.map((o) => (
          <li key={o.id}>
            <label className="flex cursor-pointer items-start gap-3 px-4 py-2.5 text-sm hover:bg-fundo">
              <input type="checkbox" name="os" value={o.id} checked={marcadas.has(o.id)} onChange={() => alternar(o.id)} className="mt-1 h-4 w-4 accent-marca" />
              <span className="min-w-0 flex-1">
                <span className="font-medium">#{o.numero} · {o.placa} {o.veiculo_nome}</span>
                <span className="block truncate text-xs text-suave">{formatarData(o.data)} · {o.servicos}</span>
              </span>
              <span className="tabular-nums">{formatarValor(o.total)}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-3">
        <Campo rotulo="Vencimento">
          <input type="date" name="vencimento" defaultValue={vencimentoPadrao} required className="campo" />
        </Campo>
        <p className="flex-1 text-right text-lg font-bold tabular-nums">{formatarValor(total)}</p>
      </div>
      <BotaoEnviar pendente="Gerando…" className={`botao-primario w-full ${marcadas.size === 0 ? "pointer-events-none opacity-50" : ""}`}>
        Gerar fatura ({marcadas.size} OS)
      </BotaoEnviar>
    </form>
  );
}
