# Segurança e proteção de dados — revisão

Revisão feita em 13/11/2026 sobre todo o app (banco, arquivos, servidor, páginas e configuração).

## Como os dados ficam protegidos

| Camada | Como funciona | Situação |
|---|---|---|
| **Banco (Supabase)** | Todas as 30 tabelas têm regras de acesso (RLS). Cliente só vê os próprios veículos, serviços, orçamentos, agendamentos, documentos e avisos. Tudo da Gestão (clientes, OS, financeiro, estoque, faturas, cartões) é só do administrador. Visitantes sem login não acessam nada. | ✅ |
| **Funções do banco** | As operações de dinheiro, estoque e cadastro de clientes recusam quem não é administrador. As funções auxiliares não revelam dados de outras pessoas. | ✅ |
| **Arquivos** (fotos e documentos em PDF) | Pastas privadas: cada cliente só vê e envia na própria pasta; a empresa vê todas. Os links para abrir um arquivo valem por 1 hora. | ✅ |
| **Servidor** | Todas as ações conferem quem está logado (e se é administrador, nas da empresa) antes de agir. A chave secreta do Supabase só é usada no servidor, depois dessa conferência, e nunca vai para o navegador. | ✅ |
| **Rotas de API** | Lembretes automáticos exigem senha (CRON_SECRET); consulta de placa só para o administrador; FIPE só aceita consultas da tabela. | ✅ |
| **Páginas** | Todas exigem login; as da empresa exigem administrador. Redirecionamentos depois do login só vão para páginas do próprio app. | ✅ |
| **Chaves e senhas** | Nenhuma chave no código. `.env.example` só tem textos de modelo. | ✅ |
| **Navegador** | Cabeçalhos de segurança: o app não abre dentro de outro site, sempre HTTPS, sem acesso a microfone/localização. | ✅ (adicionado nesta revisão) |

## O que foi corrigido nesta revisão (arquivo `0016_seguranca.sql` + app)

1. Um cliente conseguia marcar um serviço **que ele mesmo registrou** como "feito pela loja". Agora o banco mantém a autoria e a etiqueta mostra quem registrou de verdade.
2. Um cliente conseguia **mover um documento dele** para o carro de outra pessoa (o dono do outro carro não via, mas aparecia errado para a empresa). Agora é recusado.
3. No orçamento, o cliente só aceita, recusa ou cancela: não consegue mais trocar categoria, vínculo com apontamento ou autoria.
4. A página `/status` (diagnóstico da configuração) era pública. Não mostrava nenhuma chave, mas dizia quais configurações existem. Agora, com o app configurado, só o administrador vê.
5. Cabeçalhos de segurança no site (acima).

Nenhum desses pontos permitia ver dados de outra pessoa.

## O que depende de você (fora do código)

- **Política de privacidade**: preencher o rodapé com nome da empresa, CNPJ, e-mail e telefone de contato
  (hoje está "[Nome da empresa] — [CNPJ] — …"). A LGPD exige informar quem cuida dos dados.
- **Supabase › Advisors › Security Advisor**: abra e confira se aparece algum alerta (ele analisa o banco real).
- **Supabase › Authentication › Sign In / Providers**: manter "Confirm email" ligado e senha com no mínimo 8 caracteres.
- **Chaves**: a `SUPABASE_SERVICE_ROLE_KEY` fica só na Vercel. Se ela tiver sido copiada para algum lugar fora da Vercel,
  gere uma nova no Supabase (Project Settings › API) e atualize na Vercel.
- **Backups**: no plano grátis do Supabase não há backup automático diário. Para dados financeiros, vale o plano pago
  (backups diários) ou exportar as tabelas principais periodicamente.
