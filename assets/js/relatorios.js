// ═══════════════════════════════════════
//  RELATÓRIOS — dados dinâmicos
// ═══════════════════════════════════════
function relGetPeriodo() {
  const sel = document.getElementById('rel-periodo');
  const val = sel ? sel.value : 'mes';
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  switch(val) {
    case 'mes':     return { ini: new Date(y,m,1), fim: new Date(y,m+1,0), label: 'este mês' };
    case 'mes_ant': return { ini: new Date(y,m-1,1), fim: new Date(y,m,0), label: 'mês anterior' };
    case 'trim':    return { ini: new Date(y,m-2,1), fim: new Date(y,m+1,0), label: 'últimos 3 meses' };
    case 'ano':     return { ini: new Date(y,0,1), fim: new Date(y,11,31), label: 'este ano' };
    default:        return { ini: new Date(2000,0,1), fim: new Date(2099,11,31), label: 'todo o período' };
  }
}

function renderRelatorios() {
  const { ini, fim, label } = relGetPeriodo();
  const iniISO = ini.toISOString().slice(0,10);
  const fimISO = fim.toISOString().slice(0,10);

  const appts = APPOINTMENTS.filter(a => a.dataISO >= iniISO && a.dataISO <= fimISO);
  const total  = appts.length;
  const atend  = appts.filter(a => a.status === 'atendido').length;
  const cancel = appts.filter(a => a.status === 'cancelado' || a.status === 'desmarcado').length;
  const taxaCancel = total > 0 ? (cancel / total * 100).toFixed(1) : '0.0';

  // Faturamento: soma das guias do período (campo valor)
  const guiasPeriodo = GUIAS.filter(g => (g.data||'') >= iniISO && (g.data||'') <= fimISO);
  const fatGuias = guiasPeriodo.reduce((s,g)=>s+(g.valor||0),0);
  const fatPart  = appts.filter(a=>a.plano==='Particular').length *
                   (PROCEDIMENTOS.find(p=>p.valPart>0)?.valPart || 0);
  const fatTotal = fatGuias || fatPart;

  const sv = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };

  sv('rel-total-consultas', total);
  sv('rel-consultas-periodo', label + ' · ' + atend + ' atendidos');
  sv('rel-faturamento', fatTotal > 0 ? 'R$ ' + fatTotal.toLocaleString('pt-BR', {minimumFractionDigits:2}) : 'ver guias SADT');
  sv('rel-fat-detalhes', guiasPeriodo.length + ' guias no período');
  sv('rel-taxa-cancel', taxaCancel + '%');
  sv('rel-cancel-abs', cancel + ' cancelamentos/' + total + ' agendamentos');
  sv('rel-total-pacs', PACIENTES.length);
  sv('rel-pacs-ativos', PACIENTES.filter(p=>p.status==='Ativo').length + ' ativos');

  // Por profissional
  const tbodyProfs = document.getElementById('rel-tbody-profs');
  if (tbodyProfs) {
    const map = {};
    appts.forEach(a => {
      const prof = PROFISSIONAIS.find(p => p.id === a.profId);
      const nome = prof ? prof.nome : 'Sem profissional';
      const esp  = prof ? (prof.esp||'—') : '—';
      if (!map[nome]) map[nome] = { esp, total:0, atend:0, cancel:0 };
      map[nome].total++;
      if (a.status==='atendido') map[nome].atend++;
      if (a.status==='cancelado'||a.status==='desmarcado') map[nome].cancel++;
    });
    const rows = Object.entries(map).sort((a,b)=>b[1].total-a[1].total);
    tbodyProfs.innerHTML = rows.length ? rows.map(([nome,d])=>
      '<tr><td style="font-weight:500">' + nome + '</td><td style="color:var(--text-muted)">' + d.esp +
      '</td><td style="text-align:center">' + d.total +
      '</td><td style="text-align:center;color:var(--success)">' + d.atend +
      '</td><td style="text-align:center;color:var(--danger)">' + d.cancel + '</td></tr>'
    ).join('') : '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted)">Sem dados no período</td></tr>';
  }

  // Por plano
  const tbodyPlanos = document.getElementById('rel-tbody-planos');
  if (tbodyPlanos) {
    const map = {};
    appts.forEach(a => {
      const plano = a.plano || 'Particular';
      if (!map[plano]) map[plano] = { total:0, guias:0, valor:0 };
      map[plano].total++;
    });
    GUIAS.filter(g=>(g.data||'')>=iniISO&&(g.data||'')<=fimISO).forEach(g=>{
      const plano = g.plano || 'Particular';
      if (!map[plano]) map[plano] = { total:0, guias:0, valor:0 };
      map[plano].guias++;
      map[plano].valor += g.valor||0;
    });
    const rows = Object.entries(map).sort((a,b)=>b[1].total-a[1].total);
    tbodyPlanos.innerHTML = rows.length ? rows.map(([nome,d])=>
      '<tr><td style="font-weight:500">' + nome +
      '</td><td style="text-align:center">' + d.total +
      '</td><td style="text-align:center">' + d.guias +
      '</td><td style="text-align:right;font-family:var(--font-mono)">' +
        (d.valor>0 ? 'R$ '+d.valor.toLocaleString('pt-BR',{minimumFractionDigits:2}) : '—') +
      '</td></tr>'
    ).join('') : '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-muted)">Sem dados no período</td></tr>';
  }

  // Status das guias
  const guiasStatusEl = document.getElementById('rel-guias-status');
  if (guiasStatusEl) {
    const statusMap = {};
    GUIAS.forEach(g => { statusMap[g.status||'Pendente'] = (statusMap[g.status||'Pendente']||0)+1; });
    const cores = { Pendente:'var(--warning)', Enviado:'var(--info)', Pago:'var(--success)', Negado:'var(--danger)', Glosado:'var(--danger)' };
    const rows = Object.entries(statusMap).sort((a,b)=>b[1]-a[1]);
    const totalGuias = GUIAS.length;
    guiasStatusEl.innerHTML = rows.length ? rows.map(([status, n])=>
      '<div style="margin-bottom:10px">' +
        '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px">' +
          '<span style="color:var(--text-secondary)">' + status + '</span>' +
          '<span style="font-weight:600">' + n + ' <span style="color:var(--text-muted);font-weight:400">(' + (totalGuias>0?Math.round(n/totalGuias*100):0) + '%)</span></span>' +
        '</div>' +
        '<div style="height:6px;background:var(--bg-overlay);border-radius:3px">' +
          '<div style="height:6px;border-radius:3px;background:' + (cores[status]||'var(--accent)') + ';width:' + (totalGuias>0?Math.round(n/totalGuias*100):0) + '%"></div>' +
        '</div>' +
      '</div>'
    ).join('') + '<div style="margin-top:8px;font-size:11px;color:var(--text-muted)">' + totalGuias + ' guias no total</div>'
    : '<div style="color:var(--text-muted);font-size:13px">Nenhuma guia cadastrada</div>';
  }

  // Distribuição por status de agendamento
  const statusDistEl = document.getElementById('rel-status-dist');
  if (statusDistEl) {
    const statusMap = {};
    appts.forEach(a => { statusMap[a.status||'agendado'] = (statusMap[a.status||'agendado']||0)+1; });
    const cores = { agendado:'#60a5fa', confirmado:'#a78bfa', chegou:'#facc15', atendido:'#34d399', desmarcado:'#f87171', cancelado:'#94a3b8' };
    const labels = { agendado:'Agendado', confirmado:'Confirmado', chegou:'Em Espera', atendido:'Atendido', desmarcado:'Desmarcado', cancelado:'Cancelado' };
    const rows = Object.entries(statusMap).sort((a,b)=>b[1]-a[1]);
    statusDistEl.innerHTML = rows.length ? rows.map(([status, n])=>
      '<div style="margin-bottom:10px">' +
        '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px">' +
          '<span style="color:var(--text-secondary)">' + (labels[status]||status) + '</span>' +
          '<span style="font-weight:600">' + n + ' <span style="color:var(--text-muted);font-weight:400">(' + (total>0?Math.round(n/total*100):0) + '%)</span></span>' +
        '</div>' +
        '<div style="height:6px;background:var(--bg-overlay);border-radius:3px">' +
          '<div style="height:6px;border-radius:3px;background:' + (cores[status]||'var(--accent)') + ';width:' + (total>0?Math.round(n/total*100):0) + '%"></div>' +
        '</div>' +
      '</div>'
    ).join('') + '<div style="margin-top:8px;font-size:11px;color:var(--text-muted)">' + total + ' agendamentos ' + label + '</div>'
    : '<div style="color:var(--text-muted);font-size:13px">Sem agendamentos no período</div>';
  }
}

function initApp() {
  carregarTemaSalvo(); // aplica o tema salvo antes de qualquer render
  carregarFeriados();  // carrega feriados do localStorage
  renderPacientesTable();
  renderProfissionaisTable();
  renderProfToday();
  renderPlanosGrid();
  renderGuiasList();
  renderAgenda();
  buildProfFilters();
  populateSelects();
  try { renderDashboard(); } catch(e) {}
  try { updateNavBadges(); } catch(e) {}
  const _profInc = document.getElementById('prof-data-inc'); if(_profInc) _profInc.valueAsDate = new Date();
  const _agData = document.getElementById('ag-data'); if(_agData) _agData.valueAsDate = currentDate;
  const _sadt = document.getElementById('sadt-data-solic'); if(_sadt) _sadt.valueAsDate = new Date();
  // Espaço Conecta
  try { conectaInitSalas(); } catch(e) {}
  // Preenche mês atual no fechamento de locação
  const _locMes = document.getElementById('loc-fech-mes');
  if (_locMes && !_locMes.value) _locMes.value = new Date().toISOString().slice(0,7);
}

