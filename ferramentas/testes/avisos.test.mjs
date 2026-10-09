import test from "node:test";
import assert from "node:assert/strict";
import { calcularAvisos, gastoDoBanco, hojeEmBrasilia } from "../../supabase/functions/avisos-push/avisos.mjs";

const hoje = new Date(2026, 9, 10); // 10/10/2026

function boleto(extra) {
  return { id: 1, plataforma: "Enel", categoria: "Boleto", parcelas: "1", data: "2026-10-17", valor: 120, vencimento: 17, canceladoEm: null, pagasAte: 0, pagasFim: 0, espacoId: null, ...extra };
}

test("boleto único avisa a 7, 3 e 0 dias com a chave id:parcela:momento", () => {
  assert.deepEqual(calcularAvisos([boleto({})], new Date(2026, 9, 10)).map((a) => [a.chave, a.dias]), [["1:1:7", 7]]);
  assert.deepEqual(calcularAvisos([boleto({})], new Date(2026, 9, 14)).map((a) => [a.chave, a.dias]), [["1:1:3", 3]]);
  assert.deepEqual(calcularAvisos([boleto({})], new Date(2026, 9, 17)).map((a) => [a.chave, a.dias]), [["1:1:0", 0]]);
});

test("boleto único não avisa a 8, 5, 2 e 1 dias", () => {
  for (const dia of [9, 12, 15, 16]) assert.deepEqual(calcularAvisos([boleto({})], new Date(2026, 9, dia)), []);
});

test("boleto parcelado usa a próxima parcela não paga", () => {
  const g = boleto({ parcelas: "6", data: "2026-08-17", vencimento: 17, pagasAte: 2 });
  const [a] = calcularAvisos([g], new Date(2026, 9, 10));
  assert.equal(a.numero, 3);
  assert.equal(a.total, 6);
  assert.equal(a.chave, "1:3:7");
});

test("boleto mensal olha o mês seguinte quando o vencimento do mês já passou", () => {
  const g = boleto({ parcelas: "mensal", data: "2026-01-05", vencimento: 5 });
  const [a] = calcularAvisos([g], new Date(2026, 9, 29)); // 05/11 está a 7 dias
  assert.equal(a.dias, 7);
  assert.equal(a.total, 0);
  assert.equal(a.data.getMonth(), 10);
});

test("parcela de cartão avisa como Parcela", () => {
  const g = boleto({ id: 2, plataforma: "Magalu", categoria: "Compras", parcelas: "6", data: "2026-10-01", vencimento: 17 });
  const [a] = calcularAvisos([g], new Date(2026, 9, 10));
  assert.equal(a.tipo, "Parcela");
  assert.equal(a.numero, 1);
});

test("assinatura, à vista e Pix não avisam", () => {
  const base = { data: "2026-10-17", vencimento: 17 };
  for (const extra of [{ categoria: "Assinatura", parcelas: "mensal" }, { categoria: "Compras", parcelas: "avista" }, { categoria: "Compras", parcelas: "pix" }]) {
    assert.deepEqual(calcularAvisos([boleto({ ...base, ...extra })], new Date(2026, 9, 10)), []);
  }
});

test("boleto cancelado e parcela já paga não avisam", () => {
  const cancelado = boleto({ parcelas: "mensal", data: "2026-01-17", vencimento: 17, canceladoEm: "2026-10-01" });
  assert.deepEqual(calcularAvisos([cancelado], new Date(2026, 9, 10)), []);
  const paga = boleto({ parcelas: "1", pagasAte: 1 });
  assert.deepEqual(calcularAvisos([paga], new Date(2026, 9, 10)), []);
});

test("vencimento 31 em mês curto avisa no último dia do mês", () => {
  const g = boleto({ parcelas: "mensal", data: "2026-01-31", vencimento: 31 });
  const [a] = calcularAvisos([g], new Date(2026, 1, 21)); // fevereiro de 2026 acaba em 28
  assert.equal(a.dias, 7);
  assert.equal(a.data.getDate(), 28);
});

test("sem vencimento usa o dia da data do gasto", () => {
  const [a] = calcularAvisos([boleto({ vencimento: null, data: "2026-10-17" })], new Date(2026, 9, 10));
  assert.equal(a.data.getDate(), 17);
});

test("avisos saem ordenados por dias e depois por plataforma", () => {
  const lista = [boleto({ id: 1, plataforma: "Zeta", data: "2026-10-17" }), boleto({ id: 2, plataforma: "Alfa", data: "2026-10-17" }), boleto({ id: 3, plataforma: "Hoje", data: "2026-10-10", vencimento: 10 })];
  assert.deepEqual(calcularAvisos(lista, hoje).map((a) => a.plataforma), ["Hoje", "Alfa", "Zeta"]);
});

test("hojeEmBrasilia usa o dia civil de Brasília", () => {
  const d = hojeEmBrasilia(new Date("2026-10-10T02:00:00Z"));
  assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()], [2026, 9, 9, 0]);
  const e = hojeEmBrasilia(new Date("2026-10-10T11:00:00Z"));
  assert.equal(e.getDate(), 10);
});

test("gastoDoBanco converte tipos e nomes de coluna", () => {
  const g = gastoDoBanco({ id: 7, plataforma: "X", categoria: "Boleto", parcelas: "3", data: "2026-10-17", valor: "120.50", vencimento: null, cancelado_em: null, pagas_ate: null, pagas_fim: 1, espaco_id: "e1" });
  assert.deepEqual(g, { id: 7, plataforma: "X", categoria: "Boleto", parcelas: "3", data: "2026-10-17", valor: 120.5, vencimento: null, canceladoEm: null, pagasAte: 0, pagasFim: 1, espacoId: "e1" });
});

import { montarNotificacao } from "../../supabase/functions/avisos-push/avisos.mjs";

function aviso(extra) {
  return { chave: "1:3:3", dias: 3, tipo: "Boleto", plataforma: "Enel", valor: 120, data: new Date(2026, 9, 15), numero: 3, total: 6, ...extra };
}

test("sem avisos não há notificação", () => {
  assert.equal(montarNotificacao([]), null);
});

test("um boleto parcelado mostra o detalhe", () => {
  assert.deepEqual(montarNotificacao([aviso({})]), {
    titulo: "Boleto Enel vence em 3 dias",
    corpo: "15/10/2026 · R$ 120,00 · parcela 3/6",
    url: "parcelas.html",
    tag: "vencimentos"
  });
});

test("vence hoje e vence em 7 dias", () => {
  assert.equal(montarNotificacao([aviso({ dias: 0 })]).titulo, "Boleto Enel vence hoje");
  assert.equal(montarNotificacao([aviso({ dias: 7 })]).titulo, "Boleto Enel vence em 7 dias");
});

test("boleto mensal termina com 'todo mês' e parcela de cartão começa com Parcela", () => {
  assert.ok(montarNotificacao([aviso({ total: 0 })]).corpo.endsWith("todo mês"));
  assert.ok(montarNotificacao([aviso({ tipo: "Parcela", plataforma: "Magalu" })]).titulo.startsWith("Parcela Magalu"));
});

test("vários avisos viram um resumo com até 3 nomes", () => {
  const tres = ["Enel", "Nubank", "Claro"].map((p) => aviso({ plataforma: p }));
  const n = montarNotificacao(tres);
  assert.equal(n.titulo, "3 vencimentos esta semana");
  assert.equal(n.corpo, "Enel, Nubank, Claro");
  const quatro = montarNotificacao([...tres, aviso({ plataforma: "Vivo" })]);
  assert.equal(quatro.titulo, "4 vencimentos esta semana");
  assert.equal(quatro.corpo, "Enel, Nubank, Claro…");
});
