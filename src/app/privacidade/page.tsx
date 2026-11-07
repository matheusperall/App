import type { Metadata } from "next";
import { PaginaTexto } from "@/components/PaginaTexto";

export const metadata: Metadata = { title: "Política de privacidade" };

export default function PrivacidadePage() {
  return (
    <PaginaTexto titulo="Política de privacidade">
      <p>
        Esta política explica como o Sempre Zero coleta e usa seus dados pessoais, em conformidade com a
        Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
      </p>
      <h2>Quais dados coletamos</h2>
      <ul>
        <li>Dados de cadastro: nome, e-mail e celular.</li>
        <li>Dados dos veículos: placa, marca, modelo, ano, cor, quilometragem e fotos.</li>
        <li>Histórico de serviços, apontamentos, orçamentos, agendamentos e vencimentos informados.</li>
      </ul>
      <h2>Para que usamos</h2>
      <ul>
        <li>Manter a sua garagem digital e o histórico dos seus veículos.</li>
        <li>Enviar avisos sobre apontamentos, lembretes de manutenção e vencimentos.</li>
        <li>Responder orçamentos e organizar agendamentos.</li>
      </ul>
      <h2>Compartilhamento</h2>
      <p>
        Não vendemos seus dados. Informações do veículo podem ser compartilhadas com parceiros
        terceirizados apenas quando necessário para executar um serviço que você solicitou.
      </p>
      <h2>Seus direitos</h2>
      <p>
        Você pode, a qualquer momento, acessar, corrigir ou pedir a exclusão dos seus dados e da sua
        conta, entrando em contato conosco.
      </p>
      <h2>Contato</h2>
      <p>[Nome da empresa] — [CNPJ] — [e-mail de contato] — [telefone].</p>
    </PaginaTexto>
  );
}
