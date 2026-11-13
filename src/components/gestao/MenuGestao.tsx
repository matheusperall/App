import { Suspense } from "react";
import { contarAgendamentosAConfirmar, contarOrcamentosAResponder } from "@/lib/dados";
import { AbasGestao } from "./Abas";

/** Menu da Gestão com os contadores de Agenda (a confirmar) e Orçamentos (a responder). */
export function MenuGestao() {
  return (
    <Suspense fallback={<AbasGestao />}>
      <ComContadores />
    </Suspense>
  );
}

async function ComContadores() {
  const [aConfirmar, aResponder] = await Promise.all([contarAgendamentosAConfirmar(), contarOrcamentosAResponder()]);
  return <AbasGestao contadores={{ "/agendamentos": aConfirmar, "/orcamentos": aResponder }} />;
}
