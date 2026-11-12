import type { Metadata } from "next";
import { Bloco } from "@/components/gestao/Bloco";
import { Cabecalho } from "@/components/gestao/Cabecalho";
import Link from "next/link";
import { sair } from "@/app/(auth)/actions";
import { exigirUsuario } from "@/lib/auth";
import { FormPerfil } from "./FormPerfil";

export const metadata: Metadata = { title: "Minha conta" };

export default async function ContaPage() {
  const usuario = await exigirUsuario();

  return (
    <div className="space-y-4">
      <Cabecalho icone="usuario" titulo="Minha conta" />
      <Link href="/garagem" className="flex items-center justify-between gap-3 rounded-2xl border border-borda bg-white p-4 transition hover:border-marca/50">
        <span>
          <span className="block font-semibold">🚗 Minha garagem</span>
          <span className="text-sm text-suave">Seus veículos, histórico, lembretes, documentos e a sua CNH</span>
        </span>
        <span className="text-xl text-suave" aria-hidden="true">›</span>
      </Link>
      <div className="grid items-start gap-4 lg:grid-cols-2">
      <Bloco icone="usuario" titulo="Dados pessoais" direita={<Link href="/garagem#cnh" className="text-xs font-semibold text-marca-escura">A CNH agora fica na Minha garagem</Link>}>
        <FormPerfil nome={usuario.nome} telefone={usuario.telefone ?? ""} email={usuario.email} />
      </Bloco>

      <div className="space-y-4">

      <Bloco icone="chave" titulo="Segurança">
        <div className="space-y-3">
        <Link href="/redefinir-senha" className="botao-contorno w-full">
          Alterar senha
        </Link>
        <form action={sair}>
          <button type="submit" className="botao w-full text-perigo hover:bg-perigo-claro">
            Sair da conta
          </button>
        </form>
        </div>
      </Bloco>
      </div>
      </div>

      <p className="text-center text-sm text-suave">
        <Link href="/privacidade" className="hover:underline">Privacidade</Link>
        {" · "}
        <Link href="/termos" className="hover:underline">Termos de uso</Link>
      </p>
    </div>
  );
}
