import type { Metadata } from "next";
import { MenuGestao } from "@/components/gestao/MenuGestao";
import { notFound } from "next/navigation";
import { Cartao } from "@/components/ui";
import { exigirUsuario } from "@/lib/auth";
import { listarVeiculos, obterVeiculo } from "@/lib/dados";
import { hojeISO, nomeVeiculo, pastaFotos, somarDias } from "@/lib/garagem";
import { FormPedido } from "./FormPedido";
import { FormResposta } from "../[orcamentoId]/FormResposta";
import { opcoesDeVeiculos } from "@/components/EscolherVeiculo";
import { PaginaFicha } from "@/components/PaginaFicha";
import { listarCatalogo } from "@/lib/gestao-dados";

export const metadata: Metadata = { title: "Orçamento" };

export default async function NovoOrcamentoPage({ searchParams }: PageProps<"/orcamentos/novo">) {
  const [usuario, sp] = await Promise.all([exigirUsuario(), searchParams]);
  const veiculoParam = typeof sp.veiculo === "string" ? sp.veiculo : "";

  // Empresa: envia um orçamento por iniciativa própria para o veículo do cliente
  if (usuario.papel === "admin") {
    const veiculo = veiculoParam ? await obterVeiculo(veiculoParam) : null;
    if (veiculoParam && !veiculo) notFound();
    return (
      <PaginaFicha
        menu={<MenuGestao />}
        voltar={veiculo ? { href: `/garagem/${veiculo.id}`, rotulo: nomeVeiculo(veiculo) } : { href: "/orcamentos", rotulo: "Orçamentos" }}
        icone="orcamento"
        titulo="Novo orçamento"
        descricao={
          veiculo
            ? `Para ${veiculo.dono?.nome ?? "o cliente"} · ${nomeVeiculo(veiculo)} (${veiculo.placa}). O cliente é avisado e pode aprovar pelo app.`
            : "O cliente é avisado e pode aprovar pelo app."
        }
      >
        <Cartao>
          <FormResposta
            veiculoId={veiculo?.id}
            veiculos={veiculo ? undefined : await opcoesDeVeiculos()}
            catalogo={(await listarCatalogo()).filter((c) => c.ativo).map(({ id, nome, preco }) => ({ id, nome, preco }))}
            validadePadrao={somarDias(hojeISO(), 15)}
            novo
          />
        </Cartao>
      </PaginaFicha>
    );
  }

  const veiculos = await listarVeiculos(usuario.id);
  if (veiculos.length === 0) notFound();

  return (
    <PaginaFicha
      voltar={{ href: "/orcamentos", rotulo: "Orçamentos" }}
      icone="orcamento"
      titulo="Pedir orçamento"
      descricao="Conte o que precisa e mande fotos. Respondemos com valor e prazo aqui no app."
    >
      <Cartao>
        <FormPedido
          veiculos={veiculos.map((v) => ({ id: v.id, nome: `${nomeVeiculo(v)} (${v.placa})`, donoId: pastaFotos(v) }))}
          veiculoInicial={veiculos.some((v) => v.id === veiculoParam) ? veiculoParam : veiculos[0].id}
        />
      </Cartao>
    </PaginaFicha>
  );
}
