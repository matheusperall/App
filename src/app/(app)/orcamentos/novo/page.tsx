import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Voltar } from "@/components/garagem";
import { Cartao } from "@/components/ui";
import { exigirUsuario } from "@/lib/auth";
import { listarVeiculos, obterVeiculo } from "@/lib/dados";
import { hojeISO, nomeVeiculo, somarDias } from "@/lib/garagem";
import { FormPedido } from "./FormPedido";
import { FormResposta } from "../[orcamentoId]/FormResposta";

export const metadata: Metadata = { title: "Orçamento" };

export default async function NovoOrcamentoPage({ searchParams }: PageProps<"/orcamentos/novo">) {
  const [usuario, sp] = await Promise.all([exigirUsuario(), searchParams]);
  const veiculoParam = typeof sp.veiculo === "string" ? sp.veiculo : "";

  // Empresa: envia um orçamento por iniciativa própria para o veículo do cliente
  if (usuario.papel === "admin" && veiculoParam) {
    const veiculo = await obterVeiculo(veiculoParam);
    if (!veiculo) notFound();
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Voltar href={`/garagem/${veiculo.id}`}>{nomeVeiculo(veiculo)}</Voltar>
        <div>
          <h1 className="text-2xl font-bold">Enviar orçamento</h1>
          <p className="text-suave">Para {veiculo.dono?.nome ?? "o cliente"} · {nomeVeiculo(veiculo)} ({veiculo.placa}). O cliente é avisado e pode aprovar pelo app.</p>
        </div>
        <Cartao>
          <FormResposta veiculoId={veiculo.id} validadePadrao={somarDias(hojeISO(), 15)} novo />
        </Cartao>
      </div>
    );
  }

  const veiculos = await listarVeiculos(usuario.id);
  if (veiculos.length === 0) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Voltar href="/orcamentos">Orçamentos</Voltar>
      <div>
        <h1 className="text-2xl font-bold">Pedir orçamento</h1>
        <p className="text-suave">Conte o que precisa e mande fotos. Respondemos com valor e prazo aqui no app.</p>
      </div>
      <Cartao>
        <FormPedido
          veiculos={veiculos.map((v) => ({ id: v.id, nome: `${nomeVeiculo(v)} (${v.placa})`, donoId: v.dono_id }))}
          veiculoInicial={veiculos.some((v) => v.id === veiculoParam) ? veiculoParam : veiculos[0].id}
        />
      </Cartao>
    </div>
  );
}
