"use client";

import { useActionState, useState } from "react";
import type { EstadoForm } from "@/app/(auth)/actions";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { Aviso, Campo } from "@/components/ui";
import { PERIODOS, formatarDiaSemana, type Periodo } from "@/lib/agenda";
import { CATEGORIAS, somarDias, type Categoria } from "@/lib/garagem";
import { agendarLavagem, pedirAgendamento } from "../actions";

type Props = {
  veiculos: { id: string; nome: string }[];
  veiculoInicial: string;
  dias: { dia: string; horarios: string[] }[];
  hoje: string;
  servicoInicial: string;
  categoriaInicial: string;
  orcamentoId?: string;
  apontamentoId?: string;
};

function SeletorVeiculo({ veiculos, valor, mudar, travado }: { veiculos: Props["veiculos"]; valor: string; mudar: (v: string) => void; travado: boolean }) {
  if (veiculos.length === 1 || travado) {
    return (
      <>
        <input type="hidden" name="veiculo_id" value={valor} />
        <p className="text-sm text-suave">Veículo: <strong className="text-texto">{veiculos.find((v) => v.id === valor)?.nome}</strong></p>
      </>
    );
  }
  return (
    <Campo rotulo="Veículo">
      <select name="veiculo_id" value={valor} onChange={(e) => mudar(e.target.value)} className="campo">
        {veiculos.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
      </select>
    </Campo>
  );
}

export function FormAgendar(p: Props) {
  const vemDeOrigem = Boolean(p.orcamentoId || p.apontamentoId);
  const [tipo, setTipo] = useState<"lavagem" | "servico">(vemDeOrigem ? "servico" : "lavagem");
  const [veiculoId, setVeiculoId] = useState(p.veiculoInicial);

  return (
    <div className="space-y-4">
      {!vemDeOrigem && (
        <div className="grid grid-cols-2 gap-2" role="tablist">
          {([
            ["lavagem", "🧽 Lavagem", "Escolha um horário livre"],
            ["servico", "🔧 Outro serviço", "Sugira dias e a gente confirma"],
          ] as const).map(([k, rotulo, dica]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tipo === k}
              onClick={() => setTipo(k)}
              className={`rounded-xl border p-3 text-left transition ${tipo === k ? "border-marca bg-marca-clara" : "border-borda bg-white"}`}
            >
              <span className={`block font-semibold ${tipo === k ? "text-marca-escura" : ""}`}>{rotulo}</span>
              <span className="text-xs text-suave">{dica}</span>
            </button>
          ))}
        </div>
      )}
      {tipo === "lavagem" ? (
        <FormLavagem {...p} veiculoId={veiculoId} setVeiculoId={setVeiculoId} />
      ) : (
        <FormServico {...p} veiculoId={veiculoId} setVeiculoId={setVeiculoId} travado={vemDeOrigem} />
      )}
    </div>
  );
}

function FormLavagem(p: Props & { veiculoId: string; setVeiculoId: (v: string) => void }) {
  const [estado, acao] = useActionState<EstadoForm, FormData>(agendarLavagem, {});
  const [dia, setDia] = useState(p.dias[0]?.dia ?? "");
  const [hora, setHora] = useState("");
  const horarios = p.dias.find((d) => d.dia === dia)?.horarios ?? [];

  if (p.dias.length === 0) {
    return <Aviso>Não há horários livres para lavagem nos próximos dias. Tente “Outro serviço” para sugerir uma data.</Aviso>;
  }

  return (
    <form action={acao} className="space-y-4">
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      <SeletorVeiculo veiculos={p.veiculos} valor={p.veiculoId} mudar={p.setVeiculoId} travado={false} />
      <input type="hidden" name="dia" value={dia} />
      <input type="hidden" name="hora" value={hora} />

      <div className="space-y-1.5">
        <span className="text-sm font-medium">Dia</span>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {p.dias.map((d) => (
            <button
              key={d.dia}
              type="button"
              onClick={() => {
                setDia(d.dia);
                setHora("");
              }}
              className={`shrink-0 rounded-xl border px-3 py-2 text-center text-sm transition ${
                dia === d.dia ? "border-marca bg-marca text-white" : "border-borda bg-white"
              }`}
            >
              {formatarDiaSemana(d.dia)}
              <span className={`block text-[11px] ${dia === d.dia ? "text-white/80" : "text-suave"}`}>{d.horarios.length} livres</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-sm font-medium">Horário</span>
        <div className="grid grid-cols-4 gap-2">
          {horarios.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setHora(h)}
              className={`rounded-xl border py-2.5 text-sm font-medium transition ${hora === h ? "border-marca bg-marca text-white" : "border-borda bg-white hover:border-marca"}`}
            >
              {h}
            </button>
          ))}
        </div>
      </div>

      <Campo rotulo="Observações" dica="Opcional.">
        <input name="observacoes" className="campo" placeholder="Ex.: carro com bastante barro" />
      </Campo>

      {hora ? (
        <BotaoEnviar pendente="Agendando…">Confirmar lavagem · {formatarDiaSemana(dia)} às {hora}</BotaoEnviar>
      ) : (
        <button type="button" disabled className="botao-primario w-full">Escolha um horário</button>
      )}
    </form>
  );
}

function FormServico(p: Props & { veiculoId: string; setVeiculoId: (v: string) => void; travado: boolean }) {
  const [estado, acao] = useActionState<EstadoForm, FormData>(pedirAgendamento, {});
  const [prefs, setPrefs] = useState<{ data: string; periodo: Periodo }[]>([{ data: somarDias(p.hoje, 1), periodo: "manha" }]);
  const [categoria, setCategoria] = useState<Categoria>((p.categoriaInicial in CATEGORIAS ? p.categoriaInicial : "outros") as Categoria);

  return (
    <form action={acao} className="space-y-4">
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      {p.orcamentoId && <input type="hidden" name="orcamento_id" value={p.orcamentoId} />}
      {p.apontamentoId && <input type="hidden" name="apontamento_id" value={p.apontamentoId} />}
      <SeletorVeiculo veiculos={p.veiculos} valor={p.veiculoId} mudar={p.setVeiculoId} travado={p.travado} />

      <Campo rotulo="Serviço">
        <input name="servico" required defaultValue={p.servicoInicial} className="campo" placeholder="Ex.: Polimento e vitrificação" />
      </Campo>
      <Campo rotulo="Tipo">
        <select name="categoria" value={categoria} onChange={(e) => setCategoria(e.target.value as Categoria)} className="campo">
          {Object.entries(CATEGORIAS).map(([k, v]) => <option key={k} value={k}>{v.icone} {v.rotulo}</option>)}
        </select>
      </Campo>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">Quando você prefere? (até 3 opções)</legend>
        {prefs.map((pr, i) => (
          <div key={i} className="flex gap-2">
            <input
              name="pref_data"
              type="date"
              min={p.hoje}
              required
              value={pr.data}
              onChange={(e) => setPrefs((l) => l.map((x, n) => (n === i ? { ...x, data: e.target.value } : x)))}
              className="campo min-w-0 flex-1 py-2.5"
              aria-label={`Data da opção ${i + 1}`}
            />
            <select
              name="pref_periodo"
              value={pr.periodo}
              onChange={(e) => setPrefs((l) => l.map((x, n) => (n === i ? { ...x, periodo: e.target.value as Periodo } : x)))}
              className="campo w-40 py-2.5"
              aria-label={`Período da opção ${i + 1}`}
            >
              {Object.entries(PERIODOS).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
            </select>
            {prefs.length > 1 && (
              <button type="button" onClick={() => setPrefs((l) => l.filter((_, n) => n !== i))} className="px-1 text-xl text-suave" aria-label="Remover opção">×</button>
            )}
          </div>
        ))}
        {prefs.length < 3 && (
          <button
            type="button"
            onClick={() => setPrefs((l) => [...l, { data: somarDias(l[l.length - 1].data, 1), periodo: "qualquer" }])}
            className="text-sm font-semibold text-marca-escura"
          >
            + Outra opção
          </button>
        )}
        <p className="text-xs text-suave">Atendemos de segunda a sexta, das 8h às 18h.</p>
      </fieldset>

      <Campo rotulo="Observações" dica="Opcional.">
        <textarea name="observacoes" rows={2} className="campo" placeholder="Ex.: preciso do carro de volta até sexta" />
      </Campo>

      <BotaoEnviar pendente="Enviando…">Enviar pedido de agendamento</BotaoEnviar>
    </form>
  );
}
