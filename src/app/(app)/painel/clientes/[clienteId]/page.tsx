import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CartaoVeiculo, Voltar } from "@/components/garagem";
import { Aviso, Cartao } from "@/components/ui";
import { exigirAdmin } from "@/lib/auth";
import { ReenviarAcesso } from "./ReenviarAcesso";
import { listarApontamentos, listarDocumentosVeiculos, listarManutencoes, listarVeiculos, obterCliente, urlsDasFotos } from "@/lib/dados";

export const metadata: Metadata = { title: "Cliente" };

function linkWhatsApp(telefone: string) {
  const n = telefone.replace(/\D/g, "");
  return `https://wa.me/${n.length <= 11 ? `55${n}` : n}`;
}

export default async function ClientePage({ params, searchParams }: PageProps<"/painel/clientes/[clienteId]">) {
  const [{ clienteId }, sp] = await Promise.all([params, searchParams, exigirAdmin()]);
  const cliente = await obterCliente(clienteId);
  if (!cliente) notFound();
  const veiculos = await listarVeiculos(cliente.id);
  const [manutencoes, apontamentos, documentos, fotos] = await Promise.all([
    listarManutencoes(veiculos.map((v) => v.id)),
    listarApontamentos(veiculos.map((v) => v.id)),
    listarDocumentosVeiculos(veiculos.map((v) => v.id)),
    urlsDasFotos(veiculos.map((v) => v.foto)),
  ]);

  return (
    <div className="space-y-5">
      <Voltar href="/painel/clientes">Clientes</Voltar>
      {sp.novo && <Aviso tipo="sucesso">Cliente cadastrado! O convite foi enviado para {cliente.email}.</Aviso>}
      {sp.existente && <Aviso>Este e-mail já tinha cadastro. Abrimos a ficha do cliente.</Aviso>}

      <Cartao className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{cliente.nome || "Sem nome"}</h1>
          <p className="text-suave">{[cliente.email, cliente.telefone].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="flex flex-col gap-2 sm:w-64">
          {cliente.telefone && (
            <a href={linkWhatsApp(cliente.telefone)} target="_blank" rel="noreferrer" className="botao-contorno w-full text-sm">
              Chamar no WhatsApp
            </a>
          )}
          <ReenviarAcesso clienteId={cliente.id} />
        </div>
      </Cartao>

      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Veículos</h2>
        <Link href={`/garagem/novo?cliente=${cliente.id}`} className="botao-primario px-4 py-2.5 text-sm">+ Veículo</Link>
      </div>

      {veiculos.length === 0 ? (
        <Cartao><p className="text-sm text-suave">Nenhum veículo cadastrado para este cliente.</p></Cartao>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
          {veiculos.map((v) => (
            <CartaoVeiculo key={v.id} veiculo={v} fotoUrl={v.foto ? fotos[v.foto] : undefined} manutencoes={manutencoes.filter((m) => m.veiculo_id === v.id)} apontamentos={apontamentos.filter((a) => a.veiculo_id === v.id)} documentos={documentos.filter((d) => d.veiculo_id === v.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
