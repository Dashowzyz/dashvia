// Gera a cópia de js/parcelamento.js usada pela função de avisos (supabase/functions/avisos-push).
// A regra de datas fica só em js/parcelamento.js; rode este arquivo de novo sempre que ele mudar.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const NOMES = ["somarMeses", "ehParcelado", "ehBoletoRecorrente", "boletoDoMes", "parcelaMarcadaPaga", "listarParcelas"];
const ORIGINAL = new URL("../js/parcelamento.js", import.meta.url);
export const DESTINO = new URL("../supabase/functions/avisos-push/parcelamento.mjs", import.meta.url);

export function gerarCopia(textoOriginal) {
  const cabecalho = "// GERADO por ferramentas/gerar-parcelamento.mjs a partir de js/parcelamento.js. NÃO edite à mão.\n";
  const rodape = "\n\nexport { " + NOMES.join(", ") + " };\n";
  return cabecalho + textoOriginal + rodape;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(DESTINO, gerarCopia(readFileSync(ORIGINAL, "utf8")));
  console.log("Cópia gerada em supabase/functions/avisos-push/parcelamento.mjs");
}
