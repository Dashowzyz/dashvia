import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// js/gasto-formulario.js é um script de navegador (sem export): carregamos o texto como o site faz
const fonte = readFileSync(new URL("../../js/gasto-formulario.js", import.meta.url), "utf8");
const { parcelasDigitadas, montarGasto, opcoesComAtual } = new Function(fonte + "\nreturn { parcelasDigitadas, montarGasto, opcoesComAtual };")();

test("parcelasDigitadas aceita inteiros de 1 a 60", () => {
  assert.equal(parcelasDigitadas("1"), 1);
  assert.equal(parcelasDigitadas(" 24 "), 24);
  assert.equal(parcelasDigitadas("60"), 60);
});

test("parcelasDigitadas recusa vazio, zero, acima de 60, quebrado e texto", () => {
  for (const t of ["", "0", "61", "2.5", "3,5", "-2", "abc", "12x", null, undefined]) {
    assert.equal(parcelasDigitadas(t), null, String(t));
  }
});

const base = { plataforma: " Magalu ", data: "2026-10-11", valor: "250.5", vencimento: "10", banco: "Nubank", forma: "cartao", tipoBoleto: "", parcelasBoleto: "" };

test("crédito parcelado guarda as parcelas, o vencimento e o cartão", () => {
  assert.deepEqual(montarGasto({ ...base, categoria: "Compras", parcelas: "24" }), {
    plataforma: "Magalu", categoria: "Compras", parcelas: "24", data: "2026-10-11", valor: 250.5, vencimento: 10, banco: "Nubank"
  });
});

test("crédito à vista não guarda vencimento", () => {
  const g = montarGasto({ ...base, categoria: "Transportes", parcelas: "avista" });
  assert.equal(g.parcelas, "avista");
  assert.equal(g.vencimento, null);
  assert.equal(g.categoria, "Transportes");
});

test("Pix vira parcelas 'pix', sem vencimento, com o banco escolhido", () => {
  const g = montarGasto({ ...base, categoria: "Alimentação", forma: "pix", parcelas: "" });
  assert.equal(g.parcelas, "pix");
  assert.equal(g.vencimento, null);
  assert.equal(g.banco, "Nubank");
});

test("Mercado no Pix fica com o banco 'Pix'", () => {
  const g = montarGasto({ ...base, categoria: "Mercado", forma: "pix", parcelas: "avista" });
  assert.equal(g.parcelas, "pix");
  assert.equal(g.banco, "Pix");
});

test("boleto de todo mês é 'mensal', banco 'Boleto' e sem vencimento", () => {
  const g = montarGasto({ ...base, categoria: "Boleto", tipoBoleto: "residencial", forma: "", parcelas: "" });
  assert.deepEqual([g.categoria, g.parcelas, g.banco, g.vencimento], ["Boleto", "mensal", "Boleto", null]);
});

test("boleto parcelado guarda o número de parcelas digitado", () => {
  const g = montarGasto({ ...base, categoria: "Boleto", tipoBoleto: "compras", parcelasBoleto: "36", forma: "", parcelas: "" });
  assert.deepEqual([g.parcelas, g.banco, g.vencimento], ["36", "Boleto", null]);
});

test("boleto parcelado com número inválido devolve erro", () => {
  const r = montarGasto({ ...base, categoria: "Boleto", tipoBoleto: "compras", parcelasBoleto: "0", forma: "", parcelas: "" });
  assert.deepEqual(r, { erro: "parcelas-boleto" });
});

test("assinatura guarda a periodicidade, sem vencimento, ignorando a forma", () => {
  const g = montarGasto({ ...base, categoria: "Assinatura", forma: "pix", parcelas: "trimestral" });
  assert.deepEqual([g.parcelas, g.vencimento, g.banco], ["trimestral", null, "Nubank"]);
});

test("opcoesComAtual acrescenta a quantidade de parcelas que não está na lista", () => {
  const lista = [["pix", "Pix"], ["avista", "Sem parcelas"], ["2", "2x"], ["12", "12x"]];
  assert.deepEqual(opcoesComAtual(lista, "24").slice(-1)[0], ["24", "24x"]);
  assert.equal(opcoesComAtual(lista, "12").length, lista.length);
  assert.equal(opcoesComAtual(lista, "mensal").length, lista.length);
  assert.equal(opcoesComAtual(lista, "").length, lista.length);
});
