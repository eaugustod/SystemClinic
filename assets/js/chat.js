//  CHAT COM PACIENTES — abre painel em nova aba
//  Passa os dados reais de agendamento via Blob URL
// ═══════════════════════════════════════════════════════════════

function abrirPainelChat() {
  const snapshot = {
    appointments : (typeof APPOINTMENTS   !== 'undefined') ? APPOINTMENTS   : [],
    pacientes    : (typeof PACIENTES      !== 'undefined') ? PACIENTES      : [],
    profissionais: (typeof PROFISSIONAIS  !== 'undefined') ? PROFISSIONAIS  : [],
    planos       : (typeof PLANOS         !== 'undefined') ? PLANOS         : [],
    clinicaNome  : (typeof CLINICA !== 'undefined' && CLINICA?.nome) ? CLINICA.nome : 'Clínica',
    geradoEm     : new Date().toISOString(),
  };

  
  const html = _buildChatPanelHTML(snapshot);
  const blob  = new Blob([html], { type: 'text/html' });
  const url   = URL.createObjectURL(blob);
  const win   = window.open(url, '_blank');
  if (!win) showToast('Permita pop-ups para abrir o painel de chat', 'error');
  else      showToast('Painel de chat aberto em nova aba ↗', 'success');
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

function _buildChatPanelHTML(snap) {
  const appts    = snap.appointments  || [];
  const pacs     = snap.pacientes     || [];
  const profs    = snap.profissionais || [];
  const clinNome = snap.clinicaNome   || 'Clínica';

  const ini    = n => n.split(' ').slice(0,2).map(w => w[0]||'').join('').toUpperCase();
  const colors = ['#4f8ef7','#34d399','#fbbf24','#f87171','#a78bfa','#60a5fa','#fb923c'];
  const today  = new Date().toISOString().slice(0,10);
  const fmtD   = iso => iso ? new Date(iso+'T12:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'}) : '';

  const pacMap = {};
  appts.forEach(a => { if (a.paciente) { const k=a.paciente.trim(); if(!pacMap[k]) pacMap[k]={nome:k,temAgenda:true}; else pacMap[k].temAgenda=true; } });
  pacs.forEach(p  => { if (p.nome && !pacMap[p.nome]) pacMap[p.nome]={nome:p.nome,temAgenda:false}; });
  const pacList = Object.values(pacMap).sort((a,b)=>(b.temAgenda-a.temAgenda)||a.nome.localeCompare(b.nome));

  const proxFor = nome => {
    const f = appts.filter(a=>a.paciente===nome&&a.dataISO>=today&&!['cancelado','desmarcado'].includes(a.status));
    f.sort((a,b)=>a.dataISO.localeCompare(b.dataISO));
    return f[0]||null;
  };

  const pacRows = pacList.map((p,i) => {
    const prox  = proxFor(p.nome);
    const prev  = prox ? 'Prox: '+fmtD(prox.dataISO)+' '+(prox.hora||'') : 'Sem consulta agendada';
    const color = colors[i%colors.length];
    const tag   = prox ? '<div class="pac-tag">Agendado<\/div>' : '';
    const safeNome = p.nome.replace(/"/g,'&quot;');
    return '<div class="pac-item" data-nome="'+safeNome+'" onclick="selectPac(this)" style="--c:'+color+'">'
         + '<div class="pac-av" style="background:'+color+'22;color:'+color+'">'+ini(p.nome)+'<\/div>'
         + '<div class="pac-info"><div class="pac-name">'+p.nome+'<\/div><div class="pac-prev">'+prev+'<\/div><\/div>'
         + tag + '<\/div>';
  }).join('');

  // Snapshot serializado — sem <\/script> problematico
  const snapJSON = JSON.stringify(snap).replace(/<\/script>/gi,'<\\/script>');

  // CSS do painel
  const css = [
    ':root{--bg:#0f1117;--surface:#161b27;--raised:#1e2535;--border:rgba(255,255,255,0.07);--border-mid:rgba(255,255,255,0.12);',
    '--text:#eef0f6;--muted:#8b92a8;--dim:#555d74;--accent:#4f8ef7;--success:#34d399;--warn:#fbbf24;--danger:#f87171;',
    '--r:10px;--rs:6px;--tr:0.18s cubic-bezier(.4,0,.2,1);}',
    '*{box-sizing:border-box;margin:0;padding:0;}',
    'html,body{height:100%;overflow:hidden;font-family:\'DM Sans\',sans-serif;font-size:14px;background:var(--bg);color:var(--text);}',
    'button{cursor:pointer;border:none;background:none;font-family:inherit;}input,select,textarea{font-family:inherit;}',
    '.wrap{display:flex;height:100vh;overflow:hidden;}',
    '.list-col{width:280px;min-width:280px;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;}',
    '.list-head{padding:14px 14px 10px;border-bottom:1px solid var(--border);flex-shrink:0;}',
    '.list-head h2{font-size:14px;font-weight:600;margin-bottom:10px;display:flex;align-items:center;gap:7px;}',
    '.list-head h2 svg{width:16px;height:16px;fill:var(--accent);}',
    '.search-box{position:relative;}.search-box input{width:100%;padding:7px 10px 7px 30px;background:var(--raised);border:1px solid var(--border);border-radius:var(--rs);color:var(--text);font-size:12.5px;outline:none;transition:border var(--tr);}',
    '.search-box input::placeholder{color:var(--dim);}.search-box input:focus{border-color:var(--accent);}',
    '.search-box svg{position:absolute;left:9px;top:50%;transform:translateY(-50%);width:13px;height:13px;fill:var(--dim);pointer-events:none;}',
    '.list-body{flex:1;overflow-y:auto;}',
    '.pac-item{display:flex;align-items:center;gap:9px;padding:10px 13px;border-bottom:1px solid var(--border);cursor:pointer;transition:background var(--tr);}',
    '.pac-item:hover{background:var(--raised);}.pac-item.active{background:rgba(79,142,247,0.1);border-left:3px solid var(--accent);}',
    '.pac-av{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;flex-shrink:0;}',
    '.pac-info{flex:1;min-width:0;}.pac-name{font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.pac-prev{font-size:11px;color:var(--muted);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.pac-tag{font-size:10px;font-weight:600;padding:2px 6px;border-radius:99px;background:rgba(52,211,153,0.12);color:var(--success);white-space:nowrap;flex-shrink:0;}',
    '.chat-col{flex:1;display:flex;flex-direction:column;min-width:0;overflow:hidden;}',
    '.empty-state{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--dim);gap:10px;}',
    '.empty-state svg{width:44px;height:44px;fill:var(--dim);opacity:0.35;}.empty-state p{font-size:13px;}',
    '.chat-head{padding:12px 16px;background:var(--surface);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;flex-shrink:0;}',
    '.chat-head .av{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;}',
    '.chat-head-name{font-weight:600;font-size:13.5px;}.chat-head-sub{font-size:11px;color:var(--muted);margin-top:1px;}',
    '.chat-msgs{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:7px;}',
    '.chat-bubble{max-width:72%;padding:8px 12px;border-radius:13px;font-size:13px;line-height:1.45;}',
    '.chat-bubble.clinic{background:var(--accent);color:#fff;align-self:flex-end;border-bottom-right-radius:3px;}',
    '.chat-bubble.patient{background:var(--raised);color:var(--text);align-self:flex-start;border-bottom-left-radius:3px;border:1px solid var(--border);}',
    '.chat-bubble.reminder{background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.2);color:var(--warn);align-self:flex-start;border-bottom-left-radius:3px;max-width:88%;}',
    '.bubble-time{font-size:10px;opacity:0.5;margin-top:3px;display:block;}.chat-bubble.clinic .bubble-time{text-align:right;color:rgba(255,255,255,0.65);}',
    '.chat-input-row{border-top:1px solid var(--border);padding:10px 14px;background:var(--surface);display:flex;gap:8px;align-items:flex-end;flex-shrink:0;}',
    '.chat-input{flex:1;background:var(--raised);border:1px solid var(--border);border-radius:var(--rs);padding:8px 12px;color:var(--text);font-size:13px;resize:none;outline:none;max-height:90px;transition:border var(--tr);line-height:1.4;}',
    '.chat-input:focus{border-color:var(--accent);}.chat-input::placeholder{color:var(--dim);}',
    '.send-btn{width:36px;height:36px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:opacity var(--tr);}',
    '.send-btn:hover{opacity:0.84;}.send-btn svg{width:16px;height:16px;fill:#fff;}',
    '.info-col{width:270px;min-width:270px;background:var(--surface);border-left:1px solid var(--border);display:flex;flex-direction:column;overflow-y:auto;}',
    '.info-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--dim);gap:10px;}',
    '.info-empty svg{width:36px;height:36px;fill:var(--dim);opacity:0.3;}.info-empty p{font-size:12px;}',
    '.info-section{padding:13px 14px;border-bottom:1px solid var(--border);}',
    '.info-section h4{font-size:10.5px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:9px;}',
    '.appt-row{display:flex;align-items:flex-start;gap:7px;margin-bottom:7px;padding:7px 8px;background:var(--raised);border-radius:var(--rs);}',
    '.appt-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;margin-top:5px;}',
    '.appt-detail{font-size:11.5px;line-height:1.5;}.appt-detail strong{display:block;color:var(--text);}.appt-detail span{color:var(--muted);display:block;}',
    '.status-chip{display:inline-block;font-size:9.5px;font-weight:600;padding:1px 6px;border-radius:99px;margin-top:2px;}',
    '.chip-confirmado{background:rgba(52,211,153,0.15);color:var(--success);}.chip-agendado{background:rgba(79,142,247,0.15);color:var(--accent);}',
    '.chip-atendido{background:rgba(139,146,168,0.12);color:var(--muted);}.chip-cancelado{background:rgba(248,113,113,0.12);color:var(--danger);}',
    '.notif-head{padding:12px 14px;border-bottom:1px solid var(--border);font-size:12.5px;font-weight:600;display:flex;align-items:center;gap:7px;}',
    '.notif-head svg{width:14px;height:14px;fill:var(--accent);}',
    '.notif-body{padding:12px 14px;display:flex;flex-direction:column;gap:9px;}',
    '.f-label{font-size:10.5px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:3px;}',
    '.f-select,.f-textarea{width:100%;padding:7px 9px;background:var(--raised);border:1px solid var(--border);border-radius:var(--rs);color:var(--text);font-size:12.5px;outline:none;transition:border var(--tr);}',
    '.f-select:focus,.f-textarea:focus{border-color:var(--accent);}.f-textarea{resize:none;line-height:1.4;}',
    '.btn-notif{width:100%;padding:8px;background:var(--accent);color:#fff;border-radius:var(--rs);font-size:12.5px;font-weight:500;display:flex;align-items:center;justify-content:center;gap:6px;transition:opacity var(--tr);}',
    '.btn-notif:hover{opacity:0.87;}.btn-notif svg{width:13px;height:13px;fill:#fff;}',
    '.toast{position:fixed;bottom:18px;right:18px;background:var(--raised);color:var(--text);padding:9px 15px;border-radius:var(--rs);font-size:12.5px;border:1px solid var(--border-mid);opacity:0;transform:translateY(8px);transition:all .28s;z-index:999;pointer-events:none;}',
    '.toast.show{opacity:1;transform:translateY(0);}.toast.success{border-color:rgba(52,211,153,.35);color:var(--success);}',
  ].join('\n');

  // JS do painel (sem template literals com HTML, sem <\/script> problematico)
  const js = [
    'const SNAP='+snapJSON+';',
    'const APPTS=SNAP.appointments||[];',
    'const PACS=SNAP.pacientes||[];',
    'const PROFS=SNAP.profissionais||[];',
    'const TODAY=new Date().toISOString().slice(0,10);',
    'const COLORS=[\'#4f8ef7\',\'#34d399\',\'#fbbf24\',\'#f87171\',\'#a78bfa\',\'#60a5fa\',\'#fb923c\'];',
    // Supabase — usa variáveis do host que já carregou o SDK
    'var sb=null;',
    'if(typeof supabase!=="undefined"&&typeof SB_URL!=="undefined"&&SB_URL&&!SB_URL.includes("SEU_PROJETO")){',
    '  sb=supabase.createClient(SB_URL,SB_KEY);',
    '}',
    'var realtimeSub=null;',
    'var PAC_META={};',
    'var currentPac=null;',
    'var currentColor="#4f8ef7";',

    // selectPac
    'async function selectPac(el){',
    '  document.querySelectorAll(".pac-item").forEach(i=>i.classList.remove("active"));',
    '  el.classList.add("active");',
    '  currentPac=el.dataset.nome;',
    '  var idx=[...document.querySelectorAll(".pac-item")].indexOf(el);',
    '  currentColor=COLORS[idx%COLORS.length];',
    '  document.getElementById("empty-chat").style.display="none";',
    '  var ca=document.getElementById("chat-area");ca.style.display="flex";',
    '  var ini2=currentPac.split(" ").slice(0,2).map(w=>w[0]||"").join("").toUpperCase();',
    '  var prox=proxFor(currentPac);',
    '  document.getElementById("chat-head").innerHTML=',
    '    \'<div class="av" style="background:\'+currentColor+\'22;color:\'+currentColor+\'">\'+ini2+\'<\/div>\'',
    '    +\'<div><div class="chat-head-name">\'+currentPac+\'<\/div>\'',
    '    +\'<div class="chat-head-sub">\'+( prox?"Prox: "+fmtDate(prox.dataISO)+" "+(prox.hora||""):"Sem consulta agendada")+\'<\/div><\/div>\'',
    '    +\'<div id="conn-dot" style="width:8px;height:8px;border-radius:50%;background:var(--muted);margin-left:auto" title="Conectando..."><\/div>\';',
    '  document.getElementById("info-empty").style.display="none";',
    '  document.getElementById("info-panel").style.display="flex";',
    '  document.getElementById("chat-msgs").innerHTML=\'<div style="text-align:center;color:var(--dim);font-size:12px;padding:30px">Carregando...<\/div>\';',
    '  await loadPacMeta(currentPac);',
    '  await loadAndRenderMsgs();',
    '  subscribeRT();',
    '  renderInfoPanel();',
    '  var prox2=proxFor(currentPac);',
    '  if(prox2) document.getElementById("notif-msg").value=',
    '    "Olá "+currentPac.split(" ")[0]+"! Consulta agendada para "+fmtDate(prox2.dataISO)+" às "+(prox2.hora||"")+"h. Confirma presença?";',
    '}',

    // loadPacMeta
    'async function loadPacMeta(nome){',
    '  if(PAC_META[nome])return;',
    '  if(!sb){PAC_META[nome]={};return;}',
    '  var r=await sb.from("pacientes").select("id").eq("nome",nome).single();',
    '  if(!r.data){PAC_META[nome]={};return;}',
    '  var rc=await sb.from("conversas").select("id").eq("paciente_id",r.data.id).eq("status","ativa").single();',
    '  if(!rc.data){var ni=await sb.from("conversas").insert({paciente_id:r.data.id}).select("id").single();rc={data:ni.data};}',
    '  PAC_META[nome]={pacienteId:r.data.id,conversaId:rc.data?.id||null};',
    '}',

    // loadAndRenderMsgs
    'async function loadAndRenderMsgs(){',
    '  var meta=PAC_META[currentPac];',
    '  var el=document.getElementById("chat-msgs");',
    '  if(!meta||!meta.conversaId){',
    '    el.innerHTML=\'<div style="text-align:center;color:var(--dim);font-size:12px;padding:30px">Configure o Supabase para ver mensagens.<\/div>\';',
    '    return;',
    '  }',
    '  var res=await sb.from("mensagens").select("*").eq("conversa_id",meta.conversaId).order("enviada_em",{ascending:true});',
    '  renderMsgs(res.data||[]);',
    '}',

    // renderMsgs
    'function renderMsgs(msgs){',
    '  var el=document.getElementById("chat-msgs");',
    '  if(!msgs.length){el.innerHTML=\'<div style="text-align:center;color:var(--dim);font-size:12px;margin-top:50px">Nenhuma mensagem ainda.<\/div>\';return;}',
    '  var html=\'<div style="text-align:center;color:var(--dim);font-size:11px;margin-bottom:8px">Hoje<\/div>\';',
    '  msgs.forEach(function(m){',
    '    var t=new Date(m.enviada_em);',
    '    var ts=t.getHours()+":"+String(t.getMinutes()).padStart(2,"0");',
    '    var isC=m.tipo_remetente==="clinica",isS=m.tipo_remetente==="sistema";',
    '    if(isS){html+=\'<div class="chat-bubble reminder"><div style="font-size:9.5px;text-transform:uppercase;letter-spacing:.07em;font-weight:700;margin-bottom:3px;opacity:.65">🔔 Lembrete<\/div>\'+esc(m.conteudo)+\'<span class="bubble-time">\'+ts+\'<\/span><\/div>\';}',
    '    else{var cls=isC?"clinic":"patient";html+=\'<div class="chat-bubble \'+cls+\'">\'+esc(m.conteudo)+\'<span class="bubble-time">\'+ts+\'<\/span><\/div>\';}',
    '  });',
    '  el.innerHTML=html;el.scrollTop=el.scrollHeight;',
    '}',

    // subscribeRT
    'function subscribeRT(){',
    '  if(realtimeSub&&sb)sb.removeChannel(realtimeSub);',
    '  var meta=PAC_META[currentPac];',
    '  if(!sb||!meta||!meta.conversaId)return;',
    '  realtimeSub=sb.channel("clinic-"+meta.conversaId)',
    '    .on("postgres_changes",{event:"INSERT",schema:"public",table:"mensagens",filter:"conversa_id=eq."+meta.conversaId},function(payload){appendBubble(payload.new);})',
    '    .subscribe(function(status){var d=document.getElementById("conn-dot");if(d){d.style.background=status==="SUBSCRIBED"?"var(--success)":"var(--warn)";}});',
    '}',

    // appendBubble
    'function appendBubble(m){',
    '  var el=document.getElementById("chat-msgs");',
    '  var t=new Date(m.enviada_em);',
    '  var ts=t.getHours()+":"+String(t.getMinutes()).padStart(2,"0");',
    '  var isC=m.tipo_remetente==="clinica",isS=m.tipo_remetente==="sistema";',
    '  var div=document.createElement("div");',
    '  if(isS){div.className="chat-bubble reminder";div.innerHTML=\'<div style="font-size:9.5px;text-transform:uppercase;letter-spacing:.07em;font-weight:700;margin-bottom:3px;opacity:.65">🔔 Lembrete<\/div>\'+esc(m.conteudo)+\'<span class="bubble-time">\'+ts+\'<\/span>\';}',
    '  else{div.className="chat-bubble "+(isC?"clinic":"patient");div.innerHTML=esc(m.conteudo)+\'<span class="bubble-time">\'+ts+\'<\/span>\';}',
    '  el.appendChild(div);el.scrollTop=el.scrollHeight;',
    '}',

    // renderInfoPanel
    'function renderInfoPanel(){',
    '  var lista=APPTS.filter(a=>a.paciente===currentPac).sort((a,b)=>b.dataISO.localeCompare(a.dataISO)).slice(0,8);',
    '  var dotMap={confirmado:"#34d399",atendido:"#555d74",agendado:"#4f8ef7",chegou:"#34d399",cancelado:"#f87171",desmarcado:"#f87171"};',
    '  var chipMap={confirmado:"chip-confirmado",atendido:"chip-atendido",agendado:"chip-agendado",chegou:"chip-confirmado",cancelado:"chip-cancelado",desmarcado:"chip-cancelado"};',
    '  var rows=lista.length?lista.map(function(a){',
    '    var st=(a.status||"agendado").toLowerCase();',
    '    return \'<div class="appt-row"><div class="appt-dot" style="background:\'+(dotMap[st]||"#8b92a8")+\'"><\/div>\'',
    '      +\'<div class="appt-detail"><strong>\'+fmtDate(a.dataISO)+" "+(a.hora||"")+\'<\/strong><span>\'+getProfNome(a.profId)+\'<\/span><span>\'+( a.plano||"Particular")+\'<\/span>\'',
    '      +\'<span class="status-chip \'+(chipMap[st]||"chip-atendido")+\'">\'+st+\'<\/span><\/div><\/div>\';',
    '  }).join(""):\'<div style="font-size:12px;color:var(--dim)">Nenhuma consulta.<\/div>\';',
    '  document.getElementById("info-appts").innerHTML=\'<h4>Consultas<\/h4>\'+rows;',
    '}',

    // sendMsg
    'async function sendMsg(){',
    '  var input=document.getElementById("chat-input");',
    '  var text=input.value.trim();',
    '  if(!text||!currentPac)return;',
    '  var meta=PAC_META[currentPac];',
    '  if(!sb||!meta||!meta.conversaId){showToast("Configure o Supabase para enviar mensagens");return;}',
    '  input.disabled=true;',
    '  var res=await sb.from("mensagens").insert({conversa_id:meta.conversaId,tipo_remetente:"clinica",conteudo:text,lida:false});',
    '  if(res.error)showToast("Erro: "+res.error.message);',
    '  else{await sb.from("conversas").update({ultima_mensagem_em:new Date().toISOString()}).eq("id",meta.conversaId);input.value="";input.style.height="auto";showToast("Enviado");}',
    '  input.disabled=false;',
    '}',

    // enviarLembrete
    'async function enviarLembrete(){',
    '  if(!currentPac)return;',
    '  var meta=PAC_META[currentPac];',
    '  var msg=document.getElementById("notif-msg").value.trim();',
    '  var tipo=document.getElementById("notif-tipo").value;',
    '  var quando=document.getElementById("notif-quando").value;',
    '  if(!msg){showToast("Escreva a mensagem");return;}',
    '  if(sb&&meta&&meta.pacienteId){',
    '    var ag;if(quando==="Agora"){ag=new Date();}else if(quando.includes("8h")){ag=new Date();ag.setDate(ag.getDate()+1);ag.setHours(8,0,0,0);}else{ag=new Date();ag.setDate(ag.getDate()+1);ag.setHours(9,0,0,0);}',
    '    await sb.from("notificacoes").insert({paciente_id:meta.pacienteId,titulo:tipo==="lembrete"?"Lembrete de consulta":tipo==="confirmar"?"Confirmação":tipo==="resultado"?"Resultado disponível":"Mensagem da clínica",corpo:msg,tipo:tipo,enviada:quando==="Agora",agendada_para:ag.toISOString()});',
    '    if(quando==="Agora"&&meta.conversaId){await sb.from("mensagens").insert({conversa_id:meta.conversaId,tipo_remetente:"sistema",conteudo:"🔔 "+msg,lida:false});}',
    '  }',
    '  showToast("Lembrete enviado para "+currentPac,"success");',
    '}',

    // filterPacs
    'function filterPacs(q){document.querySelectorAll(".pac-item").forEach(function(el){el.style.display=el.dataset.nome.toLowerCase().includes(q.toLowerCase())?"":"none";});}',

    // helpers
    'function proxFor(nome){var f=APPTS.filter(a=>a.paciente===nome&&a.dataISO>=TODAY&&!["cancelado","desmarcado"].includes(a.status));f.sort((a,b)=>a.dataISO.localeCompare(b.dataISO));return f[0]||null;}',
    'function getProfNome(id){var p=PROFS.find(x=>x.id===id);return p?p.nome:"";}',
    'function fmtDate(iso){if(!iso)return"";return new Date(iso+"T12:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",year:"2-digit"});}',
    'function autoGrow(el){el.style.height="auto";el.style.height=Math.min(el.scrollHeight,90)+"px";}',
    'function onKey(e){if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMsg();}}',
    'function esc(s){return(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\\n/g,"<br>");}',
    'function showToast(msg,type){var t=document.getElementById("toast");t.textContent=msg;t.className="toast"+(type?" "+type:"");t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2800);}',
  ].join('\n');

  // HTML do painel — montado por concatenação, sem template literals aninhados
  var html = '<!DOCTYPE html>\n'
    + '<html lang="pt-BR">\n<head>\n'
    + '<meta charset="UTF-8">\n'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
    + '<title>Chat com Pacientes \u2014 ' + clinNome + '<\/title>\n'
    + '<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">\n'
    // Supabase SDK + config — escapados corretamente
    + '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"><\/script>\n'
    + '<script>\n'
    + 'var SB_URL=typeof window.__SB_URL__!=="undefined"?window.__SB_URL__:"https://ezkfnbrlqnruymhhfeei.supabase.co";\n'
    + 'var SB_KEY=typeof window.__SB_KEY__!=="undefined"?window.__SB_KEY__:"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6a2ZuYnJscW5ydXltaGhmZWVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMjg1MzAsImV4cCI6MjA5MDgwNDUzMH0.llrWSk5Kz-UvTPWY5fpeO7QD-aFaobcvAP9FxH8PhB4";\n'
    + '<\/script>\n'
    + '<style>\n' + css + '\n<\/style>\n<\/head>\n<body>\n'
    // BODY
    + '<div class="wrap">\n'
    // Lista pacientes
    + '  <div class="list-col">\n'
    + '    <div class="list-head">\n'
    + '      <h2><svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"\/><\/svg>Chat com Pacientes<\/h2>\n'
    + '      <div class="search-box"><svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"\/><\/svg><input type="text" placeholder="Buscar paciente..." oninput="filterPacs(this.value)"><\/div>\n'
    + '    <\/div>\n'
    + '    <div class="list-body" id="pac-list">' + pacRows + '<\/div>\n'
    + '  <\/div>\n'
    // Chat
    + '  <div class="chat-col">\n'
    + '    <div class="empty-state" id="empty-chat"><svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"\/><\/svg><p>Selecione um paciente<\/p><\/div>\n'
    + '    <div id="chat-area" style="display:none;flex:1;flex-direction:column;overflow:hidden;height:100%;">\n'
    + '      <div class="chat-head" id="chat-head"><\/div>\n'
    + '      <div class="chat-msgs" id="chat-msgs"><\/div>\n'
    + '      <div class="chat-input-row">\n'
    + '        <textarea class="chat-input" id="chat-input" placeholder="Mensagem..." rows="1" oninput="autoGrow(this)" onkeydown="onKey(event)"><\/textarea>\n'
    + '        <button class="send-btn" onclick="sendMsg()"><svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"\/><\/svg><\/button>\n'
    + '      <\/div>\n'
    + '    <\/div>\n'
    + '  <\/div>\n'
    // Painel direito
    + '  <div class="info-col">\n'
    + '    <div class="info-empty" id="info-empty"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"\/><\/svg><p>Selecione um paciente<\/p><\/div>\n'
    + '    <div id="info-panel" style="display:none;flex-direction:column;flex:1;">\n'
    + '      <div class="info-section" id="info-appts"><\/div>\n'
    + '      <div class="notif-head"><svg viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"\/><\/svg>Enviar lembrete<\/div>\n'
    + '      <div class="notif-body">\n'
    + '        <div><div class="f-label">Tipo<\/div><select class="f-select" id="notif-tipo"><option value="lembrete">Lembrete de consulta<\/option><option value="confirmar">Confirmar agendamento<\/option><option value="resultado">Resultado disponível<\/option><option value="livre">Mensagem livre<\/option><\/select><\/div>\n'
    + '        <div><div class="f-label">Mensagem<\/div><textarea class="f-textarea" id="notif-msg" rows="3" placeholder="Texto..."><\/textarea><\/div>\n'
    + '        <div><div class="f-label">Enviar em<\/div><select class="f-select" id="notif-quando"><option>Agora<\/option><option>Amanhã às 8h<\/option><option>Amanhã às 9h<\/option><\/select><\/div>\n'
    + '        <button class="btn-notif" onclick="enviarLembrete()"><svg viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"\/><\/svg>Enviar notificação<\/button>\n'
    + '      <\/div>\n'
    + '    <\/div>\n'
    + '  <\/div>\n'
    + '<\/div>\n'
    + '<div class="toast" id="toast"><\/div>\n'
    + '<script>\n' + js + '\n<\/script>\n'
    + '<\/body>\n<\/html>';

  return html;
}

console.log('[ClinicFlow] Módulo Usuários & Webcam carregado ✓');
