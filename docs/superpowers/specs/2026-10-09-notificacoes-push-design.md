# Notificações push (vencimentos e novidades)

Data: 2026-10-09 · Status: aguardando revisão do dono

## Objetivo

Avisar a pessoa **no aparelho, mesmo com o site fechado**, quando:

1. um boleto ou uma parcela de cartão está perto de vencer (7 dias antes, 3 dias antes e no dia);
2. uma novidade nova é publicada na aba Novidades.

Hoje só existe o sino dentro do site, que avisa apenas boletos e só quando a pessoa abre a página.

### Fora do escopo
- Assinaturas (a cobrança mensal delas não gera push).
- E-mail e SMS.
- Escolher horário ou dias de antecedência por pessoa.
- Mudar o sino que já existe.

## Decisões já tomadas

- Canal: Web Push (padrão do navegador, sem app e sem serviço pago).
- Robô de envio: **Supabase Edge Function** agendada pelo `pg_cron` do próprio Supabase (plano Free).
- Quais avisos: boletos (único, parcelado e mensal) + parcelas de cartão, em 7, 3 e 0 dias.
- Novidades: detectadas automaticamente a partir do `js/novidades.js` publicado; o fluxo do dono não muda.

## Suposições (o dono pode corrigir)

- Os usuários estão no Brasil: "hoje" e o horário de envio usam `America/Sao_Paulo`.
- Gastos do **espaço compartilhado** também avisam, para **todos os membros** do espaço.
- Quem não ativar as notificações continua só com o sino atual.

## Componentes

### 1. Banco (novo arquivo `ferramentas/supabase-push.sql`)

| Tabela | Para quê | Acesso |
|---|---|---|
| `push_inscricoes` (`id`, `user_id`, `endpoint` único, `p256dh`, `auth`, `criado_em`) | um registro por aparelho que ativou | RLS: a pessoa vê, cria e apaga só os próprios; sem update |
| `avisos_enviados` (`user_id`, `chave`, `enviado_em`, PK `user_id`+`chave`) | garante que cada aviso sai uma vez | só o robô (RLS ligado, sem política) |
| `estado_envio` (`chave` PK, `valor`) | guarda a última novidade já avisada | só o robô |

`user_id` referencia `auth.users` com `on delete cascade` (excluir a conta apaga as inscrições).
Textos com limite de tamanho (mesmo padrão do `supabase-seguranca.sql`).

### 2. Cliente

- `js/notificacoes-push.js` (novo), carregado em `configuracoes.html`: linha "Notificações no aparelho" com ativar/desativar e botão "Enviar teste".
  - Ativar: pede permissão (precisa de clique), faz `pushManager.subscribe` com a chave pública VAPID e grava em `push_inscricoes`.
  - Estados mostrados: não suportado, bloqueado pelo navegador, "no iPhone, instale o site na tela inicial", ativo, desativado.
- `sw.js`: listeners `push` (mostra a notificação) e `notificationclick` (abre `parcelas.html` para vencimentos, ou as Novidades). O service worker continua sem cache de conteúdo.
- Ao **sair da conta**, a inscrição daquele aparelho é apagada (melhor esforço), para a próxima pessoa que usar o aparelho não receber avisos da anterior.

### 3. Robô (`supabase/functions/avisos-push/`)

Uma função, três modos, chamada pelo `pg_cron` via `pg_net` com o cabeçalho `x-cron-secret`:

- `vencimentos` — todo dia às 08:00 (Brasília): para cada pessoa com inscrição, junta os gastos pessoais e os do espaço, calcula os avisos do dia e envia.
- `novidades` — a cada 30 min: busca `SITE_URL/js/novidades.js`, lê a primeira entrada (`versao`, `data`, `resumo`), compara com `estado_envio` e, se for nova, avisa todos com inscrição. Só envia entre 08:00 e 21:00 (Brasília); fora disso espera. Na primeira execução apenas grava a atual, sem enviar.
- `teste` — chamado pelo botão "Enviar teste" com o login da pessoa; envia uma notificação só para os aparelhos dela.

**Regra de datas: uma só fonte.** A conta de parcelas e boletos já existe em `js/parcelamento.js` (funções puras, sem DOM). A função leva uma **cópia idêntica** desse arquivo, e um script (`ferramentas/verificar-copia.js`) falha se a cópia e o original divergirem. Assim o sino e o push nunca discordam.

**Cálculo por gasto** (mesma lógica do sino, estendida às parcelas de cartão): próxima cobrança não paga e não vencida; avisa em `dias == 7`, `dias == 3` e `dias == 0` (o momento é a chave: `gasto:parcela:momento`). Isso é decidido por **igualdade** no dia exato, então cada momento aparece em um único dia.

**Antirrepetição:** o robô grava `(user_id, chave)` em `avisos_enviados` antes de enviar, com `on conflict do nothing`; só envia se a gravação inseriu. Se o envio falhar de forma temporária, o registro é removido para a próxima execução tentar de novo.

**Sem spam:** no máximo **uma notificação de vencimento por pessoa por dia**. Com 1 item, mostra o detalhe ("Boleto Enel vence amanhã · R$ 120,00 · parcela 3/6"); com vários, resume ("3 vencimentos esta semana: Enel, Nubank…").

**Segredos** (guardados no Supabase, nunca no repositório): `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`, `SITE_URL`. A chave pública VAPID vai no código do site (é pública por natureza). A chave de administrador do Supabase é injetada pelo próprio Supabase na função.

### 4. Textos legais
`privacidade.html` passa a dizer que, se a pessoa ativar, guardamos a inscrição do aparelho (endereço do serviço de push e chaves) até ela desativar ou excluir a conta.

## Tratamento de erros

- Inscrição inválida (resposta 404/410 do serviço de push): apagada.
- Falha ao ler `novidades.js` ou formato inesperado: não envia nada e registra no log; tenta de novo em 30 min.
- Cabeçalho `x-cron-secret` errado ou ausente: resposta 401, nada é executado.
- Navegador sem suporte ou permissão negada: a tela explica e o sino continua funcionando.
- A função processa em lotes e ignora falhas individuais para um aparelho ruim não parar os outros.

## Testes

1. **Automático (Node, sem rede):** função pura `calcularAvisos(gastos, hoje)` com casos: boleto único, parcelado, mensal, parcela de cartão, parcela já paga, boleto cancelado, dia 31 em fevereiro, vencimento hoje/3/7 dias, 8 dias (não avisa), agrupamento de vários itens. Mais o `verificar-copia.js`.
2. **Banco (conta de teste):** conferir que uma pessoa não lê nem apaga inscrição de outra e que `avisos_enviados`/`estado_envio` não são acessíveis pelo site.
3. **Entrega real (feita pelo dono):** ativar no celular e no computador, tocar em "Enviar teste", conferir que a notificação chega e abre a página certa. Não consigo receber push neste ambiente.
4. **Fim a fim:** adicionar um bloco em `novidades.js` e conferir o aviso em até 30 min.

## Passos do dono (no painel do Supabase)

1. Ligar as extensões `pg_cron` e `pg_net`.
2. Colar a função e cadastrar os segredos.
3. Rodar `supabase-push.sql` e o agendamento.

Eu preparo tudo e guio cada clique.

## Riscos e limites

- iPhone: push só funciona com o site instalado na tela inicial (iOS 16.4+).
- A biblioteca de Web Push precisa rodar no ambiente Deno das Edge Functions; se a primeira escolha falhar, uso outra. Será verificado no início da implementação.
- O aviso sai em horário fixo (08:00), não no minuto do vencimento.
- Mudar a regra de datas em `parcelamento.js` exige copiar para a função (o script de verificação avisa).
- Novos arquivos `docs/` e `supabase/` não podem ser publicados no site: entram no `.assetsignore`.
