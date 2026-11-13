import type { Metadata } from "next";
import { Cabecalho } from "@/components/gestao/Cabecalho";
import { abasPainel } from "../abas";
import { Cartao } from "@/components/ui";
import { exigirAdmin } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { formatarDataHora } from "@/lib/garagem";
import { emailConfigurado, pushConfigurado } from "@/lib/notificar";
import { createClient } from "@/lib/supabase/server";
import { FormComunicado } from "./FormComunicado";
import { TIPOS_COMUNICADO, type TipoComunicado } from "./tipos";

export const metadata: Metadata = { title: "Comunicados" };

type Enviado = { id: string; tipo: TipoComunicado; titulo: string; mensagem: string; destinatarios: number; por_email: boolean; criado_em: string };

async function dados() {
  if (!isSupabaseConfigured) return { clientes: 1, historico: [] as Enviado[] };
  const supabase = await createClient();
  const [c, h] = await Promise.all([
    supabase.from("perfis").select("id", { count: "exact", head: true }).eq("papel", "cliente"),
    supabase.from("comunicados").select("id, tipo, titulo, mensagem, destinatarios, por_email, criado_em").order("criado_em", { ascending: false }).limit(30),
  ]);
  return { clientes: c.count ?? 0, historico: (h.data as Enviado[] | null) ?? [] };
}

export default async function ComunicadosPage() {
  await exigirAdmin();
  const { clientes, historico } = await dados();

  return (
    <div className="space-y-4">
      <Cabecalho icone="atendimento" titulo="Atendimento" abas={abasPainel("comunicados")} />
      <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">Comunicados</h2>
        <p className="text-suave">
          Envie novidades, promoções, lembretes e oportunidades para todos os clientes ({clientes}). Chega na aba Avisos
          do app{pushConfigurado() ? ", como notificação no celular" : ""}
          {emailConfigurado() ? " e, se você marcar, por e-mail" : ""}.
        </p>
      </div>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <div className="min-w-0 space-y-4">
        <Cartao>
          <FormComunicado clientes={clientes} emailDisponivel={emailConfigurado()} />
        </Cartao>
        </div>
        <div className="min-w-0 space-y-4">
        <section className="space-y-2">
          <h2 className="font-semibold">Enviados</h2>
          {historico.length === 0 ? (
            <p className="text-sm text-suave">Nenhum comunicado enviado ainda.</p>
          ) : (
            <Cartao className="p-0">
              <ul className="divide-y divide-borda">
                {historico.map((c) => (
                  <li key={c.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium">{TIPOS_COMUNICADO[c.tipo]?.icone} {c.titulo}</p>
                      <span className="shrink-0 text-xs text-suave">{formatarDataHora(c.criado_em)}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-suave">{c.mensagem}</p>
                    <p className="mt-1 text-xs text-suave">
                      {c.destinatarios} {c.destinatarios === 1 ? "cliente" : "clientes"}{c.por_email ? " · com e-mail" : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </Cartao>
          )}
        </section>
        </div>
      </div>

      </div>
    </div>
  );
}
