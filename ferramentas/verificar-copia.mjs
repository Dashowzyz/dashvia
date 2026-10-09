// Falha (código 1) se a cópia usada pela função de avisos não for igual ao que js/parcelamento.js gera.
import { readFileSync } from "node:fs";
import { gerarCopia, DESTINO } from "./gerar-parcelamento.mjs";

const esperado = gerarCopia(readFileSync(new URL("../js/parcelamento.js", import.meta.url), "utf8"));
let atual = "";
try {
  atual = readFileSync(DESTINO, "utf8");
} catch (falha) {
  // arquivo ainda não existe
}

if (atual !== esperado) {
  console.error("A cópia da função de avisos está diferente de js/parcelamento.js. Rode: node ferramentas/gerar-parcelamento.mjs");
  process.exit(1);
}
console.log("Cópia em dia.");
