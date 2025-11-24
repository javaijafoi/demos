// Utilitário para formatar moeda em BRL
function formatCurrency(value) {
  if (!Number.isFinite(value)) return '-';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Parsing seguro de datas (aceita formatos ISO ou dd/mm/aaaa)
function parseDate(value) {
  if (!value) return null;
  if (value.includes('/')) {
    const [d, m, y] = value.split('/').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(value);
}

// Lógica de tiers conforme regra de negócio
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

  if (
    formaPagamento === 'Cartão' &&
    incomunicavel === 'Não' &&
    acessos90 >= 1
  ) {
    return 'Tier A';
  }

  if (
    formaPagamento === 'Cartão' &&
    incomunicavel === 'Não' &&
    (acessos90 === 0 || comunic90 === 0)
  ) {
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
  filtrosPeriodo: { inicio: null, fim: null },
  dadosManuais: [],
  filtrosManuais: null,
  opcoes: {
    planos: [],
    formas: [],
    parcelas: [],
    tiers: ['Tier S', 'Tier A', 'Tier Ruim', 'Tier Péssimo', 'Sem Tier'],
  },
};

// Carregamento inicial
Papa.parse('base_renovacao_1000.csv', {
  download: true,
  header: true,
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

    // Opções únicas
    state.opcoes.planos = [...new Set(linhas.map((l) => l['Plano vigente']).filter(Boolean))];
    state.opcoes.formas = [...new Set(linhas.map((l) => l['Forma de pagamento']).filter(Boolean))];
    state.opcoes.parcelas = [...new Set(linhas.map((l) => l.Parcelas).filter(Boolean))];

    state.filtrosManuais = {
      planosSelecionados: ['Todos'],
      formasSelecionadas: state.opcoes.formas,
      parcelasSelecionadas: state.opcoes.parcelas,
      tiersSelecionados: state.opcoes.tiers,
      incluirOptOut: true,
      incluirBounce: true,
      incluirIncomunicavel: true,
      minAcessos30: 0,
      minAcessos90: 0,
    };

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
  const pagamentoOutros = base.filter(
    (a) => !['Cartão', 'Pix', 'Boleto'].includes(a['Forma de pagamento'])
  ).length;

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

function criarKpiCard(titulo, valor) {
  const div = document.createElement('div');
  div.className = 'kpi-card';
  div.innerHTML = `<h3>${titulo}</h3><p>${valor}</p>`;
  return div;
}

function renderHeader() {
  const headerEl = document.getElementById('header');
  if (!headerEl) return;
  headerEl.innerHTML = '';

  const filtrosContainer = document.createElement('div');
  filtrosContainer.className = 'filters card';

  const dataMin = state.filtrosPeriodo.inicio;
  const dataMax = state.filtrosPeriodo.fim;

  const inicioInput = document.createElement('input');
  inicioInput.type = 'date';
  inicioInput.value = dataMin.toISOString().slice(0, 10);
  inicioInput.addEventListener('change', (e) => {
    state.filtrosPeriodo.inicio = new Date(e.target.value);
    aplicarFiltroPeriodo();
  });

  const fimInput = document.createElement('input');
  fimInput.type = 'date';
  fimInput.value = dataMax.toISOString().slice(0, 10);
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
    criarKpiCard('Expirações Totais', kpis.total),
    criarKpiCard('Pagamento Cartão', kpis.pagamentoCartao),
    criarKpiCard('Pagamento Pix', kpis.pagamentoPix),
    criarKpiCard('Pagamento Boleto', kpis.pagamentoBoleto),
    criarKpiCard('Pagamento Outros', kpis.pagamentoOutros),
    criarKpiCard('Ticket Médio de Renovação', formatCurrency(kpis.ticketMedio)),
    criarKpiCard('Receita 100%', formatCurrency(kpis.receita100)),
    criarKpiCard('Receita 20%', formatCurrency(kpis.receita20))
  );

  headerEl.appendChild(filtrosContainer);
  headerEl.appendChild(kpisGrid);
}

function calcularDadosTiers() {
  const dadosCartao = state.dadosFiltradosPeriodo.filter(
    (aluno) => aluno['Forma de pagamento'] === 'Cartão'
  );

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
      receita100: total * ticketMedio * 1,
    };
  });
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

  section.append(title, container);
}

function aplicarFiltrosManuais() {
  const filtros = state.filtrosManuais || {};

  const {
    planosSelecionados = ['Todos'],
    formasSelecionadas = state.opcoes.formas,
    parcelasSelecionadas = state.opcoes.parcelas,
    tiersSelecionados = state.opcoes.tiers,
    incluirOptOut = true,
    incluirBounce = true,
    incluirIncomunicavel = true,
    minAcessos30 = 0,
    minAcessos90 = 0,
  } = filtros;

  state.dadosManuais = state.dadosFiltradosPeriodo.filter((aluno) => {
    if (
      !planosSelecionados.includes('Todos') &&
      planosSelecionados.length > 0 &&
      !planosSelecionados.includes(aluno['Plano vigente'])
    ) {
      return false;
    }

    if (formasSelecionadas.length && !formasSelecionadas.includes(aluno['Forma de pagamento'])) {
      return false;
    }

    if (parcelasSelecionadas.length && !parcelasSelecionadas.includes(aluno.Parcelas)) {
      return false;
    }

    if (tiersSelecionados.length && !tiersSelecionados.includes(aluno.tier)) {
      return false;
    }

    if (!incluirOptOut && aluno.OptOut === 'Sim') return false;
    if (!incluirBounce && aluno.Bounce === 'Sim') return false;
    if (!incluirIncomunicavel && aluno['Incomunicavel?'] === 'Sim') return false;

    if (aluno['Acessos 30D'] < minAcessos30) return false;
    if (aluno['Acessos 90d'] < minAcessos90) return false;

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
      optionEl.textContent = opt;
      if (!state.filtrosManuais) {
        optionEl.selected = true;
      } else if ((state.filtrosManuais[key] || []).includes(opt)) {
        optionEl.selected = true;
      }
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

  const planosOptions = ['Todos', ...state.opcoes.planos];
  container.appendChild(createSelect('Plano vigente', planosOptions, 'planosSelecionados'));
  container.appendChild(createSelect('Forma de pagamento', state.opcoes.formas, 'formasSelecionadas'));
  container.appendChild(createSelect('Parcelas', state.opcoes.parcelas, 'parcelasSelecionadas'));
  container.appendChild(createSelect('Tier', state.opcoes.tiers, 'tiersSelecionados'));

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

  container.append(
    createCheckbox('Incluir OptOut == "Sim"', 'incluirOptOut', true),
    createCheckbox('Incluir Bounce == "Sim"', 'incluirBounce', true),
    createCheckbox('Incluir Incomunicavel? == "Sim"', 'incluirIncomunicavel', true)
  );

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
    createNumberInput('Mínimo Acessos 30D', 'minAcessos30', 0),
    createNumberInput('Mínimo Acessos 90d', 'minAcessos90', 0)
  );

  return container;
}

function renderCenarioManual() {
  const card = document.createElement('div');
  card.className = 'manual-card';

  const total = state.dadosManuais.length;
  const soma = state.dadosManuais.reduce((acc, cur) => acc + cur['Valor Renovação'], 0);
  const ticket = total ? soma / total : 0;

  const receita15 = total * ticket * 0.15;
  const receita25 = total * ticket * 0.25;
  const receita50 = total * ticket * 0.5;
  const receita100 = total * ticket;

  card.innerHTML = `
    <h3>Cenário Manual (baseado nos filtros abaixo)</h3>
    <div class="value">Alunos: ${total}</div>
    <div class="value">Ticket médio: ${formatCurrency(ticket)}</div>
    <div class="value">Receita 15%: ${formatCurrency(receita15)}</div>
    <div class="value">Receita 25%: ${formatCurrency(receita25)}</div>
    <div class="value">Receita 50%: ${formatCurrency(receita50)}</div>
    <div class="value">Receita 100%: ${formatCurrency(receita100)}</div>
    ${total === 0 ? '<p class="note">Nenhum aluno encontrado com os filtros atuais.</p>' : ''}
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

    tr.innerHTML = `
      <td>${aluno['ID do Aluno'] || '-'}</td>
      <td>${aluno.Nome || '-'}</td>
      <td>${aluno['Plano vigente'] || '-'}</td>
      <td>${formatCurrency(aluno['Valor Renovação'])}</td>
      <td>${dataRenovacao}</td>
      <td>${aluno['Forma de pagamento'] || '-'}</td>
      <td>${aluno.Parcelas || '-'}</td>
      <td>${aluno['Acessos 30D']}</td>
      <td>${aluno['Acessos 90d']}</td>
      <td>${aluno['Cursos Concluídos (Sempre)']}</td>
      <td>${aluno['Cursos Concluídos (30d)']}</td>
      <td>${aluno['Comunicações Abertas 30d']}</td>
      <td>${aluno['Comunicações Abertas 90d']}</td>
      <td>${aluno.OptOut || '-'}</td>
      <td>${aluno.Bounce || '-'}</td>
      <td>${aluno['Incomunicavel?'] || '-'}</td>
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

  const grid = document.createElement('div');
  grid.className = 'manual-grid';

  const filtros = document.createElement('div');
  filtros.className = 'card';
  filtros.innerHTML = '<h3>Filtros avançados</h3>';
  filtros.appendChild(renderFiltrosManuais());

  const cenario = renderCenarioManual();
  grid.append(filtros, cenario);

  section.append(title, grid, renderTabelaDetalhada());
}

function render() {
  renderHeader();
  renderTiers();
  renderManualSection();
}
