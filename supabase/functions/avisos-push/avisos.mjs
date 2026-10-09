// Cálculo dos avisos de vencimento (boletos e parcelas de cartão) e texto da notificação.
// A regra de datas vem de parcelamento.mjs, cópia gerada de js/parcelamento.js (ferramentas/gerar-parcelamento.mjs).
import { ehParcelado, ehBoletoRecorrente, boletoDoMes, listarParcelas, parcelaMarcadaPaga } from "./parcelamento.mjs";

const MOMENTOS = [7, 3, 0];

// Gasto do jeito que o site usa (camelCase), a partir de uma linha da tabela gastos
export function gastoDoBanco(linha) {
  return {
    id: linha.id,
    plataforma: linha.plataforma,
    categoria: linha.categoria,
    parcelas: linha.parcelas,
    data: linha.data,
    valor: Number(linha.valor),
    vencimento: linha.vencimento ?? null,
    canceladoEm: linha.cancelado_em ?? null,
    pagasAte: linha.pagas_ate || 0,
    pagasFim: linha.pagas_fim || 0,
    espacoId: linha.espaco_id ?? null
  };
}

// Meia-noite do dia civil de Brasília, montada como as datas de parcelamento.mjs (new Date(ano, mes, dia))
export function hojeEmBrasilia(agora) {
  const texto = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
  const [ano, mes, dia] = texto.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

// A próxima cobrança que ainda não foi paga e não venceu (mesma regra do sino em js/menu.js)
function proximaCobranca(g, hoje) {
  if (ehBoletoRecorrente(g)) {
    const indice = hoje.getFullYear() * 12 + hoje.getMonth();
    for (let k = 0; k <= 1; k++) {
      const o = boletoDoMes(g, Math.floor((indice + k) / 12), (indice + k) % 12);
      if (o && !o.paga && o.data >= hoje) return o;
    }
    return null;
  }
  return listarParcelas(g).find((p) => !parcelaMarcadaPaga(g, p.numero) && p.data >= hoje) || null;
}

function tipoDoAviso(g) {
  if (g.categoria === "Boleto") return ehParcelado(g) || ehBoletoRecorrente(g) ? "Boleto" : null;
  return ehParcelado(g) ? "Parcela" : null;
}

export function calcularAvisos(gastos, hoje) {
  const avisos = [];
  for (const g of gastos) {
    const tipo = tipoDoAviso(g);
    if (!tipo) continue;
    const proxima = proximaCobranca(g, hoje);
    if (!proxima) continue;
    const dias = Math.round((proxima.data - hoje) / 86400000);
    if (!MOMENTOS.includes(dias)) continue;
    avisos.push({
      chave: g.id + ":" + proxima.numero + ":" + dias,
      dias,
      tipo,
      plataforma: g.plataforma,
      valor: proxima.valor,
      data: proxima.data,
      numero: proxima.numero,
      total: ehBoletoRecorrente(g) ? 0 : Number(g.parcelas)
    });
  }
  return avisos.sort((a, b) => a.dias - b.dias || a.plataforma.localeCompare(b.plataforma, "pt-BR"));
}

// ---------- Texto da notificação ----------

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function quando(dias) {
  return dias === 0 ? "vence hoje" : "vence em " + dias + " dias";
}

function detalhe(a) {
  const data = a.data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const parcela = a.total === 0 ? " · todo mês" : a.total > 1 ? " · parcela " + a.numero + "/" + a.total : "";
  return data + " · " + moeda.format(a.valor).replace(/ /g, " ") + parcela;
}

// No máximo uma notificação de vencimento por pessoa por dia: um item mostra o detalhe, vários viram resumo
export function montarNotificacao(avisos) {
  if (avisos.length === 0) return null;
  if (avisos.length === 1) {
    const a = avisos[0];
    return { titulo: a.tipo + " " + a.plataforma + " " + quando(a.dias), corpo: detalhe(a), url: "parcelas.html", tag: "vencimentos" };
  }
  const nomes = avisos.slice(0, 3).map((a) => a.plataforma).join(", ") + (avisos.length > 3 ? "…" : "");
  return { titulo: avisos.length + " vencimentos esta semana", corpo: nomes, url: "parcelas.html", tag: "vencimentos" };
}
