// ═══════════════════════════════════════
//  DASHBOARD — dados dinâmicos
// ═══════════════════════════════════════
function dashChangeDate(delta) {
  dashDate = new Date(dashDate);
  dashDate.setDate(dashDate.getDate() + delta);
  renderDashboard();
}

function dashGotoToday() {
  dashDate = new Date();
  renderDashboard();
}

function renderDashboard() {
  const selISO  = dashDate.getFullYear() + '-' +
    String(dashDate.getMonth()+1).padStart(2,'0') + '-' +
    String(dashDate.getDate()).padStart(2,'0');
  const hojeISO = new Date().getFullYear() + '-' +
    String(new Date().getMonth()+1).padStart(2,'0') + '-' +
    String(new Date().getDate()).padStart(2,'0');
  const isHoje  = selISO === hojeISO;

  // Dia anterior para comparação
  const antObj = new Date(dashDate); antObj.setDate(antObj.getDate() - 1);
  const antISO = antObj.getFullYear() + '-' +
    String(antObj.getMonth()+1).padStart(2,'0') + '-' +
    String(antObj.getDate()).padStart(2,'0');

  // Label da data
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const diasSem = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
  const labelEl = document.getElementById('dash-date-label');
  if (labelEl) {
    labelEl.textContent = diasSem[dashDate.getDay()] + ', ' +
      dashDate.getDate() + ' de ' + meses[dashDate.getMonth()] + ' de ' + dashDate.getFullYear();
    labelEl.style.color = isHoje ? 'var(--accent)' : 'var(--text-primary)';
  }
  const badgeEl = document.getElementById('dash-today-badge');
  if (badgeEl) {
    if (!isHoje) {
      badgeEl.style.display = 'inline';
      badgeEl.textContent = '(hoje é ' + new Date().getDate() + '/' + (new Date().getMonth()+1) + ')';
    } else {
      badgeEl.style.display = 'none';
    }
  }

  // Atualiza labels dos KPIs dinamicamente
  const lblHoje     = document.querySelector('#dash-stats-row .stat-card:nth-child(1) .stat-label');
  const lblConfirm  = document.querySelector('#dash-stats-row .stat-card:nth-child(2) .stat-label');
  const lblCancel   = document.querySelector('#dash-stats-row .stat-card:nth-child(4) .stat-label');
  const dLabel = isHoje ? 'Hoje' : dashDate.getDate() + '/' + (dashDate.getMonth()+1);
  if (lblHoje)   lblHoje.textContent   = 'Consultas ' + dLabel;
  if (lblConfirm) lblConfirm.textContent = 'Confirmados ' + dLabel;
  if (lblCancel)  lblCancel.textContent  = 'Cancelados/Desm. ' + dLabel;

  const apptSel = APPOINTMENTS.filter(a => a.dataISO === selISO);
  const apptAnt = APPOINTMENTS.filter(a => a.dataISO === antISO);

  const totalSel   = apptSel.length;
  const totalAnt   = apptAnt.length;
  const confirmados = apptSel.filter(a => a.status === 'confirmado' || a.status === 'atendido').length;
  const cancelados  = apptSel.filter(a => a.status === 'cancelado' || a.status === 'desmarcado').length;
  const cancelAnt   = apptAnt.filter(a => a.status === 'cancelado' || a.status === 'desmarcado').length;
  const profsAtivos = PROFISSIONAIS.filter(p => p.status !== 'Inativo').length;

  const sv = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  sv('dash-hoje-total',    totalSel);
  sv('dash-confirmados',   confirmados);
  sv('dash-profs-ativos',  profsAtivos);
  sv('dash-cancelados',    cancelados);

  const diffTotal  = totalSel - totalAnt;
  const diffCancel = cancelados - cancelAnt;
  const dRef = isHoje ? 'ontem' : 'dia anterior';
  sv('dash-hoje-delta', diffTotal === 0 ? `= igual a ${dRef}` :
    (diffTotal > 0 ? '↑ ' : '↓ ') + Math.abs(diffTotal) + (diffTotal > 0 ? ' a mais' : ' a menos') + ` que ${dRef}`);
  const elDelta = document.getElementById('dash-hoje-delta');
  if (elDelta) elDelta.className = 'stat-delta ' + (diffTotal > 0 ? 'up' : diffTotal < 0 ? 'down' : '');

  sv('dash-confirmados-pct', totalSel > 0 ? Math.round(confirmados/totalSel*100) + '% do total' : '—');
  sv('dash-profs-total', 'de ' + PROFISSIONAIS.length + ' cadastrados');
  sv('dash-cancelados-delta', diffCancel === 0 ? `= igual a ${dRef}` :
    (diffCancel > 0 ? '↑ ' : '↓ ') + Math.abs(diffCancel) + ` que ${dRef}`);
  const elC = document.getElementById('dash-cancelados-delta');
  if (elC) elC.className = 'stat-delta ' + (diffCancel > 0 ? 'down' : diffCancel < 0 ? 'up' : '');

  // Título da tabela de consultas
  const tblTitle = document.querySelector('#page-dashboard .table-title');
  if (tblTitle) tblTitle.textContent = isHoje ? 'Consultas de hoje' : 'Consultas de ' + dLabel;

  // Tabela de consultas — apenas agendados e confirmados
  const tbody = document.getElementById('dash-consultas-tbody');
  if (tbody) {
    const apptConsultas = apptSel.filter(a => a.status === 'agendado' || a.status === 'confirmado');
    const sorted = [...apptConsultas].sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
    if (sorted.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted)">Nenhuma consulta para ${dLabel}</td></tr>`;
    } else {
      const statusMap = {
        agendado:   {cls:'blue',   lbl:'Agendado'},
        confirmado: {cls:'purple', lbl:'Confirmado'},
        chegou:     {cls:'yellow', lbl:'Em Espera'},
        atendido:   {cls:'green',  lbl:'Atendido'},
        desmarcado: {cls:'red',    lbl:'Desmarcado'},
        cancelado:  {cls:'gray',   lbl:'Cancelado'},
      };
      tbody.innerHTML = sorted.map(a => {
        const prof = PROFISSIONAIS.find(p => p.id === a.profId);
        const pac  = PACIENTES.find(p => p.nome === a.paciente);
        const initials = a.paciente.split(' ').slice(0,2).map(w=>w[0]||'').join('').toUpperCase();
        const s   = statusMap[a.status] || {cls:'gray', lbl: a.status};
        const cor = prof ? prof.cor : '#8b92a8';
        const canAct = !['cancelado','desmarcado'].includes(a.status);
        const pacAvatar = pac && pac.foto
          ? '<div class="avatar-sm" style="overflow:hidden;padding:0;flex-shrink:0"><img src="' + pac.foto + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%"></div>'
          : '<div class="avatar-sm" style="background:rgba(79,142,247,0.12);color:var(--accent);flex-shrink:0">' + initials + '</div>';
        return '<tr>' +
          '<td><span style="font-family:var(--font-mono);color:var(--text-secondary)">' + (a.hora||'—') + '</span></td>' +
          '<td><div style="display:flex;align-items:center;gap:8px">' + pacAvatar + '<span>' + a.paciente + '</span></div></td>' +
          '<td><span style="display:flex;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:50%;background:' + cor + ';display:inline-block;flex-shrink:0"></span>' + (prof ? (prof.nomeAgenda || prof.nome.split(' ')[0]) : '—') + '</span></td>' +
          '<td>' + (a.plano || '—') + '</td>' +
          '<td><span class="chip ' + s.cls + '">' + s.lbl + '</span></td>' +
          '<td><div class="table-actions" style="gap:4px">' +
            (a.status === 'agendado' ?
              '<button class="action-btn dash-btn" data-id="' + a.id + '" data-st="confirmado" title="Confirmar" style="color:var(--success)"><svg viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></button>' : '') +
            (a.status !== 'atendido' && canAct ?
              '<button class="action-btn dash-btn" data-id="' + a.id + '" data-st="atendido" title="Atendido" style="color:var(--accent)"><svg viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg></button>' : '') +
            (canAct ?
              '<button class="action-btn dash-btn" data-id="' + a.id + '" data-st="desmarcado" title="Desmarcar" style="color:var(--danger)"><svg viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>' : '') +
          '</div></td></tr>';
      }).join('');
      tbody.querySelectorAll('.dash-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          updateStatus(parseInt(this.dataset.id), this.dataset.st);
          setTimeout(renderDashboard, 400);
        });
      });
    }
  }

  // Guias pendentes
  const guiasPend = GUIAS.filter(g => g.status === 'Pendente').slice(0, 6);
  const guiasList = document.getElementById('dash-guias-list');
  const guiasCount = document.getElementById('dash-guias-count');
  const totalPend = GUIAS.filter(g => g.status === 'Pendente').length;
  if (guiasCount) guiasCount.textContent = totalPend + ' pendente' + (totalPend !== 1 ? 's' : '');
  if (guiasList) {
    if (guiasPend.length === 0) {
      guiasList.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px">Nenhuma guia pendente ✓</div>';
    } else {
      guiasList.innerHTML = guiasPend.map(g =>
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 16px;border-bottom:1px solid var(--border)">' +
          '<div><div style="font-size:13px;font-weight:500">' + g.pac + '</div>' +
          '<div style="font-size:11px;color:var(--text-muted)">' + (g.plano||'—') + ' · SADT</div></div>' +
          '<span class="chip yellow">Pendente</span>' +
        '</div>'
      ).join('') + (totalPend > 6 ? '<div style="padding:8px 16px;font-size:11px;color:var(--text-muted)">+ ' + (totalPend-6) + ' outras guias</div>' : '');
    }
  }

  // Resumo geral
  const mesAtual = new Date().toISOString().slice(0, 7);
  const apptMes  = APPOINTMENTS.filter(a => (a.dataISO||'').startsWith(mesAtual));
  const resumoEl = document.getElementById('dash-resumo-geral');
  if (resumoEl) {
    const rows = [
      ['Pacientes cadastrados', PACIENTES.length],
      ['Pacientes ativos', PACIENTES.filter(p => p.status === 'Ativo').length],
      ['Profissionais', PROFISSIONAIS.length],
      ['Planos de saúde', PLANOS.length],
      ['Consultas este mês', apptMes.length],
      ['Guias pendentes', GUIAS.filter(g => g.status === 'Pendente').length],
      ['Lista de espera', LISTA_ESPERA.filter(e => e.status === 'Aguardando').length],
    ];
    resumoEl.innerHTML = rows.map(([lbl, val]) =>
      '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px">' +
        '<span style="color:var(--text-secondary)">' + lbl + '</span>' +
        '<span style="font-weight:600">' + val + '</span>' +
      '</div>'
    ).join('');
  }

  // Por plano (mês atual)
  const porPlanoEl = document.getElementById('dash-por-plano');
  if (porPlanoEl) {
    const contagem = {};
    apptMes.forEach(a => { contagem[a.plano||'Particular'] = (contagem[a.plano||'Particular']||0)+1; });
    const sorted = Object.entries(contagem).sort((a,b)=>b[1]-a[1]).slice(0,6);
    const maxVal = sorted[0]?.[1] || 1;
    porPlanoEl.innerHTML = sorted.length ? sorted.map(([nome, n]) =>
      '<div style="margin-bottom:8px">' +
        '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px"><span style="color:var(--text-secondary)">' + nome + '</span><span style="font-weight:600">' + n + '</span></div>' +
        '<div style="height:4px;background:var(--bg-overlay);border-radius:2px"><div style="height:4px;background:var(--accent);border-radius:2px;width:' + Math.round(n/maxVal*100) + '%"></div></div>' +
      '</div>'
    ).join('') : '<div style="color:var(--text-muted);font-size:13px">Sem dados este mês</div>';
  }

  // Por profissional (mês atual)
  const porProfEl = document.getElementById('dash-por-prof');
  if (porProfEl) {
    const contagem = {};
    apptMes.forEach(a => {
      const prof = PROFISSIONAIS.find(p => p.id === a.profId);
      const nome = prof ? (prof.nomeAgenda || prof.nome.split(' ')[0]) : 'Outros';
      const cor  = prof ? prof.cor : '#8b92a8';
      if (!contagem[nome]) contagem[nome] = { n: 0, cor };
      contagem[nome].n++;
    });
    const sorted = Object.entries(contagem).sort((a,b)=>b[1].n-a[1].n).slice(0,6);
    const maxVal = sorted[0]?.[1]?.n || 1;
    porProfEl.innerHTML = sorted.length ? sorted.map(([nome, {n, cor}]) =>
      '<div style="margin-bottom:8px">' +
        '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px"><span style="color:var(--text-secondary)">' + nome + '</span><span style="font-weight:600">' + n + '</span></div>' +
        '<div style="height:4px;background:var(--bg-overlay);border-radius:2px"><div style="height:4px;background:' + cor + ';border-radius:2px;width:' + Math.round(n/maxVal*100) + '%"></div></div>' +
      '</div>'
    ).join('') : '<div style="color:var(--text-muted);font-size:13px">Sem dados este mês</div>';
  }

  // Profissionais hoje
  try { renderProfToday(); } catch(e) {}
}

