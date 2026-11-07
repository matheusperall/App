import type { Metadata } from "next";
import Link from "next/link";
import { Cartao } from "@/components/ui";
import { exigirAdmin } from "@/lib/auth";
import { contarPainel } from "@/lib/dados";

export const metadata: Metadata = { title: "Painel da empresa" };

export default async function PainelPage() {
  await exigirAdmin();
  const { clientes, veiculos } = await contarPainel();

  const indicadores = [
    { rotulo: "Clientes", valor: String(clientes), href: "/painel/clientes" },
    { rotulo: "Veículos", valor: String(veiculos), href: "/painel/clientes" },
    { rotulo: "Apontamentos abertos", valor: "—", href: null },
    { rotulo: "Pedidos novos", valor: "—", href: null },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-suave">Área da empresa</p>
        <h1 className="text-2xl font-bold sm:text-3xl">Painel</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {indicadores.map((i) => {
          const conteudo = (
            <>
              <p className="text-sm text-suave">{i.rotulo}</p>
              <p className="mt-1 font-titulo text-3xl font-bold">{i.valor}</p>
            </>
          );
          return i.href ? (
            <Link key={i.rotulo} href={i.href} className="rounded-2xl border border-borda bg-white p-5 transition hover:border-marca/50">
              {conteudo}
            </Link>
          ) : (
            <Cartao key={i.rotulo}>{conteudo}</Cartao>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/painel/clientes/novo" className="botao-primario">+ Cadastrar cliente</Link>
        <Link href="/painel/clientes" className="botao-contorno">Buscar cliente ou placa</Link>
      </div>
    </div>
  );
}
