import { redirect } from "next/navigation";

// A lista de clientes agora fica na Gestão (inclui clientes sem login no app).
export default async function ClientesPage({ searchParams }: PageProps<"/painel/clientes">) {
  const sp = await searchParams;
  redirect(typeof sp.q === "string" && sp.q ? `/gestao/clientes?q=${encodeURIComponent(sp.q)}` : "/gestao/clientes");
}
