// Utilitário para formatar moeda em BRL
function formatCurrency(value) {
  if (!Number.isFinite(value)) return '-';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseNumber(v) {
  if (!v) return 0;
  return Number(v.toString().replace(',', '.'));
}

function parseBrDate(v) {
  if (!v) return null;
  if (typeof v === 'string' && v.includes('/')) {
    const [d, m, a] = v.split('/');
    const date = new Date(Number(a), Number(m) - 1, Number(d));
    return isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(v);
  return isNaN(date.getTime()) ? null : date;
}

function classificarTier(linha) {
  const tipo = (linha.tipoDePagamento || '').toString().toLowerCase();
  const isCard = tipo === 'credit';

  const acessos30 = Number(linha.acessos30D || 0);
  const acessos90 = Number(linha.acessos90D || 0);
  const email90 = Number(linha.emailAberto90D || 0);
  const concluiuSempre = Number(linha.cursosConcluidosSempre || 0);

  const usou30d = acessos30 > 0;
  const usou90d = acessos90 > 0;
  const abriuEmail90d = email90 > 0;
  const temConclusao = concluiuSempre > 0;

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

const state = {
  dadosBrutos: [],
  dadosFiltradosPeriodo: [],
  dadosManuais: [],
  filtrosPeriodo: { inicio: null, fim: null },
  filtrosManuais: null,
  opcoes: {
    planos: [],
    formas: [],
    parcelas: [],
    tiers: ['A', 'B', 'C', 'D'],
    categoriaStatus: [],
    incomunicavel: [],
    emailOptOut: [],
    marketableStatus: [],
  },
};

function uniqueValues(list) {
  return [...new Set(list)];
}

function criarFiltrosManuaisDefault() {
  return {
    planosSelecionados: state.opcoes.planos,
    formasSelecionadas: state.opcoes.formas,
    parcelasSelecionadas: state.opcoes.parcelas,
    tiersSelecionados: state.opcoes.tiers,
    categoriaStatusSelecionados: state.opcoes.categoriaStatus,
    incomunicavelSelecionados: state.opcoes.incomunicavel,
    emailOptOutSelecionados: state.opcoes.emailOptOut,
    marketableStatusSelecionados: state.opcoes.marketableStatus,
    minAcessos30D: 0,
    minAcessos90D: 0,
    minCursosConcluidosSempre: 0,
    minCursosConcluidos30D: 0,
    minEmailAberto90D: 0,
  };
}

function inicializarDashboard(rawRows) {
  state.dadosBrutos = rawRows
    .filter((row) => row.idAluno)
    .map((row) => {
      const linha = {
        idAluno: row.idAluno,
        nome: row.nome,
        email: row.email,

        planoVigente: row.planoVigente,
        valorPlano: parseNumber(row.valorPlano),
        valorRenovacao: parseNumber(row.valorRenovacao),
        dataRenovacaoDate: parseBrDate(row.dataRenovacao),

        formaPagamento: row.formaPagamento || '',
        tipoDePagamento: row.tipoDePagamento || '',
        parcelas: parseNumber(row.parcelas),

        chargeId: row.chargeId || '',

        acessos30D: parseNumber(row.acessos30D),
        acessos90D: parseNumber(row.acessos90D),
        cursosConcluidosSempre: parseNumber(row.cursosConcluidosSempre),
        cursosConcluidos30D: parseNumber(row.cursosConcluidos30D),

        categoriaStatus: row.categoriaStatus || '',
        incomunicavel: row.incomunicavel || '',
        emailOptOut: row.emailOptOut || '',

        emailAberto30D: parseNumber(row.emailAberto30D),
        emailAberto90D: parseNumber(row.emailAberto90D),

        dataDoUltimoEnvioDeEmail: row.dataDoUltimoEnvioDeEmail || '',
        dataDaUltimaAberturaDeEmail: row.dataDaUltimaAberturaDeEmail || '',
        dataDoUltimoCliqueNoEmail: row.dataDoUltimoCliqueNoEmail || '',

        marketableStatus: row.marketableStatus || '',
      };

      linha.tier = classificarTier(linha);
      return linha;
    });

  const datas = state.dadosBrutos
    .map((l) => l.dataRenovacaoDate)
    .filter((d) => d instanceof Date && !isNaN(d));

  const dataMin = datas.length ? new Date(Math.min(...datas)) : new Date();
  const dataMax = datas.length ? new Date(Math.max(...datas)) : new Date();

  state.filtrosPeriodo.inicio = dataMin;
  state.filtrosPeriodo.fim = dataMax;

  state.opcoes.planos = uniqueValues(state.dadosBrutos.map((l) => l.planoVigente || ''));
  state.opcoes.formas = uniqueValues(state.dadosBrutos.map((l) => l.formaPagamento || ''));
  state.opcoes.parcelas = uniqueValues(state.dadosBrutos.map((l) => (l.parcelas || 0).toString()));
  state.opcoes.categoriaStatus = uniqueValues(state.dadosBrutos.map((l) => l.categoriaStatus || ''));
  state.opcoes.incomunicavel = uniqueValues(state.dadosBrutos.map((l) => l.incomunicavel || ''));
  state.opcoes.emailOptOut = uniqueValues(state.dadosBrutos.map((l) => l.emailOptOut || ''));
  state.opcoes.marketableStatus = uniqueValues(state.dadosBrutos.map((l) => l.marketableStatus || ''));

  state.filtrosManuais = criarFiltrosManuaisDefault();

  aplicarFiltroPeriodo();
}

Papa.parse('Renovação Automática Completa.csv', {
  download: true,
  header: true,
  skipEmptyLines: true,
  delimiter: ';',
  complete: (results) => inicializarDashboard(results.data),
});

function aplicarFiltroPeriodo() {
  const { inicio, fim } = state.filtrosPeriodo;
  state.dadosFiltradosPeriodo = state.dadosBrutos.filter((linha) => {
    const data = linha.dataRenovacaoDate;
    return data && data >= inicio && data <= fim;
  });
  aplicarFiltrosManuais();
  render();
}

function calcularKPIs() {
  const base = state.dadosFiltradosPeriodo;
  const total = base.length;
  const pagamentoCartao = base.filter((a) => {
    const forma = (a.formaPagamento || '').toLowerCase();
    return forma === 'cartao' || forma === 'cartão' || (a.tipoDePagamento || '').toLowerCase() === 'credit';
  }).length;
  const pagamentoPix = base.filter((a) => (a.formaPagamento || '').toLowerCase() === 'pix').length;
  const pagamentoBoleto = base.filter((a) => (a.formaPagamento || '').toLowerCase() === 'boleto').length;
  const pagamentoOutros = base.filter((a) => {
    const forma = (a.formaPagamento || '').toLowerCase();
    return !['cartao', 'cartão', 'pix', 'boleto'].includes(forma);
  }).length;

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
    criarKpiCard('Receita 20%', formatCurrency(kpis.receita20), 'kpi-highlight'),
  );

  headerEl.append(filtrosContainer, kpisGrid);
}

function calcularDadosTiers() {
  const dadosCartao = state.dadosFiltradosPeriodo.filter((aluno) => aluno.tier !== 'Outro');

  const grupos = {
    'Todos (Cartão)': dadosCartao,
    'Tier A': dadosCartao.filter((a) => a.tier === 'A'),
    'Tier B': dadosCartao.filter((a) => a.tier === 'B'),
    'Tier C': dadosCartao.filter((a) => a.tier === 'C'),
    'Tier D': dadosCartao.filter((a) => a.tier === 'D'),
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
    { titulo: 'Tier A (dourado)', classe: 'tier-a-row', descricao: 'Cartão, acessou último mês e já concluiu algum curso.' },
    { titulo: 'Tier B (verde)', classe: 'tier-b-row', descricao: 'Cartão, engajado em 90 dias (acesso ou email aberto) e com conclusão.' },
    { titulo: 'Tier C (azul)', classe: 'tier-c-row', descricao: 'Cartão com algum engajamento em 90 dias (acesso ou email).' },
    { titulo: 'Tier D (cinza)', classe: 'tier-d-row', descricao: 'Cartão frio, sem engajamento recente.' },
    { titulo: 'Todos (Cartão)', classe: 'tier-neutral-row', descricao: 'Recorte geral apenas com pagamentos via cartão.' },
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

  const outrosCount = state.dadosFiltradosPeriodo.filter((l) => l.tier === 'Outro').length;
  const outrosInfo = document.createElement('p');
  outrosInfo.className = 'sub';
  outrosInfo.textContent = `Registros fora do cartão (Outro): ${outrosCount}`;

  section.append(title, container, outrosInfo, renderLegendaTiers());
}

function aplicarFiltrosManuais() {
  const filtros = state.filtrosManuais || criarFiltrosManuaisDefault();
  const {
    planosSelecionados,
    formasSelecionadas,
    parcelasSelecionadas,
    tiersSelecionados,
    categoriaStatusSelecionados,
    incomunicavelSelecionados,
    emailOptOutSelecionados,
    marketableStatusSelecionados,
    minAcessos30D,
    minAcessos90D,
    minCursosConcluidosSempre,
    minCursosConcluidos30D,
    minEmailAberto90D,
  } = filtros;

  const matchMulti = (lista, valor) => {
    if (!lista || !lista.length) return true;
    return lista.includes(valor ?? '');
  };

  state.dadosManuais = state.dadosFiltradosPeriodo.filter((aluno) => {
    if (!matchMulti(planosSelecionados, aluno.planoVigente || '')) return false;
    if (!matchMulti(formasSelecionadas, aluno.formaPagamento || '')) return false;
    if (!matchMulti(parcelasSelecionadas, (aluno.parcelas || 0).toString())) return false;
    if (!matchMulti(tiersSelecionados, aluno.tier)) return false;
    if (!matchMulti(categoriaStatusSelecionados, aluno.categoriaStatus || '')) return false;
    if (!matchMulti(incomunicavelSelecionados, aluno.incomunicavel || '')) return false;
    if (!matchMulti(emailOptOutSelecionados, aluno.emailOptOut || '')) return false;
    if (!matchMulti(marketableStatusSelecionados, aluno.marketableStatus || '')) return false;

    if (aluno.acessos30D < minAcessos30D) return false;
    if (aluno.acessos90D < minAcessos90D) return false;
    if (aluno.cursosConcluidosSempre < minCursosConcluidosSempre) return false;
    if (aluno.cursosConcluidos30D < minCursosConcluidos30D) return false;
    if (aluno.emailAberto90D < minEmailAberto90D) return false;

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

    const ensureSelection = () => {
      const selected = Array.from(select.selectedOptions).map((o) => o.value);
      if (!selected.length) {
        Array.from(select.options).forEach((optEl) => {
          optEl.selected = true;
        });
        return options;
      }
      return selected;
    };

    select.addEventListener('change', () => {
      const selected = ensureSelection();
      state.filtrosManuais = {
        ...state.filtrosManuais,
        [key]: selected,
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
    createSelect('Tier (cartão)', state.opcoes.tiers, 'tiersSelecionados'),
    createSelect('Categoria / status do aluno', state.opcoes.categoriaStatus, 'categoriaStatusSelecionados'),
    createSelect('Incomunicável', state.opcoes.incomunicavel, 'incomunicavelSelecionados'),
    createSelect('Email Opt-out', state.opcoes.emailOptOut, 'emailOptOutSelecionados'),
    createSelect('Marketable status', state.opcoes.marketableStatus, 'marketableStatusSelecionados'),
    createNumberInput('Mínimo Acessos 30D', 'minAcessos30D', 0),
    createNumberInput('Mínimo Acessos 90D', 'minAcessos90D', 0),
    createNumberInput('Mínimo Cursos Concluídos (Sempre)', 'minCursosConcluidosSempre', 0),
    createNumberInput('Mínimo Cursos Concluídos (30D)', 'minCursosConcluidos30D', 0),
    createNumberInput('Mínimo Emails Abertos 90D', 'minEmailAberto90D', 0),
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
      <th>Email</th>
      <th>Plano vigente</th>
      <th>Valor Renovação</th>
      <th>Data de renovação</th>
      <th>Forma de pagamento</th>
      <th>Tipo de pagamento</th>
      <th>Parcelas</th>
      <th>Acessos 30D</th>
      <th>Acessos 90D</th>
      <th>Cursos Concluídos (Sempre)</th>
      <th>Cursos Concluídos (30D)</th>
      <th>Emails Abertos 90D</th>
      <th>Categoria Status</th>
      <th>Incomunicável</th>
      <th>Email Opt-out</th>
      <th>Marketable Status</th>
      <th>Tier</th>
    </tr>`;

  const tbody = document.createElement('tbody');
  const limite = 100;
  state.dadosManuais.slice(0, limite).forEach((aluno) => {
    const dataRenovacao = aluno.dataRenovacaoDate instanceof Date && !isNaN(aluno.dataRenovacaoDate)
      ? aluno.dataRenovacaoDate.toLocaleDateString('pt-BR')
      : '-';

    const risco = aluno.incomunicavel && aluno.incomunicavel.toLowerCase() === 'sim' ? 'tag-risk' : '';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${aluno.idAluno || '-'}</td>
      <td>${aluno.nome || '-'}</td>
      <td>${aluno.email || '-'}</td>
      <td>${aluno.planoVigente || '-'}</td>
      <td class="money">${formatCurrency(aluno.valorRenovacao)}</td>
      <td>${dataRenovacao}</td>
      <td>${aluno.formaPagamento || '-'}</td>
      <td>${aluno.tipoDePagamento || '-'}</td>
      <td>${aluno.parcelas || '-'}</td>
      <td>${aluno.acessos30D}</td>
      <td>${aluno.acessos90D}</td>
      <td>${aluno.cursosConcluidosSempre}</td>
      <td>${aluno.cursosConcluidos30D}</td>
      <td>${aluno.emailAberto90D}</td>
      <td>${aluno.categoriaStatus || '-'}</td>
      <td class="${risco}">${aluno.incomunicavel || '-'}</td>
      <td>${aluno.emailOptOut || '-'}</td>
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
