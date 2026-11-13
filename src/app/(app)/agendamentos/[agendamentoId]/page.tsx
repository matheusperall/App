import type { Metadata } from "next";
import { MenuGestao } from "@/components/gestao/MenuGestao";
import Link from "next/link";
import { MensagensWhatsApp } from "@/components/MensagensWhatsApp";
import { mensagensAgendamento } from "@/lib/mensagens";
import { obterModelosMensagens } from "@/lib/gestao-dados";
import { notFound } from "next/navigation";
import { SeloAgendamento, descreverPreferencias } from "@/components/agendamento";
import { Placa, Voltar } from "@/components/garagem";
import { Aviso, Cartao } from "@/components/ui";
import { formatarQuando, partesBrasilia } from "@/lib/agenda";
import { exigirUsuario } from "@/lib/auth";
import { obterAgendamento, obterVeiculo } from "@/lib/dados";
import { osPorOrigem } from "@/lib/gestao-dados";
import { CATEGORIAS, nomeVeiculo } from "@/lib/garagem";
import { googleConfigurado } from "@/lib/google-agenda";
import { cancelarAgendamento, concluirAgendamento } from "../actions";
import { ConfirmarAgendamento } from "./ConfirmarAgendamento";

export const metadata: Metadata = { title: "Agendamento" };

export default async function AgendamentoPage({ params, searchParams }: PageProps<"/agendamentos/[agendamentoId]">) {
  const [{ agendamentoId }, sp, usuario] = await Promise.all([params, searchParams, exigirUsuario()]);
  const a = await obterAgendamento(agendamentoId);
  if (!a) notFound();
  const admin = usuario.papel === "admin";
  const cat = CATEGORIAS[a.categoria as keyof typeof CATEGORIAS] ?? CATEGORIAS.outros;
  // Mensagens prontas para o cliente, com o nome e o carro (o contato vem da conta do app ou da ficha da loja)
  const ativoAgora = a.situacao === "solicitado" || a.situacao === "confirmado";
  const [carro, modelos] = admin && ativoAgora ? await Promise.all([obterVeiculo(a.veiculo_id), obterModelosMensagens()]) : [null, {}];
  const contato = carro?.dono ?? a.veiculo?.dono ?? null;
  const mensagens =
    admin && ativoAgora
      ? mensagensAgendamento(a, { nome: contato?.nome, marca: carro?.marca ?? a.veiculo?.marca, modelo: carro?.modelo ?? a.veiculo?.modelo, ano: carro?.ano, cor: carro?.cor, placa: carro?.placa ?? a.veiculo?.placa }, modelos)
      : [];
  const ativo = a.situacao === "solicitado" || a.situacao === "confirmado";
  const osLigada = admin ? (await osPorOrigem("agendamento_id", [a.id]))[a.id] : undefined;
  const sugestao = a.preferencias[0];

  return (
    <div className="space-y-4">
      {admin && <MenuGestao />}
      <Voltar href="/agendamentos">Agenda</Voltar>
      {sp.agendado && <Aviso tipo="sucesso">Lavagem agendada! Te esperamos. Você recebe um lembrete na véspera.</Aviso>}
      {sp.enviado && <Aviso tipo="sucesso">Pedido enviado! Vamos confirmar o horário e te avisar.</Aviso>}
      {sp.confirmado && <Aviso tipo="sucesso">Agendamento confirmado{googleConfigurado() ? " e adicionado à Google Agenda" : ""}. O cliente foi avisado.</Aviso>}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
        <Cartao className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="text-sm text-suave">{a.tipo === "lavagem" ? "🧽 Lavagem" : `${cat.icone} ${cat.rotulo}`}</p>
              <h1 className="text-2xl font-bold">{a.servico}</h1>
              {a.veiculo && (
                <p className="text-sm text-suave">
                  {admin && a.veiculo.dono?.nome ? `${a.veiculo.dono.nome} · ` : ""}
                  <Link href={`/garagem/${a.veiculo.id}`} className="underline">{nomeVeiculo(a.veiculo)}</Link>
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <SeloAgendamento a={a} empresa={admin} />
              {a.veiculo && <Placa placa={a.veiculo.placa} tamanho="sm" />}
            </div>
          </div>

          {a.inicio ? (
            <div className="rounded-xl bg-marca-clara p-4">
              <p className="text-xs text-marca-escura">Quando</p>
              <p className="font-titulo text-lg font-bold">{formatarQuando(a.inicio, a.fim)}</p>
              {a.fim && partesBrasilia(new Date(a.fim)).dia !== partesBrasilia(new Date(a.inicio)).dia && (
                <p className="text-sm text-suave">Previsão de entrega: {formatarQuando(a.fim)}</p>
              )}
            </div>
          ) : (
            a.preferencias.length > 0 && (
              <div className="rounded-xl bg-fundo p-3 text-sm">
                <p className="text-xs text-suave">Dias sugeridos</p>
                <ul className="mt-1 list-disc pl-5">{descreverPreferencias(a).map((t) => <li key={t}>{t}</li>)}</ul>
              </div>
            )
          )}
          {a.observacoes && (
            <p className="text-sm"><span className="text-suave">Observações do cliente:</span> {a.observacoes}</p>
          )}
          {a.resposta && (
            <p className="text-sm"><span className="text-suave">Mensagem da Sempre Zero:</span> {a.resposta}</p>
          )}
          {(a.orcamento_id || a.apontamento_id) && (
            <p className="flex flex-wrap gap-x-4 text-sm">
              {a.orcamento_id && <Link href={`/orcamentos/${a.orcamento_id}`} className="font-medium text-marca-escura underline">Ver orçamento</Link>}
              {a.apontamento_id && a.veiculo && (
                <Link href={`/garagem/${a.veiculo.id}/apontamentos/${a.apontamento_id}`} className="font-medium text-marca-escura underline">Ver apontamento</Link>
              )}
            </p>
          )}
        </Cartao>
        </div>
        <div className="min-w-0 space-y-4">
        {admin && ativo && (
          <Cartao className="space-y-3">
            <h2 className="font-semibold">{a.situacao === "confirmado" ? "Remarcar" : "Confirmar horário"}</h2>
            <ConfirmarAgendamento
              id={a.id}
              tipo={a.tipo}
              diaInicial={a.inicio ? partesBrasilia(new Date(a.inicio)).dia : sugestao?.data ?? ""}
              horaInicial={a.inicio ? partesBrasilia(new Date(a.inicio)).hora : sugestao?.periodo === "tarde" ? "13:00" : "08:00"}
              podeRecusar={a.situacao === "solicitado"}
            />
          </Cartao>
        )}

        {mensagens.length > 0 && <MensagensWhatsApp mensagens={mensagens} telefone={contato?.telefone} />}

        {admin && a.situacao === "confirmado" && (
          osLigada ? (
            <Link href={`/gestao/os/${osLigada.id}`} className="botao-primario w-full">Ver OS #{osLigada.numero}</Link>
          ) : (
            <Link href={`/gestao/os/nova?agendamento=${a.id}`} className="botao-primario w-full">🚗 Carro chegou: abrir OS</Link>
          )
        )}

        {admin && a.situacao === "confirmado" && !osLigada && (
          <form action={concluirAgendamento}>
            <input type="hidden" name="id" value={a.id} />
            <button type="submit" className="botao-contorno w-full">Marcar como concluído sem OS (só registrar o serviço)</button>
          </form>
        )}

        {ativo && (
          <form action={cancelarAgendamento} className="text-center">
            <input type="hidden" name="id" value={a.id} />
            <button type="submit" className="text-sm font-medium text-perigo underline">
              {a.situacao === "solicitado" && !admin ? "Cancelar pedido" : "Cancelar agendamento"}
            </button>
          </form>
        )}
        </div>
      </div>

    </div>
  );
}
