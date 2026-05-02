//  MÓDULO: PERFIS DE ACESSO PERSONALIZADOS
// ═══════════════════════════════════════════════════════════════════════════

// Mapa de todos os módulos/itens de menu disponíveis no sistema
const MODULOS_SISTEMA = [
  {
    secao: 'Principal',
    itens: [
      { id:'dashboard',    label:'Dashboard',            desc:'Visão geral e indicadores',       icon:'📊', navPage:'dashboard' },
      { id:'agenda',       label:'Agenda',               desc:'Agendamentos e calendário',        icon:'📅', navPage:'agenda' },
      { id:'chat',         label:'Chat com Pacientes',   desc:'Mensagens e comunicação',          icon:'💬', navItem:'nav-chat-item' },
    ]
  },
  {
    secao: 'Cadastros',
    navSection: 'nav-admin-section',
    itens: [
      { id:'pacientes',       label:'Pacientes',          desc:'Cadastro e prontuário',            icon:'👥', navPage:'pacientes' },
      { id:'profissionais',   label:'Profissionais',      desc:'Cadastro de profissionais',        icon:'👨‍⚕️', navPage:'profissionais' },
      { id:'planos',          label:'Planos de Saúde',    desc:'Convênios e operadoras',           icon:'💳', navPage:'planos' },
      { id:'procedimentos',   label:'Tabela de Preços',   desc:'Procedimentos e valores',          icon:'📋', navPage:'procedimentos' },
      { id:'espera',          label:'Lista de Espera',    desc:'Fila de espera de pacientes',      icon:'⏳', navPage:'espera' },
      { id:'historico',       label:'Histórico Paciente', desc:'Histórico de atendimentos',        icon:'🔄', navPage:'historico' },
    ]
  },
  {
    secao: 'Faturamento',
    navSection: 'nav-fatur-section',
    itens: [
      { id:'tiss',     label:'Guias SADT',            desc:'Emissão e gestão de guias',        icon:'📄', navPage:'tiss' },
      { id:'senhas',   label:'Senhas / Autorizações', desc:'Controle de autorizações',         icon:'🔐', navPage:'senhas' },
      { id:'lotes',    label:'Lotes TISS',            desc:'Envio de lotes ao convênio',       icon:'📦', navPage:'lotes' },
    ]
  },
  {
    secao: 'Espaço Conecta',
    navSection: 'nav-conecta-section',
    itens: [
      { id:'conecta-agenda',        label:'Agendamento de Salas',      desc:'Reserva de salas e espaços',   icon:'🏢', navPage:'conecta-agenda' },
      { id:'conecta-profissionais', label:'Profissionais Locatários',  desc:'Gestão de locatários',         icon:'👤', navPage:'conecta-profissionais' },
      { id:'conecta-fechamento',    label:'Fechamento de Locação',     desc:'Relatórios e fechamentos',     icon:'💰', navPage:'conecta-fechamento' },
    ]
  },
  {
    secao: 'Sistema',
    navSection: 'nav-config-section',
    itens: [
      { id:'importar',   label:'Importar Agenda',   desc:'Importação de dados externos',     icon:'📥', navPage:'importar' },
      { id:'relatorios', label:'Relatórios',         desc:'Relatórios e análises',            icon:'📈', navPage:'relatorios' },
      { id:'fechamento', label:'Fechamento Mensal',  desc:'Fechamento financeiro mensal',     icon:'💵', navPage:'fechamento' },
      { id:'config',     label:'Configurações',      desc:'Configurações do sistema',         icon:'⚙️',  navPage:'config' },
      { id:'usuarios',   label:'Usuários & Acesso',  desc:'Gestão de usuários',               icon:'👥', navPage:'usuarios' },
      { id:'perfis',     label:'Perfis de Acesso',   desc:'Perfis e permissões',              icon:'🛡️',  navPage:'perfis' },
    ]
  },
];

// Sub-permissões por módulo (ações que podem ser liberadas/bloqueadas individualmente)
const SUB_PERMS = {
  pacientes:     [ { id:'criar',    label:'Criar / Editar pacientes'    }, { id:'excluir', label:'Excluir pacientes'        }, { id:'prontuario', label:'Ver prontuário completo' } ],
  agenda:        [ { id:'criar',    label:'Criar agendamentos'          }, { id:'editar',  label:'Editar agendamentos'       }, { id:'excluir',    label:'Excluir agendamentos'    }, { id:'bloquear', label:'Bloquear agenda' } ],
  profissionais: [ { id:'criar',    label:'Criar / Editar profissionais'}, { id:'excluir', label:'Excluir profissionais'     } ],
  tiss:          [ { id:'criar',    label:'Criar guias SADT'            }, { id:'assinar', label:'Assinar / Autorizar guias'  }, { id:'excluir',    label:'Excluir guias'           } ],
  relatorios:    [ { id:'financeiro', label:'Relatórios financeiros'    }, { id:'exportar', label:'Exportar dados'           } ],
  usuarios:      [ { id:'criar',    label:'Criar usuários'              }, { id:'editar',  label:'Editar usuários'           }, { id:'excluir',    label:'Excluir usuários'        } ],
};

// Cores disponíveis para perfis
const PERFIL_CORES = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316','#64748b'];

// Storage
let PERFIS_ACESSO = [];
let _perfilEditandoId = null;
let _perfilSelecionadoId = null;

function _salvarPerfisLocal() {
  try { localStorage.setItem('cf_perfis_acesso', JSON.stringify(PERFIS_ACESSO)); } catch(e) {}
}
function _carregarPerfisLocal() {
  try {
    const raw = localStorage.getItem('cf_perfis_acesso');
    if (raw) { PERFIS_ACESSO = JSON.parse(raw); }
  } catch(e) {}
  // Garante os 3 perfis base (não editáveis)
  _garantirPerfisBase();
}

function _garantirPerfisBase() {
  const BASE = [
    {
      id: '__admin__', nome: 'Administrador', cor: '#6366f1', bloqueado: true,
      desc: 'Acesso total ao sistema — não pode ser alterado',
      modulos: MODULOS_SISTEMA.flatMap(s => s.itens.map(i => i.id)),
      subPerms: Object.fromEntries(Object.entries(SUB_PERMS).map(([k,v]) => [k, v.map(p => p.id)])),
    },
    {
      id: '__recepcao__', nome: 'Recepção (padrão)', cor: '#10b981', bloqueado: true,
      desc: 'Agenda, pacientes e cadastros básicos',
      modulos: ['dashboard','agenda','chat','pacientes','planos','espera','senhas'],
      subPerms: { pacientes:['criar'], agenda:['criar','editar'] },
    },
    {
      id: '__prof__', nome: 'Profissional (padrão)', cor: '#f59e0b', bloqueado: true,
      desc: 'Agenda própria, prontuário e guias',
      modulos: ['dashboard','agenda','historico','tiss','chat'],
      subPerms: { agenda:['criar'], tiss:['criar'], pacientes:['prontuario'] },
    },
  ];
  BASE.forEach(base => {
    const idx = PERFIS_ACESSO.findIndex(p => p.id === base.id);
    if (idx === -1) {
      PERFIS_ACESSO.unshift(base);
    } else {
      // Sempre atualiza perfis base para garantir que novos módulos sejam incluídos
      PERFIS_ACESSO[idx] = { ...PERFIS_ACESSO[idx], ...base };
    }
  });
  // Persiste atualização
  try { localStorage.setItem('cf_perfis_acesso', JSON.stringify(PERFIS_ACESSO)); } catch(e) {}
}

// ── Render da lista de perfis ─────────────────────────────────────────────
function renderPerfisLista() {
  _carregarPerfisLocal();
  const el = document.getElementById('perfis-lista-body');
  const badge = document.getElementById('perfis-count-badge');
  if (!el) return;
  if (badge) badge.textContent = PERFIS_ACESSO.length;

  el.innerHTML = PERFIS_ACESSO.map(p => {
    const usersCount = (typeof USUARIOS !== 'undefined' ? USUARIOS : []).filter(u => u.perfilId === p.id || (p.id === '__admin__' && u.perfil === 'admin') || (p.id === '__recepcao__' && u.perfil === 'recepcao' && !u.perfilId) || (p.id === '__prof__' && u.perfil === 'prof' && !u.perfilId)).length;
    const isActive = p.id === _perfilSelecionadoId;
    return `<div class="perfil-item${isActive ? ' active' : ''}" onclick="selecionarPerfil('${p.id}')">
      <span class="perfil-item-dot" style="background:${p.cor||'#6366f1'}"></span>
      <div style="flex:1;min-width:0">
        <div class="perfil-item-name">${p.nome}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.desc||'Perfil personalizado'}</div>
      </div>
      <span class="perfil-item-badge">${usersCount} usr</span>
      ${p.bloqueado ? '<span class="perfil-item-lock" title="Perfil base — não editável">🔒</span>' : ''}
    </div>`;
  }).join('') || '<div class="perfil-empty-state"><span>Nenhum perfil</span></div>';

  if (_perfilSelecionadoId) {
    renderPerfisEditor(_perfilSelecionadoId);
  }
}

function selecionarPerfil(id) {
  _perfilSelecionadoId = id;
  renderPerfisLista();
}

// ── Editor de permissões ──────────────────────────────────────────────────
function renderPerfisEditor(perfilId) {
  const col = document.getElementById('perfis-editor-content');
  if (!col) return;
  const perfil = PERFIS_ACESSO.find(p => p.id === perfilId);
  if (!perfil) return;

  const isBloqueado = !!perfil.bloqueado;
  const modulosAtivos = new Set(perfil.modulos || []);
  const subPermsAtivos = perfil.subPerms || {};

  const lockBadge = isBloqueado ? '<span style="font-size:10px;background:rgba(248,113,113,.1);color:#f87171;padding:2px 8px;border-radius:10px;border:1px solid rgba(248,113,113,.25)">🔒 Somente leitura</span>' : '';
  const editBtns = isBloqueado ? '' : '<div style="display:flex;gap:8px">'
    + '<button class="btn-sm btn-secondary" onclick="editarNomePerfil(\'' + perfilId + '\')" style="padding:6px 12px">'
    + '<svg viewBox="0 0 24 24" fill="currentColor" style="width:13px;height:13px"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>Renomear</button>'
    + '<button class="btn-sm" style="padding:6px 12px;background:rgba(248,113,113,.1);color:#f87171;border:1px solid rgba(248,113,113,.25)" onclick="excluirPerfil(\'' + perfilId + '\')">'
    + '<svg viewBox="0 0 24 24" fill="currentColor" style="width:13px;height:13px"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>Excluir</button>'
    + '</div>';
  let html = '<div class="perfis-editor-header">'
    + '<div>'
    + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">'
    + '<span style="width:14px;height:14px;border-radius:50%;background:' + (perfil.cor||'#6366f1') + ';display:inline-block;flex-shrink:0"></span>'
    + '<span style="font-size:16px;font-weight:600;color:var(--text-primary)">' + perfil.nome + '</span>'
    + lockBadge
    + '</div>'
    + '<div style="font-size:12px;color:var(--text-muted)">' + (perfil.desc||'') + '</div>'
    + '</div>'
    + editBtns
    + '</div>'
    + '<div class="perfis-editor-body" id="perfis-editor-body">';

  MODULOS_SISTEMA.forEach(secao => {
    html += `<div class="modulos-section-label">${secao.secao}</div><div class="modulos-grid">`;
    secao.itens.forEach(item => {
      const ativo = modulosAtivos.has(item.id);
      const subs = SUB_PERMS[item.id] || [];
      const subAtivos = new Set(subPermsAtivos[item.id] || []);
      const disabledAttr = isBloqueado ? 'disabled' : '';
      const toggleId = `toggle-mod-${perfilId.replace(/[^a-z0-9]/gi,'_')}-${item.id}`;
      const clickHandler = isBloqueado ? '' : "toggleModulo('" + perfilId + "','" + item.id + "')";
      html += '<div class="modulo-card' + (ativo ? ' enabled' : '') + '" id="mcard-' + perfilId.replace(/[^a-z0-9]/gi,'_') + '-' + item.id + '">'
        + '<div class="modulo-card-header" onclick="' + clickHandler + '">'
        + '<div class="modulo-card-icon" style="background:' + (ativo ? 'rgba(99,102,241,.12)' : 'var(--bg-overlay)') + '">' + item.icon + '</div>'
        + '<div class="modulo-card-info">'
        + '<div class="modulo-card-title">' + item.label + '</div>'
        + '<div class="modulo-card-desc">' + item.desc + '</div>'
        + '</div>'
        + '<label class="modulo-toggle" onclick="event.stopPropagation()">'
        + '<input type="checkbox" id="' + toggleId + '" ' + (ativo ? 'checked' : '') + ' ' + disabledAttr
        + ' onchange="' + clickHandler + '">'
        + '<span class="modulo-toggle-slider"></span>'
        + '</label>'
        + '</div>';
      if (subs.length && ativo) {
        html += `<div class="modulo-sub-perms">`;
        subs.forEach(sp => {
          const spAtivo = subAtivos.has(sp.id);
          const subChange = isBloqueado ? '' : "toggleSubPerm('" + perfilId + "','" + item.id + "','" + sp.id + "',this.checked)";
        html += '<label class="sub-perm-row">'
          + '<input type="checkbox" ' + (spAtivo ? 'checked' : '') + ' ' + disabledAttr + ' onchange="' + subChange + '">'
          + sp.label
          + '</label>';
        });
        html += `</div>`;
      }
      html += `</div>`;
    });
    html += `</div>`;
  });

  html += `</div>`;
  if (!isBloqueado) {
    html += '<div class="perfis-editor-footer">'
      + '<button class="btn-sm btn-accent" onclick="salvarPermissoesPerfil(\'' + perfilId + '\')">'
      + '<svg viewBox="0 0 24 24" fill="currentColor" style="width:13px;height:13px"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>'
      + 'Salvar permissões</button>'
      + '<span style="font-size:12px;color:var(--text-muted)" id="perfis-save-hint"></span>'
      + '</div>';
  }

  col.innerHTML = html;
}

// ── Toggle módulo ────────────────────────────────────────────────────────
function toggleModulo(perfilId, moduloId) {
  const perfil = PERFIS_ACESSO.find(p => p.id === perfilId);
  if (!perfil || perfil.bloqueado) return;
  if (!perfil.modulos) perfil.modulos = [];
  const idx = perfil.modulos.indexOf(moduloId);
  if (idx > -1) {
    perfil.modulos.splice(idx, 1);
    // Remove sub-perms
    if (perfil.subPerms) delete perfil.subPerms[moduloId];
  } else {
    perfil.modulos.push(moduloId);
    // Ativa todas as sub-perms por padrão
    const subs = SUB_PERMS[moduloId];
    if (subs) {
      if (!perfil.subPerms) perfil.subPerms = {};
      perfil.subPerms[moduloId] = subs.map(s => s.id);
    }
  }
  renderPerfisEditor(perfilId);
}

// ── Toggle sub-permissão ─────────────────────────────────────────────────
function toggleSubPerm(perfilId, moduloId, permId, checked) {
  const perfil = PERFIS_ACESSO.find(p => p.id === perfilId);
  if (!perfil || perfil.bloqueado) return;
  if (!perfil.subPerms) perfil.subPerms = {};
  if (!perfil.subPerms[moduloId]) perfil.subPerms[moduloId] = [];
  if (checked) {
    if (!perfil.subPerms[moduloId].includes(permId)) perfil.subPerms[moduloId].push(permId);
  } else {
    perfil.subPerms[moduloId] = perfil.subPerms[moduloId].filter(p => p !== permId);
  }
}

// ── Salvar permissões ────────────────────────────────────────────────────
function salvarPermissoesPerfil(perfilId) {
  _salvarPerfisLocal();
  const hint = document.getElementById('perfis-save-hint');
  if (hint) { hint.textContent = '✓ Salvo!'; setTimeout(() => { hint.textContent = ''; }, 2500); }
  showToast('Permissões do perfil salvas!', 'success');
  renderPerfisLista();
  _sincronizarPerfisSupabase();
}

// ── Novo perfil ──────────────────────────────────────────────────────────
function abrirNovoPerfil() {
  const nome = prompt('Nome do novo perfil:');
  if (!nome || !nome.trim()) return;
  const desc = prompt('Descrição curta (opcional):') || '';
  const cor  = PERFIL_CORES[Math.floor(Math.random() * PERFIL_CORES.length)];
  const id   = 'prf_' + Date.now();
  PERFIS_ACESSO.push({
    id, nome: nome.trim(), desc: desc.trim(), cor,
    bloqueado: false,
    modulos: ['dashboard', 'agenda'],
    subPerms: { agenda: ['criar','editar'] },
  });
  _salvarPerfisLocal();
  _perfilSelecionadoId = id;
  renderPerfisLista();
  showToast('Perfil "' + nome.trim() + '" criado! Configure os módulos ao lado.', 'success');
}

// ── Renomear perfil ──────────────────────────────────────────────────────
function editarNomePerfil(perfilId) {
  const perfil = PERFIS_ACESSO.find(p => p.id === perfilId);
  if (!perfil || perfil.bloqueado) return;
  const novoNome = prompt('Novo nome do perfil:', perfil.nome);
  if (!novoNome || !novoNome.trim()) return;
  const novaDesc = prompt('Nova descrição:', perfil.desc || '');
  perfil.nome = novoNome.trim();
  perfil.desc = (novaDesc || '').trim();
  _salvarPerfisLocal();
  renderPerfisLista();
}

// ── Excluir perfil ───────────────────────────────────────────────────────
function excluirPerfil(perfilId) {
  const perfil = PERFIS_ACESSO.find(p => p.id === perfilId);
  if (!perfil || perfil.bloqueado) { showToast('Perfis base não podem ser excluídos.', 'error'); return; }
  const usersVinc = (typeof USUARIOS !== 'undefined' ? USUARIOS : []).filter(u => u.perfilId === perfilId);
  if (usersVinc.length) {
    if (!confirm(`Este perfil está vinculado a ${usersVinc.length} usuário(s). Ao excluir, eles perderão as permissões personalizadas.

Deseja continuar?`)) return;
    usersVinc.forEach(u => { delete u.perfilId; });
    if (typeof salvarUsuariosLocal === 'function') salvarUsuariosLocal();
  }
  if (!confirm(`Excluir o perfil "${perfil.nome}"? Esta ação não pode ser desfeita.`)) return;
  const idx = PERFIS_ACESSO.findIndex(p => p.id === perfilId);
  PERFIS_ACESSO.splice(idx, 1);
  _salvarPerfisLocal();
  _perfilSelecionadoId = null;
  renderPerfisLista();
  // Reseta o editor
  const col = document.getElementById('perfis-editor-content');
  if (col) col.innerHTML = `<div class="perfil-empty-state" style="height:100%"><svg viewBox="0 0 24 24" fill="currentColor" style="width:48px;height:48px;opacity:.18"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg><span style="font-size:14px;font-weight:500">Selecione um perfil</span></div>`;
  showToast('Perfil excluído.', 'success');
}

// ── Aplicar permissões ao fazer login ────────────────────────────────────
function _aplicarPermissoesDePerfil(user) {
  if (!user) return;

  // Se MODULOS_SISTEMA ainda não foi definido (módulo de perfis carrega depois),
  // agenda para executar assim que o DOM terminar de carregar
  if (typeof MODULOS_SISTEMA === 'undefined') {
    setTimeout(() => _aplicarPermissoesDePerfil(user), 300);
    return;
  }

  try { _carregarPerfisLocal(); } catch(e) {}

  // Admin sem perfil customizado: acesso total — garante itens visíveis e retorna
  if (user.role === 'admin' && (!user.perfilId || user.perfilId === '__admin__')) {
    try {
      user.modulosPermitidos = MODULOS_SISTEMA.flatMap(s => s.itens.map(i => i.id));
      user.subPerms = Object.fromEntries(Object.entries(SUB_PERMS).map(([k,v]) => [k, v.map(p => p.id)]));
    } catch(e) {}
    // Força visibilidade de todos os nav-sections e itens para admin
    ['nav-admin-section','nav-config-section','nav-fatur-section','nav-conecta-section'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = '';
    });
    document.querySelectorAll('.nav-item[data-perfil-hidden]').forEach(el => {
      el.style.display = '';
      el.removeAttribute('data-perfil-hidden');
    });
    window.CURRENT_USER = user;
    return;
  }

  // Descobre qual perfil usar
  let perfil = null;
  if (user.perfilId) {
    perfil = PERFIS_ACESSO.find(p => p.id === user.perfilId);
  }
  // Fallback para perfis base conforme role
  if (!perfil) {
    const baseId = { admin:'__admin__', recepcao:'__recepcao__', prof:'__prof__' }[user.role];
    if (baseId) perfil = PERFIS_ACESSO.find(p => p.id === baseId);
  }
  if (!perfil) return; // sem perfil definido: não restringe

  const modulosAtivos = new Set(perfil.modulos || []);

  // Oculta itens de nav que não estão no perfil
  MODULOS_SISTEMA.forEach(secao => {
    // Verifica se todos os itens da seção estão desabilitados
    const algumAtivo = secao.itens.some(item => modulosAtivos.has(item.id));
    if (secao.navSection) {
      const secEl = document.getElementById(secao.navSection);
      if (secEl && !algumAtivo) { secEl.style.display = 'none'; }
    }
    secao.itens.forEach(item => {
      if (!modulosAtivos.has(item.id)) {
        // Esconde pelo navPage (busca nav-item com onclick contendo o page)
        const navEls = document.querySelectorAll(`.nav-item[onclick*="'${item.navPage}'"]`);
        navEls.forEach(el => { el.style.display = 'none'; el.setAttribute('data-perfil-hidden', '1'); });
        if (item.navItem) {
          const el2 = document.getElementById(item.navItem);
          if (el2) { el2.style.display = 'none'; el2.setAttribute('data-perfil-hidden', '1'); }
        }
      }
    });
  });

  // Salva permissões de módulo no currentUser para consultas posteriores
  user.modulosPermitidos = Array.from(modulosAtivos);
  user.subPerms = perfil.subPerms || {};
  window.CURRENT_USER = user;
}

// Verifica se o usuário atual tem permissão de sub-ação
function temPermissao(modulo, acao) {
  const cu = window.CURRENT_USER;
  if (!cu) return false;
  if (cu.role === 'admin' && (!cu.perfilId || cu.perfilId === '__admin__')) return true;
  if (!cu.modulosPermitidos || !cu.modulosPermitidos.includes(modulo)) return false;
  if (!acao) return true;
  const subs = (cu.subPerms || {})[modulo] || [];
  return subs.includes(acao);
}
window.temPermissao = temPermissao;

// ── Sync Supabase (opcional) ─────────────────────────────────────────────
async function _sincronizarPerfisSupabase() {
  const sb = window._cfGetDb ? window._cfGetDb() : null;
  if (!sb) return;
  try {
    await sb.from('perfis_acesso').upsert(
      PERFIS_ACESSO.filter(p => !p.bloqueado).map(p => ({
        id: p.id, nome: p.nome, desc: p.desc, cor: p.cor,
        modulos: JSON.stringify(p.modulos || []),
        sub_perms: JSON.stringify(p.subPerms || {}),
      }))
    );
  } catch(e) { console.warn('[ClinicFlow Perfis] Supabase sync falhou:', e); }
}

async function _carregarPerfisSupabase(sb) {
  try {
    const { data, error } = await sb.from('perfis_acesso').select('*').limit(200);
    if (error || !data) return;
    data.forEach(row => {
      const existing = PERFIS_ACESSO.find(p => p.id === row.id);
      const obj = {
        id: row.id, nome: row.nome, desc: row.desc || '', cor: row.cor || '#6366f1',
        bloqueado: false,
        modulos: typeof row.modulos === 'string' ? JSON.parse(row.modulos) : (row.modulos || []),
        subPerms: typeof row.sub_perms === 'string' ? JSON.parse(row.sub_perms) : (row.sub_perms || {}),
      };
      if (existing) Object.assign(existing, obj);
      else PERFIS_ACESSO.push(obj);
    });
    _salvarPerfisLocal();
  } catch(e) { console.warn('[ClinicFlow Perfis] Falha ao carregar do Supabase:', e); }
}
window._carregarPerfisSupabase = _carregarPerfisSupabase;
window._carregarPerfisLocal    = _carregarPerfisLocal;


// ── Helper: popula o select de perfil personalizado no modal usuário ─────
function _popularSelectPerfilCustom(perfilIdAtual) {
  if (typeof _carregarPerfisLocal === 'function') _carregarPerfisLocal();
  const sel = document.getElementById('usr-perfil-custom');
  if (!sel) return;
  const perfisCustom = (typeof PERFIS_ACESSO !== 'undefined' ? PERFIS_ACESSO : []).filter(p => !p.bloqueado);
  sel.innerHTML = '<option value="">— Usar permissões padrão do tipo —</option>' +
    perfisCustom.map(p =>
      `<option value="${p.id}" ${perfilIdAtual === p.id ? 'selected' : ''}>${p.nome}</option>`
    ).join('');
}

console.log('[ClinicFlow] Módulo Perfis de Acesso carregado ✓');


// ═══════════════════════════════════════════════════════════════════════════
