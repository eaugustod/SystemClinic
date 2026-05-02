// ═══════════════════════════════════════
//  SENHAS / AUTORIZAÇÕES — MÓDULO
// ═══════════════════════════════════════
let senhaProcCount = 0;

function renderSenhas() {
  // Populate plano filter
  const fpEl = document.getElementById('senhas-filtro-plano');
  if (fpEl && fpEl.options.length <= 1) {
    PLANOS.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id; opt.textContent = p.nome + (p.ans&&p.ans!=='—'?' · ANS '+p.ans:'');
      fpEl.appendChild(opt);
    });
  }
  const planoFiltro = parseInt(fpEl?.value || '0');
  const buscaPac = (document.getElementById('senhas-busca-pac')?.value || '').toLowerCase().trim();
  let list = SENHAS_PLANO;
  if (planoFiltro) list = list.filter(s => s.planoId === planoFiltro);
  if (buscaPac)    list = list.filter(s => s.paciente.toLowerCase().includes(buscaPac));

  // Stats
  const statsEl = document.getElementById('senhas-stats');
  if (statsEl) {
    const ativas   = SENHAS_PLANO.filter(s=>s.status==='Ativa').length;
    const vencidas = SENHAS_PLANO.filter(s=>s.status==='Vencida').length;
    const usadas   = SENHAS_PLANO.filter(s=>s.status==='Usada').length;
    const total    = SENHAS_PLANO.length;
    const cards = [
      { label:'Total cadastradas', val:total,   color:'var(--accent)'  },
      { label:'Ativas',            val:ativas,   color:'var(--success)' },
      { label:'Vencidas',          val:vencidas, color:'var(--danger)'  },
      { label:'Usadas/Concluídas', val:usadas,   color:'var(--text-muted)' },
    ];
    statsEl.innerHTML = cards.map(c =>
      '<div class="tiss-info-card"><div class="tiss-info-label">'+c.label+'</div>' +
      '<div class="tiss-info-value" style="color:'+c.color+'">'+c.val+'</div></div>'
    ).join('');
  }

  // Table
  const tbody = document.getElementById('senhas-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--text-muted)">Nenhuma senha cadastrada. Clique em "Nova senha/autorização" para adicionar.</td></tr>';
    return;
  }
  list.forEach(s => {
    const plano  = PLANOS.find(p=>p.id===s.planoId);
    const qtdStr = s.qtdUsada + ' / ' + s.qtdAutorizada;
    const chipCls= s.status==='Ativa'?'green':s.status==='Vencida'?'red':'gray';
    const pr     = s.procs?.map(p=>p.desc||p.codigo).join(', ') || '—';
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td><div style="font-size:13px;font-weight:500">'+s.paciente+'</div>' +
        '<div style="font-size:11px;color:var(--text-muted)">'+s.carteirinha+'</div></td>' +
      '<td>'+(plano?plano.nome+' <span style="font-size:10px;color:var(--text-muted)">ANS '+plano.ans+'</span>':'—')+'</td>' +
      '<td style="font-family:var(--font-mono)">'+s.numSenha+'</td>' +
      '<td style="font-family:var(--font-mono);color:var(--text-muted)">'+( s.numGuiaOp||'—')+'</td>' +
      '<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px" title="'+pr+'">'+pr+'</td>' +
      '<td style="text-align:center">'+s.qtdAutorizada+'</td>' +
      '<td style="text-align:center;color:'+(s.qtdUsada>=s.qtdAutorizada?'var(--danger)':'var(--success)')+'">'+s.qtdUsada+'</td>' +
      '<td style="font-size:12px">'+(s.validade?s.validade.split('-').reverse().join('/'):'—')+'</td>' +
      '<td><span class="chip '+chipCls+'">'+s.status+'</span></td>' +
      '<td><div class="table-actions"></div></td>';
    const actions = tr.querySelector('.table-actions');
    const editBtn = document.createElement('button');
    editBtn.className='action-btn'; editBtn.title='Editar'; editBtn.innerHTML=EDIT_ICON;
    editBtn.addEventListener('click', ()=>editarSenha(s.id));
    actions.appendChild(editBtn);

    const delSenhaBtn = document.createElement('button');
    delSenhaBtn.className='action-btn'; delSenhaBtn.title='Excluir'; delSenhaBtn.style.color='var(--danger)';
    delSenhaBtn.innerHTML = DEL_ICON;
    delSenhaBtn.addEventListener('click', ()=>excluirSenha(s.id));
    actions.appendChild(delSenhaBtn);

    tbody.appendChild(tr);
  });
}

function abrirNovaSenha() {
  editingSenhaId = null;
  document.getElementById('senha-modal-title').textContent = 'Nova Autorização / Senha';
  document.getElementById('senha-modal-sub').textContent   = 'Cadastre a senha liberada pelo plano';
  document.getElementById('sen-id-display').textContent    = '';
  ['sen-num-senha','sen-paciente','sen-carteirinha','sen-num-guia-op','sen-cid','sen-obs'].forEach(id => {
    const el=document.getElementById(id); if(el) el.value='';
  });
  document.getElementById('sen-qtd-aut').value   = '10';
  document.getElementById('sen-status').value    = 'Ativa';
  document.getElementById('sen-data-aut').valueAsDate = new Date();

  const plSel = document.getElementById('sen-plano');
  if (plSel) plSel.innerHTML = '<option value="">Selecione o plano...</option>' +
    PLANOS.filter(p=>p.nome!=='Particular').map(p=>'<option value="'+p.id+'">'+p.nome+' (ANS '+p.ans+')</option>').join('');
  const pacList = document.getElementById('sen-pac-list');
  if (pacList) pacList.innerHTML = PACIENTES.filter(p=>p.status!=='Inativo').map(p=>'<option value="'+p.nome+'">').join('');

  const procList = document.getElementById('sen-procs-list');
  if (procList) {
    senhaProcCount = 0;
    procList.innerHTML = '';
    senhaAddProc();
  }
  openModal('modal-senha');
}

function editarSenha(id) {
  const s = SENHAS_PLANO.find(x=>x.id===id);
  if (!s) return;
  editingSenhaId = id;
  document.getElementById('senha-modal-title').textContent = 'Editar Autorização';
  document.getElementById('senha-modal-sub').textContent   = s.paciente + ' — ' + s.numSenha;
  document.getElementById('sen-id-display').textContent    = 'ID: ' + id;
  document.getElementById('sen-num-senha').value     = s.numSenha   || '';
  document.getElementById('sen-paciente').value      = s.paciente   || '';
  document.getElementById('sen-carteirinha').value   = s.carteirinha|| '';
  document.getElementById('sen-num-guia-op').value   = s.numGuiaOp  || '';
  document.getElementById('sen-cid').value           = s.cid        || '';
  document.getElementById('sen-obs').value           = s.obs        || '';
  document.getElementById('sen-qtd-aut').value       = s.qtdAutorizada || 10;
  document.getElementById('sen-data-aut').value      = s.dataAut    || '';
  document.getElementById('sen-validade').value      = s.validade   || '';
  document.getElementById('sen-status').value        = s.status     || 'Ativa';

  const plSel = document.getElementById('sen-plano');
  if (plSel) {
    plSel.innerHTML = '<option value="">—</option>' + PLANOS.filter(p=>p.nome!=='Particular').map(p=>'<option value="'+p.id+'">'+p.nome+'</option>').join('');
    plSel.value = s.planoId;
  }
  const pacList = document.getElementById('sen-pac-list');
  if (pacList) pacList.innerHTML = PACIENTES.filter(p=>p.status!=='Inativo').map(p=>'<option value="'+p.nome+'">').join('');

  const procList = document.getElementById('sen-procs-list');
  if (procList) {
    senhaProcCount = 0; procList.innerHTML = '';
    (s.procs || [{ codigo:'', desc:'' }]).forEach(p => senhaAddProc(p.codigo, p.desc));
  }
  openModal('modal-senha');
}

function senhaAutoFill() {
  const nome = document.getElementById('sen-paciente').value;
  const pac  = PACIENTES.find(p=>p.nome.toLowerCase()===nome.toLowerCase());
  if (!pac) return;
  document.getElementById('sen-carteirinha').value = pac.carteirinha!=='—'?pac.carteirinha:'';
  const plSel = document.getElementById('sen-plano');
  if (plSel && pac.planoId) plSel.value = pac.planoId;
}

function senhaPlanoChange() {
  // Could filter procedures by plano in future
}

// ── Anexos helpers ────────────────────────────────────────────────────────────
function adicionarAnexosUI(input, listaId, storeKey) {
  const lista = document.getElementById(listaId);
  if (!lista) return;
  Array.from(input.files).forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      const chip = document.createElement('div');
      chip.style.cssText = 'display:inline-flex;align-items:center;gap:5px;padding:4px 8px;background:var(--bg-overlay);border:1px solid var(--border);border-radius:var(--radius-sm);font-size:11px;cursor:pointer';
      chip.title = 'Clique para abrir';
      const isImg = file.type.startsWith('image/');
      chip.innerHTML = (isImg?'🖼️':'📄')+' '+file.name+' <span style="color:var(--danger);margin-left:4px;cursor:pointer">✕</span>';
      chip.querySelector('span').addEventListener('click', ev => { ev.stopPropagation(); chip.remove(); });
      if (isImg) {
        chip.addEventListener('click', ()=>{ window.open(e.target.result,'_blank'); });
      } else {
        chip.addEventListener('click', ()=>{ const a=document.createElement('a'); a.href=e.target.result; a.download=file.name; a.click(); });
      }
      chip.dataset.nome = file.name;
      chip.dataset.data = e.target.result.substring(0,100);
      lista.appendChild(chip);
    };
    reader.readAsDataURL(file);
  });
  input.value='';
}
function pacAdicionarAnexos(input)   { adicionarAnexosUI(input,'pac-anexos-lista','pac-anexos'); }
function esperaAdicionarAnexos(input){ adicionarAnexosUI(input,'esp-anexos-lista','esp-anexos'); }

function esperaPlanoChange() {
  const planoNome = document.getElementById('esp-plano')?.value;
  const planoObj  = PLANOS.find(p=>p.nome===planoNome);
  // Get procedures for this plano (or all if no specific plano)
  const procs = planoObj
    ? PROCEDIMENTOS.filter(p=>p.status==='Ativo'&&(p.planoId===planoObj.id||p.planoId===0))
    : PROCEDIMENTOS.filter(p=>p.status==='Ativo');
  buildEsperaProcsChips([], procs);
}

function senhaAddProc(cod='', desc='') {
  const idx = senhaProcCount++;
  const row = document.createElement('div');
  row.className = 'sen-proc-row';
  row.dataset.idx = idx;
  row.style.cssText = 'display:grid;grid-template-columns:110px 1fr 36px;gap:8px;margin-bottom:6px;align-items:center';
  row.innerHTML =
    '<input class="form-input" style="padding:5px 8px;font-size:12px;font-family:var(--font-mono)" placeholder="Código TUSS" id="sen-proc-cod-'+idx+'" value="'+cod+'">' +
    '<input class="form-input" style="padding:5px 8px;font-size:12px" placeholder="Descrição do procedimento" id="sen-proc-desc-'+idx+'" value="'+desc+'">' +
    '<button style="padding:6px;background:none;color:var(--text-muted);font-size:14px" onclick="senhaRemoveProc(this)">✕</button>';
  row.querySelector('[id^="sen-proc-cod"]').addEventListener('input', function(){ senhaLookupTuss(this); });
  document.getElementById('sen-procs-list').appendChild(row);
}

function senhaRemoveProc(btn) {
  const rows = document.querySelectorAll('.sen-proc-row');
  if (rows.length > 1) btn.closest('.sen-proc-row').remove();
  else showToast('Deve haver ao menos um procedimento','error');
}

function senhaLookupTuss(input) {
  const code = input.value.trim();
  const found = TUSS_TABLE[code];
  if (!found) return;
  const idx  = input.closest('.sen-proc-row').dataset.idx;
  const descEl = document.getElementById('sen-proc-desc-'+idx);
  if (descEl && !descEl.value) descEl.value = found.desc;
}

function salvarSenha() {
  const planoId   = parseInt(document.getElementById('sen-plano')?.value||'0');
  const paciente  = document.getElementById('sen-paciente')?.value.trim();
  const numSenha  = document.getElementById('sen-num-senha')?.value.trim();
  if (!planoId) { showToast('Selecione o plano','error'); return; }
  if (!paciente) { showToast('Informe o paciente','error'); return; }
  if (!numSenha) { showToast('Informe o número da senha','error'); return; }

  // Collect procedures
  const procs = [];
  document.querySelectorAll('.sen-proc-row').forEach(row => {
    const idx  = row.dataset.idx;
    const cod  = document.getElementById('sen-proc-cod-'+idx)?.value||'';
    const desc = document.getElementById('sen-proc-desc-'+idx)?.value||'';
    if (cod||desc) procs.push({ codigo:cod, desc });
  });

  const dados = {
    planoId, paciente,
    carteirinha: document.getElementById('sen-carteirinha')?.value||'',
    numGuiaOp:   document.getElementById('sen-num-guia-op')?.value||'',
    numSenha,
    dataAut:     document.getElementById('sen-data-aut')?.value||'',
    validade:    document.getElementById('sen-validade')?.value||'',
    qtdAutorizada: parseInt(document.getElementById('sen-qtd-aut')?.value||'10'),
    qtdUsada:    0,
    cid:         document.getElementById('sen-cid')?.value||'',
    obs:         document.getElementById('sen-obs')?.value||'',
    status:      document.getElementById('sen-status')?.value||'Ativa',
    procs, ativa: true,
  };

  if (editingSenhaId !== null) {
    const s = SENHAS_PLANO.find(x=>x.id===editingSenhaId);
    if (s) { dados.qtdUsada=s.qtdUsada; Object.assign(s, dados); }
    showToast('Autorização atualizada!','success');
  } else {
    dados.id = nextSenhaId++;
    SENHAS_PLANO.push(dados);
    showToast('Autorização cadastrada!','success');
  }
  closeModal('modal-senha');
  renderSenhas();
}

