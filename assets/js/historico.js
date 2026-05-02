// ═══════════════════════════════════════
//  HISTÓRICO DO PACIENTE — MÓDULO
// ═══════════════════════════════════════

function renderHistPacList(filter='') {
  // Legacy: mantém compatibilidade mas não renderiza mais lista lateral
  // A busca agora é via dropdown (filterPacientesHist)
}

function filterPacientesHist(v) {
  const dropdown = document.getElementById('hist-busca-dropdown');
  if (!dropdown) return;
  if (!v || v.trim().length < 1) { dropdown.style.display='none'; return; }
  const q = v.toLowerCase();
  let list = PACIENTES.filter(p=>p.status!=='Inativo' && p.nome.toLowerCase().includes(q));
  if (!list.length) {
    dropdown.style.display = 'block';
    dropdown.innerHTML = '<div style="padding:14px;color:var(--text-muted);font-size:13px;text-align:center">Nenhum paciente encontrado</div>';
    return;
  }
  dropdown.style.display = 'block';
  // Position dropdown below the search bar
  const searchWrap = document.getElementById('hist-busca-input')?.closest('.search-input-wrap');
  if (searchWrap) {
    const rect = searchWrap.getBoundingClientRect();
    dropdown.style.position = 'fixed';
    dropdown.style.top = (rect.bottom + 4) + 'px';
    dropdown.style.left = rect.left + 'px';
    dropdown.style.width = rect.width + 'px';
  }
  dropdown.innerHTML = list.slice(0, 20).map(p => {
    const apptCount = APPOINTMENTS.filter(a=>a.paciente===p.nome).length;
    const evolCount = HISTORICO.filter(h=>h.pacId===p.id&&h.tipo==='evolucao').length;
    return '<div class="hist-dropdown-item" style="padding:10px 14px;border-bottom:1px solid var(--border);cursor:pointer;transition:background var(--transition)" ' +
      'onmouseover="this.style.background=\'var(--bg-raised)\'" onmouseout="this.style.background=\'\'" ' +
      'onclick="selecionarPacienteHist('+p.id+',\''+p.nome.replace(/'/g,"\\'")+'\')">' +
      '<div style="font-size:13px;font-weight:500">'+p.nome+'</div>' +
      '<div style="font-size:11px;color:var(--text-muted);margin-top:2px">'+apptCount+' consultas · '+evolCount+' evoluções</div>' +
    '</div>';
  }).join('');
  // Close on click outside
  setTimeout(() => {
    document.addEventListener('click', function closeDropdown(e) {
      if (!dropdown.contains(e.target)) { dropdown.style.display='none'; document.removeEventListener('click', closeDropdown); }
    });
  }, 50);
}

function selecionarPacienteHist(pacId, nome) {
  const dropdown = document.getElementById('hist-busca-dropdown');
  if (dropdown) dropdown.style.display = 'none';
  const input = document.getElementById('hist-busca-input');
  if (input) input.value = nome;
  abrirHistPaciente(pacId);
}

function abrirHistPaciente(pacId) {
  historicoAtualPacId = pacId;
  const p = PACIENTES.find(x=>x.id===pacId);
  if (!p) return;

  // Header
  const header = document.getElementById('hist-pac-header');
  const empty  = document.getElementById('hist-empty');
  const tabs   = document.getElementById('hist-tabs-area');
  if (header) header.style.display='block';
  if (empty)  empty.style.display='none';
  if (tabs)   { tabs.style.display='flex'; }

  const av = document.getElementById('hist-pac-avatar');
  if (av) {
    if (p.foto) {
      av.innerHTML = `<img src="${p.foto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
      av.style.padding = '0';
      av.style.overflow = 'hidden';
    } else {
      const initials = p.nome.split(' ').map(n=>n[0]).slice(0,2).join('');
      av.innerHTML = '';
      av.textContent = initials;
      av.style.padding = '';
      av.style.overflow = '';
    }
  }
  document.getElementById('hist-pac-nome').textContent = p.nome;
  const idadeAnos = p.nasc ? Math.floor((new Date()-new Date(p.nasc))/(365.25*24*3600*1000)) : null;
  document.getElementById('hist-pac-info').textContent =
    (idadeAnos?idadeAnos+' anos · ':'')+p.plano+(p.carteirinha&&p.carteirinha!=='—'?' · '+p.carteirinha:'');

  // Stats
  const appts = APPOINTMENTS.filter(a=>a.paciente===p.nome);
  const hists = HISTORICO.filter(h=>h.pacId===pacId);
  const statsEl = document.getElementById('hist-pac-stats');
  if (statsEl) {
    const stats = [
      { label:'Agendamentos', val:appts.length,                              color:'var(--accent)'  },
      { label:'Atendimentos', val:appts.filter(a=>a.status==='atendido').length, color:'var(--success)' },
      { label:'Evoluções',    val:hists.filter(h=>h.tipo==='evolucao').length,   color:'var(--info)'    },
      { label:'Anamneses',    val:hists.filter(h=>h.tipo==='anamnese').length,   color:'var(--warning)' },
      { label:'Cancelados',   val:appts.filter(a=>a.status==='cancelado'||a.status==='desmarcado').length, color:'var(--danger)' },
    ];
    statsEl.innerHTML = stats.map(s=>
      '<div style="background:var(--bg-raised);border-radius:var(--radius-sm);padding:8px 10px;text-align:center">' +
      '<div style="font-size:18px;font-weight:700;color:'+s.color+'">'+s.val+'</div>' +
      '<div style="font-size:10px;color:var(--text-muted);margin-top:1px">'+s.label+'</div></div>'
    ).join('');
  }

  // Render first tab
  histTab('linha', document.getElementById('htab-linha'));
}

function histTab(tab, btn) {
  ['linha','evolucoes','anamnese','guias','completo'].forEach(t => {
    const panEl = document.getElementById('hist-panel-'+t);
    const tabEl = document.getElementById('htab-'+t);
    if (panEl) panEl.style.display = t===tab ? 'block' : 'none';
    if (tabEl) tabEl.classList.toggle('active', t===tab);
  });
  if (tab==='linha')     renderTimeline();
  if (tab==='evolucoes') renderEvolucoes();
  if (tab==='anamnese')  renderAnamnese();
  if (tab==='guias')     renderHistGuiasSadt();
  if (tab==='completo')  renderProntuarioCompleto();
}

function renderTimeline() {
  const pacId = historicoAtualPacId;
  const p     = PACIENTES.find(x=>x.id===pacId);
  if (!p) return;
  const el = document.getElementById('hist-timeline');
  if (!el) return;

  // Merge appointments and historico events, sort by date desc
  const appts = APPOINTMENTS.filter(a=>a.paciente===p.nome);
  const hists = HISTORICO.filter(h=>h.pacId===pacId);

  // Guias SADT do paciente, agrupadas por data
  const guiasPac = (typeof GUIAS !== 'undefined' ? GUIAS : []).filter(g =>
    (g.pac||g.paciente||g.pacienteNome||g.nomePaciente||'').toLowerCase() === p.nome.toLowerCase()
  );
  const guiasByDate = {};
  guiasPac.forEach(g => {
    const d = g.data || g.dataAtendimento || g.dataEmissao || '';
    if (!d) return;
    if (!guiasByDate[d]) guiasByDate[d] = [];
    guiasByDate[d].push(g);
  });

  // Build a date-keyed map for quick grouping
  const apptByDate = {};
  appts.forEach(a => {
    const d = a.dataISO||'';
    if (!apptByDate[d]) apptByDate[d] = [];
    apptByDate[d].push(a);
  });

  const evolByDate = {};
  hists.filter(h=>h.tipo==='evolucao').forEach(h => {
    const d = h.data||'';
    if (!evolByDate[d]) evolByDate[d] = [];
    evolByDate[d].push(h);
  });

  // Non-evolucao historico items (anamnese, etc.)
  const otherHists = hists.filter(h=>h.tipo!=='evolucao');

  // Collect all dates (inclui datas com guias SADT)
  const allDates = new Set([
    ...Object.keys(apptByDate),
    ...Object.keys(evolByDate),
    ...otherHists.map(h=>h.data||''),
    ...Object.keys(guiasByDate),
  ]);

  if (!allDates.size) {
    el.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted)">Nenhum evento registrado para este paciente.</div>';
    return;
  }

  const sortedDates = [...allDates].filter(Boolean).sort((a,b)=>b.localeCompare(a));

  const icons = { agendamento:'📅', evolucao:'📝', anamnese:'📋', avaliacao:'🩺' };
  const statusColors = { agendado:'#60a5fa', confirmado:'#a78bfa', chegou:'#facc15', atendido:'#34d399', cancelado:'#94a3b8', desmarcado:'#f87171' };

  // Helper: renderiza badge(s) de guia SADT para uma data
  function guiasBadge(date) {
    const gs = guiasByDate[date] || [];
    if (!gs.length) return '';
    return gs.map(g => {
      const num = g.numGuiaPrestador || g.numGuia || g.num || g.id || '—';
      const plano = g.plano || g.convenio || '';
      const status = g.status || 'Pendente';
      const statusCor = status==='Enviado'||status==='Faturado' ? 'var(--success)' : status==='Pendente' ? 'var(--warning)' : 'var(--text-muted)';
      return '<span title="Guia SADT'+(plano?' · '+plano:'')+' · '+status+'" style="display:inline-flex;align-items:center;gap:4px;background:rgba(96,165,250,0.12);border:1px solid rgba(96,165,250,0.3);border-radius:99px;padding:2px 8px;font-size:10px;font-family:var(--font-mono);color:#60a5fa;cursor:default">🧾 '+num+'</span>';
    }).join(' ');
  }

  el.innerHTML = sortedDates.map(date => {
    const dateFmt = date ? date.split('-').reverse().join('/') : '—';
    let html = '';

    // Appointments for this date
    (apptByDate[date]||[]).forEach(a => {
      const dotColor = statusColors[a.status] || 'var(--accent)';
      const chipStr = '<span class="chip '+(a.status==='atendido'?'green':a.status==='cancelado'?'gray':a.status==='confirmado'?'purple':a.status==='chegou'?'yellow':a.status==='desmarcado'?'red':'blue')+'" style="font-size:10px">'+a.status+'</span>';
      // Evoluções do mesmo dia — embute dentro do box do agendamento
      const evolsNoDia = (evolByDate[date]||[]);
      const evolsHTML = evolsNoDia.length ? evolsNoDia.map(ev => {
        const prof = PROFISSIONAIS.find(x=>x.id===ev.profId);
        return '<div style="background:var(--bg-overlay);border-left:3px solid var(--success);border-radius:0 var(--radius-sm) var(--radius-sm) 0;padding:8px 12px;margin-top:8px">' +
          '<div style="font-size:11px;font-weight:600;color:var(--success);margin-bottom:4px">📝 '+(ev.titulo||'Evolução')+(prof?' · <span style="color:var(--text-muted)">'+prof.nome+'</span>':'')+'</div>' +
          '<div style="font-size:12px;color:var(--text-secondary);white-space:pre-wrap;line-height:1.5">'+(ev.conteudo?.texto||'')+'</div>' +
          '<div style="margin-top:6px;display:flex;gap:4px">' +
            '<button class="action-btn" style="font-size:11px" onclick="editarHistorico('+ev.id+')">✏️</button>' +
            '<button class="action-btn" style="font-size:11px;color:var(--danger)" onclick="excluirHistorico('+ev.id+')">🗑</button>' +
          '</div>' +
        '</div>';
      }).join('') : '';
      const badges = guiasBadge(date);
      html += '<div style="display:flex;gap:14px;padding:12px 0;border-bottom:1px solid var(--border)">' +
        '<div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0;width:32px">' +
          '<div style="width:12px;height:12px;border-radius:50%;background:'+dotColor+';border:2px solid var(--bg-surface);flex-shrink:0"></div>' +
          '<div style="width:2px;flex:1;background:var(--border);margin-top:4px"></div>' +
        '</div>' +
        '<div style="flex:1;padding-bottom:4px">' +
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">' +
            '<span style="font-size:14px">📅</span>' +
            '<span style="font-size:13px;font-weight:500">'+a.hora+' — '+a.plano+'</span>' +
            chipStr +
            (badges ? badges : '') +
            '<span style="margin-left:auto;font-size:11px;color:var(--text-muted)">'+dateFmt+'</span>' +
          '</div>' +
          (a.obs?'<div style="font-size:12px;color:var(--text-secondary);background:var(--bg-raised);padding:6px 10px;border-radius:var(--radius-sm)">'+a.obs+'</div>':'') +
          evolsHTML +
        '</div>' +
      '</div>';
    });

    // Evoluções sem agendamento no mesmo dia (ou dias sem agendamento)
    if (!apptByDate[date] || !apptByDate[date].length) {
      (evolByDate[date]||[]).forEach(ev => {
        const prof = PROFISSIONAIS.find(x=>x.id===ev.profId);
        const badges = guiasBadge(date);
        html += '<div style="display:flex;gap:14px;padding:12px 0;border-bottom:1px solid var(--border)">' +
          '<div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0;width:32px">' +
            '<div style="width:12px;height:12px;border-radius:50%;background:#34d399;border:2px solid var(--bg-surface);flex-shrink:0"></div>' +
            '<div style="width:2px;flex:1;background:var(--border);margin-top:4px"></div>' +
          '</div>' +
          '<div style="flex:1;padding-bottom:4px">' +
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">' +
              '<span style="font-size:14px">📝</span>' +
              '<span style="font-size:13px;font-weight:500">'+(ev.titulo||'Evolução')+'</span>' +
              (prof?'<span style="font-size:11px;color:var(--text-muted)">'+prof.nome+'</span>':'') +
              (badges ? badges : '') +
              '<span style="margin-left:auto;font-size:11px;color:var(--text-muted)">'+dateFmt+'</span>' +
            '</div>' +
            (ev.conteudo?.texto?'<div style="font-size:12px;color:var(--text-secondary);white-space:pre-wrap;line-height:1.5;background:var(--bg-raised);padding:6px 10px;border-radius:var(--radius-sm)">'+ev.conteudo.texto+'</div>':'') +
            '<div style="margin-top:4px;display:flex;gap:4px">' +
              '<button class="action-btn" onclick="editarHistorico('+ev.id+')">'+EDIT_ICON+'</button>' +
              '<button class="action-btn" style="color:var(--danger)" onclick="excluirHistorico('+ev.id+')">'+DEL_ICON+'</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      });
    }

    // Other historico items (anamnese etc.) for this date
    otherHists.filter(h=>(h.data||'')===date).forEach(h => {
      const evtColors = { anamnese:'#f59e0b', avaliacao:'#60a5fa' };
      const dotColor = evtColors[h.tipo]||'var(--accent)';
      html += '<div style="display:flex;gap:14px;padding:12px 0;border-bottom:1px solid var(--border)">' +
        '<div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0;width:32px">' +
          '<div style="width:12px;height:12px;border-radius:50%;background:'+dotColor+';border:2px solid var(--bg-surface);flex-shrink:0"></div>' +
          '<div style="width:2px;flex:1;background:var(--border);margin-top:4px"></div>' +
        '</div>' +
        '<div style="flex:1;padding-bottom:4px">' +
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">' +
            '<span style="font-size:14px">'+(icons[h.tipo]||'📄')+'</span>' +
            '<span style="font-size:13px;font-weight:500">'+(h.titulo||h.tipo)+'</span>' +
            (h.fonte?'<span class="chip gray" style="font-size:10px">'+h.fonte+'</span>':'') +
            '<span style="margin-left:auto;font-size:11px;color:var(--text-muted)">'+dateFmt+'</span>' +
          '</div>' +
          (h.conteudo?.resumo?'<div style="font-size:12px;color:var(--text-secondary);margin-top:4px">'+h.conteudo.resumo+'</div>':'') +
        '</div>' +
      '</div>';
    });

    // Guias SADT em datas sem agendamento nem evolução (entrada exclusiva de guia)
    const temAppt = !!(apptByDate[date] && apptByDate[date].length);
    const temEvol = !!(evolByDate[date] && evolByDate[date].length);
    const temOther = otherHists.some(h=>(h.data||'')===date);
    if (!temAppt && !temEvol && !temOther && guiasByDate[date]) {
      guiasByDate[date].forEach(g => {
        const num = g.numGuiaPrestador || g.numGuia || g.num || g.id || '—';
        const plano = g.plano || g.convenio || '—';
        const status = g.status || 'Pendente';
        const statusCor = status==='Enviado'||status==='Faturado' ? 'var(--success)' : status==='Pendente' ? 'var(--warning)' : 'var(--text-muted)';
        const valor = g.valor != null ? ' · R$ '+parseFloat(g.valor).toLocaleString('pt-BR',{minimumFractionDigits:2}) : '';
        html += '<div style="display:flex;gap:14px;padding:12px 0;border-bottom:1px solid var(--border)">' +
          '<div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0;width:32px">' +
            '<div style="width:12px;height:12px;border-radius:50%;background:#60a5fa;border:2px solid var(--bg-surface);flex-shrink:0"></div>' +
            '<div style="width:2px;flex:1;background:var(--border);margin-top:4px"></div>' +
          '</div>' +
          '<div style="flex:1;padding-bottom:4px">' +
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">' +
              '<span style="font-size:14px">🧾</span>' +
              '<span style="font-size:13px;font-weight:500">Guia SADT — '+plano+'</span>' +
              '<span style="background:rgba(96,165,250,0.12);border:1px solid rgba(96,165,250,0.3);border-radius:99px;padding:2px 8px;font-size:10px;font-family:var(--font-mono);color:#60a5fa">'+num+'</span>' +
              '<span style="font-size:11px;color:'+statusCor+'">'+status+'</span>' +
              '<span style="margin-left:auto;font-size:11px;color:var(--text-muted)">'+dateFmt+'</span>' +
            '</div>' +
            (valor?'<div style="font-size:12px;color:var(--text-muted)">'+valor.trim()+'</div>':'') +
          '</div>' +
        '</div>';
      });
    }

    return html;
  }).join('');
}

function renderHistGuiasSadt() {
  const el = document.getElementById('hist-guias-content');
  if (!el || !historicoAtualPacId) return;
  const p = PACIENTES.find(x => x.id === historicoAtualPacId);
  if (!p) return;

  const guiasPac = (typeof GUIAS !== 'undefined' ? GUIAS : []).filter(g =>
    (g.pac||g.paciente||g.pacienteNome||g.nomePaciente||'').toLowerCase() === p.nome.toLowerCase()
  ).sort((a,b) => ((b.data||b.dataAtendimento||'').localeCompare(a.data||a.dataAtendimento||'')));

  const headerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">' +
    '<div>' +
      '<div style="font-size:13px;font-weight:600;color:var(--text-secondary)">Guias SADT do paciente</div>' +
      '<div style="font-size:11px;color:var(--text-muted);margin-top:2px">'+guiasPac.length+' guia(s) encontrada(s)</div>' +
    '</div>' +
    '<button class="btn-sm btn-accent" onclick="switchAgTab&&switchAgTab(\'sadt\',null)">+ Nova guia SADT</button>' +
  '</div>';

  if (!guiasPac.length) {
    el.innerHTML = headerHTML + '<div style="text-align:center;padding:40px 20px;color:var(--text-muted);background:var(--bg-raised);border-radius:var(--radius-md)">' +
      '<div style="font-size:28px;margin-bottom:8px">🧾</div>' +
      '<div style="font-size:13px">Nenhuma guia SADT gerada para este paciente.</div>' +
    '</div>';
    return;
  }

  const rows = guiasPac.map(g => {
    const num = g.numGuiaPrestador || g.numGuia || g.num || g.id || '—';
    const data = g.data || g.dataAtendimento || g.dataEmissao || '';
    const dataFmt = data ? data.split('-').reverse().join('/') : '—';
    const plano = g.plano || g.convenio || '—';
    const status = g.status || 'Pendente';
    const statusCor = status==='Enviado'||status==='Faturado' ? 'var(--success)' : status==='Pendente' ? 'var(--warning)' : 'var(--text-muted)';
    const valor = g.valor != null ? 'R$ '+parseFloat(g.valor).toLocaleString('pt-BR',{minimumFractionDigits:2}) : '—';
    const lote = g.loteNum ? '<span style="font-size:10px;font-family:var(--font-mono);color:var(--text-muted)">Lote '+g.loteNum+'</span>' : '';
    const procs = Array.isArray(g.procedimentos) && g.procedimentos.length
      ? '<div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap">' +
          g.procedimentos.map(pr => '<span style="font-size:10px;background:var(--bg-overlay);border-radius:4px;padding:2px 6px;color:var(--text-secondary)">'+(pr.codigo||pr.cod||'')+(pr.desc?' — '+pr.desc:'')+'</span>').join('') +
        '</div>'
      : '';
    return '<div style="background:var(--bg-raised);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px 16px;margin-bottom:10px">' +
      '<div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap">' +
        '<div style="display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:var(--radius-sm);background:rgba(96,165,250,0.12);flex-shrink:0">' +
          '<span style="font-size:18px">🧾</span>' +
        '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">' +
            '<span style="font-size:13px;font-weight:600;font-family:var(--font-mono);color:#60a5fa">#'+num+'</span>' +
            '<span style="font-size:12px;color:var(--text-secondary)">'+plano+'</span>' +
            '<span style="font-size:11px;font-weight:500;color:'+statusCor+'">● '+status+'</span>' +
            lote +
            '<span style="margin-left:auto;font-size:11px;color:var(--text-muted)">'+dataFmt+'</span>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:16px;font-size:12px;color:var(--text-muted)">' +
            '<span>💰 '+valor+'</span>' +
          '</div>' +
          procs +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  el.innerHTML = headerHTML + rows;
}

function renderEvolucoes() {
  const el = document.getElementById('hist-evolucoes-list');
  if (!el) return;

  let headerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">' +
    '<div style="font-size:13px;font-weight:600;color:var(--text-secondary)">Evoluções do paciente</div>' +
    '<div style="display:flex;gap:6px">' +
      '<button class="btn-sm btn-secondary" onclick="abrirImportarEvolucoes()" style="font-size:12px">📥 Importar CSV</button>' +
      '<button class="btn-sm btn-accent" onclick="novaEvolucao()" style="font-size:12px">+ Nova evolução</button>' +
    '</div></div>';

  const evs = HISTORICO.filter(h=>h.pacId===historicoAtualPacId&&h.tipo==='evolucao')
    .sort((a,b)=>(b.data||'').localeCompare(a.data||''));

  if (!evs.length) {
    el.innerHTML = headerHTML + '<div style="text-align:center;padding:32px;color:var(--text-muted)">Nenhuma evolução registrada.<br><button class="btn-sm btn-accent" style="margin-top:12px" onclick="novaEvolucao()">Registrar primeira evolução</button></div>';
    return;
  }
  el.innerHTML = headerHTML;
  evs.forEach(ev => {
    const prof = PROFISSIONAIS.find(p=>p.id===ev.profId);
    const pi   = evoPresencaInfo ? evoPresencaInfo(ev.conteudo?.presenca) : null;
    const card = document.createElement('div');
    card.style.cssText = 'background:var(--bg-raised);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px 16px;margin-bottom:10px';

    // Linha de metadados: data, horário, convênio, presença
    const dateFmt = ev.data ? ev.data.split('-').reverse().join('/') : '';
    const horaStr = ev.conteudo?.horaIni
      ? ev.conteudo.horaIni + (ev.conteudo.horaFim ? ' – '+ev.conteudo.horaFim : '')
      : '';
    const metaParts = [
      dateFmt,
      horaStr,
      ev.conteudo?.duracao ? ev.conteudo.duracao+' min' : '',
      ev.conteudo?.convenio || '',
      prof ? prof.nome : '',
    ].filter(Boolean);

    const presChip = pi && ev.conteudo?.presenca
      ? '<span class="chip '+pi.chip+'" style="font-size:10px;margin-left:6px">'+ev.conteudo.presenca+'</span>' : '';
    const semanaTag = ev.conteudo?.semana
      ? '<span style="font-size:10px;color:var(--text-muted);margin-left:6px">· '+ev.conteudo.semana+'</span>' : '';
    const fonteTag = ev.fonte && ev.fonte!=='Manual'
      ? '<span class="chip gray" style="font-size:10px;margin-left:6px">'+ev.fonte+'</span>' : '';

    card.innerHTML =
      '<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px">' +
        '<span style="font-size:18px;line-height:1.4">'+(pi?pi.icon:'📝')+'</span>' +
        '<div style="flex:1">' +
          '<div style="font-size:13px;font-weight:600;display:flex;align-items:center;flex-wrap:wrap;gap:2px">' +
            (ev.titulo||'Evolução') + presChip + semanaTag + fonteTag +
          '</div>' +
          '<div style="font-size:11px;color:var(--text-muted);margin-top:2px">'+metaParts.join(' · ')+'</div>' +
        '</div>' +
        '<div style="display:flex;gap:4px;flex-shrink:0">' +
          '<button class="action-btn" onclick="editarHistorico('+ev.id+')">'+EDIT_ICON+'</button>' +
          '<button class="action-btn" style="color:var(--danger)" onclick="excluirHistorico('+ev.id+')">'+DEL_ICON+'</button>' +
        '</div>' +
      '</div>' +
      (ev.conteudo?.texto
        ? '<div style="font-size:13px;color:var(--text-secondary);white-space:pre-wrap;line-height:1.6;border-top:1px solid var(--border);padding-top:8px;margin-top:4px">'+ev.conteudo.texto+'</div>'
        : '<div style="font-size:12px;color:var(--text-muted);font-style:italic;border-top:1px solid var(--border);padding-top:8px;margin-top:4px">Sem texto de evolução registrado.</div>');
    el.appendChild(card);
  });
}

