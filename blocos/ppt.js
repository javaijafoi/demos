// Jogo Pedra, Papel, Tesoura
// Codigo simples para jogar contra o computador

// Guarda o placar
let jogador = 0;
let computador = 0;

const resultadoEl = document.getElementById('resultado');
const placarEl = document.getElementById('placar');

// Atualiza o placar na tela
function atualizarPlacar() {
    placarEl.textContent = `Você: ${jogador} | Computador: ${computador}`;
}

// Retorna escolha aleatória do computador
function jogadaComputador() {
    const opcoes = ['pedra', 'papel', 'tesoura'];
    const indice = Math.floor(Math.random() * opcoes.length);
    return opcoes[indice];
}

// Determina o vencedor da rodada
function jogar(escolhaJogador) {
    const escolhaComp = jogadaComputador();
    let resultado = '';

    if (escolhaJogador === escolhaComp) {
        resultado = `Empate! Ambos escolheram ${escolhaJogador}.`;
    } else if (
        (escolhaJogador === 'pedra' && escolhaComp === 'tesoura') ||
        (escolhaJogador === 'papel' && escolhaComp === 'pedra') ||
        (escolhaJogador === 'tesoura' && escolhaComp === 'papel')
    ) {
        resultado = `Você venceu! ${escolhaJogador} ganha de ${escolhaComp}.`;
        jogador++;
    } else {
        resultado = `Você perdeu! ${escolhaComp} ganha de ${escolhaJogador}.`;
        computador++;
    }

    resultadoEl.textContent = resultado;
    atualizarPlacar();
}

// Eventos de clique para os botões
['pedra', 'papel', 'tesoura'].forEach(id => {
    document.getElementById(id).addEventListener('click', () => jogar(id));
});

// Inicializa placar
atualizarPlacar();
