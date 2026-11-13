import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Aviso, Cartao } from "@/components/ui";
import { horariosDisponiveis } from "@/lib/agenda-servidor";
import { exigirUsuario } from "@/lib/auth";
import { listarVeiculos, obterApontamento, obterOrcamento, obterVeiculo } from "@/lib/dados";
import { hojeISO, nomeVeiculo } from "@/lib/garagem";
import { FormAgendar } from "./FormAgendar";
import { opcoesDeVeiculos } from "@/components/EscolherVeiculo";
import { PaginaFicha } from "@/components/PaginaFicha";

export const metadata: Metadata = { title: "Agendar" };

export default async function NovoAgendamentoPage({ searchParams }: PageProps<"/agendamentos/novo">) {
  const [usuario, sp] = await Promise.all([exigirUsuario(), searchParams]);
  const param = (n: string) => (typeof sp[n] === "string" ? (sp[n] as string) : "");

  // Vindo de um orçamento aprovado ou de um apontamento: serviço já definido
  const [orcamento, apontamento] = await Promise.all([
    param("orcamento") ? obterOrcamento(param("orcamento")) : null,
    param("apontamento") ? obterApontamento(param("apontamento")) : null,
  ]);
  const origemVeiculo = orcamento?.veiculo_id ?? apontamento?.veiculo_id ?? "";

  const veiculos = await listarVeiculos(usuario.id);
  // A empresa pode agendar para o veículo de um cliente (ex.: pedido por telefone)
  const alvo = origemVeiculo || param("veiculo");
  if (usuario.papel === "admin" && alvo && !veiculos.some((v) => v.id === alvo)) {
    const v = await obterVeiculo(alvo);
    if (v) veiculos.unshift(v);
  }
  // Empresa sem veículo definido: escolhe o veículo do cliente no próprio formulário, com busca
  const escolherComBusca = usuario.papel === "admin" && !alvo;
  if (veiculos.length === 0 && !escolherComBusca) notFound();
  const veiculoInicial = escolherComBusca ? "" : ([origemVeiculo, param("veiculo")].find((id) => id && veiculos.some((v) => v.id === id)) ?? veiculos[0].id);

  const servicoInicial = orcamento
    ? `${orcamento.itens.map((i) => i.descricao).join(", ").slice(0, 180) || orcamento.pedido?.slice(0, 180) || "Serviço"} (orçamento #${orcamento.numero})`
    : apontamento?.titulo ?? "";
  const { dias, aviso } = await horariosDisponiveis();

  return (
    <PaginaFicha
      voltar={{ href: "/agendamentos", rotulo: "Agenda" }}
      icone="calendario"
      titulo={usuario.papel === "admin" ? "Novo agendamento" : "Agendar"}
      descricao={usuario.papel === "admin" ? "O cliente recebe a confirmação pelo app." : "Escolha um horário livre para lavagem, ou sugira dias para outros serviços."}
    >
      {aviso && <Aviso tipo="alerta">{aviso}</Aviso>}
      <Cartao>
        <FormAgendar
          veiculos={
            escolherComBusca
              ? await opcoesDeVeiculos()
              : veiculos.map((v) => ({
                  id: v.id,
                  titulo: `${nomeVeiculo(v)} (${v.placa})${"dono" in v && v.dono && v.dono_id !== usuario.id ? ` · ${(v.dono as { nome: string }).nome}` : ""}`,
                }))
          }
          escolherComBusca={escolherComBusca}
          veiculoInicial={veiculoInicial}
          dias={dias}
          hoje={hojeISO()}
          servicoInicial={servicoInicial}
          categoriaInicial={orcamento?.categoria ?? apontamento?.categoria ?? "estetica"}
          orcamentoId={orcamento?.id}
          apontamentoId={apontamento?.id}
        />
      </Cartao>
    </PaginaFicha>
  );
}
