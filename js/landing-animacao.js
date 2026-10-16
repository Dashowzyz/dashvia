// Página inicial: animações que acompanham a rolagem.
// - O celular da abertura começa inclinado e se endireita conforme a pessoa rola (no computador, também segue o mouse).
// - Em "Por dentro do app", o celular fica parado e a tela dele muda a cada passo.
// - Os blocos aparecem suavemente quando entram na tela.
// Quem pediu menos movimento no aparelho vê tudo parado (o CSS só esconde os blocos quando a classe "anima" existe).
(function () {
  const raiz = document.documentElement;
  const poucoMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!poucoMovimento) raiz.classList.add("anima");

  function limitar(valor, minimo, maximo) {
    return Math.min(Math.max(valor, minimo), maximo);
  }

  function iniciar() {
    const progresso = document.querySelector(".topo-progresso");
    const hero = document.querySelector(".hero");
    const palcoHero = document.querySelector(".hero-palco");

    // ---------- Rolagem: barra de progresso e celular da abertura ----------
    let esperando = false;

    function aoRolar() {
      esperando = false;
      const rolado = window.scrollY;
      const total = document.documentElement.scrollHeight - window.innerHeight;

      if (progresso) progresso.style.transform = "scaleX(" + (total > 0 ? rolado / total : 0) + ")";

      // 0 = topo da página, 1 = abertura já saiu da tela
      if (hero && !poucoMovimento) {
        hero.style.setProperty("--rolagem", limitar(rolado / (hero.offsetHeight * 0.8), 0, 1).toFixed(3));
      }
    }

    window.addEventListener("scroll", function () {
      if (esperando) return;
      esperando = true;
      requestAnimationFrame(aoRolar);
    }, { passive: true });
    window.addEventListener("resize", aoRolar);
    aoRolar();

    // Já mostra a abertura (com uma pequena entrada em sequência)
    requestAnimationFrame(function () { raiz.classList.add("pronto"); });

    // ---------- Mouse: o celular da abertura inclina na direção do ponteiro ----------
    if (palcoHero && !poucoMovimento && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      palcoHero.addEventListener("pointermove", function (e) {
        const caixa = palcoHero.getBoundingClientRect();
        const x = (e.clientX - caixa.left) / caixa.width - 0.5;
        const y = (e.clientY - caixa.top) / caixa.height - 0.5;
        palcoHero.style.setProperty("--mouse-x", x.toFixed(3));
        palcoHero.style.setProperty("--mouse-y", y.toFixed(3));
      });
      palcoHero.addEventListener("pointerleave", function () {
        palcoHero.style.setProperty("--mouse-x", 0);
        palcoHero.style.setProperty("--mouse-y", 0);
      });
    }

    // ---------- Blocos que aparecem ao entrar na tela ----------
    const blocos = document.querySelectorAll(".revelar");
    if ("IntersectionObserver" in window) {
      const observador = new IntersectionObserver(function (entradas) {
        entradas.forEach(function (entrada) {
          if (!entrada.isIntersecting) return;
          entrada.target.classList.add("visivel");
          observador.unobserve(entrada.target);
        });
      }, { rootMargin: "0px 0px -12% 0px" });

      // Cartões lado a lado entram um depois do outro
      document.querySelectorAll(".cartoes, .passos").forEach(function (grupo) {
        Array.from(grupo.children).forEach(function (filho, i) {
          filho.style.setProperty("--atraso", (i % 3) * 0.1 + "s");
        });
      });

      blocos.forEach(function (bloco) { observador.observe(bloco); });
    } else {
      blocos.forEach(function (bloco) { bloco.classList.add("visivel"); });
    }

    // ---------- Por dentro do app: a tela do celular segue o passo que está no meio da tela ----------
    const celular = document.getElementById("celular-historia");
    const passos = document.querySelectorAll(".historia-passo");
    const pontos = document.querySelectorAll(".historia-pontos span");
    if (!celular || !passos.length || !("IntersectionObserver" in window)) return;

    function mostrarPasso(passo) {
      const indice = Array.from(passos).indexOf(passo);
      passos.forEach(function (p) { p.classList.toggle("ativo", p === passo); });
      pontos.forEach(function (ponto, i) { ponto.classList.toggle("ativo", i === indice); });
      celular.querySelectorAll(".tela").forEach(function (tela) {
        tela.classList.toggle("ativa", tela.dataset.tela === passo.dataset.tela);
      });
      celular.classList.toggle("com-aviso", passo.hasAttribute("data-aviso"));
      celular.dataset.passo = indice;
    }

    const observadorPassos = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (entrada) {
        if (entrada.isIntersecting) mostrarPasso(entrada.target);
      });
    }, { rootMargin: "-45% 0px -45% 0px" });

    passos.forEach(function (passo) { observadorPassos.observe(passo); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();
