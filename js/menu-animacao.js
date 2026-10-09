// Animação do menu ao trocar de página.
// Cada página é um carregamento novo, então o menu "pula". Aqui o destaque desliza da posição antiga
// para a nova e os outros ícones acompanham. Funciona no menu de baixo (celular) e no lateral (computador).
// Depende de menu.js, que marca o link da página atual com a classe "ativo".
(function () {
  const nav = document.querySelector(".menu nav");
  if (!nav) return;
  const links = Array.prototype.slice.call(nav.querySelectorAll("a"));
  const ativo = nav.querySelector("a.ativo");
  const CHAVE = "dashvia:menu-de";
  const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function medir() {
    return links.map(function (a) {
      return { href: a.getAttribute("href"), x: a.offsetLeft, y: a.offsetTop, w: a.offsetWidth, h: a.offsetHeight, ativo: a.classList.contains("ativo") };
    });
  }

  // Ao clicar, guarda onde cada item está agora; a próxima página anima a partir daí
  links.forEach(function (link) {
    link.addEventListener("click", function (e) {
      if (reduzido || e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      try {
        sessionStorage.setItem(CHAVE, JSON.stringify({ quando: Date.now(), itens: medir() }));
      } catch (falha) {
        // sem armazenamento: o menu só não anima
      }
    });
  });

  if (!ativo) return;

  // O destaque vira um elemento próprio, para poder se mover de um ícone ao outro
  const pilula = document.createElement("span");
  pilula.className = "menu-pilula";
  pilula.setAttribute("aria-hidden", "true");
  nav.insertBefore(pilula, nav.firstChild);
  nav.classList.add("com-pilula");

  function posicionar() {
    pilula.style.left = ativo.offsetLeft + "px";
    pilula.style.top = ativo.offsetTop + "px";
    pilula.style.width = ativo.offsetWidth + "px";
    pilula.style.height = ativo.offsetHeight + "px";
  }
  posicionar();
  window.addEventListener("resize", posicionar);

  let antes = null;
  try {
    antes = JSON.parse(sessionStorage.getItem(CHAVE));
    sessionStorage.removeItem(CHAVE);
  } catch (falha) {
    antes = null;
  }
  if (reduzido || !antes || Date.now() - antes.quando > 5000 || !antes.itens || antes.itens.length !== links.length) return;

  const curva = "cubic-bezier(0.22, 1, 0.36, 1)";
  const duracao = 380;

  // o destaque sai de onde estava o item ativo da página anterior
  const antigo = antes.itens.filter(function (i) { return i.ativo; })[0];
  if (antigo) {
    pilula.animate(
      [
        { transform: "translate(" + (antigo.x - ativo.offsetLeft) + "px, " + (antigo.y - ativo.offsetTop) + "px)", width: antigo.w + "px", height: antigo.h + "px" },
        { transform: "translate(0, 0)", width: ativo.offsetWidth + "px", height: ativo.offsetHeight + "px" }
      ],
      { duration: duracao, easing: curva }
    );
  }

  // os ícones que mudaram de lugar (porque o nome do ativo aparece e some) deslizam até o novo
  links.forEach(function (link, i) {
    const dx = antes.itens[i].x - link.offsetLeft;
    const dy = antes.itens[i].y - link.offsetTop;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    link.animate(
      [{ transform: "translate(" + dx + "px, " + dy + "px)" }, { transform: "translate(0, 0)" }],
      { duration: duracao, easing: curva }
    );
  });
})();
