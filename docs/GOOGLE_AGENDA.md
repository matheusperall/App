# Conectar a Google Agenda

O app usa uma **conta de serviço** do Google: um "usuário robô" com quem você
compartilha a sua agenda. Assim o app consegue ver os horários ocupados e criar
os eventos dos agendamentos, sem ninguém precisar fazer login no Google.

Leva uns 10 minutos. Faça pelo computador.

## 1. Criar o projeto no Google Cloud (grátis)
1. Acesse **console.cloud.google.com** e entre com a mesma conta Google da sua agenda.
2. No topo, clique no seletor de projetos e depois em **Novo projeto**.
   Nome: `sempre-zero` e clique em **Criar**. Aguarde e selecione o projeto.

## 2. Ativar a API da Google Agenda
1. No menu (☰), abra **APIs e serviços → Biblioteca**.
2. Busque **Google Calendar API**, abra e clique em **Ativar**.

## 3. Criar a conta de serviço e a chave
1. No menu (☰), abra **IAM e administrador → Contas de serviço**.
2. Clique em **+ Criar conta de serviço**. Nome: `agenda-app`. Clique em
   **Criar e continuar** e depois em **Concluir** (não precisa dar papéis).
3. Clique na conta criada. Copie o **e-mail** dela (algo como
   `agenda-app@sempre-zero-xxxx.iam.gserviceaccount.com`).
4. Abra a aba **Chaves → Adicionar chave → Criar nova chave → JSON → Criar**.
   Um arquivo `.json` será baixado. **Guarde com cuidado: ele é secreto.**

## 4. Compartilhar a sua agenda com a conta de serviço
1. Acesse **calendar.google.com** e clique na engrenagem → **Configurações**.
2. À esquerda, em **Configurações das minhas agendas**, clique na sua agenda
   (normalmente o seu nome).
3. Em **Compartilhar com pessoas ou grupos específicos**, clique em **Adicionar pessoas**,
   cole o e-mail da conta de serviço e escolha **Fazer alterações nos eventos**. Envie.
4. Mais abaixo, em **Integrar agenda**, copie o **ID da agenda**
   (na agenda principal, é o seu próprio e-mail).

> Dica: se preferir, crie uma agenda separada chamada "Sempre Zero" e compartilhe só ela.

## 5. Cadastrar na Vercel
Em **Settings → Environments → Production → Environment Variables**:

| Nome | Tipo | Valor |
|---|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Secret | Abra o arquivo `.json` baixado num editor de texto (TextEdit), copie **todo** o conteúdo e cole |
| `GOOGLE_CALENDAR_ID` | Config | O ID da agenda do passo 4 |

Depois faça **Deployments → ⋯ → Redeploy**.

## 6. Testar
No app, abra **Atendimento → Configurações → 📅 Google Agenda → Testar conexão**.

## Como o app usa a agenda
- **Lavagem (2 horas, até 2 veículos ao mesmo tempo):** o cliente só vê horários livres (dias úteis, 8h–18h). Qualquer evento
  "ocupado" criado por você na agenda bloqueia o horário: use isso para folgas e feriados.
- **Outros serviços:** você confirma o dia e a duração. Os eventos criados pelo app entram como
  "livre", para que a capacidade de lavagens seja controlada pelo próprio app.
- Cancelamentos removem o evento da agenda automaticamente.
