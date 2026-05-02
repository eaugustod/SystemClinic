// ═══════════════════════════════════════
//  AGENDA — DAY VIEW
// ═══════════════════════════════════════
const HOURS = ['07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00','21:30','22:00','22:30','23:00'];

function renderAgenda() {
  updateDateLabel();
  if (currentView==='mes')     renderMonthView();
  else if (currentView==='semana') renderWeekView();
  else                              renderDayView();
}

function renderDayView() {
  const cd = currentDate;
  const currentISO = cd.getFullYear()+'-'+String(cd.getMonth()+1).padStart(2,'0')+'-'+String(cd.getDate()).padStart(2,'0');

  const profs = PROFISSIONAIS.filter(p => activeProfFilters.has(p.id));
  document.getElementById('agenda-header').innerHTML =
    `<div class="time-header-spacer"></div>` +
    profs.map(p => `<div class="prof-header">
      <div class="prof-color-dot" style="background:${p.cor}"></div>
      <div><div class="prof-header-name">${p.nomeAgenda || p.nome.split(' ')[0]}</div><div class="prof-header-spec">${p.esp}</div></div>
    </div>`).join('');

  document.getElementById('time-col').innerHTML = HOURS.map(h =>
    `<div class="time-slot">${h}</div>`).join('');

  document.getElementById('prof-cols').innerHTML = profs.map(p => {
    const appts = APPOINTMENTS.filter(a => a.profId === p.id && a.dataISO === currentISO);
    return `<div class="prof-col">${HOURS.map(h => {
      const appt      = appts.find(a => a.hora === h);
      const bloqueio  = getBloqueioDoSlot(p.id, currentISO, h);
      const dropAttrs = bloqueio
        ? `data-prof-id="${p.id}" data-hora="${h}"`
        : `ondragover="agendaDayDragOver(event)" ondragleave="agendaDragLeave(event)" ondrop="agendaDayDrop(event,${p.id},'${h}')" data-prof-id="${p.id}" data-hora="${h}"`;
      const clickAttr = bloqueio
        ? `onclick="slotBloqueadoClick(event,${bloqueio.id})"`
        : `onclick="slotClick(event,${p.id},'${h}')"`;
      const bloqueioCard = bloqueio && !appt
        ? `<div class="bloqueio-card" style="height:58px;top:2px" onclick="event.stopPropagation();slotBloqueadoClick(event,${bloqueio.id})">
             <span class="bloqueio-card-icon">🔒</span>
             <span class="bloqueio-card-text">${bloqueio.motivo || 'Agenda bloqueada'}</span>
           </div>`
        : '';
      return `<div class="slot-row${bloqueio ? ' bloqueado' : ''}" ${clickAttr} ${dropAttrs}>${appt ? buildApptCard(appt, p.cor) : bloqueioCard}</div>`;
    }).join('')}</div>`;
  }).join('');
}

function buildApptCard(appt, cor) {
  const sc = 'status-' + appt.status;
  const h  = Math.round((appt.durMin/30)*64) - 4;
  const hasGuia  = !!appt.guia;
  const plano    = appt.plano || '';
  const guiaIcon = hasGuia
    ? '<span title="Guia SADT gerada" style="color:#34d399;font-size:10px;margin-left:4px">✓ Guia</span>'
    : (plano !== 'Particular' ? '<span style="color:var(--warning);font-size:10px;margin-left:4px">⚠ s/ guia</span>' : '');

  const statusLabels = { agendado:'Agendado', confirmado:'Confirmado', atendido:'Atendido', desmarcado:'Desmarcado', chegou:'Em Espera' };
  const statusColors = { agendado:'#60a5fa', confirmado:'#a78bfa', atendido:'#34d399', desmarcado:'#f87171', chegou:'#facc15' };
  const statusLabel  = (appt.status === 'atendido' || appt.status === 'desmarcado' || appt.status === 'chegou')
    ? '<span style="font-size:10px;font-weight:600;color:' + statusColors[appt.status] + ';margin-left:4px">[' + statusLabels[appt.status] + ']</span>'
    : '';

  // ── CARD DE GRUPO ────────────────────────────────────────────────────────
  if (appt.isGrupo && appt.groupId) {
    const currentISO = appt.dataISO;
    const membros = APPOINTMENTS.filter(a => a.groupId === appt.groupId && a.dataISO === currentISO);
    const total   = membros.length;

    let actionsGrupo = '';
    if (appt.status === 'agendado') {
      actionsGrupo = '<div class="appt-actions">' +
        '<button class="appt-action-btn btn-confirmar" onclick="event.stopPropagation();grupoUpdateStatus(\'' + appt.groupId + '\',\'' + currentISO + '\',\'confirmado\')">Confirmar todos</button>' +
        '<button class="appt-action-btn btn-desmarcar" onclick="event.stopPropagation();grupoUpdateStatus(\'' + appt.groupId + '\',\'' + currentISO + '\',\'desmarcado\')">Desmarcar</button>' +
        '</div>';
    } else if (appt.status === 'confirmado') {
      actionsGrupo = '<div class="appt-actions">' +
        '<button class="appt-action-btn btn-em-espera" onclick="event.stopPropagation();grupoUpdateStatus(\'' + appt.groupId + '\',\'' + currentISO + '\',\'chegou\')">Em Espera</button>' +
        '<button class="appt-action-btn btn-atendido" onclick="event.stopPropagation();grupoUpdateStatus(\'' + appt.groupId + '\',\'' + currentISO + '\',\'atendido\')">Atendido</button>' +
        '</div>';
    } else if (appt.status === 'chegou') {
      actionsGrupo = '<div class="appt-actions">' +
        '<button class="appt-action-btn btn-atendido" onclick="event.stopPropagation();grupoUpdateStatus(\'' + appt.groupId + '\',\'' + currentISO + '\',\'atendido\')">Atendido</button>' +
        '</div>';
    }

    return '<div class="appt-card ' + sc + ' grupo-card"' +
      ' data-appt-id="' + appt.id + '"' +
      ' data-group-id="' + appt.groupId + '"' +
      ' style="height:' + h + 'px;top:2px;position:relative"' +
      ' onclick="event.stopPropagation();openAppt(' + appt.id + ')"' +
      ' onmouseenter="grupoTooltipShow(event,\'' + appt.groupId + '\',\'' + currentISO + '\')"' +
      ' onmouseleave="grupoTooltipHide()">' +
      '<div class="appt-patient" style="display:flex;align-items:center;gap:5px">' +
        '<svg viewBox="0 0 24 24" fill="currentColor" style="width:12px;height:12px;flex-shrink:0;color:#a78bfa"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.95v2h6v-2c0-2.66-5.33-4-8-4z"/></svg>' +
        '<strong>Sessão em Grupo</strong>' +
        statusLabel +
      '</div>' +
      '<div class="appt-plan" style="display:flex;align-items:center;gap:4px">' +
        '<span style="color:#a78bfa;font-weight:600">' + total + ' paciente' + (total !== 1 ? 's' : '') + '</span>' +
        '<span style="color:var(--text-muted)">· ' + appt.hora + '</span>' +
      '</div>' +
      actionsGrupo +
      '</div>';
  }

  // ── CARD INDIVIDUAL (hasGuia e guiaIcon já declarados no topo da função) ──

  let actionsHTML = '';
  if (appt.status === 'agendado') {
    actionsHTML = '<div class="appt-actions">' +
      '<button class="appt-action-btn btn-confirmar" onclick="event.stopPropagation();updateStatus(' + appt.id + ',\'confirmado\')">Confirmar</button>' +
      '<button class="appt-action-btn btn-desmarcar" onclick="event.stopPropagation();updateStatus(' + appt.id + ',\'desmarcado\')">Desmarcar</button>' +
      '</div>';
  } else if (appt.status === 'confirmado') {
    actionsHTML = '<div class="appt-actions">' +
      '<button class="appt-action-btn btn-em-espera" onclick="event.stopPropagation();updateStatus(' + appt.id + ',\'chegou\')">Em Espera</button>' +
      '<button class="appt-action-btn btn-atendido" onclick="event.stopPropagation();updateStatus(' + appt.id + ',\'atendido\')">Atendido</button>' +
      '<button class="appt-action-btn btn-desmarcar" onclick="event.stopPropagation();updateStatus(' + appt.id + ',\'desmarcado\')">Desmarcar</button>' +
      '</div>';
  } else if (appt.status === 'chegou') {
    actionsHTML = '<div class="appt-actions">' +
      '<button class="appt-action-btn btn-atendido" onclick="event.stopPropagation();updateStatus(' + appt.id + ',\'atendido\')">Atendido</button>' +
      '</div>';
  }

  const waSentTxt = appt.waSent ? '✓ Enviado' : 'WhatsApp';
  const waBtnHTML = (appt.status === 'agendado' || appt.status === 'confirmado') && h >= 56
    ? '<div style="margin-top:3px"><button class="wa-btn" onclick="event.stopPropagation();abrirModalWA(' + appt.id + ')">' + waSentTxt + '</button></div>'
    : '';

  return '<div class="appt-card ' + sc + '"' +
    ' draggable="true"' +
    ' data-appt-id="' + appt.id + '"' +
    ' style="height:' + h + 'px;top:2px"' +
    ' onclick="event.stopPropagation();openAppt(' + appt.id + ')"' +
    ' ondragstart="agendaDragStart(event,' + appt.id + ')"' +
    ' ondragend="agendaDragEnd(event)">' +
    '<div class="appt-patient">' + appt.paciente + guiaIcon + statusLabel + '</div>' +
    '<div class="appt-plan">' + plano + ' · ' + appt.hora + '</div>' +
    actionsHTML + waBtnHTML +
    '</div>';
}

function updateStatus(id, status) {
  const appt = APPOINTMENTS.find(a => a.id === id);
  if (!appt) return;
  appt.status = status;
  // Auto-register in historico when marked as attended
  if (status === 'atendido') try { registrarAtendimento(id); } catch(e) {}
  const msgs  = { confirmado:'Consulta confirmada!', atendido:'Marcado como atendido!', chegou:'Paciente em espera!', desmarcado:'Consulta desmarcada.', cancelado:'Agendamento cancelado.' };
  const types = { confirmado:'success', atendido:'success', chegou:'success', desmarcado:'error', cancelado:'error' };
  showToast(msgs[status] || 'Status atualizado.', types[status] || 'success');
  renderDayView();
}

function marcarEmEspera() {
  if (!currentApptId) return;
  updateStatus(currentApptId, 'chegou');
  closeModal('modal-agendamento');
}

function marcarAtendidoModal() {
  if (!currentApptId) return;
  updateStatus(currentApptId, 'atendido');
  closeModal('modal-agendamento');
}

function slotClick(e, profId, hora) {
  if (e.target.closest('.appt-card') || e.target.closest('.appt-action-btn')) return;
  const currentISO = currentDate.toISOString().split('T')[0];
  if (slotBloqueado(profId, currentISO, hora)) {
    const b = getBloqueioDoSlot(profId, currentISO, hora);
    slotBloqueadoClick(e, b ? b.id : null);
    return;
  }
  openNovoAgendamento(profId, hora);
}

function slotBloqueadoClick(e, bloqueioId) {
  if (e && e.stopPropagation) e.stopPropagation();
  const b = BLOQUEIOS.find(x => x.id === bloqueioId);
  if (!b) { showToast('🔒 Este horário está bloqueado.', 'warning'); return; }
  const prof = PROFISSIONAIS.find(p => p.id === b.profId);
  const profNome = prof?.nomeAgenda || prof?.nome || 'Profissional';
  const horario  = b.diaTodo ? 'dia todo' : `${b.horaIni} – ${b.horaFim}`;
  const periodo  = b.dataIni === b.dataFim
    ? formatDateBR(b.dataIni)
    : `${formatDateBR(b.dataIni)} a ${formatDateBR(b.dataFim)}`;
  const msg = `🔒 Agenda bloqueada — ${profNome}\n${periodo} · ${horario}${b.motivo ? '\nMotivo: ' + b.motivo : ''}\n\nRemover este bloqueio?`;
  if (confirm(msg)) {
    removerBloqueio(b.id);
  }
}

// ═══════════════════════════════════════
//  ABRIR AGENDAMENTO EXISTENTE
// ═══════════════════════════════════════
function openAppt(id) {
  const appt = APPOINTMENTS.find(a => a.id === id);
  if (!appt) return;
  currentApptId = id;
  const prof = PROFISSIONAIS.find(p => p.id === appt.profId);
  populateSelects();

  document.getElementById('ag-modal-title').textContent = 'Agendamento — ' + appt.paciente;
  document.getElementById('ag-modal-sub').textContent   = appt.hora + (appt.horaFim?' – '+appt.horaFim:'') + ' · ' + (prof ? prof.nomeAgenda||prof.nome : '') + ' · ' + appt.plano;
  document.getElementById('ag-profissional').value      = appt.profId;
  document.getElementById('ag-data').value = appt.dataISO || '';
  document.getElementById('ag-hora-ini').value          = appt.hora;
  document.getElementById('ag-hora-fim').value          = appt.horaFim || '';
  document.getElementById('ag-paciente').value          = appt.paciente;
  document.getElementById('ag-status').value            = appt.status;
  // Seta plano e carteirinha do agendamento (evita resetar para o primeiro da lista)
  const agPlanoSel = document.getElementById('ag-plano');
  if (agPlanoSel && appt.planoId) {
    agPlanoSel.value = appt.planoId;
    // Se não encontrou na lista, tenta pelo nome
    if (agPlanoSel.value != appt.planoId) {
      const planoByName = PLANOS.find(p => p.nome === appt.plano);
      if (planoByName) agPlanoSel.value = planoByName.id;
    }
  }
  document.getElementById('ag-carteirinha').value = appt.carteirinha || '';
  document.getElementById('ag-obs').value               = appt.obs || '';

  // Duration select
  const dur = appt.durMin || 30;
  const durSel = document.getElementById('ag-duracao');
  const knownDurs = [30,45,60,90,120];
  durSel.value = knownDurs.includes(dur) ? dur : 0;

  // Modalidade
  const modalidade = appt.modalidade || 'presencial';
  document.getElementById('ag-presencial').checked = modalidade === 'presencial';
  document.getElementById('ag-online').checked     = modalidade === 'online';
  agModalidadeChange();
  document.getElementById('ag-meet-link').value = appt.meetLink || '';

  // Cancel button — show only for editable statuses
  const cancelBtn = document.getElementById('btn-cancelar-agendamento');
  if (cancelBtn) cancelBtn.style.display = ['agendado','confirmado'].includes(appt.status) ? 'inline-flex' : 'none';
  // Cancelou terapia — mostra quando o agendamento está ativo (cancela todos os futuros do paciente)
  const cancelTerapiaBtn = document.getElementById('btn-cancelou-terapia');
  if (cancelTerapiaBtn) cancelTerapiaBtn.style.display = ['agendado','confirmado','chegou','atendido'].includes(appt.status) ? 'inline-flex' : 'none';
  const delAgBtn = document.getElementById('btn-excluir-agendamento');
  if (delAgBtn) delAgBtn.style.display = 'inline-flex';
  // Em Espera — visível apenas quando confirmado
  const emEsperaModalBtn = document.getElementById('btn-em-espera-modal');
  if (emEsperaModalBtn) emEsperaModalBtn.style.display = appt.status === 'confirmado' ? 'inline-flex' : 'none';
  // Atendido — visível quando confirmado ou chegou (em espera)
  const atendidoModalBtn = document.getElementById('btn-atendido-modal');
  if (atendidoModalBtn) atendidoModalBtn.style.display = ['confirmado','chegou'].includes(appt.status) ? 'inline-flex' : 'none';

  // Guia badge
  if (appt.guia) {
    document.getElementById('sadt-badge').style.display = 'inline';
    document.getElementById('btn-imprimir-guia').style.display = 'flex';
  } else {
    document.getElementById('sadt-badge').style.display = 'none';
    document.getElementById('btn-imprimir-guia').style.display = 'none';
  }

  autoFillSadt(appt);
  switchAgTab('dados', document.getElementById('tab-dados'));
  openModal('modal-agendamento');
}

function autoFillSadt(appt) {
  const pac   = PACIENTES.find(p => p.nome === appt.paciente);
  const plano = PLANOS.find(pl => pl.id === (appt.planoId || 0) || pl.nome === appt.plano);
  const prof  = PROFISSIONAIS.find(p => p.id === appt.profId);

  // Resolve the appointment date
  const apptDate = appt.dataISO
    ? new Date(appt.dataISO + 'T12:00:00')
    : currentDate;

  const sv = (id, val) => { const el=document.getElementById(id); if(el && val) el.value=val; };

  // ── Beneficiário (campos 9-12) ──────────────────────────────────────
  if (pac) {
    sv('sadt-beneficiario',    pac.nome);
    sv('sadt-carteira',        pac.carteirinha !== '—' ? pac.carteirinha : '');
    sv('sadt-id-beneficiario', pac.carteirinha !== '—' ? pac.carteirinha : '');
    sv('sadt-nasc',            pac.nasc || '');
    // CNS do paciente (campo específico se existir)
    sv('sadt-cns-beneficiario', pac.cns || '');
  }

  // ── Operadora (campos 1-4) ───────────────────────────────────────────
  if (plano) {
    sv('sadt-ans',       plano.ans !== '—' ? plano.ans : '');
    sv('sadt-operadora', plano.nomeGuia || plano.nome || '');
    const lbl = document.getElementById('sadt-versao-tiss-label');
    if (lbl) lbl.textContent = 'TISS ' + (plano.versaoTiss || '4.02.00');

    // Guia number — apenas sequencial (sem código do prestador)
    const guiaSeq = String(plano.numGuiaInicial || (GUIAS.length + 1));
    sv('sadt-guia-prestador', guiaSeq);
    const disp = document.getElementById('sadt-guia-num-display');
    if (disp) disp.textContent = guiaSeq;

    // Campos 13-14: Prestador contratado
    sv('sadt-cod-prestador',  plano.codPrestador  || CLINICA.codPrestador || '');
    sv('sadt-prestador',      plano.nomeContratado|| CLINICA.nome || '');
    sv('sadt-cnes',           plano.cnes          || CLINICA.cnes || '');

    // Campos 29-30: Executante (contratado)
    sv('sadt-exec-cod',  plano.codPrestador  || CLINICA.codPrestador || '');
    sv('sadt-exec-nome', plano.nomeContratado|| CLINICA.nome || '');

    // Senhas/autorizações — busca por paciente+plano, com ou sem carteirinha
    const cartPac = pac?.carteirinha && pac.carteirinha !== '—' ? pac.carteirinha : null;
    const senhaObj = SENHAS_PLANO.find(s =>
      s.ativa &&
      s.planoId === plano.id &&
      (s.paciente === appt.paciente || s.paciente.toLowerCase() === appt.paciente.toLowerCase()) &&
      (cartPac ? (s.carteirinha === cartPac || !s.carteirinha) : true) &&
      s.qtdUsada < s.qtdAutorizada
    );
    if (senhaObj) {
      sv('sadt-senha',          senhaObj.numSenha);
      sv('sadt-autorizacao',    senhaObj.numSenha);
      sv('sadt-guia-principal', senhaObj.numGuiaOp || '');
      // Validade da senha
      const valEl = document.getElementById('sadt-val-senha');
      if (valEl && senhaObj.validade) valEl.value = senhaObj.validade;
      // Campo 4 — Data de autorização (vem da senha)
      const autDtEl = document.getElementById('sadt-dt-autorizacao');
      if (autDtEl && senhaObj.dataAut) autDtEl.value = senhaObj.dataAut;
      // Campo 6 — Validade da senha
      // (já preenchido acima com sadt-val-senha)
      // Campo 23 — Indicação clínica (CID da senha)
      const indicEl = document.getElementById('sadt-indicacao');
      if (indicEl && senhaObj.cid) indicEl.value = senhaObj.cid;
      // Campos 25/26 (procedimentos solicitados) e 40 (executados) + valor
      const procsParaPreencher = senhaObj.procs && senhaObj.procs.length > 0
        ? senhaObj.procs
        : PROCEDIMENTOS.slice(0, 1).map(p => ({ codigo: p.codigo, desc: p.desc }));

      procsParaPreencher.forEach((proc, idx) => {
        // Busca informações completas do procedimento
        const procObj = PROCEDIMENTOS.find(p =>
          (proc.codigo && p.codigo === proc.codigo) ||
          (proc.desc   && p.desc?.toLowerCase().includes(proc.desc.toLowerCase().substring(0,10)))
        );
        const codFinal  = proc.codigo || procObj?.codigo || '';
        const descFinal = proc.desc   || procObj?.desc   || '';
        // Campo 46: valor pelo plano do paciente (prioriza valPlano do plano específico)
        const valPorPlano = plano ? (
          PROCEDIMENTOS.find(p => p.codigo === codFinal && p.planoId === plano.id)?.valPlano ||
          procObj?.valPlano || procObj?.valPart || 0
        ) : (procObj?.valPart || procObj?.valPlano || 0);
        const valFinal = valPorPlano;

        // Campo 25 — Código do procedimento solicitado
        const codEl25  = document.getElementById('sadt-proc-cod-'  + idx);
        // Campo 26 — Descrição do procedimento solicitado
        const descEl26 = document.getElementById('sadt-proc-desc-' + idx);
        // Campo 40 — Código do procedimento executado
        const codEl40  = document.getElementById('sadt-ep-cod-'    + idx);
        // Descrição executado
        const descEl40d= document.getElementById('sadt-ep-desc-'   + idx);
        // Valor executado
        const valEl    = document.getElementById('sadt-ep-val-'    + idx);

        if (codEl25)   codEl25.value   = codFinal;
        if (descEl26)  descEl26.value  = descFinal;
        if (codEl40)   codEl40.value   = codFinal;
        if (descEl40d) descEl40d.value = descFinal;
        if (valEl && valFinal > 0) {
          valEl.value = valFinal.toFixed(2).replace('.', ',');
          recalcTotal();
        }
      });
      // Exibe sessões restantes como aviso
      const restantes = senhaObj.qtdAutorizada - senhaObj.qtdUsada;
      if (restantes <= 3) {
        showToast('Atenção: apenas ' + restantes + ' sessão(ões) restante(s) nesta senha!', 'error');
      }
    }
  } else {
    sv('sadt-prestador',     CLINICA.nome);
    sv('sadt-cod-prestador', CLINICA.codPrestador);
    sv('sadt-exec-nome',     CLINICA.nome);
    sv('sadt-exec-cod',      CLINICA.codPrestador);
  }

  // ── Campos 15-19: Solicitante (sempre fixo por configuração da clínica) ──
  // Campo 15 — Nome do profissional solicitante
  sv('sadt-prof-nome',     'Maria Cecilia Benessuti Donato');
  // Campo 16 — Conselho
  if (prof) sv('sadt-conselho', prof.conselho || 'CRFa');
  else      sv('sadt-conselho', 'CRFa');
  // Campo 17 — Nº conselho
  sv('sadt-num-conselho',  '71849');
  // Campo 18 — UF
  if (prof) sv('sadt-uf-conselho', prof.uf || 'SP');
  else      sv('sadt-uf-conselho', 'SP');
  // Campo 19 — CBO
  sv('sadt-cbo', '201510');

  // ── Campos 48-55: Profissional executante (sempre fixo) ────────────────
  sv('sadt-exec-prof-nome',    'Maria Cecilia Benessuti Donato');
  if (prof) sv('sadt-exec-conselho', prof.conselho || 'CRFa');
  else      sv('sadt-exec-conselho', 'CRFa');
  sv('sadt-exec-num-conselho', '71849');
  if (prof) sv('sadt-exec-uf', prof.uf || 'SP');
  else      sv('sadt-exec-uf', 'SP');
  sv('sadt-exec-cbo', '201510');
  // Campo 50 — CPF do executante
  sv('sadt-exec-cpf', '27700196869');
  // Campo 53 — Código na operadora do executante
  sv('sadt-exec-cod-op', '71849');

  // ── Data da solicitação = data do agendamento ────────────────────────
  const dsEl = document.getElementById('sadt-data-solic');
  if (dsEl) dsEl.valueAsDate = apptDate;

  // ── Datas dos procedimentos executados = data da consulta ────────────
  const dtIni0 = document.getElementById('sadt-ep-dtini-0');
  const dtFim0 = document.getElementById('sadt-ep-dtfim-0');
  if (dtIni0) dtIni0.valueAsDate = apptDate;
  if (dtFim0) dtFim0.valueAsDate = apptDate;

  // ── Tabela TUSS padrão ───────────────────────────────────────────────
  const tab0  = document.getElementById('sadt-ep-tab-0');
  const ptab0 = document.getElementById('sadt-proc-tab-0');
  if (tab0  && !tab0.value)  tab0.value  = '22';
  if (ptab0 && !ptab0.value) ptab0.value = '22';

  // Plano info box
  const info = document.getElementById('ag-plano-info');
  if (plano && plano.nome !== 'Particular') {
    info.style.display = 'flex';
    document.getElementById('ag-plano-info-txt').textContent =
      `Plano ${plano.nome} (ANS ${plano.ans}) — Guia SADT necessária para faturamento TISS 4.02.00.`;
  } else {
    info.style.display = 'none';
  }
}

// ═══════════════════════════════════════
//  MONTH VIEW
// ═══════════════════════════════════════
function renderMonthView() {
  const year = currentDate.getFullYear(), month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const dayNames = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  let html = dayNames.map(d => `<div class="month-day-header">${d}</div>`).join('');
  const prevDays = new Date(year, month, 0).getDate();
  for (let i = firstDay-1; i >= 0; i--)
    html += `<div class="month-cell other-month"><div class="day-num">${prevDays-i}</div></div>`;
  const today = new Date();
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = today.getFullYear()===year && today.getMonth()===month && today.getDate()===d;
    const dISO = year+'-'+String(month+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    const dayAppts = APPOINTMENTS.filter(a =>
      a.dataISO === dISO && activeProfFilters.has(a.profId)
    ).slice(0, 3);
    html += `<div class="month-cell${isToday?' today':''}" onclick="gotoWeekDay('${dISO}')">
      <div class="day-num">${d}</div>
      ${dayAppts.map(a => { const p=PROFISSIONAIS.find(pr=>pr.id===a.profId); return `<div class="month-appt" style="background:${p?.cor||'#4f8ef7'}22;color:${p?.cor||'#4f8ef7'}"><span class="dot" style="background:${p?.cor||'#4f8ef7'}"></span>${a.paciente.split(' ')[0]}</div>`; }).join('')}
      ${APPOINTMENTS.filter(a=>a.dataISO===dISO&&activeProfFilters.has(a.profId)).length > 3 ? `<div style="font-size:10px;color:var(--text-muted);padding:1px 4px">+${APPOINTMENTS.filter(a=>a.dataISO===dISO&&activeProfFilters.has(a.profId)).length-3} mais</div>` : ''}
    </div>`;
  }
  const remaining = 42 - firstDay - daysInMonth;
  for (let d = 1; d <= remaining; d++)
    html += `<div class="month-cell other-month"><div class="day-num">${d}</div></div>`;
  document.getElementById('month-grid').innerHTML = html;
}

function dayClick(d) {
  currentDate.setDate(d);
  setAgendaView('dia', document.querySelector('.view-btn'));
}
function setAgendaView(view, btn) {
  currentView = view;
  document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  // day view usa flex para que o header fique fixo e os slots rolem
  document.getElementById('agenda-day-view').style.display   = view==='dia'    ? 'flex' : 'none';
  document.getElementById('agenda-week-view').style.display  = view==='semana' ? 'flex' : 'none';
  document.getElementById('agenda-month-view').style.display = view==='mes'    ? 'block' : 'none';
  updateDateLabel(); renderAgenda();
}
function changeDate(dir) {
  if (currentView==='mes')    currentDate.setMonth(currentDate.getMonth()+dir);
  else if (currentView==='semana') currentDate.setDate(currentDate.getDate()+(dir*7));
  else                        currentDate.setDate(currentDate.getDate()+dir);
  if (currentView === 'dia') { refreshProfFiltersForDay(); }
  updateDateLabel(); renderAgenda();
}
function gotoToday() { currentDate=new Date(); if (currentView==='dia') refreshProfFiltersForDay(); updateDateLabel(); renderAgenda(); }

function refreshProfFiltersForDay() {
  // Recalcula profissionais com agenda no novo dia e reseta o filtro para "todos"
  const profsHoje = getProfisComAgendaHoje();
  const idsHoje = new Set(profsHoje.map(p => p.id));
  // Limpa filtros de dias anteriores e ativa todos do novo dia
  activeProfFilters.clear();
  profsHoje.forEach(p => activeProfFilters.add(p.id));
  // Atualiza label do botão sem abrir o dropdown
  const lbl = document.getElementById('prof-filter-label');
  if (lbl) {
    if (profsHoje.length === 0) lbl.textContent = 'Sem agenda hoje';
    else if (profsHoje.length === 1) lbl.textContent = profsHoje[0].nomeAgenda||profsHoje[0].nome.split(' ')[0];
    else lbl.textContent = 'Todos os profissionais';
  }
}
function updateDateLabel() {
  const months=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const days=['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
  const el = document.getElementById('agenda-date-label');
  if (currentView==='mes') {
    el.textContent = months[currentDate.getMonth()][0].toUpperCase()+months[currentDate.getMonth()].slice(1)+' de '+currentDate.getFullYear();
  } else if (currentView==='semana') {
    // show week range
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay() + 1); // Monday
    const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate()+6);
    el.textContent = startOfWeek.getDate()+'/'+String(startOfWeek.getMonth()+1).padStart(2,'0')+' – '+endOfWeek.getDate()+'/'+String(endOfWeek.getMonth()+1).padStart(2,'0')+'/'+endOfWeek.getFullYear();
  } else {
    el.textContent = days[currentDate.getDay()][0].toUpperCase()+days[currentDate.getDay()].slice(1)+', '+currentDate.getDate()+' de '+months[currentDate.getMonth()]+' de '+currentDate.getFullYear();
  }
}
function renderWeekView() {
  const wrap = document.getElementById('week-grid-wrap');
  if (!wrap) return;

  // Semana: Dom → Sáb
  const startOfWeek = new Date(currentDate);
  startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

  const dayNames = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const weekDays = Array.from({length: 7}, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d;
  });

  const activeProfs = PROFISSIONAIS.filter(p => activeProfFilters.has(p.id));
  const todayStr    = new Date().toDateString();

  // Função auxiliar: hex ou named color → rgba string com alpha
  function colorAlpha(cor, alpha) {
    if (!cor) return 'rgba(79,142,247,'+alpha+')';
    // Se começa com #
    if (cor.startsWith('#')) {
      const r = parseInt(cor.slice(1,3)||'00',16);
      const g = parseInt(cor.slice(3,5)||'00',16);
      const b = parseInt(cor.slice(5,7)||'00',16);
      return 'rgba('+r+','+g+','+b+','+alpha+')';
    }
    return cor;
  }

  // Monta o HTML como tabela — garante alinhamento perfeito e altura automática por linha
  let html = '<table style="width:100%;border-collapse:collapse;table-layout:fixed">';

  // ── Cabeçalho ──────────────────────────────────────────────────────────────
  html += '<thead><tr>';
  html += '<th style="width:58px;min-width:58px;background:var(--bg-surface);border-bottom:2px solid var(--border);position:sticky;top:0;z-index:9;"></th>';
  weekDays.forEach(d => {
    const dISO    = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    const isToday = d.toDateString() === todayStr;
    const cnt     = APPOINTMENTS.filter(a => a.dataISO===dISO && activeProfs.some(p=>p.id===a.profId)).length;
    html += '<th onclick="gotoWeekDay(\''+dISO+'\')" style="'+
      'background:'+(isToday?'var(--accent-soft)':'var(--bg-surface)')+';'+
      'border-left:1px solid var(--border);'+
      'border-bottom:2px solid '+(isToday?'var(--accent)':'var(--border)')+';'+
      'padding:8px 4px 6px;text-align:center;cursor:pointer;'+
      'position:sticky;top:0;z-index:8;">';
    html += '<div style="font-size:11px;font-weight:600;color:'+(isToday?'var(--accent)':'var(--text-muted)')+'">'+dayNames[d.getDay()]+'</div>';
    html += '<div style="font-size:18px;font-weight:700;color:'+(isToday?'var(--accent)':'var(--text-primary)')+'">'+d.getDate()+'</div>';
    html += '<div style="font-size:10px;color:var(--text-muted)">'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear()+'</div>';
    if (cnt) html += '<div style="font-size:10px;color:var(--accent);background:var(--accent-soft);border-radius:99px;padding:1px 6px;display:inline-block;margin-top:2px">'+cnt+'</div>';
    html += '</th>';
  });
  html += '</tr></thead>';

  // ── Corpo: uma linha por hora ───────────────────────────────────────────────
  html += '<tbody>';
  HOURS.forEach(h => {
    // Verifica se há algum agendamento nessa hora em qualquer dia da semana
    const hasAnyAppt = weekDays.some(d => {
      const dISO = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
      return APPOINTMENTS.some(a => a.dataISO===dISO && a.hora===h && activeProfs.some(p=>p.id===a.profId));
    });

    html += '<tr>';

    // Célula da hora
    html += '<td style="'+
      'width:58px;min-width:58px;'+
      'font-size:10px;color:var(--text-muted);'+
      'font-family:var(--font-mono);'+
      'text-align:right;padding:3px 8px 0 0;'+
      'vertical-align:top;'+
      'border-right:1px solid var(--border);'+
      'border-bottom:1px solid var(--border);'+
      'background:var(--bg-surface);'+
      'position:sticky;left:0;z-index:6;">'+h+'</td>';

    // Uma célula por dia
    weekDays.forEach(d => {
      const dISO    = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
      const isToday = d.toDateString() === todayStr;
      const appts   = APPOINTMENTS.filter(a =>
        a.dataISO === dISO && a.hora === h && activeProfs.some(p => p.id === a.profId)
      );

      html += '<td class="week-drop-cell" onclick="slotClickWeek(event,\''+dISO+'\',\''+h+'\')" ondragover="agendaDayDragOver(event)" ondragleave="agendaDragLeave(event)" ondrop="agendaWeekDrop(event,\''+dISO+'\',\''+h+'\')" data-iso="'+dISO+'" data-hora="'+h+'" style="'+
        'border-left:1px solid var(--border);'+
        'border-bottom:1px solid var(--border);'+
        'vertical-align:top;'+
        'min-height:56px;'+
        'padding:'+(appts.length ? '2px' : '0')+';'+
        (isToday ? 'background:rgba(79,142,247,0.025);' : '')+
        '">';

      if (appts.length) {
        appts.forEach(appt => {
          const prof      = PROFISSIONAIS.find(p => p.id === appt.profId);
          const cor       = prof?.cor || '#4f8ef7';
          const bgColor   = colorAlpha(cor, 0.12);
          const profLabel = prof ? (prof.nomeAgenda || prof.nome.split(' ')[0]) : '';
          const isOnline  = appt.modalidade === 'online';
          const horaLabel = appt.hora + (appt.horaFim ? '–'+appt.horaFim : '');

          // Dimmed se cancelado/desmarcado
          const dimmed = (appt.status==='cancelado'||appt.status==='desmarcado') ? 'opacity:0.5;' : '';

          html +=
            '<div draggable="true"'
            +' onclick="event.stopPropagation();openAppt('+appt.id+')"'
            +' ondragstart="agendaDragStart(event,'+appt.id+')"'
            +' ondragend="agendaDragEnd(event)"'
            +' data-appt-id="'+appt.id+'"'
            +' style="'+
              'border-left:3px solid '+cor+';'+
              'background:'+bgColor+';'+
              'border-radius:4px;'+
              'padding:3px 5px 4px;'+
              'margin-bottom:2px;'+
              'cursor:grab;'+
              dimmed+
              'overflow:hidden;'+
            '">' +
              '<div style="font-size:10px;font-weight:700;color:'+cor+';white-space:nowrap">'+
                horaLabel + (isOnline ? ' 🌐' : '') +
              '</div>'+
              '<div style="font-size:11px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-primary)">'+appt.paciente+'</div>'+
              '<div style="font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-secondary)">'+appt.plano+'</div>'+
              '<div style="font-size:10px;font-weight:500;color:'+cor+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+profLabel+'</div>'+
            '</div>';
        });
      }

      html += '</td>';
    });

    html += '</tr>';
  });

  html += '</tbody></table>';
  wrap.innerHTML = html;
}

function gotoWeekDay(dateISO) {
  currentDate = new Date(dateISO + 'T12:00:00');
  setAgendaView('dia', document.querySelector('.view-btn[onclick*="dia"]'));
  updateDateLabel();
  renderDayView();
}

function slotClickWeek(e, dateISO, hora) {
  if (e.target.closest('.week-appt-card') || e.target.closest('.appt-card')) return;
  // Verifica bloqueio para todos os profs ativos nesta célula
  const profsAtivos = PROFISSIONAIS.filter(p => activeProfFilters.has(p.id));
  const todosBloqueados = profsAtivos.length > 0 && profsAtivos.every(p => slotBloqueado(p.id, dateISO, hora));
  if (todosBloqueados) {
    showToast('🔒 Todos os profissionais têm a agenda bloqueada neste horário.', 'warning');
    return;
  }
  const d = new Date(dateISO + 'T12:00:00');
  currentDate = d;
  updateDateLabel();
  openNovoAgendamento(null, hora);
}

