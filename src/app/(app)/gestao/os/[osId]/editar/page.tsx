import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PaginaFicha } from "@/components/PaginaFicha";
import { exigirAdmin } from "@/lib/auth";
import { placaConfigurada } from "@/lib/consulta-placa";
import { obterOS } from "@/lib/gestao-dados";
import { FormOS } from "../../FormOS";
import { opcoesFormOS } from "../../opcoes";

export const metadata: Metadata = { title: "Editar OS" };

export default async function EditarOSPage({ params }: PageProps<"/gestao/os/[osId]/editar">) {
  const [{ osId }] = await Promise.all([params, exigirAdmin()]);
  const os = await obterOS(osId);
  if (!os) notFound();
  if (os.pago || os.fatura_id || !["aberta", "em_andamento"].includes(os.status)) redirect(`/gestao/os/${os.id}`);
  const { clientes, catalogo } = await opcoesFormOS();

  return (
    <PaginaFicha voltar={{ href: `/gestao/os/${os.id}`, rotulo: `OS #${os.numero}` }} icone="os" titulo={`Editar OS #${os.numero}`}>
      <FormOS
        clientes={clientes}
        catalogo={catalogo}
        placaApi={placaConfigurada()}
        inicial={{
          id: os.id,
          clienteId: os.cliente_id,
          veiculoId: os.veiculo_id,
          itens: os.itens,
          desconto: os.desconto,
          data: os.data,
          km: os.km,
          observacoes: os.observacoes,
        }}
      />
    </PaginaFicha>
  );
}
