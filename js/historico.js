// Histórico do espaço compartilhado: quem adicionou, editou, pagou ou apagou gastos (últimos 30 dias)
const area = document.getElementById("area-historico");
const resumo = document.getElementById("resumo-historico");

const ICONES_ACAO = {
  adicionou: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  editou: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  apagou: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  pagamento: '<polyline points="20 6 9 17 4 12"/>'
};

const VERBOS = { adicionou: "adicionou", editou: "editou", apagou: "apagou", pagamento: "registrou pagamento em" };

function criar(tag, classe, texto) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

function moeda(numero) {
  return Number(numero).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function mostrarAviso(texto, linkTexto, linkEndereco) {
  area.textContent = "";
  const caixa = criar("div", "bloco esp-vazio");
  caixa.append(criar("p", "", texto));
  if (linkTexto) {
    const link = criar("a", "atalho-espaco", linkTexto);
    link.href = linkEndereco;
    caixa.append(link);
  }
  area.append(caixa);
}

async function iniciar() {
  const usuario = await exigirLogin();
  if (!usuario) return;

  esquecerEspaco();
  const espaco = await meuEspaco();
  if (!espaco) {
    mostrarAviso("Você não está em nenhum espaço compartilhado.", "Criar ou entrar em um espaço", "espaco.html");
    return;
  }

  resumo.textContent = espaco.nome + " · últimos 30 dias";

  let linhas;
  try {
    linhas = await buscarHistoricoDoEspaco();
  } catch (falha) {
    console.error(falha);
    mostrarAviso("Não foi possível carregar o histórico. Atualize a página.");
    return;
  }

  area.textContent = "";
  area.append(criar("p", "esp-sub", "Depois de 30 dias, o registro é apagado sozinho."));

  if (linhas.length === 0) {
    mostrarAviso("Nada aconteceu nos gastos do espaço ainda. Quando alguém adicionar, editar, pagar ou apagar um gasto, aparece aqui.");
    return;
  }

  const lista = criar("ul", "bloco esp-historico");
  linhas.forEach(function (h) {
    const li = criar("li", "esp-hist-item " + h.acao);

    const icone = criar("span", "esp-hist-icone");
    icone.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONES_ACAO[h.acao] || ICONES_ACAO.editou) + "</svg>";
    li.append(icone);

    const texto = criar("div", "esp-hist-texto");
    const frase = criar("p");
    frase.append(
      criar("strong", "", h.nome_pessoa || "Alguém"),
      document.createTextNode(" " + (VERBOS[h.acao] || h.acao) + " "),
      criar("strong", "", h.plataforma || "um gasto")
    );
    texto.append(frase);
    texto.append(criar("small", "", [h.categoria, h.valor != null ? moeda(h.valor) : "", tempoDecorrido(h.quando)].filter(Boolean).join(" · ")));
    li.append(texto);
    lista.append(li);
  });
  area.append(lista);
}

iniciar();