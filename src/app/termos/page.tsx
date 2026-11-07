import type { Metadata } from "next";
import { PaginaTexto } from "@/components/PaginaTexto";

export const metadata: Metadata = { title: "Termos de uso" };

export default function TermosPage() {
  return (
    <PaginaTexto titulo="Termos de uso">
      <p>Ao criar uma conta no Sempre Zero, você concorda com estes termos.</p>
      <h2>O serviço</h2>
      <p>
        O Sempre Zero é uma garagem digital para acompanhar serviços, apontamentos, manutenções e
        vencimentos dos seus veículos, e para solicitar orçamentos e agendamentos à nossa empresa.
      </p>
      <h2>Responsabilidades</h2>
      <ul>
        <li>Mantenha seus dados de acesso em sigilo.</li>
        <li>As informações que você mesmo cadastrar (quilometragem, vencimentos etc.) são de sua responsabilidade.</li>
        <li>Lembretes são um apoio; prazos legais (licenciamento, IPVA, seguro) devem ser conferidos nos órgãos oficiais.</li>
        <li>Orçamentos enviados pelo app têm validade informada em cada resposta.</li>
      </ul>
      <h2>Cancelamento</h2>
      <p>Você pode encerrar sua conta a qualquer momento entrando em contato conosco.</p>
      <h2>Contato</h2>
      <p>[Nome da empresa] — [CNPJ] — [e-mail de contato] — [telefone].</p>
    </PaginaTexto>
  );
}
