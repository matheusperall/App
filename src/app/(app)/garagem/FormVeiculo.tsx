"use client";

import { useActionState, useState } from "react";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { EnviarFotos } from "@/components/EnviarFotos";
import { ResumoFipe, SeletorFipe, type Escolha } from "@/components/SeletorFipe";
import { Aviso, Campo } from "@/components/ui";
import type { EstadoForm } from "@/app/(auth)/actions";
import { TIPOS_VEICULO, type DetalheFipe, type TipoVeiculo } from "@/lib/fipe";
import type { Veiculo } from "@/lib/garagem";
import { salvarVeiculo } from "./actions";

type Modo = "fipe" | "resumo" | "manual";

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

  // Veículo já escolhido pela FIPE (edição) ou nenhum ainda
  const inicial: Escolha | null =
    veiculo?.codigo_fipe
      ? {
          tipo: veiculo.tipo ?? "carro",
          marcaCod: veiculo.fipe_marca_cod ?? "",
          modeloCod: veiculo.fipe_modelo_cod ?? "",
          anoCod: veiculo.fipe_ano_cod ?? "",
          detalhe: {
            marca: veiculo.marca,
            modelo: veiculo.modelo,
            ano: veiculo.ano ?? anoAtual,
            combustivel: veiculo.combustivel ?? "",
            codigoFipe: veiculo.codigo_fipe,
            valor: veiculo.valor_fipe ?? null,
            referencia: veiculo.fipe_referencia ?? "",
          },
        }
      : null;

  const [escolha, setEscolha] = useState<Escolha | null>(inicial);
  const [modo, setModo] = useState<Modo>(inicial ? "resumo" : veiculo ? "manual" : "fipe");
  const [tipoManual, setTipoManual] = useState<TipoVeiculo>(veiculo?.tipo ?? "carro");
  const d: DetalheFipe | undefined = escolha?.detalhe;

  return (
    <form action={acao} className="space-y-4">
      {veiculo && <input type="hidden" name="id" value={veiculo.id} />}
      <input type="hidden" name="dono_id" value={donoId} />
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}

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

      {/* Marca, modelo e ano */}
      <fieldset className="space-y-3">
        <legend className="mb-1.5 text-sm font-medium">Veículo</legend>

        {modo === "fipe" && (
          <>
            <SeletorFipe
              anoAtual={anoAtual}
              aoConcluir={(e) => {
                setEscolha(e);
                setModo("resumo");
              }}
              aoFalhar={() => setModo("manual")}
            />
            <button type="button" onClick={() => setModo("manual")} className="text-sm font-medium text-suave underline">
              Não encontrei meu veículo — preencher manualmente
            </button>
          </>
        )}

        {modo === "resumo" && d && escolha && (
          <>
            <ResumoFipe d={d} aoAlterar={() => setModo("fipe")} />
            <input type="hidden" name="tipo" value={escolha.tipo} />
            <input type="hidden" name="marca" value={d.marca} />
            <input type="hidden" name="modelo" value={d.modelo} />
            <input type="hidden" name="ano" value={d.ano} />
            <input type="hidden" name="combustivel" value={d.combustivel} />
            <input type="hidden" name="codigo_fipe" value={d.codigoFipe} />
            <input type="hidden" name="valor_fipe" value={d.valor ?? ""} />
            <input type="hidden" name="fipe_referencia" value={d.referencia} />
            <input type="hidden" name="fipe_marca_cod" value={escolha.marcaCod} />
            <input type="hidden" name="fipe_modelo_cod" value={escolha.modeloCod} />
            <input type="hidden" name="fipe_ano_cod" value={escolha.anoCod} />
          </>
        )}

        {modo === "manual" && (
          <>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tipo de veículo">
              {(Object.keys(TIPOS_VEICULO) as TipoVeiculo[]).map((t) => (
                <label
                  key={t}
                  className={`cursor-pointer rounded-xl border px-2 py-2.5 text-center text-sm transition ${
                    tipoManual === t ? "border-marca bg-marca-clara font-semibold text-marca-escura" : "border-borda bg-white"
                  }`}
                >
                  <input type="radio" name="tipo" value={t} checked={tipoManual === t} onChange={() => setTipoManual(t)} className="sr-only" />
                  <span aria-hidden="true">{TIPOS_VEICULO[t].icone}</span> {TIPOS_VEICULO[t].rotulo}
                </label>
              ))}
            </div>
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
              <Campo rotulo="Combustível">
                <select name="combustivel" defaultValue={veiculo?.combustivel ?? ""} className="campo">
                  <option value="">—</option>
                  {["Flex", "Gasolina", "Álcool", "Diesel", "Híbrido", "Elétrico", "GNV"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Campo>
            </div>
            <button type="button" onClick={() => setModo(escolha ? "resumo" : "fipe")} className="text-sm font-medium text-marca-escura underline">
              Escolher pela tabela FIPE
            </button>
          </>
        )}
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Cor">
          <input name="cor" defaultValue={veiculo?.cor ?? ""} className="campo" placeholder="Ex.: Prata" />
        </Campo>
        <Campo rotulo="Quilometragem atual">
          <input name="km_atual" inputMode="numeric" defaultValue={veiculo?.km_atual ?? ""} className="campo" placeholder="Ex.: 45000" />
        </Campo>
      </div>
      <Campo rotulo="Apelido" dica="Opcional. Ex.: “Carro da família”.">
        <input name="apelido" defaultValue={veiculo?.apelido ?? ""} className="campo" />
      </Campo>

      <Campo rotulo="Foto do veículo" dica="Opcional.">
        <EnviarFotos
          pasta={`${donoId}/veiculos`}
          maximo={1}
          rotulo="Adicionar foto"
          iniciais={veiculo?.foto && fotoUrl ? [{ caminho: veiculo.foto, url: fotoUrl }] : []}
        />
      </Campo>

      <BotaoEnviar pendente="Salvando…">{veiculo ? "Salvar alterações" : "Cadastrar veículo"}</BotaoEnviar>
    </form>
  );
}
