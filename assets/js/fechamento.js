//  BLOQUEIO DE AGENDA
// ═══════════════════════════════════════════════════════════════════════════

const BLOQUEIOS = []; // { id, profId, dataIni, dataFim, horaIni, horaFim, motivo, diaTodo }

// Verifica se um slot está bloqueado
function slotBloqueado(profId, dataISO, hora) {
  return BLOQUEIOS.some(b => {
    if (b.profId !== profId) return false;
    if (dataISO < b.dataIni || dataISO > b.dataFim) return false;
    if (b.diaTodo) return true;
    if (!b.horaIni || !b.horaFim) return true;
    return hora >= b.horaIni && hora < b.horaFim;
  });
}

// Retorna o bloqueio que cobre este slot (para exibir card)
function getBloqueioDoSlot(profId, dataISO, hora) {
  return BLOQUEIOS.find(b => {
    if (b.profId !== profId) return false;
    if (dataISO < b.dataIni || dataISO > b.dataFim) return false;
    if (b.diaTodo) return true;
    if (!b.horaIni || !b.horaFim) return true;
    return hora >= b.horaIni && hora < b.horaFim;
  });
}

// Verifica se todo o dia está bloqueado para um prof (para view semana/mês)
function diaBloqueadoParaProf(profId, dataISO) {
  return BLOQUEIOS.some(b =>
    b.profId === profId &&
    dataISO >= b.dataIni &&
    dataISO <= b.dataFim &&
    b.diaTodo
  );
}

function openModalBloqueio() {
  // Popula select de profissionais
  const sel = document.getElementById('blq-prof');
  sel.innerHTML = PROFISSIONAIS.filter(p => p.status !== 'Inativo')
    .map(p => `<option value="${p.id}">${p.nomeAgenda || p.nome}</option>`).join('');

  // Popula selects de hora
  ['blq-hora-ini','blq-hora-fim'].forEach(id => {
    const el = document.getElementById(id);
    el.innerHTML = '<option value="">— Dia todo —</option>' +
      HOURS.map(h => `<option value="${h}">${h}</option>`).join('');
  });

  // Datas padrão: data atual
  const today = currentDate.toISOString().split('T')[0];
  document.getElementById('blq-data-ini').value = today;
  document.getElementById('blq-data-fim').value = today;
  document.getElementById('blq-motivo').value   = '';
  document.getElementById('blq-dia-todo').checked = true;
  document.getElementById('blq-hora-ini').disabled = true;
  document.getElementById('blq-hora-fim').disabled = true;

  renderListaBloqueios();
  openModal('modal-bloqueio');
}

function blqToggleDiaTodo(cb) {
  const dis = cb.checked;
  document.getElementById('blq-hora-ini').disabled = dis;
  document.getElementById('blq-hora-fim').disabled = dis;
  // Mostra/oculta a linha de horas visualmente
  const horaRow = document.getElementById('blq-horas-row');
  if (horaRow) horaRow.style.opacity = dis ? '0.35' : '1';
  if (dis) {
    document.getElementById('blq-hora-ini').value = '';
    document.getElementById('blq-hora-fim').value = '';
  }
}

function salvarBloqueio() {
  const profId   = parseInt(document.getElementById('blq-prof').value);
  const dataIni  = document.getElementById('blq-data-ini').value;
  const dataFim  = document.getElementById('blq-data-fim').value;
  const motivo   = document.getElementById('blq-motivo').value.trim();
  const diaTodo  = document.getElementById('blq-dia-todo').checked;
  const horaIni  = diaTodo ? '' : document.getElementById('blq-hora-ini').value;
  const horaFim  = diaTodo ? '' : document.getElementById('blq-hora-fim').value;

  if (!profId)  { showToast('Selecione um profissional.', 'error'); return; }
  if (!dataIni) { showToast('Informe a data de início.', 'error'); return; }
  if (!dataFim) { showToast('Informe a data de fim.', 'error'); return; }
  if (dataFim < dataIni) { showToast('A data fim deve ser igual ou posterior à data início.', 'error'); return; }
  if (!diaTodo && (!horaIni || !horaFim)) { showToast('Informe as horas de início e fim ou marque "dia todo".', 'error'); return; }
  if (!diaTodo && horaFim <= horaIni) { showToast('A hora fim deve ser posterior à hora início.', 'error'); return; }

  // Verifica agendamentos existentes no período e avisa
  const prof = PROFISSIONAIS.find(p => p.id === profId);
  const conflitos = APPOINTMENTS.filter(a => {
    if (a.profId !== profId) return false;
    if (a.status === 'cancelado' || a.status === 'desmarcado') return false;
    if (a.dataISO < dataIni || a.dataISO > dataFim) return false;
    if (diaTodo) return true;
    if (!horaIni || !horaFim) return true;
    return a.hora >= horaIni && a.hora < horaFim;
  });

  const nextId = BLOQUEIOS.length ? Math.max(...BLOQUEIOS.map(b => b.id)) + 1 : 1;
  BLOQUEIOS.push({ id: nextId, profId, dataIni, dataFim, horaIni, horaFim, motivo, diaTodo });

  // Persiste em localStorage
  _salvarBloqueiosLocal();

  const profNome = prof?.nomeAgenda || prof?.nome || 'Profissional';
  const msg = conflitos.length > 0
    ? `Agenda bloqueada! ⚠ Atenção: há ${conflitos.length} agendamento(s) no período. Os existentes NÃO foram removidos automaticamente.`
    : `Agenda de ${profNome} bloqueada com sucesso!`;
  showToast(msg, conflitos.length > 0 ? 'warning' : 'success');

  renderListaBloqueios();
  renderAgenda();

  // Salva no Supabase se disponível
  _syncBloqueioSupabase({ id: nextId, profId, dataIni, dataFim, horaIni, horaFim, motivo, diaTodo }, 'insert');
}

function removerBloqueio(id) {
  const idx = BLOQUEIOS.findIndex(b => b.id === id);
  if (idx === -1) return;
  if (!confirm('Remover este bloqueio? O período ficará disponível para agendamentos.')) return;
  const [removed] = BLOQUEIOS.splice(idx, 1);
  _salvarBloqueiosLocal();
  showToast('Bloqueio removido. Período liberado para agendamentos.', 'success');
  renderListaBloqueios();
  renderAgenda();
  _syncBloqueioSupabase(removed, 'delete');
}

function renderListaBloqueios() {
  const el = document.getElementById('blq-lista');
  if (!el) return;
  if (!BLOQUEIOS.length) {
    el.innerHTML = '<div style="padding:12px 0;font-size:13px;color:var(--text-muted);text-align:center">Nenhum bloqueio cadastrado</div>';
    return;
  }
  // Ordena por data início
  const sorted = [...BLOQUEIOS].sort((a,b) => a.dataIni.localeCompare(b.dataIni));
  el.innerHTML = sorted.map(b => {
    const prof = PROFISSIONAIS.find(p => p.id === b.profId);
    const profNome = prof?.nomeAgenda || prof?.nome || 'Profissional';
    const periodo = b.dataIni === b.dataFim
      ? formatDateBR(b.dataIni)
      : `${formatDateBR(b.dataIni)} → ${formatDateBR(b.dataFim)}`;
    const horario = b.diaTodo ? 'Dia todo' : `${b.horaIni} – ${b.horaFim}`;
    const isVencido = b.dataFim < new Date().toISOString().split('T')[0];
    return `<div class="bloqueio-periodo-row" style="${isVencido?'opacity:.5':''}">
      <span style="width:10px;height:10px;border-radius:50%;background:${prof?.cor||'#f87171'};flex-shrink:0"></span>
      <div style="min-width:0">
        <div style="font-size:13px;font-weight:500;color:var(--text-primary)">${profNome}</div>
        <div style="font-size:11px;color:var(--text-muted)">${periodo} · ${horario}${b.motivo?' · '+b.motivo:''}${isVencido?' · <span style="color:#f87171">Vencido</span>':''}</div>
      </div>
      <button class="bloqueio-remove-btn" onclick="removerBloqueio(${b.id})">Remover</button>
    </div>`;
  }).join('');
}

function formatDateBR(iso) {
  if (!iso) return '';
  const [y,m,d] = iso.split('-');
  return d+'/'+m+'/'+y;
}

// Persiste bloqueios em localStorage
function _salvarBloqueiosLocal() {
  try { localStorage.setItem('cf_bloqueios', JSON.stringify(BLOQUEIOS)); } catch(e) {}
}

// Carrega bloqueios do localStorage ao iniciar
function _carregarBloqueiosLocal() {
  try {
    const raw = localStorage.getItem('cf_bloqueios');
    if (raw) {
      const arr = JSON.parse(raw);
      BLOQUEIOS.length = 0;
      arr.forEach(b => BLOQUEIOS.push(b));
    }
  } catch(e) {}
}

// Sync Supabase para tabela bloqueios_agenda (opcional)
async function _syncBloqueioSupabase(bloqueio, op) {
  const sb = window._cfGetDb ? window._cfGetDb() : null;
  if (!sb) return;
  try {
    if (op === 'insert') {
      await sb.from('bloqueios_agenda').insert([{
        prof_id:   bloqueio.profId,
        data_ini:  bloqueio.dataIni,
        data_fim:  bloqueio.dataFim,
        hora_ini:  bloqueio.horaIni || null,
        hora_fim:  bloqueio.horaFim || null,
        dia_todo:  bloqueio.diaTodo,
        motivo:    bloqueio.motivo || null,
      }]);
    } else if (op === 'delete') {
      await sb.from('bloqueios_agenda').delete().eq('id', bloqueio.id);
    }
  } catch(e) {
    console.warn('[ClinicFlow Bloqueio] Supabase sync falhou:', e);
  }
}

// Carrega bloqueios do Supabase
async function _carregarBloqueiosSupabase(sb) {
  try {
    const { data, error } = await sb.from('bloqueios_agenda').select('*').limit(5000);
    // Tabela pode não existir ainda (código PGRST200/42P01) — ignora silenciosamente
    if (error) {
      if (error.code === 'PGRST200' || error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('not found')) {
        _carregarBloqueiosLocal();
        return;
      }
      throw error;
    }
    if (!data) return;
    BLOQUEIOS.length = 0;
    data.forEach(row => BLOQUEIOS.push({
      id:      row.id,
      profId:  row.prof_id,
      dataIni: row.data_ini,
      dataFim: row.data_fim,
      horaIni: row.hora_ini || '',
      horaFim: row.hora_fim || '',
      diaTodo: row.dia_todo ?? true,
      motivo:  row.motivo || '',
    }));
    _salvarBloqueiosLocal();
  } catch(e) {
    // Silencia erros 404 da tabela opcional
    if (!String(e.message || '').includes('404')) {
      console.warn('[ClinicFlow Bloqueio] Falha ao carregar do Supabase:', e);
    }
    _carregarBloqueiosLocal(); // fallback local
  }
}

// Expõe para uso externo
window._carregarBloqueiosLocal  = _carregarBloqueiosLocal;
window._carregarBloqueiosSupabase = _carregarBloqueiosSupabase;
console.log('[ClinicFlow] Módulo Bloqueio de Agenda carregado ✓');

// ── Reset admin local (emergência) ──────────────────────────────────────────
function resetAdminLocal() {
  if (!confirm('Redefinir o usuário admin com email "admin" e senha "admin"?\n\nIsso substitui o admin atual no armazenamento local.')) return;
  try {
    let usuarios = JSON.parse(localStorage.getItem('cf_usuarios') || '[]');
    const admIdx = usuarios.findIndex(u => u.email === 'admin');
    const adminObj = {
      id: 'usr-1', nome: 'Administrador', email: 'admin',
      cpf: '', rg: '', tel: '', nasc: '', perfil: 'admin',
      status: 'Ativo', foto: '', senha: 'admin',
      criadoEm: new Date().toISOString()
    };
    if (admIdx > -1) usuarios[admIdx] = adminObj;
    else usuarios.unshift(adminObj);
    localStorage.setItem('cf_usuarios', JSON.stringify(usuarios));
    // Atualiza array em memória
    if (typeof USUARIOS !== 'undefined') {
      const mi = USUARIOS.findIndex(u => u.email === 'admin');
      if (mi > -1) USUARIOS[mi] = adminObj; else USUARIOS.unshift(adminObj);
    }
    alert('Admin redefinido! Use:\n  E-mail: admin\n  Senha: admin');
  } catch(e) {
    alert('Erro ao redefinir: ' + e.message);
  }
}

// ── Suporte a Enter na tela de login ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  ['login-email', 'login-pass'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
  });
});


// ═══════════════════════════════════════════════════════════════
//  FECHAMENTO MENSAL — MÓDULO COMPLETO
// ═══════════════════════════════════════════════════════════════

// Identifica se o agendamento é do tipo "Avaliação Neuropsicológica"
function isAvalNeuropsico(appt) {
  const campos = [appt.tipo, appt.tipoSessao, appt.obs, appt.procedimento, appt.descricao];
  const re = /aval[ia]+[çc][aã]o\s+neuro|AN ·|neuro.*aval|avalia[çc][aã]o\s+nps|avalia[çc][aã]o\s+neuropsico/i;
  return campos.some(c => c && re.test(String(c)));
}

function brlFmt(v) {
  return 'R$ ' + (v || 0).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
}

function renderFechamento() {
  const mesVal = document.getElementById('fech-mes')?.value;
  if (!mesVal) { showToast('Selecione o mês','error'); return; }

  const [ano, mes] = mesVal.split('-').map(Number);
  const D_PRIM = new Date(ano, mes - 1, 1);
  const D_ULT  = new Date(ano, mes, 0);
  const ISO_PRIM = D_PRIM.toISOString().slice(0,10);
  const ISO_ULT  = D_ULT.toISOString().slice(0,10);
  const mesLabel = D_PRIM.toLocaleDateString('pt-BR', {month:'long', year:'numeric'});

  // Filtra apenas atendimentos com status "atendido" no período
  const aptsAtend = APPOINTMENTS.filter(a =>
    a.status === 'atendido' &&
    a.dataISO >= ISO_PRIM && a.dataISO <= ISO_ULT
  );

  // ── Agrupa por profissional ──────────────────────────────────
  // Cada entrada: { prof, sessoes30:[], sessoes60:[], avals:[] }
  const porProf = {};

  aptsAtend.forEach(a => {
    const profId = a.profId;
    const prof   = PROFISSIONAIS.find(p => p.id === profId);
    if (!prof) return;

    if (!porProf[profId]) {
      porProf[profId] = { prof, sessoes30: [], sessoes60: [], avals: [] };
    }

    const dur = a.durMin || 30;

    if (isAvalNeuropsico(a)) {
      porProf[profId].avals.push(a);
    } else if (dur >= 60) {
      porProf[profId].sessoes60.push(a);
    } else {
      porProf[profId].sessoes30.push(a);
    }
  });

  // ── Avaliação neuropsicológica: apenas 1º atendimento por paciente/profissional ──
  Object.values(porProf).forEach(entry => {
    // Agrupa avaliações por paciente e mantém apenas o mais antigo
    const byPac = {};
    entry.avals.forEach(a => {
      if (!byPac[a.paciente] || a.dataISO < byPac[a.paciente].dataISO) {
        byPac[a.paciente] = a;
      }
    });
    entry.avalsContabilizadas = Object.values(byPac);
    // Mantém todas para exibição mas marca quais contam
    entry.avalsTotal = entry.avals.length;
  });

  // ── Calcula totais ───────────────────────────────────────────
  let totalGeralAtend = 0, totalGeralValor = 0;
  let totalGeralAval = 0, totalGeralValorAval = 0;

  const profs = Object.values(porProf).sort((a,b) => a.prof.nome.localeCompare(b.prof.nome));

  // ── KPIs ────────────────────────────────────────────────────
  profs.forEach(e => {
    const n30 = e.sessoes30.length, n60 = e.sessoes60.length;
    const v30 = e.prof.valor30 || 0, v60 = e.prof.valor60 || 0;
    e.totalSessoes  = n30 + n60;
    e.totalValorSess = n30 * v30 + n60 * v60;
    e.totalAvals    = e.avalsContabilizadas.length;
    e.totalValorAval = e.totalAvals * (e.prof.valorAval || 0);
    totalGeralAtend += e.totalSessoes;
    totalGeralValor += e.totalValorSess;
    totalGeralAval  += e.totalAvals;
    totalGeralValorAval += e.totalValorAval;
  });

  const totalGeral = totalGeralValor + totalGeralValorAval;

  // ── Renderiza KPIs ───────────────────────────────────────────
  const kpisEl = document.getElementById('fech-kpis');
  if (kpisEl) {
    kpisEl.style.display = '';
    kpisEl.innerHTML = `
      <div class="stat-card">
        <div class="stat-icon blue"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2z"/></svg></div>
        <div class="stat-label">Atendimentos no mês</div>
        <div class="stat-value">${totalGeralAtend}</div>
        <div class="stat-delta">${mesLabel}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg></div>
        <div class="stat-label">Valor total sessões</div>
        <div class="stat-value" style="font-size:22px">${brlFmt(totalGeralValor)}</div>
        <div class="stat-delta">${totalGeralAtend} atend. × valores cadastrados</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon yellow"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93s3.05-7.44 7-7.93v15.86z"/></svg></div>
        <div class="stat-label">Avaliações neuropsico.</div>
        <div class="stat-value">${totalGeralAval}</div>
        <div class="stat-delta">${brlFmt(totalGeralValorAval)} total</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon red"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg></div>
        <div class="stat-label">Total geral a receber</div>
        <div class="stat-value" style="font-size:22px;color:var(--success)">${brlFmt(totalGeral)}</div>
        <div class="stat-delta">Sessões + Avaliações</div>
      </div>`;
  }

  // ── Renderiza cards de terapeutas ────────────────────────────
  const profsComSessoes = profs.filter(e => e.totalSessoes > 0);
  const profsComAvals   = profs.filter(e => e.totalAvals > 0);

  const terapSection = document.getElementById('fech-terapeutas-section');
  const terapCards   = document.getElementById('fech-cards-terapeutas');
  const avalSection  = document.getElementById('fech-aval-section');
  const avalCards    = document.getElementById('fech-cards-aval');
  const emptyEl      = document.getElementById('fech-empty');
  const btnRel       = document.getElementById('btn-emitir-rel-fech');

  // Limpa
  if (terapCards)  terapCards.innerHTML  = '';
  if (avalCards)   avalCards.innerHTML   = '';

  if (profs.length === 0) {
    if (terapSection) terapSection.style.display = 'none';
    if (avalSection)  avalSection.style.display  = 'none';
    if (emptyEl)      emptyEl.style.display      = '';
    if (btnRel)       btnRel.style.display        = 'none';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';
  if (btnRel)  btnRel.style.display  = '';

  // ── Cards de sessões regulares ───────────────────────────────
  if (terapSection) terapSection.style.display = profsComSessoes.length ? '' : 'none';
  profsComSessoes.forEach(e => {
    const { prof, sessoes30, sessoes60 } = e;
    const n30 = sessoes30.length, n60 = sessoes60.length;
    const v30 = prof.valor30 || 0, v60 = prof.valor60 || 0;

    // Agrupa por plano
    const porPlano = {};
    [...sessoes30, ...sessoes60].forEach(a => {
      const pl = a.plano || 'Particular';
      if (!porPlano[pl]) porPlano[pl] = { n30: 0, n60: 0 };
      if ((a.durMin || 30) >= 60) porPlano[pl].n60++;
      else porPlano[pl].n30++;
    });

    const planoRows = Object.entries(porPlano).sort((a,b) => a[0].localeCompare(b[0])).map(([pl, c]) => {
      const vpl = c.n30 * v30 + c.n60 * v60;
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px">
        <div style="color:var(--text-secondary)">${pl}</div>
        <div style="display:flex;gap:16px;align-items:center">
          ${c.n30 > 0 ? `<span style="color:var(--text-muted)">${c.n30}× 30min</span>` : ''}
          ${c.n60 > 0 ? `<span style="color:var(--text-muted)">${c.n60}× 60min</span>` : ''}
          <span style="font-weight:600;color:var(--success)">${brlFmt(vpl)}</span>
        </div>
      </div>`;
    }).join('');

    const alertValor = (v30 === 0 && n30 > 0) || (v60 === 0 && n60 > 0)
      ? `<div style="font-size:11px;color:var(--warning);margin-top:8px">⚠ Valor R$0,00 — configure os valores no cadastro do profissional</div>` : '';

    const card = document.createElement('div');
    card.className = 'table-card';
    card.style.cssText = 'padding:18px 20px';
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <div style="width:10px;height:10px;border-radius:50%;background:${prof.cor};flex-shrink:0"></div>
        <div style="font-size:14px;font-weight:600">${prof.nome}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-left:auto">${prof.esp || ''}</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
        <div style="background:var(--bg-raised);border-radius:var(--radius-sm);padding:10px;text-align:center">
          <div style="font-size:20px;font-weight:700;color:var(--accent)">${n30}</div>
          <div style="font-size:11px;color:var(--text-muted)">Sessões 30min</div>
          <div style="font-size:11px;color:var(--text-secondary)">${brlFmt(v30)}/un</div>
        </div>
        <div style="background:var(--bg-raised);border-radius:var(--radius-sm);padding:10px;text-align:center">
          <div style="font-size:20px;font-weight:700;color:var(--info)">${n60}</div>
          <div style="font-size:11px;color:var(--text-muted)">Sessões 60min</div>
          <div style="font-size:11px;color:var(--text-secondary)">${brlFmt(v60)}/un</div>
        </div>
        <div style="background:var(--bg-raised);border-radius:var(--radius-sm);padding:10px;text-align:center">
          <div style="font-size:18px;font-weight:700;color:var(--success)">${brlFmt(e.totalValorSess)}</div>
          <div style="font-size:11px;color:var(--text-muted)">Total ${n30+n60} atend.</div>
        </div>
      </div>
      <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px">Por plano de saúde</div>
      ${planoRows}
      ${alertValor}`;
    terapCards.appendChild(card);
  });

  // ── Cards de avaliações neuropsicológicas ────────────────────
  if (avalSection) avalSection.style.display = profsComAvals.length ? '' : 'none';
  profsComAvals.forEach(e => {
    const { prof } = e;
    const contabilizadas = e.avalsContabilizadas;
    const vAval = prof.valorAval || 0;

    // Agrupa por plano
    const porPlano = {};
    contabilizadas.forEach(a => {
      const pl = a.plano || 'Particular';
      porPlano[pl] = (porPlano[pl] || 0) + 1;
    });

    const planoRows = Object.entries(porPlano).sort((a,b) => a[0].localeCompare(b[0])).map(([pl, n]) => {
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px">
        <div style="color:var(--text-secondary)">${pl}</div>
        <div style="display:flex;gap:16px;align-items:center">
          <span style="color:var(--text-muted)">${n} avaliação${n > 1 ? 'ões' : ''}</span>
          <span style="font-weight:600;color:var(--success)">${brlFmt(n * vAval)}</span>
        </div>
      </div>`;
    }).join('');

    const descartadas = e.avalsTotal - contabilizadas.length;
    const descartInfo = descartadas > 0
      ? `<div style="font-size:11px;color:var(--text-muted);margin-top:8px">ℹ ${descartadas} atendimento(s) de retorno/continuação não contabilizado(s) (apenas 1º atendimento por paciente)</div>` : '';

    const alertValor = vAval === 0
      ? `<div style="font-size:11px;color:var(--warning);margin-top:8px">⚠ Valor R$0,00 — configure no cadastro do profissional</div>` : '';

    const pacientes = [...new Set(contabilizadas.map(a => a.paciente))];

    const card = document.createElement('div');
    card.className = 'table-card';
    card.style.cssText = 'padding:18px 20px';
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <div style="width:10px;height:10px;border-radius:50%;background:${prof.cor};flex-shrink:0"></div>
        <div style="font-size:14px;font-weight:600">${prof.nome}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-left:auto">${prof.esp || ''}</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
        <div style="background:var(--bg-raised);border-radius:var(--radius-sm);padding:10px;text-align:center">
          <div style="font-size:20px;font-weight:700;color:var(--warning)">${contabilizadas.length}</div>
          <div style="font-size:11px;color:var(--text-muted)">Avaliações</div>
          <div style="font-size:11px;color:var(--text-secondary)">(1º atend./paciente)</div>
        </div>
        <div style="background:var(--bg-raised);border-radius:var(--radius-sm);padding:10px;text-align:center">
          <div style="font-size:20px;font-weight:700;color:var(--text-secondary)">${pacientes.length}</div>
          <div style="font-size:11px;color:var(--text-muted)">Pacientes distintos</div>
        </div>
        <div style="background:var(--bg-raised);border-radius:var(--radius-sm);padding:10px;text-align:center">
          <div style="font-size:18px;font-weight:700;color:var(--success)">${brlFmt(e.totalValorAval)}</div>
          <div style="font-size:11px;color:var(--text-muted)">${brlFmt(vAval)}/avaliação</div>
        </div>
      </div>
      <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px">Por plano de saúde</div>
      ${planoRows}
      ${descartInfo}
      ${alertValor}`;
    avalCards.appendChild(card);
  });

  showToast('Fechamento calculado com sucesso!', 'success');
}

// ── Relatório Sintético PDF ──────────────────────────────────────────────────
function emitirRelatorioFechamento() {
  const mesVal = document.getElementById('fech-mes')?.value;
  if (!mesVal) { showToast('Calcule o fechamento primeiro','error'); return; }

  const [ano, mes] = mesVal.split('-').map(Number);
  const D_PRIM = new Date(ano, mes - 1, 1);
  const D_ULT  = new Date(ano, mes, 0);
  const ISO_PRIM = D_PRIM.toISOString().slice(0,10);
  const ISO_ULT  = D_ULT.toISOString().slice(0,10);
  const mesLabel = D_PRIM.toLocaleDateString('pt-BR', {month:'long', year:'numeric'});
  const mesLabCap = mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1);

  const aptsAtend = APPOINTMENTS.filter(a =>
    a.status === 'atendido' &&
    a.dataISO >= ISO_PRIM && a.dataISO <= ISO_ULT
  );

  const porProf = {};
  aptsAtend.forEach(a => {
    const profId = a.profId;
    const prof   = PROFISSIONAIS.find(p => p.id === profId);
    if (!prof) return;
    if (!porProf[profId]) porProf[profId] = { prof, sessoes30: [], sessoes60: [], avals: [] };
    const dur = a.durMin || 30;
    if (isAvalNeuropsico(a)) porProf[profId].avals.push(a);
    else if (dur >= 60)       porProf[profId].sessoes60.push(a);
    else                      porProf[profId].sessoes30.push(a);
  });

  // Avaliações: apenas 1º por paciente
  Object.values(porProf).forEach(e => {
    const byPac = {};
    e.avals.forEach(a => {
      if (!byPac[a.paciente] || a.dataISO < byPac[a.paciente].dataISO) byPac[a.paciente] = a;
    });
    e.avalsContabilizadas = Object.values(byPac);
  });

  const profs = Object.values(porProf).sort((a,b) => a.prof.nome.localeCompare(b.prof.nome));

  let totalAtend = 0, totalValor = 0;

  const rows = profs.map(e => {
    const { prof, sessoes30, sessoes60 } = e;
    const n30 = sessoes30.length, n60 = sessoes60.length;
    const nAval = e.avalsContabilizadas.length;
    const total = n30 + n60;
    const v30  = prof.valor30  || 0, v60 = prof.valor60 || 0, vAv = prof.valorAval || 0;
    const valor = n30 * v30 + n60 * v60 + nAval * vAv;
    totalAtend += total;
    totalValor += valor;
    const fmt = v => 'R$ ' + v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
    return `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0">${prof.nome}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center">${total}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center">${n30}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center">${n60}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center">${nAval}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;color:#16a34a">${fmt(valor)}</td>
    </tr>`;
  }).join('');

  const fmtBrl = v => 'R$ ' + v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const clinNome = (typeof CLINICA !== 'undefined' && CLINICA.nome) ? CLINICA.nome : 'ClinicFlow';
  const dataEmis = new Date().toLocaleDateString('pt-BR', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Fechamento Mensal — ${mesLabCap}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #1e293b; background: #fff; padding: 18mm 15mm; }
  .header { text-align: center; margin-bottom: 18px; border-bottom: 2px solid #1e3a6e; padding-bottom: 12px; }
  .header h1 { font-size: 16pt; color: #1e3a6e; margin-bottom: 4px; }
  .header p  { font-size: 10pt; color: #475569; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 8.5pt; color: #64748b; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  thead tr { background: #1e3a6e; color: #fff; }
  thead th { padding: 8px 10px; text-align: left; font-weight: 600; }
  thead th:nth-child(2),thead th:nth-child(3),thead th:nth-child(4),thead th:nth-child(5),thead th:nth-child(6) { text-align: center; }
  thead th:nth-child(6) { text-align: right; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  .tfoot { margin-top: 0; }
  .tfoot tr { background: #e8f0fe !important; font-weight: 700; }
  .tfoot td { padding: 10px 10px; border-top: 2px solid #1e3a6e; font-size: 10pt; }
  .footer { margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 8pt; color: #94a3b8; text-align: center; }
  .badge { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 8pt; font-weight: 600; }
  .badge-green { background: #dcfce7; color: #16a34a; }
  @media print {
    body { padding: 10mm 12mm; }
    button { display: none !important; }
  }
</style>
</head>
<body>
<div class="header">
  <h1>${clinNome}</h1>
  <p>Relatório Sintético de Fechamento Mensal — <strong>${mesLabCap}</strong></p>
</div>
<div class="meta">
  <span>Emitido em: ${dataEmis}</span>
  <span>Competência: <strong>${mesLabCap}</strong></span>
</div>
<table>
  <thead>
    <tr>
      <th>Terapeuta</th>
      <th style="text-align:center">Total Atend.</th>
      <th style="text-align:center">30 min</th>
      <th style="text-align:center">60 min</th>
      <th style="text-align:center">Aval. Neuro.</th>
      <th style="text-align:right">Valor Total</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
  <tfoot class="tfoot">
    <tr>
      <td><strong>TOTAL GERAL</strong></td>
      <td style="text-align:center"><strong>${totalAtend}</strong></td>
      <td colspan="3" style="text-align:center;font-size:8.5pt;color:#475569">— — —</td>
      <td style="text-align:right;color:#16a34a;font-size:11pt"><strong>${fmtBrl(totalValor)}</strong></td>
    </tr>
  </tfoot>
</table>
<div class="footer">
  Documento gerado automaticamente pelo ClinicFlow &bull; Apenas atendimentos com status "Atendido" &bull; Avaliação neuropsicológica: contabilizado 1º atendimento por paciente
</div>
<script>window.onload = function(){ window.print(); };<\/script>
</body>
</html>`;

  // Abre em nova janela para impressão/PDF
  const win = window.open('', '_blank', 'width=900,height=700');
  if (win) {
    win.document.write(html);
    win.document.close();
  } else {
    // Fallback: download como HTML
    const blob = new Blob([html], {type:'text/html'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fechamento_${mesVal}.html`;
    a.click();
    showToast('Arquivo baixado — abra no navegador e use Ctrl+P para imprimir/salvar como PDF','success');
  }
}
</script>

<!-- ═══════════════════ ESPAÇO CONECTA — MODAIS ═══════════════════ -->

<!-- Modal: Nova Reserva de Sala -->
<div class="modal-overlay" id="modal-nova-reserva">
  <div class="modal" style="max-width:540px">
    <div class="modal-header">
      <div>
        <div class="modal-title">Nova Reserva de Sala</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px">Espaço Conecta — Agendamento</div>
      </div>
      <button class="modal-close" onclick="closeModal('modal-nova-reserva')"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>
    </div>
    <div class="modal-body">
      <div class="form-row cols-2">
        <div class="form-group">
          <label>Sala</label>
          <select class="form-select" id="res-sala"></select>
        </div>
        <div class="form-group">
          <label>Profissional Locatário</label>
          <select class="form-select" id="res-prof" onchange="conectaCalcFim()"></select>
        </div>
      </div>
      <div class="form-row cols-2">
        <div class="form-group">
          <label>Data</label>
          <input class="form-input" type="date" id="res-data">
        </div>
        <div class="form-group">
          <label>Recorrência</label>
          <select class="form-select" id="res-recorrencia" onchange="conectaToggleRecorrencia()">
            <option value="unica">Reserva única</option>
            <option value="semanal">Semanal (mesmo dia)</option>
            <option value="quinzenal">Quinzenal</option>
          </select>
        </div>
      </div>
      <div class="form-row" style="grid-template-columns:1fr 1fr 1fr;gap:10px">
        <div class="form-group">
          <label>Horário início</label>
          <input class="form-input" type="time" id="res-hora-ini" value="08:00" onchange="conectaCalcFim()">
        </div>
        <div class="form-group">
          <label>Duração</label>
          <select class="form-select" id="res-duracao" onchange="conectaCalcFim()">
            <option value="60">1 hora</option>
            <option value="90">1h30</option>
            <option value="120">2 horas</option>
            <option value="180">3 horas</option>
            <option value="240">4 horas</option>
            <option value="480">Dia inteiro (8h)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Horário fim</label>
          <input class="form-input" type="time" id="res-hora-fim" value="09:00" readonly style="background:var(--bg-overlay);color:var(--text-muted)">
        </div>
      </div>
      <div class="form-group" id="res-recorr-ate-wrap" style="display:none">
        <label>Repetir até</label>
        <input class="form-input" type="date" id="res-recorr-ate">
      </div>
      <div class="form-group">
        <label>Observações</label>
        <textarea class="form-input" id="res-obs" rows="2" placeholder="Tipo de atendimento, número de pacientes..."></textarea>
      </div>
      <!-- Preview valor estimado -->
      <div id="res-valor-preview" style="background:var(--bg-raised);border-radius:var(--radius-md);padding:12px 14px;border:1px solid var(--border)">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.3px;font-weight:600">Valor estimado da reserva</div>
        <div id="res-valor-calc" style="font-size:20px;font-weight:700;color:var(--success)">R$ 0,00</div>
        <div id="res-valor-detalhe" style="font-size:12px;color:var(--text-secondary);margin-top:2px"></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-sm btn-secondary" onclick="closeModal('modal-nova-reserva')">Cancelar</button>
      <button class="btn-sm btn-accent" onclick="salvarReserva()">
        <svg viewBox="0 0 24 24" fill="currentColor" style="width:13px;height:13px"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
        Confirmar Reserva
      </button>
    </div>
  </div>
</div>

<!-- Modal: Novo Profissional Locatário -->
<div class="modal-overlay" id="modal-novo-locatario">
  <div class="modal" style="max-width:560px">
    <div class="modal-header">
      <div>
        <div class="modal-title" id="loc-modal-title">Novo Profissional Locatário</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px">Espaço Conecta — Cadastro de Locatário</div>
      </div>
      <button class="modal-close" onclick="closeModal('modal-novo-locatario')"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>
    </div>
    <div class="modal-body">
      <input type="hidden" id="loc-edit-id">
      <div class="form-row cols-2">
        <div class="form-group">
          <label>Nome completo *</label>
          <input class="form-input" id="loc-nome" placeholder="Dr(a). Nome Completo">
        </div>
        <div class="form-group">
          <label>Especialidade</label>
          <input class="form-input" id="loc-esp" placeholder="Ex: Psicologia, Fisioterapia">
        </div>
      </div>
      <div class="form-row cols-2">
        <div class="form-group">
          <label>Telefone / WhatsApp</label>
          <input class="form-input" id="loc-tel" placeholder="(11) 99999-9999">
        </div>
        <div class="form-group">
          <label>E-mail</label>
          <input class="form-input" type="email" id="loc-email" placeholder="email@exemplo.com">
        </div>
      </div>
      <div class="form-row cols-2">
        <div class="form-group">
          <label>CPF</label>
          <input class="form-input" id="loc-cpf" placeholder="000.000.000-00">
        </div>
        <div class="form-group">
          <label>Conselho / Registro</label>
          <input class="form-input" id="loc-conselho" placeholder="CRP 06/12345">
        </div>
      </div>
      <div style="border-top:1px solid var(--border);margin:16px 0;padding-top:16px">
        <div style="font-size:13px;font-weight:600;color:var(--text-secondary);margin-bottom:12px">💰 Valores de Locação (para fechamento mensal)</div>
        <div class="form-row" style="grid-template-columns:1fr 1fr 1fr;gap:10px">
          <div class="form-group">
            <label>Valor/hora (R$)</label>
            <input class="form-input" type="number" id="loc-valor-hora" placeholder="0,00" min="0" step="0.01">
          </div>
          <div class="form-group">
            <label>Valor meio período (R$)</label>
            <input class="form-input" type="number" id="loc-valor-meio" placeholder="0,00" min="0" step="0.01">
          </div>
          <div class="form-group">
            <label>Valor dia inteiro (R$)</label>
            <input class="form-input" type="number" id="loc-valor-dia" placeholder="0,00" min="0" step="0.01">
          </div>
        </div>
        <div class="form-group">
          <label>Sala preferencial</label>
          <select class="form-select" id="loc-sala-pref">
            <option value="">Sem preferência</option>
          </select>
        </div>
      </div>
      <div class="form-row cols-2">
        <div class="form-group">
          <label>Status</label>
          <select class="form-select" id="loc-status">
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </select>
        </div>
        <div class="form-group">
          <label>Observações</label>
          <input class="form-input" id="loc-obs" placeholder="Observações gerais">
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-sm btn-secondary" onclick="closeModal('modal-novo-locatario')">Cancelar</button>
      <button class="btn-sm btn-accent" onclick="salvarLocatario()">
        <svg viewBox="0 0 24 24" fill="currentColor" style="width:13px;height:13px"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
        Salvar
      </button>
    </div>
  </div>
</div>

<!-- Modal: Detalhes da Reserva -->
<div class="modal-overlay" id="modal-reserva-detalhe">
  <div class="modal" style="max-width:480px">
    <div class="modal-header">
      <div class="modal-title">Detalhes da Reserva</div>
      <button class="modal-close" onclick="closeModal('modal-reserva-detalhe')"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>
    </div>
    <div class="modal-body" id="reserva-detalhe-body"></div>
    <div class="modal-footer" id="reserva-detalhe-footer">
      <button class="btn-sm btn-secondary" onclick="closeModal('modal-reserva-detalhe')">Fechar</button>
      <button class="btn-sm btn-secondary" style="color:var(--danger);border-color:rgba(248,113,113,0.3)" id="btn-cancelar-reserva" onclick="cancelarReservaAtual()">
        Cancelar Reserva
      </button>
    </div>
  </div>
</div>

<!-- Modal: Gestão de Salas do Espaço Conecta -->
<div class="modal-overlay" id="modal-gestao-salas">
  <div class="modal" style="max-width:600px">
    <div class="modal-header">
      <div>
        <div class="modal-title">Gerenciar Salas</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px">Espaço Conecta — cadastro e configuração de salas</div>
      </div>
      <button class="modal-close" onclick="closeModal('modal-gestao-salas')"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>
    </div>
    <div class="modal-body">
      <!-- Lista de salas existentes -->
      <div id="salas-list-modal" style="margin-bottom:20px"></div>
      <!-- Formulário nova sala -->
      <div style="background:var(--bg-raised);border-radius:var(--radius-md);padding:16px;border:1px solid var(--border)">
        <div style="font-size:13px;font-weight:600;margin-bottom:12px;color:var(--text-secondary)">
          <span id="sala-form-title">➕ Adicionar nova sala</span>
        </div>
        <input type="hidden" id="sala-edit-id">
        <div class="form-row cols-2">
          <div class="form-group">
            <label>Nome da sala *</label>
            <input class="form-input" id="sala-nome" placeholder="Ex: Sala 1, Sala Azul...">
          </div>
          <div class="form-group">
            <label>Capacidade (pessoas)</label>
            <input class="form-input" type="number" id="sala-cap" min="1" value="2">
          </div>
        </div>
        <div class="form-group">
          <label>Descrição / Recursos</label>
          <input class="form-input" id="sala-desc" placeholder="Ex: ar-condicionado, divã, mesa redonda...">
        </div>
        <div class="form-group">
          <label>Cor de identificação</label>
          <div style="display:flex;gap:8px;margin-top:4px">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:6px 12px;border-radius:var(--radius-sm);border:2px solid transparent;transition:border-color .15s" id="cor-sala1-lbl">
              <input type="radio" name="sala-cor" value="sala1" id="cor-sala1" checked style="display:none">
              <span style="width:14px;height:14px;border-radius:50%;background:var(--accent)"></span>
              <span style="font-size:12px">Azul</span>
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:6px 12px;border-radius:var(--radius-sm);border:2px solid transparent;transition:border-color .15s" id="cor-sala2-lbl">
              <input type="radio" name="sala-cor" value="sala2" id="cor-sala2" style="display:none">
              <span style="width:14px;height:14px;border-radius:50%;background:#a78bfa"></span>
              <span style="font-size:12px">Roxo</span>
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:6px 12px;border-radius:var(--radius-sm);border:2px solid transparent;transition:border-color .15s" id="cor-sala3-lbl">
              <input type="radio" name="sala-cor" value="sala3" id="cor-sala3" style="display:none">
              <span style="width:14px;height:14px;border-radius:50%;background:var(--success)"></span>
              <span style="font-size:12px">Verde</span>
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:6px 12px;border-radius:var(--radius-sm);border:2px solid transparent;transition:border-color .15s" id="cor-sala4-lbl">
              <input type="radio" name="sala-cor" value="sala4" id="cor-sala4" style="display:none">
              <span style="width:14px;height:14px;border-radius:50%;background:var(--warning)"></span>
              <span style="font-size:12px">Amarelo</span>
            </label>
          </div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
          <button class="btn-sm btn-secondary" onclick="limparFormSala()">Limpar</button>
          <button class="btn-sm btn-accent" onclick="salvarSala()">
            <svg viewBox="0 0 24 24" fill="currentColor" style="width:13px;height:13px"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
            Salvar Sala
          </button>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Modal: Confirmar Cancelamento em Lote (recorrente) -->
<div class="modal-overlay" id="modal-cancelar-lote">
  <div class="modal" style="max-width:420px">
    <div class="modal-header">
      <div class="modal-title">Cancelar Reserva</div>
      <button class="modal-close" onclick="closeModal('modal-cancelar-lote')"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>
    </div>
    <div class="modal-body">
      <p style="font-size:14px;margin-bottom:16px">Esta reserva faz parte de uma série recorrente. O que deseja cancelar?</p>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button class="btn-sm btn-secondary" style="justify-content:flex-start;padding:10px 14px" onclick="cancelarReserva('unica')">
          <svg viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px;flex-shrink:0"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/></svg>
          Apenas esta data
        </button>
        <button class="btn-sm btn-secondary" style="justify-content:flex-start;padding:10px 14px;color:var(--warning)" onclick="cancelarReserva('futuras')">
          <svg viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px;flex-shrink:0"><path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9z"/></svg>
          Esta e as próximas
        </button>
        <button class="btn-sm btn-secondary" style="justify-content:flex-start;padding:10px 14px;color:var(--danger)" onclick="cancelarReserva('todas')">
          <svg viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px;flex-shrink:0"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          Cancelar todas da série
        </button>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-sm btn-secondary" onclick="closeModal('modal-cancelar-lote')">Voltar</button>
    </div>
  </div>
</div>
<script>
// ═══════════════════════════════════════════════════════════════════
