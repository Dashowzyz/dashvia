// Botão "Voltar" das páginas de termos e privacidade: volta no histórico, ou vai para o login se não houver
document.querySelectorAll("a.voltar").forEach(function (link) {
  link.addEventListener("click", function (e) {
    if (history.length > 1) {
      e.preventDefault();
      history.back();
    }
  });
});
