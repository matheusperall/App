"use client";

import { useEffect, useState } from "react";
import { enviarTeste, removerInscricao, salvarInscricao } from "@/app/(app)/notificacoes/actions";

type Estado =
  | "carregando"
  | "sem-suporte"
  | "ios-instalar" // iPhone: só funciona com o app na tela de início
  | "sem-chave" // servidor sem as chaves VAPID
  | "desativado"
  | "ativado"
  | "bloqueado";

function chaveParaBytes(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

const ehIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const ehInstalado = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

export function AtivarNotificacoes({ chavePublica, compacto = false }: { chavePublica: string; compacto?: boolean }) {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [dispensado, setDispensado] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (compacto && localStorage.getItem("sz-aviso-push-dispensado")) setDispensado(true);
      } catch {}
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setEstado(ehIOS() && !ehInstalado() ? "ios-instalar" : "sem-suporte");
        return;
      }
      if (!chavePublica) return setEstado("sem-chave");
      if (Notification.permission === "denied") return setEstado("bloqueado");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const inscricao = await reg.pushManager.getSubscription();
      if (inscricao && Notification.permission === "granted") {
        // Reenvia ao servidor (caso a conta tenha mudado neste aparelho)
        await salvarInscricao(inscricao.toJSON() as never, navigator.userAgent);
        setEstado("ativado");
      } else setEstado("desativado");
    })().catch(() => setEstado("sem-suporte"));
  }, [chavePublica, compacto]);

  async function ativar() {
    setOcupado(true);
    setMensagem("");
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") {
        setEstado(permissao === "denied" ? "bloqueado" : "desativado");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const inscricao =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(chavePublica) }));
      const r = await salvarInscricao(inscricao.toJSON() as never, navigator.userAgent);
      if (!r.ok) throw new Error(r.erro);
      setEstado("ativado");
      setMensagem("Notificações ativadas neste aparelho.");
    } catch (e) {
      setMensagem(`Não foi possível ativar: ${(e as Error).message || "tente novamente"}`);
    } finally {
      setOcupado(false);
    }
  }

  async function desativar() {
    setOcupado(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const inscricao = await reg.pushManager.getSubscription();
      if (inscricao) {
        await removerInscricao(inscricao.endpoint);
        await inscricao.unsubscribe();
      }
      setEstado("desativado");
      setMensagem("Notificações desativadas neste aparelho.");
    } finally {
      setOcupado(false);
    }
  }

  async function testar() {
    setOcupado(true);
    const r = await enviarTeste();
    setMensagem(r.ok ? "Teste enviado! A notificação deve chegar em alguns segundos." : r.erro ?? "Falha ao enviar.");
    setOcupado(false);
  }

  // Banner compacto: só aparece quando dá para ativar e ainda não está ativo
  if (compacto) {
    if (dispensado || !["desativado", "ios-instalar"].includes(estado)) return null;
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-marca/30 bg-marca-clara p-4">
        <span className="text-2xl" aria-hidden="true">🔔</span>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-semibold text-tinta">Receba os avisos no celular</p>
          {estado === "ios-instalar" ? (
            <p className="text-sm text-suave">
              No iPhone, toque em <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>. Abra o
              app pelo ícone e ative as notificações.
            </p>
          ) : (
            <>
              <p className="text-sm text-suave">Saiba na hora quando houver um apontamento, lembrete ou resposta da oficina.</p>
              <button type="button" onClick={ativar} disabled={ocupado} className="botao-primario px-4 py-2 text-sm">
                {ocupado ? "Ativando…" : "Ativar notificações"}
              </button>
            </>
          )}
          {mensagem && <p className="text-sm text-suave">{mensagem}</p>}
        </div>
        <button
          type="button"
          aria-label="Dispensar"
          className="text-xl leading-none text-suave"
          onClick={() => {
            setDispensado(true);
            try {
              localStorage.setItem("sz-aviso-push-dispensado", "1");
            } catch {}
          }}
        >
          ×
        </button>
      </div>
    );
  }

  const textos: Record<Estado, string> = {
    carregando: "Verificando…",
    "sem-suporte": "Este navegador não permite notificações. Você continua recebendo os avisos aqui no app e por e-mail.",
    "ios-instalar":
      "No iPhone, as notificações funcionam com o app instalado: toque em Compartilhar › Adicionar à Tela de Início, abra pelo ícone e volte aqui.",
    "sem-chave": "As notificações no celular ainda não foram configuradas pela empresa.",
    desativado: "Ative para receber os avisos no celular, mesmo com o app fechado.",
    ativado: "Ativadas neste aparelho.",
    bloqueado:
      "As notificações estão bloqueadas para este site. Libere nas configurações do navegador (ou do iPhone: Ajustes › Notificações › Sempre Zero).",
  };

  return (
    <div className="space-y-3">
      <p className={`text-sm ${estado === "ativado" ? "font-semibold text-sucesso" : "text-suave"}`}>
        {estado === "ativado" && "✓ "}
        {textos[estado]}
      </p>
      <div className="flex flex-wrap gap-2">
        {estado === "desativado" && (
          <button type="button" onClick={ativar} disabled={ocupado} className="botao-primario text-sm">
            {ocupado ? "Ativando…" : "Ativar notificações"}
          </button>
        )}
        {estado === "ativado" && (
          <>
            <button type="button" onClick={testar} disabled={ocupado} className="botao-escuro text-sm">Enviar teste</button>
            <button type="button" onClick={desativar} disabled={ocupado} className="botao-contorno text-sm">Desativar</button>
          </>
        )}
      </div>
      {mensagem && <p className="text-sm text-suave">{mensagem}</p>}
    </div>
  );
}
