import { isSupabaseConfigured } from "@/lib/env";
import { Aviso } from "./ui";

/** Aparece enquanto o Supabase ainda não foi configurado (.env.local). */
export function AvisoConfiguracao() {
  if (isSupabaseConfigured) return null;
  return (
    <Aviso tipo="alerta">
      <strong>Modo demonstração:</strong> o banco de dados ainda não foi conectado. As telas podem ser
      visualizadas, mas login e cadastro só funcionam depois da configuração (veja{" "}
      <code>docs/CONFIGURACAO.md</code>).
    </Aviso>
  );
}
