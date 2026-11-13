"use client";

import { useActionState, useState } from "react";
import type { EstadoForm } from "@/app/(auth)/actions";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { EnviarFotos } from "@/components/EnviarFotos";
import { Aviso, Campo } from "@/components/ui";
import {
  CATEGORIAS,
  TIPOS_MANUTENCAO,
  calcularProxima,
  ehTipoManutencao,
  formatarData,
  type Categoria,
} from "@/lib/garagem";
import { registrarServico } from "../../../actions";

export function FormServico({
  veiculoId,
  donoId,
  kmAtual,
  hoje,
  admin,
}: {
  veiculoId: string;
  donoId: string;
  kmAtual: number;
  hoje: string;
  admin: boolean;
}) {
  const [estado, acao] = useActionState<EstadoForm, FormData>(registrarServico, {});
  const [data, setData] = useState(hoje);
  const [km, setKm] = useState(kmAtual ? String(kmAtual) : "");
  const [categoria, setCategoria] = useState<Categoria>("estetica");
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState("");
  const [meses, setMeses] = useState("");
  const [intervaloKm, setIntervaloKm] = useState("");

  // Ao escolher uma manutenção, sugere título, categoria e intervalos comuns
  function escolherTipo(t: string) {
    setTipo(t);
    if (ehTipoManutencao(t)) {
      const padrao = TIPOS_MANUTENCAO[t];
      setMeses(String(padrao.meses));
      setIntervaloKm(padrao.km ? String(padrao.km) : "");
      setCategoria(padrao.categoria);
      if (!titulo) setTitulo(padrao.rotulo);
    }
  }

  const kmNum = km ? Number(km.replace(/\D/g, "")) : null;
  const sugestao = calcularProxima(data || null, kmNum, meses ? Number(meses) : null, intervaloKm ? Number(intervaloKm) : null);

  return (
    <form action={acao} className="ficha">
      <input type="hidden" name="veiculo_id" value={veiculoId} />
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}

      <Campo rotulo="Este serviço renova algum lembrete?" dica="Ex.: ao registrar uma troca de óleo, a próxima já fica agendada.">
        <select name="manutencao" value={tipo} onChange={(e) => escolherTipo(e.target.value)} className="campo">
          <option value="">Não</option>
          {Object.entries(TIPOS_MANUTENCAO).map(([k, v]) => (
            <option key={k} value={k}>{v.rotulo}</option>
          ))}
        </select>
      </Campo>

      <Campo rotulo="Serviço realizado">
        <input name="titulo" required value={titulo} onChange={(e) => setTitulo(e.target.value)} className="campo" placeholder="Ex.: Polimento técnico" />
      </Campo>

      <Campo rotulo="Categoria" largo>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Object.entries(CATEGORIAS).map(([k, v]) => (
            <label
              key={k}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition ${
                categoria === k ? "border-marca bg-marca-clara font-semibold text-marca-escura" : "border-borda bg-white"
              }`}
            >
              <input type="radio" name="categoria" value={k} checked={categoria === k} onChange={() => setCategoria(k as Categoria)} className="sr-only" />
              <span aria-hidden="true">{v.icone}</span> {v.rotulo}
            </label>
          ))}
        </div>
      </Campo>

        <Campo rotulo="Data">
          <input name="data" type="date" required max={hoje} value={data} onChange={(e) => setData(e.target.value)} className="campo" />
        </Campo>
        <Campo rotulo="Quilometragem">
          <input name="km" inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value)} className="campo" placeholder="Ex.: 45000" />
        </Campo>

      {tipo && (
        <fieldset className="space-y-3 rounded-xl border border-marca/30 bg-marca-clara/50 p-4">
          <legend className="px-1 text-sm font-semibold text-marca-escura">Próxima manutenção</legend>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="A cada (meses)">
              <input name="intervalo_meses" inputMode="numeric" value={meses} onChange={(e) => setMeses(e.target.value)} className="campo" />
            </Campo>
            <Campo rotulo="Ou a cada (km)">
              <input name="intervalo_km" inputMode="numeric" value={intervaloKm} onChange={(e) => setIntervaloKm(e.target.value)} className="campo" />
            </Campo>
            <Campo rotulo="Próxima data">
              <input name="proxima_data" type="date" key={`d-${sugestao.proxima_data}`} defaultValue={sugestao.proxima_data ?? ""} className="campo" />
            </Campo>
            <Campo rotulo="Próximo km">
              <input name="proximo_km" inputMode="numeric" key={`k-${sugestao.proximo_km}`} defaultValue={sugestao.proximo_km ?? ""} className="campo" />
            </Campo>
          </div>
          <p className="text-xs text-suave">
            Sugestão: {[sugestao.proxima_data && formatarData(sugestao.proxima_data), sugestao.proximo_km && `${sugestao.proximo_km.toLocaleString("pt-BR")} km`].filter(Boolean).join(" ou ") || "informe data e km"}
            {" "}— o que vier primeiro. Ajuste se necessário (ex.: tipo de óleo).
          </p>
        </fieldset>
      )}

      <Campo rotulo="Detalhes" dica="Opcional. Produtos usados, peças trocadas, observações.">
        <textarea name="descricao" rows={3} className="campo" />
      </Campo>

        <Campo rotulo="Valor (R$)" dica="Opcional.">
          <input name="valor" inputMode="decimal" className="campo" placeholder="0,00" />
        </Campo>
        {admin && (
          <Campo rotulo="Executado por">
            <select name="prestador" className="campo" defaultValue="proprio">
              <option value="proprio">Sempre Zero</option>
              <option value="terceirizado">Parceiro (terceirizado)</option>
            </select>
          </Campo>
        )}

      <Campo rotulo="Fotos" dica="Até 8 fotos (antes e depois, nota, peças)." largo>
        <EnviarFotos pasta={`${donoId}/${veiculoId}`} maximo={8} />
      </Campo>

      <BotaoEnviar pendente="Salvando…">Registrar serviço</BotaoEnviar>
    </form>
  );
}
