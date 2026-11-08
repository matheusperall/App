import type { Metadata } from "next";
import * as webpush from "web-push";
import { Voltar } from "@/components/garagem";
import { Cartao } from "@/components/ui";
import { exigirAdmin } from "@/lib/auth";
import { emailConfigurado, pushConfigurado } from "@/lib/notificar";
import { CopiarTexto } from "./CopiarTexto";

export const metadata: Metadata = { title: "Configurações" };

function Status({ ok, sim, nao }: { ok: boolean; sim: string; nao: string }) {
  return <p className={`text-sm font-semibold ${ok ? "text-sucesso" : "text-perigo"}`}>{ok ? `✅ ${sim}` : `❌ ${nao}`}</p>;
}

export default async function ConfiguracoesPage() {
  await exigirAdmin();
  const push = pushConfigurado();
  const email = emailConfigurado();
  // Par de chaves novo a cada visita; só é usado se você copiar para a Vercel.
  const chaves = push ? null : webpush.generateVAPIDKeys();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Voltar href="/painel">Painel</Voltar>
      <h1 className="text-2xl font-bold">Configurações</h1>

      <Cartao className="space-y-3">
        <h2 className="font-semibold">🔔 Notificações no celular</h2>
        <Status ok={push} sim="Configuradas" nao="Ainda não configuradas" />
        {chaves && (
          <>
            <p className="text-sm text-suave">
              Geramos as duas chaves abaixo para o seu app. Cadastre-as na Vercel em{" "}
              <strong>Settings › Environments › Production › Environment Variables</strong> e depois faça um{" "}
              <strong>Redeploy</strong>. Use o tipo <strong>Config</strong> para a primeira e <strong>Secret</strong> para a segunda.
            </p>
            <CopiarTexto rotulo="NEXT_PUBLIC_VAPID_PUBLIC_KEY" valor={chaves.publicKey} />
            <CopiarTexto rotulo="VAPID_PRIVATE_KEY" valor={chaves.privateKey} secreto />
            <p className="text-xs text-suave">
              A chave privada é secreta: não envie para ninguém. Se recarregar esta página, um novo par é gerado; use as
              duas do mesmo par.
            </p>
          </>
        )}
      </Cartao>

      <Cartao className="space-y-3">
        <h2 className="font-semibold">✉️ E-mails de aviso</h2>
        <Status ok={email} sim="Configurados" nao="Ainda não configurados" />
        {!email && (
          <ol className="list-decimal space-y-1 pl-5 text-sm text-suave">
            <li>Crie uma conta grátis em <strong>resend.com</strong> (até 3.000 e-mails por mês).</li>
            <li>Em <strong>API Keys</strong>, crie uma chave e copie.</li>
            <li>Na Vercel, cadastre <code>RESEND_API_KEY</code> (tipo Secret) com essa chave e faça Redeploy.</li>
            <li>
              Para enviar para qualquer cliente, verifique o domínio da empresa no Resend e cadastre também{" "}
              <code>EMAIL_REMETENTE</code>, por exemplo <code>Sempre Zero &lt;avisos@seudominio.com.br&gt;</code>. Sem domínio
              próprio, o Resend só envia para o seu próprio e-mail (bom para testar).
            </li>
          </ol>
        )}
        <p className="text-xs text-suave">Mesmo sem e-mail ou push, todos os avisos aparecem na aba Avisos do app.</p>
      </Cartao>
    </div>
  );
}
