// Página inicial: quem já entrou neste aparelho vai direto para o app.
// Só confere se existe a sessão guardada pelo Supabase (não carrega o banco nesta página).
// Se a sessão tiver vencido, o próprio app manda a pessoa para o login.
(function () {
  // dashvia.app/?inicio mostra a página inicial mesmo para quem já entrou
  if (new URLSearchParams(window.location.search).has("inicio")) return;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const chave = localStorage.key(i) || "";
      if (chave.indexOf("sb-") === 0 && chave.slice(-11) === "-auth-token") {
        window.location.replace("dashboard.html");
        return;
      }
    }
  } catch (falha) {
    // sem acesso ao armazenamento: mostra a página normalmente
  }
})();
