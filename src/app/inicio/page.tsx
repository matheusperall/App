import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getUsuarioAtual } from "@/lib/auth";

/** Porta de entrada do app: a empresa abre na Gestão; o cliente, na Minha garagem. */
export default function InicioPage() {
  return (
    <Suspense fallback={<p className="p-6 text-center text-sm text-suave">Abrindo…</p>}>
      <Encaminhar />
    </Suspense>
  );
}

async function Encaminhar(): Promise<null> {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/entrar");
  redirect(usuario.papel === "admin" ? "/gestao" : "/garagem");
}
