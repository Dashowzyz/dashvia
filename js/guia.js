// Guia rápido: "Como usar o Dashvia"
// Para mudar o conteúdo, é só editar os passos abaixo.

// Mesmos ícones do menu (Lucide)
const ICONES_GUIA = {
  resumo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>',
  parcelas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 14v2.2l1.6 1"/><path d="M16 2v4"/><path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"/><path d="M3 10h5"/><path d="M8 2v4"/><circle cx="16" cy="16" r="6"/></svg>',
  gastos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>',
  assinatura: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>',
  configuracao: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>'
};

// Mostra o nome de uma página com o mesmo ícone que ela tem no menu
function pagina(nome, icone) {
  return '<span class="guia-pagina">' + ICONES_GUIA[icone] + nome + "</span>";
}

const PASSOS_GUIA = [
  {
    titulo: "Adicione seus gastos",
    texto: "Na página " + pagina("Adicionar gasto", "gastos") + ", escolha primeiro a categoria. Depois informe a plataforma ou loja, a forma de pagamento (Pix ou Cartão), as parcelas, a data, o valor e o banco. No Pix não há parcelas nem dia de vencimento. Na lista de bancos use a lupa para pesquisar; se o seu não estiver lá, escolha Outro e escreva o nome."
  },
  {
    titulo: "Registre boletos",
    texto: "Escolha a categoria Boleto. O Residencial (luz, água, internet, condomínio) se repete todo mês, até você encerrar. O de Compras é parcelado: informe em quantas vezes e o valor total. Os boletos aparecem em " + pagina("Parcelas futuras", "parcelas") + ", no cartão Boleto."
  },
  {
    titulo: "Acompanhe no Dashboard",
    texto: "Os blocos do topo do " + pagina("Dashboard", "resumo") + " somam os gastos do mês escolhido. No computador use as setas dos lados para ver mais blocos; no celular, arraste. Clique em um mês do Resumo para trocar o mês."
  },
  {
    titulo: "Escolha o que ver",
    texto: "No " + pagina("Dashboard", "resumo") + ", o botão Personalizar escolhe quais blocos aparecem no topo: Cartão de crédito, Pix, Boleto e as categorias. Você pode mudar quando quiser."
  },
  {
    titulo: "Confira as parcelas",
    texto: "Em " + pagina("Parcelas futuras", "parcelas") + ", troque de banco com as setas (no computador) ou arrastando (no celular) e veja o que falta pagar em cada um. Toque no ✓ para registrar um pagamento: a próxima parcela, parcelas adiantadas, de trás pra frente (as últimas primeiro) ou a quitação de tudo. Errou? Use Desfazer."
  },
  {
    titulo: "Pague o boleto do mês",
    texto: "No cartão Boleto, o ✓ marca o boleto residencial do mês como pago. Ele continua na lista com o status Pago e, no mês seguinte, volta como Em aberto. Use Editar para mudar nome, valor ou dia de vencimento e Encerrar para parar de cobrar a partir do mês seguinte."
  },
  {
    titulo: "Receba avisos de vencimento",
    texto: "O sino no topo avisa quando um boleto está perto de vencer: 7 dias antes, 3 dias antes e no dia do vencimento. Quando há aviso novo, o sino balança e ganha uma bolinha."
  },
  {
    titulo: "Edite ou remova",
    texto: "Em Todos os gastos (o link fica no Dashboard), o lápis corrige um gasto e o ✕ apaga. Boletos e assinaturas se editam nas próprias páginas, em " + pagina("Parcelas futuras", "parcelas") + " e " + pagina("Assinaturas", "assinatura") + "."
  },
  {
    titulo: "Registre assinaturas",
    texto: "Em " + pagina("Adicionar gasto", "gastos") + ", escolha a categoria Assinatura (Netflix, Spotify...). Ela se repete sozinha todo mês, trimestre ou ano e aparece na página " + pagina("Assinaturas", "assinatura") + ", que mostra também em qual cartão ela está."
  },
  {
    titulo: "Divida gastos no espaço",
    texto: "Em " + pagina("Configurações", "configuracao") + ", abra Espaço compartilhado para criar um espaço ou entrar em um com o código de convite. Até 6 pessoas veem e editam juntas os gastos de Boleto, Assinatura, Mercado e Compras, e o histórico mostra o que cada uma fez nos últimos 30 dias. Depois de entrar, aparece no topo das páginas o seletor Pessoal | nome do espaço: escolha o lado que quer ver. Em Parcelas futuras, o lado do espaço tem as abas Tudo, Parcelas e Histórico. Os gastos pessoais de cada um continuam privados."
  },
  {
    titulo: "Deixe do seu jeito",
    texto: "Em " + pagina("Configurações", "configuracao") + " você troca foto (ou remove), nome, senha e as cores do site. O olho ao lado do nome esconde seus dados quando você quiser. Veja o que mudou em Novidades, refaça o tour quando quiser e, se achar algo errado, use Reportar um problema."
  }
];
function abrirGuia() {
  const fundo = document.createElement("div");
  fundo.className = "modal-fundo";
  fundo.innerHTML = `
    <div class="modal modal-form">
      <h3 class="modal-titulo">Como usar o Dashvia</h3>
      <ol class="guia">
        ${PASSOS_GUIA.map(function (passo) {
          return "<li><strong>" + passo.titulo + "</strong>" + passo.texto + "</li>";
        }).join("")}
      </ol>
      <div class="modal-botoes">
        <button type="button" class="modal-ok salvar">Entendi</button>
      </div>
    </div>`;

  function fechar() {
    document.removeEventListener("keydown", aoTeclar);
    fundo.remove();
  }
  function aoTeclar(e) {
    if (e.key === "Escape") fechar();
  }
  document.addEventListener("keydown", aoTeclar);
  fundo.querySelector(".modal-ok").addEventListener("click", fechar);
  fundo.addEventListener("click", function (e) {
    if (e.target === fundo) fechar();
  });

  document.body.appendChild(fundo);
  fundo.querySelector(".modal-ok").focus();
}

// O botão só existe em Configurações; no Dashboard este arquivo serve para a caixa de boas-vindas
const botaoGuia = document.getElementById("btn-guia");
if (botaoGuia) botaoGuia.addEventListener("click", abrirGuia);
