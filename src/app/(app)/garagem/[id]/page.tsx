import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FotoVeiculo, ItemApontamento, ItemDocumento, ItemManutencao, ItemServico, Placa, Voltar } from "@/components/garagem";
import { Aviso, Cartao } from "@/components/ui";
import { ItemListaOrcamento } from "@/components/orcamento";
import { exigirUsuario } from "@/lib/auth";
import { listarApontamentos, listarDocumentosVeiculos, listarLeiturasKm, listarOrcamentos, listarManutencoes, listarServicos, obterVeiculo, urlsDasFotos } from "@/lib/dados";
import { PRIORIDADES, REGISTROS_PARA_MEDIA, apontamentoAberto, formatarData, formatarValor, kmEstimado, kmPorMes, nomeVeiculo, registrosFaltando, ritmoDoVeiculo, situacaoManutencao } from "@/lib/garagem";
import { FormKm } from "./FormKm";

export const metadata: Metadata = { title: "Veículo" };

const ORDEM = { vencida: 0, em_breve: 1, em_dia: 2, sem_dados: 3 };

export default async function VeiculoPage({ params, searchParams }: PageProps<"/garagem/[id]">) {
  const [{ id }, sp, usuario] = await Promise.all([params, searchParams, exigirUsuario()]);
  const veiculo = await obterVeiculo(id);
  if (!veiculo) notFound();

  const [servicos, manutencoes, apontamentos, documentos, orcamentos, leituras, fotos] = await Promise.all([
    listarServicos(id),
    listarManutencoes([id]),
    listarApontamentos([id]),
    listarDocumentosVeiculos([id]),
    listarOrcamentos([id]),
    listarLeiturasKm(id),
    urlsDasFotos([veiculo.foto]),
  ]);
  const admin = usuario.papel === "admin";
  const abertos = apontamentos
    .filter(apontamentoAberto)
    .sort((a, b) => PRIORIDADES[a.prioridade].ordem - PRIORIDADES[b.prioridade].ordem);
  const fechados = apontamentos.filter((a) => !apontamentoAberto(a));
  const deOutroDono = veiculo.dono_id !== usuario.id;
  const ritmo = ritmoDoVeiculo(veiculo);
  const temManutencaoPorKm = manutencoes.some((m) => m.proximo_km != null);
  const faltam = registrosFaltando(leituras);
  manutencoes.sort(
    (a, b) =>
      ORDEM[situacaoManutencao(a, veiculo.km_atual, undefined, ritmo).situacao] -
      ORDEM[situacaoManutencao(b, veiculo.km_atual, undefined, ritmo).situacao],
  );

  return (
    <div className="space-y-5">
      {deOutroDono && veiculo.dono ? (
        <Voltar href={`/painel/clientes/${veiculo.dono.id}`}>{veiculo.dono.nome || "Cliente"}</Voltar>
      ) : (
        <Voltar href="/garagem">Minha garagem</Voltar>
      )}

      {sp.registrado && <Aviso tipo="sucesso">Serviço registrado no histórico.</Aviso>}
      {sp.apontado && <Aviso tipo="sucesso">Apontamento registrado. O cliente foi avisado.</Aviso>}

      <div className="overflow-hidden rounded-2xl border border-borda bg-white lg:grid lg:grid-cols-[1.1fr_1fr] [&>*]:min-w-0">
        <FotoVeiculo url={veiculo.foto ? fotos[veiculo.foto] : undefined} className="aspect-[16/9] w-full lg:aspect-auto lg:h-full" />
        <div className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold">{nomeVeiculo(veiculo)}</h1>
              <p className="text-suave">
                {[veiculo.apelido && `${veiculo.marca} ${veiculo.modelo}`, veiculo.ano, veiculo.combustivel, veiculo.cor].filter(Boolean).join(" · ")}
              </p>
              {veiculo.valor_fipe != null && (
                <p className="mt-1 text-sm">
                  <span className="text-suave">Valor FIPE:</span> <strong>{formatarValor(veiculo.valor_fipe)}</strong>
                  {veiculo.fipe_referencia && <span className="text-xs text-suave"> · ref. {veiculo.fipe_referencia}</span>}
                </p>
              )}
            </div>
            <Placa placa={veiculo.placa} />
          </div>
          {deOutroDono && veiculo.dono && (
            <p className="text-sm text-suave">
              Proprietário: <strong className="text-texto">{veiculo.dono.nome}</strong>
            </p>
          )}
          <FormKm veiculoId={veiculo.id} kmAtual={veiculo.km_atual} />
          <p className="text-xs text-suave">Quilometragem atualizada em {formatarData(veiculo.km_atualizado_em)}</p>
          {ritmo.kmPorDia ? (
            <p className="text-xs text-suave">
              Ritmo de uso: <strong className="text-texto">~{kmPorMes(ritmo.kmPorDia).toLocaleString("pt-BR")} km/mês</strong> · km estimado hoje:{" "}
              {kmEstimado(ritmo).toLocaleString("pt-BR")} km
            </p>
          ) : (
            temManutencaoPorKm && (
              <div className="rounded-xl border border-marca/30 bg-marca-clara/60 p-3 text-sm">
                <p className="font-semibold text-tinta">Ajude a prever suas manutenções por km</p>
                <p className="text-suave">
                  Atualize a quilometragem uma vez por mês. Com {REGISTROS_PARA_MEDIA} registros calculamos o seu ritmo de uso e
                  avisamos a data certa da próxima troca.{" "}
                  <strong className="text-texto">
                    {REGISTROS_PARA_MEDIA - faltam} de {REGISTROS_PARA_MEDIA} registros
                  </strong>
                </p>
              </div>
            )
          )}
          <div className="space-y-2 pt-1">
            <div className="flex gap-2">
              {admin && (
                <Link href={`/garagem/${veiculo.id}/apontamentos/novo`} className="botao-escuro flex-1 px-3 text-sm">
                  + Apontamento
                </Link>
              )}
              <Link href={`/garagem/${veiculo.id}/servicos/novo`} className="botao-primario flex-1 px-3 text-sm">
                + Registrar serviço
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Link href={`/agendamentos/novo?veiculo=${veiculo.id}`} className="botao-contorno px-2 py-2.5 text-sm">
                Agendar
              </Link>
              <Link href={`/orcamentos/novo?veiculo=${veiculo.id}`} className="botao-contorno px-2 py-2.5 text-sm">
                Orçamento
              </Link>
              <Link href={`/garagem/${veiculo.id}/editar`} className="botao-contorno px-2 py-2.5 text-sm">
                Editar
              </Link>
            </div>
          </div>
        </div>
      </div>

      {(abertos.length > 0 || admin) && (
        <Cartao className={abertos.length > 0 ? "border-tinta/20" : ""}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">📍 Apontamentos {abertos.length > 0 && <span className="text-suave">({abertos.length})</span>}</h2>
            {admin && (
              <Link href={`/garagem/${veiculo.id}/apontamentos/novo`} className="text-sm font-semibold text-marca-escura hover:underline">
                + Novo
              </Link>
            )}
          </div>
          {abertos.length === 0 ? (
            <p className="mt-2 text-sm text-suave">Nenhum apontamento em aberto.</p>
          ) : (
            <>
              {!admin && (
                <p className="mt-1 text-sm text-suave">
                  Itens que a nossa equipe identificou no seu veículo. Toque para ver, pedir orçamento ou agendar.
                </p>
              )}
              <ul className="-mx-2 mt-1">
                {abertos.map((a) => (
                  <ItemApontamento key={a.id} a={a} empresa={admin} />
                ))}
              </ul>
            </>
          )}
          {fechados.length > 0 && (
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-suave">Ver {fechados.length} {fechados.length === 1 ? "anterior" : "anteriores"}</summary>
              <ul className="-mx-2 mt-1">
                {fechados.map((a) => (
                  <ItemApontamento key={a.id} a={a} empresa={admin} />
                ))}
              </ul>
            </details>
          )}
        </Cartao>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr] [&>*]:min-w-0">
        <Cartao>
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Próximas manutenções</h2>
            <Link href={`/garagem/${veiculo.id}/manutencoes`} className="text-sm font-semibold text-marca-escura hover:underline">
              Ajustar
            </Link>
          </div>
          {manutencoes.length === 0 ? (
            <p className="mt-3 text-sm text-suave">
              Nenhum lembrete ainda. Eles são criados quando um serviço como troca de óleo é registrado, ou você
              pode{" "}
              <Link href={`/garagem/${veiculo.id}/manutencoes`} className="font-semibold text-marca-escura underline">
                configurar agora
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y divide-borda">
              {manutencoes.map((m) => (
                <ItemManutencao key={m.id} m={m} kmAtual={veiculo.km_atual} ritmo={ritmo} />
              ))}
            </ul>
          )}
        </Cartao>

        <Cartao>
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Documentos e vencimentos</h2>
            <Link href={`/garagem/${veiculo.id}/documentos`} className="text-sm font-semibold text-marca-escura hover:underline">
              {documentos.length ? "Editar" : "Informar"}
            </Link>
          </div>
          {documentos.length === 0 ? (
            <p className="mt-3 text-sm text-suave">
              Informe o vencimento do licenciamento, IPVA e seguro e avisamos antes de vencer.
            </p>
          ) : (
            <ul className="divide-y divide-borda">
              {documentos.map((d) => (
                <ItemDocumento key={d.id} d={d} />
              ))}
            </ul>
          )}
        </Cartao>

        {orcamentos.length > 0 && (
          <Cartao className="p-0 lg:col-span-2">
            <h2 className="px-5 pt-5 font-semibold">Orçamentos</h2>
            <ul className="mt-1 divide-y divide-borda">
              {orcamentos.slice(0, 5).map((o) => (
                <ItemListaOrcamento key={o.id} o={o} empresa={admin} />
              ))}
            </ul>
          </Cartao>
        )}

        <Cartao className="lg:col-span-2">
          <h2 className="font-semibold">Histórico de serviços</h2>
          {servicos.length === 0 ? (
            <p className="mt-3 text-sm text-suave">Nenhum serviço registrado ainda.</p>
          ) : (
            <ul className="-mx-2 mt-1">
              {servicos.map((s) => (
                <ItemServico key={s.id} servico={s} veiculoId={veiculo.id} />
              ))}
            </ul>
          )}
        </Cartao>
      </div>
    </div>
  );
}
