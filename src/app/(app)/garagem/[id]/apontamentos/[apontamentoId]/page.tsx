import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BotaoExcluir } from "@/components/BotaoExcluir";
import { SeloPrioridade, Voltar } from "@/components/garagem";
import { Aviso, Cartao } from "@/components/ui";
import { exigirUsuario } from "@/lib/auth";
import { obterApontamento, obterVeiculo, urlsDasFotos } from "@/lib/dados";
import { CATEGORIAS, SITUACOES_APONTAMENTO, formatarData, formatarDataHora, nomeVeiculo } from "@/lib/garagem";
import { excluirApontamento, mudarSituacaoApontamento } from "../../../apontamentos-actions";
import { RespostaCliente } from "./RespostaCliente";

export const metadata: Metadata = { title: "Apontamento" };

function linkWhatsApp(telefone: string, texto: string) {
  const n = telefone.replace(/\D/g, "");
  return `https://wa.me/${n.length <= 11 ? `55${n}` : n}?text=${encodeURIComponent(texto)}`;
}

export default async function ApontamentoPage({ params }: PageProps<"/garagem/[id]/apontamentos/[apontamentoId]">) {
  const [{ id, apontamentoId }, usuario] = await Promise.all([params, exigirUsuario()]);
  const [apontamento, veiculo] = await Promise.all([obterApontamento(apontamentoId), obterVeiculo(id)]);
  if (!apontamento || !veiculo || apontamento.veiculo_id !== id) notFound();
  const fotos = await urlsDasFotos(apontamento.fotos);
  const admin = usuario.papel === "admin";
  const cat = CATEGORIAS[apontamento.categoria];
  const sit = SITUACOES_APONTAMENTO[apontamento.situacao];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Voltar href={`/garagem/${id}`}>{nomeVeiculo(veiculo)}</Voltar>

      <Cartao className="space-y-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm text-suave">
            <span>{cat.icone} {cat.rotulo}</span>
            <SeloPrioridade prioridade={apontamento.prioridade} />
            <span>· {formatarData(apontamento.criado_em)}</span>
          </div>
          <h1 className="text-2xl font-bold">{apontamento.titulo}</h1>
          <p className="text-sm">
            Situação: <strong>{admin ? sit.rotuloEmpresa : sit.rotulo}</strong>
          </p>
        </div>
        {apontamento.descricao && <p className="whitespace-pre-line text-suave">{apontamento.descricao}</p>}
        {apontamento.fotos.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {apontamento.fotos.map((f) =>
              fotos[f] ? (
                <a key={f} href={fotos[f]} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-xl bg-borda">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fotos[f]} alt="Foto do apontamento" className="h-full w-full object-cover" />
                </a>
              ) : null,
            )}
          </div>
        )}
        {apontamento.mensagem_cliente && (
          <div className="rounded-xl bg-fundo p-3 text-sm">
            <p className="text-xs text-suave">
              Mensagem do cliente{apontamento.respondido_em && ` · ${formatarDataHora(apontamento.respondido_em)}`}
            </p>
            <p className="mt-1 whitespace-pre-line">“{apontamento.mensagem_cliente}”</p>
          </div>
        )}
      </Cartao>

      {!admin && <RespostaCliente id={apontamento.id} situacao={apontamento.situacao} />}

      {admin && (
        <Cartao className="space-y-3">
          <h2 className="font-semibold">Ações da empresa</h2>
          {["orcamento", "agendamento"].includes(apontamento.situacao) && (
            <Aviso>
              {veiculo.dono?.nome ?? "O cliente"} {apontamento.situacao === "orcamento" ? "pediu um orçamento" : "quer agendar"}. Entre em
              contato e, quando combinarem, marque como agendado.
            </Aviso>
          )}
          {veiculo.dono?.telefone && (
            <a
              href={linkWhatsApp(
                veiculo.dono.telefone,
                `Olá, ${veiculo.dono.nome?.split(" ")[0] ?? ""}! Aqui é da Sempre Zero, sobre o apontamento “${apontamento.titulo}” no seu ${nomeVeiculo(veiculo)}.`,
              )}
              target="_blank"
              rel="noreferrer"
              className="botao-contorno w-full text-sm"
            >
              Falar com o cliente no WhatsApp
            </a>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {apontamento.situacao !== "agendado" && apontamento.situacao !== "concluido" && (
              <form action={mudarSituacaoApontamento}>
                <input type="hidden" name="id" value={apontamento.id} />
                <input type="hidden" name="situacao" value="agendado" />
                <button type="submit" className="botao-escuro w-full text-sm">Marcar como agendado</button>
              </form>
            )}
            {apontamento.situacao !== "concluido" && (
              <form action={mudarSituacaoApontamento}>
                <input type="hidden" name="id" value={apontamento.id} />
                <input type="hidden" name="situacao" value="concluido" />
                <button type="submit" className="botao-primario w-full text-sm">Marcar como concluído</button>
              </form>
            )}
            {!sit.aberto || apontamento.situacao === "agendado" ? (
              <form action={mudarSituacaoApontamento}>
                <input type="hidden" name="id" value={apontamento.id} />
                <input type="hidden" name="situacao" value="pendente" />
                <button type="submit" className="botao-contorno w-full text-sm">Reabrir</button>
              </form>
            ) : null}
          </div>
          {apontamento.situacao === "concluido" && (
            <p className="text-sm text-suave">
              Dica: registre o serviço realizado no histórico do veículo para o cliente ver o que foi feito.
            </p>
          )}
          <form action={excluirApontamento}>
            <input type="hidden" name="id" value={apontamento.id} />
            <input type="hidden" name="veiculo_id" value={id} />
            <BotaoExcluir mensagem="Excluir este apontamento?">Excluir apontamento</BotaoExcluir>
          </form>
        </Cartao>
      )}
    </div>
  );
}
