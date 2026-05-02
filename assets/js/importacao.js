// ═══════════════════════════════════════
//  CENTRAL DE IMPORTAÇÃO — MÓDULO COMPLETO
// ═══════════════════════════════════════

// ── State ────────────────────────────────────────────────────────────────────
let IMP_TIPO       = 'pacientes';  // current import type
let impRawRows     = [];
let impHeaders     = [];
let impMapping     = {};
let impParsed      = [];
let impFilter      = 'all';
let impNextId      = 200;

// ── Schema definitions for each import type ──────────────────────────────────
const IMP_SCHEMAS = {
  pacientes: {
    label:'Pacientes', icon:'👥', modulo:'pacientes',
    fields:[
      {key:'nome',        label:'Nome completo',     required:true},
      {key:'nasc',        label:'Data de nascimento', required:false},
      {key:'cpf',         label:'CPF',               required:false},
      {key:'tel',         label:'Telefone/WhatsApp',  required:false},
      {key:'email',       label:'E-mail',            required:false},
      {key:'plano',       label:'Plano de saúde',    required:false},
      {key:'carteirinha', label:'Nº carteirinha',     required:false},
      {key:'end',         label:'Endereço',          required:false},
      {key:'sexo',        label:'Sexo',              required:false},
      {key:'obs',         label:'Observações',       required:false},
    ],
    autoMatch:{
      nome:['nome','name','paciente','beneficiario','beneficiário'],
      nasc:['nascimento','nasc','data de nascimento','data nasc','birthday','nasc.'],
      cpf:['cpf','cpf/cnpj'],
      tel:['telefone','celular','whatsapp','fone','tel.'],
      email:['email','e-mail'],
      plano:['plano','convenio','convênio','plano de saúde'],
      carteirinha:['carteirinha','cartão','numero carteirinha','nº carteirinha'],
      end:['endereço','endereco','address','rua'],
      sexo:['sexo','gênero','genero','sex'],
      obs:['obs','observações','observacoes','notas'],
    },
    demo:"Nome,Nascimento,CPF,Telefone,Email,Plano,Carteirinha\nAna Maria Silva,15/03/1985,123.456.789-00,(11)99123-4567,ana\u0040email.com,SulAmérica,1234567890123\nRoberto Carvalho,22/07/1970,,,(roberto\u0040email.com,Unimed,9876543210987",
  },

  profissionais: {
    label:'Profissionais', icon:'🩺', modulo:'profissionais',
    fields:[
      {key:'nome',      label:'Nome completo',   required:true},
      {key:'nomeAgenda',label:'Nome na agenda',  required:false},
      {key:'esp',       label:'Especialidade',   required:false},
      {key:'conselho',  label:'Tipo conselho',   required:false},
      {key:'num',       label:'Nº conselho',     required:false},
      {key:'uf',        label:'UF conselho',     required:false},
      {key:'cbo',       label:'Código CBO',      required:false},
      {key:'tel',       label:'Telefone',        required:false},
      {key:'email',     label:'E-mail',          required:false},
      {key:'cor',       label:'Cor agenda (hex)',required:false},
    ],
    autoMatch:{
      nome:['nome','name','profissional','terapeuta','médico','medico'],
      esp:['especialidade','specialty','area'],
      conselho:['conselho','council','crm','crp','crfa','crefito'],
      num:['nº conselho','num conselho','numero conselho','registro'],
      uf:['uf','estado','state'],
      cbo:['cbo','codigo cbo'],
      tel:['telefone','celular','fone'],
      email:['email','e-mail'],
    },
    demo:"Nome,Especialidade,Conselho,NºConselho,UF,CBO,Telefone\nDra. Maria Cecília,Fonoaudiologia,CRFa,12345,SP,223810,(11)99000-0001\nDr. João Santos,Psicologia,CRP,67890,SP,251510,(11)99000-0002",
  },

  agenda: {
    label:'Agenda', icon:'📅', modulo:'agenda',
    fields:[
      {key:'terapeuta', label:'Terapeuta',           required:true},
      {key:'data',      label:'Data',                required:true},
      {key:'horaIni',   label:'Horario Inicio',      required:true},
      {key:'horaFim',   label:'Horario Fim',         required:false},
      {key:'duracao',   label:'Duração (min)',        required:false},
      {key:'paciente',  label:'Paciente',             required:true},
      {key:'plano',     label:'Convênio',             required:false},
      {key:'tipo',      label:'Tipo',                 required:false},
      {key:'processo',  label:'Processo',             required:false},
      {key:'semana',    label:'Semana/Ref',           required:false},
      {key:'statusDist',label:'Status Distribuição',  required:false},
      {key:'statusGoogle',label:'Status Agenda Google',required:false},
    ],
    autoMatch:{
      terapeuta:  ['terapeuta','profissional','therapist','dr','dra'],
      data:       ['data','date','dia'],
      horaIni:    ['horario inicio','horário início','hora ini','inicio','start','horainicio'],
      horaFim:    ['horario fim','horário fim','hora fim','fim','end','horafim'],
      duracao:    ['duracao','duração','duration','duração (min)','duracao (min)'],
      paciente:   ['paciente','nome','beneficiario','patient'],
      plano:      ['convenio','convênio','plano'],
      tipo:       ['tipo','type'],
      processo:   ['processo','process'],
      semana:     ['semana','semana/ref','week','ref'],
      statusDist: ['status distribuicao','status distribuição','distribuicao'],
      statusGoogle:['status agenda google','agenda google','status google'],
    },
    demo:"Terapeuta,Data,Horario Inicio,Horario Fim,Duracao (min),Paciente,Convenio,Tipo,Processo,Semana/Ref,Status Distribuicao,Status Agenda Google\nMaria Cecilia,30/03/2026,08:00,09:00,60,Ana Maria Silva,SulAmérica,,,Março Semana 5,Distribuído,Criado",
  },

  anamnese: {
    label:'Anamnese', icon:'📋', modulo:'historico',
    fields:[
      {key:'nome', label:'Nome do paciente', required:true},
    ],
    autoMatch:{ nome:['nome completo do paciente','nome do paciente','paciente','nome'] },
    demo:"Nome completo do paciente,3.1 — Queixa principal,3.2 — Outras queixas\nAna Maria Silva,Dificuldade de comunicação,Atraso na fala",
    freeform:true, // all columns imported
  },

  evolucoes: {
    label:'Evoluções', icon:'📝', modulo:'historico',
    fields:[
      {key:'paciente', label:'Paciente',         required:true},
      {key:'data',     label:'Data',              required:true},
      {key:'horaIni',  label:'Horário Início',    required:false},
      {key:'horaFim',  label:'Horário Fim',       required:false},
      {key:'duracao',  label:'Duração (min)',      required:false},
      {key:'plano',    label:'Convênio',           required:false},
      {key:'semana',   label:'Semana',             required:false},
      {key:'presenca', label:'Presença',           required:false},
      {key:'evolucao', label:'Evolução',           required:false},
    ],
    autoMatch:{
      paciente:['paciente','nome'],
      data:    ['data','date'],
      horaIni: ['horário início','horario inicio','hora início','inicio','start'],
      horaFim: ['horário fim','horario fim','hora fim','fim','end'],
      duracao: ['duração','duracao','duration'],
      plano:   ['convênio','convenio','plano'],
      semana:  ['semana','week'],
      presenca:['presença','presenca'],
      evolucao:['evolução','evolucao','evolution','texto','notas'],
    },
    demo:"ID,Data,Horário Início,Horário Fim,Duração (min),Paciente,Convênio,Semana,Presença,Evolução,Mês,Ano,Registrado em\n,2026-04-08,09:00,09:30,30,Ana Maria Silva,SulAmérica,Abril Semana 2,Presente,Paciente apresentou boa evolução.,4,2026,2026-04-08 12:00:00",
  },

  planos: {
    label:'Planos de Saúde', icon:'🏥', modulo:'planos',
    fields:[
      {key:'nome',          label:'Nome do plano',        required:true},
      {key:'ans',           label:'Registro ANS',         required:false},
      {key:'cnpj',          label:'CNPJ operadora',       required:false},
      {key:'tabela',        label:'Tipo tabela',          required:false},
      {key:'codPrestador',  label:'Código prestador',     required:false},
      {key:'nomeContratado',label:'Nome contratado',      required:false},
      {key:'cnes',          label:'CNES',                 required:false},
      {key:'tel',           label:'Telefone',             required:false},
    ],
    autoMatch:{
      nome:['nome','nome do plano','plano','operadora'],
      ans:['ans','registro ans','reg. ans'],
      cnpj:['cnpj','cnpj operadora'],
      tabela:['tabela','tipo tabela'],
      codPrestador:['cod. prestador','código prestador','codigo prestador'],
      nomeContratado:['nome contratado','contratado','prestador'],
      cnes:['cnes','código cnes'],
    },
    demo:"Nome,ANS,CNPJ,Tabela,CodPrestador,NomeContratado,CNES\nSulAmérica,6246,01.685.053/0001-56,CBHPM,100000019260,KOSMOS ESPACO TERAPEUTICO,620904",
  },

  tabela: {
    label:'Tabela de Preços', icon:'💰', modulo:'procedimentos',
    fields:[
      {key:'codigo',   label:'Código TUSS',       required:false},
      {key:'desc',     label:'Descrição',         required:true},
      {key:'tipo',     label:'Tipo',              required:false},
      {key:'valPart',  label:'Valor particular',  required:false},
      {key:'valPlano', label:'Valor plano',       required:false},
      {key:'plano',    label:'Plano vinculado',   required:false},
    ],
    autoMatch:{
      codigo:['código','codigo','code','tuss','cod.'],
      desc:['descrição','descricao','description','procedimento','nome'],
      tipo:['tipo','type'],
      valPart:['valor particular','val. part','particular'],
      valPlano:['valor plano','val. plano','plano'],
      plano:['plano','convenio'],
    },
    demo:"Codigo,Descricao,Tipo,ValorParticular,ValorPlano,Plano\n50000470,Sessão de Psicoterapia Individual,Sessão,220.00,59.66,SulAmérica",
  },

  guias: {
    label:'Guias SADT / Lotes', icon:'📄', modulo:'tiss',
    fields:[
      {key:'num',      label:'Nº guia',          required:false},
      {key:'pac',      label:'Paciente',         required:true},
      {key:'plano',    label:'Plano',            required:false},
      {key:'data',     label:'Data',             required:false},
      {key:'valor',    label:'Valor (R$)',        required:false},
      {key:'status',   label:'Status',           required:false},
      {key:'carteirinha',label:'Carteirinha',    required:false},
      {key:'cid',      label:'CID',              required:false},
    ],
    autoMatch:{
      num:['nº guia','numero guia','num guia','guia','nº'],
      pac:['paciente','beneficiario','nome'],
      plano:['plano','convenio','operadora'],
      data:['data','date','data guia'],
      valor:['valor','value','total','r$'],
      status:['status','situacao'],
      carteirinha:['carteirinha','cartão'],
      cid:['cid','cid-10','indicação'],
    },
    demo:"NumGuia,Paciente,Plano,Data,Valor,Status\nG001,Ana Maria Silva,SulAmérica,30/03/2026,180.00,Pendente",
  },

  senhas: {
    label:'Senhas/Autorizações', icon:'🔑', modulo:'senhas',
    fields:[
      {key:'paciente',    label:'Paciente',              required:true},
      {key:'plano',       label:'Plano',                 required:true},
      {key:'numSenha',    label:'Nº senha/autorização',  required:true},
      {key:'dataAut',     label:'Data de autorização',   required:false},
      {key:'validade',    label:'Validade / Vencimento', required:false},
      {key:'qtdAut',      label:'Qtd. autorizada',       required:false},
      {key:'carteirinha', label:'Carteirinha',           required:false},
      {key:'numGuiaOp',   label:'Nº guia operadora',     required:false},
      {key:'cid',         label:'CID-10',                required:false},
      {key:'codigoProc',  label:'Código TUSS',           required:false},
      {key:'procedimento',label:'Descrição procedimento',required:false},
    ],
    autoMatch:{
      paciente:['paciente','beneficiario','nome'],
      plano:['plano','convenio','convênio'],
      numSenha:['senha','autorização','autorizacao','nº senha','num senha','numero senha'],
      dataAut:['data aut','data autorização','data autorizacao','dt aut','data da autorização','autorizacao data','data_aut'],
      validade:['validade','val.','vencimento','dt vencimento','data vencimento','data validade','validade senha'],
      qtdAut:['qtd','quantidade','sessões','sessoes','autorizado','qtd autorizada','qtd_autorizada'],
      carteirinha:['carteirinha','cartão','numero cartao','num carteirinha'],
      numGuiaOp:['guia op','nº guia','num guia op','numero guia operadora'],
      cid:['cid','cid-10'],
      codigoProc:['código tuss','codigo tuss','tuss','cod proc','codigo proc','código proc','cod. proc','codigo procedimento','código procedimento'],
      procedimento:['procedimento','proc','descricao proc','descrição proc','desc proc','descricao','descrição'],
    },
    demo:"Paciente,Plano,NumSenha,DataAutorizacao,Validade,QtdAutorizada,Carteirinha,CodigoTUSS,Procedimento\nAna Maria Silva,SulAmérica,A30152689,01/04,30/04,12,1234567890123,50000470,Avaliação Fonoaudiológica",
  },
};

// ── UI helpers ────────────────────────────────────────────────────────────────
function selecionarTipoImport(tipo, el) {
  IMP_TIPO = tipo;
  document.querySelectorAll('.imp-tipo-card').forEach(c=>c.classList.remove('active'));
  if (el) el.classList.add('active');
  const schema = IMP_SCHEMAS[tipo];
  // Update info box
  const infoTitle = document.getElementById('imp-info-title');
  const infoCols  = document.getElementById('imp-info-cols');
  const step1Title= document.getElementById('imp-step1-title');
  if (infoTitle) infoTitle.textContent = 'Colunas esperadas — '+schema.label;
  if (step1Title) step1Title.textContent = 'Carregar planilha de '+schema.label;
  if (infoCols) {
    infoCols.innerHTML = schema.fields.map(f =>
      '<div style="background:var(--bg-overlay);border-radius:var(--radius-sm);padding:4px 10px;font-size:11px">'+
      (f.required?'<span style="color:var(--danger)">*</span> ':'')+f.label+'</div>'
    ).join('');
  }
  // Reset wizard
  impReset();
}

// ── File handling ─────────────────────────────────────────────────────────────
function handleFileDrop(e) {
  e.preventDefault();
  const dz = document.getElementById('imp-dropzone');
  if(dz){ dz.style.borderColor='var(--border-mid)'; dz.style.background=''; }
  const file = e.dataTransfer.files[0];
  if (file) processUploadedFile(file);
}
function handleFileSelect(input) {
  if (input.files[0]) processUploadedFile(input.files[0]);
}
function processUploadedFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv')||name.endsWith('.txt')) {
    const r=new FileReader(); r.onload=e=>parseAndGoStep2(e.target.result); r.readAsText(file,'UTF-8');
  } else if (name.endsWith('.xlsx')||name.endsWith('.xls')) {
    const r=new FileReader(); r.onload=e=>parseXLSXAndGoStep2(e.target.result); r.readAsArrayBuffer(file);
  } else { showToast('Use .csv ou .xlsx','error'); }
}
function parseAndGoStep2(text) {
  if (text.charCodeAt(0)===0xFEFF) text=text.slice(1);
  const sep = (text.split('\n')[0]||'').includes(';')?';':',';
  const rows = parseCSVLines(text);
  if(!rows.length){ showToast('Arquivo vazio','error'); return; }
  impHeaders = rows[0];
  impRawRows = rows.slice(1).filter(r=>r.some(c=>c));
  buildColMapUI();
  impGoStep(2);
}
function parseXLSXAndGoStep2(buffer) {
  if(typeof XLSX==='undefined'){
    const s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload=()=>doParseXLSXBuffer(buffer);
    s.onerror=()=>showToast('Erro ao carregar parser XLSX. Use CSV.','error');
    document.head.appendChild(s);
  } else doParseXLSXBuffer(buffer);
}
function doParseXLSXBuffer(buffer) {
  try {
    const wb=XLSX.read(buffer,{type:'array',cellDates:true});
    const ws=wb.Sheets[wb.SheetNames[0]];
    const data=XLSX.utils.sheet_to_json(ws,{header:1,raw:false,dateNF:'DD/MM/YYYY'});
    if(!data.length){showToast('Planilha vazia','error');return;}
    impHeaders=data[0].map(h=>String(h||'').trim());
    impRawRows=data.slice(1).map(r=>impHeaders.map((_,i)=>String(r[i]||'').trim())).filter(r=>r.some(c=>c));
    buildColMapUI(); impGoStep(2);
  } catch(e){ showToast('Erro XLSX: '+e.message,'error'); }
}
function impProcessFile() {
  const pasted=(document.getElementById('imp-csv-paste')?.value||'').trim();
  if(pasted) parseAndGoStep2(pasted);
  else showToast('Selecione um arquivo ou cole o CSV','error');
}
function impUsarDemo() {
  const schema=IMP_SCHEMAS[IMP_TIPO];
  document.getElementById('imp-csv-paste').value=schema.demo||'';
  showToast('Dados de exemplo carregados!','success');
}

// ── Column mapping ────────────────────────────────────────────────────────────
function buildColMapUI() {
  const schema=IMP_SCHEMAS[IMP_TIPO];
  // Auto-detect
  impMapping={};
  impHeaders.forEach((h,idx)=>{
    const norm=h.toLowerCase().replace(/[^a-záéíóúãõç0-9]/g,'');
    schema.fields.forEach(f=>{
      if(impMapping[f.key]!==undefined) return;
      const aliases=schema.autoMatch[f.key]||[];
      if(aliases.some(a=>norm.includes(a.replace(/[^a-záéíóúãõç0-9]/g,''))||
        a.replace(/[^a-záéíóúãõç0-9]/g,'').includes(norm.substring(0,5))))
        impMapping[f.key]=idx;
    });
  });
  const grid=document.getElementById('imp-col-map-grid');
  if(!grid) return;
  grid.innerHTML='';
  schema.fields.forEach(f=>{
    const opts='<option value="-1">— Não usar —</option>'+
      impHeaders.map((h,i)=>'<option value="'+i+'"'+(impMapping[f.key]===i?' selected':'')+'>'+h+'</option>').join('');
    const lbl=document.createElement('div'); lbl.className='imp-map-label';
    lbl.innerHTML=f.label+(f.required?'<span style="color:var(--danger)"> *</span>':'');
    const arr=document.createElement('div'); arr.className='imp-map-arrow'; arr.textContent='→';
    const sel=document.createElement('select'); sel.className='form-select'; sel.style.fontSize='13px';
    sel.id='imp-map-'+f.key; sel.innerHTML=opts;
    sel.addEventListener('change',()=>impMapping[f.key]=parseInt(sel.value));
    grid.appendChild(lbl); grid.appendChild(arr); grid.appendChild(sel);
  });
  // Raw preview
  const raw=document.getElementById('imp-preview-raw');
  if(raw) raw.innerHTML=impRawRows.slice(0,3).map(r=>
    '<div style="padding:2px 0;border-bottom:1px solid var(--border);white-space:nowrap">'+
    impHeaders.map((h,i)=>'<span style="color:var(--text-muted)">'+h+':</span> '+
    '<span style="color:var(--text-primary)">'+( r[i]||'')+'</span> &nbsp;').join('')+'</div>'
  ).join('');
}
function impRunMapping() {
  const schema=IMP_SCHEMAS[IMP_TIPO];
  schema.fields.forEach(f=>{
    const sel=document.getElementById('imp-map-'+f.key);
    if(sel) impMapping[f.key]=parseInt(sel.value);
  });
  const missing=schema.fields.filter(f=>f.required&&(impMapping[f.key]==null||impMapping[f.key]<0));
  if(missing.length){ showToast('Mapeie: '+missing.map(f=>f.label).join(', '),'error'); return; }
  processRowsByType();
  buildPreviewUI();
  impGoStep(3);
}

// ── Row processing per type ───────────────────────────────────────────────────
function impGetCell(row,field){ const i=impMapping[field]; return (i==null||i<0)?'':(row[i]||'').trim(); }

// Busca paciente por nome com prioridade: exato → nome completo contém → nome completo invertido
// Evita pegar "Thiago Silva" quando o nome é "Thiago Rocha"
// ── Normaliza string para comparação fuzzy (remove acentos, lowercase, espaços extras) ──
function normStr(s) {
  if (!s) return '';
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

// ── Score de similaridade entre dois nomes (0-100) ──────────────────────────
function nomeScore(a, b) {
  const na = normStr(a), nb = normStr(b);
  if (na === nb) return 100;
  if (na.includes(nb) || nb.includes(na)) return 90;
  const ta = na.split(' ').filter(t => t.length > 1);
  const tb = nb.split(' ').filter(t => t.length > 1);
  const common = ta.filter(t => tb.some(u => u === t || u.startsWith(t) || t.startsWith(u)));
  const score = Math.round((common.length / Math.max(ta.length, tb.length)) * 80);
  // Boost se primeiro ou último token bate
  if (ta[0] && tb[0] && normStr(ta[0]) === normStr(tb[0])) return Math.max(score, 55);
  if (ta[ta.length-1] && tb[tb.length-1] &&
      normStr(ta[ta.length-1]) === normStr(tb[tb.length-1])) return Math.max(score, 50);
  return score;
}

function encontrarPacientePorNome(nomeBusca) {
  if (!nomeBusca) return null;
  const q = nomeBusca.trim().toLowerCase();
  const qn = normStr(nomeBusca);

  // 1. Exata
  let p = PACIENTES.find(x => x.nome.toLowerCase() === q);
  if (p) return p;

  // 2. Normalizada exata (sem acentos, case)
  p = PACIENTES.find(x => normStr(x.nome) === qn);
  if (p) return p;

  // 3. Contém completo
  p = PACIENTES.find(x => normStr(x.nome).includes(qn) || qn.includes(normStr(x.nome)));
  if (p) return p;

  // 4. Todos os tokens batem
  const tokens = qn.split(/\s+/).filter(t => t.length > 1);
  p = PACIENTES.find(x => tokens.every(t => normStr(x.nome).includes(t)));
  if (p) return p;

  // 5. Maioria dos tokens bate (tolerante a abreviações)
  if (tokens.length >= 2) {
    p = PACIENTES.find(x => {
      const matched = tokens.filter(t => normStr(x.nome).includes(t));
      return matched.length >= Math.ceil(tokens.length * 0.6);
    });
    if (p) return p;
  }

  return null;
}

// ── Busca sugestões fuzzy (top 5) para pacientes não encontrados ──────────────
function sugestoesFuzzy(nomeBusca, limite = 5) {
  if (!nomeBusca) return [];
  return PACIENTES
    .map(p => ({ p, score: nomeScore(nomeBusca, p.nome) }))
    .filter(x => x.score >= 30)
    .sort((a, b) => b.score - a.score)
    .slice(0, limite)
    .map(x => x.p);
}

// ═══════════════════════════════════════════════════════════════════
//  MODAL CORREÇÃO DE PACIENTE (Importação)
// ═══════════════════════════════════════════════════════════════════
let _corrQueue    = [];   // fila de linhas com paciente não encontrado
let _corrIdx      = 0;    // índice atual na fila
let _corrCallback = null; // chamado quando a fila é resolvida

function corrPacAbrir(queue, callback) {
  _corrQueue    = queue;
  _corrIdx      = 0;
  _corrCallback = callback;
  _corrMostrar();
}

function _corrMostrar() {
  if (_corrIdx >= _corrQueue.length) {
    closeModal('modal-corr-pac');
    if (_corrCallback) _corrCallback();
    return;
  }
  const item = _corrQueue[_corrIdx];
  document.getElementById('corr-pac-sub').textContent =
    `Linha ${item._rowIdx + 1} de ${_corrQueue.length} não encontrada — selecione o paciente correto`;
  document.getElementById('corr-pac-nome-orig').textContent = item._nomeOrig || '—';
  document.getElementById('corr-pac-busca').value = '';
  document.getElementById('corr-pac-resultados').style.display = 'none';

  // Sugestões fuzzy
  const sugs = sugestoesFuzzy(item._nomeOrig, 5);
  const sugEl = document.getElementById('corr-pac-sugestoes');
  if (sugs.length) {
    sugEl.innerHTML = '<div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">Sugestões do sistema:</div>' +
      sugs.map(p =>
        `<button class="btn-sm btn-secondary" style="margin-bottom:4px;width:100%;justify-content:flex-start;text-align:left;gap:8px"
          onclick="corrPacSelecionar(${p.id})">
          <span style="font-size:12px;font-weight:600">${p.nome}</span>
          <span style="font-size:10px;color:var(--text-muted);margin-left:auto">${p.plano||''}</span>
        </button>`
      ).join('');
  } else {
    sugEl.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:8px 0">Nenhuma sugestão automática — use a busca abaixo.</div>';
  }
  openModal('modal-corr-pac');
}

function corrPacBusca(val) {
  const resEl = document.getElementById('corr-pac-resultados');
  if (!val || val.length < 2) { resEl.style.display = 'none'; return; }
  const res = PACIENTES.filter(p =>
    normStr(p.nome).includes(normStr(val))
  ).slice(0, 10);
  if (!res.length) { resEl.style.display = 'none'; return; }
  resEl.style.display = 'block';
  resEl.innerHTML = res.map(p =>
    `<div onclick="corrPacSelecionar(${p.id})"
      style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border);font-size:12px"
      onmouseover="this.style.background='var(--bg-overlay)'"
      onmouseout="this.style.background=''">
      <strong>${p.nome}</strong> <span style="color:var(--text-muted);font-size:11px">· ${p.plano||'Particular'}</span>
    </div>`
  ).join('');
}

function corrPacSelecionar(pacId) {
  const pac = PACIENTES.find(p => p.id === pacId);
  if (!pac) return;
  // Aplica a correção na linha atual da fila
  const item = _corrQueue[_corrIdx];
  item.pac       = pac;
  item.paciente  = pac.nome;
  item._corrigido = true;
  _corrIdx++;
  _corrMostrar();
}

function corrPacIgnorar() {
  const item = _corrQueue[_corrIdx];
  item._ignorar = true;
  _corrIdx++;
  _corrMostrar();
}

function corrPacIgnorarTodos() {
  for (let i = _corrIdx; i < _corrQueue.length; i++) {
    _corrQueue[i]._ignorar = true;
  }
  closeModal('modal-corr-pac');
  if (_corrCallback) _corrCallback();
}

function parseISODate(str) {
  if(!str) return null;
  str = str.trim();
  // Formato dd/mm/yyyy ou dd-mm-yyyy (com ano completo ou 2 dígitos)
  let m=str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if(m) return (m[3].length===2?'20'+m[3]:m[3])+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
  // Formato yyyy-mm-dd (já ISO)
  m=str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(m) return str;
  // Formato dd/mm ou dd-mm sem ano → assume ano corrente
  m=str.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if(m) return new Date().getFullYear()+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
  return null;
}

function processRowsByType() {
  const type=IMP_TIPO;
  impParsed=impRawRows.map((row,idx)=>{
    const issues=[],warnings=[];
    let item={},status='ok';
    switch(type){
      case 'pacientes':{
        item.nome=impGetCell(row,'nome');
        item.nasc=impGetCell(row,'nasc');
        item.cpf=impGetCell(row,'cpf');
        item.tel=impGetCell(row,'tel');
        item.email=impGetCell(row,'email');
        item.planoNome=impGetCell(row,'plano');
        item.carteirinha=impGetCell(row,'carteirinha');
        item.end=impGetCell(row,'end');
        item.sexo=impGetCell(row,'sexo');
        item.obs=impGetCell(row,'obs');
        if(!item.nome) issues.push('Nome obrigatório');
        const dup=PACIENTES.find(p=>p.nome.toLowerCase()===item.nome.toLowerCase());
        if(dup) warnings.push('Paciente já existe (será atualizado)');
        const plano=item.planoNome?PLANOS.find(p=>p.nome.toLowerCase().includes(item.planoNome.toLowerCase())):null;
        item.planoId=plano?.id||5; item.plano=plano?.nome||'Particular';
        item.detail=item.nome; item.extra=item.planoNome||'Particular';
        break;
      }
      case 'profissionais':{
        item.nome=impGetCell(row,'nome');
        item.nomeAgenda=impGetCell(row,'nomeAgenda');
        item.esp=impGetCell(row,'esp');
        item.conselho=impGetCell(row,'conselho');
        item.num=impGetCell(row,'num');
        item.uf=impGetCell(row,'uf');
        item.cbo=impGetCell(row,'cbo');
        item.tel=impGetCell(row,'tel');
        item.email=impGetCell(row,'email');
        item.cor=impGetCell(row,'cor');
        if(!item.nome) issues.push('Nome obrigatório');
        const dup=PROFISSIONAIS.find(p=>p.nome.toLowerCase()===item.nome.toLowerCase());
        if(dup) warnings.push('Profissional já existe (será atualizado)');
        item.detail=item.nome; item.extra=item.esp||'—';
        break;
      }
      case 'agenda':{
        item.terapNome  = impGetCell(row,'terapeuta');
        item.dataStr    = impGetCell(row,'data');
        item.horaIni    = impGetCell(row,'horaIni');
        item.horaFim    = impGetCell(row,'horaFim');
        item.duracaoStr = impGetCell(row,'duracao');
        item.paciente   = impGetCell(row,'paciente');
        item.planoNome  = impGetCell(row,'plano');
        item.tipo       = impGetCell(row,'tipo');
        item.processo   = impGetCell(row,'processo');
        item.semana     = impGetCell(row,'semana');
        item.statusDist = impGetCell(row,'statusDist');
        item.statusGoogle = impGetCell(row,'statusGoogle');

        if (!item.terapNome) issues.push('Terapeuta obrigatório');
        if (!item.paciente)  issues.push('Paciente obrigatório');
        if (!item.dataStr)   issues.push('Data obrigatória');
        if (!item.horaIni)   issues.push('Horário início obrigatório');

        // Normaliza data dd/mm/yyyy → yyyy-mm-dd
        item.dataISO = '';
        if (item.dataStr) {
          let dm = item.dataStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (dm) { item.dataISO = dm[1]+'-'+dm[2]+'-'+dm[3]; }
          else {
            dm = item.dataStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
            if (dm) item.dataISO = (dm[3].length===2?'20'+dm[3]:dm[3])+'-'+dm[2].padStart(2,'0')+'-'+dm[1].padStart(2,'0');
          }
        }
        if (item.dataStr && !item.dataISO) issues.push('Data inválida: '+item.dataStr);

        // Detecta modalidade pelo campo Tipo (Online)
        item.modalidade = (item.tipo||'').toLowerCase().includes('online') ? 'online' : 'presencial';

        // Match terapeuta — nome parcial (ex: "Maria Cecilia" bate "Maria Cecília Santos")
        const tTokens = (item.terapNome||'').trim().toLowerCase().split(/\s+/).filter(t=>t.length>1);
        const prof = PROFISSIONAIS.find(p =>
          tTokens.every(t => p.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(
            t.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
          ))
        ) || PROFISSIONAIS.find(p =>
          p.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(
            (tTokens[0]||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
          )
        );
        if (item.terapNome && !prof) warnings.push('Terapeuta "'+item.terapNome+'" novo — será criado');
        item.prof = prof;

        // Match paciente — fuzzy com tolerância a acentos/abreviações
        const pac = encontrarPacientePorNome(item.paciente);
        if (!pac) {
          warnings.push('Paciente "'+item.paciente+'" não encontrado — aguardando correção');
          item._nomeOrig = item.paciente;
          item._precisaCorrecao = true;
        }
        item.pac = pac;

        item.durMin = parseInt(item.duracaoStr) || 30;

        // Deduplicação
        const dupAppt = prof && item.dataISO ? APPOINTMENTS.find(a =>
          a.profId === prof.id &&
          a.paciente.toLowerCase() === item.paciente.toLowerCase() &&
          a.hora === item.horaIni &&
          a.dataISO === item.dataISO
        ) : null;
        if (dupAppt) warnings.push('Agendamento já existe — será ignorado');
        item.dup = dupAppt;

        item.detail = item.paciente;
        item.extra  = item.dataStr + ' ' + item.horaIni + (item.terapNome ? ' · '+item.terapNome : '');
        break;
      }
      case 'anamnese':{
        const nomeIdx=impHeaders.findIndex(h=>h.toLowerCase().includes('nome'));
        item.nomePac=(nomeIdx>=0?row[nomeIdx]:'').trim();
        item.conteudo={};
        impHeaders.forEach((h,i)=>{ if(row[i]&&row[i].trim()) item.conteudo[h]=row[i].trim(); });
        if(!item.nomePac) issues.push('Nome do paciente não encontrado');
        const pac=item.nomePac?encontrarPacientePorNome(item.nomePac):null;
        if(!pac&&item.nomePac) warnings.push('Paciente não encontrado no cadastro');
        item.pac=pac;
        item.detail=item.nomePac; item.extra=Object.keys(item.conteudo).length+' campos';
        break;
      }
      case 'evolucoes':{
        item.paciente  = impGetCell(row,'paciente');
        item.dataStr   = impGetCell(row,'data');
        item.evolucao  = impGetCell(row,'evolucao');
        item.horaIni   = impGetCell(row,'horaIni');
        item.horaFim   = impGetCell(row,'horaFim');
        item.durStr    = impGetCell(row,'duracao');
        item.presenca  = impGetCell(row,'presenca');
        item.convNome  = impGetCell(row,'plano');
        item.semana    = impGetCell(row,'semana');
        if(!item.paciente) issues.push('Paciente obrigatório');
        if(!item.dataStr)  issues.push('Data obrigatória');
        // Normaliza data: yyyy-mm-dd ou dd/mm/yyyy
        item.dataISO = '';
        if (item.dataStr) {
          let dm = item.dataStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (dm) { item.dataISO = dm[1]+'-'+dm[2]+'-'+dm[3]; }
          else {
            dm = item.dataStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
            if (dm) item.dataISO = (dm[3].length===2?'20'+dm[3]:dm[3])+'-'+dm[2].padStart(2,'0')+'-'+dm[1].padStart(2,'0');
          }
        }
        const pac = encontrarPacientePorNome(item.paciente);
        if (!pac) warnings.push('Paciente não encontrado — será ignorado');
        item.pac = pac;
        // Deduplicação por paciente + data + hora
        const dupEvo = pac ? HISTORICO.find(h =>
          h.pacId===pac.id && h.tipo==='evolucao' &&
          h.data===(item.dataISO||item.dataStr) &&
          (h.conteudo?.horaIni||'')===item.horaIni
        ) : null;
        if (dupEvo) warnings.push('Evolução já existe para esta data/horário');
        item.dup = dupEvo;
        item.detail = item.paciente; item.extra = item.dataStr + (item.horaIni?' '+item.horaIni:'');
        break;
      }
      case 'planos':{
        item.nome=impGetCell(row,'nome');
        item.ans=impGetCell(row,'ans');
        item.cnpj=impGetCell(row,'cnpj');
        item.tabela=impGetCell(row,'tabela')||'CBHPM';
        item.codPrestador=impGetCell(row,'codPrestador');
        item.nomeContratado=impGetCell(row,'nomeContratado');
        item.cnes=impGetCell(row,'cnes');
        item.tel=impGetCell(row,'tel');
        if(!item.nome) issues.push('Nome do plano obrigatório');
        const dup=PLANOS.find(p=>p.nome.toLowerCase()===item.nome.toLowerCase()&&p.ans===item.ans);
        if(dup) warnings.push('Plano já existe com mesmo nome/ANS');
        item.detail=item.nome; item.extra='ANS '+item.ans;
        break;
      }
      case 'tabela':{
        item.codigo=impGetCell(row,'codigo');
        item.desc=impGetCell(row,'desc');
        item.tipo=impGetCell(row,'tipo')||'Sessão';
        item.valPart=parseFloat((impGetCell(row,'valPart')||'0').replace(',','.'))||0;
        item.valPlano=parseFloat((impGetCell(row,'valPlano')||'0').replace(',','.'))||0;
        item.planoNome=impGetCell(row,'plano');
        if(!item.desc) issues.push('Descrição obrigatória');
        const plano=item.planoNome?PLANOS.find(p=>p.nome.toLowerCase().includes(item.planoNome.toLowerCase())):null;
        item.planoId=plano?.id||0;
        const dup=PROCEDIMENTOS.find(p=>p.codigo===item.codigo&&p.planoId===item.planoId);
        if(dup) warnings.push('Procedimento já existe (será atualizado)');
        item.detail=item.desc; item.extra=(item.codigo||'—')+' · '+item.planoNome;
        break;
      }
      case 'guias':{
        item.num=impGetCell(row,'num');
        item.pac=impGetCell(row,'pac');
        item.planoNome=impGetCell(row,'plano');
        item.dataStr=impGetCell(row,'data');
        item.valorStr=impGetCell(row,'valor');
        item.status=impGetCell(row,'status')||'Pendente';
        item.carteirinha=impGetCell(row,'carteirinha');
        item.cid=impGetCell(row,'cid');
        if(!item.pac) issues.push('Paciente obrigatório');
        item.dataISO=parseISODate(item.dataStr);
        const plano=item.planoNome?PLANOS.find(p=>p.nome.toLowerCase().includes(item.planoNome.toLowerCase())):null;
        if(item.planoNome&&!plano) warnings.push('Plano não encontrado (usará Particular)');
        item.planoObj=plano;
        const pac=PACIENTES.find(p=>p.nome.toLowerCase()===item.pac.toLowerCase());
        if(!pac) warnings.push('Paciente não encontrado no cadastro');
        item.pacObj=pac;
        const prof=pac?PROFISSIONAIS[0]:null;
        item.profId=prof?.id||1;
        item.valor=parseFloat(item.valorStr?.replace(/[R$\s]/g,'').replace(',','.'))||0;
        item.detail=item.pac; item.extra=item.planoNome+' · R$ '+item.valorStr;
        break;
      }
      case 'senhas':{
        item.paciente=impGetCell(row,'paciente');
        item.planoNome=impGetCell(row,'plano');
        item.numSenha=impGetCell(row,'numSenha');
        // Datas: suporta dd/mm (ano corrente) e dd/mm/yyyy
        item.dataAut=parseISODate(impGetCell(row,'dataAut')) || null;
        item.validade=parseISODate(impGetCell(row,'validade')) || null;
        item.qtdAut=parseInt(impGetCell(row,'qtdAut'))||10;
        item.carteirinha=impGetCell(row,'carteirinha');
        item.numGuiaOp=impGetCell(row,'numGuiaOp');
        item.cid=impGetCell(row,'cid');
        item.codigoProc=impGetCell(row,'codigoProc');   // código TUSS separado
        item.procedimento=impGetCell(row,'procedimento'); // descrição do procedimento
        if(!item.paciente) issues.push('Paciente obrigatório');
        if(!item.numSenha) issues.push('Número da senha obrigatório');
        if(item.dataAut) {
          const d=new Date(item.dataAut+'T00:00:00');
          if(isNaN(d)) issues.push('Data de autorização inválida: '+impGetCell(row,'dataAut'));
        }
        if(item.validade) {
          const d=new Date(item.validade+'T00:00:00');
          if(isNaN(d)) issues.push('Data de validade inválida: '+impGetCell(row,'validade'));
        }
        const plano=item.planoNome?PLANOS.find(p=>p.nome.toLowerCase().includes(item.planoNome.toLowerCase())):null;
        if(!plano&&item.planoNome) warnings.push('Plano não encontrado');
        item.planoObj=plano;
        const dup=SENHAS_PLANO.find(s=>s.paciente===item.paciente&&s.numSenha===item.numSenha);
        if(dup) warnings.push('Senha já cadastrada');
        item.detail=item.paciente; item.extra='Senha '+item.numSenha+(item.dataAut?' · Aut:'+item.dataAut.split('-').reverse().join('/'):'')+(item.validade?' · Val:'+item.validade.split('-').reverse().join('/'):'');
        break;
      }
    }
    status = issues.length?'err':warnings.length?'warn':'ok';
    return {rowIdx:idx, status, issues, warnings, ...item};
  });
}

// ── Preview UI ─────────────────────────────────────────────────────────────────
function buildPreviewUI() {
  const ok   = impParsed.filter(r=>r.status==='ok').length;
  const warn = impParsed.filter(r=>r.status==='warn').length;
  const err  = impParsed.filter(r=>r.status==='err').length;
  document.getElementById('imp-badge-ok').textContent   = '✓ '+ok;
  document.getElementById('imp-badge-warn').textContent = '⚠ '+warn;
  document.getElementById('imp-badge-err').textContent  = '✗ '+err;
  document.getElementById('imp-preview-summary').textContent =
    impParsed.length+' linhas analisadas — '+ok+' ok, '+warn+' avisos, '+err+' erros';
  impFilterPreview('all', document.querySelector('.imp-tab'));
}
function impFilterPreview(filter, btnEl) {
  impFilter=filter;
  document.querySelectorAll('.imp-tab').forEach(b=>b.classList.remove('active'));
  if(btnEl) btnEl.classList.add('active');
  const rows=filter==='all'?impParsed:impParsed.filter(r=>r.status===filter);
  const tbody=document.getElementById('imp-preview-tbody');
  if(!tbody) return;
  tbody.innerHTML=rows.map(r=>{
    const icon=r.status==='ok'?'✓':r.status==='warn'?'⚠':'✗';
    const cls ='imp-row-'+r.status;
    const sc  ='imp-status-'+r.status;
    const allIssues=[...r.issues,...r.warnings];
    return '<tr class="'+cls+'">' +
      '<td style="text-align:center"><span class="'+sc+'">'+icon+'</span></td>' +
      '<td style="font-weight:500">'+( r.detail||'—')+'</td>' +
      '<td style="font-size:12px;color:var(--text-muted)">'+( r.extra||'—')+'</td>' +
      '<td><span class="'+sc+'">'+icon+' '+(r.status==='ok'?'Pronto':r.status==='warn'?'Aviso':'Erro')+'</span>'+
        (allIssues.length?'<div class="imp-issues">'+allIssues.join(' · ')+'</div>':'')+'</td>' +
      '</tr>';
  }).join('') || '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-muted)">Nenhum item neste filtro</td></tr>';
}

// ── Confirm import ────────────────────────────────────────────────────────────
async function impConfirmar() {
  // Para agenda: verifica se há pacientes não encontrados e abre modal de correção primeiro
  if (IMP_TIPO === 'agenda') {
    const naoEncontrados = impParsed.filter(r =>
      r.status !== 'err' && r._precisaCorrecao && !r._corrigido && !r._ignorar
    );
    if (naoEncontrados.length > 0) {
      // Adiciona índice de linha para exibição
      naoEncontrados.forEach((r, i) => { r._rowIdx = i; });
      corrPacAbrir(naoEncontrados, () => _impConfirmarExecutar());
      return;
    }
  }
  await _impConfirmarExecutar();
}

async function _impConfirmarExecutar() {
  const skipErr=document.getElementById('imp-skip-errors').checked;
  const toImport=skipErr?impParsed.filter(r=>r.status!=='err'):impParsed;
  let imported=0, skipped=0, dbErrors=0;
  const detalhes=[];
  const type=IMP_TIPO;
  const cores=['#4f8ef7','#34d399','#f59e0b','#a78bfa','#fb923c','#f87171','#38bdf8','#e879f9'];

  // Desabilita botão durante processamento
  const btn=document.querySelector('#imp-panel-3 .btn-accent');
  if(btn){btn.disabled=true;btn.textContent='Importando...';}

  // Obtém cliente Supabase — tenta 3 estratégias em ordem de confiabilidade
  let sb = null;
  try {
    // 1) Cliente já inicializado pelo patch (mais eficiente — reutiliza conexão existente)
    if (window._cfGetDb) sb = window._cfGetDb();
    // 2) Fallback: usa singleton global (nunca cria segundo GoTrueClient)
    if (!sb) {
      const _url = localStorage.getItem('cf_supa_url');
      const _key = localStorage.getItem('cf_supa_key');
      if (_url && _key) {
        sb = window.__cfSb
          || (window._cfGetOrCreateClient ? window._cfGetOrCreateClient(_url, _key) : null);
      }
    }
  } catch(e) { console.error('[Import] Erro ao obter cliente Supabase:', e); }

  if (sb) {
    console.log('[Import] Supabase conectado ✓ — dados serão gravados no banco');
  } else {
    console.warn('[Import] Supabase não disponível — gravando somente em memória local');
    showToast('Supabase não conectado — dados salvos só em memória. Verifique as configurações.', 'error');
  }

  // Helper: INSERT no Supabase — retorna o id real do banco
  async function sbInsert(table, row) {
    if(!sb) return null;
    try {
      const {data,error}=await sb.from(table).insert([row]).select('id').single();
      if(error) { console.error('[Import INSERT]',table,error.message,JSON.stringify(row)); dbErrors++; return null; }
      return data.id;
    } catch(e){ console.error('[Import INSERT exception]',table,e); dbErrors++; return null; }
  }
  // Helper: UPDATE no Supabase por id
  async function sbUpdate(table, row, id) {
    if(!sb) return;
    try {
      const {error}=await sb.from(table).update(row).eq('id',id);
      if(error) { console.error('[Import UPDATE]',table,error.message,JSON.stringify(row)); dbErrors++; }
    } catch(e){ console.error('[Import UPDATE exception]',table,e); dbErrors++; }
  }

  for(const r of toImport){
    if(r.status==='err'&&skipErr){skipped++;continue;}
    try{
      switch(type){
        case 'pacientes':{
          // Converte data dd/mm/aaaa → yyyy-mm-dd para o banco
          const nascISO = parseISODate(r.nasc) || null;
          // Só envia plano_id se o plano realmente existe no banco (evita FK violation)
          const planoExiste = PLANOS.find(p=>p.id===r.planoId && r.planoId !== 5);
          const dbPlanoId = planoExiste ? r.planoId : null;
          const dup=PACIENTES.find(p=>p.nome.toLowerCase()===r.nome.toLowerCase());
          if(dup){
            const nascDupISO = parseISODate(r.nasc||dup.nasc) || dup.nasc || null;
            const updPlanoExiste = PLANOS.find(p=>p.id===(r.planoId||dup.planoId) && (r.planoId||dup.planoId) !== 5);
            const updDbPlanoId = updPlanoExiste ? (r.planoId||dup.planoId) : null;
            const upd={nasc:r.nasc||dup.nasc,cpf:r.cpf||dup.cpf,tel:r.tel||dup.tel,
              email:r.email||dup.email,planoId:r.planoId||dup.planoId,plano:r.plano||dup.plano,
              carteirinha:r.carteirinha||dup.carteirinha,end:r.end||dup.end,sexo:r.sexo||dup.sexo};
            Object.assign(dup,upd);
            await sbUpdate('pacientes',{nome:dup.nome,nasc:nascDupISO,cpf:dup.cpf||null,
              tel:dup.tel||null,email:dup.email||null,end:dup.end||null,
              plano_id:updDbPlanoId,plano:dup.plano,
              carteirinha:dup.carteirinha||null,sexo:dup.sexo||null},dup.id);
          } else {
            const obj={id:nextPacId++,nome:r.nome,nasc:r.nasc||'',cpf:r.cpf||'',
              tel:r.tel||'',email:r.email||'',planoId:r.planoId,plano:r.plano,
              carteirinha:r.carteirinha||'—',end:r.end||'',sexo:r.sexo||'',obs:r.obs||'',status:'Ativo',ultima:''};
            const dbId=await sbInsert('pacientes',{nome:obj.nome,nasc:nascISO,cpf:obj.cpf||null,
              tel:obj.tel||null,email:obj.email||null,end:obj.end||null,
              plano_id:dbPlanoId,plano:obj.plano,
              carteirinha:obj.carteirinha||null,sexo:obj.sexo||null,status:'Ativo'});
            if(dbId) obj.id=dbId;
            PACIENTES.push(obj);
          }
          break;
        }
        case 'profissionais':{
          const dup=PROFISSIONAIS.find(p=>p.nome.toLowerCase()===r.nome.toLowerCase());
          if(dup){
            const upd={nomeAgenda:r.nomeAgenda||dup.nomeAgenda,esp:r.esp||dup.esp,
              conselho:r.conselho||dup.conselho,num:r.num||dup.num,uf:r.uf||dup.uf,
              cbo:r.cbo||dup.cbo,tel:r.tel||dup.tel,email:r.email||dup.email};
            Object.assign(dup,upd);
            await sbUpdate('profissionais',{nome:dup.nome,nome_agenda:dup.nomeAgenda||null,
              esp:dup.esp||null,conselho:dup.conselho||null,num:dup.num||null,uf:dup.uf||'SP',
              cbo:dup.cbo||null,tel:dup.tel||null,email:dup.email||null,cor:dup.cor||'#4f8ef7',status:dup.status||'Ativo'},dup.id);
          } else {
            const obj={id:nextPrfId++,nome:r.nome,nomeAgenda:r.nomeAgenda||r.nome.split(' ')[0],
              esp:r.esp||'',conselho:r.conselho||'',num:r.num||'',uf:r.uf||'SP',cbo:r.cbo||'',
              tel:r.tel||'',email:r.email||'',cor:r.cor||cores[PROFISSIONAIS.length%cores.length],status:'Ativo'};
            const dbId=await sbInsert('profissionais',{nome:obj.nome,nome_agenda:obj.nomeAgenda||null,
              esp:obj.esp||null,conselho:obj.conselho||null,num:obj.num||null,uf:obj.uf||'SP',
              cbo:obj.cbo||null,tel:obj.tel||null,email:obj.email||null,cor:obj.cor,status:'Ativo'});
            if(dbId) obj.id=dbId;
            PROFISSIONAIS.push(obj); activeProfFilters.add(obj.id);
          }
          break;
        }
        case 'agenda':{
          if (r.dup) { skipped++; continue; } // duplicata — ignora
          if (r._ignorar) { skipped++; continue; } // ignorado pelo usuário na correção

          // ── Paciente: usa o encontrado/corrigido; pula se não encontrado ──────
          let pac = r.pac;
          if (!pac) {
            // Se chegou até aqui sem pac e sem correção, ignora a linha
            detalhes.push('<span style="color:var(--warning)">⚠ Pulado — paciente "'+r.paciente+'" não encontrado</span>');
            skipped++; continue;
          }

          // ── Profissional: usa existente ou cria novo ───────────────────────
          let prof = r.prof;
          if (!prof && r.terapNome) {
            const primeiroNome = r.terapNome.split(/\s+/)[0];
            prof = {
              id: nextPrfId++, nome: r.terapNome,
              nomeAgenda: primeiroNome,
              esp:'', conselho:'', num:'', uf:'SP', cbo:'',
              cor: cores[PROFISSIONAIS.length % cores.length], status:'Ativo',
            };
            const dbId = await sbInsert('profissionais', {
              nome: prof.nome, nome_agenda: prof.nomeAgenda, cor: prof.cor, status:'Ativo',
            });
            if (dbId) prof.id = dbId;
            PROFISSIONAIS.push(prof);
            activeProfFilters.add(prof.id);
          }
          if (!prof) { skipped++; continue; }

          // ── Plano ──────────────────────────────────────────────────────────
          const planoObj = r.planoNome
            ? PLANOS.find(p => p.nome.toLowerCase().includes(r.planoNome.toLowerCase())) : null;

          // ── Objeto do agendamento ──────────────────────────────────────────
          const apptObj = {
            id:        nextPacId++,
            profId:    prof.id,
            paciente:  pac.nome,  // usa nome real do paciente cadastrado
            plano:     planoObj?.nome || r.planoNome || 'Particular',
            planoId:   planoObj?.id   || 5,
            hora:      r.horaIni || '08:00',
            horaFim:   r.horaFim || '',
            durMin:    r.durMin  || 30,
            dataISO:   r.dataISO || '',
            status:    'agendado',
            obs:       [r.tipo, r.processo, r.semana].filter(Boolean).join(' · ') || '',
            modalidade: r.modalidade || 'presencial',
            meetLink:  '',
            guia:      null,
            waSent:    false,
            carteirinha: '',
          };

          const dbId = await sbInsert('agendamentos', {
            prof_id:    apptObj.profId,
            paciente:   apptObj.paciente,
            plano:      apptObj.plano,
            plano_id:   apptObj.planoId !== 5 ? apptObj.planoId : null,
            hora:       apptObj.hora,
            hora_fim:   apptObj.horaFim || null,
            dur_min:    apptObj.durMin,
            data_iso:   apptObj.dataISO,
            status:     apptObj.status,
            obs:        apptObj.obs || null,
            modalidade: apptObj.modalidade,
            wa_sent:    false,
          });
          if (dbId) apptObj.id = dbId;
          APPOINTMENTS.push(apptObj);

          // Atualiza última consulta do paciente
          if (pac) pac.ultima = r.dataStr || '';

          // Atualiza qtdUsada da senha se houver plano ativo
          if (apptObj.planoId && apptObj.planoId !== 5) {
            const senhaImp = SENHAS_PLANO.find(s =>
              s.ativa && s.planoId === apptObj.planoId &&
              s.paciente.toLowerCase() === apptObj.paciente.toLowerCase() &&
              s.qtdUsada < s.qtdAutorizada
            );
            if (senhaImp) {
              senhaImp.qtdUsada = (senhaImp.qtdUsada||0) + 1;
              if (senhaImp.qtdUsada >= senhaImp.qtdAutorizada) {
                senhaImp.status = 'Usada'; senhaImp.ativa = false;
              }
              await sbUpdate('senhas_plano', {
                qtd_usada: senhaImp.qtdUsada, status: senhaImp.status, ativa: senhaImp.ativa
              }, senhaImp.id);
            }
          }
          break;
        }
        case 'anamnese':{
          const pac=r.pac||(r.nomePac?encontrarPacientePorNome(r.nomePac):null);
          if(!pac){skipped++;continue;}
          const hObj={id:nextHistId++,pacId:pac.id,tipo:'anamnese',
            titulo:'Anamnese importada — '+r.nomePac,conteudo:r.conteudo,
            data:new Date().toISOString().slice(0,10),fonte:'Importação CSV'};
          const dbId=await sbInsert('historico',{pac_id:pac.id,tipo:'anamnese',
            titulo:hObj.titulo,conteudo:hObj.conteudo,data:hObj.data,fonte:'Importação CSV'});
          if(dbId) hObj.id=dbId;
          HISTORICO.push(hObj);
          break;
        }
        case 'evolucoes':{
          const pac = r.pac;
          if (!pac) { skipped++; continue; }
          if (r.dup)  { skipped++; continue; } // ignora duplicatas
          const pi = evoPresencaInfo(r.presenca);
          const dateFmt = r.dataISO ? r.dataISO.split('-').reverse().join('/') : r.dataStr;
          const titulo = pi.icon + ' Sessão — ' + dateFmt +
            (r.horaIni ? ' · '+r.horaIni : '') +
            (r.semana  ? ' · '+r.semana  : '');
          const appt = APPOINTMENTS.find(a =>
            a.paciente===pac.nome &&
            ((r.dataISO && a.dataISO===r.dataISO) || (r.horaIni && a.hora===r.horaIni && a.paciente===pac.nome))
          );
          const hObj = {
            id: nextHistId++, pacId: pac.id, tipo: 'evolucao', titulo,
            conteudo: {
              texto:    r.evolucao  || '',
              presenca: r.presenca  || '',
              horaIni:  r.horaIni   || '',
              horaFim:  r.horaFim   || '',
              duracao:  r.durStr    || '',
              convenio: r.convNome  || '',
              semana:   r.semana    || '',
            },
            profId: appt?.profId || 0,
            data:   r.dataISO || r.dataStr,
            fonte:  'Google Sheets',
            apptId: appt?.id || null,
          };
          const dbId = await sbInsert('historico', {
            pac_id: pac.id, tipo:'evolucao', titulo: hObj.titulo,
            conteudo: hObj.conteudo, prof_id: hObj.profId||null,
            data: hObj.data, fonte:'Google Sheets',
          });
          if (dbId) hObj.id = dbId;
          HISTORICO.push(hObj);
          if (appt && pi.status && appt.status !== pi.status) {
            appt.status = pi.status;
            await sbUpdate('agendamentos', { status: pi.status }, appt.id);
          }
          break;
        }
        case 'planos':{
          const dup=PLANOS.find(p=>p.nome.toLowerCase()===r.nome.toLowerCase()&&p.ans===r.ans);
          if(dup){
            const upd={cnpj:r.cnpj||dup.cnpj,tabela:r.tabela||dup.tabela,
              codPrestador:r.codPrestador||dup.codPrestador,nomeContratado:r.nomeContratado||dup.nomeContratado,
              cnes:r.cnes||dup.cnes};
            Object.assign(dup,upd);
            await sbUpdate('planos_saude',{nome:dup.nome,cnpj:dup.cnpj||null,ans:dup.ans||null,
              tabela:dup.tabela||'CBHPM',cod_prestador:dup.codPrestador||null,
              nome_contratado:dup.nomeContratado||null,cnes:dup.cnes||null},dup.id);
          } else {
            const obj={id:nextPlId++,nome:r.nome,nomeGuia:r.nome.toUpperCase(),
              cnpj:r.cnpj||'',ans:r.ans||'',tabela:r.tabela||'CBHPM',
              codPrestador:r.codPrestador||'',nomeContratado:r.nomeContratado||'',
              cnes:r.cnes||'',tel:r.tel||'',status:'Ativo',pacientes:0,
              usaTiss:true,aplicaTodos:true,versaoTiss:'4.02.00',tipoId:'Código',numGuiaInicial:1};
            const dbId=await sbInsert('planos_saude',{nome:obj.nome,nome_guia:obj.nomeGuia,
              cnpj:obj.cnpj||null,ans:obj.ans||null,tabela:obj.tabela,cod_prestador:obj.codPrestador||null,
              nome_contratado:obj.nomeContratado||null,cnes:obj.cnes||null,tel:obj.tel||null,
              status:'Ativo',usa_tiss:true,aplica_todos:true,versao_tiss:'4.02.00',
              tipo_id:'Código',num_guia_inicial:1,pacientes:0});
            if(dbId) obj.id=dbId;
            PLANOS.push(obj);
          }
          break;
        }
        case 'tabela':{
          const dup=PROCEDIMENTOS.find(p=>p.codigo===r.codigo&&p.planoId===r.planoId);
          if(dup){
            const upd={desc:r.desc||dup.desc,tipo:r.tipo||dup.tipo,
              valPart:r.valPart||dup.valPart,valPlano:r.valPlano||dup.valPlano};
            Object.assign(dup,upd);
            await sbUpdate('procedimentos',{descricao:dup.desc,tipo:dup.tipo,
              val_part:dup.valPart,val_plano:dup.valPlano},dup.id);
          } else {
            const obj={id:nextProcId++,codigo:r.codigo||'',desc:r.desc,
              descCurta:r.desc.substring(0,20),tipo:r.tipo||'Sessão',
              valPart:r.valPart,valPlano:r.valPlano,tabela:'TUSS',
              planoId:r.planoId||0,status:'Ativo',obs:''};
            const dbId=await sbInsert('procedimentos',{codigo:obj.codigo||null,descricao:obj.desc,
              desc_curta:obj.descCurta,tipo:obj.tipo,val_part:obj.valPart,
              val_plano:obj.valPlano,tabela:'TUSS',plano_id:obj.planoId,status:'Ativo'});
            if(dbId) obj.id=dbId;
            PROCEDIMENTOS.push(obj);
            if(r.codigo) TUSS_TABLE[r.codigo]={desc:r.desc,valor:r.valPlano};
          }
          break;
        }
        case 'guias':{
          const pac=r.pacObj;
          const plano=r.planoObj||PLANOS.find(p=>p.nome==='Particular');
          const profId=pac?APPOINTMENTS.find(a=>a.paciente===pac.nome)?.profId||1:1;
          const obj={id:nextGuiaId++,num:r.num||('G'+Date.now().toString().slice(-6)),
            pac:r.pac,planoId:plano?.id||5,plano:plano?.nome||'Particular',
            profId,valor:r.valor,status:r.status||'Pendente',
            data:r.dataISO||'',loteId:null,carteirinha:r.carteirinha||'',cid:r.cid||'',dados:{}};
          const dbId=await sbInsert('guias_sadt',{num:obj.num,pac:obj.pac,plano_id:obj.planoId,
            plano:obj.plano,prof_id:obj.profId,valor:obj.valor,status:obj.status,
            data:obj.data||null,carteirinha:obj.carteirinha||null,cid:obj.cid||null,dados:{}});
          if(dbId) obj.id=dbId;
          GUIAS.push(obj);
          break;
        }
        case 'senhas':{
          const plano=r.planoObj;
          if(!plano){skipped++;continue;}
          // Monta procs com código TUSS e descrição separados
          let procs = [];
          if (r.codigoProc || r.procedimento) {
            procs = [{ codigo: r.codigoProc || '', desc: r.procedimento || '' }];
          }
          const obj={id:nextSenhaId++,planoId:plano.id,paciente:r.paciente,
            carteirinha:r.carteirinha||'',numGuiaOp:r.numGuiaOp||'',numSenha:r.numSenha,
            dataAut: r.dataAut || null,
            validade: r.validade || null,
            qtdAutorizada:r.qtdAut,qtdUsada:0,cid:r.cid||'',
            procs,
            status:'Ativa',ativa:true,obs:''};
          const dbId=await sbInsert('senhas_plano',{plano_id:obj.planoId,paciente:obj.paciente,
            carteirinha:obj.carteirinha||null,num_guia_op:obj.numGuiaOp||null,num_senha:obj.numSenha,
            data_aut:obj.dataAut,validade:obj.validade,qtd_autorizada:obj.qtdAutorizada,
            qtd_usada:0,cid:obj.cid||null,procs:obj.procs,status:'Ativa',ativa:true});
          if(dbId) obj.id=dbId;
          SENHAS_PLANO.push(obj);
          break;
        }
      }
      imported++;
      detalhes.push(r.detail||(r.nome||r.pac||r.paciente||'Linha '+(r.rowIdx+2)));
    } catch(e){ skipped++; console.warn('Import error row',r.rowIdx,e); }
  }

  if(btn){btn.disabled=false;btn.textContent='Confirmar importação';}

  // Refresh central — atualiza todos os módulos afetados
  refreshUI();

  // Show result
  const schema=IMP_SCHEMAS[type];
  impGoStep(4);
  document.getElementById('imp-result-icon').textContent = imported>0?'✅':'⚠️';
  document.getElementById('imp-result-title').textContent = imported>0?'Importação concluída!':'Nada importado';
  let resultMsg = imported+' '+schema.label.toLowerCase()+' importado(s) · '+skipped+' pulado(s)';
  if (sb && dbErrors === 0) resultMsg += ' · ✓ gravado no Supabase';
  else if (sb && dbErrors > 0) resultMsg += ' · ⚠ '+dbErrors+' erro(s) ao gravar no banco (ver console)';
  else resultMsg += ' · ⚠ apenas memória local — Supabase não conectado';
  document.getElementById('imp-result-msg').textContent = resultMsg;
  document.getElementById('imp-result-details').innerHTML =
    '<div style="font-weight:600;margin-bottom:8px;color:var(--text-secondary)">Registros importados:</div>'+
    (detalhes.length?detalhes.slice(0,30).map(d=>'<div style="padding:2px 0;border-bottom:1px solid var(--border)">'+d+'</div>').join('')+
      (detalhes.length>30?'<div style="color:var(--text-muted);margin-top:4px">...e mais '+(detalhes.length-30)+'</div>':''):
    '<div style="color:var(--text-muted)">Nenhum registro importado.</div>');

  if(imported>0) showToast(imported+' '+schema.label+' importado(s)!','success');
  else showToast('Nenhum dado importado.','error');
}

function impGoModulo() {
  const schema=IMP_SCHEMAS[IMP_TIPO];
  const navEl=document.querySelector('.nav-item[onclick*="\''+schema.modulo+'\'"]');
  if(navEl) gotoPage(schema.modulo, navEl);
}

function impGoStep(n) {
  [1,2,3,4].forEach(i=>{
    const p=document.getElementById('imp-panel-'+i);
    if(p) p.style.display=i===n?'block':'none';
    const s=document.getElementById('imp-step-'+i);
    if(s){ s.classList.remove('active','done'); if(i<n)s.classList.add('done'); if(i===n)s.classList.add('active'); }
  });
}

function impReset() {
  impRawRows=[]; impHeaders=[]; impMapping={}; impParsed=[]; impFilter='all';
  const paste=document.getElementById('imp-csv-paste'); if(paste) paste.value='';
  const fi=document.getElementById('imp-file-input'); if(fi) fi.value='';
  impGoStep(1);
}

