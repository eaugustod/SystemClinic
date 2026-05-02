// ═══════════════════════════════════════
//  MODALS
// ═══════════════════════════════════════
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function openNovoAgendamento(profId, hora, paciente) {
  currentApptId = null;
  populateSelects();
  document.getElementById('ag-modal-title').textContent  = 'Novo Agendamento';
  document.getElementById('ag-modal-sub').textContent    = 'Preencha os dados do agendamento';
  document.getElementById('ag-data').valueAsDate          = currentDate;
  document.getElementById('ag-paciente').value            = paciente || '';
  document.getElementById('ag-carteirinha').value         = '';
  document.getElementById('ag-status').value              = 'agendado';
  document.getElementById('ag-obs').value                 = '';
  document.getElementById('ag-duracao').value             = '30';
  document.getElementById('ag-plano-info').style.display  = 'none';
  document.getElementById('sadt-badge').style.display     = 'none';
  document.getElementById('btn-imprimir-guia').style.display = 'none';
  const cancelBtn = document.getElementById('btn-cancelar-agendamento');
  if (cancelBtn) cancelBtn.style.display = 'none';
  const cancelTerapiaBtn = document.getElementById('btn-cancelou-terapia');
  if (cancelTerapiaBtn) cancelTerapiaBtn.style.display = 'none';
  const delAgBtn = document.getElementById('btn-excluir-agendamento');
  if (delAgBtn) delAgBtn.style.display = 'none';
  // Reset modalidade to presencial
  const presEl = document.getElementById('ag-presencial');
  if (presEl) presEl.checked = true;
  agModalidadeChange();
  document.getElementById('ag-meet-link').value = '';
  if (profId) document.getElementById('ag-profissional').value = profId;
  if (hora) {
    document.getElementById('ag-hora-ini').value = hora;
    agCalcFim();
  }
  if (paciente) onPacienteChange(paciente);
  // Reset grupo state
  if (typeof grupoResetState === 'function') grupoResetState();
  switchAgTab('dados', document.getElementById('tab-dados'));
  openModal('modal-agendamento');
}

document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', function(e) { if (e.target === this) this.classList.remove('active'); });
});

// ═══════════════════════════════════════
//  SAVE
// ═══════════════════════════════════════
function salvarAgendamento() {
  // Redireciona para salvamento em grupo se modo grupo estiver ativo e for novo agendamento
  if (typeof _grupoMode !== 'undefined' && _grupoMode && !currentApptId) {
    salvarAgendamentoGrupo();
    return;
  }
  // Quando edita agendamento de grupo existente, usa o paciente do campo individual
  const pac = (document.getElementById('ag-paciente').value || '').trim();
  if (!pac) { showToast('Informe o nome do paciente','error'); return; }

  const horaIni    = document.getElementById('ag-hora-ini').value;
  const horaFim    = document.getElementById('ag-hora-fim').value;
  const durMin     = calcDurMin(horaIni, horaFim);
  const modalidade = document.querySelector('input[name="ag-modalidade"]:checked')?.value || 'presencial';
  const meetLink   = document.getElementById('ag-meet-link')?.value || '';
  const novoStatus = document.getElementById('ag-status').value;
  const obs        = document.getElementById('ag-obs')?.value || '';
  const profId     = parseInt(document.getElementById('ag-profissional').value);
  const planoId    = parseInt(document.getElementById('ag-plano').value);
  const planoObj   = PLANOS.find(p=>p.id===planoId);
  const carteirinha= document.getElementById('ag-carteirinha')?.value || '';

  // Verifica bloqueio de agenda
  const dataAgISO = document.getElementById('ag-data')?.value || '';
  if (!currentApptId && slotBloqueado(profId, dataAgISO, horaIni)) {
    const b = getBloqueioDoSlot(profId, dataAgISO, horaIni);
    const prof2 = PROFISSIONAIS.find(p => p.id === profId);
    const profNome2 = prof2?.nomeAgenda || prof2?.nome || 'Profissional';
    const horario2  = b?.diaTodo ? 'dia todo' : `${b?.horaIni||''} – ${b?.horaFim||''}`;
    showToast(`🔒 Agenda de ${profNome2} bloqueada neste horário (${horario2}). Remova o bloqueio primeiro.`, 'error');
    return;
  }

  if (currentApptId) {
    const appt = APPOINTMENTS.find(a => a.id === currentApptId);
    if (appt) {
      appt.paciente   = pac;
      appt.profId     = profId;
      appt.plano      = planoObj?.nome || appt.plano;
      appt.hora       = horaIni;
      appt.horaFim    = horaFim;
      appt.durMin     = durMin;
      appt.modalidade = modalidade;
      appt.meetLink   = meetLink;
      appt.status     = novoStatus;
      appt.obs        = obs;
      appt.carteirinha= carteirinha;
      const temDados = document.getElementById('sadt-beneficiario')?.value;
      if (temDados) {
        const totalTxt = document.getElementById('sadt-total')?.textContent || '0';
        appt.guia = { autorizacao: document.getElementById('sadt-autorizacao')?.value || 'Pendente', total: parseFloat(totalTxt.replace(/[R$\s]/g,'').replace(',','.')) || 0 };
      }
      const msgs  = { agendado:'Agendamento atualizado!', confirmado:'Consulta confirmada!', atendido:'Marcado como atendido!', chegou:'Paciente em espera!', desmarcado:'Consulta desmarcada.', cancelado:'Agendamento cancelado.' };
      const types = { agendado:'success', confirmado:'success', atendido:'success', chegou:'success', desmarcado:'error', cancelado:'error' };
      showToast(msgs[novoStatus] || 'Agendamento salvo!', types[novoStatus] || 'success');
    }
  } else {
    // Novo agendamento
    const nextId = Math.max(...APPOINTMENTS.map(a=>a.id), 0) + 1;
    APPOINTMENTS.push({
      id: nextId, profId, paciente: pac,
      plano: planoObj?.nome || 'Particular',
      hora: horaIni, horaFim, durMin,
      modalidade, meetLink, status: novoStatus,
      obs, carteirinha, guia: null, waSent: false,
      dataISO: document.getElementById('ag-data')?.value || '',
    });
    showToast('Agendamento criado com sucesso!', 'success');
  }

  closeModal('modal-agendamento');
  grupoResetState();
  renderDayView();
  try { updateNavBadges(); } catch(e) {}
}

// ═══════════════════════════════════════
//  AGENDAMENTO DE GRUPO
// ═══════════════════════════════════════
let _grupoMode      = false;
let _grupoPacientes = []; // [{nome, plano, planoId, carteirinha}]
let _grupoId        = null;

function toggleGrupoMode() {
  _grupoMode = !_grupoMode;
  const sw     = document.getElementById('grupo-switch');
  const panel  = document.getElementById('grupo-pacientes-panel');
  const row    = document.getElementById('grupo-toggle-row');
  const pacRow = document.getElementById('ag-paciente-row');
  const sub    = document.getElementById('grupo-toggle-sub');
  if (_grupoMode) {
    sw?.classList.add('on');
    panel?.classList.add('visible');
    row?.classList.add('active');
    if (pacRow) pacRow.style.display = 'none';
    if (sub) sub.textContent = 'Modo grupo ativado — adicione os pacientes abaixo';
    grupoPopulateDatalist();
  } else {
    sw?.classList.remove('on');
    panel?.classList.remove('visible');
    row?.classList.remove('active');
    if (pacRow) pacRow.style.display = '';
    if (sub) sub.textContent = 'Clique para adicionar múltiplos pacientes neste horário';
  }
}

function grupoResetState() {
  _grupoMode      = false;
  _grupoPacientes = [];
  _grupoId        = null;
  const sw     = document.getElementById('grupo-switch');
  const panel  = document.getElementById('grupo-pacientes-panel');
  const row    = document.getElementById('grupo-toggle-row');
  const pacRow = document.getElementById('ag-paciente-row');
  const sub    = document.getElementById('grupo-toggle-sub');
  sw?.classList.remove('on');
  panel?.classList.remove('visible');
  row?.classList.remove('active');
  if (pacRow) pacRow.style.display = '';
  if (sub) sub.textContent = 'Clique para adicionar múltiplos pacientes neste horário';
  const inp = document.getElementById('grupo-pac-input');
  if (inp) inp.value = '';
  grupoRenderLista();
}

function grupoPopulateDatalist() {
  const dl = document.getElementById('grupo-pac-datalist');
  if (!dl) return;
  const jaAdicionados = new Set(_grupoPacientes.map(p => p.nome.toLowerCase()));
  dl.innerHTML = PACIENTES
    .filter(p => !jaAdicionados.has(p.nome.toLowerCase()))
    .map(p => `<option value="${p.nome}">`)
    .join('');
}

function grupoAdicionarPaciente() {
  const inp  = document.getElementById('grupo-pac-input');
  const nome = (inp?.value || '').trim();
  if (!nome) { showToast('Informe o nome do paciente','error'); return; }
  if (_grupoPacientes.some(p => p.nome.toLowerCase() === nome.toLowerCase())) {
    showToast('Paciente já adicionado ao grupo','error');
    if (inp) inp.value = '';
    return;
  }
  const pac      = PACIENTES.find(p => p.nome.toLowerCase() === nome.toLowerCase());
  const planoObj = pac ? PLANOS.find(pl => pl.id === pac.planoId) : null;
  _grupoPacientes.push({
    nome:        pac ? pac.nome : nome,
    plano:       planoObj?.nome || 'Particular',
    planoId:     pac?.planoId || 5,
    carteirinha: pac?.carteirinha || '',
  });
  if (inp) inp.value = '';
  grupoRenderLista();
  grupoPopulateDatalist();
}

function grupoRemoverPaciente(idx) {
  _grupoPacientes.splice(idx, 1);
  grupoRenderLista();
  grupoPopulateDatalist();
}

function grupoRenderLista() {
  const list  = document.getElementById('grupo-pac-list');
  const count = document.getElementById('grupo-count');
  if (!list) return;
  if (count) count.textContent = _grupoPacientes.length;
  if (_grupoPacientes.length === 0) {
    list.innerHTML = '<div class="grupo-empty">Nenhum paciente adicionado ao grupo ainda</div>';
    return;
  }
  list.innerHTML = _grupoPacientes.map((p, i) => {
    const initials = p.nome.split(' ').slice(0,2).map(w => w[0] || '').join('').toUpperCase();
    return `<div class="grupo-pac-item">
      <div class="grupo-pac-avatar">${initials}</div>
      <div style="flex:1;min-width:0">
        <div class="grupo-pac-nome">${p.nome}</div>
        <div class="grupo-pac-plano">${p.plano}</div>
      </div>
      <button class="grupo-pac-remove" onclick="grupoRemoverPaciente(${i})" title="Remover">
        <svg viewBox="0 0 24 24" fill="currentColor" style="width:13px;height:13px"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
      </button>
    </div>`;
  }).join('');
}

function grupoGerarId() {
  return 'grp_' + Date.now() + '_' + Math.random().toString(36).substr(2,6);
}

// ── Tooltip hover do card de grupo ──────────────────────────────────────────
let _tooltipTimer = null;

function grupoTooltipShow(event, groupId, dataISO) {
  clearTimeout(_tooltipTimer);
  _tooltipTimer = setTimeout(() => {
    const membros = APPOINTMENTS.filter(a => a.groupId === groupId && a.dataISO === dataISO);
    if (!membros.length) return;

    const sub  = document.getElementById('grupo-tooltip-sub');
    const list = document.getElementById('grupo-tooltip-list');
    const tip  = document.getElementById('grupo-tooltip');
    if (!tip || !sub || !list) return;

    sub.textContent = membros.length + ' paciente' + (membros.length !== 1 ? 's' : '') + ' · ' + membros[0].hora;

    list.innerHTML = membros.map(m => {
      const initials = m.paciente.split(' ').slice(0,2).map(w => w[0]||'').join('').toUpperCase();
      const statusColors = { agendado:'#60a5fa', confirmado:'#a78bfa', atendido:'#34d399', desmarcado:'#f87171', chegou:'#facc15' };
      const statusLabels = { agendado:'Agendado', confirmado:'Confirmado', atendido:'Atendido', desmarcado:'Desmarcado', chegou:'Em Espera' };
      const dot = '<span style="width:6px;height:6px;border-radius:50%;background:' + (statusColors[m.status]||'#888') + ';display:inline-block;flex-shrink:0"></span>';
      return '<div class="grupo-tooltip-item">' +
        '<div class="grupo-tooltip-avatar">' + initials + '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div class="grupo-tooltip-nome">' + m.paciente + '</div>' +
          '<div class="grupo-tooltip-plano" style="display:flex;align-items:center;gap:4px">' + dot + m.plano + ' · ' + (statusLabels[m.status]||m.status) + '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    // Posiciona o tooltip perto do cursor
    tip.style.display = 'block';
    const tw = tip.offsetWidth  || 260;
    const th = tip.offsetHeight || 200;
    let x = event.clientX + 14;
    let y = event.clientY + 10;
    if (x + tw > window.innerWidth  - 10) x = event.clientX - tw - 10;
    if (y + th > window.innerHeight - 10) y = event.clientY - th - 10;
    tip.style.left = x + 'px';
    tip.style.top  = y + 'px';

    requestAnimationFrame(() => tip.classList.add('visible'));
  }, 180);
}

function grupoTooltipHide() {
  clearTimeout(_tooltipTimer);
  const tip = document.getElementById('grupo-tooltip');
  if (!tip) return;
  tip.classList.remove('visible');
  setTimeout(() => { tip.style.display = 'none'; }, 160);
}

// Move tooltip junto com o mouse enquanto hover
document.addEventListener('mousemove', e => {
  const tip = document.getElementById('grupo-tooltip');
  if (!tip || !tip.classList.contains('visible')) return;
  const tw = tip.offsetWidth  || 260;
  const th = tip.offsetHeight || 200;
  let x = e.clientX + 14;
  let y = e.clientY + 10;
  if (x + tw > window.innerWidth  - 10) x = e.clientX - tw - 10;
  if (y + th > window.innerHeight - 10) y = e.clientY - th - 10;
  tip.style.left = x + 'px';
  tip.style.top  = y + 'px';
});

// Atualiza status de todos os membros do grupo de uma vez
function grupoUpdateStatus(groupId, dataISO, novoStatus) {
  const membros = APPOINTMENTS.filter(a => a.groupId === groupId && a.dataISO === dataISO);
  membros.forEach(a => { a.status = novoStatus; });
  renderDayView();
  const labels = { confirmado:'Confirmados', atendido:'Atendidos', desmarcado:'Desmarcados', chegou:'Em espera' };
  showToast(membros.length + ' pacientes ' + (labels[novoStatus] || novoStatus), 'success');
}

function salvarAgendamentoGrupo() {
  if (_grupoPacientes.length < 2) {
    showToast('Adicione ao menos 2 pacientes para um agendamento de grupo','error');
    return;
  }
  const horaIni    = document.getElementById('ag-hora-ini').value;
  const horaFim    = document.getElementById('ag-hora-fim').value;
  const durMin     = calcDurMin(horaIni, horaFim);
  const modalidade = document.querySelector('input[name="ag-modalidade"]:checked')?.value || 'presencial';
  const meetLink   = document.getElementById('ag-meet-link')?.value || '';
  const novoStatus = document.getElementById('ag-status').value;
  const obs        = document.getElementById('ag-obs')?.value || '';
  const profId     = parseInt(document.getElementById('ag-profissional').value);
  const dataISO    = document.getElementById('ag-data')?.value || '';
  const tipoAg     = document.getElementById('ag-tipo')?.value || 'sessao';
  if (!profId) { showToast('Selecione o profissional','error'); return; }
  if (!dataISO) { showToast('Informe a data','error'); return; }
  const groupId = _grupoId || grupoGerarId();
  _grupoId = groupId;
  _grupoPacientes.forEach(p => {
    const planoObj = PLANOS.find(pl => pl.id === p.planoId);
    const nextId   = Math.max(0, ...APPOINTMENTS.map(a=>a.id)) + 1;
    APPOINTMENTS.push({
      id:          nextId,
      profId,
      paciente:    p.nome,
      plano:       planoObj?.nome || p.plano || 'Particular',
      planoId:     p.planoId,
      hora:        horaIni,
      horaFim,
      durMin,
      modalidade,
      meetLink,
      status:      novoStatus,
      obs,
      carteirinha: p.carteirinha || '',
      guia:        null,
      waSent:      false,
      dataISO,
      tipo:        tipoAg,
      isGrupo:     true,
      groupId,
      grupoSize:   _grupoPacientes.length,
    });
  });
  showToast(`Grupo agendado! ${_grupoPacientes.length} pacientes adicionados.`, 'success');
  closeModal('modal-agendamento');
  grupoResetState();
  renderDayView();
  try { updateNavBadges(); } catch(e) {}
}

function calcDurMin(ini, fim) {
  if (!ini || !fim) return 30;
  const [h1,m1] = ini.split(':').map(Number);
  const [h2,m2] = fim.split(':').map(Number);
  const diff = (h2*60+m2) - (h1*60+m1);
  return diff > 0 ? diff : 30;
}

function cancelarAgendamento() {
  if (!currentApptId) return;
  const appt = APPOINTMENTS.find(a=>a.id===currentApptId);
  if (!appt) return;
  appt.status = 'cancelado';
  closeModal('modal-agendamento');
  renderDayView();
  showToast('Agendamento cancelado.','error');
}

// ═══════════════════════════════════════
//  CANCELOU TERAPIA
//  Cancela todos os agendamentos futuros
//  do paciente a partir do dia atual e
//  exclui guias futuras associadas
// ═══════════════════════════════════════
async function cancelouTerapia() {
  if (!currentApptId) return;
  const appt = APPOINTMENTS.find(a => a.id === currentApptId);
  if (!appt) return;

  const nomePac = appt.paciente;
  const hoje = new Date();
  const hojeISO = hoje.getFullYear() + '-' +
    String(hoje.getMonth()+1).padStart(2,'0') + '-' +
    String(hoje.getDate()).padStart(2,'0');

  // Conta quantos agendamentos futuros existem
  const futuros = APPOINTMENTS.filter(a =>
    a.paciente === nomePac &&
    a.dataISO >= hojeISO &&
    !['cancelado','desmarcado'].includes(a.status)
  );
  const guiasFuturas = GUIAS.filter(g =>
    g.pac === nomePac &&
    (g.data || '') >= hojeISO &&
    g.status !== 'Enviado' &&
    g.status !== 'Pago'
  );

  const msg = `Cancelar terapia de "${nomePac}"?\n\n` +
    `• ${futuros.length} agendamento(s) a partir de hoje serão cancelados\n` +
    `• ${guiasFuturas.length} guia(s) futura(s) pendente(s) serão excluídas\n\n` +
    `Esta ação não pode ser desfeita.`;

  if (!confirm(msg)) return;

  const sb = window._cfGetDb ? window._cfGetDb() : null;
  let agCancelados = 0, guiasExcluidas = 0;

  // ── Cancela agendamentos futuros ──────────────────────────────────────────
  for (const a of futuros) {
    a.status = 'cancelado';
    agCancelados++;
    if (sb) {
      try { await sb.from('agendamentos').update({ status: 'cancelado' }).eq('id', a.id); }
      catch(e) { console.error('[cancelouTerapia] ag', e); }
    }
  }

  // ── Exclui guias futuras pendentes ────────────────────────────────────────
  for (const g of guiasFuturas) {
    const idx = GUIAS.findIndex(x => x.id === g.id);
    if (idx > -1) GUIAS.splice(idx, 1);
    guiasExcluidas++;
    if (sb) {
      try { await sb.from('guias_sadt').delete().eq('id', g.id); }
      catch(e) { console.error('[cancelouTerapia] guia', e); }
    }
  }

  closeModal('modal-agendamento');
  refreshUI();
  showToast(
    `Terapia cancelada — ${agCancelados} agendamento(s) cancelado(s)` +
    (guiasExcluidas > 0 ? ` · ${guiasExcluidas} guia(s) excluída(s)` : ''),
    'error'
  );
}

// ─── PLANOS ──────────────────────────────────────────────────────────────────
function renderPlanosGrid() {
  document.getElementById('planos-grid').innerHTML = PLANOS.map(p => {
    const procCount = PROCEDIMENTOS.filter(pr => pr.planoId === p.id).length;
    const pacCount  = PACIENTES.filter(function(pac){ return pac.planoId === p.id && pac.status !== 'Inativo'; }).length;
    const logoEl = p.logo
      ? '<img src="'+p.logo+'" style="max-width:80px;max-height:28px;object-fit:contain;margin-bottom:4px;border-radius:3px" title="Logo cadastrado">'
      : '<span style="font-size:10px;color:var(--text-muted)">sem logo</span>';
    const contratadoEl = p.nomeContratado ? '<div style="font-size:11px;color:var(--text-muted);margin-top:1px">'+p.nomeContratado+'</div>' : '';
    return `<div class="plan-card" style="${p.status==='Inativo'?'opacity:.55':''}">
      <div class="plan-card-header">
        <div>
          <div class="plan-name">${p.nome}</div>
          <div class="plan-meta" style="margin-top:2px">ANS: <strong>${p.ans}</strong> · ${p.tabela}${p.versaoTiss?' · TISS '+p.versaoTiss:''}</div>
          ${contratadoEl}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          <div style="margin-bottom:2px">${logoEl}</div>
          ${statusChip(p.status||'Ativo')}
          <div style="display:flex;gap:4px">
            <button class="action-btn" title="Editar" onclick="editarPlano(${p.id})" style="width:24px;height:24px">${EDIT_ICON}</button>
            <button class="action-btn" title="Excluir" onclick="excluirPlano(${p.id})" style="width:24px;height:24px;color:var(--danger)">${DEL_ICON}</button>
          </div>
        </div>
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:4px">CNPJ: ${p.cnpj} ${p.cnes?'· CNES: '+p.cnes:''}</div>
      <div class="plan-stats" style="margin-top:10px">
        <div class="plan-stat"><div class="plan-stat-val">${pacCount}</div><div class="plan-stat-lbl">Pacientes</div></div>
        <div class="plan-stat"><div class="plan-stat-val">${procCount}</div><div class="plan-stat-lbl">Procedimentos</div></div>
        <div class="plan-stat"><div class="plan-stat-val" style="font-size:12px">${p.usaTiss?'Sim':'Não'}</div><div class="plan-stat-lbl">Usa TISS</div></div>
      </div>
    </div>`;
  }).join('');
}

function _setPlField(id, val) { const el=document.getElementById(id); if(el) el.value = val||''; }
function _getPlField(id) { const el=document.getElementById(id); return el?el.value:''; }

// ── Logo do plano ─────────────────────────────────────────────────────────────
let _plLogoData = null; // base64 string temporária durante edição do modal

function plLogoSetPreview(base64) {
  _plLogoData = base64 || null;
  const preview = document.getElementById('pl-logo-preview');
  const ph      = document.getElementById('pl-logo-placeholder');
  if (!preview) return;
  if (base64) {
    preview.innerHTML = `<img src="${base64}" style="max-width:156px;max-height:48px;object-fit:contain;border-radius:4px">`;
  } else {
    preview.innerHTML = `<span id="pl-logo-placeholder" style="font-size:11px;color:var(--text-muted);text-align:center;padding:4px">Clique para<br>anexar logo</span>`;
  }
}

function plLogoChange(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => plLogoSetPreview(e.target.result);
  reader.readAsDataURL(file);
  input.value = ''; // reset so same file can be re-selected
}

function plLogoRemover() {
  plLogoSetPreview(null);
}

function openNovoPlano() {
  editingPlId = null;
  document.getElementById('plano-modal-title').textContent = 'Novo Plano de Saúde';
  document.getElementById('plano-modal-sub').textContent   = 'Cadastre o convênio e configurações TISS';
  document.getElementById('pl-id-display').textContent     = '';
  ['pl-nome','pl-nome-guia','pl-cnpj','pl-ans','pl-tel','pl-email','pl-cod-prestador',
   'pl-nome-contratado','pl-cnes','pl-obs','pl-nome-plano-guia'].forEach(id => _setPlField(id,''));
  _setPlField('pl-num-guia-inicial','1');
  _setPlField('pl-tabela','CBHPM');
  _setPlField('pl-status','Ativo');
  _setPlField('pl-versao-tiss','4.02.00');
  _setPlField('pl-tipo-id','Código');
  _setPlField('pl-usa-tiss','true');
  _setPlField('pl-aplica-todos','true');
  _setPlField('pl-juntar-guia','true');
  plLogoSetPreview(null); // limpa logo
  openModal('modal-plano');
}

function editarPlano(id) {
  const p = PLANOS.find(x=>x.id===id);
  if (!p) return;
  editingPlId = id;
  document.getElementById('plano-modal-title').textContent = 'Editar Plano';
  document.getElementById('plano-modal-sub').textContent   = `${p.nome} · ANS ${p.ans}`;
  document.getElementById('pl-id-display').textContent     = `ID: ${p.id}`;
  _setPlField('pl-nome',            p.nome);
  _setPlField('pl-nome-guia',       p.nomeGuia);
  _setPlField('pl-cnpj',            p.cnpj);
  _setPlField('pl-ans',             p.ans);
  _setPlField('pl-tabela',          p.tabela||'CBHPM');
  _setPlField('pl-tel',             p.tel);
  _setPlField('pl-email',           p.email);
  _setPlField('pl-cod-prestador',   p.codPrestador);
  _setPlField('pl-nome-contratado', p.nomeContratado);
  _setPlField('pl-cnes',            p.cnes);
  _setPlField('pl-num-guia-inicial',p.numGuiaInicial||1);
  _setPlField('pl-nome-plano-guia', p.nomePlanoGuia);
  _setPlField('pl-obs',             p.obs);
  _setPlField('pl-status',          p.status||'Ativo');
  _setPlField('pl-versao-tiss',     p.versaoTiss||'4.02.00');
  _setPlField('pl-tipo-id',         p.tipoId||'Código');
  _setPlField('pl-usa-tiss',        p.usaTiss!==false?'true':'false');
  _setPlField('pl-aplica-todos',    p.aplicaTodos!==false?'true':'false');
  _setPlField('pl-juntar-guia',     p.juntarGuia!==false?'true':'false');
  plLogoSetPreview(p.logo || null); // mostra logo se existir
  openModal('modal-plano');
}

// ─── PROCEDIMENTOS ────────────────────────────────────────────────────────────
function renderProcedimentosTable(filter='') {
  const planoFiltro = parseInt(document.getElementById('proc-filtro-plano')?.value || '0');
  let list = PROCEDIMENTOS;
  if (filter) list = list.filter(p => p.desc.toLowerCase().includes(filter.toLowerCase()) || (p.codigo||'').includes(filter));
  if (planoFiltro > 0) list = list.filter(p => p.planoId === planoFiltro || p.planoId === 0);
  const tipoColor = { Consulta:'blue', Sessão:'green', Exame:'yellow', Cirurgia:'red', Outro:'gray' };
  document.getElementById('procedimentos-tbody').innerHTML = list.map(p => {
    const plano = PLANOS.find(pl=>pl.id===p.planoId);
    const planoLabel = plano
      ? `<span class="chip blue" style="font-size:10px">${plano.nome} · ANS ${plano.ans}</span>`
      : `<span class="chip gray" style="font-size:10px">Todos / Particular</span>`;
    return `<tr style="${p.status==='Inativo'?'opacity:.55':''}">
      <td><span style="font-family:var(--font-mono);color:var(--text-muted)">${p.codigo||'—'}</span></td>
      <td><div style="font-size:13px">${p.desc}</div>${p.descCurta?`<div style="font-size:11px;color:var(--text-muted)">${p.descCurta}</div>`:''}</td>
      <td><span class="chip ${tipoColor[p.tipo]||'gray'}">${p.tipo}</span></td>
      <td>${planoLabel}</td>
      <td style="font-family:var(--font-mono)">${brl(p.valPart)}</td>
      <td style="font-family:var(--font-mono)">${brl(p.valPlano)}</td>
      <td>${statusChip(p.status)}</td>
      <td><div class="table-actions">
        <button class="action-btn" title="Editar" onclick="editarProcedimento(${p.id})">${EDIT_ICON}</button>
        <button class="action-btn" title="Excluir" style="color:var(--danger)" onclick="excluirProcedimento(${p.id})">${DEL_ICON}</button>
      </div></td>
    </tr>`;
  }).join('');
}

function _populateProcPlanoSelect(selectedId) {
  const sel = document.getElementById('proc-plano-id');
  if (!sel) return;
  sel.innerHTML = '<option value="0">Todos os planos / Particular (sem vínculo específico)</option>' +
    PLANOS.filter(p=>p.nome!=='Particular').map(p =>
      `<option value="${p.id}">${p.nome} · ANS ${p.ans}${p.nomeContratado?' · '+p.nomeContratado:''}</option>`
    ).join('');
  sel.value = selectedId || 0;
}

function openNovoProcedimento() {
  editingProcId = null;
  document.getElementById('proc-modal-title').textContent = 'Novo Procedimento';
  document.getElementById('proc-modal-sub').textContent   = 'Cadastre o procedimento e valores';
  document.getElementById('proc-id-display').textContent  = '';
  ['proc-codigo','proc-desc','proc-desc-curta','proc-val-part','proc-val-plano','proc-obs'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value = '';
  });
  document.getElementById('proc-tipo').value       = 'Sessão';
  document.getElementById('proc-tabela-ref').value = 'TUSS';
  document.getElementById('proc-status').value     = 'Ativo';
  _populateProcPlanoSelect(0);
  openModal('modal-procedimento');
}

function editarProcedimento(id) {
  const p = PROCEDIMENTOS.find(x=>x.id===id);
  if (!p) return;
  editingProcId = id;
  const plano = PLANOS.find(pl=>pl.id===p.planoId);
  document.getElementById('proc-modal-title').textContent = 'Editar Procedimento';
  document.getElementById('proc-modal-sub').textContent   = p.desc + (plano?` · ${plano.nome}`:'');
  document.getElementById('proc-id-display').textContent  = `Cód: ${p.codigo||'—'}`;
  document.getElementById('proc-codigo').value       = p.codigo    || '';
  document.getElementById('proc-desc').value         = p.desc      || '';
  document.getElementById('proc-desc-curta').value   = p.descCurta || '';
  document.getElementById('proc-tipo').value         = p.tipo      || 'Sessão';
  document.getElementById('proc-tabela-ref').value   = p.tabela    || 'TUSS';
  document.getElementById('proc-val-part').value     = p.valPart  ? p.valPart.toFixed(2).replace('.',',')  : '';
  document.getElementById('proc-val-plano').value    = p.valPlano ? p.valPlano.toFixed(2).replace('.',',') : '';
  document.getElementById('proc-status').value       = p.status    || 'Ativo';
  document.getElementById('proc-obs').value          = p.obs       || '';
  _populateProcPlanoSelect(p.planoId||0);
  openModal('modal-procedimento');
}

function autoLookupProcModal(input) {
  const found = TUSS_TABLE[input.value.trim()];
  if (!found) return;
  const descEl = document.getElementById('proc-desc');
  if (descEl && !descEl.value) descEl.value = found.desc;
  const valEl = document.getElementById('proc-val-plano');
  if (valEl && !valEl.value) valEl.value = found.valor.toFixed(2).replace('.',',');
}

// ─── SAVE FUNCTIONS ───────────────────────────────────────────────────────────
function salvarPaciente() {
  const nome = document.getElementById('pac-nome').value.trim();
  if (!nome) { showToast('Informe o nome do paciente','error'); return; }
  const planoSel = document.getElementById('pac-plano');
  const planoId  = planoSel ? parseInt(planoSel.value) : null;
  const planoObj = PLANOS.find(pl=>pl.id===planoId);
  const dados = {
    nome,
    nasc:       document.getElementById('pac-nasc').value,
    cpf:        document.getElementById('pac-cpf').value,
    tel:        document.getElementById('pac-tel').value,
    email:      document.getElementById('pac-email').value,
    end:        document.getElementById('pac-end').value,
    planoId:    planoId || 5,
    plano:      planoObj ? planoObj.nome : 'Particular',
    carteirinha:document.getElementById('pac-carteirinha').value || '—',
    valCart:    document.getElementById('pac-val-cart').value,
    titular:    document.getElementById('pac-titular').value,
    sexo:       document.getElementById('pac-sexo').value,
    estCivil:   document.getElementById('pac-estcivil').value,
    profissao:  document.getElementById('pac-profissao').value,
    obs:        document.getElementById('pac-obs').value,
    status:     document.getElementById('pac-status').value,
    ultima:     new Date().toLocaleDateString('pt-BR'),
  };
  if (editingPacId !== null) {
    Object.assign(PACIENTES.find(p=>p.id===editingPacId), dados);
    showToast('Paciente atualizado!','success');
  } else {
    dados.id = nextPacId++;
    PACIENTES.push(dados);
    showToast('Paciente cadastrado!','success');
  }
  closeModal('modal-paciente');
  renderPacientesTable();
  populateSelects();
}

function parseCurrencyField(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  return parseFloat((el.value || '0').replace(/[R$\s.]/g,'').replace(',','.')) || 0;
}

function salvarProfissional() {
  const nome = document.getElementById('prf-nome').value.trim();
  if (!nome) { showToast('Informe o nome do profissional','error'); return; }
  const dados = {
    nome,
    nomeAgenda:      document.getElementById('prf-nome-agenda').value.trim() || nome.split(' ')[0],
    esp:             document.getElementById('prf-esp').value,
    conselho:        document.getElementById('prf-conselho').value,
    num:             document.getElementById('prf-num-conselho').value,
    uf:              document.getElementById('prf-uf').value,
    cbo:             document.getElementById('prf-cbo').value,
    tel:             document.getElementById('prf-tel').value,
    email:           document.getElementById('prf-email').value,
    instagram:       document.getElementById('prf-instagram').value,
    linkedin:        document.getElementById('prf-linkedin').value,
    googleCalendarId:document.getElementById('prf-google-cal-id').value.trim(),
    cor:             selectedColor || '#4f8ef7',
    status:          document.getElementById('prf-status').value,
    valor30:         parseCurrencyField('prf-valor-30'),
    valor60:         parseCurrencyField('prf-valor-60'),
    valorAval:       parseCurrencyField('prf-valor-aval'),
  };
  if (editingPrfId !== null) {
    Object.assign(PROFISSIONAIS.find(p=>p.id===editingPrfId), dados);
    showToast('Profissional atualizado!','success');
  } else {
    dados.id = nextPrfId++;
    PROFISSIONAIS.push(dados);
    activeProfFilters.add(dados.id);
    showToast('Profissional cadastrado!','success');
  }
  closeModal('modal-profissional');
  renderProfissionaisTable();
  renderProfToday();
  buildProfFilters();
  populateSelects();
  renderDayView();
}

function salvarPlano() {
  const nome = _getPlField('pl-nome').trim();
  const ans  = _getPlField('pl-ans').trim();
  if (!nome) { showToast('Informe o nome do plano','error'); return; }
  const dados = {
    nome,
    nomeGuia:       _getPlField('pl-nome-guia'),
    cnpj:           _getPlField('pl-cnpj'),
    ans,
    tabela:         _getPlField('pl-tabela') || 'CBHPM',
    tel:            _getPlField('pl-tel'),
    email:          _getPlField('pl-email'),
    codPrestador:   _getPlField('pl-cod-prestador'),
    nomeContratado: _getPlField('pl-nome-contratado'),
    cnes:           _getPlField('pl-cnes'),
    numGuiaInicial: parseInt(_getPlField('pl-num-guia-inicial')) || 1,
    nomePlanoGuia:  _getPlField('pl-nome-plano-guia'),
    obs:            _getPlField('pl-obs'),
    status:         _getPlField('pl-status') || 'Ativo',
    versaoTiss:     _getPlField('pl-versao-tiss') || '4.02.00',
    tipoId:         _getPlField('pl-tipo-id') || 'Código',
    usaTiss:        _getPlField('pl-usa-tiss') === 'true',
    aplicaTodos:    _getPlField('pl-aplica-todos') === 'true',
    juntarGuia:     _getPlField('pl-juntar-guia') === 'true',
    pacientes:      0,
    logo:           _plLogoData || null, // base64 da imagem do plano
  };
  if (editingPlId !== null) {
    const pl = PLANOS.find(p=>p.id===editingPlId);
    if (pl) { dados.pacientes = pl.pacientes; if (!_plLogoData && pl.logo) dados.logo = pl.logo; Object.assign(pl, dados); }
    showToast('Plano atualizado!','success');
  } else {
    dados.id = nextPlId++;
    PLANOS.push(dados);
    showToast('Plano cadastrado!','success');
  }
  closeModal('modal-plano');
  renderPlanosGrid();
  populateSelects();
  renderProcedimentosTable();
}

function salvarProcedimento() {
  const codigo  = (document.getElementById('proc-codigo').value||'').trim();
  const desc    = (document.getElementById('proc-desc').value||'').trim();
  if (!desc) { showToast('Informe a descrição do procedimento','error'); return; }
  const planoId = parseInt(document.getElementById('proc-plano-id')?.value||'0') || 0;
  const dados = {
    codigo,
    desc,
    descCurta: document.getElementById('proc-desc-curta').value,
    tipo:      document.getElementById('proc-tipo').value,
    valPart:   parseBRL(document.getElementById('proc-val-part').value),
    valPlano:  parseBRL(document.getElementById('proc-val-plano').value),
    tabela:    document.getElementById('proc-tabela-ref').value,
    planoId,
    status:    document.getElementById('proc-status').value,
    obs:       document.getElementById('proc-obs').value,
  };
  if (editingProcId !== null) {
    Object.assign(PROCEDIMENTOS.find(p=>p.id===editingProcId), dados);
    showToast('Procedimento atualizado!','success');
  } else {
    dados.id = nextProcId++;
    PROCEDIMENTOS.push(dados);
    if (codigo) TUSS_TABLE[codigo] = { desc, valor: dados.valPlano };
    showToast('Procedimento cadastrado!','success');
  }
  closeModal('modal-procedimento');
  renderProcedimentosTable();
  renderPlanosGrid(); // refresh proc count on cards
}



