# Notificações push (vencimentos e novidades) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Avisar a pessoa por push no aparelho, com o site fechado, sobre boletos e parcelas de cartão perto de vencer e sobre novidades publicadas.

**Architecture:** Uma Edge Function do Supabase agendada pelo `pg_cron` calcula os avisos com a mesma regra de datas do site (cópia gerada de `js/parcelamento.js`) e envia Web Push. Toda a lógica fica em módulos puros (`.mjs`) testados com `node --test`; a função em si só liga o banco e a biblioteca de push. O cliente ganha um listener no `sw.js` e uma linha de ativar/desativar em Configurações.

**Tech Stack:** JavaScript (ESM `.mjs`), `node:test` (Node 24), Supabase (Postgres, RLS, Edge Functions/Deno, `pg_cron`, `pg_net`, Vault), Web Push (VAPID), service worker.

**Spec:** `docs/superpowers/specs/2026-10-09-notificacoes-push-design.md`

## Global Constraints

- Avisos de vencimento: boletos (único, parcelado, mensal) e parcelas de cartão; exatamente em 7, 3 e 0 dias antes; assinaturas ficam de fora.
- Fuso `America/Sao_Paulo`; vencimentos às 08:00 de Brasília (`0 11 * * *` em UTC); novidades checadas a cada 30 min (`*/30 * * * *`) e enviadas só entre 08:00 e 21:00 de Brasília; primeira execução de novidades só grava, não envia.
- No máximo 1 notificação de vencimento por pessoa por dia; 1 item mostra detalhe, vários mostram resumo.
- Cada aviso sai uma vez: `avisos_enviados` com PK `(user_id, chave)`, chave `gasto:parcela:momento`.
- Inscrição 404/410 do serviço de push é apagada; `x-cron-secret` errado responde 401.
- Segredos só no Supabase: `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`, `SITE_URL`. A chave pública VAPID vai no código do site.
- `js/parcelamento.js` é a única fonte da regra de datas; a função usa cópia gerada e um script falha se divergir.
- Ao sair da conta, apagar a inscrição daquele aparelho.
- `docs/` e `supabase/` ficam no `.assetsignore` (já feito). Textos do site em português.
- Mensagens de commit: curtas, em português, "o que mudou" (`CLAUDE.md`). Sem linha `Co-Authored-By`.
- Não fazer `git push` nem deploy sem o dono pedir.

## Review Focus

1. Vencimento no dia 31 caindo em mês de 30 dias ou em fevereiro: avisa no último dia do mês (tarefa 2).
2. Parcela já paga adiantada ou boleto cancelado: não avisa (tarefa 2).
3. Execução às 02:00 UTC (ainda é o dia anterior em Brasília): "hoje" é o dia de Brasília (tarefa 2).
4. Pessoa com vários aparelhos: todos recebem, o aviso conta uma vez só (tarefa 5).
5. Ativar duas vezes no mesmo aparelho: uma inscrição só (`endpoint` único, tarefa 6).
6. `resumo` da novidade com aspas escapadas ou vírgulas: lido por inteiro (tarefa 4).
7. Gasto sem `vencimento` (nulo): usa o dia da data do gasto (tarefa 2).

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `ferramentas/gerar-parcelamento.mjs` | gera `supabase/functions/avisos-push/parcelamento.mjs` a partir de `js/parcelamento.js` |
| `ferramentas/verificar-copia.mjs` | falha se a cópia gerada difere do que o gerador produziria |
| `supabase/functions/avisos-push/parcelamento.mjs` | cópia gerada (não editar à mão) |
| `supabase/functions/avisos-push/avisos.mjs` | `gastoDoBanco`, `hojeEmBrasilia`, `calcularAvisos`, `montarNotificacao` |
| `supabase/functions/avisos-push/novidades.mjs` | `lerNovidadeMaisRecente`, `montarNotificacaoNovidade` |
| `supabase/functions/avisos-push/executar.mjs` | `executarVencimentos`, `executarNovidades` (recebem `deps`) |
| `supabase/functions/avisos-push/index.ts` | HTTP, autenticação, `deps` reais (Supabase + web-push) |
| `ferramentas/testes/*.test.mjs` | testes `node:test` |
| `ferramentas/supabase-push.sql` | tabelas, RLS, grants |
| `ferramentas/supabase-push-agendamento.sql` | segredos no Vault e agendas `pg_cron` |
| `ferramentas/gerar-vapid.mjs` | gera o par de chaves VAPID |
| `js/notificacoes-push.js` | ativar/desativar/teste no navegador |
| `sw.js`, `configuracoes.html`, `js/banco.js`, `js/menu.js`, `privacidade.html` | ligações do cliente |

---

### Task 1: Cópia gerada do parcelamento e infraestrutura de testes

**Files:**
- Create: `ferramentas/gerar-parcelamento.mjs`, `ferramentas/verificar-copia.mjs`, `supabase/functions/avisos-push/parcelamento.mjs` (gerado), `ferramentas/testes/copia.test.mjs`
- Modify: `ferramentas/package.json` (scripts `test`, `gerar`, `verificar-copia`)

**Interfaces:**
- Produces: `parcelamento.mjs` exporta `somarMeses, ehParcelado, ehBoletoRecorrente, boletoDoMes, parcelaMarcadaPaga, listarParcelas` (mesmas assinaturas de `js/parcelamento.js`).
- Produces: `gerarCopia(textoOriginal: string): string` exportada de `gerar-parcelamento.mjs` (original + cabeçalho "GERADO, não edite" + `export { ... }`).

- [ ] **Step 1: Test** `copia.test.mjs`: (a) `gerarCopia(original)` contém o texto original inteiro e termina com um `export {` com os 6 nomes; (b) o arquivo gerado commitado é igual a `gerarCopia(js/parcelamento.js)`; (c) `import("../../supabase/functions/avisos-push/parcelamento.mjs")` expõe `listarParcelas` e `listarParcelas({parcelas:"2",data:"2026-01-31",vencimento:31,valor:100})[1].data` é 28/02/2026.
- [ ] **Step 2:** `node --test ferramentas/testes/` — esperado: FAIL (módulo não existe).
- [ ] **Step 3:** Implementar `gerar-parcelamento.mjs` (CLI grava o arquivo; exporta `gerarCopia`) e `verificar-copia.mjs` (sai com código 1 e mensagem em português se divergir). Rodar `node ferramentas/gerar-parcelamento.mjs`. Adicionar os scripts ao `package.json`.
- [ ] **Step 4:** `node --test ferramentas/testes/` e `node ferramentas/verificar-copia.mjs` — esperado: PASS, saída 0. Depois alterar um espaço em `js/parcelamento.js`, ver `verificar-copia` falhar, e desfazer.
- [ ] **Step 5:** Commit "copia gerada do parcelamento para a funcao de avisos e testes".

---

### Task 2: Cálculo dos avisos de vencimento

**Files:**
- Create: `supabase/functions/avisos-push/avisos.mjs`, `ferramentas/testes/avisos.test.mjs`

**Interfaces:**
- Consumes: `parcelamento.mjs` (Task 1).
- Produces:
  - `type Gasto = { id: number, plataforma: string, categoria: string, parcelas: string, data: string, valor: number, vencimento: number|null, canceladoEm: string|null, pagasAte: number, pagasFim: number, espacoId: string|null }`
  - `gastoDoBanco(linha: object): Gasto` (colunas `cancelado_em`, `pagas_ate`, `pagas_fim`, `espaco_id`; `valor` vira `Number`)
  - `hojeEmBrasilia(agora: Date): Date` (meia-noite do dia civil de Brasília, montada com `new Date(ano, mes, dia)`)
  - `type Aviso = { chave: string, dias: 0|3|7, tipo: "Boleto"|"Parcela", plataforma: string, valor: number, data: Date, numero: number, total: number }` (`total` 0 = boleto mensal)
  - `calcularAvisos(gastos: Gasto[], hoje: Date): Aviso[]` (ordenado por `dias`, depois `plataforma`)

- [ ] **Step 1: Tests** (um por linha, valores exatos): boleto único a 7/3/0 dias avisa com `chave` `id:1:7`/`id:1:3`/`id:1:0`; a 8, 5, 2, 1 dias não avisa; boleto parcelado usa a próxima parcela não paga (`pagasAte:2` → `numero 3`); boleto mensal pega o mês seguinte quando o vencimento do mês já passou; parcela de cartão (`categoria:"Compras"`, `parcelas:"6"`) avisa com `tipo:"Parcela"`; `Assinatura`, `parcelas:"avista"` e Pix não avisam; `canceladoEm` no mês anterior não avisa; vencimento 31 em fevereiro avisa em 28/02 (Review Focus 1, 2, 7: `vencimento:null` usa o dia de `data`); `hojeEmBrasilia(new Date("2026-10-10T02:00:00Z"))` é 09/10/2026 (Review Focus 3); `gastoDoBanco` converte `valor:"120.50"` em `120.5` e mapeia os nomes de coluna.
- [ ] **Step 2:** rodar `node --test ferramentas/testes/avisos.test.mjs` — FAIL.
- [ ] **Step 3:** Implementar. Boleto/parcela: reaproveitar a seleção da "próxima cobrança" que `montarAvisosBoleto` (`js/menu.js:117-157`) já usa (não paga e `data >= hoje`), estendida às parcelas de cartão (`ehParcelado(g) && g.categoria !== "Boleto"`). Aviso só quando `dias` é exatamente 7, 3 ou 0.
- [ ] **Step 4:** testes passam.
- [ ] **Step 5:** Commit "calculo dos avisos de vencimento (boleto e parcela de cartao)".

---

### Task 3: Texto da notificação de vencimento

**Files:**
- Modify: `supabase/functions/avisos-push/avisos.mjs`, `ferramentas/testes/avisos.test.mjs`

**Interfaces:**
- Consumes: `Aviso` (Task 2).
- Produces: `type Notificacao = { titulo: string, corpo: string, url: string, tag: string }`; `montarNotificacao(avisos: Aviso[]): Notificacao | null`.

- [ ] **Step 1: Tests:** lista vazia → `null`; 1 boleto a 1... usar `dias:3` → `titulo` `"Boleto Enel vence em 3 dias"`, `corpo` `"15/10/2026 · R$ 120,00 · parcela 3/6"`, `url` `"parcelas.html"`; `dias:0` → `"Boleto Enel vence hoje"`; boleto mensal → corpo termina com `"todo mês"`; parcela de cartão → título começa com `"Parcela Magalu"`; 3 avisos → `titulo` `"3 vencimentos esta semana"` e `corpo` com os nomes (máx. 3; com 4 ou mais, os 3 primeiros e `"…"`).
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implementar `montarNotificacao` (formatar data e moeda em `pt-BR`; `tag` fixa `"vencimentos"` para a notificação nova substituir a anterior).
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit "texto da notificacao de vencimento".

---

### Task 4: Leitura da novidade mais recente

**Files:**
- Create: `supabase/functions/avisos-push/novidades.mjs`, `ferramentas/testes/novidades.test.mjs`

**Interfaces:**
- Produces: `type Novidade = { id: string, versao: string, data: string, resumo: string }` (`id` = `data + "|" + versao`, igual a `idNovidade` em `js/novidades.js`); `lerNovidadeMaisRecente(textoJs: string): Novidade | null`; `montarNotificacaoNovidade(n: Novidade): Notificacao` (`titulo "Novidade no Dashvia"`, `corpo` `"<versao>: <resumo>"`, `url "dashboard.html?novidades=1"`, `tag "novidades"`).

- [ ] **Step 1: Tests:** usar o conteúdo real de `js/novidades.js` (lido do disco): devolve `versao "Início do beta teste"`, `data "2026-10-05"`; com duas entradas devolve a primeira; `resumo` com `\"` e vírgulas é lido inteiro (Review Focus 6); texto sem `NOVIDADES` ou lista vazia → `null`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implementar com regex na primeira entrada do array (não executar o texto como código); desfazer escapes `\"` e `\\`.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit "leitura da novidade mais recente do novidades.js".

---

### Task 5: Orquestração do envio

**Files:**
- Create: `supabase/functions/avisos-push/executar.mjs`, `ferramentas/testes/executar.test.mjs`

**Interfaces:**
- Consumes: `calcularAvisos`, `montarNotificacao`, `hojeEmBrasilia` (Tasks 2-3); `lerNovidadeMaisRecente`, `montarNotificacaoNovidade` (Task 4).
- Produces:
  - `type Inscricao = { id: number, user_id: string, endpoint: string, p256dh: string, auth: string }`
  - `type Deps = { listarInscricoes(): Promise<Inscricao[]>, listarGastosDe(userId: string): Promise<Gasto[]>, registrarAviso(userId: string, chave: string): Promise<boolean>, desfazerAviso(userId: string, chave: string): Promise<void>, enviar(i: Inscricao, n: Notificacao): Promise<"ok"|"gone"|"erro">, apagarInscricao(id: number): Promise<void>, lerEstado(chave: string): Promise<string|null>, gravarEstado(chave: string, valor: string): Promise<void>, buscarNovidadesJs(): Promise<string> }`
  - `executarVencimentos(deps: Deps, agora: Date): Promise<{ usuarios: number, enviadas: number, removidas: number }>`
  - `executarNovidades(deps: Deps, agora: Date): Promise<{ enviou: boolean, motivo: "ok"|"primeira-vez"|"sem-novidade"|"fora-do-horario"|"formato" }>`
  - `enviarParaUsuario(deps: Deps, inscricoes: Inscricao[], n: Notificacao): Promise<{ ok: number, removidas: number }>` (reutilizada pelo modo teste)

- [ ] **Step 1: Tests com `deps` falsas:** só registra e envia avisos novos (`registrarAviso` falso → não envia, Review Focus: sem repetição); 3 avisos do mesmo usuário geram 1 envio por aparelho; usuário com 2 aparelhos recebe nos 2 e `registrarAviso` é chamado uma vez por chave (Review Focus 4); `"gone"` chama `apagarInscricao`; todos `"erro"` chama `desfazerAviso` para as chaves e não conta como enviada; usuário sem avisos não envia; novidades: 1ª execução (`lerEstado` nulo) grava e não envia; id igual → `"sem-novidade"`; id novo dentro do horário envia a todas as inscrições e grava; novidade nova às 22:00 de Brasília → `"fora-do-horario"` sem gravar; `buscarNovidadesJs` com texto inválido → `"formato"`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implementar conforme o spec ("Antirrepetição", "Sem spam"). O estado das novidades usa a chave `"ultima_novidade"`.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit "orquestracao do envio de vencimentos e novidades".

---

### Task 6: Tabelas e segurança no banco

**Files:**
- Create: `ferramentas/supabase-push.sql`

**Interfaces:**
- Produces: tabelas `public.push_inscricoes (id bigint identity PK, user_id uuid default auth.uid() references auth.users on delete cascade, endpoint text unique not null, p256dh text not null, auth text not null, criado_em timestamptz default now())`, `public.avisos_enviados (user_id uuid references auth.users on delete cascade, chave text, enviado_em timestamptz default now(), PK (user_id, chave))`, `public.estado_envio (chave text PK, valor text not null)`.

- [ ] **Step 1:** Escrever o SQL no padrão de `ferramentas/supabase-seguranca.sql` (idempotente, comentários em português): RLS ligado nas 3 tabelas; `push_inscricoes` com políticas `select/insert/delete` só do próprio `user_id` e sem `update`; `avisos_enviados` e `estado_envio` sem política e sem grant para `anon`/`authenticated`; `revoke all ... from anon`; limites de tamanho em `endpoint`, `p256dh`, `auth` (`not valid`); `insert` do cliente via `upsert` no `endpoint` exige política de `update`, então o cliente apaga e reinsere (decisão: sem política de update).
- [ ] **Step 2:** O dono roda no SQL Editor. Verificar com a conta de teste, no navegador (`db` global): inserir inscrição própria funciona; inserir com `user_id` de outro falha; inserir o mesmo `endpoint` duas vezes falha com violação de unicidade (Review Focus 5); `select` em `avisos_enviados` e `estado_envio` falha ou volta vazio; `anon` não lê nada.
- [ ] **Step 3:** Commit "tabelas e seguranca das notificacoes push".

---

### Task 7: Função HTTP, chaves VAPID e agendamento

**Files:**
- Create: `supabase/functions/avisos-push/index.ts`, `ferramentas/gerar-vapid.mjs`, `ferramentas/supabase-push-agendamento.sql`

**Interfaces:**
- Consumes: `executarVencimentos`, `executarNovidades`, `enviarParaUsuario`, `Deps` (Task 5); tabelas da Task 6.
- Produces: `POST /functions/v1/avisos-push` com corpo `{ "modo": "vencimentos" | "novidades" | "teste" }`; `vencimentos` e `novidades` exigem `x-cron-secret` igual a `CRON_SECRET` (senão 401); `teste` exige `Authorization: Bearer <JWT do usuário>` e envia `{titulo:"Teste do Dashvia", corpo:"Se você viu isto, as notificações funcionam.", url:"dashboard.html", tag:"teste"}` só aos aparelhos dele. Resposta JSON com os contadores.

- [ ] **Step 1:** `gerar-vapid.mjs`: gera par P-256 com `node:crypto` e imprime `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` em base64url. Rodar e conferir que a pública tem 87 caracteres.
- [ ] **Step 2:** `index.ts`: montar `Deps` reais com `supabase-js` (cliente com a chave de serviço injetada pelo Supabase); `listarGastosDe` busca `gastos` com `user_id = userId and espaco_id is null` mais os do espaço do usuário (via `membros`) e passa por `gastoDoBanco`; `registrarAviso` faz `insert ... on conflict do nothing` e devolve se inseriu; `buscarNovidadesJs` faz `fetch(SITE_URL + "/js/novidades.js")`; `enviar` usa uma biblioteca de Web Push compatível com Deno e mapeia 404/410 para `"gone"`, falhas para `"erro"`. Se a primeira biblioteca (`npm:web-push`) não rodar no Edge Runtime, trocar por outra e anotar no commit.
- [ ] **Step 3:** `supabase-push-agendamento.sql`: guardar `CRON_SECRET` no Vault; criar as duas agendas (`0 11 * * *` com `{"modo":"vencimentos"}` e `*/30 * * * *` com `{"modo":"novidades"}`) via `net.http_post` para `https://xouwjsnfkhegwxhxtmeb.supabase.co/functions/v1/avisos-push` com o cabeçalho `x-cron-secret`; trecho para remover as agendas.
- [ ] **Step 4:** Verificação local do que dá: `deno check` ou `npx tsc --noEmit` do `index.ts` se disponível; a chamada real é testada no deploy (Task 9).
- [ ] **Step 5:** Commit "funcao avisos-push, chaves VAPID e agendamento".

---

### Task 8: Cliente (service worker, tela de Configurações, saída da conta, privacidade)

**Files:**
- Create: `js/notificacoes-push.js`, `ferramentas/testes/cliente-push.test.mjs`
- Modify: `sw.js`, `configuracoes.html`, `js/configuracoes.js` (se precisar de gancho), `js/banco.js:81-90` (função `sair`), `js/menu.js` (abrir Novidades quando a URL tiver `?novidades=1`), `privacidade.html`, versões de cache dos HTMLs afetados

**Interfaces:**
- Produces: em `js/notificacoes-push.js`: `urlBase64ParaBytes(texto: string): Uint8Array`; `estadoDasNotificacoes(info: { suportado: boolean, permissao: "default"|"granted"|"denied", ios_sem_instalar: boolean, inscrito: boolean }): "nao-suportado"|"instale-no-iphone"|"bloqueado"|"desativado"|"ativo"`; `ativarNotificacoes(): Promise<void>`, `desativarNotificacoes(): Promise<void>`, `enviarTeste(): Promise<void>`, `apagarInscricaoDesteAparelho(): Promise<void>` (usada por `sair()`).
- Consumes: `db` global de `js/banco.js`; chave pública VAPID (constante no arquivo).

- [ ] **Step 1: Tests** (carregar o `.js` com `new Function`, como no teste de `senhaFraca`): `estadoDasNotificacoes` para cada combinação do contrato acima (bloqueado vence ativo; iOS sem instalar vence tudo exceto não-suportado); `urlBase64ParaBytes("AQAB")` devolve `[1,0,1]`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implementar `js/notificacoes-push.js`. Ativar: pedir permissão, `pushManager.subscribe({userVisibleOnly:true, applicationServerKey})`, apagar inscrição antiga do mesmo `endpoint` e inserir em `push_inscricoes`. Teste: `fetch` ao endpoint da função com o JWT da sessão (a URL da função entra em `connect-src` já liberada para o domínio do Supabase).
- [ ] **Step 4:** `sw.js`: listener `push` (lê JSON `{titulo, corpo, url, tag}`, `showNotification` com `icon img/icone-192.png`, `badge`, `data:{url}`) e `notificationclick` (foca janela aberta do site ou `openWindow(url)`); manter "sem cache". `configuracoes.html`: linha "Notificações no aparelho" com botão ativar/desativar, botão "Enviar teste" e texto de estado, no estilo das outras linhas, sem script inline (CSP). `banco.js` `sair()`: chamar `apagarInscricaoDesteAparelho()` antes do `signOut`, ignorando falhas. `menu.js`: se `location.search` tiver `novidades=1`, chamar `abrirNovidades()` depois de carregar as novidades. `privacidade.html`: parágrafo sobre a inscrição de notificações (spec, seção 4), com a data de atualização.
- [ ] **Step 5:** Testes passam; subir o site local (`node $TEMP/srv.cjs`), entrar com a conta de teste, abrir Configurações e conferir: a linha aparece, o estado inicial é correto, nenhum erro de CSP no console. Conferir `?novidades=1` abrindo a janela de Novidades.
- [ ] **Step 6:** Commit "notificacoes push no cliente: service worker, configuracoes e saida da conta".

---

### Task 9: Publicação e verificação ponta a ponta (com o dono)

**Files:** nenhum novo (verificação). Ajustes só se algo falhar.

- [ ] **Step 1:** Rodar tudo: `node --test ferramentas/testes/` e `node ferramentas/verificar-copia.mjs` — esperado: tudo passa.
- [ ] **Step 2 (dono, painel Supabase):** ligar `pg_cron` e `pg_net` (Database → Extensions); rodar `supabase-push.sql`; cadastrar os segredos da função (`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` como `mailto:` do dono, `CRON_SECRET`, `SITE_URL`); publicar a função `avisos-push` com verificação de JWT desligada (a função valida sozinha); rodar `supabase-push-agendamento.sql`. Guiar cada clique.
- [ ] **Step 3:** Colocar a chave pública VAPID em `js/notificacoes-push.js`, `git push` (só com o dono pedindo) e esperar o deploy da Cloudflare.
- [ ] **Step 4 (dono):** no celular e no computador, Configurações → ativar → "Enviar teste": a notificação chega e o toque abre o site. No iPhone, instalar na tela inicial antes.
- [ ] **Step 5:** Vencimento: na conta de teste, criar um boleto com vencimento daqui a 3 dias e chamar a função no modo `vencimentos` (com o `x-cron-secret`): chega 1 notificação; chamar de novo: não repete.
- [ ] **Step 6:** Novidade: adicionar um bloco de teste em `js/novidades.js`, publicar e esperar até 30 min: chega o aviso uma vez. Remover o bloco de teste depois.
- [ ] **Step 7:** Sair da conta no aparelho e confirmar que a inscrição sumiu de `push_inscricoes`. Apagar a conta de teste.
