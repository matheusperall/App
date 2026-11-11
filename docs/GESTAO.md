# Gestão da loja — guia

A Gestão é a área do administrador que substitui a plataforma CERA. Ela fica dentro do
próprio Sempre Zero, usa o mesmo banco de dados e aparece no menu como **Gestão**
(só para quem é administrador; o cliente não vê nada disso).

## O que tem em cada aba

| Aba | Para que serve |
|---|---|
| **Início** | Resumo do mês: faturado, recebido, a receber, saldo nas contas, carros no pátio (vagas), agenda de hoje, o que precisa de atenção e o faturamento por dia. |
| **OS** | Ordens de serviço. Filtros: no pátio, a receber, lojistas, todas (por mês). Busca por placa, cliente ou número. |
| **Faturas** | Fatura mensal dos lojistas (revendas): junta as OS do mês, recebe em partes e manda o extrato pelo WhatsApp. |
| **Financeiro** | Contas (caixa, banco…), lançamentos do mês, contas a pagar, novo lançamento, resultado do mês (DRE) e configurações (vagas do pátio e taxas da maquininha). |
| **Estoque** | Produtos (shampoo, cera, panos…), situação (saudável, crítico, sem estoque), reposição, ajuste de saldo e histórico. |
| **Serviços** | Catálogo do que a loja vende: preço, custo dos produtos e margem. Em cada serviço você diz quanto de cada produto ele gasta. |
| **Clientes** | Fichas dos clientes, com ou sem acesso ao app: total gasto, última visita, histórico de OS, veículos e convite para o app. |

## Como funciona o dia a dia

1. **Carro chegou** → *OS › + Nova OS* (ou, se veio de um agendamento confirmado, o botão
   **Carro chegou: abrir OS** no Início ou na tela do agendamento).
   - Escolha o cliente ou toque em **+ Cadastrar novo cliente** (nome, telefone e se é lojista).
   - Escolha o veículo ou cadastre um novo (placa + tabela FIPE, ou à mão).
   - Busque os serviços (não precisa de acento: "polimento tecnico" acha "Polimento técnico").
     O preço pode ser mudado só nesta OS. Se o serviço não existe, cadastre ali mesmo: ele entra no catálogo.
   - Desconto, km e observações. O total aparece na hora.
2. **Avance as etapas**: aberta → em andamento → **pronta** → **entregue**.
   - Ao marcar **pronta**, os produtos que o serviço gasta saem do estoque e a OS mostra o
     custo dos produtos e a margem. Se o cliente tem o app, ele recebe "Seu carro está pronto".
   - Ao **entregar**, o serviço vai para o histórico do veículo (com valor e km) e o cliente com app recebe um aviso.
3. **Receber**: na OS, escolha Pix, dinheiro, débito, crédito ou transferência e a conta onde o
   dinheiro entrou. No cartão, a taxa da maquininha (débito 1,99% e crédito 3,49%, que você pode mudar
   em *Financeiro › Configurações*) é lançada como saída automaticamente.
   - **Cliente lojista não paga por OS**: as OS dele ficam em *Faturas › A faturar*.
4. **Fim do mês dos lojistas**: *Faturas* → marque as OS → **Gerar fatura** com o vencimento →
   **Copiar extrato** e mande no WhatsApp. Quando ele pagar (tudo ou parte), registre o pagamento.

## Números do Início e do resultado

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
1. *Financeiro › Gerenciar contas*: ajuste os nomes e o **saldo inicial** de cada conta (o que tem hoje).
2. *Estoque › + Produto*: cadastre os produtos com a quantidade e o valor que você tem hoje.
3. *Serviços › + Serviço*: cadastre o que você vende, com o preço e os produtos que cada um gasta.
4. *Clientes*: marque os lojistas (revendas) como **lojista**.

Projeto novo do zero? Dá para rodar `supabase/instalar_tudo.sql`, que já inclui tudo isso.
