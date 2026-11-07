import type { Metadata } from "next";
import { Cartao } from "@/components/ui";
import { exigirAdmin } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Painel da empresa" };

type Cliente = { id: string; nome: string; email: string | null; telefone: string | null; criado_em: string };

async function carregarClientes(): Promise<{ total: number; recentes: Cliente[] }> {
  if (!isSupabaseConfigured) return { total: 0, recentes: [] };
  const supabase = await createClient();
  const { data, count } = await supabase
    .from("perfis")
    .select("id, nome, email, telefone, criado_em", { count: "exact" })
    .eq("papel", "cliente")
    .order("criado_em", { ascending: false })
    .limit(10);
  return { total: count ?? 0, recentes: data ?? [] };
}

export default async function PainelPage() {
  await exigirAdmin();
  const { total, recentes } = await carregarClientes();

  const indicadores = [
    { rotulo: "Clientes", valor: String(total) },
    { rotulo: "Veículos", valor: "—" },
    { rotulo: "Apontamentos abertos", valor: "—" },
    { rotulo: "Pedidos novos", valor: "—" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-suave">Área da empresa</p>
        <h1 className="text-2xl font-bold sm:text-3xl">Painel</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {indicadores.map((i) => (
          <Cartao key={i.rotulo}>
            <p className="text-sm text-suave">{i.rotulo}</p>
            <p className="mt-1 font-titulo text-3xl font-bold">{i.valor}</p>
          </Cartao>
        ))}
      </div>

      <Cartao className="space-y-4">
        <h2 className="font-semibold">Clientes mais recentes</h2>
        {recentes.length === 0 ? (
          <p className="text-sm text-suave">Nenhum cliente cadastrado ainda.</p>
        ) : (
          <ul className="divide-y divide-borda">
            {recentes.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.nome || "Sem nome"}</p>
                  <p className="truncate text-sm text-suave">{c.email}</p>
                </div>
                <span className="shrink-0 text-xs text-suave">
                  {new Date(c.criado_em).toLocaleDateString("pt-BR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </div>
  );
}
