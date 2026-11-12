# Gestão da loja — guia

A Gestão é a área do administrador que substitui a plataforma CERA. Ela fica dentro do
próprio Sempre Zero, usa o mesmo banco de dados e aparece no menu como **Gestão**
(só para quem é administrador; o cliente não vê nada disso).

## O que tem em cada aba

| Aba | Para que serve |
|---|---|
| **Painel** (dentro da Gestão) | Saudação e atalhos (Nova OS, Novo lançamento, Faturas, Novo cliente), calendário do mês com os agendamentos, recebido por forma de pagamento, entradas e saídas de hoje, a receber, orçamentos, vagas no pátio, oportunidades, carros no pátio, agenda de hoje, o que precisa de atenção, faturamento por dia e top 5 clientes. |
| **OS** | Ordens de serviço. Filtros: no pátio, a receber, lojistas, todas (por mês). Busca por placa, cliente ou número. |
| **Faturas** | Fatura mensal dos lojistas (revendas): junta as OS do mês, recebe em partes e manda o extrato pelo WhatsApp. |
| **Financeiro** | Três partes: **Movimentações** (resumo do mês e todos os lançamentos numa tabela, com atrasados no topo; o "⋮" de cada linha marca como pago, encerra recorrência ou apaga), **Contas** (cartões com saldo atual e previsto, formas e taxas, e a configuração de vagas do pátio) e **Resultado (DRE)**. O botão **+ Adicionar** cria um lançamento. |
| **Estoque** | Produtos (shampoo, cera, panos…), situação (saudável, crítico, sem estoque), reposição, ajuste de saldo e histórico. |
| **Serviços** | Catálogo do que a loja vende: preço, custo dos produtos e margem. Em cada serviço você diz quanto de cada produto ele gasta. |
| **Clientes** | Fichas dos clientes, com ou sem acesso ao app: total gasto, última visita, histórico de OS, veículos e convite para o app. |

## Como funciona o dia a dia

1. **Carro chegou** → *OS › + Nova OS* (ou, se veio de um agendamento confirmado, o botão
   **Carro chegou: abrir OS** no Painel ou na tela do agendamento).
   - Escolha o cliente ou toque em **+ Cadastrar novo cliente** (nome, telefone e se é lojista).
   - Escolha o veículo ou cadastre um novo (placa + tabela FIPE, ou à mão).
   - Busque os serviços (não precisa de acento: "polimento tecnico" acha "Polimento técnico").
     O preço pode ser mudado só nesta OS. Se o serviço não existe, cadastre ali mesmo: ele entra no catálogo.
   - Desconto, km e observações. O total aparece na hora.
2. **Avance as etapas**: aberta → em andamento → **pronta** → **entregue**.
   - Ao marcar **pronta**, os produtos que o serviço gasta saem do estoque e a OS mostra o
     custo dos produtos e a margem. Se o cliente tem o app, ele recebe "Seu carro está pronto".
   - Ao **entregar**, o serviço vai para o histórico do veículo (com valor e km) e o cliente com app recebe um aviso.
3. **Receber**: na OS, preencha o **1º pagamento**: valor, forma (Pix, dinheiro, débito, crédito ou
   transferência), conta (aparecem só as que recebem nessa forma; se for uma só, já vem escolhida) e, no
   crédito, as parcelas. Para dividir (ex.: parte no Pix, parte no cartão), toque em **+ Adicionar 2º pagamento**.
   Se a soma for menor que o total, o restante **fica em aberto** e a OS aparece como "Parcial" até
   receber o resto. A taxa de cada pagamento é lançada sozinha como saída.
4. **Fim do mês dos lojistas**: *Faturas* → marque as OS → **Gerar fatura** com o vencimento →
   **Copiar extrato** e mande no WhatsApp. Quando ele pagar (tudo ou parte), registre o pagamento:
   igual à OS, a forma escolhida filtra as contas, o crédito pede as parcelas e a taxa entra como saída.
5. **Despesas fixas e compras parceladas**: em *Financeiro › + Adicionar*, escolha a repetição:
   - **Única**: um lançamento só.
   - **Recorrente**: o mesmo valor todo mês (ex.: aluguel), pelo número de meses que você escolher.
   - **Parcelado**: o valor total dividido em parcelas mensais (ex.: equipamento em 10x).
   As próximas entram como contas a pagar (ou a receber). Para parar uma recorrência, use
   **Encerrar recorrência** na conta a pagar: apaga as próximas que ainda não foram pagas.

**Campos de valor em reais** começam em 0,00 e os números "correm" como numa maquininha:
digitar 12345 vira 123,45. A tecla de apagar tira o último número.

## Números do Painel e do resultado

- **Faturado no mês**: soma das OS **prontas ou entregues** com data no mês.
- **Recebido no mês**: dinheiro que entrou nas contas no mês (sem aportes/transferências).
- **A receber**: OS avulsas prontas/entregues ainda não pagas + OS de lojistas ainda sem fatura + saldo das faturas em aberto.
- **Pátio**: OS abertas, em andamento ou prontas (ainda não entregues). Cada uma ocupa uma vaga (padrão 6).
- **Resultado do mês (DRE)**, por competência (pelo mês em que o serviço foi feito):
  receita das OS − taxas de cartão − produtos consumidos = **margem bruta** − despesas por categoria = **resultado**.
  Compra de produtos **não** entra como despesa: ela vira estoque e o custo aparece quando o produto é usado.

## Clientes sem login e o convite para o app

Muitos clientes da loja nunca vão baixar o app. Por isso cada cliente tem uma **ficha** na loja,
que pode existir só com nome e telefone. Os veículos ficam ligados à ficha.

Quando quiser dar acesso: abra o cliente → **Dar acesso ao app** → informe o e-mail → **Enviar convite**.
O cliente cria a senha e passa a ver os mesmos veículos e o histórico. Nada é duplicado.
Se aquele e-mail já tinha conta no app, a ficha é ligada a essa conta (os veículos se juntam).
Quem se cadastra sozinho pelo app aparece automaticamente na lista de clientes.

> O convite usa a chave secreta `SUPABASE_SERVICE_ROLE_KEY`, que já precisa estar na Vercel (veja CONFIGURACAO.md).

## Busca por placa (para o futuro)

O formulário de OS já está preparado para buscar marca, modelo e ano pela placa usando um serviço pago.
Hoje nenhum fornecedor está contratado, então o botão **Buscar** não aparece e a escolha é pela tabela FIPE.
Quando contratar, o programador só precisa preencher a função em `src/lib/consulta-placa.ts` e cadastrar
`PLACA_API_URL` e `PLACA_API_TOKEN` na Vercel.

---

## Passo a passo: instalar a Gestão no banco (Supabase)

Faça isto **uma vez**, antes de usar a Gestão. Leva uns 2 minutos e não apaga nada do que já existe.

1. **Faça um backup antes (recomendado)**: no Supabase, *Database › Backups*. No plano grátis, você pode
   exportar os dados em *Table Editor* (cada tabela tem *Export to CSV*) — principalmente `perfis` e `veiculos`.
2. Entre em https://supabase.com, abra o projeto **sempre-zero**.
3. No menu da esquerda, clique em **SQL Editor** → **New query**.
4. Abra no GitHub o arquivo `supabase/migrations/0010_gestao.sql`, clique no botão **Copy raw file**
   (ícone de copiar), cole tudo no SQL Editor e clique em **Run**.
5. Deve aparecer **Success. No rows returned**. Pronto.
   - Se aparecer erro dizendo que algo "already exists", o arquivo já tinha sido rodado antes: não rode de novo.
   - Qualquer outro erro: copie a mensagem e me mande.
6. Abra o app, entre como administrador e toque em **Gestão**. O aviso amarelo de "o banco ainda não
   recebeu a parte da gestão" deve sumir.

O que o arquivo faz no banco:
- cria as fichas de clientes (e já cria uma ficha para cada conta que existe hoje, ligando os veículos a ela);
- cria catálogo, OS, estoque, financeiro (com as contas "Caixa da loja" e "Banco" e categorias prontas) e faturas;
- protege tudo para que **só o administrador** veja e mexa nesses dados.

Primeiros passos depois de instalar:
1. *Financeiro › Contas* (abra "Editar conta, formas e taxas" em cada cartão): ajuste os nomes e o **saldo inicial** de cada conta (o que tem hoje) e marque
   as **formas de recebimento** de cada uma, com as taxas. Exemplo: "Maquininha" recebe débito e crédito
   (taxa do débito, do crédito à vista e de cada parcela: 2x, 3x… — deixe vazio as parcelas que não aceita);
   "Banco" recebe Pix e transferência; "Caixa da loja" recebe dinheiro.
2. *Estoque › + Produto*: cadastre os produtos com a quantidade e o valor que você tem hoje.
3. *Serviços › + Serviço*: cadastre o que você vende, com o preço e os produtos que cada um gasta.
4. *Clientes*: marque os lojistas (revendas) como **lojista**.

### Atualização: formas de recebimento por conta (arquivo 0011)

Se você já rodou o `0010_gestao.sql`, rode também **`supabase/migrations/0011_formas_recebimento.sql`**
(mesmo jeito: SQL Editor › New query › colar › Run). Ele adiciona às contas as formas de recebimento e as
taxas (Pix, débito, crédito à vista e cada parcela). As contas que já existem começam aceitando todas as
formas, com as taxas de débito e crédito que estavam nas configurações — depois ajuste em *Financeiro › Contas*.

### Atualização: faturas e lançamentos recorrentes/parcelados (arquivo 0012)

Depois do 0011, rode **`supabase/migrations/0012_faturas_e_lancamentos.sql`** do mesmo jeito.
Ele faz o pagamento de fatura usar as formas e taxas das contas (com parcelas no crédito) e permite
lançamentos recorrentes e parcelados.

### Atualização: pagamento dividido na OS (arquivo 0013)

Depois do 0012, rode **`supabase/migrations/0013_pagamentos_os.sql`** do mesmo jeito. Ele permite
receber a OS em vários pagamentos e deixar uma parte em aberto. Os pagamentos já feitos antes continuam
aparecendo (o arquivo copia cada um para a nova lista de pagamentos).

### Atualização: anexos de documentos (arquivo 0014)

Depois do 0013, rode **`supabase/migrations/0014_anexos_documentos.sql`**. Ele cria um local privado para
guardar PDFs e fotos de documentos (até 10 MB cada) e a lista desses arquivos:
- **Minha garagem › Minha CNH**: vencimento da CNH e o arquivo da CNH (saiu da tela Conta).
- **Veículo › Documentos › Arquivos do veículo**: CRLV-e, apólice do seguro, guia do IPVA, notas fiscais e outros.
Cada cliente só vê os arquivos dele; a empresa vê todos.

Projeto novo do zero? Dá para rodar `supabase/instalar_tudo.sql`, que já inclui tudo isso.
