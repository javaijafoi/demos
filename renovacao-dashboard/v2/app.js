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
  return new Date(value);
}

// Lógica de tiers conforme regra de negócio original
function classificarTier(aluno) {
  const formaPagamento = aluno['Forma de pagamento'];
  const parcelas = aluno.Parcelas;
  const acessos30 = aluno['Acessos 30D'];
  const acessos90 = aluno['Acessos 90d'];
  const cursos30 = aluno['Cursos Concluídos (30d)'];
  const cursosSempre = aluno['Cursos Concluídos (Sempre)'];
  const comunic90 = aluno['Comunicações Abertas 90d'];
  const incomunicavel = aluno['Incomunicavel?'];

  if (
    formaPagamento === 'Cartão' &&
    parcelas === '1x' &&
    acessos30 >= 3 &&
    cursos30 >= 1 &&
    incomunicavel === 'Não'
  ) {
    return 'Tier S';
  }

  if (formaPagamento === 'Cartão' && incomunicavel === 'Não' && acessos90 >= 1) {
    return 'Tier A';
  }

  if (formaPagamento === 'Cartão' && incomunicavel === 'Não' && (acessos90 === 0 || comunic90 === 0)) {
    return 'Tier Ruim';
  }

  if (incomunicavel === 'Sim' || (acessos90 === 0 && cursosSempre === 0)) {
    return 'Tier Péssimo';
  }

  return 'Sem Tier';
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
    renovouAntes: [],
    mesmoNome: [],
  },
};

function criarFiltrosManuaisDefault() {
  return {
    planosSelecionados: state.opcoes.planos,
    formasSelecionadas: state.opcoes.formas,
    parcelasSelecionadas: state.opcoes.parcelas,
    renovouAntesSelecionados: state.opcoes.renovouAntes,
    mesmoNomeSelecionados: state.opcoes.mesmoNome,
    incluirOptOutSim: true,
    incluirBounceSim: true,
    incluirIncomunicavelSim: true,
    minAcessos30: 0,
    minAcessos90: 0,
    minCursosSempre: 0,
    minCursos30: 0,
    minComunic30: 0,
    minComunic90: 0,
  };
}

// Carregamento inicial
Papa.parse('../base_renovacao_1000.csv', {
  download: true,
  header: true,
  skipEmptyLines: true,
  complete: (results) => {
    const linhas = results.data
      .filter((row) => Object.values(row).some((v) => v !== undefined && v !== null && String(v).trim() !== ''))
      .map((row) => ({
        ...row,
        'Data de Contratação': parseDate(row['Data de Contratação']),
        'Data de renovação': parseDate(row['Data de renovação']),
        'Valor do Plano': parseInt(row['Valor do Plano'], 10) || 0,
        'Valor Renovação': parseInt(row['Valor Renovação'], 10) || 0,
        'Acessos 30D': parseInt(row['Acessos 30D'], 10) || 0,
        'Acessos 90d': parseInt(row['Acessos 90d'], 10) || 0,
        'Cursos Concluídos (Sempre)': parseInt(row['Cursos Concluídos (Sempre)'], 10) || 0,
        'Cursos Concluídos (30d)': parseInt(row['Cursos Concluídos (30d)'], 10) || 0,
        'Comunicações Abertas 30d': parseInt(row['Comunicações Abertas 30d'], 10) || 0,
        'Comunicações Abertas 90d': parseInt(row['Comunicações Abertas 90d'], 10) || 0,
      }))
      .map((aluno) => ({ ...aluno, tier: classificarTier(aluno) }));

    state.dados = linhas;

    // Define datas mínimas e máximas
    const datas = linhas
      .map((l) => l['Data de renovação'])
      .filter((d) => d instanceof Date && !isNaN(d));
    const dataMin = new Date(Math.min(...datas));
    const dataMax = new Date(Math.max(...datas));

    state.filtrosPeriodo.inicio = dataMin;
    state.filtrosPeriodo.fim = dataMax;

    // Opções únicas para multiselects
    state.opcoes.planos = [...new Set(linhas.map((l) => l['Plano vigente']).filter(Boolean))];
    state.opcoes.formas = [...new Set(linhas.map((l) => l['Forma de pagamento']).filter(Boolean))];
    state.opcoes.parcelas = [...new Set(linhas.map((l) => l.Parcelas).filter(Boolean))];
    state.opcoes.renovouAntes = [...new Set(linhas.map((l) => l['Já renovou antes']).filter((v) => v !== undefined))];
    state.opcoes.mesmoNome = [...new Set(linhas.map((l) => l['Mesmo nome do Cartão?']).filter((v) => v !== undefined))];

    state.filtrosManuais = criarFiltrosManuaisDefault();

    aplicarFiltroPeriodo();
  },
});

// Aplica filtro de período baseado em Data de renovação
function aplicarFiltroPeriodo() {
  const { inicio, fim } = state.filtrosPeriodo;
  state.dadosFiltradosPeriodo = state.dados.filter((aluno) => {
    const data = aluno['Data de renovação'];
    return data && data >= inicio && data <= fim;
  });
  aplicarFiltrosManuais();
  render();
}

// Calcula KPIs gerais
function calcularKPIs() {
  const base = state.dadosFiltradosPeriodo;
  const total = base.length;
  const pagamentoCartao = base.filter((a) => a['Forma de pagamento'] === 'Cartão').length;
  const pagamentoPix = base.filter((a) => a['Forma de pagamento'] === 'Pix').length;
  const pagamentoBoleto = base.filter((a) => a['Forma de pagamento'] === 'Boleto').length;
  const pagamentoOutros = base.filter((a) => !['Cartão', 'Pix', 'Boleto'].includes(a['Forma de pagamento'])).length;

  const soma = base.reduce((acc, cur) => acc + cur['Valor Renovação'], 0);
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
  const dadosCartao = state.dadosFiltradosPeriodo.filter((aluno) => aluno['Forma de pagamento'] === 'Cartão');

  const grupos = {
    'Todos (Cartão)': dadosCartao,
    'Tier S': dadosCartao.filter((a) => a.tier === 'Tier S'),
    'Tier A': dadosCartao.filter((a) => a.tier === 'Tier A'),
    'Tier Ruim': dadosCartao.filter((a) => a.tier === 'Tier Ruim'),
    'Tier Péssimo': dadosCartao.filter((a) => a.tier === 'Tier Péssimo'),
  };

  return Object.entries(grupos).map(([nome, arr]) => {
    const total = arr.length;
    const soma = arr.reduce((acc, cur) => acc + cur['Valor Renovação'], 0);
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

function obterClasseTier(nome) {
  if (nome === 'Tier S') return 'tier-s-row';
  if (nome === 'Tier A') return 'tier-a-row';
  if (nome === 'Tier Ruim') return 'tier-ruim-row';
  if (nome === 'Tier Péssimo') return 'tier-pessimo-row';
  return 'tier-neutral-row';
}

function renderLegendaTiers() {
  const legend = document.createElement('div');
  legend.className = 'tier-legend';

  const itens = [
    { titulo: 'Tier S (dourado)', classe: 'tier-s-row', descricao: 'Cartão, 1x, engajado (acessos e conclusão recente) e comunicável.' },
    { titulo: 'Tier A (verde)', classe: 'tier-a-row', descricao: 'Cartão, comunicável, acessos recentes (até 90 dias), engajamento bom.' },
    { titulo: 'Tier Ruim (laranja)', classe: 'tier-ruim-row', descricao: 'Cartão, porém com baixo engajamento e/ou pouca abertura de comunicação.' },
    { titulo: 'Tier Péssimo (vermelho)', classe: 'tier-pessimo-row', descricao: 'Incomunicável ou totalmente dormente (sem acessos e sem cursos concluídos).' },
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

  section.append(title, container, renderLegendaTiers());
}

function aplicarFiltrosManuais() {
  const filtros = state.filtrosManuais || criarFiltrosManuaisDefault();
  const {
    planosSelecionados,
    formasSelecionadas,
    parcelasSelecionadas,
    renovouAntesSelecionados,
    mesmoNomeSelecionados,
    incluirOptOutSim,
    incluirBounceSim,
    incluirIncomunicavelSim,
    minAcessos30,
    minAcessos90,
    minCursosSempre,
    minCursos30,
    minComunic30,
    minComunic90,
  } = filtros;

  const matchMulti = (lista, valor) => !lista || !lista.length || lista.includes(valor) || (valor === '' && lista.includes(''));

  state.dadosManuais = state.dadosFiltradosPeriodo.filter((aluno) => {
    if (!matchMulti(planosSelecionados, aluno['Plano vigente'])) return false;
    if (!matchMulti(formasSelecionadas, aluno['Forma de pagamento'])) return false;
    if (!matchMulti(parcelasSelecionadas, aluno.Parcelas)) return false;
    if (!matchMulti(renovouAntesSelecionados, aluno['Já renovou antes'])) return false;
    if (!matchMulti(mesmoNomeSelecionados, aluno['Mesmo nome do Cartão?'])) return false;

    if (!incluirOptOutSim && aluno.OptOut === 'Sim') return false;
    if (!incluirBounceSim && aluno.Bounce === 'Sim') return false;
    if (!incluirIncomunicavelSim && aluno['Incomunicavel?'] === 'Sim') return false;

    if (aluno['Acessos 30D'] < minAcessos30) return false;
    if (aluno['Acessos 90d'] < minAcessos90) return false;
    if (aluno['Cursos Concluídos (Sempre)'] < minCursosSempre) return false;
    if (aluno['Cursos Concluídos (30d)'] < minCursos30) return false;
    if (aluno['Comunicações Abertas 30d'] < minComunic30) return false;
    if (aluno['Comunicações Abertas 90d'] < minComunic90) return false;

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

  const createCheckbox = (labelText, key, defaultChecked = true) => {
    const group = document.createElement('div');
    group.className = 'filter-group';
    const labelEl = document.createElement('label');
    labelEl.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = state.filtrosManuais?.[key] ?? defaultChecked;
    input.addEventListener('change', () => {
      state.filtrosManuais = { ...state.filtrosManuais, [key]: input.checked };
      aplicarFiltrosManuais();
      render();
    });
    group.append(labelEl, input);
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
    createSelect('Já renovou antes', state.opcoes.renovouAntes, 'renovouAntesSelecionados'),
    createSelect('Mesmo nome do Cartão?', state.opcoes.mesmoNome, 'mesmoNomeSelecionados'),
    createNumberInput('Mínimo Acessos 30D', 'minAcessos30', 0),
    createNumberInput('Mínimo Acessos 90d', 'minAcessos90', 0),
    createNumberInput('Mínimo Cursos Concluídos (Sempre)', 'minCursosSempre', 0),
    createNumberInput('Mínimo Cursos Concluídos (30d)', 'minCursos30', 0),
    createNumberInput('Mínimo Comunicações Abertas 30d', 'minComunic30', 0),
    createNumberInput('Mínimo Comunicações Abertas 90d', 'minComunic90', 0),
    createCheckbox('Incluir OptOut == "Sim"', 'incluirOptOutSim', true),
    createCheckbox('Incluir Bounce == "Sim"', 'incluirBounceSim', true),
    createCheckbox('Incluir Incomunicavel? == "Sim"', 'incluirIncomunicavelSim', true)
  );

  return container;
}

function renderCenarioManual() {
  const card = document.createElement('div');
  card.className = 'manual-summary';

  const total = state.dadosManuais.length;
  const soma = state.dadosManuais.reduce((acc, cur) => acc + cur['Valor Renovação'], 0);
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
      <th>Acessos 90d</th>
      <th>Cursos Concluídos (Sempre)</th>
      <th>Cursos Concluídos (30d)</th>
      <th>Comunicações Abertas 30d</th>
      <th>Comunicações Abertas 90d</th>
      <th>OptOut</th>
      <th>Bounce</th>
      <th>Incomunicavel?</th>
      <th>Tier</th>
    </tr>`;

  const tbody = document.createElement('tbody');
  const limite = 100;
  state.dadosManuais.slice(0, limite).forEach((aluno) => {
    const tr = document.createElement('tr');
    const dataRenovacao = aluno['Data de renovação'] instanceof Date && !isNaN(aluno['Data de renovação'])
      ? aluno['Data de renovação'].toLocaleDateString('pt-BR')
      : '-';

    const risco = aluno['Incomunicavel?'] === 'Sim' ? 'tag-risk' : '';

    tr.innerHTML = `
      <td>${aluno['ID do Aluno'] || '-'}</td>
      <td>${aluno.Nome || '-'}</td>
      <td>${aluno['Plano vigente'] || '-'}</td>
      <td class="money">${formatCurrency(aluno['Valor Renovação'])}</td>
      <td>${dataRenovacao}</td>
      <td>${aluno['Forma de pagamento'] || '-'}</td>
      <td>${aluno.Parcelas || '-'}</td>
      <td>${aluno['Acessos 30D']}</td>
      <td>${aluno['Acessos 90d']}</td>
      <td>${aluno['Cursos Concluídos (Sempre)']}</td>
      <td>${aluno['Cursos Concluídos (30d)']}</td>
      <td>${aluno['Comunicações Abertas 30d']}</td>
      <td>${aluno['Comunicações Abertas 90d']}</td>
      <td class="${aluno.OptOut === 'Sim' ? 'tag-risk' : ''}">${aluno.OptOut || '-'}</td>
      <td class="${aluno.Bounce === 'Sim' ? 'tag-risk' : ''}">${aluno.Bounce || '-'}</td>
      <td class="${risco}">${aluno['Incomunicavel?'] || '-'}</td>
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
