// Landing page: quem já está logado neste aparelho vê "Open Dashvia" em vez de "Sign in".
// Só olha se existe a sessão guardada pelo Supabase; não carrega o banco nesta página.
(function () {
  let logado = false;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const chave = localStorage.key(i) || "";
      if (chave.indexOf("sb-") === 0 && chave.slice(-11) === "-auth-token") logado = true;
    }
  } catch (falha) {
    return; // sem acesso ao armazenamento: mantém "Sign in"
  }
  if (!logado) return;

  document.querySelectorAll("[data-cta-entrar]").forEach(function (link) {
    link.textContent = "Open Dashvia";
    link.setAttribute("href", "dashboard.html");
  });
})();
