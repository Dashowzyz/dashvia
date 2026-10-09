import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// js/notificacoes-push.js é um script de navegador (sem export): carregamos o texto como o site faz
const fonte = readFileSync(new URL("../../js/notificacoes-push.js", import.meta.url), "utf8");
const { urlBase64ParaBytes, estadoDasNotificacoes } = new Function(fonte + "\nreturn { urlBase64ParaBytes, estadoDasNotificacoes };")();

test("urlBase64ParaBytes converte base64 de URL em bytes", () => {
  assert.deepEqual(Array.from(urlBase64ParaBytes("AQAB")), [1, 0, 1]);
  assert.deepEqual(Array.from(urlBase64ParaBytes("-_8")), [251, 255]);
});

const base = { suportado: true, permissao: "default", ios_sem_instalar: false, inscrito: false };

test("estadoDasNotificacoes cobre cada situação", () => {
  assert.equal(estadoDasNotificacoes({ ...base, suportado: false }), "nao-suportado");
  assert.equal(estadoDasNotificacoes(base), "desativado");
  assert.equal(estadoDasNotificacoes({ ...base, permissao: "granted" }), "desativado");
  assert.equal(estadoDasNotificacoes({ ...base, permissao: "granted", inscrito: true }), "ativo");
  assert.equal(estadoDasNotificacoes({ ...base, permissao: "denied" }), "bloqueado");
});

test("bloqueado vence ativo, e iPhone sem instalar vence tudo (o Safari comum nem tem PushManager)", () => {
  assert.equal(estadoDasNotificacoes({ ...base, permissao: "denied", inscrito: true }), "bloqueado");
  assert.equal(estadoDasNotificacoes({ ...base, ios_sem_instalar: true }), "instale-no-iphone");
  assert.equal(estadoDasNotificacoes({ ...base, suportado: false, ios_sem_instalar: true }), "instale-no-iphone");
  assert.equal(estadoDasNotificacoes({ ...base, ios_sem_instalar: true, permissao: "denied" }), "instale-no-iphone");
});
