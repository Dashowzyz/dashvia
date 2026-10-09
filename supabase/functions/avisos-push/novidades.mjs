// Lê a novidade mais recente do js/novidades.js publicado (sem executar o arquivo) e monta a notificação.

// um texto entre aspas, aceitando \" e outros escapes dentro dele
const TEXTO = '"((?:[^"\\\\]|\\\\.)*)"';

function desfazerEscapes(texto) {
  return texto.replace(/\\(.)/g, "$1");
}

function campo(bloco, nome) {
  const achou = bloco.match(new RegExp("\\b" + nome + "\\s*:\\s*" + TEXTO));
  return achou ? desfazerEscapes(achou[1]) : null;
}

// A primeira entrada da lista NOVIDADES é a mais nova
export function lerNovidadeMaisRecente(textoJs) {
  const inicio = textoJs.search(/const\s+NOVIDADES\s*=\s*\[/);
  if (inicio === -1) return null;
  const lista = textoJs.slice(inicio);
  const abre = lista.indexOf("{");
  if (abre === -1) return null;

  // a primeira entrada vai até o começo da segunda (ou até o fim)
  const resto = lista.slice(abre + 1);
  const proxima = resto.search(/\}\s*,\s*\{/);
  const bloco = proxima === -1 ? resto : resto.slice(0, proxima);

  const versao = campo(bloco, "versao");
  const data = campo(bloco, "data");
  const resumo = campo(bloco, "resumo");
  if (versao === null || data === null || resumo === null) return null;
  return { id: data + "|" + versao, versao, data, resumo };
}

export function montarNotificacaoNovidade(n) {
  return { titulo: "Novidade no Dashvia", corpo: n.versao + ": " + n.resumo, url: "dashboard.html?novidades=1", tag: "novidades" };
}
