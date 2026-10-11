import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// js/categorias.js é um script de navegador (sem export): carregamos o texto como o site faz
const fonte = readFileSync(new URL("../../js/categorias.js", import.meta.url), "utf8");
const { ehCategoriaPadrao, variantesDaCategoria } = new Function(fonte + "\nreturn { ehCategoriaPadrao, variantesDaCategoria };")();

test("as categorias padrão não podem ser removidas (sem ligar para maiúscula ou acento)", () => {
  for (const nome of ["Alimentação", "alimentacao", "COMPRAS", "Transportes", "Assinatura", "Boleto", "Outros", " outros "]) {
    assert.equal(ehCategoriaPadrao(nome), true, nome);
  }
});

test("categorias criadas pela pessoa podem", () => {
  for (const nome of ["Academia", "Pet", "Casa"]) assert.equal(ehCategoriaPadrao(nome), false, nome);
});

test("variantesDaCategoria acha todos os jeitos de escrever o mesmo nome nos gastos", () => {
  const usadas = ["Academia", "academia", "ACADÊMIA", "Pet", "Alimentação", "Academia "];
  assert.deepEqual(variantesDaCategoria("Academia", usadas), ["Academia", "academia", "ACADÊMIA", "Academia "]);
  assert.deepEqual(variantesDaCategoria("pet", usadas), ["Pet"]);
  assert.deepEqual(variantesDaCategoria("Viagem", usadas), []);
});
