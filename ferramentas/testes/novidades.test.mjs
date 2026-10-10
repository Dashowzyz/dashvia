import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lerNovidadeMaisRecente, montarNotificacaoNovidade } from "../../supabase/functions/avisos-push/novidades.mjs";

const real = readFileSync(new URL("../../js/novidades.js", import.meta.url), "utf8");

test("lê a novidade real do novidades.js", () => {
  const n = lerNovidadeMaisRecente(real);
  assert.equal(n.versao, "Início do beta teste");
  assert.equal(n.data, "2026-10-09");
  assert.equal(n.id, "2026-10-09|Início do beta teste");
  assert.ok(n.resumo.startsWith("O Dashvia começou a fase de testes."));
});

test("com duas entradas devolve a primeira", () => {
  const texto = 'const NOVIDADES = [ { versao: "B", data: "2026-11-01", resumo: "novo" }, { versao: "A", data: "2026-10-05", resumo: "velho" } ];';
  assert.equal(lerNovidadeMaisRecente(texto).versao, "B");
});

test("resumo com aspas escapadas e vírgulas é lido inteiro", () => {
  const texto = 'const NOVIDADES = [ { versao: "V1", data: "2026-11-01", resumo: "Use \\"Reportar\\", sim, e pronto." } ];';
  assert.equal(lerNovidadeMaisRecente(texto).resumo, 'Use "Reportar", sim, e pronto.');
});

test("sem NOVIDADES, lista vazia ou campo faltando devolve null", () => {
  assert.equal(lerNovidadeMaisRecente("const OUTRA = [];"), null);
  assert.equal(lerNovidadeMaisRecente("const NOVIDADES = [];"), null);
  assert.equal(lerNovidadeMaisRecente('const NOVIDADES = [ { versao: "X" } ];'), null);
});

test("notificação da novidade", () => {
  const n = { id: "i", versao: "V2", data: "2026-11-01", resumo: "Algo novo." };
  assert.deepEqual(montarNotificacaoNovidade(n), { titulo: "Novidade no Dashvia", corpo: "V2: Algo novo.", url: "dashboard.html?novidades=1", tag: "novidades" });
});
