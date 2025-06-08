// Cronômetro Pomodoro simples
const display = document.getElementById('timer');
const estadoEl = document.getElementById('estado');
const btnIniciar = document.getElementById('iniciar');
const btnPausar = document.getElementById('pausar');
const btnResetar = document.getElementById('resetar');

const trabalho = 25 * 60; // 25 minutos
const pausaCurta = 5 * 60; // 5 minutos

let tempoRestante = trabalho;
let intervalo = null;
let emPausa = false;

// Formata o tempo em mm:ss
function formatar(segundos) {
    const m = String(Math.floor(segundos / 60)).padStart(2, '0');
    const s = String(segundos % 60).padStart(2, '0');
    return `${m}:${s}`;
}

// Atualiza a tela
function atualizar() {
    display.textContent = formatar(tempoRestante);
}

function tick() {
    if (tempoRestante > 0) {
        tempoRestante--;
        atualizar();
    } else {
        // Alterna entre trabalho e pausa
        emPausa = !emPausa;
        tempoRestante = emPausa ? pausaCurta : trabalho;
        estadoEl.textContent = emPausa ? 'Pausa curta!' : 'Hora de trabalhar!';
        atualizar();
    }
}

function iniciar() {
    if (intervalo) return; // já rodando
    estadoEl.textContent = emPausa ? 'Pausa curta!' : 'Hora de trabalhar!';
    intervalo = setInterval(tick, 1000);
}

function pausar() {
    clearInterval(intervalo);
    intervalo = null;
}

function resetar() {
    pausar();
    emPausa = false;
    tempoRestante = trabalho;
    estadoEl.textContent = '';
    atualizar();
}

btnIniciar.addEventListener('click', iniciar);
btnPausar.addEventListener('click', pausar);
btnResetar.addEventListener('click', resetar);

// Inicializa display
atualizar();
