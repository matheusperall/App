import type { Metadata } from "next";
import { Bloco } from "@/components/gestao/Bloco";
import { Cabecalho } from "@/components/gestao/Cabecalho";
import Link from "next/link";
import { AtivarNotificacoes } from "@/components/AtivarNotificacoes";
import { exigirUsuario } from "@/lib/auth";
import { listarNotificacoes } from "@/lib/dados";
import { isSupabaseConfigured } from "@/lib/env";
import { formatarDataHora } from "@/lib/garagem";
import { vapidPublica } from "@/lib/notificar";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Avisos" };

export default async function NotificacoesPage() {
  const usuario = await exigirUsuario();
  const avisos = await listarNotificacoes(usuario.id);

  // Ao abrir a página, os avisos passam a contar como lidos
  if (isSupabaseConfigured && avisos.some((a) => !a.lida_em)) {
    const supabase = await createClient();
    await supabase
      .from("notificacoes")
      .update({ lida_em: new Date().toISOString() })
      .eq("usuario_id", usuario.id)
      .is("lida_em", null);
  }

  return (
    <div className="space-y-4">
      <Cabecalho icone="aviso" titulo="Avisos" />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
      <Bloco icone="aviso" titulo={`Seus avisos${avisos.length ? ` (${avisos.length})` : ""}`} semEspaco className="lg:order-1">
        {avisos.length === 0 ? (
          <p className="p-5 text-sm text-suave">Nenhum aviso por enquanto. Quando houver novidades sobre seus veículos, elas aparecem aqui.</p>
        ) : (
          <ul className="divide-y divide-borda">
            {avisos.map((a) => {
              const conteudo = (
                <div className="flex gap-3 px-5 py-4">
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${a.lida_em ? "bg-transparent" : "bg-marca"}`} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className={a.lida_em ? "font-medium" : "font-semibold"}>{a.titulo}</p>
                      <span className="shrink-0 text-xs text-suave">{formatarDataHora(a.criado_em)}</span>
                    </div>
                    {a.corpo && <p className="mt-0.5 text-sm text-suave">{a.corpo}</p>}
                  </div>
                </div>
              );
              return (
                <li key={a.id}>
                  {a.link ? (
                    <Link href={a.link} className="block transition hover:bg-fundo">{conteudo}</Link>
                  ) : (
                    conteudo
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Bloco>
      <Bloco icone="aviso" titulo="Notificações no celular" className="lg:order-2">
        <AtivarNotificacoes chavePublica={vapidPublica()} />
      </Bloco>
      </div>
    </div>
  );
}
