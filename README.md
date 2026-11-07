# Sempre Zero

Garagem digital para clientes de estética automotiva e serviços automotivos.

O cliente acompanha seus veículos, o histórico de serviços, os apontamentos
pendentes, os prazos de manutenção e os vencimentos de documentos. A empresa
registra serviços e apontamentos, recebe pedidos de orçamento e agendamentos.

- Proposta e escopo da primeira versão: [docs/PROPOSTA.md](docs/PROPOSTA.md)
- Configuração do banco e publicação: [docs/CONFIGURACAO.md](docs/CONFIGURACAO.md)

## Tecnologia
Next.js 16 (App Router) + TypeScript + Tailwind CSS 4, Supabase (login, banco e fotos).

## Desenvolvimento
```bash
cp .env.example .env.local   # preencha com as chaves do Supabase
npm install
npm run dev
```
Sem as chaves, o app abre em modo demonstração.

## Estrutura
- `src/app/(auth)` — entrar, criar conta, recuperar e redefinir senha
- `src/app/(app)` — área logada: garagem, conta, painel da empresa
- `src/app/auth/confirm` — destino dos links enviados por e-mail
- `src/lib` — autenticação, cliente Supabase, utilitários
- `supabase/migrations` — scripts SQL do banco
