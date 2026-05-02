// ═══════════════════════════════════════════════════════════════════
//  IMPORTAR EVOLUÇÕES — Google Sheets
//  Layout: ID · Data · Horário Início · Horário Fim · Duração (min)
//          Paciente · Convênio · Semana · Presença · Evolução
//          Mês · Ano · Registrado em
// ═══════════════════════════════════════════════════════════════════

const PRESENCA_PRESENTE   = ['presente','p','sim','yes'];
const PRESENCA_JUSTIFICOU = ['justificou','justificada','j','justificou ausência'];
const PRESENCA_FALTA      = ['falta','ausente','não compareceu','nao compareceu','f'];

function evoPresencaInfo(pres) {
  const p = (pres||'').toLowerCase().trim();
  if (PRESENCA_PRESENTE.includes(p))   return { icon:'✓', color:'var(--success)', chip:'green',  status:'atendido' };
  if (PRESENCA_JUSTIFICOU.includes(p)) return { icon:'⚡', color:'var(--warning)', chip:'yellow', status:'desmarcado' };
  if (PRESENCA_FALTA.includes(p))      return { icon:'✗', color:'var(--danger)',  chip:'red',    status:'falta' };
  return { icon:'·', color:'var(--text-muted)', chip:'gray', status:'' };
}

// Parseia CSV com o layout exato do Google Sheets de evoluções
function parseEvolucaoCSV(txt) {
  const rows = parseCSVLines(txt);
  if (rows.length < 2) throw new Error('Arquivo sem dados');

  const headers = rows[0].map(h => (h||'').trim());
  const fi = (...terms) => {
    for (const t of terms) {
      const i = headers.findIndex(h => h.toLowerCase().includes(t.toLowerCase()));
      if (i >= 0) return i;
    }
    return -1;
  };

  const iData     = fi('data','date');
  const iHini     = fi('horário início','horario inicio','hora início','hora ini','inicio','start');
  const iHfim     = fi('horário fim','horario fim','hora fim','fim','end');
  const iDur      = fi('duração','duracao','duration');
  const iPac      = fi('paciente','nome','patient');
  const iConv     = fi('convênio','convenio','plano');
  const iSemana   = fi('semana','week');
  const iPresenca = fi('presença','presenca','presence');
  const iEvo      = fi('evolução','evolucao','evolution','texto','notas','observ');
  const iReg      = fi('registrado','registered','timestamp','created');

  if (iData < 0) throw new Error('Coluna "Data" não encontrada no CSV');
  if (iPac  < 0) throw new Error('Coluna "Paciente" não encontrada no CSV');

  const result = [];
  rows.slice(1).forEach((cells, rowIdx) => {
    const g = i => (i >= 0 ? (cells[i]||'') : '').trim();
    const pacNome  = g(iPac);
    const dataStr  = g(iData);
    const horaIni  = g(iHini);
    const horaFim  = g(iHfim);
    const durStr   = g(iDur);
    const convNome = g(iConv);
    const semana   = g(iSemana);
    const presenca = g(iPresenca);
    const evoTxt   = g(iEvo);
    const regStr   = g(iReg);

    if (!pacNome && !dataStr) return; // linha vazia

    // Normaliza data: yyyy-mm-dd (padrão Google) e dd/mm/yyyy
    let dataISO = '';
    if (dataStr) {
      let m = dataStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) { dataISO = m[1]+'-'+m[2]+'-'+m[3]; }
      else {
        m = dataStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
        if (m) dataISO = (m[3].length===2?'20'+m[3]:m[3])+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
      }
    }

    const pac  = encontrarPacientePorNome(pacNome);
    const appt = pac ? APPOINTMENTS.find(a =>
      a.paciente === pac.nome &&
      (dataISO ? a.dataISO === dataISO : false) ||
      (pac && horaIni ? (a.paciente===pac.nome && a.hora===horaIni) : false)
    ) : null;

    // Deduplicação por paciente + data + hora de início
    const dup = pac ? HISTORICO.find(h =>
      h.pacId === pac.id && h.tipo === 'evolucao' &&
      h.data === (dataISO||dataStr) &&
      (h.conteudo?.horaIni||'') === horaIni
    ) : null;

    const status = (!pacNome||!dataStr) ? 'err'
                 : !pac                  ? 'warn_pac'
                 : dup                   ? 'dup'
                 : 'ok';

    result.push({ rowIdx, pacNome, dataStr, dataISO, horaIni, horaFim,
      durStr, convNome, semana, presenca, evoTxt, regStr,
      pac, appt, dup, status });
  });

  return result;
}

function abrirImportarEvolucoes() {
  if (!historicoAtualPacId) { showToast('Selecione um paciente primeiro','error'); return; }
  openModal('modal-importar-evolucoes');
  const pac = PACIENTES.find(x=>x.id===historicoAtualPacId);
  const sub = document.getElementById('evo-imp-subtitle');
  if (sub) sub.textContent = pac ? 'Paciente selecionado: ' + pac.nome : 'Selecione o arquivo CSV';
  const paste = document.getElementById('evo-imp-paste');
  if (paste) paste.value = '';
  const pr = document.getElementById('evo-imp-parse-result');
  if (pr) pr.style.display = 'none';
  const s1 = document.getElementById('evo-imp-step-1');
  const s2 = document.getElementById('evo-imp-step-2');
  const bp = document.getElementById('evo-imp-btn-preview');
  const bc = document.getElementById('evo-imp-btn-confirmar');
  if (s1) s1.style.display = 'block';
  if (s2) s2.style.display = 'none';
  if (bp) bp.style.display = 'inline-flex';
  if (bc) bc.style.display = 'none';
  window._evoParsed = null;
}

function handleEvoFileSelect(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const paste = document.getElementById('evo-imp-paste');
    if (paste) paste.value = e.target.result;
    const pr = document.getElementById('evo-imp-parse-result');
    if (pr) { pr.style.display='block'; pr.innerHTML='<span style="color:var(--success);font-size:12px">✓ Arquivo: <strong>'+file.name+'</strong></span>'; }
  };
  reader.readAsText(file, 'UTF-8');
}

function evoImpVoltarStep1() {
  const s1=document.getElementById('evo-imp-step-1');
  const s2=document.getElementById('evo-imp-step-2');
  const bp=document.getElementById('evo-imp-btn-preview');
  const bc=document.getElementById('evo-imp-btn-confirmar');
  if(s1)s1.style.display='block'; if(s2)s2.style.display='none';
  if(bp)bp.style.display='inline-flex'; if(bc)bc.style.display='none';
  window._evoParsed=null;
}

function evoImpPreview() {
  const txt = (document.getElementById('evo-imp-paste')?.value||'').trim();
  if (!txt) { showToast('Cole o CSV ou selecione um arquivo','error'); return; }

  let parsed;
  try { parsed = parseEvolucaoCSV(txt); }
  catch(e) { showToast('Erro ao ler CSV: '+e.message,'error'); return; }

  if (!parsed.length) { showToast('Nenhuma linha válida encontrada','error'); return; }

  // No contexto do histórico filtra apenas o paciente selecionado
  if (historicoAtualPacId) {
    const pacAtual = PACIENTES.find(x=>x.id===historicoAtualPacId);
    if (pacAtual) {
      parsed = parsed.filter(r => {
        if (!r.pacNome) return false;
        const tCSV = r.pacNome.toLowerCase().split(/\s+/).filter(t=>t.length>1);
        const tPac = pacAtual.nome.toLowerCase().split(/\s+/).filter(t=>t.length>1);
        return tCSV.every(t=>pacAtual.nome.toLowerCase().includes(t)) ||
               tPac.every(t=>r.pacNome.toLowerCase().includes(t));
      });
    }
  }

  if (!parsed.length) { showToast('Nenhuma linha corresponde ao paciente selecionado','error'); return; }
  window._evoParsed = parsed;

  const ok   = parsed.filter(r=>r.status==='ok').length;
  const dup  = parsed.filter(r=>r.status==='dup').length;
  const warn = parsed.filter(r=>r.status==='warn_pac').length;

  const sumEl = document.getElementById('evo-imp-preview-summary');
  if (sumEl) sumEl.textContent = parsed.length+' linha(s) analisada(s)';
  const okEl=document.getElementById('evo-imp-cnt-ok');
  const skEl=document.getElementById('evo-imp-cnt-skip');
  const dpEl=document.getElementById('evo-imp-cnt-dup');
  if(okEl) okEl.textContent = ok   ? '✓ '+ok+' para importar'             : '';
  if(skEl) skEl.textContent = warn ? '⚠ '+warn+' paciente não localizado'  : '';
  if(dpEl) dpEl.textContent = dup  ? '⊘ '+dup+' já existente(s) — serão ignoradas' : '';

  const tbody = document.getElementById('evo-imp-preview-tbody');
  if (tbody) tbody.innerHTML = parsed.map(r => {
    const pi = evoPresencaInfo(r.presenca);
    const ico = r.status==='ok'       ? '<span style="color:var(--success)">✓</span>'
              : r.status==='dup'      ? '<span style="color:var(--text-muted)" title="Já importado">⊘</span>'
              : r.status==='warn_pac' ? '<span style="color:var(--warning)" title="Paciente não localizado">⚠</span>'
              : '<span style="color:var(--danger)">✗</span>';
    const dateFmt = r.dataISO ? r.dataISO.split('-').reverse().join('/') : r.dataStr;
    const prev = (r.evoTxt||'').substring(0,55)+(r.evoTxt?.length>55?'…':'') || '<em style="color:var(--text-muted)">sem texto</em>';
    const rowStyle = r.status==='dup' ? 'opacity:0.4' : r.status!=='ok' ? 'background:rgba(251,191,36,0.06)' : '';
    return '<tr style="'+rowStyle+'">' +
      '<td style="text-align:center;width:28px">'+ico+'</td>' +
      '<td style="font-size:12px;white-space:nowrap">'+dateFmt+'</td>' +
      '<td style="font-size:12px">'+(r.pac ? r.pac.nome : '<span style="color:var(--warning)">'+r.pacNome+'</span>')+'</td>' +
      '<td style="font-size:12px;white-space:nowrap">'+(r.horaIni||'—')+(r.horaFim?' – '+r.horaFim:'')+'</td>' +
      '<td style="font-size:11px"><span class="chip '+pi.chip+'" style="font-size:10px">'+(r.presenca||'—')+'</span></td>' +
      '<td style="font-size:11px;color:var(--text-secondary)">'+prev+'</td>' +
    '</tr>';
  }).join('');

  const s1=document.getElementById('evo-imp-step-1');
  const s2=document.getElementById('evo-imp-step-2');
  const bp=document.getElementById('evo-imp-btn-preview');
  const bc=document.getElementById('evo-imp-btn-confirmar');
  if(s1)s1.style.display='none'; if(s2)s2.style.display='block';
  if(bp)bp.style.display='none';
  if(bc){ bc.style.display = ok>0?'inline-flex':'none'; }
  const cntEl=document.getElementById('evo-imp-btn-cnt');
  if(cntEl) cntEl.textContent = ok>0?'('+ok+')':'';
}

async function evoImpConfirmar() {
  const parsed = window._evoParsed;
  if (!parsed) { showToast('Execute a pré-visualização primeiro','error'); return; }
  const toImport = parsed.filter(r=>r.status==='ok');
  if (!toImport.length) { showToast('Nenhuma evolução nova para importar','error'); return; }

  const btn = document.getElementById('evo-imp-btn-confirmar');
  if (btn) { btn.disabled=true; btn.textContent='Importando...'; }

  // Reutiliza singleton para evitar múltiplos GoTrueClient
  const sb = window._cfGetDb ? window._cfGetDb() : null;
  if (!sb) { console.warn('[Import] Supabase não inicializado.'); }

  let importados=0, dbErrors=0;

  for (const r of toImport) {
    const pac = r.pac;
    if (!pac) continue;

    const pi = evoPresencaInfo(r.presenca);
    const dateFmt = r.dataISO ? r.dataISO.split('-').reverse().join('/') : r.dataStr;
    const titulo = pi.icon + ' Sessão — ' + dateFmt +
      (r.horaIni ? ' · ' + r.horaIni : '') +
      (r.semana  ? ' · ' + r.semana  : '');

    const hObj = {
      id: nextHistId++, pacId: pac.id, tipo: 'evolucao', titulo,
      conteudo: {
        texto:    r.evoTxt   || '',
        presenca: r.presenca || '',
        horaIni:  r.horaIni  || '',
        horaFim:  r.horaFim  || '',
        duracao:  r.durStr   || '',
        convenio: r.convNome || '',
        semana:   r.semana   || '',
      },
      profId: r.appt?.profId || 0,
      data:   r.dataISO || r.dataStr,
      fonte:  'Google Sheets',
      apptId: r.appt?.id || null,
    };

    if (sb) {
      try {
        const { data: row, error } = await sb.from('historico').insert([{
          pac_id: hObj.pacId, tipo:'evolucao', titulo: hObj.titulo,
          conteudo: hObj.conteudo, prof_id: hObj.profId||null,
          data: hObj.data, fonte:'Google Sheets',
        }]).select('id').single();
        if (error) { console.error('[evoImpConfirmar]', error.message); dbErrors++; }
        else if (row) hObj.id = row.id;
      } catch(e) { console.error('[evoImpConfirmar]', e); dbErrors++; }
    }

    HISTORICO.push(hObj);

    // Atualiza status do agendamento vinculado
    if (r.appt && pi.status && r.appt.status !== pi.status) {
      r.appt.status = pi.status;
      if (sb) sb.from('agendamentos').update({ status: pi.status }).eq('id', r.appt.id);
    }
    importados++;
  }

  if (btn) { btn.disabled=false; btn.textContent='Importar'; }

  const msg = importados+' evolução(ões) importada(s)' +
    (sb && !dbErrors ? ' · ✓ gravado no banco' :
     sb && dbErrors  ? ' · ⚠ '+dbErrors+' erro(s) no banco' :
     ' · ⚠ apenas memória');
  showToast(msg, importados>0?'success':'error');

  if (importados>0) {
    setTimeout(()=>{
      closeModal('modal-importar-evolucoes');
      refreshUI();
    }, 500);
  }
}

// ─── Alias para compatibilidade com o módulo central ─────────────────────────
function importarEvolucoes() { evoImpPreview(); }



// Kosmos anamnese sections definition
const ANAM_SECTIONS = {
  '1. Identificação':     ['Nome completo do paciente','Data de Nascimento','Sexo','Cidade de nascimento','Escola','Ano escolar','Idade'],
  '2. Família':           ['Nome completo do Pai','Profissão do Pai','Idade do Pai','Nome completo da Mãe','Profissão da Mãe','Idade da Mãe','Com quem a criança reside?','Possui irmãos?'],
  '3. Queixa Principal':  ['3.1 — Queixa principal e há quanto tempo','3.2 — Outras queixas','Quem indicou a avaliação?','Nome de quem indicou (se aplicável)','Especialidade de quem indicou (se aplicável)'],
  '4. Gestação/Nascimento':['4.1.1 — A gravidez foi planejada?','4.2.2 — Teve intercorrências durante a gestação?','4.2.6 — Duração da gestação (em semanas)','4.3.3 — Tipo de parto','4.4.1 — Ocorreu alguma das intercorrências abaixo?'],
  '5. Desenvolvimento':   ['5.1.2 — Como é o sono atualmente?','5.2.2 — Como é a alimentação atualmente?','5.3.1.1 — Rolamento (em meses)','5.3.1.2 — Engatinhar (em meses)','5.3.1.3 — Primeiros passos (em meses)','5.3.1.4 — Desenvolvimento de habilidades [Fala]'],
  '6. Percurso Escolar':  ['6.1 — Descrição geral do percurso escolar','6.1.4 — Dificuldades persistentes de leitura, escrita ou cálculo?','6.1.5 — Dificuldade em manter a atenção nas aulas?'],
  '7. Saúde/Neurologia':  ['7.2 — Teve convulsões ou crises epilépticas?','7.9 — Usa/usou medicamentos controlados por distúrbios neurológicos?'],
  '8. Linguagem':         ['Primeiras palavras (em meses)','Frases simples (em meses)','Apresentou atraso na fala?','Observações sobre a linguagem'],
  '9. Comportamento':     ['Observações sobre aspectos sociais','Observações sobre manipulações e hábitos','Breve descrição da rotina da criança'],
};

function renderAnamnese() {
  const el = document.getElementById('hist-anamnese-content');
  if (!el) return;
  const anams = HISTORICO.filter(h=>h.pacId===historicoAtualPacId&&h.tipo==='anamnese')
    .sort((a,b)=>(b.data||'').localeCompare(a.data||''));
  if (!anams.length) {
    el.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text-muted)">Nenhuma anamnese importada.<br><button class="btn-sm btn-secondary" style="margin-top:12px" onclick="abrirImportarAnamnese()">📋 Importar anamnese (Google Forms)</button></div>';
    return;
  }
  el.innerHTML = anams.map(a => {
    const campos = a.conteudo || {};
    let sectionsHTML = '';
    // Render by sections
    Object.entries(ANAM_SECTIONS).forEach(([secName, keys]) => {
      const rows = keys
        .filter(k => campos[k])
        .map(k=>'<tr><td style="font-weight:500;color:var(--text-secondary);padding:5px 10px;font-size:12px;white-space:nowrap;vertical-align:top;width:45%">'+k.replace(/^\d+\.\d*[\d.]* — /,'')+'</td><td style="padding:5px 10px;font-size:12px">'+campos[k]+'</td></tr>').join('');
      if (!rows) return;
      sectionsHTML += '<div style="margin-bottom:12px"><div style="font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:0.5px;padding:6px 10px;background:var(--bg-overlay)">'+secName+'</div><table style="width:100%;border-collapse:collapse">'+rows+'</table></div>';
    });
    // Any remaining fields not in sections
    const coveredKeys = new Set(Object.values(ANAM_SECTIONS).flat());
    const extraRows = Object.entries(campos).filter(([k])=>!coveredKeys.has(k))
      .map(([k,v])=>'<tr><td style="font-weight:500;color:var(--text-secondary);padding:5px 10px;font-size:11px;vertical-align:top">'+k+'</td><td style="padding:5px 10px;font-size:11px">'+v+'</td></tr>').join('');
    if (extraRows) sectionsHTML += '<div style="margin-bottom:12px"><div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;padding:6px 10px;background:var(--bg-overlay)">Outros campos</div><table style="width:100%;border-collapse:collapse">'+extraRows+'</table></div>';

    return '<div style="background:var(--bg-raised);border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden;margin-bottom:16px">' +
      '<div style="padding:10px 14px;background:var(--bg-overlay);display:flex;align-items:center;justify-content:space-between">' +
        '<div style="font-weight:600">📋 '+(a.titulo||'Anamnese')+' — '+(a.data?a.data.split('-').reverse().join('/'):'')+' <span style="font-size:11px;color:var(--text-muted)">('+Object.keys(campos).length+' campos)</span></div>' +
        '<div style="display:flex;gap:6px"><span class="chip blue" style="font-size:10px">'+( a.fonte||'Manual')+'</span>' +
        '<button class="action-btn" style="color:var(--danger)" onclick="excluirHistorico('+a.id+')">'+DEL_ICON+'</button></div>' +
      '</div>' +
      sectionsHTML +
    '</div>';
  }).join('');
}

function renderProntuarioCompleto() {
  const el = document.getElementById('hist-completo-content');
  if (!el || !historicoAtualPacId) return;
  const p = PACIENTES.find(x=>x.id===historicoAtualPacId);
  if (!p) return;
  const appts = APPOINTMENTS.filter(a=>a.paciente===p.nome).sort((a,b)=>(b.dataISO||'').localeCompare(a.dataISO||''));
  el.innerHTML = '<div style="margin-bottom:20px"><h3 style="font-size:14px;font-weight:600;margin-bottom:10px">Dados cadastrais</h3>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:13px">' +
    '<div><span style="color:var(--text-muted)">Nome: </span>'+p.nome+'</div>' +
    '<div><span style="color:var(--text-muted)">CPF: </span>'+(p.cpf||'—')+'</div>' +
    '<div><span style="color:var(--text-muted)">Nasc: </span>'+(p.nasc?p.nasc.split('-').reverse().join('/'):'—')+'</div>' +
    '<div><span style="color:var(--text-muted)">Telefone: </span>'+(p.tel||'—')+'</div>' +
    '<div><span style="color:var(--text-muted)">Plano: </span>'+(p.plano||'—')+'</div>' +
    '<div><span style="color:var(--text-muted)">Carteirinha: </span>'+(p.carteirinha||'—')+'</div>' +
    '</div></div>' +
    '<h3 style="font-size:14px;font-weight:600;margin-bottom:10px">Todos os agendamentos ('+appts.length+')</h3>' +
    '<table class="data-table" style="margin-bottom:0"><thead><tr><th>Data</th><th>Hora</th><th>Profissional</th><th>Plano</th><th>Status</th></tr></thead><tbody>' +
    appts.map(a => {
      const prof = PROFISSIONAIS.find(pr=>pr.id===a.profId);
      return '<tr><td>'+(a.dataISO?a.dataISO.split('-').reverse().join('/'):'—')+'</td>' +
        '<td>'+a.hora+'</td><td>'+(prof?prof.nome:'—')+'</td>' +
        '<td>'+a.plano+'</td>' +
        '<td><span class="chip '+(a.status==='atendido'?'green':a.status==='cancelado'?'gray':a.status==='confirmado'?'purple':a.status==='chegou'?'yellow':a.status==='desmarcado'?'red':'blue')+'" style="font-size:10px">'+a.status+'</span></td></tr>';
    }).join('') +
    '</tbody></table>';
}

function novaEvolucao() {
  if (!historicoAtualPacId) { showToast('Selecione um paciente primeiro','error'); return; }
  const p = PACIENTES.find(x=>x.id===historicoAtualPacId);
  openModal('modal-evolucao');
  document.getElementById('evo-pac-nome').textContent = p?.nome || '';
  document.getElementById('evo-data').valueAsDate = new Date();
  document.getElementById('evo-titulo').value = '';
  document.getElementById('evo-texto').value  = '';
  document.getElementById('evo-prof').innerHTML = PROFISSIONAIS.filter(p=>p.status!=='Inativo')
    .map(p=>'<option value="'+p.id+'">'+p.nome+'</option>').join('');
  document.getElementById('evo-id-edit').value = '';
}

function salvarEvolucao() {
  const titulo = document.getElementById('evo-titulo').value.trim();
  const texto  = document.getElementById('evo-texto').value.trim();
  const profId = parseInt(document.getElementById('evo-prof').value||'0');
  const data   = document.getElementById('evo-data').value;
  if (!texto) { showToast('Digite o texto da evolução','error'); return; }
  const editId = document.getElementById('evo-id-edit').value;
  if (editId) {
    const h = HISTORICO.find(x=>x.id===parseInt(editId));
    if (h) { h.titulo=titulo||'Evolução'; h.conteudo={texto}; h.profId=profId; h.data=data; }
    showToast('Evolução atualizada!','success');
  } else {
    HISTORICO.push({ id:nextHistId++, pacId:historicoAtualPacId, tipo:'evolucao', titulo:titulo||'Evolução',
      conteudo:{texto}, profId, data, fonte:'Manual' });
    // Also update appointment for this date if exists
    const pac = PACIENTES.find(x=>x.id===historicoAtualPacId);
    if (pac) {
      const appt = APPOINTMENTS.find(a=>a.paciente===pac.nome&&a.dataISO===data&&a.status!=='cancelado');
      if (appt && appt.status!=='atendido') { appt.status='atendido'; renderDayView(); }
    }
    showToast('Evolução registrada!','success');
  }
  closeModal('modal-evolucao');
  histTab('evolucoes', document.getElementById('htab-evolucoes'));
}

function editarHistorico(id) {
  const h = HISTORICO.find(x=>x.id===id);
  if (!h || h.tipo!=='evolucao') return;
  openModal('modal-evolucao');
  const p = PACIENTES.find(x=>x.id===h.pacId);
  document.getElementById('evo-pac-nome').textContent = p?.nome||'';
  document.getElementById('evo-data').value   = h.data||'';
  document.getElementById('evo-titulo').value = h.titulo||'';
  document.getElementById('evo-texto').value  = h.conteudo?.texto||'';
  document.getElementById('evo-prof').innerHTML = PROFISSIONAIS.filter(p=>p.status!=='Inativo')
    .map(p=>'<option value="'+p.id+'" '+(p.id===h.profId?'selected':'')+'>'+p.nome+'</option>').join('');
  document.getElementById('evo-id-edit').value = id;
}

// ── Importar Anamnese ────────────────────────────────────────────────────────
function abrirImportarAnamnese() {
  if (!historicoAtualPacId) { showToast('Selecione um paciente primeiro','error'); return; }
  openModal('modal-importar-anamnese');
  document.getElementById('anam-csv-paste').value = '';
  document.getElementById('anam-result').innerHTML = '';
}

function parseCSVLines(text) {
  if (text.charCodeAt(0)===0xFEFF) text=text.slice(1);
  const lines=[];
  let cur='', inQ=false;
  // parse cell-by-cell to handle quoted newlines
  const rows=[];
  let row=[];
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(ch==='"'){ inQ=!inQ; }
    else if(ch===','&&!inQ){ row.push(cur.trim()); cur=''; }
    else if((ch==='\n'||ch==='\r')&&!inQ){
      if(ch==='\r'&&text[i+1]==='\n') i++;
      row.push(cur.trim()); rows.push(row); row=[]; cur='';
    } else cur+=ch;
  }
  if(cur||row.length){ row.push(cur.trim()); rows.push(row); }
  return rows.filter(r=>r.some(c=>c));
}

function importarAnamnese() {
  const csvText = document.getElementById('anam-csv-paste')?.value.trim();
  const fileInput = document.getElementById('anam-file-input');
  if (!csvText) { showToast('Cole o CSV ou selecione um arquivo','error'); return; }
  processarCSVAnamnese(csvText);
}

function processarCSVAnamnese(csvText) {
  try {
    const rows    = parseCSVLines(csvText);
    if (rows.length < 2) { showToast('Arquivo sem dados','error'); return; }
    const headers = rows[0];
    const nomeIdx = headers.findIndex(h=>h.toLowerCase().includes('nome completo do paciente')||h.toLowerCase().includes('nome do paciente'));
    let importados=0, erros=0;
    const resultLines=[];

    for(let i=1;i<rows.length;i++){
      const cells=rows[i];
      const conteudo={};
      headers.forEach((h,j)=>{ if(cells[j]&&cells[j].trim()) conteudo[h]=cells[j].trim(); });

      // Try to match to patient using full name tokens
      const nomePac = nomeIdx>=0 ? (cells[nomeIdx]||'').trim() : '';
      let pac = null;
      if(nomePac){
        pac = encontrarPacientePorNome(nomePac);
      }
      // If specific patient selected and no match, still import to selected patient
      if(!pac && historicoAtualPacId) pac=PACIENTES.find(x=>x.id===historicoAtualPacId);

      if(pac){
        // Remove duplicate anamnese for same patient+date
        const data=new Date().toISOString().slice(0,10);
        HISTORICO.push({id:nextHistId++, pacId:pac.id, tipo:'anamnese',
          titulo:'Anamnese Infantil Kosmos — '+nomePac, conteudo, data, fonte:'Google Forms',
          nomePac});
        resultLines.push('<div style="color:var(--success);padding:2px 0">✓ '+nomePac+' → '+pac.nome+'</div>');
        importados++;
      } else {
        resultLines.push('<div style="color:var(--warning);padding:2px 0">⚠ Paciente não encontrado: '+nomePac+'</div>');
        erros++;
      }
    }

    const resEl=document.getElementById('anam-result');
    if(resEl) resEl.innerHTML='<div style="margin-top:8px;max-height:160px;overflow-y:auto;font-size:12px">'+
      resultLines.join('')+'</div>'+
      '<div style="font-weight:600;margin-top:8px;font-size:13px">'+importados+' anamnese(s) importada(s)'+(erros?' · '+erros+' não encontrado(s)':'')+
      (erros?'<br><span style="font-size:11px;color:var(--text-muted)">Cadastre os pacientes e reimporte.</span>':'')+'</div>';
    showToast(importados+' anamnese(s) importada(s)!','success');
    if(importados>0) setTimeout(()=>{ closeModal('modal-importar-anamnese'); histTab('anamnese',document.getElementById('htab-anamnese')); },1200);
  } catch(e){ showToast('Erro: '+e.message,'error'); }
}

function handleAnamFileSelect(input){
  const file=input.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{ document.getElementById('anam-csv-paste').value=e.target.result; };
  reader.readAsText(file,'UTF-8');
}

// ── APPOINTMENTS → HISTORICO auto-feed ──────────────────────────────────────
function registrarAtendimento(apptId) {
  const appt = APPOINTMENTS.find(a=>a.id===apptId);
  if (!appt) return;
  const pac = PACIENTES.find(p=>p.nome===appt.paciente);
  if (!pac) return;
  const already = HISTORICO.find(h=>h.tipo==='agendamento'&&h.fonte===String(apptId));
  if (already) return;
  HISTORICO.push({
    id: nextHistId++, pacId: pac.id, tipo:'agendamento',
    titulo: appt.hora+' — '+appt.plano,
    conteudo: { obs:appt.obs||'', status:appt.status },
    profId: appt.profId, data: appt.dataISO||'',
    status: appt.status, fonte: String(apptId),
  });
}

