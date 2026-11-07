import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BotaoExcluir } from "@/components/BotaoExcluir";
import { SeloPrestador, Voltar } from "@/components/garagem";
import { Cartao } from "@/components/ui";
import { exigirUsuario } from "@/lib/auth";
import { obterServico, urlsDasFotos } from "@/lib/dados";
import { CATEGORIAS, formatarData, formatarKm, formatarValor } from "@/lib/garagem";
import { excluirServico } from "../../../actions";

export const metadata: Metadata = { title: "Serviço" };

export default async function ServicoPage({ params }: PageProps<"/garagem/[id]/servicos/[servicoId]">) {
  const [{ id, servicoId }, usuario] = await Promise.all([params, exigirUsuario()]);
  const servico = await obterServico(servicoId);
  if (!servico || servico.veiculo_id !== id) notFound();
  const fotos = await urlsDasFotos(servico.fotos);
  const podeExcluir = usuario.papel === "admin" || !servico.pela_empresa;
  const cat = CATEGORIAS[servico.categoria];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Voltar href={`/garagem/${id}`}>Voltar ao veículo</Voltar>
      <Cartao className="space-y-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm text-suave">
            <span>{cat.icone} {cat.rotulo}</span>
            <SeloPrestador servico={servico} />
          </div>
          <h1 className="text-2xl font-bold">{servico.titulo}</h1>
        </div>
        <dl className="grid grid-cols-3 gap-3 rounded-xl bg-fundo p-4 text-sm">
          <div><dt className="text-suave">Data</dt><dd className="font-semibold">{formatarData(servico.data)}</dd></div>
          <div><dt className="text-suave">Km</dt><dd className="font-semibold">{formatarKm(servico.km)}</dd></div>
          <div><dt className="text-suave">Valor</dt><dd className="font-semibold">{formatarValor(servico.valor)}</dd></div>
        </dl>
        {servico.descricao && <p className="whitespace-pre-line text-suave">{servico.descricao}</p>}
        {servico.fotos.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {servico.fotos.map((f) =>
              fotos[f] ? (
                <a key={f} href={fotos[f]} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-xl bg-borda">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fotos[f]} alt="Foto do serviço" className="h-full w-full object-cover" />
                </a>
              ) : null,
            )}
          </div>
        )}
      </Cartao>
      {podeExcluir && (
        <form action={excluirServico}>
          <input type="hidden" name="id" value={servico.id} />
          <input type="hidden" name="veiculo_id" value={id} />
          <BotaoExcluir mensagem="Excluir este serviço do histórico?">Excluir do histórico</BotaoExcluir>
        </form>
      )}
    </div>
  );
}
