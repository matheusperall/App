import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Voltar } from "@/components/garagem";
import { exigirUsuario } from "@/lib/auth";
import { listarDocumentosVeiculos, obterVeiculo } from "@/lib/dados";
import { TIPOS_DOCUMENTO, nomeVeiculo, type TipoDocumento } from "@/lib/garagem";
import { FormDocumento } from "@/components/FormDocumento";

export const metadata: Metadata = { title: "Documentos e vencimentos" };

const DO_VEICULO = (Object.keys(TIPOS_DOCUMENTO) as TipoDocumento[]).filter((t) => TIPOS_DOCUMENTO[t].doVeiculo && t !== "outro");

export default async function DocumentosPage({ params }: PageProps<"/garagem/[id]/documentos">) {
  const [{ id }] = await Promise.all([params, exigirUsuario()]);
  const veiculo = await obterVeiculo(id);
  if (!veiculo) notFound();
  const documentos = await listarDocumentosVeiculos([id]);
  const outros = documentos.filter((d) => d.tipo === "outro");

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Voltar href={`/garagem/${id}`}>{nomeVeiculo(veiculo)}</Voltar>
      <div>
        <h1 className="text-2xl font-bold">Documentos e vencimentos</h1>
        <p className="text-suave">
          Informe as datas e avisamos 30 dias, 7 dias e 1 dia antes de vencer. Assim você não paga multa por
          esquecimento.
        </p>
      </div>
      <div className="space-y-3">
        {DO_VEICULO.map((t) => (
          <FormDocumento key={t} tipo={t} veiculoId={id} atual={documentos.find((d) => d.tipo === t) ?? null} />
        ))}
        {outros.map((d) => (
          <FormDocumento key={d.id} tipo="outro" veiculoId={id} atual={d} />
        ))}
        <FormDocumento tipo="outro" veiculoId={id} atual={null} novoOutro />
      </div>
    </div>
  );
}
