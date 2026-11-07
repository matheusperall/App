# Sempre Zero — Proposta da primeira versão

## 1. Visão geral

**Sempre Zero** é uma garagem digital. Cada cliente tem seus veículos dentro do
app, com tudo o que foi feito, tudo o que está pendente e os próximos prazos.

São dois tipos de usuário:

| Usuário | O que faz |
|---|---|
| **Cliente** | Cadastra ou visualiza seus veículos, vê o histórico e os apontamentos, recebe notificações, acompanha prazos, pede orçamento com fotos e solicita agendamento. |
| **Administrador (empresa)** | Cadastra clientes e veículos, registra serviços realizados, faz apontamentos, responde orçamentos, confirma agendamentos (que vão para a Google Agenda). No início, só um usuário administrador. |

## 2. Funcionalidades da primeira versão

### 2.1 Conta e acesso
- Login com e-mail e senha, com recuperação de senha por e-mail.
- O cliente pode criar a própria conta **ou** ser cadastrado pela empresa. Nesse
  caso ele recebe um convite por e-mail para definir a senha.
- Termos de uso e política de privacidade (LGPD), com opção de excluir a conta.

### 2.2 Garagem (veículos)
- Cadastro do veículo: placa, marca, modelo, ano, cor, quilometragem atual e foto.
- Um cliente pode ter vários veículos.
- O cliente pode atualizar a quilometragem quando quiser. Isso alimenta os
  lembretes de manutenção por km.

### 2.3 Histórico de serviços
- A empresa registra cada serviço realizado: data, categoria, descrição, km,
  valor (opcional), fotos de antes/depois e prestador (próprio ou terceirizado).
- O cliente pode registrar serviços que fez em outros lugares, para o histórico
  ficar completo.
- Categorias iniciais: Estética, Funilaria e pintura, Mecânica, Elétrica,
  Acessórios, Outros.

### 2.4 Apontamentos (serviços pendentes)
- A empresa aponta um problema ou recomendação no veículo. Exemplo: "risco na
  porta traseira direita, recomendada repintura".
- Cada apontamento tem categoria, descrição, fotos e prioridade
  (baixa, média, urgente).
- O cliente **recebe uma notificação** e, dentro do apontamento, pode:
  - **Solicitar agendamento**
  - **Pedir orçamento**
  - Marcar como "não tenho interesse agora"
- Situação do apontamento: pendente → agendado → concluído (vira histórico).

### 2.5 Lembretes de manutenção e vencimentos
- Lembretes por **data e/ou quilometragem**, com valores-padrão que o cliente pode ajustar:
  - Troca de óleo e filtro
  - Alinhamento e balanceamento
  - Revisões, pneus, fluidos, ar-condicionado etc. (lista configurável)
- Vencimentos de documentos:
  - Licenciamento / IPVA
  - Seguro
  - CNH do proprietário (opcional)
- Notificação alguns dias antes do vencimento (ex.: 30, 7 e 1 dia antes) e
  quando estiver vencido.

### 2.6 Pedido de orçamento
- O cliente descreve o que quer, escolhe a categoria e **envia fotos**.
- A empresa responde dentro do app com valor, prazo e observações.
- O cliente aceita (e pode seguir direto para o agendamento) ou recusa.

### 2.7 Agendamento com Google Agenda
- O cliente solicita um agendamento indicando o serviço e uma ou mais datas e
  horários de preferência.
- A empresa confirma (ou sugere outro horário) pelo painel.
- Na confirmação, o evento é **criado automaticamente na sua Google Agenda**
  com cliente, veículo, placa e serviço.
- O cliente recebe a confirmação e um lembrete antes do horário.

### 2.8 Notificações
- **Notificação no celular** (Web Push). Funciona em Android e em iPhone, desde
  que o app seja adicionado à tela inicial (o app pode ser "instalado" pelo
  navegador, com ícone próprio).
- **E-mail** como reforço, para quem não ativar as notificações.
- Central de notificações dentro do app.

### 2.9 Painel da empresa
- Lista de clientes e veículos, com busca por nome ou placa.
- Caixa de entrada: novos pedidos de orçamento e de agendamento.
- Visão de apontamentos pendentes de todos os clientes (oportunidades de venda).
- Lembretes vencendo nos próximos dias (oportunidade de contato).

## 3. Fica para versões futuras
- Pagamento dentro do app (Pix/cartão).
- Mais usuários na empresa (funcionários, parceiros terceirizados com acesso próprio).
- Integração com WhatsApp.
- Consulta automática de dados do veículo pela placa / débitos.
- Relatórios e indicadores (faturamento, serviços mais vendidos, retorno de clientes).
- Publicação nas lojas Play Store / App Store.

## 4. Tecnologia recomendada

| Parte | Tecnologia | Por quê |
|---|---|---|
| Aplicativo (telas) | **Next.js (React) + TypeScript**, como **PWA** | App web responsivo que pode ser instalado no celular e recebe notificações. |
| Banco de dados, login e fotos | **Supabase** (PostgreSQL) | Login por e-mail pronto, armazenamento de fotos, segurança por usuário, plano gratuito para começar. |
| Hospedagem | **Vercel** | Publicação automática a cada atualização no GitHub. |
| E-mails | **Resend** (ou similar) | Envio confiável de convites, lembretes e confirmações. |
| Agenda | **Google Calendar API** | Cria os eventos na sua agenda. |
| Tarefas automáticas | Rotina diária agendada | Verifica vencimentos e dispara os lembretes. |

## 5. Custos estimados (valores aproximados)

| Item | Para começar / testes | Em produção |
|---|---|---|
| Supabase | Grátis | Grátis no início; ~US$ 25/mês quando crescer (backups, sem pausa por inatividade). |
| Vercel | Grátis | ~US$ 20/mês (o plano grátis não é para uso comercial). Alternativa gratuita: Cloudflare Pages ou Netlify. |
| E-mails (Resend) | Grátis (até ~3.000/mês) | Grátis no início. |
| Domínio (ex.: semprezero.com.br) | — | ~R$ 40/ano no registro.br |
| Google Agenda API | Grátis | Grátis |

Ou seja: dá para desenvolver e testar com **custo zero**, e colocar no ar com
algo entre **R$ 0 e ~R$ 250/mês**, dependendo das escolhas.

## 6. Etapas de construção

1. **Base**: projeto, login, perfis (cliente/admin), visual inicial e logo provisória.
2. **Garagem**: veículos, histórico de serviços, fotos.
3. **Apontamentos + notificações** (o coração do app).
4. **Lembretes de manutenção e vencimentos**.
5. **Pedido de orçamento com fotos**.
6. **Agendamento + Google Agenda**.
7. **Painel da empresa** completo, ajustes, testes e publicação.

A cada etapa você recebe um link para testar.

## 7. O que vamos precisar de você (no momento certo)
- Criar contas (gratuitas) em **Supabase** e **Vercel**, usando o login do GitHub.
- Permitir o acesso à sua **Google Agenda** (vou passar o passo a passo).
- Registrar o domínio, quando decidir colocar no ar.
- Textos da empresa: nome oficial, CNPJ, contato, endereço (para a política de privacidade e o rodapé).

## 8. Decisões pendentes
Ver a seção "Perguntas" na conversa / no README do projeto.
