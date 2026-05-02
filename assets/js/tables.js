// ═══════════════════════════════════════
//  TABLES
// ═══════════════════════════════════════
// ─── HELPERS ─────────────────────────────────────────────────────────────────
const EDIT_ICON = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`;
const DEL_ICON  = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;
const ATTACH_ICON=`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 015 0v10.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5V6H10v9.5a2.5 2.5 0 005 0V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg>`;

// ── Generic confirm delete dialog ─────────────────────────────────────────────
function confirmarExclusao(msg, fn) {
  if (confirm(msg || 'Confirmar exclusão?')) fn();
}

// ── Excluir por módulo ────────────────────────────────────────────────────────
function excluirPaciente(id) {
  confirmarExclusao('Excluir este paciente? Esta ação não pode ser desfeita.', () => {
    const idx = PACIENTES.findIndex(p=>p.id===id);
    if (idx>-1) { PACIENTES.splice(idx,1); renderPacientesTable(); populateSelects(); showToast('Paciente excluído.','error'); }
  });
}
function excluirProfissional(id) {
  confirmarExclusao('Excluir este profissional?', () => {
    const idx = PROFISSIONAIS.findIndex(p=>p.id===id);
    if (idx>-1) { PROFISSIONAIS.splice(idx,1); renderProfissionaisTable(); buildProfFilters(); populateSelects(); renderDayView(); showToast('Profissional excluído.','error'); }
  });
}
function excluirPlano(id) {
  confirmarExclusao('Excluir este plano?', () => {
    const idx = PLANOS.findIndex(p=>p.id===id);
    if (idx>-1) { PLANOS.splice(idx,1); renderPlanosGrid(); populateSelects(); showToast('Plano excluído.','error'); }
  });
}
function excluirProcedimento(id) {
  confirmarExclusao('Excluir este procedimento?', () => {
    const idx = PROCEDIMENTOS.findIndex(p=>p.id===id);
    if (idx>-1) { PROCEDIMENTOS.splice(idx,1); renderProcedimentosTable(); showToast('Procedimento excluído.','error'); }
  });
}
function excluirGuia(id) {
  confirmarExclusao('Excluir esta guia?', () => {
    const idx = GUIAS.findIndex(g=>g.id===id);
    if (idx>-1) { GUIAS.splice(idx,1); renderGuiasList(); showToast('Guia excluída.','error'); }
  });
}
function excluirLote(id) {
  confirmarExclusao('Excluir este lote? As guias voltarão para pendente.', () => {
    const l = LOTES.find(x=>x.id===id);
    if (l && l.guiaIds) l.guiaIds.forEach(gid => { const g=GUIAS.find(x=>x.id===gid); if(g){g.loteId=null;g.loteNum=null;g.status='Pendente';} });
    const idx = LOTES.findIndex(x=>x.id===id);
    if (idx>-1) { LOTES.splice(idx,1); renderLotesTable(); renderGuiasList(); showToast('Lote excluído.','error'); }
  });
}
function excluirSenha(id) {
  confirmarExclusao('Excluir esta autorização?', () => {
    const idx = SENHAS_PLANO.findIndex(s=>s.id===id);
    if (idx>-1) { SENHAS_PLANO.splice(idx,1); renderSenhas(); showToast('Autorização excluída.','error'); }
  });
}
function excluirEspera(id) {
  const e = LISTA_ESPERA.find(x=>x.id===id);
  if (e?.status==='Convertido') { showToast('Paciente já convertido — não pode ser excluído da lista.','error'); return; }
  confirmarExclusao('Remover da lista de espera?', () => {
    const idx = LISTA_ESPERA.findIndex(x=>x.id===id);
    if (idx>-1) { LISTA_ESPERA.splice(idx,1); renderEsperaTable(); showToast('Removido da lista.','error'); }
  });
}
function excluirHistorico(id) {
  confirmarExclusao('Excluir este registro do histórico?', () => {
    const idx = HISTORICO.findIndex(h=>h.id===id);
    if (idx>-1) { HISTORICO.splice(idx,1); histTab(document.querySelector('.imp-tab.active')?.id?.replace('htab-','')||'linha', document.querySelector('.imp-tab.active')); showToast('Registro excluído.','error'); }
  });
}
function excluirAgendamento(id) {
  const appt = APPOINTMENTS.find(a => a.id === id);
  if (!appt) return;

  let idsParaExcluir = [id];

  if (appt.isGrupo && appt.groupId) {
    const membros = APPOINTMENTS.filter(a => a.groupId === appt.groupId && a.dataISO === appt.dataISO);
    if (membros.length > 1) {
      const resp = confirm(
        'Este agendamento faz parte de um grupo com ' + membros.length + ' pacientes.\n\n' +
        'Clique OK para excluir TODOS os ' + membros.length + ' agendamentos do grupo.\n' +
        'Clique Cancelar para cancelar a operação.'
      );
      if (!resp) return;
      idsParaExcluir = membros.map(a => a.id);
    } else {
      if (!confirm('Excluir este agendamento permanentemente?')) return;
    }
  } else {
    if (!confirm('Excluir este agendamento permanentemente?')) return;
  }

  const sb = window._cfGetDb ? window._cfGetDb() : null;
  if (sb) {
    idsParaExcluir.forEach(eid => {
      sb.from('notificacoes').delete().eq('agendamento_id', eid).eq('enviada', false).then(() => {});
    });
    sb.from('agendamentos').delete().in('id', idsParaExcluir).then(({error}) => {
      if (error) console.error('[Excluir Agendamento]', error.message);
    });
  }

  idsParaExcluir.forEach(eid => {
    const idx = APPOINTMENTS.findIndex(a => a.id === eid);
    if (idx > -1) APPOINTMENTS.splice(idx, 1);
  });

  closeModal('modal-agendamento');
  renderDayView();
  showToast(
    idsParaExcluir.length > 1
      ? idsParaExcluir.length + ' agendamentos do grupo excluídos.'
      : 'Agendamento excluído.',
    'error'
  );
}

function excluirAgendamentoComGuia() {
  if (!currentApptId) return;
  const appt = APPOINTMENTS.find(a => a.id === currentApptId);
  if (!appt) return;

  let idsParaExcluir = [currentApptId];

  if (appt.isGrupo && appt.groupId) {
    const membros = APPOINTMENTS.filter(a => a.groupId === appt.groupId && a.dataISO === appt.dataISO);
    if (membros.length > 1) {
      const resp = confirm(
        'Este agendamento faz parte de um grupo com ' + membros.length + ' pacientes.\n\n' +
        'Clique OK para excluir TODOS os ' + membros.length + ' agendamentos do grupo (guias vinculadas também serão excluídas).\n' +
        'Clique Cancelar para cancelar a operação.'
      );
      if (!resp) return;
      idsParaExcluir = membros.map(a => a.id);
    } else {
      if (!confirm('Excluir este agendamento? Se houver guia SADT vinculada, ela também será excluída.')) return;
    }
  } else {
    if (!confirm('Excluir este agendamento? Se houver guia SADT vinculada, ela também será excluída.')) return;
  }

  const _sb = window._cfGetDb ? window._cfGetDb() : null;
  const apptsList = idsParaExcluir.map(eid => APPOINTMENTS.find(a => a.id === eid)).filter(Boolean);

  // Remove guias e reverte senhas para cada membro do grupo
  apptsList.forEach(a => {
    const guiaIdx = GUIAS.findIndex(g => g.pac === a.paciente && g.data === a.dataISO);
    if (guiaIdx > -1) {
      const guia = GUIAS[guiaIdx];
      if (_sb) {
        _sb.from('guias_sadt').delete().eq('id', guia.id).then(({error}) => {
          if (error) console.error('[Excluir Guia]', error.message);
        });
        const senhaRev = SENHAS_PLANO.find(s =>
          s.planoId === a.planoId &&
          s.paciente.toLowerCase() === a.paciente.toLowerCase() && s.qtdUsada > 0
        );
        if (senhaRev) {
          senhaRev.qtdUsada = Math.max(0, senhaRev.qtdUsada - 1);
          if (senhaRev.qtdUsada < senhaRev.qtdAutorizada) { senhaRev.status = 'Ativa'; senhaRev.ativa = true; }
          _sb.from('senhas_plano').update({ qtd_usada: senhaRev.qtdUsada, status: senhaRev.status, ativa: senhaRev.ativa }).eq('id', senhaRev.id);
        }
      }
      GUIAS.splice(guiaIdx, 1);
    }
  });

  if (_sb) {
    // Cancela notificações de todos em paralelo
    idsParaExcluir.forEach(eid => {
      _sb.from('notificacoes').delete().eq('agendamento_id', eid).eq('enviada', false).then(() => {});
    });
    // Exclui todos os agendamentos do grupo em uma única operação
    _sb.from('agendamentos').delete().in('id', idsParaExcluir).then(({error}) => {
      if (error) console.error('[Excluir Agendamento Grupo]', error.message);
    });
  }

  // Remove da memória
  idsParaExcluir.forEach(eid => {
    const idx = APPOINTMENTS.findIndex(a => a.id === eid);
    if (idx > -1) APPOINTMENTS.splice(idx, 1);
  });

  try { renderGuiasList(); } catch(e) {}
  closeModal('modal-agendamento');
  renderDayView();
  renderDashboard();
  showToast(
    idsParaExcluir.length > 1
      ? idsParaExcluir.length + ' agendamentos do grupo excluídos.'
      : 'Agendamento excluído.',
    'error'
  );
}
const CAL_ICON  = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2z"/></svg>`;

function statusChip(s) {
  return s === 'Ativo'
    ? `<span class="chip green">Ativo</span>`
    : `<span class="chip gray">Inativo</span>`;
}
function brl(n) { return n != null ? 'R$ ' + Number(n).toFixed(2).replace('.',',') : '—'; }
function formatCurrencyInput(el) {
  let v = el.value.replace(/[^\d]/g,'');
  if (!v) { el.value=''; return; }
  el.value = (parseInt(v)/100).toFixed(2).replace('.',',');
}
function parseBRL(s) { return parseFloat((s||'').replace(/[^\d,]/g,'').replace(',','.')) || 0; }

// ─── PACIENTES ───────────────────────────────────────────────────────────────
function renderPacientesTable(filter='') {
  const list = filter
    ? PACIENTES.filter(p => p.nome.toLowerCase().includes(filter.toLowerCase()) ||
        (p.plano.toLowerCase().includes(filter.toLowerCase())))
    : PACIENTES;
  const colors = ['#4f8ef7','#34d399','#f59e0b','#a78bfa','#fb923c','#f87171'];
  document.getElementById('pacientes-tbody').innerHTML = list.map(p => {
    const initials = p.nome.split(' ').map(n=>n[0]).slice(0,2).join('');
    const col = colors[p.id % colors.length];
    const nascFmt = p.nasc ? p.nasc.split('-').reverse().join('/') : '—';
    const avatarHtml = p.foto
      ? `<div class="avatar-sm" style="overflow:hidden;padding:0"><img src="${p.foto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"></div>`
      : `<div class="avatar-sm" style="background:${col}22;color:${col}">${initials}</div>`;
    return `<tr style="${p.status==='Inativo'?'opacity:.55':''}" >
      <td><div style="display:flex;align-items:center;gap:8px">
        ${avatarHtml}
        <div><div>${p.nome}</div>${p.status==='Inativo'?'<div style="font-size:10px;color:var(--danger)">Inativo</div>':''}</div>
      </div></td>
      <td>${nascFmt}</td>
      <td>${p.tel||'—'}</td>
      <td><span class="chip ${p.plano==='Particular'?'gray':'blue'}">${p.plano||'—'}</span></td>
      <td style="font-family:var(--font-mono);font-size:12px;color:var(--text-muted)">${p.carteirinha||'—'}</td>
      <td style="color:var(--text-muted)">${p.ultima||'—'}</td>
      <td><div class="table-actions">
        <button class="action-btn" title="Editar" onclick="editarPaciente(${p.id})">${EDIT_ICON}</button>
        <button class="action-btn" title="Agendar" onclick="openNovoAgendamento(null,null,'${p.nome}')">${CAL_ICON}</button>
        <button class="action-btn" title="Excluir" style="color:var(--danger)" onclick="excluirPaciente(${p.id})">${DEL_ICON}</button>
      </div></td>
    </tr>`;
  }).join('');
}
function filterPacientes(v) { renderPacientesTable(v); }
function filterProcedimentos(v) { renderProcedimentosTable(v); }

function openNovoPaciente() {
  editingPacId = null;
  document.getElementById('pac-modal-title').textContent = 'Novo Paciente';
  document.getElementById('pac-modal-sub').textContent   = 'Preencha os dados do paciente';
  document.getElementById('pac-btn-inativar').style.display = 'none';
  ['pac-nome','pac-cpf','pac-tel','pac-email','pac-end','pac-carteirinha','pac-titular','pac-profissao','pac-obs'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value = '';
  });
  const nascEl = document.getElementById('pac-nasc'); if(nascEl) nascEl.value = '';
  const valEl  = document.getElementById('pac-val-cart'); if(valEl) valEl.value = '';
  const sexoEl = document.getElementById('pac-sexo'); if(sexoEl) sexoEl.value = '';
  const ecEl   = document.getElementById('pac-estcivil'); if(ecEl) ecEl.value = '';
  const stEl   = document.getElementById('pac-status'); if(stEl) stEl.value = 'Ativo';
  const fotoWrap = document.getElementById('pac-foto-wrap');
  if(fotoWrap) { fotoWrap.style.backgroundImage=''; fotoWrap.innerHTML='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg><span>Foto</span>'; }
  populateSelects();
  openModal('modal-paciente');
}

function editarPaciente(id) {
  const p = PACIENTES.find(x=>x.id===id);
  if (!p) return;
  editingPacId = id;
  document.getElementById('pac-modal-title').textContent = 'Editar Paciente';
  document.getElementById('pac-modal-sub').textContent   = p.nome;
  document.getElementById('pac-btn-inativar').style.display = 'inline-flex';
  document.getElementById('pac-btn-inativar').textContent   = p.status==='Ativo' ? 'Inativar paciente' : 'Reativar paciente';
  document.getElementById('pac-nome').value        = p.nome || '';
  document.getElementById('pac-nasc').value        = p.nasc || '';
  document.getElementById('pac-cpf').value         = p.cpf  || '';
  document.getElementById('pac-tel').value         = p.tel  || '';
  document.getElementById('pac-email').value       = p.email|| '';
  document.getElementById('pac-end').value         = p.end  || '';
  document.getElementById('pac-carteirinha').value = p.carteirinha!=='—' ? p.carteirinha : '';
  document.getElementById('pac-titular').value     = p.titular   || '';
  document.getElementById('pac-profissao').value   = p.profissao || '';
  document.getElementById('pac-obs').value         = p.obs       || '';
  document.getElementById('pac-sexo').value        = p.sexo      || '';
  document.getElementById('pac-estcivil').value    = p.estCivil  || '';
  document.getElementById('pac-status').value      = p.status    || 'Ativo';
  populateSelects();
  const plSel = document.getElementById('pac-plano');
  if(plSel) plSel.value = p.planoId || '';
  // Carrega foto
  const fotoWrapEd = document.getElementById('pac-foto-wrap');
  const fotoDataEd = document.getElementById('pac-foto-data');
  if (fotoDataEd) fotoDataEd.value = p.foto || '';
  if (fotoWrapEd) {
    if (p.foto) {
      fotoWrapEd.innerHTML = `<img src="${p.foto}" style="width:100%;height:100%;object-fit:cover;border-radius:var(--radius-md)">`;
    } else {
      fotoWrapEd.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg><span>Foto</span>';
    }
  }
  openModal('modal-paciente');
}

function toggleStatusPaciente() {
  if (editingPacId === null) return;
  const p = PACIENTES.find(x=>x.id===editingPacId);
  if (!p) return;
  p.status = p.status==='Ativo' ? 'Inativo' : 'Ativo';
  document.getElementById('pac-status').value = p.status;
  document.getElementById('pac-btn-inativar').textContent = p.status==='Ativo' ? 'Inativar paciente' : 'Reativar paciente';
  showToast(`Paciente ${p.status==='Ativo'?'reativado':'inativado'}.`, p.status==='Ativo'?'success':'error');
  renderPacientesTable();
}

// ─── PROFISSIONAIS ───────────────────────────────────────────────────────────
function renderProfissionaisTable() {
  document.getElementById('profissionais-tbody').innerHTML = PROFISSIONAIS.map(p => {
    const prfInitials = p.nome.split(' ').map(n=>n[0]).slice(0,2).join('');
    const prfAvatar = p.foto
      ? `<div class="avatar-sm" style="overflow:hidden;padding:0"><img src="${p.foto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"></div>`
      : `<div class="avatar-sm" style="background:${p.cor}22;color:${p.cor}">${prfInitials}</div>`;
    return `<tr style="${p.status==='Inativo'?'opacity:.55':''}">
      <td><div style="display:flex;align-items:center;gap:10px">
        ${prfAvatar}
        <div><div>${p.nome}</div>${p.status==='Inativo'?'<div style="font-size:10px;color:var(--danger)">Inativo</div>':''}</div>
      </div></td>
      <td>${p.esp}</td>
      <td style="font-family:var(--font-mono);font-size:12px">${p.conselho} ${p.num}/${p.uf}</td>
      <td style="color:var(--text-muted)">${p.tel||'—'}</td>
      <td><div style="display:flex;align-items:center;gap:6px">
        <div style="width:14px;height:14px;border-radius:50%;background:${p.cor}"></div>
        <span style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted)">${p.cor}</span>
      </div></td>
      <td>${statusChip(p.status)}</td>
      <td><div class="table-actions">
        <button class="action-btn" title="Editar" onclick="editarProfissional(${p.id})">${EDIT_ICON}</button>
        <button class="action-btn" title="Excluir" style="color:var(--danger)" onclick="excluirProfissional(${p.id})">${DEL_ICON}</button>
      </div></td>
    </tr>`;
  }).join('');
}

function openNovoProfissional() {
  editingPrfId = null;
  document.getElementById('prof-modal-title').textContent = 'Novo Profissional';
  document.getElementById('prof-modal-sub').textContent   = 'Preencha os dados do profissional';
  document.getElementById('prf-id-display').textContent   = '';
  ['prf-nome','prf-nome-agenda','prf-esp','prf-num-conselho','prf-cbo','prf-tel',
   'prf-email','prf-instagram','prf-linkedin','prf-google-cal-id',
   'prf-valor-30','prf-valor-60','prf-valor-aval'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value = '';
  });
  selectedColor = '#4f8ef7';
  document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
  const first = document.querySelector('.color-swatch[data-color="#4f8ef7"]');
  if(first) first.classList.add('selected');
  document.getElementById('prf-status').value = 'Ativo';
  document.getElementById('prof-data-inc').valueAsDate = new Date();
  openModal('modal-profissional');
}

function editarProfissional(id) {
  const p = PROFISSIONAIS.find(x=>x.id===id);
  if (!p) return;
  editingPrfId = id;
  document.getElementById('prof-modal-title').textContent = 'Editar Profissional';
  document.getElementById('prof-modal-sub').textContent   = p.nome;
  document.getElementById('prf-id-display').textContent   = 'ID: ' + p.id;
  document.getElementById('prf-nome').value           = p.nome           || '';
  document.getElementById('prf-nome-agenda').value    = p.nomeAgenda     || '';
  document.getElementById('prf-esp').value            = p.esp            || '';
  document.getElementById('prf-conselho').value       = p.conselho       || 'CRM';
  document.getElementById('prf-num-conselho').value   = p.num            || '';
  document.getElementById('prf-uf').value             = p.uf             || 'SP';
  document.getElementById('prf-cbo').value            = p.cbo            || '';
  document.getElementById('prf-tel').value            = p.tel            || '';
  document.getElementById('prf-email').value          = p.email          || '';
  document.getElementById('prf-instagram').value      = p.instagram      || '';
  document.getElementById('prf-linkedin').value       = p.linkedin       || '';
  document.getElementById('prf-google-cal-id').value  = p.googleCalendarId|| '';
  document.getElementById('prf-status').value         = p.status         || 'Ativo';
  // Valores por tipo de sessão
  const fmt = v => v ? Number(v).toFixed(2).replace('.',',') : '';
  const v30El   = document.getElementById('prf-valor-30');
  const v60El   = document.getElementById('prf-valor-60');
  const vAvEl   = document.getElementById('prf-valor-aval');
  if (v30El)  v30El.value  = fmt(p.valor30);
  if (v60El)  v60El.value  = fmt(p.valor60);
  if (vAvEl)  vAvEl.value  = fmt(p.valorAval);
  selectedColor = p.cor || '#4f8ef7';
  document.querySelectorAll('.color-swatch').forEach(s => {
    s.classList.toggle('selected', s.dataset.color === p.cor);
  });
  // Carrega foto
  const prfFotoWrap = document.getElementById('prf-foto-wrap');
  const prfFotoData = document.getElementById('prf-foto-data');
  if (prfFotoData) prfFotoData.value = p.foto || '';
  if (prfFotoWrap) {
    if (p.foto) {
      prfFotoWrap.innerHTML = `<img src="${p.foto}" style="width:100%;height:100%;object-fit:cover">`;
    } else {
      prfFotoWrap.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" style="width:28px;height:28px;color:var(--text-muted)"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';
    }
  }
  openModal('modal-profissional');
}
function updateNavBadges() {
  const hoje = new Date().toISOString().slice(0, 10);
  // Badge agenda = agendamentos de hoje pendentes/confirmados
  const badgeAg = document.getElementById('badge-agenda');
  if (badgeAg) {
    const nHoje = APPOINTMENTS.filter(a =>
      a.dataISO === hoje && ['agendado','confirmado'].includes(a.status)
    ).length;
    badgeAg.textContent = nHoje;
    badgeAg.style.display = nHoje > 0 ? '' : 'none';
  }
  // Badge lista de espera = aguardando
  const badgeEsp = document.getElementById('badge-espera');
  if (badgeEsp) {
    const nEsp = LISTA_ESPERA.filter(e => e.status === 'Aguardando').length;
    badgeEsp.textContent = nEsp;
    badgeEsp.style.display = nEsp > 0 ? '' : 'none';
  }
  // Badge guias pendentes
  const badgeGuias = document.getElementById('badge-guias-pendentes');
  if (badgeGuias) {
    const nGuias = GUIAS.filter(g => g.status === 'Pendente').length;
    badgeGuias.textContent = nGuias;
    badgeGuias.style.display = nGuias > 0 ? '' : 'none';
  }
}

function renderProfToday() {
  const hoje = new Date().toISOString().slice(0,10);
  // Conta agendamentos de hoje por profissional (exceto cancelados)
  const counts = {};
  APPOINTMENTS.filter(a => a.dataISO === hoje && a.status !== 'cancelado' && a.status !== 'desmarcado')
    .forEach(a => { counts[a.profId] = (counts[a.profId]||0) + 1; });
  // Mostra só profissionais com agendamentos hoje, ordenados por quantidade
  const profsHoje = PROFISSIONAIS
    .filter(p => counts[p.id] > 0)
    .sort((a,b) => (counts[b.id]||0) - (counts[a.id]||0));
  const el = document.getElementById('prof-today-list');
  if (!el) return;
  if (profsHoje.length === 0) {
    el.innerHTML = '<div style="padding:12px 0;text-align:center;color:var(--text-muted);font-size:12px">Nenhum agendamento hoje</div>';
    return;
  }
  el.innerHTML = profsHoje.map(p =>
    `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
      <div style="width:8px;height:8px;border-radius:50%;background:${p.cor};flex-shrink:0"></div>
      <div style="flex:1;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.nomeAgenda||p.nome.split(' ')[0]}</div>
      <div style="font-size:12px;color:var(--text-muted)">${counts[p.id]} pac.</div>
    </div>`
  ).join('');
}

// renderPlanosGrid moved to CRUD section

// ─── GUIAS SADT CRUD ──────────────────────────────────────────────────────────
let guiaProcCount = 1;

// ── Gera o próximo número de guia para um plano e incrementa numGuiaInicial em memória+DB ──
function proxGuiaNum(planoId) {
  const plano = PLANOS.find(p => p.id === planoId);
  if (!plano) return 'G' + Date.now().toString().slice(-8);
  const num = plano.numGuiaInicial || 1;
  // Incrementa em memória
  plano.numGuiaInicial = num + 1;
  // Persiste no Supabase de forma assíncrona (não bloqueia)
  const sb = window._cfGetDb ? window._cfGetDb() : null;
  if (sb) {
    sb.from('planos_saude').update({ num_guia_inicial: plano.numGuiaInicial }).eq('id', planoId)
      .then(({ error }) => { if (error) console.error('[proxGuiaNum]', error.message); });
  }
  return String(num).padStart(8, '0');
}

function renderGuiasList() {
  // Update stats
  const statsEl = document.getElementById('tiss-stats-row');
  if (statsEl) {
    const total   = GUIAS.reduce((s,g) => s+g.valor, 0);
    const pend    = GUIAS.filter(g=>g.status==='Pendente').length;
    const ultLote = LOTES.filter(l=>l.dataEnvio).sort((a,b)=>b.dataEnvio.localeCompare(a.dataEnvio))[0];
    statsEl.innerHTML =
      '<div class="tiss-info-card"><div class="tiss-info-label">Guias cadastradas</div><div class="tiss-info-value">'+GUIAS.length+'</div></div>' +
      '<div class="tiss-info-card"><div class="tiss-info-label">Valor total</div><div class="tiss-info-value" style="color:var(--success)">'+brl(total)+'</div></div>' +
      '<div class="tiss-info-card"><div class="tiss-info-label">Pendentes de envio</div><div class="tiss-info-value" style="color:var(--warning)">'+pend+'</div></div>' +
      '<div class="tiss-info-card"><div class="tiss-info-label">Último lote</div><div class="tiss-info-value" style="font-size:14px">'+(ultLote?ultLote.dataCriacao.split('-').reverse().join('/'):'—')+'</div></div>';
  }

  // Populate filters
  const fpEl = document.getElementById('tiss-filtro-plano');
  if (fpEl && fpEl.options.length <= 1) {
    PLANOS.filter(p=>p.nome!=='Particular').forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id; opt.textContent = p.nome;
      fpEl.appendChild(opt);
    });
  }

  const statusFiltro = document.getElementById('tiss-filtro-status')?.value || '';
  const planoFiltro  = parseInt(document.getElementById('tiss-filtro-plano')?.value  || '0');
  const buscaPac     = (document.getElementById('tiss-busca-pac')?.value || '').toLowerCase().trim();

  let list = GUIAS;
  if (statusFiltro) list = list.filter(g=>g.status===statusFiltro);
  if (planoFiltro)  list = list.filter(g=>g.planoId===planoFiltro);
  if (buscaPac)     list = list.filter(g=>(g.pac||'').toLowerCase().includes(buscaPac));

  const el = document.getElementById('guias-list');
  if (!el) return;

  if (!list.length) {
    el.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted)">Nenhuma guia encontrada.</div>';
    return;
  }

  el.innerHTML = '';
  list.forEach(g => {
    const chipClass = g.status==='Enviado'?'blue':g.status==='Pago'?'green':g.status==='Glosado'?'red':'yellow';
    const prof = PROFISSIONAIS.find(p=>p.id===g.profId);
    const card = document.createElement('div');
    card.className = 'guide-card';
    card.innerHTML =
      '<div class="guide-num" style="font-size:11px">#'+g.num+
        (g.loteNum?'<span style="margin-left:6px;background:rgba(79,142,247,0.15);color:var(--accent);padding:1px 5px;border-radius:3px;font-size:10px">Lote '+g.loteNum+'</span>':'')+
      '</div>' +
      '<div class="guide-patient">'+g.pac+'<div style="font-size:11px;color:var(--text-muted)">'+(prof?prof.nome:'—')+'</div></div>' +
      '<div class="guide-plan">'+g.plano+'</div>' +
      '<div class="guide-value">'+brl(g.valor)+'</div>' +
      '<span class="chip '+chipClass+'" style="min-width:72px;justify-content:center">'+g.status+'</span>' +
      '<div class="guide-actions" style="display:flex;gap:4px"></div>';
    const actionsEl = card.querySelector('.guide-actions');

    // Edit button
    const editBtn = document.createElement('button');
    editBtn.className = 'action-btn'; editBtn.title = 'Editar';
    editBtn.innerHTML = EDIT_ICON;
    editBtn.addEventListener('click', () => editarGuia(g.id));
    actionsEl.appendChild(editBtn);

    // Print button
    const printBtn = document.createElement('button');
    printBtn.className = 'action-btn'; printBtn.title = 'Imprimir';
    printBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>';
    printBtn.addEventListener('click', () => imprimirGuiaById(g.id));
    actionsEl.appendChild(printBtn);

    const delGuiaBtn = document.createElement('button');
    delGuiaBtn.className='action-btn'; delGuiaBtn.title='Excluir'; delGuiaBtn.style.color='var(--danger)';
    delGuiaBtn.innerHTML = DEL_ICON;
    delGuiaBtn.addEventListener('click', () => excluirGuia(g.id));
    actionsEl.appendChild(delGuiaBtn);

    el.appendChild(card);
  });
}

