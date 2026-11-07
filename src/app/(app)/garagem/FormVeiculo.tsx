"use client";

import { useActionState } from "react";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { EnviarFotos } from "@/components/EnviarFotos";
import { Aviso, Campo } from "@/components/ui";
import type { EstadoForm } from "@/app/(auth)/actions";
import type { Veiculo } from "@/lib/garagem";
import { salvarVeiculo } from "./actions";

export function FormVeiculo({
  veiculo,
  donoId,
  fotoUrl,
}: {
  veiculo?: Veiculo;
  /** Dono do veículo (a empresa pode cadastrar para um cliente) */
  donoId: string;
  fotoUrl?: string;
}) {
  const [estado, acao] = useActionState<EstadoForm, FormData>(salvarVeiculo, {});
  const anoAtual = new Date().getFullYear();

  return (
    <form action={acao} className="space-y-4">
      {veiculo && <input type="hidden" name="id" value={veiculo.id} />}
      <input type="hidden" name="dono_id" value={donoId} />
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}

      <Campo rotulo="Foto do veículo" dica="Opcional.">
        <EnviarFotos
          pasta={`${donoId}/veiculos`}
          maximo={1}
          rotulo="Adicionar foto"
          iniciais={veiculo?.foto && fotoUrl ? [{ caminho: veiculo.foto, url: fotoUrl }] : []}
        />
      </Campo>

      <Campo rotulo="Placa">
        <input
          name="placa"
          required
          defaultValue={veiculo?.placa}
          maxLength={8}
          autoCapitalize="characters"
          autoComplete="off"
          className="campo font-mono uppercase tracking-wider"
          placeholder="ABC1D23"
        />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Marca">
          <input name="marca" required defaultValue={veiculo?.marca} className="campo" placeholder="Ex.: Honda" />
        </Campo>
        <Campo rotulo="Modelo">
          <input name="modelo" required defaultValue={veiculo?.modelo} className="campo" placeholder="Ex.: Civic EXL" />
        </Campo>
        <Campo rotulo="Ano">
          <input name="ano" type="number" inputMode="numeric" min={1950} max={anoAtual + 1} defaultValue={veiculo?.ano ?? ""} className="campo" placeholder={String(anoAtual)} />
        </Campo>
        <Campo rotulo="Cor">
          <input name="cor" defaultValue={veiculo?.cor ?? ""} className="campo" placeholder="Ex.: Prata" />
        </Campo>
      </div>
      <Campo rotulo="Quilometragem atual">
        <input name="km_atual" inputMode="numeric" defaultValue={veiculo?.km_atual ?? ""} className="campo" placeholder="Ex.: 45000" />
      </Campo>
      <Campo rotulo="Apelido" dica="Opcional. Ex.: “Carro da família”.">
        <input name="apelido" defaultValue={veiculo?.apelido ?? ""} className="campo" />
      </Campo>

      <BotaoEnviar pendente="Salvando…">{veiculo ? "Salvar alterações" : "Cadastrar veículo"}</BotaoEnviar>
    </form>
  );
}
