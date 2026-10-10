import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// js/seletor-cor.js é um script de navegador (sem export): carregamos o texto como o site faz
const fonte = readFileSync(new URL("../../js/seletor-cor.js", import.meta.url), "utf8");
const { hsvParaHex, hexParaHsv, normalizarHex } = new Function(fonte + "\nreturn { hsvParaHex, hexParaHsv, normalizarHex };")();

test("hsvParaHex converte as cores básicas", () => {
  assert.equal(hsvParaHex(0, 1, 1), "#ff0000");
  assert.equal(hsvParaHex(120, 1, 1), "#00ff00");
  assert.equal(hsvParaHex(240, 1, 1), "#0000ff");
  assert.equal(hsvParaHex(60, 1, 1), "#ffff00");
});

test("hsvParaHex: branco, preto e cinza", () => {
  assert.equal(hsvParaHex(0, 0, 1), "#ffffff");
  assert.equal(hsvParaHex(200, 1, 0), "#000000");
  assert.equal(hsvParaHex(123, 0, 0.5), "#808080");
});

test("hsvParaHex aceita matiz fora de 0-360 e limita saturação e valor", () => {
  assert.equal(hsvParaHex(360, 1, 1), "#ff0000");
  assert.equal(hsvParaHex(480, 1, 1), "#00ff00");
  assert.equal(hsvParaHex(0, 2, 5), "#ff0000");
  assert.equal(hsvParaHex(0, -1, -1), "#000000");
});

test("hexParaHsv converte e devolve null para texto inválido", () => {
  assert.deepEqual(hexParaHsv("#ff0000"), { h: 0, s: 1, v: 1 });
  assert.deepEqual(hexParaHsv("#ffffff"), { h: 0, s: 0, v: 1 });
  assert.deepEqual(hexParaHsv("#000000"), { h: 0, s: 0, v: 0 });
  const verde = hexParaHsv("#00ff00");
  assert.equal(Math.round(verde.h), 120);
  assert.equal(hexParaHsv("azul"), null);
  assert.equal(hexParaHsv("#12"), null);
  assert.equal(hexParaHsv(""), null);
});

test("ida e volta não perde a cor (diferença de no máximo 1 por canal)", () => {
  const exemplos = ["#7a4be0", "#07050f", "#f2f0f8", "#123456", "#fedcba", "#808080", "#ff00ff", "#0d0c2c"];
  for (const hex of exemplos) {
    const { h, s, v } = hexParaHsv(hex);
    const volta = hsvParaHex(h, s, v);
    for (let i = 1; i <= 5; i += 2) {
      assert.ok(Math.abs(parseInt(hex.slice(i, i + 2), 16) - parseInt(volta.slice(i, i + 2), 16)) <= 1, hex + " -> " + volta);
    }
  }
});

test("normalizarHex aceita com ou sem #, 3 ou 6 dígitos, maiúsculas e espaços", () => {
  assert.equal(normalizarHex("7A4BE0"), "#7a4be0");
  assert.equal(normalizarHex("  #7A4BE0 "), "#7a4be0");
  assert.equal(normalizarHex("#abc"), "#aabbcc");
  assert.equal(normalizarHex("F00"), "#ff0000");
  assert.equal(normalizarHex("#12345"), null);
  assert.equal(normalizarHex("#gggggg"), null);
  assert.equal(normalizarHex(null), null);
});
