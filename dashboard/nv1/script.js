const CSV_URL = './renovacoes.csv';

let dadosOriginais = [];
let filtradosPorPeriodo = [];
let filtradosManuais = [];
let ordenacao = { coluna: null, direcao: 1 };

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

function formatarMoeda(valor) {
  return formatadorMoeda.format(Number(valor) || 0);
}

function parseDataBrasil(dataStr) {
  if (!dataStr) return null;
  const [dia, mes, ano] = dataStr.split('/').map(Number);
  const data = new Date(ano, mes - 1, dia);
  return isNaN(data.getTime()) ? null : data;
}

function formatarParaInput(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function classificarTier(row) {
  const isCard = row.isCard;
  const usou30d = Number(row.acessos30D) > 0;
  const usou90d = Number(row.acessos90D) > 0;
  const abriuEmail90d = Number(row.emailAberto90D) > 0;
  const temConclusao =
    Number(row.cursosConcluidosSempre) > 0 ||
    Number(row.cursosConcluidos30D) > 0;

  if (!isCard) {
    return 'Outro';
  }

  if (usou30d && temConclusao) {
    return 'A';
  }

  if ((usou90d || abriuEmail90d) && temConclusao) {
    return 'B';
  }

  if (usou90d || abriuEmail90d) {
    return 'C';
  }

  return 'D';
}

function carregarDados() {
  return fetch(CSV_URL)
    .then((res) => {
      if (!res.ok) throw new Error('Falha ao carregar CSV');
      return res.text();
    })
    .then((texto) => new Promise((resolve, reject) => {
      Papa.parse(texto, {
        header: true,
        dynamicTyping: true,
        delimiter: ';',
        skipEmptyLines: true,
        complete: (resultado) => resolve(resultado.data),
        error: (erro) => reject(erro)
      });
    }));
}

function calcularResumoGeral(linhas) {
  const contagem = linhas.length;
  const somatorio = linhas.reduce((acc, row) => acc + (Number(row.valorRenovacao) || 0), 0);
  const ticket = contagem ? somatorio / contagem : 0;

  const pagamento = {
    cartao: linhas.filter((r) => r.isCard).length,
    pix: linhas.filter((r) => r.isPix).length,
    boleto: linhas.filter((r) => r.isBoleto).length
  };

  const outros = contagem - pagamento.cartao - pagamento.pix - pagamento.boleto;

  return {
    expiracoes: contagem,
    pagamento,
    outros,
    ticket,
    receita100: somatorio,
    receita20: somatorio * 0.2
  };
}

function calcularCenario(linhas) {
  const total = linhas.length;
  const receita100 = linhas.reduce((acc, row) => acc + (Number(row.valorRenovacao) || 0), 0);
  const ticket = total ? receita100 / total : 0;
  return {
    total,
    ticket,
    receita100,
    receita50: receita100 * 0.5,
    receita25: receita100 * 0.25,
    receita15: receita100 * 0.15
  };
}

function calcularCenariosPorTier(linhas) {
  const apenasCartao = linhas.filter((r) => r.isCard);

  const filtrosCenarios = {
    conservador: ['A', 'B'],
    moderado: ['A', 'B', 'C'],
    agressivo: ['A', 'B', 'C', 'D']
  };

  const cenarios = Object.fromEntries(Object.entries(filtrosCenarios).map(([nome, tiers]) => {
    const filtrado = apenasCartao.filter((r) => tiers.includes(r.tier));
    return [nome, calcularCenario(filtrado)];
  }));

  const grupos = [
    { nome: 'Todos (Cartão)', filtro: (r) => r.isCard },
    { nome: 'Tier A', filtro: (r) => r.tier === 'A' },
    { nome: 'Tier B', filtro: (r) => r.tier === 'B' },
    { nome: 'Tier C', filtro: (r) => r.tier === 'C' },
    { nome: 'Tier D', filtro: (r) => r.tier === 'D' }
  ].map(({ nome, filtro }) => {
    const linhasGrupo = linhas.filter(filtro);
    return { nome, ...calcularCenario(linhasGrupo) };
  });

  return { cenarios, grupos };
}

function obterValoresUnicos(linhas, chave) {
  const set = new Set();
  linhas.forEach((linha) => set.add(linha[chave] ?? ''));
  return Array.from(set).sort((a, b) => String(a).localeCompare(String(b)));
}

function preencherOptions(selectId, valores) {
  const select = document.getElementById(selectId);
  select.innerHTML = '';
  valores.forEach((valor) => {
    const option = document.createElement('option');
    option.value = valor === '' ? '(vazio)' : valor;
    option.textContent = valor === '' ? '(vazio)' : valor;
    select.appendChild(option);
  });
}

function inicializarFiltros(linhas) {
  preencherOptions('filtro-plano', obterValoresUnicos(linhas, 'planoVigente'));
  preencherOptions('filtro-forma', obterValoresUnicos(linhas, 'formaPagamento'));
  preencherOptions('filtro-parcelas', obterValoresUnicos(linhas, 'parcelas'));
  preencherOptions('filtro-incomunicavel', obterValoresUnicos(linhas, 'incomunicavel'));
  preencherOptions('filtro-emailoptout', obterValoresUnicos(linhas, 'emailOptOut'));
  preencherOptions('filtro-categoria', obterValoresUnicos(linhas, 'categoriaStatus'));
  preencherOptions('filtro-marketable', obterValoresUnicos(linhas, 'marketableStatus'));
}

function obterSelecionados(selectId) {
  const select = document.getElementById(selectId);
  return Array.from(select.selectedOptions).map((opt) => opt.value);
}

function passaFiltroCateg(valorLinha, selecionados) {
  if (!selecionados.length) return true;
  const comparavel = valorLinha === '' || valorLinha === null || valorLinha === undefined ? '(vazio)' : valorLinha;
  return selecionados.includes(String(comparavel));
}

function aplicarFiltrosManuais() {
  const selecionados = {
    planoVigente: obterSelecionados('filtro-plano'),
    formaPagamento: obterSelecionados('filtro-forma'),
    parcelas: obterSelecionados('filtro-parcelas'),
    incomunicavel: obterSelecionados('filtro-incomunicavel'),
    emailOptOut: obterSelecionados('filtro-emailoptout'),
    categoriaStatus: obterSelecionados('filtro-categoria'),
    marketableStatus: obterSelecionados('filtro-marketable')
  };

  const minimos = {
    acessos30D: Number(document.getElementById('min-acessos-30').value) || 0,
    acessos90D: Number(document.getElementById('min-acessos-90').value) || 0,
    cursosConcluidosSempre: Number(document.getElementById('min-concluidos-sempre').value) || 0,
    cursosConcluidos30D: Number(document.getElementById('min-concluidos-30').value) || 0,
    emailAberto30D: Number(document.getElementById('min-email-30').value) || 0,
    emailAberto90D: Number(document.getElementById('min-email-90').value) || 0
  };

  filtradosManuais = filtradosPorPeriodo.filter((row) => {
    if (!passaFiltroCateg(row.planoVigente, selecionados.planoVigente)) return false;
    if (!passaFiltroCateg(row.formaPagamento, selecionados.formaPagamento)) return false;
    if (!passaFiltroCateg(row.parcelas, selecionados.parcelas)) return false;
    if (!passaFiltroCateg(row.incomunicavel, selecionados.incomunicavel)) return false;
    if (!passaFiltroCateg(row.emailOptOut, selecionados.emailOptOut)) return false;
    if (!passaFiltroCateg(row.categoriaStatus, selecionados.categoriaStatus)) return false;
    if (!passaFiltroCateg(row.marketableStatus, selecionados.marketableStatus)) return false;

    if (Number(row.acessos30D) < minimos.acessos30D) return false;
    if (Number(row.acessos90D) < minimos.acessos90D) return false;
    if (Number(row.cursosConcluidosSempre) < minimos.cursosConcluidosSempre) return false;
    if (Number(row.cursosConcluidos30D) < minimos.cursosConcluidos30D) return false;
    if (Number(row.emailAberto30D) < minimos.emailAberto30D) return false;
    if (Number(row.emailAberto90D) < minimos.emailAberto90D) return false;

    return true;
  });

  atualizarCenarioManual();
  atualizarTabelaDetalhe();
}

function atualizarResumoGeral(resumo) {
  document.getElementById('expiracoes-total').textContent = resumo.expiracoes;
  document.getElementById('pagamento-cartao').textContent = resumo.pagamento.cartao;
  document.getElementById('pagamento-pix').textContent = resumo.pagamento.pix;
  document.getElementById('pagamento-boleto').textContent = resumo.pagamento.boleto;
  document.getElementById('pagamento-outros').textContent = resumo.outros;
  document.getElementById('ticket-medio').textContent = formatarMoeda(resumo.ticket);
  document.getElementById('receita-100').textContent = formatarMoeda(resumo.receita100);
  document.getElementById('receita-20').textContent = formatarMoeda(resumo.receita20);
}

function criarBlocoValores(cenario) {
  return `
    <div>
      <p class="label">Qtd alunos</p>
      <p class="value">${cenario.total}</p>
    </div>
    <div>
      <p class="label">Ticket médio</p>
      <p class="value">${formatarMoeda(cenario.ticket)}</p>
    </div>
    <div>
      <p class="label">Receita 15%</p>
      <p class="value">${formatarMoeda(cenario.receita15)}</p>
    </div>
    <div>
      <p class="label">Receita 25%</p>
      <p class="value">${formatarMoeda(cenario.receita25)}</p>
    </div>
    <div>
      <p class="label">Receita 50%</p>
      <p class="value">${formatarMoeda(cenario.receita50)}</p>
    </div>
    <div>
      <p class="label">Receita 100%</p>
      <p class="value">${formatarMoeda(cenario.receita100)}</p>
    </div>
  `;
}

function atualizarCenariosTier(resultado) {
  document.getElementById('cenario-conservador').innerHTML = criarBlocoValores(resultado.cenarios.conservador);
  document.getElementById('cenario-moderado').innerHTML = criarBlocoValores(resultado.cenarios.moderado);
  document.getElementById('cenario-agressivo').innerHTML = criarBlocoValores(resultado.cenarios.agressivo);

  const corpo = document.querySelector('#tabela-tiers tbody');
  corpo.innerHTML = '';
  resultado.grupos.forEach((grupo) => {
    const tr = document.createElement('tr');
    if (grupo.nome === 'Tier A') tr.classList.add('tier-a');
    if (grupo.nome === 'Tier B') tr.classList.add('tier-b');
    if (grupo.nome === 'Tier C') tr.classList.add('tier-c');
    if (grupo.nome === 'Tier D') tr.classList.add('tier-d');
    tr.innerHTML = `
      <td>${grupo.nome}</td>
      <td>${grupo.total}</td>
      <td>${formatarMoeda(grupo.ticket)}</td>
      <td>${formatarMoeda(grupo.receita15)}</td>
      <td>${formatarMoeda(grupo.receita25)}</td>
      <td>${formatarMoeda(grupo.receita50)}</td>
      <td>${formatarMoeda(grupo.receita100)}</td>
    `;
    corpo.appendChild(tr);
  });
}

function atualizarCenarioManual() {
  const calculo = calcularCenario(filtradosManuais);
  document.getElementById('cenario-manual').innerHTML = criarBlocoValores(calculo);
}

function atualizarTabelaDetalhe() {
  const tbody = document.querySelector('#tabela-detalhe tbody');
  tbody.innerHTML = '';

  let dadosOrdenados = [...filtradosManuais];
  if (ordenacao.coluna) {
    dadosOrdenados.sort((a, b) => {
      const valorA = a[ordenacao.coluna];
      const valorB = b[ordenacao.coluna];
      if (valorA === valorB) return 0;
      return valorA > valorB ? ordenacao.direcao : -ordenacao.direcao;
    });
  }

  dadosOrdenados.forEach((row) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.idAluno ?? ''}</td>
      <td>${row.nome ?? ''}</td>
      <td>${row.planoVigente ?? ''}</td>
      <td>${formatarMoeda(row.valorRenovacao)}</td>
      <td>${row.dataRenovacao ?? ''}</td>
      <td>${row.formaPagamento ?? ''}</td>
      <td>${row.parcelas ?? ''}</td>
      <td>${row.tipoDePagamento ?? ''}</td>
      <td>${row.acessos30D ?? ''}</td>
      <td>${row.acessos90D ?? ''}</td>
      <td>${row.cursosConcluidosSempre ?? ''}</td>
      <td>${row.cursosConcluidos30D ?? ''}</td>
      <td>${row.emailAberto30D ?? ''}</td>
      <td>${row.emailAberto90D ?? ''}</td>
      <td>${row.categoriaStatus ?? ''}</td>
      <td>${row.incomunicavel ?? ''}</td>
      <td>${row.emailOptOut ?? ''}</td>
      <td>${row.marketableStatus ?? ''}</td>
      <td>${row.tier ?? ''}</td>
    `;
    tbody.appendChild(tr);
  });
}

function atualizarResumoCompleto() {
  const resumo = calcularResumoGeral(filtradosPorPeriodo);
  atualizarResumoGeral(resumo);
  const cenarios = calcularCenariosPorTier(filtradosPorPeriodo);
  atualizarCenariosTier(cenarios);
  aplicarFiltrosManuais();
}

function filtrarPorPeriodo() {
  const inicio = parseDataBrasil(document.getElementById('data-inicio').value.split('-').reverse().join('/'));
  const fim = parseDataBrasil(document.getElementById('data-fim').value.split('-').reverse().join('/'));

  filtradosPorPeriodo = dadosOriginais.filter((row) => {
    const data = row.dataRenovacaoDate;
    if (!data) return false;
    if (inicio && data < inicio) return false;
    if (fim && data > fim) return false;
    return true;
  });

  atualizarResumoCompleto();
}

function exportarCSV() {
  if (!filtradosManuais.length) return;
  const colunas = [
    'idAluno', 'nome', 'planoVigente', 'valorRenovacao', 'dataRenovacao', 'formaPagamento', 'parcelas', 'tipoDePagamento',
    'acessos30D', 'acessos90D', 'cursosConcluidosSempre', 'cursosConcluidos30D', 'emailAberto30D', 'emailAberto90D',
    'categoriaStatus', 'incomunicavel', 'emailOptOut', 'marketableStatus', 'tier'
  ];

  const linhas = filtradosManuais.map((row) => colunas.map((col) => row[col] ?? '').join(';'));
  const conteudo = [colunas.join(';'), ...linhas].join('\n');
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'segmentacao-manual.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function configurarOrdenacao() {
  const headers = document.querySelectorAll('#tabela-detalhe th');
  headers.forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.dataset.key;
      if (ordenacao.coluna === key) {
        ordenacao.direcao *= -1;
      } else {
        ordenacao.coluna = key;
        ordenacao.direcao = 1;
      }
      atualizarTabelaDetalhe();
    });
  });
}

function adicionarFlagsPagamento(linha) {
  linha.isCard = linha.tipoDePagamento === 'credit';
  linha.isPix = linha.tipoDePagamento === 'pix';
  linha.isBoleto = linha.tipoDePagamento === 'boleto';
}

function prepararDados(linhas) {
  return linhas
    .filter((row) => row.dataRenovacao)
    .map((row) => {
      adicionarFlagsPagamento(row);
      row.tier = classificarTier(row);
      row.dataRenovacaoDate = parseDataBrasil(row.dataRenovacao);
      return row;
    });
}

function preencherDatasIniciais() {
  const datasValidas = dadosOriginais.map((row) => row.dataRenovacaoDate).filter(Boolean);
  if (!datasValidas.length) return;
  const min = new Date(Math.min(...datasValidas));
  const max = new Date(Math.max(...datasValidas));
  document.getElementById('data-inicio').value = formatarParaInput(min);
  document.getElementById('data-fim').value = formatarParaInput(max);
}

function registrarEventos() {
  document.getElementById('data-inicio').addEventListener('change', filtrarPorPeriodo);
  document.getElementById('data-fim').addEventListener('change', filtrarPorPeriodo);

  const selects = [
    'filtro-plano', 'filtro-forma', 'filtro-parcelas', 'filtro-incomunicavel',
    'filtro-emailoptout', 'filtro-categoria', 'filtro-marketable'
  ];
  selects.forEach((id) => document.getElementById(id).addEventListener('change', aplicarFiltrosManuais));

  const inputsNumericos = [
    'min-acessos-30', 'min-acessos-90', 'min-concluidos-sempre', 'min-concluidos-30', 'min-email-30', 'min-email-90'
  ];
  inputsNumericos.forEach((id) => document.getElementById(id).addEventListener('input', aplicarFiltrosManuais));

  document.getElementById('exportar-csv').addEventListener('click', exportarCSV);
}

function iniciar() {
  carregarDados()
    .then((dados) => {
      dadosOriginais = prepararDados(dados);
      inicializarFiltros(dadosOriginais);
      preencherDatasIniciais();
      configurarOrdenacao();
      filtrarPorPeriodo();
      registrarEventos();
    })
    .catch((erro) => {
      console.error('Erro ao carregar dados', erro);
      alert('Não foi possível carregar o CSV. Verifique o caminho e tente novamente.');
    });
}

document.addEventListener('DOMContentLoaded', iniciar);
