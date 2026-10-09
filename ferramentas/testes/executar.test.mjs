import test from "node:test";
import assert from "node:assert/strict";
import { executarVencimentos, executarNovidades, enviarParaUsuario } from "../../supabase/functions/avisos-push/executar.mjs";

// 10/10/2026 11:00 UTC = 08:00 em Brasília
const AGORA = new Date("2026-10-10T11:00:00Z");

function boleto(extra) {
  return { id: 1, plataforma: "Enel", categoria: "Boleto", parcelas: "1", data: "2026-10-17", valor: 120, vencimento: 17, canceladoEm: null, pagasAte: 0, pagasFim: 0, espacoId: null, ...extra };
}

function inscricao(id, userId) {
  return { id, user_id: userId, endpoint: "https://push/" + id, p256dh: "p", auth: "a" };
}

// deps falsas que anotam o que acontece
function fabricarDeps(config = {}) {
  const log = { enviados: [], apagadas: [], desfeitos: [], registrados: [], estado: { ...(config.estado || {}) } };
  const jaRegistrados = new Set(config.jaRegistrados || []);
  const deps = {
    listarInscricoes: async () => config.inscricoes || [],
    listarGastosDe: async (userId) => (config.gastos || {})[userId] || [],
    registrarAviso: async (userId, chave) => {
      const k = userId + "|" + chave;
      log.registrados.push(k);
      if (jaRegistrados.has(k)) return false;
      jaRegistrados.add(k);
      return true;
    },
    desfazerAviso: async (userId, chave) => { log.desfeitos.push(userId + "|" + chave); jaRegistrados.delete(userId + "|" + chave); },
    enviar: async (i, n) => { log.enviados.push({ inscricao: i.id, n }); return (config.resultado || {})[i.id] || "ok"; },
    apagarInscricao: async (id) => { log.apagadas.push(id); },
    lerEstado: async (chave) => log.estado[chave] ?? null,
    gravarEstado: async (chave, valor) => { log.estado[chave] = valor; },
    buscarNovidadesJs: async () => config.novidadesJs ?? ""
  };
  return { deps, log };
}

test("envia o aviso novo e não repete um já registrado", async () => {
  const { deps, log } = fabricarDeps({ inscricoes: [inscricao(1, "u1")], gastos: { u1: [boleto({})] }, jaRegistrados: ["u1|1:1:7"] });
  const r = await executarVencimentos(deps, AGORA);
  assert.equal(log.enviados.length, 0);
  assert.equal(r.enviadas, 0);
});

test("vários avisos do mesmo usuário geram uma notificação por aparelho, com dois aparelhos recebendo", async () => {
  const gastos = [boleto({ id: 1, plataforma: "Enel" }), boleto({ id: 2, plataforma: "Claro" }), boleto({ id: 3, plataforma: "Vivo" })];
  const { deps, log } = fabricarDeps({ inscricoes: [inscricao(1, "u1"), inscricao(2, "u1")], gastos: { u1: gastos } });
  const r = await executarVencimentos(deps, AGORA);
  assert.equal(log.enviados.length, 2);
  assert.deepEqual(log.enviados.map((e) => e.inscricao).sort(), [1, 2]);
  assert.equal(log.enviados[0].n.titulo, "3 vencimentos esta semana");
  assert.equal(log.registrados.length, 3); // uma vez por chave, não por aparelho
  assert.deepEqual([r.usuarios, r.enviadas], [1, 1]);
});

test("usuário sem avisos não recebe nada", async () => {
  const { deps, log } = fabricarDeps({ inscricoes: [inscricao(1, "u1")], gastos: { u1: [boleto({ data: "2026-12-30", vencimento: 30 })] } });
  await executarVencimentos(deps, AGORA);
  assert.equal(log.enviados.length, 0);
});

test("inscrição que o serviço de push disse não existir mais é apagada", async () => {
  const { deps, log } = fabricarDeps({ inscricoes: [inscricao(1, "u1"), inscricao(2, "u1")], gastos: { u1: [boleto({})] }, resultado: { 1: "gone" } });
  const r = await executarVencimentos(deps, AGORA);
  assert.deepEqual(log.apagadas, [1]);
  assert.equal(r.removidas, 1);
  assert.equal(r.enviadas, 1);
});

test("se todos os envios falham, o aviso é desfeito para tentar de novo", async () => {
  const { deps, log } = fabricarDeps({ inscricoes: [inscricao(1, "u1")], gastos: { u1: [boleto({})] }, resultado: { 1: "erro" } });
  const r = await executarVencimentos(deps, AGORA);
  assert.deepEqual(log.desfeitos, ["u1|1:1:7"]);
  assert.equal(r.enviadas, 0);
});

test("enviarParaUsuario conta ok e removidas", async () => {
  const { deps } = fabricarDeps({ resultado: { 2: "gone", 3: "erro" } });
  const r = await enviarParaUsuario(deps, [inscricao(1, "u"), inscricao(2, "u"), inscricao(3, "u")], { titulo: "t", corpo: "c", url: "u", tag: "x" });
  assert.deepEqual(r, { ok: 1, removidas: 1 });
});

const NOVIDADES_JS = 'const NOVIDADES = [ { versao: "V2", data: "2026-11-01", resumo: "Algo novo." } ];';

test("novidades: a primeira execução só grava, sem enviar", async () => {
  const { deps, log } = fabricarDeps({ inscricoes: [inscricao(1, "u1")], novidadesJs: NOVIDADES_JS });
  const r = await executarNovidades(deps, AGORA);
  assert.deepEqual(r, { enviou: false, motivo: "primeira-vez" });
  assert.equal(log.estado.ultima_novidade, "2026-11-01|V2");
  assert.equal(log.enviados.length, 0);
});

test("novidades: mesmo id não envia", async () => {
  const { deps, log } = fabricarDeps({ inscricoes: [inscricao(1, "u1")], novidadesJs: NOVIDADES_JS, estado: { ultima_novidade: "2026-11-01|V2" } });
  assert.deepEqual(await executarNovidades(deps, AGORA), { enviou: false, motivo: "sem-novidade" });
  assert.equal(log.enviados.length, 0);
});

test("novidades: id novo dentro do horário envia a todas as inscrições e grava", async () => {
  const { deps, log } = fabricarDeps({ inscricoes: [inscricao(1, "u1"), inscricao(2, "u2")], novidadesJs: NOVIDADES_JS, estado: { ultima_novidade: "2026-10-05|V1" } });
  assert.deepEqual(await executarNovidades(deps, AGORA), { enviou: true, motivo: "ok" });
  assert.equal(log.enviados.length, 2);
  assert.equal(log.enviados[0].n.titulo, "Novidade no Dashvia");
  assert.equal(log.estado.ultima_novidade, "2026-11-01|V2");
});

test("novidades: às 22:00 de Brasília espera, sem gravar", async () => {
  const { deps, log } = fabricarDeps({ inscricoes: [inscricao(1, "u1")], novidadesJs: NOVIDADES_JS, estado: { ultima_novidade: "2026-10-05|V1" } });
  const r = await executarNovidades(deps, new Date("2026-10-11T01:00:00Z")); // 22:00 BRT
  assert.deepEqual(r, { enviou: false, motivo: "fora-do-horario" });
  assert.equal(log.estado.ultima_novidade, "2026-10-05|V1");
  assert.equal(log.enviados.length, 0);
});

test("novidades: texto inválido devolve formato", async () => {
  const { deps } = fabricarDeps({ novidadesJs: "<html>erro</html>" });
  assert.deepEqual(await executarNovidades(deps, AGORA), { enviou: false, motivo: "formato" });
});

test("novidades: com ignorarHorario envia mesmo às 22:00 de Brasília", async () => {
  const { deps, log } = fabricarDeps({ inscricoes: [inscricao(1, "u1")], novidadesJs: NOVIDADES_JS, estado: { ultima_novidade: "2026-10-05|V1" } });
  const r = await executarNovidades(deps, new Date("2026-10-11T01:00:00Z"), { ignorarHorario: true });
  assert.deepEqual(r, { enviou: true, motivo: "ok" });
  assert.equal(log.enviados.length, 1);
});

test("novidades: uma novidade mais antiga que a última enviada (bloco removido) não avisa, só atualiza o registro", async () => {
  const { deps, log } = fabricarDeps({
    inscricoes: [inscricao(1, "u1")],
    novidadesJs: 'const NOVIDADES = [ { versao: "V1", data: "2026-10-05", resumo: "velha" } ];',
    estado: { ultima_novidade: "2026-10-09|Teste" }
  });
  assert.deepEqual(await executarNovidades(deps, AGORA), { enviou: false, motivo: "sem-novidade" });
  assert.equal(log.enviados.length, 0);
  assert.equal(log.estado.ultima_novidade, "2026-10-05|V1");
});
