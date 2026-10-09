import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gerarCopia } from "../gerar-parcelamento.mjs";

const original = readFileSync(new URL("../../js/parcelamento.js", import.meta.url), "utf8");
const copiaPath = new URL("../../supabase/functions/avisos-push/parcelamento.mjs", import.meta.url);

test("gerarCopia mantém o original inteiro e exporta os 6 nomes", () => {
  const copia = gerarCopia(original);
  assert.ok(copia.includes(original));
  const exportacao = copia.slice(copia.lastIndexOf("export {"));
  for (const nome of ["somarMeses", "ehParcelado", "ehBoletoRecorrente", "boletoDoMes", "parcelaMarcadaPaga", "listarParcelas"]) {
    assert.ok(exportacao.includes(nome), nome);
  }
});

test("o arquivo gerado commitado é igual ao que o gerador produz", () => {
  assert.equal(readFileSync(copiaPath, "utf8"), gerarCopia(original));
});

test("a cópia funciona: parcela 2 de vencimento 31 cai em 28/02/2026", async () => {
  const { listarParcelas } = await import(copiaPath.href);
  const parcelas = listarParcelas({ parcelas: "2", data: "2026-01-31", vencimento: 31, valor: 100 });
  assert.equal(parcelas[1].data.getDate(), 28);
  assert.equal(parcelas[1].data.getMonth(), 1);
});
