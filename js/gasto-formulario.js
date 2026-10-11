// Regras do formulário de gasto que não dependem da tela (usadas em Adicionar e na edição).
// Ficam separadas para poderem ser testadas (ferramentas/testes/gasto-formulario.test.mjs).

const PARCELAS_MAXIMO = 60;

// Número de parcelas digitado pela pessoa: inteiro de 1 a 60, ou null se não servir
function parcelasDigitadas(texto) {
  const t = String(texto === null || texto === undefined ? "" : texto).trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 && n <= PARCELAS_MAXIMO ? n : null;
}

// Monta o gasto que vai para o banco a partir do que foi escolhido no formulário.
// e = { categoria, forma, parcelas, tipoBoleto, parcelasBoleto, plataforma, data, valor, vencimento, banco }
// Devolve o gasto, ou { erro: "parcelas-boleto" } se o boleto parcelado tiver um número inválido.
function montarGasto(e) {
  const boleto = e.categoria === "Boleto";
  const comprasBoleto = boleto && e.tipoBoleto === "compras";
  const assinatura = e.categoria === "Assinatura";
  const pix = !assinatura && !boleto && e.forma === "pix";

  let parcelas;
  if (boleto) {
    if (comprasBoleto) {
      const n = parcelasDigitadas(e.parcelasBoleto);
      if (n === null) return { erro: "parcelas-boleto" };
      parcelas = String(n);
    } else {
      parcelas = "mensal";
    }
  } else {
    parcelas = pix ? "pix" : e.parcelas;
  }

  const semVencimento = boleto || assinatura || parcelas === "pix" || parcelas === "avista";

  return {
    plataforma: String(e.plataforma || "").trim(),
    categoria: e.categoria,
    parcelas: parcelas,
    data: e.data,
    valor: parseFloat(e.valor),
    vencimento: semVencimento ? null : Number(e.vencimento),
    // boleto não tem banco; mercado pago no Pix fica como "Pix"
    banco: boleto ? "Boleto" : (e.categoria === "Mercado" && pix) ? "Pix" : e.banco
  };
}

// Lista de opções de parcelas [valor, texto] com a quantidade atual incluída se ela não estiver na lista
// (ex.: uma compra em 24x precisa aparecer como "24x" ao editar, senão viraria outra opção)
function opcoesComAtual(lista, atual) {
  const valor = String(atual === null || atual === undefined ? "" : atual);
  if (!/^\d+$/.test(valor)) return lista;
  const existe = lista.some(function (item) { return String(item[0]) === valor; });
  return existe ? lista : lista.concat([[valor, valor + "x"]]);
}
