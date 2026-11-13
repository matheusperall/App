# Gestão da loja — guia

A Gestão é a área do administrador que substitui a plataforma CERA. Ela fica dentro do
próprio Sempre Zero, usa o mesmo banco de dados e aparece no menu como **Gestão**
(só para quem é administrador; o cliente não vê nada disso). Agenda e Orçamentos também ficam dentro da Gestão;
o cliente continua vendo a Agenda e os Orçamentos dele no menu do app.

## O que tem em cada aba

| Aba | Para que serve |
|---|---|
| **Painel** (dentro da Gestão) | Saudação e atalhos (Nova OS, Novo agendamento, Novo orçamento, Novo cliente, Novo lançamento), calendário do mês com o número de agendamentos de cada dia (tocar no dia abre a Agenda naquele dia), recebido por forma de pagamento, entradas e saídas de hoje, a receber, orçamentos, vagas no pátio, oportunidades, carros no pátio, agenda de hoje, o que precisa de atenção, faturamento por dia e top 5 clientes. |
| **Agenda** | Agendamentos: calendário com o número de agendamentos por dia, pedidos a confirmar, próximos horários, busca e **+ Agendamento**. |
| **Orçamentos** | Pedidos de orçamento dos clientes (a responder, aguardando cliente, aprovados), busca e **+ Orçamento**. |
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
   - Errou a etapa? **↩ Voltar** volta uma etapa. De "pronta" para "em andamento", os produtos voltam ao estoque;
     de "entregue" para "pronta", o serviço sai do histórico do veículo.
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

**Telas de cadastro** (novo cliente, produto, serviço, lançamento, OS, orçamento, agendamento, veículo) abrem
como uma ficha larga, com os campos em branco. Os campos marcados com \* são obrigatórios. Onde é preciso escolher
algo (cliente, veículo, serviço), é só começar a digitar que a lista aparece; a setinha ▾ abre a lista completa.

**Mensagens para o cliente (WhatsApp)**: na OS, no orçamento e no agendamento há o quadro **💬 Enviar ao cliente**
com textos prontos. Escolha o tipo, confira (dá para mudar o texto), toque em **Copiar texto** ou **Enviar no WhatsApp**:
- OS: **Ordem de serviço**, **Carro pronto** (quando fica pronta), **Cobrança** (quando ficou valor em aberto) e
  **Comprovante de pagamento** (depois de receber). A mais útil para a situação da OS já vem escolhida.
- Orçamento: **Orçamento** com os itens, total, prazo e validade (e **Combinar a data** depois de aprovado).
  Ao montar o orçamento, a busca **Buscar serviço cadastrado** coloca o serviço com o preço do catálogo.
  O botão **Salvar e enviar ao cliente** avisa o cliente no app e já mostra a mensagem do WhatsApp pronta para mandar;
  num orçamento já enviado, **Salvar alterações** só guarda, sem avisar de novo.
- Agendamento: **Lembrete do agendamento** com dia e horário.
- O nome do cliente, a marca, o modelo e a placa do carro entram sozinhos.
- **Editar modelo** (lápis no quadro) abre *Gestão › Mensagens de WhatsApp*: ali você muda o texto de cada mensagem,
  usando campos como `{cliente}`, `{marca}`, `{modelo}`, `{placa}`, `{total}` e `{em_aberto}`, com uma prévia ao lado.
  **Voltar ao padrão** desfaz. (Também dá para chegar por *Atendimento › Configurações*.)

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

### Atualização: cartões de crédito (arquivo 0015)

Depois do 0014, rode **`supabase/migrations/0015_cartoes_credito.sql`**. Ele cria os cartões de crédito da empresa:
- **Financeiro › Contas › Cartões de crédito**: cadastre o cartão (nome, final, dia do fechamento, dia do vencimento,
  limite e a conta que paga a fatura). Cada cartão mostra a próxima fatura e o limite disponível.
- **Compra no cartão**: em *Financeiro › + Adicionar*, escolha o cartão em "Pago com" (ou lance pela tela do cartão).
  A compra entra na fatura certa pela data e pelo fechamento; parcelada, cada parcela vai para uma fatura.
- **Pagar a fatura**: na tela do cartão, escolha a fatura e toque em "Pagar fatura". O dinheiro sai da conta só aí.
- No resultado do mês (DRE), a compra conta como despesa no mês em que foi feita.
- As vagas do pátio agora se editam pelo lápis no quadro do pátio, no Painel da Gestão.

### Atualização: preferências do cliente no veículo (arquivo 0017)

Depois do 0016, rode **`supabase/migrations/0017_preferencias_veiculo.sql`**. Ele guarda as preferências do cliente
para cada veículo (ex.: "Não mexer nos bancos", "Não passar cheirinho", "Pretinho semi brilho"):
- **Cadastro/edição do veículo › Preferências do cliente**: toque nas sugestões ou escreva outra.
  Dá para copiar as mesmas preferências para os outros veículos do cliente (um por um ou todos) e marcar
  **Usar nos próximos veículos cadastrados**.
- Elas aparecem como **⚠️ Ponto de atenção** ao escolher o veículo na Nova OS, na OS aberta e na página do veículo.

### Atualização: modelos das mensagens de WhatsApp (arquivo 0018)

Depois do 0017, rode **`supabase/migrations/0018_modelos_mensagens.sql`**. Ele guarda os textos das mensagens de
WhatsApp que você editar em *Gestão › Mensagens de WhatsApp*. Sem ele, as mensagens funcionam com o texto padrão,
mas não dá para salvar mudanças.

### Atualização: voltar etapa da OS (arquivo 0019)

Depois do 0018, rode **`supabase/migrations/0019_voltar_etapa_os.sql`**. Ele faz a devolução de produtos ao estoque
contar certo quando a OS vai e volta de "pronta" mais de uma vez.

Projeto novo do zero? Dá para rodar `supabase/instalar_tudo.sql`, que já inclui tudo isso.
