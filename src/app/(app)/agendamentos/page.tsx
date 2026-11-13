import type { Metadata } from "next";
import Link from "next/link";
import { MenuGestao } from "@/components/gestao/MenuGestao";
import { ItemAgendamento } from "@/components/agendamento";
import { Aviso, Cartao } from "@/components/ui";
import { Bloco } from "@/components/gestao/Bloco";
import { Cabecalho, GrupoDia, GrupoMes, ResumoPeriodo } from "@/components/gestao/Cabecalho";
import { CalendarioMes } from "@/components/gestao/Calendario";
import { partesBrasilia } from "@/lib/agenda";
import { hojeISO, normalizarPlaca, somarDias } from "@/lib/garagem";
import { agruparPorMesEDia, combina, mesValido, rotuloDia, somarMes, tituloMes } from "@/lib/gestao";
import { listarFichas } from "@/lib/gestao-dados";
import { Icone } from "@/components/gestao/Icones";
import { exigirUsuario } from "@/lib/auth";
import { agendaEmpresa, agendamentosEntre, listarAgendamentos, listarVeiculos, ultimosAgendamentos, type AgendamentoComVeiculo } from "@/lib/dados";
import { googleConfigurado } from "@/lib/google-agenda";

export const metadata: Metadata = { title: "Agenda" };

const dataPorExtenso = (dia: string) =>
  new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
    .format(new Date(`${dia}T12:00:00Z`))
    .replace(/^./, (c) => c.toUpperCase());

const ehDia = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Busca da Agenda: placa, modelo, cliente, telefone ou serviço. */
async function buscarAgendamentos(busca: string): Promise<AgendamentoComVeiculo[]> {
  const [lista, fichas] = await Promise.all([ultimosAgendamentos(), listarFichas()]);
  const fichaDoVeiculo = new Map(fichas.flatMap((f) => f.veiculos.map((v) => [v.id, f] as const)));
  const placa = normalizarPlaca(busca);
  return lista.filter((a) => {
    const f = fichaDoVeiculo.get(a.veiculo_id);
    const v = a.veiculo;
    if (placa.length >= 2 && v?.placa.includes(placa)) return true;
    return combina(
      [v?.marca, v?.modelo, v?.apelido, v?.dono?.nome, v?.dono?.telefone, f?.nome, f?.telefone, a.servico].filter(Boolean).join(" "),
      busca,
    );
  });
}

export default async function AgendamentosPage({ searchParams }: PageProps<"/agendamentos">) {
  const [usuario, sp] = await Promise.all([exigirUsuario(), searchParams]);

  if (usuario.papel === "admin") {
    const hoje = hojeISO();
    const busca = typeof sp.q === "string" ? sp.q.trim() : "";
    const dia = ehDia(sp.dia) ? sp.dia : undefined;
    const mes = mesValido(sp.mes) ? sp.mes : (dia ?? hoje).slice(0, 7);
    const fimMes = somarDias(`${somarMes(mes, 1)}-01`, -1);
    const [{ aConfirmar, proximos }, doMes, encontrados] = await Promise.all([
      agendaEmpresa(),
      agendamentosEntre(`${mes}-01`, fimMes),
      busca ? buscarAgendamentos(busca) : Promise.resolve(null),
    ]);
    const diaDe = (iso: string | null) => (iso ? partesBrasilia(new Date(iso)).dia : "");
    const marcados: Record<string, number> = {};
    for (const a of doMes) marcados[diaDe(a.inicio)] = (marcados[diaDe(a.inicio)] ?? 0) + 1;
    const doDia = dia ? (dia.startsWith(mes) ? doMes : await agendamentosEntre(dia, dia)).filter((a) => diaDe(a.inicio) === dia) : [];
    const grupos = agruparPorMesEDia(proximos, (a) => diaDe(a.inicio)).map((m) => ({ ...m, dias: [...m.dias].reverse() })).reverse();
    return (
      <div className="space-y-4">
        <MenuGestao />
        <Cabecalho icone="calendario" titulo="Agenda" acao={{ href: "/agendamentos/novo", rotulo: "Agendamento" }} />

        {/* Busca: placa, modelo, cliente, telefone ou serviço */}
        <section className="rounded-2xl border border-borda bg-white p-4">
          <form className="flex flex-col gap-2 sm:flex-row" role="search">
            <input name="q" defaultValue={busca} type="search" className="campo flex-1" placeholder="Placa, modelo, cliente, telefone ou serviço" aria-label="Buscar agendamento" />
            <button type="submit" className="botao-primario gap-1.5 rounded-full px-4 py-2.5 text-sm">
              <Icone nome="calendario" className="h-4 w-4" />Buscar agendamento
            </button>
          </form>
          {encontrados && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between gap-2 px-1 text-sm">
                <span className="text-suave">
                  {encontrados.length} {encontrados.length === 1 ? "agendamento encontrado" : "agendamentos encontrados"} para <strong className="text-texto">“{busca}”</strong>
                </span>
                <Link href="/agendamentos" className="shrink-0 font-semibold text-marca-escura hover:underline">Limpar</Link>
              </div>
              {encontrados.length > 0 && (
                <ul className="divide-y divide-borda overflow-hidden rounded-xl border border-borda">
                  {encontrados.slice(0, 30).map((a) => <ItemAgendamento key={a.id} a={a} empresa />)}
                </ul>
              )}
            </div>
          )}
        </section>

        {dia && (
          <div id="dia" className="scroll-mt-28">
            <Bloco
              icone="calendario"
              titulo={`${dataPorExtenso(dia)}${doDia.length ? ` · ${doDia.length} ${doDia.length === 1 ? "agendamento" : "agendamentos"}` : ""}`}
              direita={<Link href="/agendamentos" className="text-xs font-semibold text-marca-escura">Fechar</Link>}
              semEspaco
            >
              {doDia.length === 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                  <span className="text-suave">Nenhum agendamento neste dia.</span>
                  <Link href="/agendamentos/novo" className="font-semibold text-marca-escura hover:underline">+ Novo agendamento</Link>
                </div>
              ) : (
                <ul className="divide-y divide-borda">{doDia.map((a) => <ItemAgendamento key={a.id} a={a} empresa />)}</ul>
              )}
            </Bloco>
          </div>
        )}

        {!googleConfigurado() && (
          <Aviso tipo="alerta">
            A Google Agenda ainda não está conectada. Os agendamentos funcionam, mas não vão para a sua agenda.{" "}
            <Link href="/painel/configuracoes" className="font-semibold underline">Conectar</Link>
          </Aviso>
        )}
        <ResumoPeriodo
          titulo="Resumo"
          itens={[
            { rotulo: "A confirmar", valor: aConfirmar.length, formato: "numero", cor: aConfirmar.length ? "amarelo" : "neutro" },
            { rotulo: "Hoje", valor: proximos.filter((a) => diaDe(a.inicio) === hoje).length, formato: "numero", cor: "verde" },
            { rotulo: "Próximos 7 dias", valor: proximos.filter((a) => diaDe(a.inicio) <= somarDias(hoje, 7)).length, formato: "numero" },
            { rotulo: "Lavagens agendadas", valor: proximos.filter((a) => a.tipo === "lavagem").length, formato: "numero" },
            { rotulo: "Outros serviços", valor: proximos.filter((a) => a.tipo !== "lavagem").length, formato: "numero" },
          ]}
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <div className="min-w-0 space-y-4">
            <Bloco icone="calendario" titulo="Mês">
              <CalendarioMes mes={mes} hoje={hoje} marcados={marcados} selecionado={dia} navegar />
            </Bloco>
            <Bloco icone="aviso" titulo={`A confirmar${aConfirmar.length ? ` (${aConfirmar.length})` : ""}`} semEspaco>
              {aConfirmar.length === 0 ? (
                <p className="p-4 text-sm text-suave">Nenhum pedido aguardando confirmação.</p>
              ) : (
                <ul className="divide-y divide-borda">{aConfirmar.map((a) => <ItemAgendamento key={a.id} a={a} empresa />)}</ul>
              )}
            </Bloco>
          </div>
          <Bloco icone="calendario" titulo="Próximos" semEspaco>
            {proximos.length === 0 ? (
              <p className="p-4 text-sm text-suave">Nada agendado.</p>
            ) : (
              <div className="space-y-1 px-3 pb-3">
                {grupos.map((m) => (
                  <section key={m.mes}>
                    <GrupoMes titulo={tituloMes(m.mes)} />
                    {m.dias.map((d) => (
                      <div key={d.dia}>
                        <GrupoDia titulo={rotuloDia(d.dia)} direita={`${d.itens.length} ${d.itens.length === 1 ? "horário" : "horários"}`} />
                        <ul className="mt-1 divide-y divide-borda overflow-hidden rounded-xl border border-borda">{d.itens.map((a) => <ItemAgendamento key={a.id} a={a} empresa />)}</ul>
                      </div>
                    ))}
                  </section>
                ))}
              </div>
            )}
          </Bloco>
        </div>
      </div>
    );
  }

  const veiculos = await listarVeiculos(usuario.id);
  const lista = await listarAgendamentos(veiculos.map((v) => v.id));
  const ativos = lista.filter((a) => a.situacao === "solicitado" || a.situacao === "confirmado");
  const anteriores = lista.filter((a) => !ativos.includes(a));

  return (
    <div className="space-y-4">
      <Cabecalho icone="calendario" titulo="Agenda" acao={veiculos.length > 0 ? { href: "/agendamentos/novo", rotulo: "Agendar" } : undefined} />
      {veiculos.length === 0 ? (
        <Cartao className="space-y-3 text-center">
          <p className="text-suave">Cadastre seu veículo para agendar serviços.</p>
          <Link href="/garagem/novo" className="botao-primario">Cadastrar veículo</Link>
        </Cartao>
      ) : ativos.length === 0 ? (
        <Cartao className="space-y-3 py-8 text-center">
          <div className="text-4xl" aria-hidden="true">📅</div>
          <h2 className="font-semibold">Agende sua lavagem em segundos</h2>
          <p className="mx-auto max-w-sm text-sm text-suave">
            Escolha um horário livre para lavagem, ou peça um horário para outros serviços. Atendemos de segunda a sexta, das 8h às 18h.
          </p>
          <Link href="/agendamentos/novo" className="botao-primario">Agendar</Link>
        </Cartao>
      ) : (
        <Cartao className="p-0">
          <ul className="divide-y divide-borda">{ativos.map((a) => <ItemAgendamento key={a.id} a={a} />)}</ul>
        </Cartao>
      )}
      {anteriores.length > 0 && (
        <details className="rounded-2xl border border-borda bg-white">
          <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-suave">Anteriores ({anteriores.length})</summary>
          <ul className="divide-y divide-borda border-t border-borda">{anteriores.map((a) => <ItemAgendamento key={a.id} a={a} />)}</ul>
        </details>
      )}
    </div>
  );
}
