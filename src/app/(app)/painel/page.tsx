import type { Metadata } from "next";
import Link from "next/link";
import { Placa, SeloPrioridade } from "@/components/garagem";
import { Aviso, Cartao } from "@/components/ui";
import { exigirAdmin } from "@/lib/auth";
import { agendaEmpresa, caixaDeEntrada, contarOrcamentosAResponder, contarPainel, vencimentosProximos, type Vencimento } from "@/lib/dados";
import { ItemAgendamento } from "@/components/agendamento";
import { partesBrasilia } from "@/lib/agenda";
import { googleConfigurado } from "@/lib/google-agenda";
import { SITUACOES_APONTAMENTO, formatarDataHora, nomeVeiculo } from "@/lib/garagem";
import { emailConfigurado, pushConfigurado } from "@/lib/notificar";
import { lembretesConfigurados } from "@/lib/env";

export const metadata: Metadata = { title: "Painel da empresa" };

export default async function PainelPage() {
  await exigirAdmin();
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

  const indicadores = [
    { rotulo: "Clientes", valor: clientes, href: "/gestao/clientes" },
    { rotulo: "Orçamentos a responder", valor: orcamentosAResponder, href: "/orcamentos?f=responder", destaque: orcamentosAResponder > 0 },
    { rotulo: "Apontamentos abertos", valor: abertos, href: null },
    { rotulo: "Agendamentos a confirmar", valor: agenda.aConfirmar.length, href: "/agendamentos", destaque: agenda.aConfirmar.length > 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-suave">Área da empresa</p>
          <h1 className="text-2xl font-bold sm:text-3xl">Painel</h1>
        </div>
        <div className="flex gap-4 text-sm font-semibold text-marca-escura">
          <Link href="/garagem" className="hover:underline">Minha garagem</Link>
          <Link href="/painel/configuracoes" className="hover:underline">Configurações</Link>
        </div>
      </div>

      {(!pushConfigurado() || !emailConfigurado() || !lembretesConfigurados() || !googleConfigurado()) && (
        <Aviso tipo="alerta">
          {!googleConfigurado() ? "A Google Agenda ainda não está conectada. " : ""}
          {!lembretesConfigurados() ? "Os lembretes automáticos ainda não estão ativados. " : ""}
          {!pushConfigurado() ? "As notificações no celular ainda não estão configuradas. " : ""}
          {!emailConfigurado() ? "O envio de e-mails de aviso ainda não está configurado. " : ""}
          <Link href="/painel/configuracoes" className="font-semibold underline">Configurar agora</Link>
        </Aviso>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {indicadores.map((i) => {
          const conteudo = (
            <>
              <p className="text-sm text-suave">{i.rotulo}</p>
              <p className={`mt-1 font-titulo text-3xl font-bold ${i.destaque ? "text-marca-escura" : ""}`}>{i.valor}</p>
            </>
          );
          return i.href ? (
            <Link key={i.rotulo} href={i.href} className={`rounded-2xl border bg-white p-5 transition hover:border-marca/50 ${i.destaque ? "border-marca/50" : "border-borda"}`}>
              {conteudo}
            </Link>
          ) : (
            <Cartao key={i.rotulo} className={i.destaque ? "border-marca/50" : ""}>{conteudo}</Cartao>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/gestao/os/nova" className="botao-primario">+ Nova OS</Link>
        <Link href="/gestao/clientes" className="botao-contorno">Buscar cliente ou placa</Link>
        <Link href="/painel/comunicados" className="botao-escuro">📣 Enviar comunicado</Link>
      </div>

      <Cartao className="p-0">
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="font-semibold">📅 Hoje na agenda</h2>
          <Link href="/agendamentos" className="text-sm font-semibold text-marca-escura hover:underline">Ver agenda</Link>
        </div>
        {deHoje.length === 0 ? (
          <p className="px-5 pt-2 pb-5 text-sm text-suave">Nenhum atendimento marcado para hoje.</p>
        ) : (
          <ul className="mt-2 divide-y divide-borda">{deHoje.map((a) => <ItemAgendamento key={a.id} a={a} empresa />)}</ul>
        )}
      </Cartao>

      <Caixa titulo="📥 Respostas de clientes" vazio="Nenhuma resposta nova. Quando um cliente pedir orçamento ou agendamento, aparece aqui." itens={novos} />
      {agendados.length > 0 && <Caixa titulo="📅 Agendados" vazio="" itens={agendados} />}
      <Vencimentos itens={vencimentos} />
    </div>
  );
}

function Caixa({ titulo, vazio, itens }: { titulo: string; vazio: string; itens: Awaited<ReturnType<typeof caixaDeEntrada>> }) {
  return (
    <Cartao className="p-0">
      <h2 className="px-5 pt-5 font-semibold">{titulo}</h2>
      {itens.length === 0 ? (
        <p className="px-5 pt-2 pb-5 text-sm text-suave">{vazio}</p>
      ) : (
        <ul className="mt-2 divide-y divide-borda">
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
    </Cartao>
  );
}

function linkWhatsApp(telefone: string, texto: string) {
  const n = telefone.replace(/\D/g, "");
  return `https://wa.me/${n.length <= 11 ? `55${n}` : n}?text=${encodeURIComponent(texto)}`;
}

function Vencimentos({ itens }: { itens: Vencimento[] }) {
  return (
    <section id="vencimentos" className="scroll-mt-20">
      <Cartao className="p-0">
        <div className="px-5 pt-5">
          <h2 className="font-semibold">⏰ Vencimentos dos clientes (próximos 30 dias)</h2>
          <p className="text-sm text-suave">Manutenções e documentos vencidos ou vencendo. Boa hora para oferecer o serviço.</p>
        </div>
        {itens.length === 0 ? (
          <p className="px-5 pt-2 pb-5 text-sm text-suave">Nada vencendo nos próximos 30 dias.</p>
        ) : (
          <ul className="mt-2 divide-y divide-borda">
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
      </Cartao>
    </section>
  );
}
