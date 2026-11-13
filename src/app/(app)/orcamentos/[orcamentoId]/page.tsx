import type { Metadata } from "next";
import { MenuGestao } from "@/components/gestao/MenuGestao";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BotaoExcluir } from "@/components/BotaoExcluir";
import { Placa, Voltar } from "@/components/garagem";
import { SeloOrcamento, TabelaItens } from "@/components/orcamento";
import { Aviso, Cartao } from "@/components/ui";
import { exigirUsuario } from "@/lib/auth";
import { obterOrcamento, obterVeiculo, urlsDasFotos } from "@/lib/dados";
import { MensagensWhatsApp } from "@/components/MensagensWhatsApp";
import { mensagensOrcamento } from "@/lib/mensagens";
import { obterModelosMensagens, osPorOrigem } from "@/lib/gestao-dados";
import { CATEGORIAS, formatarData, formatarDataHora, hojeISO, nomeVeiculo, orcamentoVencido, somarDias } from "@/lib/garagem";
import { excluirOrcamento } from "../actions";
import { Decisao } from "./Decisao";
import { FormResposta } from "./FormResposta";

export const metadata: Metadata = { title: "Orçamento" };

export default async function OrcamentoPage({ params, searchParams }: PageProps<"/orcamentos/[orcamentoId]">) {
  const [{ orcamentoId }, sp, usuario] = await Promise.all([params, searchParams, exigirUsuario()]);
  const o = await obterOrcamento(orcamentoId);
  if (!o) notFound();
  const fotos = await urlsDasFotos(o.fotos);
  const admin = usuario.papel === "admin";
  const cat = CATEGORIAS[o.categoria];
  const vencido = orcamentoVencido(o);
  const respondido = o.itens.length > 0;
  const osLigada = admin && o.situacao === "aceito" ? (await osPorOrigem("orcamento_id", [o.id]))[o.id] : undefined;
  // Mensagens prontas para o cliente, com o nome e o carro (o contato vem da conta do app ou da ficha da loja)
  const comMensagens = admin && respondido && o.situacao !== "cancelado";
  const [carro, modelos] = comMensagens ? await Promise.all([obterVeiculo(o.veiculo_id), obterModelosMensagens()]) : [null, {}];
  const contato = carro?.dono ?? o.veiculo?.dono ?? null;
  const mensagens = comMensagens
    ? mensagensOrcamento(o, { nome: contato?.nome, marca: carro?.marca ?? o.veiculo?.marca, modelo: carro?.modelo ?? o.veiculo?.modelo, ano: carro?.ano, cor: carro?.cor, placa: carro?.placa ?? o.veiculo?.placa }, modelos)
    : [];

  return (
    <div className="space-y-4">
      {admin && <MenuGestao />}
      <Voltar href="/orcamentos">Orçamentos</Voltar>
      {sp.enviado && <Aviso tipo="sucesso">Pedido enviado! Avisaremos você assim que o orçamento estiver pronto.</Aviso>}
      {sp.respondido && <Aviso tipo="sucesso">Orçamento enviado. O cliente foi avisado.</Aviso>}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
        <Cartao className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="text-sm text-suave">{cat.icone} {cat.rotulo} · {formatarData(o.criado_em)}</p>
              <h1 className="text-2xl font-bold">Orçamento #{o.numero}</h1>
              {o.veiculo && (
                <p className="text-sm text-suave">
                  {admin && o.veiculo.dono?.nome ? `${o.veiculo.dono.nome} · ` : ""}
                  <Link href={`/garagem/${o.veiculo.id}`} className="underline">{nomeVeiculo(o.veiculo)}</Link>
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <SeloOrcamento o={o} empresa={admin} />
              {o.veiculo && <Placa placa={o.veiculo.placa} tamanho="sm" />}
            </div>
          </div>

          {o.pedido && (
            <div className="rounded-xl bg-fundo p-3">
              <p className="text-xs text-suave">Pedido</p>
              <p className="mt-1 whitespace-pre-line text-sm">{o.pedido}</p>
            </div>
          )}
          {o.fotos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {o.fotos.map((f) =>
                fotos[f] ? (
                  <a key={f} href={fotos[f]} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-xl bg-borda">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fotos[f]} alt="Foto do pedido" className="h-full w-full object-cover" />
                  </a>
                ) : null,
              )}
            </div>
          )}
          {o.apontamento_id && o.veiculo && (
            <p className="text-sm">
              <Link href={`/garagem/${o.veiculo.id}/apontamentos/${o.apontamento_id}`} className="font-medium text-marca-escura underline">
                Ver o apontamento que originou este orçamento
              </Link>
            </p>
          )}
        </Cartao>

        {respondido ? (
          <Cartao className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">Valores</h2>
              {o.respondido_em && <span className="text-xs text-suave">enviado {formatarDataHora(o.respondido_em)}</span>}
            </div>
            <TabelaItens o={o} />
          </Cartao>
        ) : (
          !admin && o.situacao === "solicitado" && (
            <Aviso>Recebemos seu pedido. Nossa equipe vai analisar e você será avisado quando o orçamento estiver pronto.</Aviso>
          )
        )}
        </div>
        <div className="min-w-0 space-y-4">
        {o.situacao === "aceito" && (
          <Aviso tipo="sucesso">
            {admin
              ? `Aprovado pelo cliente em ${o.decidido_em ? formatarDataHora(o.decidido_em) : "—"}. Combine a data do serviço.`
              : "Você aprovou este orçamento. Escolha os melhores dias para fazermos o serviço."}
          </Aviso>
        )}
        {o.situacao === "aceito" && admin && (
          osLigada ? (
            <Link href={`/gestao/os/${osLigada.id}`} className="botao-contorno w-full">Ver OS #{osLigada.numero}</Link>
          ) : (
            <Link href={`/gestao/os/nova?orcamento=${o.id}`} className="botao-primario w-full">🧾 Abrir OS com estes itens</Link>
          )
        )}
        {o.situacao === "aceito" && !admin && (
          <Link href={`/agendamentos/novo?orcamento=${o.id}`} className="botao-primario w-full">📅 Agendar o serviço</Link>
        )}
        {o.situacao === "recusado" && (
          <Aviso>
            {admin ? "O cliente recusou." : "Você recusou este orçamento."}
            {o.motivo_recusa && <> Motivo: “{o.motivo_recusa}”</>}
          </Aviso>
        )}
        {vencido && <Aviso tipo="alerta">Este orçamento expirou em {formatarData(o.validade)}. {admin ? "Atualize os valores e a validade para reenviar." : "Peça uma atualização à nossa equipe."}</Aviso>}

        {/* Cliente decide */}
        {!admin && !vencido && (o.situacao === "respondido" || o.situacao === "solicitado") && (
          <Decisao id={o.id} situacao={o.situacao} />
        )}

        {/* Empresa responde / atualiza */}
        {admin && (
          <>
            {mensagens.length > 0 && <MensagensWhatsApp mensagens={mensagens} telefone={contato?.telefone} />}
            {(o.situacao === "solicitado" || o.situacao === "respondido" || vencido) && (
              <Cartao className="space-y-3">
                <h2 className="font-semibold">{respondido ? "Editar orçamento" : "Responder com valores"}</h2>
                <FormResposta
                  id={o.id}
                  itens={o.itens}
                  prazo={o.prazo_dias}
                  observacoes={o.observacoes}
                  validadePadrao={o.validade && !vencido ? o.validade : somarDias(hojeISO(), 15)}
                />
              </Cartao>
            )}
            <form action={excluirOrcamento}>
              <input type="hidden" name="id" value={o.id} />
              <BotaoExcluir mensagem={`Excluir o orçamento #${o.numero}?`}>Excluir orçamento</BotaoExcluir>
            </form>
          </>
        )}
        </div>
      </div>

    </div>
  );
}
