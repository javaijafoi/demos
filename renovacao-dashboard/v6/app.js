// Utilitário para formatar moeda em BRL
function formatCurrency(value) {
  if (!Number.isFinite(value)) return '-';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Parsing seguro de datas (aceita formatos ISO ou dd/mm/aaaa)
function parseDate(value) {
  if (!value) return null;
  if (String(value).includes('/')) {
    const [d, m, y] = value.split('/').map(Number);
    return new Date(y, m - 1, d);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// Lógica de tiers com mapeamento para nova nomenclatura
function classificarTier(aluno) {
  const formaPagamento = aluno.formaPagamento;
  const parcelas = aluno.parcelas;
  const acessos30 = aluno.acessos30D;
  const acessos90 = aluno.acessos90D;
  const cursos30 = aluno.cursosConcluidos30D;
  const cursosSempre = aluno.cursosConcluidosSempre;
  const comunic90 = aluno.emailAberto90D;
  const incomunicavel = aluno.incomunicavel;

  if (
    formaPagamento === 'Cartão' &&
    parcelas === '1x' &&
    acessos30 >= 3 &&
    cursos30 >= 1 &&
    incomunicavel === 'Não'
  ) {
    return 'Tier A';
  }

  if (formaPagamento === 'Cartão' && incomunicavel === 'Não' && acessos90 >= 1) {
    return 'Tier B';
  }

  if (formaPagamento === 'Cartão' && incomunicavel === 'Não' && (acessos90 === 0 || comunic90 === 0)) {
    return 'Tier C';
  }

  if (incomunicavel === 'Sim' || (acessos90 === 0 && cursosSempre === 0)) {
    return 'Tier D';
  }

  return 'Outro';
}

const state = {
  dados: [],
  dadosFiltradosPeriodo: [],
  dadosManuais: [],
  filtrosPeriodo: { inicio: null, fim: null },
  filtrosManuais: null,
  opcoes: {
    planos: [],
    formas: [],
    parcelas: [],
    incomunicavel: [],
    optOut: [],
    categoriaStatus: [],
    marketableStatus: [],
  },
};

function criarFiltrosManuaisDefault() {
  return {
    planosSelecionados: state.opcoes.planos,
    formasSelecionadas: state.opcoes.formas,
    parcelasSelecionadas: state.opcoes.parcelas,
    incomunicavelSelecionados: state.opcoes.incomunicavel,
    optOutSelecionados: state.opcoes.optOut,
    categoriaStatusSelecionados: state.opcoes.categoriaStatus,
    marketableStatusSelecionados: state.opcoes.marketableStatus,
    minAcessos30: 0,
    minAcessos90: 0,
    minCursosSempre: 0,
    minCursos30: 0,
    minComunic30: 0,
    minComunic90: 0,
  };
}

// Carregamento inicial
Papa.parse('../Ren-Com.csv', {
  download: true,
  header: true,
  skipEmptyLines: true,
  delimiter: ';',
  complete: (results) => {
    const linhas = results.data
      .filter((row) => Object.values(row).some((v) => v !== undefined && v !== null && String(v).trim() !== ''))
      .map((row) => ({
        idAluno: row.idAluno,
        nome: row.nome,
        email: row.email,
        planoVigente: row.planoVigente,
        valorPlano: parseFloat(row.valorPlano) || 0,
        valorRenovacao: parseFloat(row.valorRenovacao) || 0,
        dataRenovacao: parseDate(row.dataRenovacao),
        formaPagamento: row.formaPagamento,
        parcelas: row.parcelas,
        tipoDePagamento: row.tipoDePagamento,
        chargeId: row.chargeId,
        acessos30D: parseInt(row.acessos30D, 10) || 0,
        acessos90D: parseInt(row.acessos90D, 10) || 0,
        cursosConcluidosSempre: parseInt(row.cursosConcluidosSempre, 10) || 0,
        cursosConcluidos30D: parseInt(row.cursosConcluidos30D, 10) || 0,
        categoriaStatus: row.categoriaStatus,
        incomunicavel: row.incomunicavel,
        emailOptOut: row.emailOptOut,
        dataDoUltimoEnvioDeEmail: parseDate(row.dataDoUltimoEnvioDeEmail),
        dataDaUltimaAberturaDeEmail: parseDate(row.dataDaUltimaAberturaDeEmail),
        dataDoUltimoCliqueNoEmail: parseDate(row.dataDoUltimoCliqueNoEmail),
        emailAberto30D: parseInt(row.emailAberto30D, 10) || 0,
        emailAberto90D: parseInt(row.emailAberto90D, 10) || 0,
        marketableStatus: row.marketableStatus,
      }))
      .map((aluno) => ({ ...aluno, tier: classificarTier(aluno) }));

    state.dados = linhas;

    // Define datas mínimas e máximas
    const datas = linhas
      .map((l) => l.dataRenovacao)
      .filter((d) => d instanceof Date && !isNaN(d));
    const dataMin = datas.length ? new Date(Math.min(...datas)) : new Date();
    const dataMax = datas.length ? new Date(Math.max(...datas)) : new Date();

    state.filtrosPeriodo.inicio = dataMin;
    state.filtrosPeriodo.fim = dataMax;

    // Opções únicas para multiselects
    state.opcoes.planos = [...new Set(linhas.map((l) => l.planoVigente).filter(Boolean))];
    state.opcoes.formas = [...new Set(linhas.map((l) => l.formaPagamento).filter(Boolean))];
    state.opcoes.parcelas = [...new Set(linhas.map((l) => l.parcelas).filter(Boolean))];
    state.opcoes.incomunicavel = [...new Set(linhas.map((l) => l.incomunicavel).filter((v) => v !== undefined))];
    state.opcoes.optOut = [...new Set(linhas.map((l) => l.emailOptOut).filter((v) => v !== undefined))];
    state.opcoes.categoriaStatus = [...new Set(linhas.map((l) => l.categoriaStatus).filter((v) => v !== undefined))];
    state.opcoes.marketableStatus = [...new Set(linhas.map((l) => l.marketableStatus).filter((v) => v !== undefined))];

    state.filtrosManuais = criarFiltrosManuaisDefault();

    aplicarFiltroPeriodo();
  },
});

// Aplica filtro de período baseado em dataRenovacao
function aplicarFiltroPeriodo() {
  const { inicio, fim } = state.filtrosPeriodo;
  state.dadosFiltradosPeriodo = state.dados.filter((aluno) => {
    const data = aluno.dataRenovacao;
    return data && data >= inicio && data <= fim;
  });
  aplicarFiltrosManuais();
  render();
}

// Calcula KPIs gerais
function calcularKPIs() {
  const base = state.dadosFiltradosPeriodo;
  const total = base.length;
  const pagamentoCartao = base.filter((a) => a.formaPagamento === 'Cartão').length;
  const pagamentoPix = base.filter((a) => a.formaPagamento === 'Pix').length;
  const pagamentoBoleto = base.filter((a) => a.formaPagamento === 'Boleto').length;
  const pagamentoOutros = base.filter((a) => !['Cartão', 'Pix', 'Boleto'].includes(a.formaPagamento)).length;

  const soma = base.reduce((acc, cur) => acc + cur.valorRenovacao, 0);
  const ticketMedio = total ? soma / total : 0;

  return {
    total,
    pagamentoCartao,
    pagamentoPix,
    pagamentoBoleto,
    pagamentoOutros,
    ticketMedio,
    receita100: soma,
    receita20: soma * 0.2,
  };
}

function criarKpiCard(titulo, valor, classeExtra = '') {
  const div = document.createElement('div');
  div.className = `kpi-card ${classeExtra}`.trim();
  div.innerHTML = `<h3>${titulo}</h3><p>${valor}</p>`;
  return div;
}

function renderHeader() {
  const headerEl = document.getElementById('header');
  if (!headerEl) return;
  headerEl.innerHTML = '';

  const filtrosContainer = document.createElement('div');
  filtrosContainer.className = 'filters';

  const { inicio, fim } = state.filtrosPeriodo;

  const inicioInput = document.createElement('input');
  inicioInput.type = 'date';
  inicioInput.value = inicio.toISOString().slice(0, 10);
  inicioInput.addEventListener('change', (e) => {
    state.filtrosPeriodo.inicio = new Date(e.target.value);
    aplicarFiltroPeriodo();
  });

  const fimInput = document.createElement('input');
  fimInput.type = 'date';
  fimInput.value = fim.toISOString().slice(0, 10);
  fimInput.addEventListener('change', (e) => {
    state.filtrosPeriodo.fim = new Date(e.target.value);
    aplicarFiltroPeriodo();
  });

  const inicioGroup = document.createElement('div');
  inicioGroup.className = 'filter-group';
  inicioGroup.innerHTML = '<label>Início (Data de renovação)</label>';
  inicioGroup.appendChild(inicioInput);

  const fimGroup = document.createElement('div');
  fimGroup.className = 'filter-group';
  fimGroup.innerHTML = '<label>Fim (Data de renovação)</label>';
  fimGroup.appendChild(fimInput);

  filtrosContainer.append(inicioGroup, fimGroup);

  const kpis = calcularKPIs();
  const kpisGrid = document.createElement('div');
  kpisGrid.className = 'kpis';
  kpisGrid.append(
    criarKpiCard('Expirações Totais', kpis.total, 'kpi-count'),
    criarKpiCard('Pagamento Cartão', kpis.pagamentoCartao, 'kpi-count'),
    criarKpiCard('Pagamento Pix', kpis.pagamentoPix, 'kpi-count'),
    criarKpiCard('Pagamento Boleto', kpis.pagamentoBoleto, 'kpi-count'),
    criarKpiCard('Pagamento Outros', kpis.pagamentoOutros, 'kpi-count'),
    criarKpiCard('Ticket Médio de Renovação', formatCurrency(kpis.ticketMedio), 'kpi-financial'),
    criarKpiCard('Receita 100%', formatCurrency(kpis.receita100), 'kpi-financial'),
    criarKpiCard('Receita 20%', formatCurrency(kpis.receita20), 'kpi-highlight')
  );

  headerEl.append(filtrosContainer, kpisGrid);
}

function calcularDadosTiers() {
  const dadosCartao = state.dadosFiltradosPeriodo.filter((aluno) => aluno.formaPagamento === 'Cartão');

  const grupos = {
    'Todos (Cartão)': dadosCartao,
    'Tier A': dadosCartao.filter((a) => a.tier === 'Tier A'),
    'Tier B': dadosCartao.filter((a) => a.tier === 'Tier B'),
    'Tier C': dadosCartao.filter((a) => a.tier === 'Tier C'),
    'Tier D': dadosCartao.filter((a) => a.tier === 'Tier D'),
  };

  return Object.entries(grupos).map(([nome, arr]) => {
    const total = arr.length;
    const soma = arr.reduce((acc, cur) => acc + cur.valorRenovacao, 0);
    const ticketMedio = total ? soma / total : 0;
    return {
      nome,
      total,
      ticketMedio,
      receita15: total * ticketMedio * 0.15,
      receita25: total * ticketMedio * 0.25,
      receita50: total * ticketMedio * 0.5,
      receita100: total * ticketMedio,
    };
  });
}

function calcularCenarios() {
  const dadosCartao = state.dadosFiltradosPeriodo.filter((aluno) => aluno.formaPagamento === 'Cartão');
  const cenarios = {
    'Cenário Conservador (Tiers A + B)': ['Tier A', 'Tier B'],
    'Cenário Moderado (Tiers A + B + C)': ['Tier A', 'Tier B', 'Tier C'],
    'Cenário Agressivo (Tiers A + B + C + D)': ['Tier A', 'Tier B', 'Tier C', 'Tier D'],
  };

  return Object.entries(cenarios).map(([titulo, tiers]) => {
    const subset = dadosCartao.filter((a) => tiers.includes(a.tier));
    const total = subset.length;
    const soma = subset.reduce((acc, cur) => acc + cur.valorRenovacao, 0);
    const ticketMedio = total ? soma / total : 0;

    return {
      titulo,
      total,
      ticketMedio,
      receita15: total * ticketMedio * 0.15,
      receita25: total * ticketMedio * 0.25,
      receita50: total * ticketMedio * 0.5,
      receita100: total * ticketMedio,
    };
  });
}

function obterClasseTier(nome) {
  if (nome === 'Tier A') return 'tier-a-row';
  if (nome === 'Tier B') return 'tier-b-row';
  if (nome === 'Tier C') return 'tier-c-row';
  if (nome === 'Tier D') return 'tier-d-row';
  return 'tier-neutral-row';
}

function renderLegendaTiers() {
  const legend = document.createElement('div');
  legend.className = 'tier-legend';

  const itens = [
    { titulo: 'Tier A (dourado)', classe: 'tier-a-row', descricao: 'Mais engajados, comunicáveis, alta propensão de renovação.' },
    { titulo: 'Tier B (verde)', classe: 'tier-b-row', descricao: 'Cartão e comunicáveis, com engajamento recente razoável.' },
    { titulo: 'Tier C (laranja)', classe: 'tier-c-row', descricao: 'Cartão, porém com baixo engajamento e/ou pouca abertura recente.' },
    { titulo: 'Tier D (vermelho)', classe: 'tier-d-row', descricao: 'Incomunicáveis ou totalmente dormentes (sem acesso/curso).' },
    { titulo: 'Todos (Cartão)', classe: 'tier-neutral-row', descricao: 'Recorte geral de clientes que pagam com cartão.' },
  ];

  itens.forEach((item) => {
    const div = document.createElement('div');
    div.className = `item ${item.classe}`;
    div.innerHTML = `<h4>${item.titulo}</h4><p>${item.descricao}</p>`;
    legend.appendChild(div);
  });

  return legend;
}

function renderCenariosCards() {
  const wrapper = document.createElement('div');
  wrapper.className = 'scenario-cards';

  calcularCenarios().forEach((c) => {
    const card = document.createElement('div');
    card.className = 'scenario-card';
    card.innerHTML = `
      <h4>${c.titulo}</h4>
      <div class="metric"><span>Qtd alunos</span><span class="value">${c.total}</span></div>
      <div class="metric"><span>Ticket médio</span><span class="value">${formatCurrency(c.ticketMedio)}</span></div>
      <div class="metric"><span>Receita 15%</span><span class="value">${formatCurrency(c.receita15)}</span></div>
      <div class="metric"><span>Receita 25%</span><span class="value">${formatCurrency(c.receita25)}</span></div>
      <div class="metric"><span>Receita 50%</span><span class="value">${formatCurrency(c.receita50)}</span></div>
      <div class="metric"><span>Receita 100%</span><span class="value">${formatCurrency(c.receita100)}</span></div>`;
    wrapper.appendChild(card);
  });

  return wrapper;
}

function renderTiers() {
  const section = document.getElementById('tiers-section');
  if (!section) return;
  section.innerHTML = '';

  const title = document.createElement('div');
  title.className = 'section-title';
  title.innerHTML = '<h2>Cenários por Tier (Pagamento com Cartão)</h2><span class="badge">Base: período filtrado</span>';

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th>Grupo</th>
      <th>Total de alunos</th>
      <th>Ticket médio</th>
      <th>Receita 15%</th>
      <th>Receita 25%</th>
      <th>Receita 50%</th>
      <th>Receita 100%</th>
    </tr>`;

  const tbody = document.createElement('tbody');
  calcularDadosTiers().forEach((g) => {
    const tr = document.createElement('tr');
    tr.className = obterClasseTier(g.nome);
    tr.innerHTML = `
      <td>${g.nome}</td>
      <td>${g.total}</td>
      <td>${formatCurrency(g.ticketMedio)}</td>
      <td>${formatCurrency(g.receita15)}</td>
      <td>${formatCurrency(g.receita25)}</td>
      <td>${formatCurrency(g.receita50)}</td>
      <td>${formatCurrency(g.receita100)}</td>`;
    tbody.appendChild(tr);
  });

  table.append(thead, tbody);

  const container = document.createElement('div');
  container.className = 'table-container';
  container.appendChild(table);

  section.append(title, renderCenariosCards(), container, renderLegendaTiers());
}

function aplicarFiltrosManuais() {
  const filtros = state.filtrosManuais || criarFiltrosManuaisDefault();
  const {
    planosSelecionados,
    formasSelecionadas,
    parcelasSelecionadas,
    incomunicavelSelecionados,
    optOutSelecionados,
    categoriaStatusSelecionados,
    marketableStatusSelecionados,
    minAcessos30,
    minAcessos90,
    minCursosSempre,
    minCursos30,
    minComunic30,
    minComunic90,
  } = filtros;

  const matchMulti = (lista, valor) => !lista || !lista.length || lista.includes(valor) || (valor === '' && lista.includes(''));

  state.dadosManuais = state.dadosFiltradosPeriodo.filter((aluno) => {
    if (!matchMulti(planosSelecionados, aluno.planoVigente)) return false;
    if (!matchMulti(formasSelecionadas, aluno.formaPagamento)) return false;
    if (!matchMulti(parcelasSelecionadas, aluno.parcelas)) return false;
    if (!matchMulti(incomunicavelSelecionados, aluno.incomunicavel)) return false;
    if (!matchMulti(optOutSelecionados, aluno.emailOptOut)) return false;
    if (!matchMulti(categoriaStatusSelecionados, aluno.categoriaStatus)) return false;
    if (!matchMulti(marketableStatusSelecionados, aluno.marketableStatus)) return false;

    if (aluno.acessos30D < minAcessos30) return false;
    if (aluno.acessos90D < minAcessos90) return false;
    if (aluno.cursosConcluidosSempre < minCursosSempre) return false;
    if (aluno.cursosConcluidos30D < minCursos30) return false;
    if (aluno.emailAberto30D < minComunic30) return false;
    if (aluno.emailAberto90D < minComunic90) return false;

    return true;
  });
}

function renderFiltrosManuais() {
  const container = document.createElement('div');
  container.className = 'manual-filters';

  const createSelect = (labelText, options, key) => {
    const group = document.createElement('div');
    group.className = 'filter-group';
    const labelEl = document.createElement('label');
    labelEl.textContent = labelText;
    const select = document.createElement('select');
    select.multiple = true;

    options.forEach((opt) => {
      const optionEl = document.createElement('option');
      optionEl.value = opt;
      optionEl.textContent = opt || '(vazio)';
      optionEl.selected = (state.filtrosManuais?.[key] || options).includes(opt);
      select.appendChild(optionEl);
    });

    select.addEventListener('change', () => {
      const selected = Array.from(select.selectedOptions).map((o) => o.value);
      state.filtrosManuais = {
        ...state.filtrosManuais,
        [key]: selected.length ? selected : options,
      };
      aplicarFiltrosManuais();
      render();
    });

    group.append(labelEl, select);
    return group;
  };

  const createNumberInput = (labelText, key, defaultValue = 0) => {
    const group = document.createElement('div');
    group.className = 'filter-group';
    const labelEl = document.createElement('label');
    labelEl.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'number';
    input.min = 0;
    input.value = state.filtrosManuais?.[key] ?? defaultValue;
    input.addEventListener('input', () => {
      state.filtrosManuais = {
        ...state.filtrosManuais,
        [key]: Number(input.value) || 0,
      };
      aplicarFiltrosManuais();
      render();
    });
    group.append(labelEl, input);
    return group;
  };

  container.append(
    createSelect('Plano vigente', state.opcoes.planos, 'planosSelecionados'),
    createSelect('Forma de pagamento', state.opcoes.formas, 'formasSelecionadas'),
    createSelect('Parcelas', state.opcoes.parcelas, 'parcelasSelecionadas'),
    createSelect('Incomunicável', state.opcoes.incomunicavel, 'incomunicavelSelecionados'),
    createSelect('Email Opt-out', state.opcoes.optOut, 'optOutSelecionados'),
    createSelect('Categoria Status', state.opcoes.categoriaStatus, 'categoriaStatusSelecionados'),
    createSelect('Marketable Status', state.opcoes.marketableStatus, 'marketableStatusSelecionados'),
    createNumberInput('Mínimo Acessos 30D', 'minAcessos30', 0),
    createNumberInput('Mínimo Acessos 90D', 'minAcessos90', 0),
    createNumberInput('Mínimo Cursos Concluídos (Sempre)', 'minCursosSempre', 0),
    createNumberInput('Mínimo Cursos Concluídos (30D)', 'minCursos30', 0),
    createNumberInput('Mínimo Emails Abertos 30D', 'minComunic30', 0),
    createNumberInput('Mínimo Emails Abertos 90D', 'minComunic90', 0),
  );

  return container;
}

function renderCenarioManual() {
  const card = document.createElement('div');
  card.className = 'manual-summary';

  const total = state.dadosManuais.length;
  const soma = state.dadosManuais.reduce((acc, cur) => acc + cur.valorRenovacao, 0);
  const ticket = total ? soma / total : 0;

  const receita15 = total * ticket * 0.15;
  const receita25 = total * ticket * 0.25;
  const receita50 = total * ticket * 0.5;
  const receita100 = total * ticket;

  card.innerHTML = `
    <h3>Cenário Manual</h3>
    <div class="metric"><span>Total de alunos filtrados</span><span class="value">${total}</span></div>
    <div class="metric"><span>Ticket médio</span><span class="value">${formatCurrency(ticket)}</span></div>
    <div class="metric"><span>Receita 15%</span><span class="value money">${formatCurrency(receita15)}</span></div>
    <div class="metric"><span>Receita 25%</span><span class="value money">${formatCurrency(receita25)}</span></div>
    <div class="metric"><span>Receita 50%</span><span class="value money">${formatCurrency(receita50)}</span></div>
    <div class="metric"><span>Receita 100%</span><span class="value money">${formatCurrency(receita100)}</span></div>
    ${total === 0 ? '<p class="sub">Nenhum aluno encontrado com os filtros atuais.</p>' : ''}
  `;

  return card;
}

function renderTabelaDetalhada() {
  const container = document.createElement('div');
  container.className = 'table-container';

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th>ID do Aluno</th>
      <th>Nome</th>
      <th>Plano vigente</th>
      <th>Valor Renovação</th>
      <th>Data de renovação</th>
      <th>Forma de pagamento</th>
      <th>Parcelas</th>
      <th>Acessos 30D</th>
      <th>Acessos 90D</th>
      <th>Cursos Concluídos (Sempre)</th>
      <th>Cursos Concluídos (30D)</th>
      <th>Emails Abertos 30D</th>
      <th>Emails Abertos 90D</th>
      <th>Incomunicável</th>
      <th>Email Opt-out</th>
      <th>Categoria Status</th>
      <th>Marketable Status</th>
      <th>Tier</th>
    </tr>`;

  const tbody = document.createElement('tbody');
  const limite = 100;
  state.dadosManuais.slice(0, limite).forEach((aluno) => {
    const dataRenovacao = aluno.dataRenovacao instanceof Date && !isNaN(aluno.dataRenovacao)
      ? aluno.dataRenovacao.toLocaleDateString('pt-BR')
      : '-';

    const risco = aluno.incomunicavel === 'Sim' ? 'tag-risk' : '';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${aluno.idAluno || '-'}</td>
      <td>${aluno.nome || '-'}</td>
      <td>${aluno.planoVigente || '-'}</td>
      <td class="money">${formatCurrency(aluno.valorRenovacao)}</td>
      <td>${dataRenovacao}</td>
      <td>${aluno.formaPagamento || '-'}</td>
      <td>${aluno.parcelas || '-'}</td>
      <td>${aluno.acessos30D}</td>
      <td>${aluno.acessos90D}</td>
      <td>${aluno.cursosConcluidosSempre}</td>
      <td>${aluno.cursosConcluidos30D}</td>
      <td>${aluno.emailAberto30D}</td>
      <td>${aluno.emailAberto90D}</td>
      <td class="${risco}">${aluno.incomunicavel || '-'}</td>
      <td>${aluno.emailOptOut || '-'}</td>
      <td>${aluno.categoriaStatus || '-'}</td>
      <td>${aluno.marketableStatus || '-'}</td>
      <td>${aluno.tier}</td>`;
    tbody.appendChild(tr);
  });

  table.append(thead, tbody);
  container.appendChild(table);

  const info = document.createElement('div');
  info.className = 'limit-info';
  info.textContent = `Mostrando ${Math.min(limite, state.dadosManuais.length)} de ${state.dadosManuais.length} alunos`;
  container.appendChild(info);

  return container;
}

function renderManualSection() {
  const section = document.getElementById('manual-section');
  if (!section) return;
  section.innerHTML = '';

  const title = document.createElement('div');
  title.className = 'section-title';
  title.innerHTML = '<h2>Segmentação Manual e Tabela Detalhada</h2><span class="badge">Base: período filtrado</span>';

  const topRow = document.createElement('div');
  topRow.className = 'manual-top';

  const filtrosWrapper = document.createElement('div');
  filtrosWrapper.className = 'manual-filters-wrapper';
  filtrosWrapper.innerHTML = '<h3>Filtros avançados</h3>';
  filtrosWrapper.appendChild(renderFiltrosManuais());

  topRow.append(renderCenarioManual(), filtrosWrapper);

  section.append(title, topRow, renderTabelaDetalhada());
}

function render() {
  renderHeader();
  renderTiers();
  renderManualSection();
}
