import type { Metadata } from "next";
import { Cabecalho } from "@/components/gestao/Cabecalho";
import { abasPainel } from "../abas";
import * as webpush from "web-push";
import { Cartao } from "@/components/ui";
import { exigirAdmin } from "@/lib/auth";
import { emailConfigurado, pushConfigurado } from "@/lib/notificar";
import { CopiarTexto } from "./CopiarTexto";
import { lembretesConfigurados } from "@/lib/env";
import { ExecutarLembretes } from "./ExecutarLembretes";
import { TestarGoogle } from "./TestarGoogle";
import { emailContaServico, googleConfigurado } from "@/lib/google-agenda";
import { randomBytes } from "node:crypto";

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
  const lembretes = lembretesConfigurados();
  const segredoCron = lembretes ? null : randomBytes(24).toString("base64url");

  return (
    <div className="space-y-4">
      <Cabecalho icone="painel" titulo="Painel" abas={abasPainel("configuracoes")} />
      <div className="mx-auto max-w-2xl space-y-5">
      <h2 className="text-xl font-bold">Configurações</h2>

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
        <h2 className="font-semibold">📅 Google Agenda</h2>
        <Status ok={googleConfigurado()} sim="Conectada" nao="Ainda não conectada" />
        {googleConfigurado() ? (
          <>
            <p className="text-sm text-suave">
              Os agendamentos confirmados aparecem na sua agenda (lavagens de 2 horas, até 2 veículos por horário). Para
              bloquear um horário (folga, feriado), crie um evento comum, marcado como “ocupado”, na sua agenda.
            </p>
            <p className="text-xs text-suave">Conta de serviço: <code>{emailContaServico()}</code></p>
            <TestarGoogle />
          </>
        ) : (
          <p className="text-sm text-suave">
            Siga o passo a passo do arquivo <code>docs/GOOGLE_AGENDA.md</code> no GitHub (ou peça ajuda no chat). Ao final,
            cadastre <code>GOOGLE_SERVICE_ACCOUNT_JSON</code> e <code>GOOGLE_CALENDAR_ID</code> na Vercel.
          </p>
        )}
      </Cartao>

      <Cartao className="space-y-3">
        <h2 className="font-semibold">⏰ Lembretes automáticos</h2>
        <Status ok={lembretes} sim="Ativados — rodam todo dia por volta das 8h" nao="Ainda não ativados" />
        <p className="text-sm text-suave">
          Todo dia o app verifica manutenções e documentos de todos os clientes e avisa quem estiver com algo vencendo
          (30 dias, 7 dias, 1 dia antes e no dia).
        </p>
        {segredoCron && (
          <>
            <p className="text-sm text-suave">
              Para ativar, cadastre esta senha na Vercel (tipo <strong>Secret</strong>) e faça <strong>Redeploy</strong>:
            </p>
            <CopiarTexto rotulo="CRON_SECRET" valor={segredoCron} secreto />
          </>
        )}
        {lembretes && <ExecutarLembretes />}
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
    </div>
  );
}
