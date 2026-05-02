// ═══════════════════════════════════════
//  DRAG & DROP — AGENDA
// ═══════════════════════════════════════
let _dragApptId = null;   // id do agendamento sendo arrastado
let _dragEl     = null;   // elemento DOM do card

function agendaDragStart(event, apptId) {
  _dragApptId = apptId;
  _dragEl = event.currentTarget;

  // Transfere dados via dataTransfer (compatibilidade)
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', String(apptId));

  // Ghost image customizado — nome do paciente + hora
  const appt = APPOINTMENTS.find(a => a.id === apptId);
  if (appt) {
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.textContent = appt.paciente + '  ' + appt.hora;
    document.body.appendChild(ghost);
    ghost.style.left = '-999px';
    ghost.style.top  = '-999px';
    try { event.dataTransfer.setDragImage(ghost, 60, 20); } catch(e) {}
    setTimeout(() => ghost.remove(), 0);
  }

  // Marca o card original como "esmaecido"
  requestAnimationFrame(() => {
    if (_dragEl) _dragEl.classList.add('dragging');
  });
}

function agendaDragEnd(event) {
  if (_dragEl) _dragEl.classList.remove('dragging');
  _dragEl = null;
  // Remove todos os highlights de drop
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
}

function agendaDayDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  // Destaca o slot-row sob o cursor
  const cell = event.currentTarget;
  if (!cell.classList.contains('drag-over')) {
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    cell.classList.add('drag-over');
  }
}

function agendaDragLeave(event) {
  // Só remove se saiu de fato da célula (não entrou em filho)
  if (!event.currentTarget.contains(event.relatedTarget)) {
    event.currentTarget.classList.remove('drag-over');
  }
}

// Drop na vista DIA — muda profissional e horário
function agendaDayDrop(event, novoProfId, novaHora) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');

  const apptId = _dragApptId || parseInt(event.dataTransfer.getData('text/plain'));
  if (!apptId) return;

  const appt = APPOINTMENTS.find(a => a.id === apptId);
  if (!appt) return;

  const profIdNum = parseInt(novoProfId);
  const profAtual = appt.profId;
  const horaAtual = appt.hora;

  // Nada mudou
  if (profIdNum === profAtual && novaHora === horaAtual) return;

  // Checa conflito: já existe agendamento nesse slot?
  const conflito = APPOINTMENTS.find(a =>
    a.id !== apptId &&
    a.profId === profIdNum &&
    a.hora === novaHora &&
    a.dataISO === appt.dataISO
  );
  if (conflito) {
    showToast('Já existe um agendamento nesse horário para este profissional.', 'error');
    return;
  }

  moverAgendamento(appt, { profId: profIdNum, hora: novaHora });
}

// Drop na vista SEMANA — muda data e horário (mantém profissional)
function agendaWeekDrop(event, novaData, novaHora) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');

  const apptId = _dragApptId || parseInt(event.dataTransfer.getData('text/plain'));
  if (!apptId) return;

  const appt = APPOINTMENTS.find(a => a.id === apptId);
  if (!appt) return;

  // Nada mudou
  if (novaData === appt.dataISO && novaHora === appt.hora) return;

  // Checa conflito
  const conflito = APPOINTMENTS.find(a =>
    a.id !== apptId &&
    a.profId === appt.profId &&
    a.hora === novaHora &&
    a.dataISO === novaData
  );
  if (conflito) {
    showToast('Já existe um agendamento nesse horário.', 'error');
    return;
  }

  moverAgendamento(appt, { dataISO: novaData, hora: novaHora });
}

// Aplica a mudança, salva no Supabase e re-renderiza
async function moverAgendamento(appt, mudancas) {
  const antes = {
    profId:  appt.profId,
    hora:    appt.hora,
    dataISO: appt.dataISO,
  };

  // Aplica localmente
  Object.assign(appt, mudancas);

  // Atualiza horaFim proporcionalmente
  if (mudancas.hora && appt.durMin) {
    try {
      const [hh, mm] = mudancas.hora.split(':').map(Number);
      const totalMin = hh * 60 + mm + appt.durMin;
      appt.horaFim = String(Math.floor(totalMin / 60)).padStart(2,'0') + ':' + String(totalMin % 60).padStart(2,'0');
    } catch(e) {}
  }

  // Feedback visual imediato
  const prof = PROFISSIONAIS.find(p => p.id === appt.profId);
  const profNome = prof ? (prof.nomeAgenda || prof.nome.split(' ')[0]) : '';
  const dataFmt = appt.dataISO ? appt.dataISO.split('-').reverse().join('/') : '';
  showToast(
    'Movido para ' + appt.hora + (dataFmt ? ' · ' + dataFmt : '') + (profNome ? ' · ' + profNome : ''),
    'success'
  );

  // Persiste no Supabase
  try {
    const sb = window._cfGetDb ? window._cfGetDb() : null;
    if (sb) {
      const payload = {};
      if (mudancas.profId  !== undefined) payload.prof_id  = appt.profId;
      if (mudancas.hora    !== undefined) { payload.hora = appt.hora; payload.hora_fim = appt.horaFim || null; }
      if (mudancas.dataISO !== undefined) payload.data_iso = appt.dataISO;
      const { error } = await sb.from('agendamentos').update(payload).eq('id', appt.id);
      if (error) {
        // Reverte se falhou
        Object.assign(appt, antes);
        showToast('Erro ao salvar: ' + error.message, 'error');
      }
    }
  } catch(e) {
    console.error('[Drag&Drop]', e);
  }

  // Re-renderiza a view ativa
  if (currentView === 'semana') renderWeekView();
  else renderDayView();
}


function getProfisComAgendaHoje() {
  const cd = currentDate;
  const iso = cd.getFullYear()+'-'+String(cd.getMonth()+1).padStart(2,'0')+'-'+String(cd.getDate()).padStart(2,'0');
  const idsComAgenda = new Set(APPOINTMENTS.filter(a => a.dataISO === iso && a.status !== 'cancelado').map(a => a.profId));
  return PROFISSIONAIS.filter(p => idsComAgenda.has(p.id));
}

function buildProfFilters() {
  const profsHoje = getProfisComAgendaHoje();
  // Garante que activeProfFilters só contém profs com agenda hoje
  const idsHoje = new Set(profsHoje.map(p => p.id));
  // Remove do filtro os que não têm agenda hoje
  for (const id of [...activeProfFilters]) { if (!idsHoje.has(id)) activeProfFilters.delete(id); }
  // Adiciona todos que têm agenda hoje (caso ainda não estejam)
  profsHoje.forEach(p => activeProfFilters.add(p.id));

  const list = document.getElementById('prof-filter-list');
  if (!list) return;
  list.innerHTML = profsHoje.length === 0
    ? '<div style="padding:10px 14px;font-size:12px;color:var(--text-muted)">Nenhum profissional com agenda hoje</div>'
    : profsHoje.map(p => `
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:7px 14px;transition:background .15s;border-radius:0" onmouseenter="this.style.background='var(--bg-raised)'" onmouseleave="this.style.background=''" onclick="event.preventDefault();toggleProfFilter(${p.id})">
        <span class="prof-check-box" id="pcheck-${p.id}" style="width:15px;height:15px;border-radius:3px;border:1.5px solid ${p.cor};background:${activeProfFilters.has(p.id)?p.cor:'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s">
          ${activeProfFilters.has(p.id)?'<svg viewBox="0 0 12 12" fill="white" style="width:9px;height:9px"><path d="M1.5 6l3 3 6-6" stroke="white" stroke-width="1.5" fill="none"/></svg>':''}
        </span>
        <span style="width:8px;height:8px;border-radius:50%;background:${p.cor};flex-shrink:0"></span>
        <span style="font-size:13px;color:var(--text-primary)">${p.nomeAgenda || p.nome.split(' ')[0]}</span>
        <span style="font-size:11px;color:var(--text-muted);margin-left:auto">${p.esp||''}</span>
      </label>`).join('');
  updateProfFilterLabel(profsHoje);
}

function toggleProfFilter(id) {
  activeProfFilters.has(id) ? activeProfFilters.delete(id) : activeProfFilters.add(id);
  const profsHoje = getProfisComAgendaHoje();
  const box = document.getElementById('pcheck-'+id);
  const p = PROFISSIONAIS.find(x=>x.id===id);
  if (box && p) {
    box.style.background = activeProfFilters.has(id) ? p.cor : 'transparent';
    box.innerHTML = activeProfFilters.has(id) ? '<svg viewBox="0 0 12 12" fill="white" style="width:9px;height:9px"><path d="M1.5 6l3 3 6-6" stroke="white" stroke-width="1.5" fill="none"/></svg>' : '';
  }
  updateProfFilterLabel(profsHoje);
  updateAllCheck(profsHoje);
  renderAgenda();
}

function toggleAllProfs(e) {
  e.stopPropagation();
  const profsHoje = getProfisComAgendaHoje();
  const allOn = profsHoje.every(p => activeProfFilters.has(p.id));
  if (allOn) { profsHoje.forEach(p => activeProfFilters.delete(p.id)); }
  else        { profsHoje.forEach(p => activeProfFilters.add(p.id)); }
  buildProfFilters();
  renderAgenda();
}

function updateProfFilterLabel(profsHoje) {
  const lbl = document.getElementById('prof-filter-label');
  if (!lbl) return;
  const total = profsHoje.length;
  const sel = profsHoje.filter(p => activeProfFilters.has(p.id)).length;
  if (sel === 0)     lbl.textContent = 'Nenhum selecionado';
  else if (sel === total) lbl.textContent = total === 1 ? (profsHoje[0].nomeAgenda||profsHoje[0].nome.split(' ')[0]) : 'Todos os profissionais';
  else if (sel === 1) { const p = profsHoje.find(p => activeProfFilters.has(p.id)); lbl.textContent = p.nomeAgenda||p.nome.split(' ')[0]; }
  else lbl.textContent = sel + ' profissionais';
  updateAllCheck(profsHoje);
}

function updateAllCheck(profsHoje) {
  const allBox = document.getElementById('prof-filter-all-check');
  if (!allBox) return;
  const allOn = profsHoje.length > 0 && profsHoje.every(p => activeProfFilters.has(p.id));
  allBox.style.background = allOn ? 'var(--accent)' : 'transparent';
  allBox.style.borderColor = allOn ? 'var(--accent)' : 'var(--border-mid)';
  allBox.innerHTML = allOn ? '<svg viewBox="0 0 12 12" fill="white" style="width:9px;height:9px"><path d="M1.5 6l3 3 6-6" stroke="white" stroke-width="1.5" fill="none"/></svg>' : '';
}

function toggleProfDropdown() {
  const dd = document.getElementById('prof-filter-dropdown');
  const ch = document.getElementById('prof-filter-chevron');
  if (!dd) return;
  const open = dd.style.display === 'block';
  dd.style.display = open ? 'none' : 'block';
  if (ch) ch.style.transform = open ? '' : 'rotate(180deg)';
  if (!open) buildProfFilters();
}

function toggleLegenda() {
  const dd = document.getElementById('legenda-dropdown');
  if (!dd) return;
  dd.style.display = dd.style.display === 'block' ? 'none' : 'block';
}

// Fecha dropdown ao clicar fora
document.addEventListener('click', function(e) {
  const wrap = document.getElementById('prof-filter-wrap');
  if (wrap && !wrap.contains(e.target)) {
    const dd = document.getElementById('prof-filter-dropdown');
    const ch = document.getElementById('prof-filter-chevron');
    if (dd) dd.style.display = 'none';
    if (ch) ch.style.transform = '';
  }
  const legendaWrap = document.getElementById('legenda-wrap');
  if (legendaWrap && !legendaWrap.contains(e.target)) {
    const ld = document.getElementById('legenda-dropdown');
    if (ld) ld.style.display = 'none';
  }
});

