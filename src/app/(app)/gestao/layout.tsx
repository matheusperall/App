import { Aviso } from "@/components/ui";
import { AbasGestao } from "@/components/gestao/Abas";
import { gestaoInstalada } from "@/lib/gestao-dados";

export default async function GestaoLayout({ children }: LayoutProps<"/gestao">) {
  const instalada = await gestaoInstalada();
  return (
    <div className="space-y-5">
      <AbasGestao />
      {!instalada && (
        <Aviso tipo="alerta">
          O banco ainda não recebeu a parte da gestão. Rode o arquivo <strong>supabase/migrations/0010_gestao.sql</strong> no Supabase
          (passo a passo em docs/GESTAO.md). Até lá, estas telas ficam vazias.
        </Aviso>
      )}
      {children}
    </div>
  );
}
