"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Aviso } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

const caminhoSeguro = (s: string | null, padrao = "/garagem") => (s && s.startsWith("/") && !s.startsWith("//") ? s : padrao);

function mensagemErro(codigo: string, descricao: string) {
  const c = `${codigo} ${descricao}`.toLowerCase();
  if (c.includes("expired") || c.includes("otp") || c.includes("invalid"))
    return "Este link expirou ou já foi usado. Os links de acesso valem por tempo limitado e só podem ser usados uma vez.";
  if (c.includes("access_denied")) return "O acesso foi negado. Peça um novo link.";
  return "Não foi possível concluir o acesso com este link.";
}

/**
 * Finaliza o acesso vindo de um link de e-mail (convite, recuperação de senha, confirmação de cadastro).
 * O Supabase envia o acesso depois do "#" do endereço, que só o navegador consegue ler.
 */
// O "#..." do endereço (só existe no navegador; no servidor é null)
const lerHash = () => window.location.hash;
const assinarHash = (aviso: () => void) => {
  window.addEventListener("hashchange", aviso);
  return () => window.removeEventListener("hashchange", aviso);
};

export function ConcluirAcesso() {
  const router = useRouter();
  const params = useSearchParams();
  const bruto = useSyncExternalStore(assinarHash, lerHash, () => null);
  const [erroSessao, setErroSessao] = useState("");

  // Erros que já vêm no próprio link
  const hash = new URLSearchParams((bruto ?? "").slice(1));
  const erroLink =
    bruto === null
      ? ""
      : hash.get("error_code") || hash.get("error") || params.get("erro")
        ? mensagemErro(hash.get("error_code") ?? hash.get("error") ?? params.get("erro") ?? "", hash.get("error_description") ?? "")
        : !hash.get("access_token") || !hash.get("refresh_token")
          ? "Este link está incompleto ou já foi usado."
          : "";
  const erro = erroLink || erroSessao;

  useEffect(() => {
    if (bruto === null || erroLink) return;
    const hash = new URLSearchParams(bruto.slice(1));
    const next = caminhoSeguro(params.get("next"));
    const access_token = hash.get("access_token")!;
    const refresh_token = hash.get("refresh_token")!;
    const tipo = hash.get("type");
    let cliente;
    try {
      cliente = createClient();
    } catch {
      Promise.resolve().then(() => setErroSessao("O app ainda não está conectado ao banco de dados."));
      return;
    }
    cliente.auth
      .setSession({ access_token, refresh_token })
      .then(({ error }) => {
        if (error) {
          setErroSessao(mensagemErro(error.code ?? "", error.message));
          return;
        }
        // Convite e recuperação: a pessoa define a senha. Cadastro confirmado: entra no app.
        const destino = tipo === "invite" || tipo === "recovery" ? "/redefinir-senha" : next;
        window.history.replaceState(null, "", window.location.pathname);
        router.replace(destino);
        router.refresh();
      });
  }, [bruto, erroLink, params, router]);

  if (!erro) {
    return (
      <div className="space-y-2 py-8 text-center" aria-busy="true">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-marca/30 border-t-marca" />
        <p className="text-suave">Validando seu acesso…</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Link inválido</h1>
      <Aviso tipo="erro">{erro}</Aviso>
      <div className="space-y-2 text-sm text-suave">
        <p><strong className="text-texto">Recebeu um convite?</strong> Use “Criar nova senha” com o mesmo e-mail do convite: você recebe um link novo na hora.</p>
        <p><strong className="text-texto">Já tem senha?</strong> É só entrar normalmente.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Link href="/recuperar-senha" className="botao-primario">Criar nova senha</Link>
        <Link href="/entrar" className="botao-contorno">Entrar</Link>
      </div>
    </div>
  );
}
