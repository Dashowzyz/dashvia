// Validação própria dos formulários (substitui o balão "Preencha este campo." do navegador)

function textoDoErro(campo) {
  const v = campo.validity;
  if (v.valueMissing) return campo.tagName === "SELECT" ? "Escolha uma opção." : "Preencha este campo.";
  if (v.typeMismatch && campo.type === "email") return "Digite um e-mail válido.";
  if (v.rangeUnderflow) return "O valor precisa ser maior que zero.";
  return campo.validationMessage;
}

function limparErro(campo) {
  campo.classList.remove("campo-erro");
  const proximo = campo.nextElementSibling;
  if (proximo && proximo.classList.contains("erro-campo")) proximo.remove();
}

function mostrarErro(campo, texto) {
  campo.classList.add("campo-erro");
  const aviso = document.createElement("span");
  aviso.className = "erro-campo";
  aviso.textContent = texto;
  campo.insertAdjacentElement("afterend", aviso);
}

document.querySelectorAll("form").forEach(function (form) {
  form.noValidate = true;

  // Fase de captura: roda antes dos scripts de cada página
  form.addEventListener("submit", function (evento) {
    let primeiro = null;

    form.querySelectorAll("input, select, textarea").forEach(function (campo) {
      limparErro(campo);
      if (campo.offsetParent === null) return; // ignora campos escondidos
      if (!campo.checkValidity()) {
        mostrarErro(campo, textoDoErro(campo));
        if (!primeiro) primeiro = campo;
      }
    });

    if (primeiro) {
      evento.preventDefault();
      evento.stopImmediatePropagation();
      primeiro.focus();
    }
  }, true);

  // Some o erro assim que a pessoa mexe no campo
  form.addEventListener("input", function (e) { limparErro(e.target); });
  form.addEventListener("change", function (e) { limparErro(e.target); });
});
