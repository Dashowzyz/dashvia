// Temas recomendados + "Personalize do seu jeito" (Configurações > Aparência).
// Para criar um tema novo, é só acrescentar uma linha na lista abaixo.
// "texto" é opcional: sem ele, as letras ficam claras em fundo escuro e escuras em fundo claro.
const TEMAS_RECOMENDADOS = [
  { nome: "Dashvia", tema: {} },
  { nome: "Meia-noite", tema: { fundo: "#060b18", menu: "#0f3a8a", destaque: "#3b82f6" } },
  { nome: "Oceano", tema: { fundo: "#04141a", menu: "#0e7490", destaque: "#22d3ee" } },
  { nome: "Esmeralda", tema: { fundo: "#04110d", menu: "#0b5d44", destaque: "#10b981" } },
  { nome: "Pôr do sol", tema: { fundo: "#140a08", menu: "#9a3412", destaque: "#fb923c" } },
  { nome: "Vinho", tema: { fundo: "#12050a", menu: "#7f1d1d", destaque: "#ef4444" } },
  { nome: "Rosa neon", tema: { fundo: "#12060d", menu: "#9d174d", destaque: "#ec4899" } },
  { nome: "Grafite", tema: { fundo: "#0e0e10", menu: "#2a2a30", destaque: "#a1a1aa" } },
  { nome: "Claro roxo", tema: { fundo: "#f6f4fb", menu: "#3e1785", destaque: "#8b5cf6" } },
  { nome: "Claro verde", tema: { fundo: "#f3faf6", menu: "#14532d", destaque: "#16a34a" } }
];

const listaTemas = document.getElementById("lista-temas");
const botaoMinhasCores = document.getElementById("btn-minhas-cores");
const areaCores = document.getElementById("area-cores");

// Mini-prévia de cada tema: o app em miniatura (menu, cartão e destaque) com as cores do tema
function previaDoTema(t) {
  const c = coresEfetivas(t.tema);
  return '<span class="tema-previa" style="background:' + c.fundo + ";border-color:" + c.borda + '">' +
    '<i class="tema-menu" style="background:' + c.menu + '"></i>' +
    '<i class="tema-cartao-mini" style="background:' + c.painel + ";border-color:" + c.borda + '"></i>' +
    '<i class="tema-linha" style="background:' + c.texto + '"></i>' +
    '<i class="tema-ponto" style="background:' + c.destaque + '"></i>' +
    "</span>";
}

listaTemas.innerHTML = TEMAS_RECOMENDADOS.map(function (t, i) {
  return '<button type="button" class="tema-opcao" data-indice="' + i + '" title="' + t.nome +
    '" aria-label="Tema ' + t.nome + '" aria-pressed="false">' + previaDoTema(t) +
    '<span class="tema-nome">' + t.nome + "</span></button>";
}).join("");
const botaoTemas = document.getElementById("btn-temas");
const areaTemas = document.getElementById("area-temas");
const valorTema = document.getElementById("valor-tema");

function mesmoTema(a, b) {
  const ca = limparTema(a);
  const cb = limparTema(b);
  const chaves = Object.keys(ca);
  return chaves.length === Object.keys(cb).length && chaves.every(function (k) { return ca[k] === cb[k]; });
}

// Marca o tema que está valendo agora (se for um dos recomendados)
let decidiuAreaCores = false;
function marcarTemaAtivo() {
  let algumAtivo = false;
  let nomeAtivo = "";
  listaTemas.querySelectorAll(".tema-opcao").forEach(function (botao) {
    const ativo = mesmoTema(TEMAS_RECOMENDADOS[botao.dataset.indice].tema, tema);
    botao.classList.toggle("ativo", ativo);
    botao.setAttribute("aria-pressed", String(ativo));
    if (ativo) {
      algumAtivo = true;
      nomeAtivo = TEMAS_RECOMENDADOS[botao.dataset.indice].nome;
    }
  });
  valorTema.textContent = algumAtivo ? nomeAtivo : "Personalizado";

  // Se a pessoa já tem cores próprias, deixa a área de personalização aberta
  if (!decidiuAreaCores) {
    decidiuAreaCores = true;
    if (!algumAtivo && Object.keys(tema).length) abrirAreaCores(true);
  }
}

function abrirAreaCores(abrir) {
  areaCores.classList.toggle("oculto", !abrir);
  botaoMinhasCores.classList.toggle("aberta", abrir);
  botaoMinhasCores.setAttribute("aria-expanded", String(abrir));
}

botaoTemas.addEventListener("click", function () {
  const abrir = areaTemas.classList.contains("oculto");
  areaTemas.classList.toggle("oculto", !abrir);
  botaoTemas.classList.toggle("aberta", abrir);
  botaoTemas.setAttribute("aria-expanded", String(abrir));
});

botaoMinhasCores.addEventListener("click", function () {
  decidiuAreaCores = true;
  abrirAreaCores(areaCores.classList.contains("oculto"));
});

listaTemas.addEventListener("click", async function (evento) {
  const botao = evento.target.closest(".tema-opcao");
  if (!botao) return;

  const escolhido = TEMAS_RECOMENDADOS[botao.dataset.indice];
  const novo = limparTema(escolhido.tema);

  const resultado = validarTema(novo);
  if (!resultado.ok) {
    mostrarAviso(resultado.motivo, "erro");
    return;
  }

  tema = novo;
  aplicarTema(tema);
  mostrarCores();
  mostrarAviso("Tema " + escolhido.nome + " aplicado!", "ok");
  await salvarTema();
});

// Sempre que as cores forem atualizadas na tela, a seleção dos temas acompanha
const mostrarCoresOriginal = mostrarCores;
mostrarCores = function () {
  mostrarCoresOriginal();
  marcarTemaAtivo();
};
marcarTemaAtivo();
