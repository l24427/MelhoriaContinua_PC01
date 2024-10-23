function mostrarOpcoes(botao) {
    document.getElementById('opcoes').style.display = 'block';
  botao.style.top = '10%';
  botao.style.left = '50%';
  document.getElementById('fechar').style.display = 'block';
  var botoes = document.getElementsByClassName('botao');
  for (var i = 0; i < botoes.length; i++) {
    if (botoes[i] !== botao) {
      botoes[i].style.display = 'none';
    }
  }
}

function fecharOpcoes() {
  var botoes = document.getElementsByClassName('botao');
  for (var i = 0; i < botoes.length; i++) {
    botoes[i].style.top = ''; 
    botoes[i].style.left = '';
    botoes[i].style.display = 'block';
  }
  document.getElementById('fechar').style.display = 'none';
}

function toggleButtons() {
  const hiddenButtons = document.querySelector('.hidden-buttons');
  hiddenButtons.classList.toggle('show-buttons');}

  function exibirOutroBotao() {
    const outroBotaoDiv = document.getElementById("outro-botao");
    outroBotaoDiv.style.display = "block";
  }

           