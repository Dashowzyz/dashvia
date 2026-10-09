// GERADO por ferramentas/gerar-parcelamento.mjs a partir de js/parcelamento.js. NÃO edite à mão.
// Parcelas das compras parceladas. Usado em Parcelas futuras e no Dashboard.
// As regras de divisão e vencimento ficam só aqui, para as duas páginas sempre concordarem.

// Soma meses a uma data; se o dia não existir no mês (ex.: 31 em fevereiro), usa o último dia
function somarMeses(ano, mes, dia, quantidade) {
  const total = ano * 12 + mes + quantidade;
  const novoAno = Math.floor(total / 12);
  const novoMes = total % 12;
  const ultimoDia = new Date(novoAno, novoMes + 1, 0).getDate();
  return new Date(novoAno, novoMes, Math.min(dia, ultimoDia));
}

// Compra parcelada = parcelas em número, de 2 em diante (Pix, "sem parcelas" e assinaturas ficam de fora).
// Boleto entra mesmo com 1 parcela só (boleto residencial), porque ele vence em uma data e aparece em Parcelas futuras.
function ehParcelado(g) {
  if (!/^\d+$/.test(g.parcelas)) return false;
  return Number(g.parcelas) >= 2 || (g.categoria === "Boleto" && Number(g.parcelas) >= 1);
}

// Boleto residencial: se repete todo mês, para sempre (como uma assinatura). "pagasAte" guarda o número da última cobrança paga.
function ehBoletoRecorrente(g) {
  return g.categoria === "Boleto" && g.parcelas === "mensal";
}

// A cobrança do boleto recorrente em um mês (mes de 0 a 11). numero 1 = mês do primeiro vencimento; antes disso não há cobrança.
function boletoDoMes(g, ano, mes) {
  const [a, m, d] = g.data.split("-").map(Number);
  const numero = (ano * 12 + mes) - (a * 12 + (m - 1)) + 1;
  if (numero < 1) return null;

  // Boleto encerrado: "canceladoEm" é o primeiro mês que já não cobra
  if (g.canceladoEm) {
    const [ca, cm] = g.canceladoEm.split("-").map(Number);
    if (ano * 12 + mes >= ca * 12 + (cm - 1)) return null;
  }

  // O dia do vencimento é o que a pessoa editou (vencimento) ou, se nunca editou, o dia da data do boleto
  return { numero: numero, data: somarMeses(ano, mes, g.vencimento || d, 0), valor: g.valor, paga: numero <= (g.pagasAte || 0) };
}

// A cobrança que a pessoa acompanha agora: a do mês atual (ou a primeira, se o boleto só começa depois)
function boletoAtual(g, hoje) {
  const [a, m] = g.data.split("-").map(Number);
  const alvo = Math.max(a * 12 + (m - 1), hoje.getFullYear() * 12 + hoje.getMonth());
  return boletoDoMes(g, Math.floor(alvo / 12), alvo % 12);
}

// Diz se a pessoa já marcou a parcela como paga: do começo (pagasAte) ou do fim (pagasFim, "de trás pra frente")
function parcelaMarcadaPaga(g, numero) {
  const total = Number(g.parcelas);
  return numero <= Math.min(g.pagasAte || 0, total) || numero > total - (g.pagasFim || 0);
}

// Monta todas as parcelas de uma compra.
// Regras usadas (se quiser mudar, é só aqui):
// - o valor digitado é o TOTAL da compra, dividido em partes iguais (a última leva os centavos que sobrarem);
// - cada parcela vence no "dia do vencimento";
// - se a compra foi feita até esse dia, a 1ª parcela cai no mesmo mês; depois dele, no mês seguinte.
function listarParcelas(g) {
  const quantidade = Number(g.parcelas);
  const [ano, mes, dia] = g.data.split("-").map(Number);
  const vencimento = g.vencimento || dia;
  const primeiroMes = dia <= vencimento ? 0 : 1;

  const totalCentavos = Math.round(g.valor * 100);
  const baseCentavos = Math.floor(totalCentavos / quantidade);

  const parcelas = [];
  for (let i = 0; i < quantidade; i++) {
    const centavos = i === quantidade - 1 ? totalCentavos - baseCentavos * (quantidade - 1) : baseCentavos;
    parcelas.push({
      numero: i + 1,
      data: somarMeses(ano, mes - 1, vencimento, primeiroMes + i),
      valor: centavos / 100
    });
  }
  return parcelas;
}

// De quantos em quantos meses cada periodicidade de assinatura se repete
const passoAssinatura = { mensal: 1, trimestral: 3, anual: 12 };

// Diz se o gasto cai em determinado mês (mes: 0 a 11).
// Gasto comum cai só no mês da compra; assinatura se repete até ser cancelada.
function cobraNoMes(g, ano, mes) {
  const [anoCompra, mesCompra] = g.data.split("-").map(Number);
  const inicio = anoCompra * 12 + (mesCompra - 1);
  const alvo = ano * 12 + mes;

  // Assinatura e boleto residencial se repetem; o resto cai só no mês da compra
  const passo = ehBoletoRecorrente(g) ? 1 : (g.categoria === "Assinatura" ? passoAssinatura[g.parcelas] : 0);
  if (!passo) {
    return alvo === inicio;
  }

  if (alvo < inicio) return false;

  // Quando existir o cancelamento (canceladoEm: "AAAA-MM-DD"), para de contar a partir daquele mês
  if (g.canceladoEm) {
    const [anoCancel, mesCancel] = g.canceladoEm.split("-").map(Number);
    if (alvo >= anoCancel * 12 + (mesCancel - 1)) return false;
  }

  return (alvo - inicio) % passo === 0;
}

// Quanto o gasto pesa no mês indicado (mes: 0 a 11). Retorna 0 se ele não cai naquele mês.
// - Compra parcelada: cada parcela conta no mês em que vence (veja parcelamento.js).
// - Parcela que a pessoa já pagou adiantada, em um mês que ainda não chegou, deixa de contar lá.
// - Os outros gastos (Pix, sem parcelas e assinaturas) seguem a regra de cobraNoMes.
function valorNoMes(g, ano, mes) {
  if (!ehParcelado(g)) return cobraNoMes(g, ano, mes) ? g.valor : 0;

  const alvo = ano * 12 + mes;
  const agora = new Date();
  const atual = agora.getFullYear() * 12 + agora.getMonth();

  return listarParcelas(g).reduce(function (soma, p) {
    if (p.data.getFullYear() * 12 + p.data.getMonth() !== alvo) return soma;
    if (parcelaMarcadaPaga(g, p.numero) && alvo > atual) return soma;
    return soma + p.valor;
  }, 0);
}


export { somarMeses, ehParcelado, ehBoletoRecorrente, boletoDoMes, parcelaMarcadaPaga, listarParcelas };
