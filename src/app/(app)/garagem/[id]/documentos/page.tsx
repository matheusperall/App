import type { Metadata } from "next";
import { Cabecalho } from "@/components/gestao/Cabecalho";
import { abasVeiculo } from "../abas";
import { notFound } from "next/navigation";
import { CartaoIpva, CartaoLicenciamento } from "@/components/CalendarioDocumento";
import { FormDocumento } from "@/components/FormDocumento";
import { Voltar } from "@/components/garagem";
import { Aviso } from "@/components/ui";
import { exigirUsuario } from "@/lib/auth";
import { calendarioIpvaAtual, finalPlaca, proximoLicenciamento, temCalendario } from "@/lib/calendarios";
import { listarAnexos, listarDocumentosVeiculos, obterVeiculo } from "@/lib/dados";
import { Anexos } from "@/components/Anexos";
import { Bloco } from "@/components/gestao/Bloco";
import { hojeISO, nomeVeiculo, pastaFotos } from "@/lib/garagem";

export const metadata: Metadata = { title: "Documentos e vencimentos" };

export default async function DocumentosPage({ params }: PageProps<"/garagem/[id]/documentos">) {
  const [{ id }] = await Promise.all([params, exigirUsuario()]);
  const veiculo = await obterVeiculo(id);
  if (!veiculo) notFound();
  const [documentos, anexos] = await Promise.all([listarDocumentosVeiculos([id]), listarAnexos({ veiculoId: id })]);
  const hoje = hojeISO();
  const sp = temCalendario(veiculo.uf);
  const final = finalPlaca(veiculo.placa);
  const doc = (tipo: string) => documentos.find((d) => d.tipo === tipo) ?? null;
  const outros = documentos.filter((d) => d.tipo === "outro");

  return (
    <div className="space-y-4">
      <Voltar href={`/garagem/${id}`}>{nomeVeiculo(veiculo)}</Voltar>
      <Cabecalho icone="carro" titulo={`${nomeVeiculo(veiculo)} · ${veiculo.placa}`} abas={abasVeiculo(id, "documentos")} />
      <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h2 className="text-xl font-bold">Documentos e vencimentos</h2>
        <p className="text-suave">
          {sp
            ? "Licenciamento e IPVA são calculados pelo final da placa, conforme o calendário de São Paulo. "
            : ""}
          Avisamos 30 dias, 7 dias e 1 dia antes de vencer.
        </p>
      </div>
      {!sp && (
        <Aviso>
          Veículo registrado em {veiculo.uf}: o calendário automático está disponível para veículos de SP. Informe as datas
          abaixo.
        </Aviso>
      )}
      <div className="space-y-3">
        {sp ? (
          <>
            <CartaoLicenciamento veiculoId={id} final={final} calendario={proximoLicenciamento(veiculo.placa, hoje)} manual={doc("licenciamento")} />
            <CartaoIpva veiculoId={id} final={final} calendario={calendarioIpvaAtual(veiculo.placa, hoje)} manual={doc("ipva")} hoje={hoje} />
          </>
        ) : (
          <>
            <FormDocumento tipo="licenciamento" veiculoId={id} atual={doc("licenciamento")} />
            <FormDocumento tipo="ipva" veiculoId={id} atual={doc("ipva")} />
          </>
        )}
        <FormDocumento tipo="seguro" veiculoId={id} atual={doc("seguro")} />
        {outros.map((d) => (
          <FormDocumento key={d.id} tipo="outro" veiculoId={id} atual={d} />
        ))}
        <FormDocumento tipo="outro" veiculoId={id} atual={null} novoOutro />
      </div>
      <Bloco icone="documento" titulo={`Arquivos do veículo${anexos.length ? ` (${anexos.length})` : ""}`}>
        <p className="mb-3 text-sm text-suave">Guarde aqui o CRLV-e, a apólice do seguro, a guia do IPVA, notas fiscais e outros documentos (PDF ou foto, até 10 MB).</p>
        <Anexos anexos={anexos} pasta={pastaFotos(veiculo)} veiculoId={id} tipos={["crlv", "seguro", "ipva", "nota_fiscal", "outro"]} />
      </Bloco>
      </div>
    </div>
  );
}
