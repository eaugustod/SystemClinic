// ═══════════════════════════════════════
//  SELECTS
// ═══════════════════════════════════════
function populateSelects() {
  ['ag-profissional','guia-prof'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = PROFISSIONAIS.filter(p=>p.status!=='Inativo').map(p => `<option value="${p.id}">${p.nome}</option>`).join('');
  });
  // Plano options — apenas planos ativos
  const planoOpts = PLANOS.filter(p => p.status !== 'Inativo').map(p => `<option value="${p.id}">${p.nome}${p.ans&&p.ans!=='—'?' (ANS '+p.ans+')':''}</option>`).join('');
  ['ag-plano','pac-plano','guia-plano'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = planoOpts;
  });
  // Proc page filter
  const pff = document.getElementById('proc-filtro-plano');
  if (pff) {
    pff.innerHTML = '<option value="0">Todos os planos</option>' +
      PLANOS.filter(p=>p.nome!=='Particular'&&p.status!=='Inativo').map(p =>
        `<option value="${p.id}">${p.nome} · ANS ${p.ans}</option>`
      ).join('');
  }
  // Datalists — apenas pacientes ativos
  const pacAtivos = PACIENTES.filter(p => p.status === 'Ativo' || !p.status);
  const dl = document.getElementById('pacientes-list');
  if (dl) dl.innerHTML = pacAtivos.map(p => `<option value="${p.nome}">`).join('');
  const gPacDl = document.getElementById('g-pac-list');
  if (gPacDl) gPacDl.innerHTML = pacAtivos.map(p => `<option value="${p.nome}">`).join('');
  const senPacDl = document.getElementById('sen-pac-list');
  if (senPacDl) senPacDl.innerHTML = pacAtivos.map(p => `<option value="${p.nome}">`).join('');
}

// ═══════════════════════════════════════
//  MODAL TABS (agendamento)
// ═══════════════════════════════════════
function switchAgTab(tab, btn) {
  document.querySelectorAll('.ag-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('ag-panel-dados').style.display = tab==='dados' ? 'block' : 'none';
  document.getElementById('ag-panel-sadt').style.display  = tab==='sadt'  ? 'block' : 'none';
  document.getElementById('btn-imprimir-guia').style.display = tab==='sadt' ? 'flex' : 'none';
}

// ═══════════════════════════════════════
//  AUTO-FILL from paciente input
// ═══════════════════════════════════════
function onPacienteChange(val) {
  // Atualiza datalist dinamicamente a cada digitação (garante dados atuais do Supabase)
  const dl = document.getElementById('pacientes-list');
  if (dl) dl.innerHTML = PACIENTES.filter(p => p.status === 'Ativo' || !p.status).map(p => `<option value="${p.nome}">`).join('');
  // Busca exata primeiro, depois parcial
  const pac = PACIENTES.find(p => p.nome.toLowerCase() === val.toLowerCase())
           || (val.length >= 3 ? PACIENTES.find(p => p.nome.toLowerCase().startsWith(val.toLowerCase())) : null);
  if (!pac) return;
  const planoSel = document.getElementById('ag-plano');
  if (planoSel) { planoSel.value = pac.planoId; onPlanoChange(); }
  document.getElementById('ag-carteirinha').value = pac.carteirinha !== '—' ? pac.carteirinha : '';
  const profId = parseInt(document.getElementById('ag-profissional').value||'0');
  const apptDummy = { paciente: pac.nome, plano: pac.plano, planoId: pac.planoId, profId };
  autoFillSadt(apptDummy);
  // Auto-fill senha fields from SENHAS_PLANO
  preencherSenhaSADT(pac.nome, pac.planoId);
}

function preencherSenhaSADT(nomePac, planoId) {
  // Find active senha for this patient + plano
  const senha = SENHAS_PLANO.find(s =>
    s.paciente === nomePac && s.planoId === planoId &&
    s.status === 'Ativa' && (!s.validade || s.validade >= new Date().toISOString().slice(0,10))
  );
  if (!senha) return;
  // Fill SADT campos
  const sv = (id, v) => { const el=document.getElementById(id); if(el&&v) el.value=v; };
  sv('sadt-autorizacao',    senha.numSenha);
  sv('sadt-guia-principal', senha.numGuiaOp || '');
  sv('sadt-carteira',       senha.carteirinha || '');
  // Fill data autorização if field exists
  sv('sadt-dt-autorizacao', senha.dataAut || '');
  sv('sadt-val-senha',      senha.validade || '');
  // Fill indicação clínica (CID)
  sv('sadt-indicacao',      senha.cid || '');
  // Fill número guia operadora
  sv('sadt-guia-num-op',    senha.numGuiaOp || '');
  showToast('Senha #'+senha.numSenha+' preenchida automaticamente!', 'success');
}

function onProfChange() {
  const profId = parseInt(document.getElementById('ag-profissional').value);
  const prof = PROFISSIONAIS.find(p => p.id === profId);
  if (prof) {
    document.getElementById('sadt-prof-nome').value    = prof.nome;
    document.getElementById('sadt-conselho').value     = prof.conselho;
    document.getElementById('sadt-num-conselho').value = `${prof.num}/${prof.uf}`;
    document.getElementById('sadt-cbo').value          = prof.cbo || '';
  }
}

function onPlanoChange() {
  const planoId = parseInt(document.getElementById('ag-plano').value);
  const plano = PLANOS.find(p => p.id === planoId);
  if (!plano) return;
  document.getElementById('sadt-operadora').value = plano.nome;
  document.getElementById('sadt-ans').value = plano.ans !== '—' ? plano.ans : '';
  const info = document.getElementById('ag-plano-info');
  if (plano.nome !== 'Particular') {
    info.style.display = 'flex';
    document.getElementById('ag-plano-info-txt').textContent =
      `Plano ${plano.nome} (ANS ${plano.ans}) — Guia SADT necessária para faturamento.`;
  } else {
    info.style.display = 'none';
  }
}

