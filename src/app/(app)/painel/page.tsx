import type { Metadata } from "next";
import Link from "next/link";
import { Placa, SeloPrioridade } from "@/components/garagem";
import { Aviso } from "@/components/ui";
import { Bloco, Contagem } from "@/components/gestao/Bloco";
import { Cabecalho } from "@/components/gestao/Cabecalho";
import { Icone } from "@/components/gestao/Icones";
import { abasPainel } from "./abas";
import { exigirAdmin } from "@/lib/auth";
import { agendaEmpresa, caixaDeEntrada, contarOrcamentosAResponder, contarPainel, vencimentosProximos, type Vencimento } from "@/lib/dados";
import { ItemAgendamento } from "@/components/agendamento";
import { partesBrasilia } from "@/lib/agenda";
import { googleConfigurado } from "@/lib/google-agenda";
import { SITUACOES_APONTAMENTO, formatarDataHora, nomeVeiculo, normalizarPlaca } from "@/lib/garagem";
import { combina, type FichaComResumo, type VeiculoResumo } from "@/lib/gestao";
import { listarFichas } from "@/lib/gestao-dados";
import { emailConfigurado, pushConfigurado } from "@/lib/notificar";
import { lembretesConfigurados } from "@/lib/env";

export const metadata: Metadata = { title: "Atendimento" };

export default async function PainelPage({ searchParams }: PageProps<"/painel">) {
  const [, sp] = await Promise.all([exigirAdmin(), searchParams]);
  const busca = typeof sp.q === "string" ? sp.q.trim() : "";
  const tipoBusca = sp.tipo === "cliente" ? "cliente" : "veiculo";
  const resultado = busca ? await buscarAtendimento(busca, tipoBusca) : null;
  const [{ clientes, abertos }, caixa, vencimentos, orcamentosAResponder, agenda] = await Promise.all([
    contarPainel(),
    caixaDeEntrada(),
    vencimentosProximos(),
    contarOrcamentosAResponder(),
    agendaEmpresa(),
  ]);
  const hoje = partesBrasilia(new Date()).dia;
  const deHoje = agenda.proximos.filter((a) => a.inicio && partesBrasilia(new Date(a.inicio)).dia === hoje);
  const novos = caixa.filter((c) => c.situacao !== "agendado");
  const agendados = caixa.filter((c) => c.situacao === "agendado");

  return (
    <div className="space-y-4">
      <Cabecalho icone="atendimento" titulo="Atendimento" abas={abasPainel("geral")} />

      {/* Busca rápida: veículo (placa ou modelo) ou cliente (nome ou telefone) */}
      <section className="rounded-2xl border border-borda bg-white p-4">
        <form className="flex flex-col gap-2 sm:flex-row" role="search">
          <input
            name="q"
            defaultValue={busca}
            type="search"
            className="campo flex-1"
            placeholder="Placa, modelo, nome ou telefone"
            aria-label="Buscar veículo ou cliente"
          />
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button type="submit" name="tipo" value="veiculo" className={`gap-1.5 rounded-full px-4 py-2.5 text-sm ${tipoBusca === "veiculo" || !busca ? "botao-primario" : "botao-contorno"}`}>
              <Icone nome="carro" className="h-4 w-4" />Buscar veículo
            </button>
            <button type="submit" name="tipo" value="cliente" className={`gap-1.5 rounded-full px-4 py-2.5 text-sm ${tipoBusca === "cliente" && busca ? "botao-primario" : "botao-contorno"}`}>
              <Icone nome="clientes" className="h-4 w-4" />Buscar cliente
            </button>
          </div>
        </form>
        {resultado && <ResultadoBusca resultado={resultado} busca={busca} />}
      </section>

      {(!pushConfigurado() || !emailConfigurado() || !lembretesConfigurados() || !googleConfigurado()) && (
        <Aviso tipo="alerta">
          {!googleConfigurado() ? "A Google Agenda ainda não está conectada. " : ""}
          {!lembretesConfigurados() ? "Os lembretes automáticos ainda não estão ativados. " : ""}
          {!pushConfigurado() ? "As notificações no celular ainda não estão configuradas. " : ""}
          {!emailConfigurado() ? "O envio de e-mails de aviso ainda não está configurado. " : ""}
          <Link href="/painel/configuracoes" className="font-semibold underline">Configurar agora</Link>
        </Aviso>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Bloco icone="clientes" titulo="Clientes">
          <Link href="/gestao/clientes"><Contagem n={clientes} legenda="clientes com conta no app" /></Link>
        </Bloco>
        <Bloco icone="orcamento" titulo="Orçamentos">
          <Link href="/orcamentos?f=responder"><Contagem n={orcamentosAResponder} legenda="a responder" cor={orcamentosAResponder ? "text-[#b07800]" : "text-suave"} /></Link>
        </Bloco>
        <Bloco icone="calendario" titulo="Agendamentos">
          <Link href="/agendamentos"><Contagem n={agenda.aConfirmar.length} legenda="a confirmar" cor={agenda.aConfirmar.length ? "text-[#b07800]" : "text-suave"} /></Link>
        </Bloco>
        <Bloco icone="chave" titulo="Apontamentos">
          <Contagem n={abertos} legenda="abertos nos carros dos clientes (oportunidades)" cor={abertos ? "text-marca-escura" : "text-suave"} />
        </Bloco>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Link href="/orcamentos?f=responder" className="botao-contorno gap-1.5 rounded-full px-4 py-2 text-sm"><Icone nome="orcamento" className="h-4 w-4" />Responder orçamentos</Link>
        <Link href="/agendamentos" className="botao-contorno gap-1.5 rounded-full px-4 py-2 text-sm"><Icone nome="calendario" className="h-4 w-4" />Confirmar agendamentos</Link>
        <Link href="/painel/comunicados" className="botao-contorno gap-1.5 rounded-full px-4 py-2 text-sm"><Icone nome="megafone" className="h-4 w-4" />Enviar comunicado</Link>
        <Link href="/gestao/clientes/novo" className="botao-contorno gap-1.5 rounded-full px-4 py-2 text-sm"><Icone nome="clientes" className="h-4 w-4" />Cadastrar cliente</Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Bloco icone="calendario" titulo="Hoje na agenda" direita={<Link href="/agendamentos" className="text-xs font-semibold text-marca-escura">Ver agenda</Link>} semEspaco>
          {deHoje.length === 0 ? (
            <p className="p-4 text-sm text-suave">Nenhum atendimento marcado para hoje.</p>
          ) : (
            <ul className="divide-y divide-borda">{deHoje.map((a) => <ItemAgendamento key={a.id} a={a} empresa />)}</ul>
          )}
        </Bloco>
        <Caixa titulo="Respostas de clientes" vazio="Nenhuma resposta nova. Quando um cliente pedir orçamento ou agendamento, aparece aqui." itens={novos} />
      </div>
      {agendados.length > 0 && <Caixa titulo="Agendados" vazio="" itens={agendados} />}
      <Vencimentos itens={vencimentos} />
    </div>
  );
}

type Resultado =
  | { tipo: "veiculo"; itens: { veiculo: VeiculoResumo; ficha: FichaComResumo }[] }
  | { tipo: "cliente"; itens: FichaComResumo[] };

async function buscarAtendimento(busca: string, tipo: "veiculo" | "cliente"): Promise<Resultado> {
  if (tipo === "cliente") return { tipo, itens: (await listarFichas(busca)).slice(0, 20) };
  const placa = normalizarPlaca(busca);
  const itens = (await listarFichas())
    .flatMap((ficha) => ficha.veiculos.map((veiculo) => ({ veiculo, ficha })))
    .filter(({ veiculo }) => (placa.length >= 2 && veiculo.placa.includes(placa)) || combina(`${veiculo.marca} ${veiculo.modelo} ${veiculo.apelido ?? ""}`, busca))
    .slice(0, 20);
  return { tipo, itens };
}

function ResultadoBusca({ resultado, busca }: { resultado: Resultado; busca: string }) {
  if (resultado.itens.length === 0) {
    return (
      <p className="mt-3 text-sm text-suave">
        Nada encontrado para “{busca}”.{" "}
        <Link href={resultado.tipo === "veiculo" ? `/painel?q=${encodeURIComponent(busca)}&tipo=cliente` : `/painel?q=${encodeURIComponent(busca)}&tipo=veiculo`} className="font-semibold text-marca-escura">
          Buscar como {resultado.tipo === "veiculo" ? "cliente" : "veículo"}
        </Link>
      </p>
    );
  }
  return (
    <ul className="mt-3 divide-y divide-borda overflow-hidden rounded-xl border border-borda">
      {resultado.tipo === "veiculo"
        ? resultado.itens.map(({ veiculo, ficha }) => (
            <li key={veiculo.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <Link href={`/garagem/${veiculo.id}`} className="flex min-w-0 items-center gap-3 hover:underline">
                <span className="shrink-0"><Placa placa={veiculo.placa} tamanho="sm" /></span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{nomeVeiculo(veiculo)}{veiculo.ano ? ` · ${veiculo.ano}` : ""}</span>
                  <span className="block truncate text-sm text-suave">{ficha.nome}{ficha.telefone ? ` · ${ficha.telefone}` : ""}</span>
                </span>
              </Link>
              <Link href={`/gestao/clientes/${ficha.id}`} className="shrink-0 text-xs font-semibold text-marca-escura">Ficha</Link>
            </li>
          ))
        : resultado.itens.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <Link href={`/gestao/clientes/${f.id}`} className="min-w-0 hover:underline">
                <span className="block truncate font-medium">{f.nome}{f.lojista ? " · lojista" : ""}</span>
                <span className="block truncate text-sm text-suave">{[f.telefone, ...f.veiculos.map((v) => v.placa)].filter(Boolean).join(" · ") || "—"}</span>
              </Link>
              {f.telefone && (
                <a href={linkWhatsApp(f.telefone, `Olá, ${f.nome.split(" ")[0]}!`)} target="_blank" rel="noreferrer" className="shrink-0 rounded-lg border border-borda px-2.5 py-1.5 text-xs font-semibold text-marca-escura hover:border-marca">
                  WhatsApp
                </a>
              )}
            </li>
          ))}
    </ul>
  );
}

function Caixa({ titulo, vazio, itens }: { titulo: string; vazio: string; itens: Awaited<ReturnType<typeof caixaDeEntrada>> }) {
  return (
    <Bloco icone="aviso" titulo={titulo} semEspaco>
      {itens.length === 0 ? (
        <p className="p-4 text-sm text-suave">{vazio}</p>
      ) : (
        <ul className="divide-y divide-borda">
          {itens.map((a) => (
            <li key={a.id}>
              <Link href={`/garagem/${a.veiculo_id}/apontamentos/${a.id}`} className="block px-5 py-4 transition hover:bg-fundo">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {a.veiculo?.dono?.nome ?? "Cliente"} · <span className="text-marca-escura">{SITUACOES_APONTAMENTO[a.situacao].rotuloEmpresa}</span>
                    </p>
                    <p className="text-sm text-suave">{a.titulo}{a.veiculo && ` · ${nomeVeiculo(a.veiculo)}`}</p>
                    {a.mensagem_cliente && <p className="mt-1 line-clamp-2 text-sm">“{a.mensagem_cliente}”</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {a.veiculo && <Placa placa={a.veiculo.placa} tamanho="sm" />}
                    <SeloPrioridade prioridade={a.prioridade} />
                    {a.respondido_em && <span className="text-xs text-suave">{formatarDataHora(a.respondido_em)}</span>}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Bloco>
  );
}

function linkWhatsApp(telefone: string, texto: string) {
  const n = telefone.replace(/\D/g, "");
  return `https://wa.me/${n.length <= 11 ? `55${n}` : n}?text=${encodeURIComponent(texto)}`;
}

function Vencimentos({ itens }: { itens: Vencimento[] }) {
  return (
    <section id="vencimentos" className="scroll-mt-20">
      <Bloco icone="calendario" titulo="Vencimentos dos clientes (próximos 30 dias)" direita={<span className="text-xs text-suave">Boa hora para oferecer o serviço</span>} semEspaco>
        {itens.length === 0 ? (
          <p className="p-4 text-sm text-suave">Nada vencendo nos próximos 30 dias.</p>
        ) : (
          <ul className="divide-y divide-borda">
            {itens.slice(0, 60).map((v) => (
              <li key={v.chave} className="flex items-start justify-between gap-3 px-5 py-3">
                <Link href={v.veiculo ? `/garagem/${v.veiculo.id}` : v.cliente ? `/painel/clientes/${v.cliente.id}` : "#"} className="min-w-0 flex-1">
                  <p className="font-medium">
                    {v.titulo}{" "}
                    <span className={`text-xs font-semibold ${v.vencido ? "text-perigo" : "text-[#8a5a00]"}`}>
                      {v.vencido ? "vencido" : "em breve"}
                    </span>
                  </p>
                  <p className="text-sm text-suave">
                    {v.cliente?.nome ?? "Cliente"}
                    {v.veiculo && ` · ${v.veiculo.nome} (${v.veiculo.placa})`} · {v.detalhe}
                  </p>
                </Link>
                {v.cliente?.telefone && (
                  <a
                    href={linkWhatsApp(
                      v.cliente.telefone,
                      `Olá, ${v.cliente.nome?.split(" ")[0] ?? ""}! Aqui é da Sempre Zero. Vimos que ${v.titulo.toLowerCase()}${v.veiculo ? ` do seu ${v.veiculo.nome}` : ""} está ${v.vencido ? "vencido" : "perto de vencer"}. Podemos ajudar?`,
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded-lg border border-borda px-2.5 py-1.5 text-xs font-semibold text-marca-escura hover:border-marca"
                  >
                    WhatsApp
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </Bloco>
    </section>
  );
}
