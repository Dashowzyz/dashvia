// Bancos do Dashvia e o ícone de cada um.
// Para incluir um banco novo, é só acrescentar uma linha na lista abaixo.
// Os ícones são "selinhos" com a logo do banco (img/bancos/<logo>.svg) ou, sem logo, a sigla e as cores dele.

const BANCOS = [
  { nome: "Nubank", logo: "nubank", sigla: "Nu", cor: "#820ad1", texto: "#ffffff" },
  { nome: "Itaú", logo: "itau", sigla: "it", cor: "#ec7000", texto: "#ffffff" },
  { nome: "Bradesco", logo: "bradesco", sigla: "B", cor: "#cc092f", texto: "#ffffff" },
  { nome: "Santander", logo: "santander", sigla: "S", cor: "#ec0000", texto: "#ffffff" },
  { nome: "Banco do Brasil", logo: "banco-do-brasil", sigla: "BB", cor: "#fcf800", texto: "#0038a8" },
  { nome: "Caixa", logo: "caixa", sigla: "C", cor: "#005ca9", texto: "#ffffff" },
  { nome: "Inter", logo: "inter", sigla: "in", cor: "#ff7a00", texto: "#ffffff" },
  { nome: "C6 Bank", logo: "c6-bank", sigla: "C6", cor: "#242424", texto: "#ffffff" },
  { nome: "BTG Pactual", logo: "btg-pactual", sigla: "BTG", cor: "#001e62", texto: "#ffffff" },
  { nome: "Mercado Pago", logo: "mercado-pago", sigla: "MP", cor: "#00a1e4", texto: "#ffffff" },
  { nome: "PicPay", logo: "picpay", sigla: "Pic", cor: "#11c76f", texto: "#ffffff" },
  { nome: "PagBank", logo: "pagbank", sigla: "PB", cor: "#3fae2a", texto: "#ffffff" },
  { nome: "Neon", logo: "neon", sigla: "Ne", cor: "#00e5ff", texto: "#003b44" },
  { nome: "Next", sigla: "N", cor: "#00ff5f", texto: "#003b1a" },
  { nome: "Original", sigla: "Or", cor: "#1d9a45", texto: "#ffffff" },
  { nome: "Safra", logo: "safra", sigla: "Sa", cor: "#002b5c", texto: "#ffffff" },
  { nome: "Banrisul", logo: "banrisul", sigla: "Ba", cor: "#0057a8", texto: "#ffffff" },
  { nome: "Sicoob", logo: "sicoob", sigla: "Si", cor: "#003641", texto: "#ffffff" },
  { nome: "Sicredi", logo: "sicredi", sigla: "Sc", cor: "#3fa535", texto: "#ffffff" },
  { nome: "XP", logo: "xp", sigla: "XP", cor: "#101010", texto: "#ffd400" },
  { nome: "Agibank", logo: "agibank", sigla: "Ag", cor: "#00a859", texto: "#ffffff" },
  { nome: "Pan", logo: "pan", sigla: "Pn", cor: "#0079c1", texto: "#ffffff" },
  { nome: "Digio", logo: "digio", sigla: "Di", cor: "#0b3a8c", texto: "#ffffff" },
  { nome: "BRB", logo: "brb", sigla: "BRB", cor: "#0b4ea2", texto: "#ffffff" },
  { nome: "Outro", sigla: "", cor: "#6b6785", texto: "#ffffff" }
];

// Formas de pagamento que não são banco, mas aparecem junto (ex.: no Resumo do Dashboard)
const ICONE_BOLETO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="4" y1="5" y2="19"/><line x1="8" x2="8" y1="5" y2="19"/><line x1="12" x2="12" y1="5" y2="19"/><line x1="16" x2="16" y1="5" y2="19"/><line x1="20" x2="20" y1="5" y2="19"/></svg>';

const OUTROS_ICONES = [
  { nome: "Pix", sigla: "Px", cor: "#32bcad", texto: "#ffffff" },
  { nome: "Boleto", sigla: ICONE_BOLETO, cor: "#4b5563", texto: "#ffffff" }
];

const ICONE_OUTRO_BANCO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>';

// Devolve o HTML do selinho. Banco que não está na lista usa o ícone de "Outro".
function iconeBanco(nome) {
  const banco = BANCOS.concat(OUTROS_ICONES).find(function (b) { return b.nome === nome; }) || BANCOS[BANCOS.length - 1];
  if (banco.logo) {
    return '<span class="banco-icone banco-logo" aria-hidden="true"><img src="img/bancos/' + banco.logo + '.svg" alt="" decoding="async"></span>';
  }
  return '<span class="banco-icone" aria-hidden="true" style="background:' + banco.cor + ";color:" + banco.texto + '">' +
    (banco.sigla || ICONE_OUTRO_BANCO) + "</span>";
}