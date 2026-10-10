import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// js/novidades.js é um script de navegador (sem export): carregamos o texto como o site faz
const fonte = readFileSync(new URL("../../js/novidades.js", import.meta.url), "utf8");
// o arquivo mexe na página ao carregar (liga o botão "Novidades"): damos a ele uma página de mentirinha
const paginaFalsa = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {} };
const { deveAgradecer } = new Function("document", fonte + "\nreturn { deveAgradecer };")(paginaFalsa);

const agora = new Date("2026-10-10T12:00:00Z").getTime();
const dias = (n) => new Date(agora - n * 86400000).toISOString();

test("conta criada agora ou há poucos dias recebe o agradecimento", () => {
  assert.equal(deveAgradecer({ created_at: dias(0) }, agora), true);
  assert.equal(deveAgradecer({ created_at: dias(3) }, agora), true);
  assert.equal(deveAgradecer({ created_at: dias(6.9) }, agora), true);
});

test("conta com mais de 7 dias não recebe", () => {
  assert.equal(deveAgradecer({ created_at: dias(7.1) }, agora), false);
  assert.equal(deveAgradecer({ created_at: dias(40) }, agora), false);
});

test("dados que faltam ou estão errados não recebem (e não quebram)", () => {
  assert.equal(deveAgradecer(null, agora), false);
  assert.equal(deveAgradecer({}, agora), false);
  assert.equal(deveAgradecer({ created_at: "lixo" }, agora), false);
  assert.equal(deveAgradecer({ created_at: dias(-2) }, agora), false); // data no futuro
});
