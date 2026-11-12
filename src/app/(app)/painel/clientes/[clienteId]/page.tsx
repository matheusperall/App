import { redirect } from "next/navigation";

// Links antigos usam o id da conta do app; a ficha da Gestão aceita os dois.
export default async function ClientePage({ params }: PageProps<"/painel/clientes/[clienteId]">) {
  const { clienteId } = await params;
  redirect(`/gestao/clientes/${clienteId}`);
}
