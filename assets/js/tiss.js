// ═══════════════════════════════════════
//  SADT PROCEDURES
// ═══════════════════════════════════════
function addProcRow() {
  const idx = procRowCount++;
  const row = document.createElement('div');
  row.className = 'sadt-proc-row';
  row.dataset.idx = idx;
  row.style.cssText = 'display:grid;grid-template-columns:50px 100px 1fr 80px 80px 36px;gap:0;border-top:1px solid var(--border);padding:4px 8px;align-items:center';
  row.innerHTML = `
    <input class="form-input" style="padding:4px 6px;font-size:12px" placeholder="22" id="sadt-proc-tab-${idx}">
    <input class="form-input" style="padding:4px 6px;font-size:12px;font-family:var(--font-mono)" placeholder="50000470" oninput="lookupTuss(this)" id="sadt-proc-cod-${idx}">
    <input class="form-input" style="padding:4px 6px;font-size:12px" placeholder="Descrição do procedimento" id="sadt-proc-desc-${idx}">
    <input class="form-input" style="padding:4px 6px;font-size:12px;text-align:center" type="number" value="1" min="1" id="sadt-proc-qtd-${idx}">
    <input class="form-input" style="padding:4px 6px;font-size:12px;text-align:center" type="number" value="1" min="1" id="sadt-proc-qtaut-${idx}">
    <button style="padding:6px;background:none;color:var(--text-muted);font-size:14px" onclick="removeProcRow(this)" title="Remover">✕</button>`;
  document.getElementById('sadt-procs-list').appendChild(row);
}

function removeProcRow(btn) {
  const rows = document.querySelectorAll('.sadt-proc-row');
  if (rows.length > 1) { btn.closest('.sadt-proc-row').remove(); recalcTotal(); }
  else showToast('Deve haver ao menos um procedimento','error');
}

function lookupTuss(input) {
  const code = input.value.trim();
  const found = TUSS_TABLE[code];
  if (!found) return;
  const row  = input.closest('.sadt-proc-row');
  const idx  = row.dataset.idx;
  const descEl = document.getElementById(`sadt-proc-desc-${idx}`);
  if (descEl) descEl.value = found.desc;
  // also pre-fill exec proc if empty
  const epDesc = document.getElementById(`sadt-ep-desc-0`);
  const epVal  = document.getElementById(`sadt-ep-val-0`);
  const epCod  = document.getElementById(`sadt-ep-cod-0`);
  if (epDesc && !epDesc.value) { epDesc.value = found.desc; }
  if (epCod  && !epCod.value)  { epCod.value  = code; }
  if (epVal  && !epVal.value)  { epVal.value  = `R$ ${found.valor.toFixed(2).replace('.',',')}`; recalcTotal(); }
}

function recalcTotal() {
  // Soma APENAS os valores dos procedimentos executados (sadt-exec-proc-row)
  // Evita duplicação não somando também os procedimentos solicitados
  let total = 0;
  const execRows = document.querySelectorAll('.sadt-exec-proc-row');
  if (execRows.length > 0) {
    execRows.forEach(row => {
      const idx = row.dataset.eidx;
      const valEl = document.getElementById(`sadt-ep-val-${idx}`);
      const qtdEl = document.getElementById(`sadt-ep-qtd-${idx}`);
      if (!valEl || !valEl.value) return;
      const raw = valEl.value.replace(/[R$\s.]/g,'').replace(',','.');
      const qtd = qtdEl ? parseInt(qtdEl.value)||1 : 1;
      total += (parseFloat(raw)||0) * qtd;
    });
  } else {
    // fallback: usa proc solicitados se não houver executados
    document.querySelectorAll('.sadt-proc-row').forEach(row => {
      const idx = row.dataset.idx;
      const valEl = document.getElementById(`sadt-proc-val-${idx}`);
      const qtdEl = document.getElementById(`sadt-proc-qtd-${idx}`);
      if (!valEl || !valEl.value) return;
      const raw = valEl.value.replace(/[R$\s.]/g,'').replace(',','.');
      const qtd = qtdEl ? parseInt(qtdEl.value)||1 : 1;
      total += (parseFloat(raw)||0) * qtd;
    });
  }
  const totProcEl = document.getElementById('sadt-tot-proc');
  if (totProcEl) totProcEl.value = formatBRL(total);
  const totalEl = document.getElementById('sadt-total');
  if (totalEl) totalEl.textContent = `R$ ${formatBRL(total)}`;
}

// ═══════════════════════════════════════
//  LOGOS SVG DOS PLANOS (inline, sem dependência externa)
// ═══════════════════════════════════════
const PLANO_LOGOS = {
  'SulAmérica': `<svg width="130" height="36" viewBox="0 0 130 36" xmlns="http://www.w3.org/2000/svg">
    <rect width="130" height="36" rx="4" fill="#E8002D"/>
    <text x="8" y="24" font-family="Arial,sans-serif" font-size="15" font-weight="bold" fill="white" letter-spacing="0.5">SulAmérica</text>
    <rect x="8" y="27" width="90" height="2" fill="white" opacity="0.6"/>
    <text x="8" y="34" font-family="Arial,sans-serif" font-size="7" fill="white" opacity="0.8">SAÚDE</text>
  </svg>`,
  'Unimed': `<svg width="130" height="36" viewBox="0 0 130 36" xmlns="http://www.w3.org/2000/svg">
    <rect width="130" height="36" rx="4" fill="#00A859"/>
    <text x="8" y="25" font-family="Arial,sans-serif" font-size="20" font-weight="bold" fill="white">Unimed</text>
    <text x="8" y="34" font-family="Arial,sans-serif" font-size="7" fill="white" opacity="0.8">COOPERATIVA MÉDICA</text>
  </svg>`,
  'Amil': `<svg width="130" height="36" viewBox="0 0 130 36" xmlns="http://www.w3.org/2000/svg">
    <rect width="130" height="36" rx="4" fill="#003399"/>
    <text x="8" y="25" font-family="Arial,sans-serif" font-size="22" font-weight="bold" fill="white" letter-spacing="1">amil</text>
    <text x="58" y="25" font-family="Arial,sans-serif" font-size="9" fill="#00AAFF">®</text>
    <text x="8" y="34" font-family="Arial,sans-serif" font-size="7" fill="white" opacity="0.7">PLANOS DE SAÚDE</text>
  </svg>`,
  'Bradesco': `<svg width="130" height="36" viewBox="0 0 130 36" xmlns="http://www.w3.org/2000/svg">
    <rect width="130" height="36" rx="4" fill="#CC0000"/>
    <text x="8" y="24" font-family="Arial,sans-serif" font-size="14" font-weight="bold" fill="white">Bradesco</text>
    <text x="8" y="34" font-family="Arial,sans-serif" font-size="7.5" fill="white" opacity="0.85">SAÚDE</text>
  </svg>`,
  'default': `<svg width="130" height="36" viewBox="0 0 130 36" xmlns="http://www.w3.org/2000/svg">
    <rect width="130" height="36" rx="4" fill="#1e3a6e"/>
    <text x="8" y="24" font-family="Arial,sans-serif" font-size="13" font-weight="bold" fill="white">Plano de Saúde</text>
  </svg>`,
};

// ═══════════════════════════════════════
//  EXEC PROCS ROWS
// ═══════════════════════════════════════
let execProcCount = 1;
function addExecProcRow() {
  const idx = execProcCount++;
  const row = document.createElement('div');
  row.className = 'sadt-exec-proc-row';
  row.dataset.eidx = idx;
  row.style.cssText = 'display:grid;grid-template-columns:30px 90px 80px 50px 100px 1fr 50px 50px 50px 70px 90px 36px;gap:0;border-top:1px solid var(--border);padding:3px 6px;align-items:center';
  row.innerHTML = `
    <span style="font-size:11px;color:var(--text-muted);text-align:center">${idx+1}</span>
    <input class="form-input" style="padding:3px 5px;font-size:11px" type="date" id="sadt-ep-dtini-${idx}">
    <input class="form-input" style="padding:3px 5px;font-size:11px" type="date" id="sadt-ep-dtfim-${idx}">
    <input class="form-input" style="padding:3px 5px;font-size:11px;text-align:center" placeholder="22" id="sadt-ep-tab-${idx}">
    <input class="form-input" style="padding:3px 5px;font-size:11px;font-family:var(--font-mono)" placeholder="50000470" id="sadt-ep-cod-${idx}" oninput="lookupTussExec(this)">
    <input class="form-input" style="padding:3px 5px;font-size:11px" placeholder="Descrição" id="sadt-ep-desc-${idx}">
    <input class="form-input" style="padding:3px 5px;font-size:11px;text-align:center" type="number" value="1" id="sadt-ep-qtd-${idx}">
    <input class="form-input" style="padding:3px 5px;font-size:11px;text-align:center" placeholder="00" id="sadt-ep-via-${idx}">
    <input class="form-input" style="padding:3px 5px;font-size:11px;text-align:center" placeholder="00" id="sadt-ep-tec-${idx}">
    <input class="form-input" style="padding:3px 5px;font-size:11px;text-align:right" placeholder="1" id="sadt-ep-fat-${idx}">
    <input class="form-input" style="padding:3px 5px;font-size:11px;text-align:right" placeholder="R$ 0,00" id="sadt-ep-val-${idx}" oninput="recalcTotal()">
    <button style="padding:5px;background:none;color:var(--text-muted);font-size:13px" onclick="removeExecProcRow(this)">✕</button>`;
  document.getElementById('sadt-exec-procs-list').appendChild(row);
}
function removeExecProcRow(btn) {
  const rows = document.querySelectorAll('.sadt-exec-proc-row');
  if (rows.length > 1) { btn.closest('.sadt-exec-proc-row').remove(); recalcTotal(); }
  else showToast('Deve haver ao menos um procedimento realizado','error');
}
function lookupTussExec(input) {
  const code = input.value.trim();
  if (!code) return;
  const row  = input.closest('.sadt-exec-proc-row');
  const idx  = row?.dataset.eidx;
  const descEl = document.getElementById(`sadt-ep-desc-${idx}`);
  const valEl  = document.getElementById(`sadt-ep-val-${idx}`);
  // Busca valor pelo plano do paciente atual (mais preciso que TUSS_TABLE genérico)
  const planoId = parseInt(document.getElementById('ag-plano')?.value || '0');
  const procMatch = PROCEDIMENTOS.find(p =>
    p.codigo === code && (p.planoId === planoId || p.planoId === 0)
  ) || PROCEDIMENTOS.find(p => p.codigo === code)
    || (TUSS_TABLE[code] ? { desc: TUSS_TABLE[code].desc, valPlano: TUSS_TABLE[code].valor } : null);
  if (!procMatch) return;
  const desc = procMatch.desc || procMatch.descricao || '';
  const val  = planoId
    ? (procMatch.valPlano || procMatch.valPart || procMatch.valPlano || 0)
    : (procMatch.valPart  || procMatch.valPlano || 0);
  if (descEl) descEl.value = desc;
  if (valEl && val > 0) { valEl.value = val.toFixed(2).replace('.', ','); recalcTotal(); }
}

// ═══════════════════════════════════════
//  IMPRIMIR GUIA SADT — padrão TISS 4.02.00 + logo plano
// ═══════════════════════════════════════
function coletarDadosGuia() {
  // Procedimentos solicitados
  const procs = [];
  document.querySelectorAll('.sadt-proc-row').forEach(row => {
    const idx  = row.dataset.idx;
    const cod  = document.getElementById(`sadt-proc-cod-${idx}`);
    const desc = document.getElementById(`sadt-proc-desc-${idx}`);
    const qtd  = document.getElementById(`sadt-proc-qtd-${idx}`);
    const qtaut= document.getElementById(`sadt-proc-qtaut-${idx}`);
    const tab  = document.getElementById(`sadt-proc-tab-${idx}`);
    if (!desc) return;
    procs.push({
      tabela: tab?.value || '22',
      codigo: cod?.value || '—',
      desc:   desc.value || '—',
      qtd:    parseInt(qtd?.value||1)||1,
      qtaut:  parseInt(qtaut?.value||1)||1,
    });
  });

  // Procedimentos executados
  const execProcs = [];
  document.querySelectorAll('.sadt-exec-proc-row').forEach(row => {
    const idx = row.dataset.eidx;
    const cod  = document.getElementById(`sadt-ep-cod-${idx}`);
    const desc = document.getElementById(`sadt-ep-desc-${idx}`);
    const dtini= document.getElementById(`sadt-ep-dtini-${idx}`);
    const dtfim= document.getElementById(`sadt-ep-dtfim-${idx}`);
    const tab  = document.getElementById(`sadt-ep-tab-${idx}`);
    const qtd  = document.getElementById(`sadt-ep-qtd-${idx}`);
    const via  = document.getElementById(`sadt-ep-via-${idx}`);
    const tec  = document.getElementById(`sadt-ep-tec-${idx}`);
    const fat  = document.getElementById(`sadt-ep-fat-${idx}`);
    const val  = document.getElementById(`sadt-ep-val-${idx}`);
    if (!desc) return;
    const valNum = parseFloat((val?.value||'0').replace(/[R$\s]/g,'').replace(',','.')) || 0;
    const qtdNum = parseInt(qtd?.value||1)||1;
    execProcs.push({
      dtini:  dtini?.value || '',
      dtfim:  dtfim?.value || '',
      tabela: tab?.value   || '22',
      codigo: cod?.value   || '—',
      desc:   desc.value   || '—',
      qtd:    qtdNum,
      via:    via?.value   || '00',
      tec:    tec?.value   || '00',
      fat:    fat?.value   || '1',
      valor:  valNum,
      total:  valNum * qtdNum,
    });
  });

  const totalProc = execProcs.reduce((s,p) => s+p.total, 0);
  const gId = 'G' + Date.now().toString().slice(-8);

  // Atualiza campo display
  const dispEl = document.getElementById('sadt-guia-num-display');
  if (dispEl) dispEl.textContent = gId;

  return {
    guiaNum:       gId,
    // Cabeçalho
    ans:           document.getElementById('sadt-ans')?.value            || '—',
    guiaPrincipal: document.getElementById('sadt-guia-principal')?.value || '—',
    guiaPrestador: gId,
    operadora:     document.getElementById('sadt-operadora')?.value      || '—',
    dtAutorizacao: document.getElementById('sadt-dt-autorizacao')?.value || '',
    senha:         document.getElementById('sadt-senha')?.value          || '—',
    valSenha:      document.getElementById('sadt-val-senha')?.value      || '',
    autorizacao:   document.getElementById('sadt-autorizacao')?.value    || '—',
    tipoId:        document.getElementById('sadt-tipo-id')?.value        || '1',
    idBeneficiario:document.getElementById('sadt-id-beneficiario')?.value|| '—',
    // Beneficiário
    carteira:      document.getElementById('sadt-carteira')?.value       || '—',
    valCarteira:   document.getElementById('sadt-val-carteira')?.value   || '',
    beneficiario:  document.getElementById('sadt-beneficiario')?.value   || '—',
    cns:           document.getElementById('sadt-cns')?.value            || '—',
    rn:            document.getElementById('sadt-rn')?.value             || 'N',
    nasc:          document.getElementById('sadt-nasc')?.value           || '',
    // Solicitante
    codPrestador:  document.getElementById('sadt-cod-prestador')?.value  || CLINICA.codPrestador,
    prestador:     document.getElementById('sadt-prestador')?.value      || CLINICA.nome,
    profNome:      document.getElementById('sadt-prof-nome')?.value      || '—',
    conselho:      document.getElementById('sadt-conselho')?.value       || '—',
    numConselho:   document.getElementById('sadt-num-conselho')?.value   || '—',
    ufConselho:    document.getElementById('sadt-uf-conselho')?.value    || 'SP',
    cbo:           document.getElementById('sadt-cbo')?.value            || '—',
    dataSolic:     document.getElementById('sadt-data-solic')?.value     || '',
    // Solicitação
    carater:       document.getElementById('sadt-carater')?.value        || '1',
    indicacao:     document.getElementById('sadt-indicacao')?.value      || '—',
    // Procedimentos solicitados
    procs,
    // Executante
    execCod:       document.getElementById('sadt-exec-cod')?.value       || CLINICA.codPrestador,
    execNome:      document.getElementById('sadt-exec-nome')?.value      || CLINICA.nome,
    cnes:          document.getElementById('sadt-cnes')?.value           || '—',
    // Atendimento
    tipoAtend:     document.getElementById('sadt-tipo-atend')?.value     || '03',
    acidente:      document.getElementById('sadt-acidente')?.value       || '9',
    tipoCons:      document.getElementById('sadt-tipo-cons')?.value      || '4',
    motivoEnc:     document.getElementById('sadt-motivo-enc')?.value     || '—',
    regime:        document.getElementById('sadt-regime')?.value         || '01',
    cobertura:     document.getElementById('sadt-cobertura')?.value      || '—',
    saudeOcup:     document.getElementById('sadt-saude-ocup')?.value     || 'N',
    // Executados
    execProcs,
    // Totais
    totProc:       totalProc,
    totTaxas:      parseFloat(document.getElementById('sadt-tot-taxas')?.value||'0')||0,
    totMat:        parseFloat(document.getElementById('sadt-tot-mat')?.value||'0')||0,
    totOpme:       parseFloat(document.getElementById('sadt-tot-opme')?.value||'0')||0,
    totMed:        parseFloat(document.getElementById('sadt-tot-med')?.value||'0')||0,
    totGas:        parseFloat(document.getElementById('sadt-tot-gas')?.value||'0')||0,
    total:         totalProc,
    // Profissional executante
    execGrau:      document.getElementById('sadt-exec-grau')?.value      || '12',
    execCpf:       document.getElementById('sadt-exec-cpf')?.value       || '—',
    execProfNome:  document.getElementById('sadt-exec-prof-nome')?.value || '—',
    execConselho:  document.getElementById('sadt-exec-conselho')?.value  || '—',
    execNumCons:   document.getElementById('sadt-exec-num-conselho')?.value || '—',
    execUf:        document.getElementById('sadt-exec-uf')?.value        || 'SP',
    execCbo:       document.getElementById('sadt-exec-cbo')?.value       || '—',
    obs:           document.getElementById('sadt-obs')?.value            || '',
    // Logo do plano (busca pelo nome da operadora preenchida no modal)
    planoLogo:     (() => {
      const opNome = document.getElementById('sadt-operadora')?.value || '';
      const planoObj = PLANOS.find(p => p.nome === opNome || p.nomeGuia === opNome);
      return planoObj?.logo || null;
    })(),
    // Meta
    dataImpressao: new Date().toLocaleDateString('pt-BR'),
    horaImpressao: new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),
  };
}

function formatDate(iso) {
  if (!iso || iso==='—') return '___/___/______';
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function formatBRL(n) {
  if (!n && n!==0) return '0,00';
  return n.toFixed(2).replace('.',',');
}
function fv(v) { return v || ''; }


