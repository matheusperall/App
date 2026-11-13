import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Voltar } from "@/components/garagem";
import { Aviso, Cartao } from "@/components/ui";
import { horariosDisponiveis } from "@/lib/agenda-servidor";
import { exigirUsuario } from "@/lib/auth";
import { listarVeiculos, obterApontamento, obterOrcamento, obterVeiculo } from "@/lib/dados";
import { hojeISO, nomeVeiculo } from "@/lib/garagem";
import { FormAgendar } from "./FormAgendar";
import { EscolherVeiculo } from "@/components/EscolherVeiculo";

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

  // Empresa sem veículo escolhido: primeiro escolhe o veículo do cliente
  if (usuario.papel === "admin" && !origemVeiculo && !param("veiculo")) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Voltar href="/agendamentos">Agenda</Voltar>
        <h1 className="text-2xl font-bold">Novo agendamento</h1>
        <EscolherVeiculo busca={param("q").trim()} destino="/agendamentos/novo" />
      </div>
    );
  }

  const veiculos = await listarVeiculos(usuario.id);
  // A empresa pode agendar para o veículo de um cliente (ex.: pedido por telefone)
  const alvo = origemVeiculo || param("veiculo");
  if (usuario.papel === "admin" && alvo && !veiculos.some((v) => v.id === alvo)) {
    const v = await obterVeiculo(alvo);
    if (v) veiculos.unshift(v);
  }
  if (veiculos.length === 0) notFound();
  const veiculoInicial = [origemVeiculo, param("veiculo")].find((id) => id && veiculos.some((v) => v.id === id)) ?? veiculos[0].id;

  const servicoInicial = orcamento
    ? `${orcamento.itens.map((i) => i.descricao).join(", ").slice(0, 180) || orcamento.pedido?.slice(0, 180) || "Serviço"} (orçamento #${orcamento.numero})`
    : apontamento?.titulo ?? "";
  const { dias, aviso } = await horariosDisponiveis();

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Voltar href="/agendamentos">Agenda</Voltar>
      <h1 className="text-2xl font-bold">Agendar</h1>
      {aviso && <Aviso tipo="alerta">{aviso}</Aviso>}
      <Cartao>
        <FormAgendar
          veiculos={veiculos.map((v) => ({
            id: v.id,
            nome: `${nomeVeiculo(v)} (${v.placa})${"dono" in v && v.dono && v.dono_id !== usuario.id ? ` · ${(v.dono as { nome: string }).nome}` : ""}`,
          }))}
          veiculoInicial={veiculoInicial}
          dias={dias}
          hoje={hojeISO()}
          servicoInicial={servicoInicial}
          categoriaInicial={orcamento?.categoria ?? apontamento?.categoria ?? "estetica"}
          orcamentoId={orcamento?.id}
          apontamentoId={apontamento?.id}
        />
      </Cartao>
    </div>
  );
}
