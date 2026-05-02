// ═══════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════
const pageTitles = { dashboard:'Dashboard', agenda:'Agenda', perfis:'Perfis de Acesso', pacientes:'Pacientes', profissionais:'Profissionais', planos:'Planos de Saúde', procedimentos:'Tabela de Preços', tiss:'Guias SADT', lotes:'Lotes TISS', senhas:'Senhas & Autorizações', espera:'Lista de Espera', historico:'Histórico do Paciente', importar:'Importar Agenda', relatorios:'Relatórios', config:'Configurações', fechamento:'Fechamento Mensal', usuarios:'Usuários & Acesso', perfis:'Perfis de Acesso', 'conecta-agenda':'Agendamento de Salas', 'conecta-profissionais':'Profissionais Locatários', 'conecta-fechamento':'Fechamento de Locação' };
function gotoPage(page, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pageEl = document.getElementById('page-' + page);
  if (!pageEl) { console.warn('Página não encontrada: page-' + page); return; }
  pageEl.classList.add('active');
  if (el) el.classList.add('active');
  document.getElementById('topbar-title').textContent = pageTitles[page] || page;
  if (page === 'config')    try { initConfigPage(); } catch(e) {}
  if (page === 'conecta-fechamento') try { renderHistoricoFechamentos(); } catch(e) {}
  if (page === 'perfis')    try { renderPerfisLista(); } catch(e) { console.warn(e); }
  if (page === 'usuarios')  try { renderUsuarios(); } catch(e) { console.warn(e); }
  if (page === 'importar')  try { selecionarTipoImport(IMP_TIPO, document.getElementById('imp-tipo-'+IMP_TIPO)); } catch(e) {}
  if (page === 'senhas')    try { renderSenhas(); } catch(e) {}
  if (page === 'espera')    try { renderEsperaTable(); } catch(e) {}
  if (page === 'historico') try { renderHistPacList(); } catch(e) {}
  if (page === 'dashboard') try { renderDashboard(); } catch(e) {}
  if (page === 'relatorios') try { renderRelatorios(); } catch(e) {}
  // Espaço Conecta
  if (page === 'conecta-agenda')        try { conectaRenderAgenda(); } catch(e) {}
  if (page === 'conecta-profissionais') try { conectaRenderLocatarios(); } catch(e) {}
}

// ═══════════════════════════════════════
//  INIT
// ═══════════════════════════════════════

// ═══════════════════════════════════════
//  REFRESH CENTRAL — atualiza toda a UI
//  Chamada após qualquer operação de
//  escrita (salvar, excluir, importar)
// ═══════════════════════════════════════
function refreshUI(opts = {}) {
  // opts.skipHistorico = true → não re-abre o histórico (evita piscar quando não necessário)
  const safe = fn => { try { window[fn] && window[fn](); } catch(e) {} };

  safe('renderDashboard');
  safe('updateNavBadges');
  safe('renderPacientesTable');
  safe('renderProfissionaisTable');
  safe('renderPlanosGrid');
  safe('renderProcedimentosTable');
  safe('renderGuiasList');
  safe('renderLotesTable');
  safe('renderSenhas');
  safe('renderEsperaTable');
  safe('buildProfFilters');
  safe('populateSelects');
  // Carrega perfis de acesso persistidos
  if (typeof _carregarPerfisLocal === 'function') _carregarPerfisLocal();
  // Carrega bloqueios persistidos
  if (typeof _carregarBloqueiosLocal === 'function') _carregarBloqueiosLocal();
  // Carrega dados do Espaço Conecta do localStorage
  if (typeof _conectaCarregarLocal === 'function') _conectaCarregarLocal();
  safe('renderAgenda');
  safe('renderRelatorios');
  safe('renderSidebarLogo');

  // Histórico do paciente: re-abre o que estava aberto
  if (!opts.skipHistorico && historicoAtualPacId) {
    try {
      abrirHistPaciente(historicoAtualPacId);
      const activeTab = document.querySelector('#hist-tabs-area .imp-tab.active');
      const tabName = activeTab?.id?.replace('htab-', '') || 'linha';
      histTab(tabName, activeTab);
    } catch(e) {}
  }
}

// ═══════════════════════════════════════
//  TEMAS — definições e aplicação
// ═══════════════════════════════════════
const TEMAS = {
  'dark': {
    '--bg-base':       '#0f1117',
    '--bg-surface':    '#161b27',
    '--bg-raised':     '#1e2535',
    '--bg-overlay':    '#242c3d',
    '--border':        'rgba(255,255,255,0.07)',
    '--border-mid':    'rgba(255,255,255,0.12)',
    '--text-primary':  '#eef0f6',
    '--text-secondary':'#8b92a8',
    '--text-muted':    '#555d74',
    '--accent':        '#4f8ef7',
    '--accent-glow':   'rgba(79,142,247,0.18)',
    '--accent-soft':   'rgba(79,142,247,0.12)',
    '--success':       '#34d399',
    '--warning':       '#fbbf24',
    '--danger':        '#f87171',
    '--info':          '#60a5fa',
    '--shadow-sm':     '0 1px 3px rgba(0,0,0,0.4)',
    '--shadow-md':     '0 4px 16px rgba(0,0,0,0.35)',
    '--shadow-lg':     '0 8px 32px rgba(0,0,0,0.5)',
  },
  'dark-purple': {
    '--bg-base':       '#0e0f1a',
    '--bg-surface':    '#14162b',
    '--bg-raised':     '#1c1f36',
    '--bg-overlay':    '#232645',
    '--border':        'rgba(255,255,255,0.07)',
    '--border-mid':    'rgba(255,255,255,0.12)',
    '--text-primary':  '#e2e4f0',
    '--text-secondary':'#8b8fad',
    '--text-muted':    '#555872',
    '--accent':        '#8b5cf6',
    '--accent-glow':   'rgba(139,92,246,0.18)',
    '--accent-soft':   'rgba(139,92,246,0.12)',
    '--success':       '#34d399',
    '--warning':       '#fbbf24',
    '--danger':        '#f87171',
    '--info':          '#a78bfa',
    '--shadow-sm':     '0 1px 3px rgba(0,0,0,0.4)',
    '--shadow-md':     '0 4px 16px rgba(0,0,0,0.35)',
    '--shadow-lg':     '0 8px 32px rgba(0,0,0,0.5)',
  },
  'dark-green': {
    '--bg-base':       '#0a1210',
    '--bg-surface':    '#0f1f1c',
    '--bg-raised':     '#162924',
    '--bg-overlay':    '#1c342e',
    '--border':        'rgba(255,255,255,0.07)',
    '--border-mid':    'rgba(255,255,255,0.12)',
    '--text-primary':  '#d1fae5',
    '--text-secondary':'#7aad99',
    '--text-muted':    '#3d6b5a',
    '--accent':        '#10b981',
    '--accent-glow':   'rgba(16,185,129,0.18)',
    '--accent-soft':   'rgba(16,185,129,0.12)',
    '--success':       '#34d399',
    '--warning':       '#fbbf24',
    '--danger':        '#f87171',
    '--info':          '#6ee7b7',
    '--shadow-sm':     '0 1px 3px rgba(0,0,0,0.4)',
    '--shadow-md':     '0 4px 16px rgba(0,0,0,0.35)',
    '--shadow-lg':     '0 8px 32px rgba(0,0,0,0.5)',
  },
  'dark-amber': {
    '--bg-base':       '#110e08',
    '--bg-surface':    '#1c170e',
    '--bg-raised':     '#26200f',
    '--bg-overlay':    '#312816',
    '--border':        'rgba(255,255,255,0.07)',
    '--border-mid':    'rgba(255,255,255,0.12)',
    '--text-primary':  '#fef3c7',
    '--text-secondary':'#b8a070',
    '--text-muted':    '#6b5a30',
    '--accent':        '#f59e0b',
    '--accent-glow':   'rgba(245,158,11,0.18)',
    '--accent-soft':   'rgba(245,158,11,0.12)',
    '--success':       '#34d399',
    '--warning':       '#fb923c',
    '--danger':        '#f87171',
    '--info':          '#fcd34d',
    '--shadow-sm':     '0 1px 3px rgba(0,0,0,0.4)',
    '--shadow-md':     '0 4px 16px rgba(0,0,0,0.35)',
    '--shadow-lg':     '0 8px 32px rgba(0,0,0,0.5)',
  },
  'light': {
    '--bg-base':       '#f0f4fb',
    '--bg-surface':    '#ffffff',
    '--bg-raised':     '#f5f7fc',
    '--bg-overlay':    '#eaeff8',
    '--border':        'rgba(0,0,0,0.08)',
    '--border-mid':    'rgba(0,0,0,0.14)',
    '--text-primary':  '#1e293b',
    '--text-secondary':'#475569',
    '--text-muted':    '#94a3b8',
    '--accent':        '#3b82f6',
    '--accent-glow':   'rgba(59,130,246,0.15)',
    '--accent-soft':   'rgba(59,130,246,0.1)',
    '--success':       '#059669',
    '--warning':       '#d97706',
    '--danger':        '#dc2626',
    '--info':          '#2563eb',
    '--shadow-sm':     '0 1px 3px rgba(0,0,0,0.1)',
    '--shadow-md':     '0 4px 16px rgba(0,0,0,0.1)',
    '--shadow-lg':     '0 8px 32px rgba(0,0,0,0.15)',
  },
  'light-neutral': {
    '--bg-base':       '#f8f9fa',
    '--bg-surface':    '#ffffff',
    '--bg-raised':     '#f1f3f5',
    '--bg-overlay':    '#e9ecef',
    '--border':        'rgba(0,0,0,0.08)',
    '--border-mid':    'rgba(0,0,0,0.14)',
    '--text-primary':  '#212529',
    '--text-secondary':'#495057',
    '--text-muted':    '#adb5bd',
    '--accent':        '#6366f1',
    '--accent-glow':   'rgba(99,102,241,0.15)',
    '--accent-soft':   'rgba(99,102,241,0.1)',
    '--success':       '#059669',
    '--warning':       '#d97706',
    '--danger':        '#dc2626',
    '--info':          '#4f46e5',
    '--shadow-sm':     '0 1px 3px rgba(0,0,0,0.08)',
    '--shadow-md':     '0 4px 16px rgba(0,0,0,0.1)',
    '--shadow-lg':     '0 8px 32px rgba(0,0,0,0.12)',
  },
};

function aplicarTema(id) {
  const tema = TEMAS[id];
  if (!tema) return;
  const root = document.documentElement;
  Object.entries(tema).forEach(([k, v]) => root.style.setProperty(k, v));
  // Salva no localStorage
  localStorage.setItem('cf_tema', id);
  // Atualiza bordas dos cards de tema e checkmarks
  Object.keys(TEMAS).forEach(t => {
    const card  = document.getElementById('theme-' + t);
    const check = document.getElementById('theme-' + t + '-check');
    const accentColor = TEMAS[t]['--accent'];
    if (card)  card.style.border  = t === id ? '2px solid ' + accentColor : '2px solid rgba(128,128,128,0.2)';
    if (check) check.style.display = t === id ? 'inline' : 'none';
  });
  // Reaplica gradientes do login com nova cor de accent
  const acc = tema['--accent'];
  const accR = parseInt(acc.replace('#','').slice(0,2)||'4f',16);
  const accG = parseInt(acc.replace('#','').slice(2,4)||'8e',16);
  const accB = parseInt(acc.replace('#','').slice(4,6)||'f7',16);
  root.style.setProperty('--accent-glow', `rgba(${accR},${accG},${accB},0.18)`);
  root.style.setProperty('--accent-soft', `rgba(${accR},${accG},${accB},0.12)`);
}

function carregarTemaSalvo() {
  const id = localStorage.getItem('cf_tema') || 'dark';
  aplicarTema(id);
}

