// ═══════════════════════════════════════
//  LISTA DE ESPERA — MÓDULO
// ═══════════════════════════════════════
function renderEsperaTable(filter='') {
  const badge = document.getElementById('badge-espera');
  const ativos = LISTA_ESPERA.filter(e=>e.status==='Aguardando').length;
  if (badge) badge.textContent = ativos;

  let list = LISTA_ESPERA;
  if (filter) list = list.filter(e=>e.nome.toLowerCase().includes(filter.toLowerCase())||
    (e.plano||'').toLowerCase().includes(filter.toLowerCase()));

  const tbody = document.getElementById('espera-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-muted)">Nenhum paciente na lista de espera.</td></tr>';
    return;
  }
  list.forEach(e => {
    const chipCls = e.status==='Aguardando'?'yellow':e.status==='Convertido'?'green':'gray';
    const diasStr = (e.dias||[]).join(', ') || '—';
    const periStr = (e.periodos||[]).join(', ')  || '—';
    const procStr = (e.procedimentos||[]).join(', ') || '—';
    const tr = document.createElement('tr');
    tr.style.opacity = e.status!=='Aguardando' ? '0.55' : '';
    tr.innerHTML =
      '<td><div style="font-weight:500">'+e.nome+'</div>' +
        (e.nasc?'<div style="font-size:11px;color:var(--text-muted)">'+e.nasc.split("-").reverse().join("/")+'</div>':'')+
      '</td>' +
      '<td><a href="tel:'+e.tel+'" style="color:var(--accent)">'+e.tel+'</a></td>' +
      '<td>'+(e.plano||'—')+'<div style="font-size:10px;color:var(--text-muted)">'+( e.carteirinha||'')+'</div></td>' +
      '<td style="font-size:11px;max-width:160px">'+procStr+'</td>' +
      '<td style="font-size:11px">'+diasStr+'</td>' +
      '<td style="font-size:11px">'+periStr+'</td>' +
      '<td style="font-size:11px;color:var(--text-muted)">'+(e.dataEntrada||'—')+'</td>' +
      '<td><span class="chip '+chipCls+'">'+e.status+'</span></td>' +
      '<td><div class="table-actions"></div></td>';
    const actions = tr.querySelector('.table-actions');

    const editBtn = document.createElement('button');
    editBtn.className='action-btn'; editBtn.title='Editar'; editBtn.innerHTML=EDIT_ICON;
    editBtn.style.opacity = e.status==='Convertido' ? '0.3' : '1';
    editBtn.title = e.status==='Convertido' ? 'Paciente convertido — edição bloqueada' : 'Editar';
    if (e.status!=='Convertido') editBtn.addEventListener('click', ()=>editarEspera(e.id));
    actions.appendChild(editBtn);

    const delEsperaBtn = document.createElement('button');
    delEsperaBtn.className='action-btn'; delEsperaBtn.title='Remover da lista'; delEsperaBtn.style.color='var(--danger)';
    delEsperaBtn.innerHTML = DEL_ICON;
    delEsperaBtn.addEventListener('click', ()=>excluirEspera(e.id));
    actions.appendChild(delEsperaBtn);

    if (e.status==='Aguardando') {
      const convBtn = document.createElement('button');
      convBtn.className='action-btn'; convBtn.title='Converter em paciente';
      convBtn.style.cssText = 'color:var(--success)';
      convBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';
      convBtn.addEventListener('click', ()=>converterEmPaciente(e.id));
      actions.appendChild(convBtn);
    }
    tbody.appendChild(tr);
  });
}

function filterEspera(v) { renderEsperaTable(v); }

function abrirNovoEspera() {
  editingEsperaId = null;
  document.getElementById('espera-modal-title').textContent = 'Adicionar à Lista de Espera';
  document.getElementById('espera-modal-sub').textContent   = 'Preencha os dados do paciente em espera';
  document.getElementById('esp-id-display').textContent     = '';
  ['esp-nome','esp-tel','esp-email','esp-carteirinha','esp-obs','esp-end'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  const nascEl = document.getElementById('esp-nasc'); if (nascEl) nascEl.value='';
  document.querySelectorAll('.esp-dia').forEach(c=>c.checked=false);
  document.querySelectorAll('.esp-periodo').forEach(c=>c.checked=false);
  // Populate plano select
  const plSel = document.getElementById('esp-plano');
  if (plSel) plSel.innerHTML = '<option value="">Sem plano / Particular</option>' +
    PLANOS.map(p=>'<option value="'+p.nome+'">'+p.nome+(p.ans&&p.ans!=='—'?' (ANS '+p.ans+')':'')+'</option>').join('');
  // Populate procedures chips
  buildEsperaProcsChips([]);
  openModal('modal-espera');
}

function buildEsperaProcsChips(selected, procList) {
  const container = document.getElementById('esp-procs-chips');
  if (!container) return;
  const baseProcs = procList || PROCEDIMENTOS.filter(p=>p.status==='Ativo');
  const procs = [...new Set(baseProcs.map(p=>p.descCurta||p.desc).filter(Boolean))].slice(0,30);
  container.innerHTML = '';
  procs.forEach(proc => {
    const chip = document.createElement('label');
    chip.style.cssText = 'display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:99px;border:1px solid var(--border);cursor:pointer;font-size:12px;transition:all var(--transition)';
    const chk = document.createElement('input');
    chk.type='checkbox'; chk.value=proc; chk.className='esp-proc-chk';
    chk.checked = selected.includes(proc);
    chk.style.display='none';
    chk.addEventListener('change', ()=>{
      chip.style.background    = chk.checked ? 'var(--accent-soft)' : '';
      chip.style.borderColor   = chk.checked ? 'var(--accent)' : 'var(--border)';
      chip.style.color         = chk.checked ? 'var(--accent)' : '';
    });
    if (chk.checked) { chip.style.background='var(--accent-soft)'; chip.style.borderColor='var(--accent)'; chip.style.color='var(--accent)'; }
    chip.appendChild(chk);
    chip.appendChild(document.createTextNode(proc));
    container.appendChild(chip);
  });
}

function editarEspera(id) {
  const e = LISTA_ESPERA.find(x=>x.id===id);
  if (!e) return;
  if (e.status==='Convertido') { showToast('Paciente já convertido — edição bloqueada.','error'); return; }
  editingEsperaId = id;
  document.getElementById('espera-modal-title').textContent = 'Editar — ' + e.nome;
  document.getElementById('espera-modal-sub').textContent   = 'Editar dados na lista de espera';
  document.getElementById('esp-id-display').textContent     = 'ID: '+id;
  document.getElementById('esp-nome').value         = e.nome        || '';
  document.getElementById('esp-tel').value          = e.tel         || '';
  document.getElementById('esp-email').value        = e.email       || '';
  document.getElementById('esp-nasc').value         = e.nasc        || '';
  document.getElementById('esp-end').value          = e.end         || '';
  document.getElementById('esp-carteirinha').value  = e.carteirinha || '';
  document.getElementById('esp-obs').value          = e.obs         || '';
  const plSel = document.getElementById('esp-plano');
  if (plSel) { plSel.innerHTML = '<option value="">Sem plano / Particular</option>' + PLANOS.map(p=>'<option value="'+p.nome+'">'+p.nome+'</option>').join(''); plSel.value = e.plano||''; }
  // Dias
  document.querySelectorAll('.esp-dia').forEach(c=>c.checked=(e.dias||[]).includes(c.value));
  // Períodos
  document.querySelectorAll('.esp-periodo').forEach(c=>c.checked=(e.periodos||[]).includes(c.value));
  // Procs chips
  buildEsperaProcsChips(e.procedimentos||[]);
  openModal('modal-espera');
}

function salvarEspera() {
  const nome = document.getElementById('esp-nome')?.value.trim();
  const tel  = document.getElementById('esp-tel')?.value.trim();
  if (!nome) { showToast('Informe o nome do paciente','error'); return; }
  if (!tel)  { showToast('Informe o telefone','error'); return; }
  const dias      = [...document.querySelectorAll('.esp-dia:checked')].map(c=>c.value);
  const periodos  = [...document.querySelectorAll('.esp-periodo:checked')].map(c=>c.value);
  const proceds   = [...document.querySelectorAll('.esp-proc-chk:checked')].map(c=>c.value);
  const dados = {
    nome, tel,
    email:        document.getElementById('esp-email')?.value||'',
    nasc:         document.getElementById('esp-nasc')?.value||'',
    end:          document.getElementById('esp-end')?.value||'',
    plano:        document.getElementById('esp-plano')?.value||'',
    carteirinha:  document.getElementById('esp-carteirinha')?.value||'',
    obs:          document.getElementById('esp-obs')?.value||'',
    dias, periodos, procedimentos: proceds,
    status: 'Aguardando',
    dataEntrada: new Date().toLocaleDateString('pt-BR'),
  };
  if (editingEsperaId !== null) {
    Object.assign(LISTA_ESPERA.find(x=>x.id===editingEsperaId), dados);
    showToast('Registro atualizado!','success');
  } else {
    dados.id = nextEsperaId++;
    LISTA_ESPERA.push(dados);
    showToast('Adicionado à lista de espera!','success');
  }
  closeModal('modal-espera');
  renderEsperaTable();
}

function converterEmPaciente(id) {
  const e = LISTA_ESPERA.find(x=>x.id===id);
  if (!e) return;
  // Mark as converted
  e.status = 'Convertido';
  // Open new patient modal pre-filled
  openNovoPaciente();
  setTimeout(() => {
    document.getElementById('pac-nome').value  = e.nome  || '';
    document.getElementById('pac-tel').value   = e.tel   || '';
    document.getElementById('pac-email').value = e.email || '';
    document.getElementById('pac-nasc').value  = e.nasc  || '';
    document.getElementById('pac-end').value   = e.end   || '';
    document.getElementById('pac-carteirinha').value = e.carteirinha || '';
    populateSelects();
    const plSel = document.getElementById('pac-plano');
    if (plSel && e.plano) {
      const planoObj = PLANOS.find(p=>p.nome===e.plano);
      if (planoObj) plSel.value = planoObj.id;
    }
    document.getElementById('pac-modal-sub').textContent = 'Convertido da lista de espera — complete os dados';
  }, 100);
  renderEsperaTable();
  showToast('Abrindo cadastro para '+e.nome,'success');
}

