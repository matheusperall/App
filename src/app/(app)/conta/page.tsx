import type { Metadata } from "next";
import Link from "next/link";
import { sair } from "@/app/(auth)/actions";
import { Cartao } from "@/components/ui";
import { exigirUsuario } from "@/lib/auth";
import { FormPerfil } from "./FormPerfil";

export const metadata: Metadata = { title: "Minha conta" };

export default async function ContaPage() {
  const usuario = await exigirUsuario();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-bold sm:text-3xl">Minha conta</h1>

      <Cartao className="space-y-4">
        <h2 className="font-semibold">Dados pessoais</h2>
        <FormPerfil nome={usuario.nome} telefone={usuario.telefone ?? ""} email={usuario.email} />
      </Cartao>

      <Cartao className="space-y-3">
        <h2 className="font-semibold">Segurança</h2>
        <Link href="/redefinir-senha" className="botao-contorno w-full">
          Alterar senha
        </Link>
        <form action={sair}>
          <button type="submit" className="botao w-full text-perigo hover:bg-perigo-claro">
            Sair da conta
          </button>
        </form>
      </Cartao>

      <p className="text-center text-sm text-suave">
        <Link href="/privacidade" className="hover:underline">Privacidade</Link>
        {" · "}
        <Link href="/termos" className="hover:underline">Termos de uso</Link>
      </p>
    </div>
  );
}
