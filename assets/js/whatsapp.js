// ═══════════════════════════════════════
//  WHATSAPP — MÓDULO COMPLETO
// ═══════════════════════════════════════

// ── Config state ─────────────────────────────────────────────────────────────
let WA_CONFIG = {
  method:      'link',        // 'link' | 'api'
  canal:       'whatsapp',    // 'whatsapp' | 'chat'
  evoUrl:      '',
  evoKey:      '',
  evoInstance: 'clinica',
  evoPhone:    '',
  connected:   false,
};

// ── Notificação automática ao agendar ─────────────────────────────────────────
// Notificação automática — canal WhatsApp: abre o modal já preenchido (sincrono, sem popup-blocker)
// canal Chat: envia via Supabase de forma assíncrona
function enviarNotifAgendamento(dados) {
  if (WA_CONFIG.canal === 'chat') {
    _enviarNotifChat(dados);   // async internamente
  } else {
    // WhatsApp — abre o modal padrão já preenchido, 1 clique para enviar
    // Usa setTimeout(0) para rodar após fechar o modal de agendamento
    setTimeout(() => {
      if (typeof abrirModalWA === 'function' && dados.id != null) {
        abrirModalWA(dados.id);
      }
    }, 300);
  }
}

// ── Helper: busca ou cria paciente + conversa no Supabase ────────────────────
async function _obterConversaId(sb, nomePaciente) {
  let pacId = null;
  const { data: pacData } = await sb.from('pacientes').select('id').eq('nome', nomePaciente).single();
  if (pacData) { pacId = pacData.id; }
  else {
    const { data: newPac } = await sb.from('pacientes').insert({ nome: nomePaciente }).select('id').single();
    pacId = newPac?.id || null;
  }
  if (!pacId) return null;
  let conversaId = null;
  const { data: convData } = await sb.from('conversas').select('id').eq('paciente_id', pacId).eq('status', 'ativa').single();
  if (convData) { conversaId = convData.id; }
  else {
    const { data: newConv } = await sb.from('conversas').insert({ paciente_id: pacId, status: 'ativa' }).select('id').single();
    conversaId = newConv?.id || null;
  }
  return { pacId, conversaId };
}

// ── Monta texto da mensagem a partir do template padrão ───────────────────────
function _montarMsgAgendamento(dados) {
  const tpl = WA_TEMPLATES.find(t => t.padrao) || WA_TEMPLATES[0];
  const prof = PROFISSIONAIS.find(p => p.id === dados.profId);
  const dateObj = dados.dataISO ? new Date(dados.dataISO + 'T12:00') : new Date();
  const dateStr = dateObj.toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
  return tpl.texto
    .replace(/\{nome\}/g,      dados.paciente)
    .replace(/\{data\}/g,      dateStr)
    .replace(/\{hora\}/g,      dados.hora || '')
    .replace(/\{terapeuta\}/g, prof?.nome || '')
    .replace(/\{clinica\}/g,   CLINICA?.nome || 'Clínica');
}

// ── Ao criar agendamento via canal Chat:
//    1) Grava na tabela notificacoes (agendada_para = 24h antes, mínimo 2h no futuro)
//    2) Grava confirmação de agendamento com agendada_para = agora + 2h (não imediata)
//       para que exclusões/alterações dentro das 2h cancelem antes de enviar
async function _enviarNotifChat(dados) {
  const sb = (typeof getDb === 'function' ? getDb() : null) || (window.getDb ? window.getDb() : null);
  if (!sb) { showToast('Supabase não conectado para enviar notificação', 'error'); return; }
  const msg = _montarMsgAgendamento(dados);
  try {
    const ids = await _obterConversaId(sb, dados.paciente);
    if (!ids) { showToast('Paciente não encontrado para notificação', 'error'); return; }

    const agora = new Date();
    // Calcula agendada_para do lembrete = 24h antes do agendamento
    const dataHoraAppt = new Date((dados.dataISO || agora.toISOString().slice(0,10)) + 'T' + (dados.hora || '08:00') + ':00');
    const agendadaLembrete = new Date(dataHoraAppt.getTime() - 24 * 60 * 60 * 1000);

    // Confirmação: enviada no mínimo 2h depois de criar (janela de cancelamento/alteração)
    const agendadaConfirmacao = new Date(agora.getTime() + 2 * 60 * 60 * 1000);

    // 1) Grava lembrete de 24h antes (vinculado ao agendamento para poder cancelar)
    await sb.from('notificacoes').insert({
      paciente_id:    ids.pacId,
      agendamento_id: dados.id || null,
      titulo:         'Lembrete de consulta',
      corpo:          msg,
      tipo:           'lembrete',
      enviada:        false,
      agendada_para:  agendadaLembrete.toISOString(),
    });

    // 2) Grava confirmação de agendamento — será enviada após 2h (não imediata)
    const prof    = PROFISSIONAIS.find(p => p.id === dados.profId);
    const dateStr = dados.dataISO ? new Date(dados.dataISO + 'T12:00').toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long' }) : '';
    const confirmMsg = '✅ Consulta agendada!\n\n📅 ' + dateStr + ' às ' + (dados.hora || '') + '\n👩‍⚕️ ' + (prof?.nome || '') + '\n\nVocê receberá um lembrete 24h antes. Até lá!';
    await sb.from('notificacoes').insert({
      paciente_id:    ids.pacId,
      agendamento_id: dados.id || null,
      conversa_id:    ids.conversaId,
      titulo:         'Confirmação de agendamento',
      corpo:          confirmMsg,
      tipo:           'confirmacao',
      enviada:        false,
      agendada_para:  agendadaConfirmacao.toISOString(),
    });

    showToast('Notificações agendadas: confirmação em 2h + lembrete 24h antes ✓', 'success');
  } catch(e) {
    showToast('Erro ao agendar notificação via chat: ' + e.message, 'error');
  }
}

// ── Verificador periódico: dispara lembretes e confirmações pendentes ──────────
// Roda a cada 30 minutos enquanto o sistema estiver aberto
async function verificarNotificacoesPendentes() {
  if (WA_CONFIG.canal !== 'chat') return;
  const sb = (typeof getDb === 'function' ? getDb() : null) || (window.getDb ? window.getDb() : null);
  if (!sb) return;
  try {
    const agora = new Date();
    const { data: pendentes } = await sb
      .from('notificacoes')
      .select('*')
      .eq('enviada', false)
      .lte('agendada_para', agora.toISOString());

    if (!pendentes || !pendentes.length) return;

    for (const notif of pendentes) {
      try {
        // Usa conversa_id salvo na notificação (confirmacoes) ou busca pela conversa ativa do paciente (lembretes)
        let conversaId = notif.conversa_id || null;
        if (!conversaId) {
          const { data: conv } = await sb.from('conversas').select('id').eq('paciente_id', notif.paciente_id).eq('status', 'ativa').single();
          conversaId = conv?.id || null;
        }
        if (conversaId) {
          const prefixo = notif.tipo === 'confirmacao' ? '✅ ' : '🔔 ';
          await sb.from('mensagens').insert({
            conversa_id:    conversaId,
            tipo_remetente: 'sistema',
            conteudo:       prefixo + notif.corpo,
            lida:           false,
          });
          await sb.from('conversas').update({ ultima_mensagem_em: agora.toISOString() }).eq('id', conversaId);
        }
        // Marca como enviada independente de ter conversa (evita loop)
        await sb.from('notificacoes').update({ enviada: true, enviada_em: agora.toISOString() }).eq('id', notif.id);
      } catch(e2) {
        console.warn('[Notif] Erro ao processar notif id=' + notif.id, e2);
      }
    }
  } catch(e) {
    console.warn('[Notif] Erro ao verificar notificações:', e);
  }
}

// Inicia o verificador periódico (a cada 30 minutos)
(function _iniciarVerificadorNotif() {
  // Primeira verificação após 1 minuto do carregamento (dá tempo do Supabase conectar)
  setTimeout(function _primeiraVerif() {
    verificarNotificacoesPendentes();
    // A partir daí, a cada 30 minutos
    setInterval(verificarNotificacoesPendentes, 30 * 60 * 1000);
  }, 60 * 1000);
})();

let WA_TEMPLATES = [
  {
    id:1, nome:'Confirmação de agendamento', padrao:true,
    texto: `Olá, {nome}! 😊\n\nPassando para *confirmar sua consulta* na {clinica}:\n\n📅 *Data:* {data}\n🕐 *Horário:* {hora}\n👩‍⚕️ *Terapeuta:* {terapeuta}\n\nPor favor, confirme sua presença respondendo esta mensagem ou entre em contato caso precise remarcar.\n\nAté lá! 🌟`,
  },
  {
    id:2, nome:'Lembrete (dia anterior)', padrao:false,
    texto: `Olá, {nome}! ⏰\n\n*Lembrete:* sua consulta é *amanhã*!\n\n📅 {data} às {hora}\n👩‍⚕️ {terapeuta} — {clinica}\n\nTe esperamos! 😊`,
  },
  {
    id:3, nome:'Reagendamento', padrao:false,
    texto: `Olá, {nome}!\n\nGostaríamos de informar que sua consulta foi *reagendada*:\n\n📅 *Nova data:* {data}\n🕐 *Horário:* {hora}\n👩‍⚕️ *Terapeuta:* {terapeuta}\n\nQualquer dúvida, entre em contato. 🙏`,
  },
  {
    id:4, nome:'Desmarcamento', padrao:false,
    texto: `Olá, {nome}.\n\nInformamos que sua consulta do dia *{data}* às *{hora}* com {terapeuta} foi *cancelada*.\n\nEntre em contato para reagendar. {clinica}.`,
  },
];
let nextTplId = 5;
let waCurrentApptId = null;
let waLog = [];

// ── Open WhatsApp modal ───────────────────────────────────────────────────────
function abrirModalWA(apptId) {
  waCurrentApptId = apptId;
  const appt = APPOINTMENTS.find(a => a.id === apptId);
  if (!appt) return;

  const pac  = PACIENTES.find(p => p.nome === appt.paciente);
  const prof = PROFISSIONAIS.find(p => p.id === appt.profId);

  // Fill destinatário
  document.getElementById('wa-destinatario-nome').textContent = appt.paciente;
  document.getElementById('wa-modal-sub').textContent =
    `${appt.hora} · ${prof?.nome || ''} · ${appt.plano}`;

  // Phone from paciente or empty
  const tel = (pac?.tel || '').replace(/\D/g,'');
  const telFull = tel ? (tel.startsWith('55') ? tel : '55' + tel) : '';
  document.getElementById('wa-telefone').value = telFull;

  // Build template buttons
  buildWATemplateBtns(appt, pac, prof);

  // Select default template
  const defTpl = WA_TEMPLATES.find(t => t.padrao) || WA_TEMPLATES[0];
  if (defTpl) waSelectTemplate(defTpl, appt, pac, prof);

  // Method info
  updateWAMethodInfo();

  openModal('modal-whatsapp');
}

function buildWATemplateBtns() {
  const btns = document.getElementById('wa-templates-btns');
  if (!btns) return;
  btns.innerHTML = '';
  WA_TEMPLATES.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'wa-template-btn';
    btn.id = 'wa-tpl-' + t.id;
    btn.dataset.tplId = t.id;
    btn.innerHTML = '<div style="font-weight:500;font-size:12px">' + t.nome +
      (t.padrao ? ' <span style="font-size:10px;color:var(--accent)">padrão</span>' : '') + '</div>' +
      '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
      t.texto.split('\n')[0] + '</div>';
    btn.addEventListener('click', function() {
      const appt = APPOINTMENTS.find(a => a.id === waCurrentApptId);
      const pac  = PACIENTES.find(p => p.nome === appt?.paciente);
      const prof = PROFISSIONAIS.find(p => p.id === appt?.profId);
      waSelectTemplate(t, appt, pac, prof);
    });
    btns.appendChild(btn);
  });
}

function waSelectTemplate(tpl, appt, pac, prof) {
  if (!tpl || !appt) return;
  // Mark active
  document.querySelectorAll('.wa-template-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('wa-tpl-'+tpl.id);
  if (btn) btn.classList.add('active');

  // Build date string
  const dateStr = appt.dataISO
    ? appt.dataISO.split('-').reverse().join('/')
    : currentDate.toLocaleDateString('pt-BR', {weekday:'long', day:'2-digit', month:'long', year:'numeric'});

  const msg = tpl.texto
    .replace(/\{nome\}/g,      appt.paciente || '')
    .replace(/\{data\}/g,      dateStr)
    .replace(/\{hora\}/g,      appt.hora || '')
    .replace(/\{terapeuta\}/g, prof?.nome || '')
    .replace(/\{clinica\}/g,   CLINICA.nome || 'a clínica');

  document.getElementById('wa-msg-editor').value = msg;
  waUpdatePreview();
}

function waUpdatePreview() {
  const txt = document.getElementById('wa-msg-editor').value;
  // Format WhatsApp markdown for preview
  const html = txt
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*([^*]+)\*/g,'<strong>$1</strong>')
    .replace(/\_([^_]+)\_/g,'<em>$1</em>')
    .replace(/\n/g,'<br>');
  document.getElementById('wa-preview-bubble').innerHTML = html;
}

function updateWAMethodInfo() {
  const el = document.getElementById('wa-method-info');
  if (WA_CONFIG.method === 'api' && WA_CONFIG.connected) {
    el.innerHTML = '<span style="color:#25d366">🤖 Modo automático</span> — A mensagem será enviada automaticamente via Evolution API sem precisar abrir o WhatsApp.';
    document.getElementById('wa-btn-enviar').textContent = 'Enviar agora';
  } else if (WA_CONFIG.method === 'api' && !WA_CONFIG.connected) {
    el.innerHTML = '<span style="color:var(--warning)">⚠ Evolution API não conectada.</span> Usando link wa.me. Configure em <a href="#" onclick="closeModal(\'modal-whatsapp\');gotoPage(\'config\',null);return false;" style="color:var(--accent);cursor:pointer">Configurações</a>.';
    document.getElementById('wa-btn-enviar').innerHTML = '📱 Abrir WhatsApp';
  } else {
    el.innerHTML = '📱 <strong>Modo link wa.me:</strong> Ao clicar, o WhatsApp Web abrirá com a mensagem preenchida. Basta clicar em <strong>Enviar</strong> no WhatsApp.';
    document.getElementById('wa-btn-enviar').innerHTML = '<svg viewBox="0 0 24 24" fill="white" style="width:14px;height:14px"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.025.506 3.93 1.395 5.6L0 24l6.562-1.368C8.2 23.504 10.06 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.88 0-3.63-.49-5.15-1.345L2.5 21.5l.87-4.23A10 10 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg> Abrir WhatsApp';
  }
}

// ── Send actions ──────────────────────────────────────────────────────────────
function waEnviar() {
  const tel = document.getElementById('wa-telefone').value.replace(/\D/g,'');
  const msg = document.getElementById('wa-msg-editor').value.trim();

  if (!tel) { showToast('Informe o número de telefone do paciente','error'); return; }
  if (!msg) { showToast('A mensagem não pode estar vazia','error'); return; }

  if (WA_CONFIG.method === 'api' && WA_CONFIG.connected) {
    waEnviarPelaAPI(tel, msg);
  } else {
    waEnviarPeloLink(tel, msg);
  }
}

function waEnviarPeloLink(tel, msg) {
  const url = `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
  registrarEnvio(tel, msg, 'link');
  closeModal('modal-whatsapp');
}

async function waEnviarPelaAPI(tel, msg) {
  try {
    const resp = await fetch(`${WA_CONFIG.evoUrl}/message/sendText/${WA_CONFIG.evoInstance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': WA_CONFIG.evoKey,
      },
      body: JSON.stringify({
        number: tel,
        options: { delay: 1000, presence: 'composing' },
        textMessage: { text: msg },
      }),
    });
    if (resp.ok) {
      registrarEnvio(tel, msg, 'api');
      showToast('Mensagem enviada pelo WhatsApp!', 'success');
      closeModal('modal-whatsapp');
    } else {
      const err = await resp.text();
      showToast('Erro ao enviar: ' + err, 'error');
      waEnviarPeloLink(tel, msg); // fallback
    }
  } catch(e) {
    showToast('Erro de conexão com a API. Abrindo link...','error');
    waEnviarPeloLink(tel, msg);
  }
}

function waCopiar() {
  const msg = document.getElementById('wa-msg-editor').value;
  navigator.clipboard.writeText(msg).then(() => showToast('Mensagem copiada!','success'));
}

function registrarEnvio(tel, msg, metodo) {
  const appt = APPOINTMENTS.find(a => a.id === waCurrentApptId);
  if (appt) appt.waSent = true;
  waLog.unshift({
    ts:       new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),
    data:     new Date().toLocaleDateString('pt-BR'),
    paciente: appt?.paciente || '—',
    tel, metodo,
    preview:  msg.substring(0,60) + '...',
  });
  renderWaLog();
  renderDayView();
}

function renderWaLog() {
  const el = document.getElementById('cfg-wa-log');
  if (!el) return;
  if (!waLog.length) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:8px 0">Nenhum envio registrado nesta sessão.</div>';
    return;
  }
  el.innerHTML = waLog.slice(0,20).map(l =>
    `<div class="wa-log-item">
      <div class="wa-log-dot" style="background:#25d366"></div>
      <div style="flex:1">
        <div style="font-weight:500">${l.paciente}</div>
        <div style="color:var(--text-muted)">${l.preview}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="color:#25d366;font-size:11px">✓ Enviado</div>
        <div style="color:var(--text-muted);font-size:10px">${l.data} ${l.ts}</div>
        <div style="color:var(--text-muted);font-size:10px">${l.metodo==='api'?'🤖 API':'📱 Link'}</div>
      </div>
    </div>`
  ).join('');
}

// ── Config functions ──────────────────────────────────────────────────────────
function setCanalNotif(canal) {
  WA_CONFIG.canal = canal;
  CLINICA.canalNotif = canal;
  // Persiste no banco de dados (se conectado) e no localStorage como fallback
  localStorage.setItem('cf_notif_canal', canal);
  if (typeof salvarConfigNoDB === 'function') {
    salvarConfigNoDB().catch(e => console.warn('[setCanalNotif]', e));
  }
  _atualizarUICanalNotif(canal);
  showToast('Canal alterado para ' + (canal === 'chat' ? 'Chat com Paciente' : 'WhatsApp') + ' ✓', 'success');
}

async function salvarCanalNotif() {
  const canal = WA_CONFIG.canal || CLINICA.canalNotif || 'whatsapp';
  localStorage.setItem('cf_notif_canal', canal);
  CLINICA.canalNotif = canal;

  const sb = (typeof getDb === 'function' ? getDb() : null) || (window.getDb ? window.getDb() : null);
  if (!sb) {
    showToast('Supabase não conectado — canal salvo apenas localmente', 'warning');
    return;
  }
  try {
    const fn = window.salvarConfigNoDB || (typeof salvarConfigNoDB === 'function' ? salvarConfigNoDB : null);
    if (fn) {
      await fn();
    } else {
      // Fallback direto na tabela correta
      const { data } = await sb.from('config_clinica').select('id').limit(1);
      if (data && data.length > 0) {
        const { error } = await sb.from('config_clinica').update({ dados: CLINICA }).eq('id', data[0].id);
        if (error) throw error;
      } else {
        const { error } = await sb.from('config_clinica').insert([{ dados: CLINICA }]);
        if (error) throw error;
      }
    }
    showToast('Canal "' + (canal === 'chat' ? 'Chat com Paciente' : 'WhatsApp') + '" salvo no banco de dados ✓', 'success');
  } catch(e) {
    showToast('Erro ao salvar no banco: ' + (e.message || e), 'error');
    console.error('[salvarCanalNotif]', e);
  }
}

function _atualizarUICanalNotif(canal) {
  const waCard    = document.getElementById('cfg-canal-whatsapp');
  const chatCard  = document.getElementById('cfg-canal-chat');
  const waBadge   = document.getElementById('cfg-canal-wa-badge');
  const chatBadge = document.getElementById('cfg-canal-chat-badge');
  if (canal === 'chat') {
    if (chatCard)  { chatCard.style.border  = '2px solid var(--accent)'; chatCard.style.background  = 'var(--accent-soft)'; }
    if (waCard)    { waCard.style.border    = '1px solid var(--border)'; waCard.style.background    = ''; }
    if (chatBadge) { chatBadge.className = 'chip green'; chatBadge.textContent = 'Ativo'; }
    if (waBadge)   { waBadge.className   = 'chip gray';  waBadge.textContent  = 'Inativo'; }
  } else {
    if (waCard)    { waCard.style.border    = '2px solid var(--accent)'; waCard.style.background    = 'var(--accent-soft)'; }
    if (chatCard)  { chatCard.style.border  = '1px solid var(--border)'; chatCard.style.background  = ''; }
    if (waBadge)   { waBadge.className   = 'chip green'; waBadge.textContent  = 'Ativo'; }
    if (chatBadge) { chatBadge.className = 'chip gray';  chatBadge.textContent = 'Requer Supabase'; }
  }
}

function setWaMethod(method) {
  WA_CONFIG.method = method;
  const linkCard = document.getElementById('cfg-wa-method-link');
  const apiCard  = document.getElementById('cfg-wa-method-api');
  const apiSect  = document.getElementById('cfg-wa-api-section');
  if (method === 'link') {
    linkCard.style.border = '2px solid var(--accent)';
    linkCard.style.background = 'var(--accent-soft)';
    apiCard.style.border  = '1px solid var(--border)';
    apiCard.style.background = '';
    if (apiSect) apiSect.style.display = 'none';
  } else {
    apiCard.style.border  = '2px solid #25d366';
    apiCard.style.background = 'rgba(37,211,102,0.06)';
    linkCard.style.border = '1px solid var(--border)';
    linkCard.style.background = '';
    if (apiSect) apiSect.style.display = 'block';
  }
}

async function testarEvoAPI() {
  const url = document.getElementById('cfg-evo-url')?.value.trim();
  const key = document.getElementById('cfg-evo-key')?.value.trim();
  if (!url || !key) { showToast('Preencha a URL e a API Key','error'); return; }
  showToast('Testando conexão...','success');
  try {
    const resp = await fetch(`${url}/instance/fetchInstances`, {
      headers: { 'apikey': key },
    });
    if (resp.ok) {
      WA_CONFIG.evoUrl = url;
      WA_CONFIG.evoKey = key;
      WA_CONFIG.connected = true;
      const statusEl = document.getElementById('cfg-wa-api-status');
      statusEl.className = 'wa-api-status connected';
      statusEl.innerHTML = '<div style="width:8px;height:8px;border-radius:50%;background:#25d366;flex-shrink:0"></div><div><strong>Conectado!</strong> Evolution API respondeu com sucesso.</div>';
      showToast('Evolution API conectada!','success');
    } else {
      throw new Error('Status ' + resp.status);
    }
  } catch(e) {
    const statusEl = document.getElementById('cfg-wa-api-status');
    if (statusEl) {
      statusEl.className = 'wa-api-status disconnected';
      statusEl.innerHTML = `<div style="width:8px;height:8px;border-radius:50%;background:var(--danger);flex-shrink:0"></div><div>Erro de conexão: ${e.message}. Verifique a URL e a API Key.</div>`;
    }
    showToast('Falha na conexão: ' + e.message,'error');
  }
}

async function gerarQRCode() {
  const url = document.getElementById('cfg-evo-url')?.value.trim();
  const key = document.getElementById('cfg-evo-key')?.value.trim();
  const inst= document.getElementById('cfg-evo-instance')?.value.trim() || 'clinica';
  if (!url || !key) { showToast('Configure a URL e API Key primeiro','error'); return; }
  showToast('Gerando QR Code...','success');
  try {
    const resp = await fetch(`${url}/instance/create`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'apikey':key },
      body: JSON.stringify({ instanceName: inst, qrcode: true }),
    });
    const data = await resp.json();
    const qr   = data?.qrcode?.base64 || data?.instance?.qrcode?.base64;
    if (qr) {
      const qrSect = document.getElementById('cfg-wa-qr-section');
      const qrEl   = document.getElementById('cfg-wa-qr');
      qrSect.style.display = 'block';
      qrEl.innerHTML = `<img src="${qr}" style="width:200px;height:200px;border-radius:8px">`;
    } else {
      showToast('QR Code não retornado. Instância pode já estar conectada.','error');
    }
  } catch(e) {
    showToast('Erro ao gerar QR Code: ' + e.message,'error');
  }
}

function salvarConfigWA() {
  WA_CONFIG.evoUrl      = document.getElementById('cfg-evo-url')?.value.trim() || '';
  WA_CONFIG.evoKey      = document.getElementById('cfg-evo-key')?.value.trim() || '';
  WA_CONFIG.evoInstance = document.getElementById('cfg-evo-instance')?.value.trim() || 'clinica';
  WA_CONFIG.evoPhone    = document.getElementById('cfg-evo-phone')?.value.trim() || '';
  showToast('Configurações do WhatsApp salvas!','success');
}

function salvarConfigClinica() {
  const nome = document.getElementById('cfg-nome-clinica')?.value.trim();
  if (!nome) { showToast('Informe o nome da clínica','error'); return; }
  CLINICA.nome         = nome;
  CLINICA.cnpj         = document.getElementById('cfg-cnpj')?.value.trim()             || CLINICA.cnpj;
  CLINICA.endereco     = document.getElementById('cfg-endereco')?.value.trim()          || CLINICA.endereco;
  CLINICA.telefone     = document.getElementById('cfg-tel')?.value.trim()               || CLINICA.telefone;
  CLINICA.email        = document.getElementById('cfg-email-clinica')?.value.trim()     || CLINICA.email;
  CLINICA.codPrestador = document.getElementById('cfg-cod-prestador')?.value.trim()     || CLINICA.codPrestador;
  CLINICA.cnes         = document.getElementById('cfg-cnes')?.value.trim()              || CLINICA.cnes;
  // Update sidebar name
  renderSidebarLogo();
  showToast('Configurações salvas com sucesso!','success');
}

function carregarLogo(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { showToast('Logo deve ter menos de 2MB','error'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    CLINICA.logo = e.target.result;
    const preview = document.getElementById('cfg-logo-preview');
    if (preview) preview.innerHTML = '<img src="'+e.target.result+'" style="width:100%;height:100%;object-fit:contain;padding:4px">';
    renderSidebarLogo();
    showToast('Logo carregado!','success');
  };
  reader.readAsDataURL(file);
}

function removerLogo() {
  CLINICA.logo = '';
  const preview = document.getElementById('cfg-logo-preview');
  if (preview) preview.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" style="width:28px;height:28px;color:var(--text-muted)"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg><span style="font-size:10px;color:var(--text-muted);margin-top:4px">Logotipo</span>';
  renderSidebarLogo();
  showToast('Logo removido','success');
}

function renderSidebarLogo() {
  const logoWrap = document.getElementById('sidebar-logo-img');
  const logoText = document.getElementById('sidebar-logo-name');
  if (logoWrap) {
    if (CLINICA.logo) {
      logoWrap.innerHTML = '<img src="'+CLINICA.logo+'" style="height:32px;max-width:140px;object-fit:contain;border-radius:4px">';
      if (logoText) logoText.style.display = 'none';
    } else {
      logoWrap.innerHTML = '';
      if (logoText) logoText.style.display = '';
    }
  }
}

function initConfigPage() {
  // Pre-fill config page fields from CLINICA
  const fields = {
    'cfg-nome-clinica': CLINICA.nome,
    'cfg-cnpj':         CLINICA.cnpj,
    'cfg-endereco':     CLINICA.endereco,
    'cfg-tel':          CLINICA.telefone,
    'cfg-email-clinica':CLINICA.email,
    'cfg-cod-prestador':CLINICA.codPrestador,
    'cfg-cnes':         CLINICA.cnes,
  };
  Object.entries(fields).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el && val) el.value = val;
  });
  // Logo preview
  if (CLINICA.logo) {
    const preview = document.getElementById('cfg-logo-preview');
    if (preview) preview.innerHTML = '<img src="'+CLINICA.logo+'" style="width:100%;height:100%;object-fit:contain;padding:4px">';
  }
  // Restaura UI do canal de notificações a partir de CLINICA (ou fallback localStorage)
  const canal = CLINICA.canalNotif || localStorage.getItem('cf_notif_canal') || 'whatsapp';
  WA_CONFIG.canal = canal;
  if (typeof _atualizarUICanalNotif === 'function') _atualizarUICanalNotif(canal);
  if (typeof initWAConfig === 'function') initWAConfig();
}

// ── Templates management ──────────────────────────────────────────────────────
function renderConfigTemplates() {
  const el = document.getElementById('cfg-templates-list');
  if (!el) return;
  el.innerHTML = '';
  WA_TEMPLATES.forEach(t => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'border:1px solid var(--border);border-radius:var(--radius-md);padding:12px 14px;margin-bottom:8px';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px';

    const nameInput = document.createElement('input');
    nameInput.className = 'form-input';
    nameInput.value = t.nome;
    nameInput.id = 'tpl-nome-' + t.id;
    nameInput.style.cssText = 'padding:4px 8px;font-size:13px;font-weight:500;flex:1';

    const label = document.createElement('label');
    label.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer';
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = !!t.padrao;
    chk.addEventListener('change', () => setTplPadrao(t.id));
    label.appendChild(chk);
    label.appendChild(document.createTextNode(' Padrão'));

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Excluir';
    delBtn.style.cssText = 'padding:4px 8px;background:rgba(248,113,113,0.1);color:var(--danger);border:1px solid rgba(248,113,113,0.2);border-radius:var(--radius-sm);font-size:11px;cursor:pointer';
    delBtn.addEventListener('click', () => deletarTemplate(t.id));

    header.appendChild(nameInput);
    header.appendChild(label);
    header.appendChild(delBtn);

    const ta = document.createElement('textarea');
    ta.className = 'form-input';
    ta.id = 'tpl-texto-' + t.id;
    ta.rows = 4;
    ta.style.cssText = 'font-size:12px;font-family:var(--font-mono);resize:vertical';
    ta.value = t.texto;

    wrap.appendChild(header);
    wrap.appendChild(ta);
    el.appendChild(wrap);
  });
}

function setTplPadrao(id) {
  WA_TEMPLATES.forEach(t => t.padrao = (t.id === id));
  renderConfigTemplates();
}

function addTemplate() {
  WA_TEMPLATES.push({ id:nextTplId++, nome:'Novo template', padrao:false, texto:'Olá, {nome}! Sua consulta é dia {data} às {hora}.' });
  renderConfigTemplates();
}

function deletarTemplate(id) {
  if (WA_TEMPLATES.length <= 1) { showToast('Deve haver ao menos um template','error'); return; }
  WA_TEMPLATES = WA_TEMPLATES.filter(t => t.id !== id);
  renderConfigTemplates();
}

function salvarTemplates() {
  WA_TEMPLATES.forEach(t => {
    const nomeEl  = document.getElementById('tpl-nome-'+t.id);
    const textoEl = document.getElementById('tpl-texto-'+t.id);
    if (nomeEl)  t.nome  = nomeEl.value;
    if (textoEl) t.texto = textoEl.value;
  });
  showToast('Templates salvos!','success');
}

// ── Init WhatsApp config on page load ─────────────────────────────────────────
function initWAConfig() {
  renderConfigTemplates();
  renderWaLog();
  // Restaura canal: prioridade DB (CLINICA.canalNotif) > localStorage > padrão 'whatsapp'
  const canal = CLINICA.canalNotif || localStorage.getItem('cf_notif_canal') || 'whatsapp';
  WA_CONFIG.canal = canal;
  _atualizarUICanalNotif(canal);
}

// Bulk send confirmation to all today's patients
function waEnviarConfirmacoesDoDia() {
  const agendadosHoje = APPOINTMENTS.filter(a =>
    (a.status === 'agendado' || a.status === 'confirmado') && !a.waSent
  );
  if (!agendadosHoje.length) {
    showToast('Todos os pacientes de hoje já receberam confirmação ou não há agendamentos pendentes.','error');
    return;
  }
  const defTpl = WA_TEMPLATES.find(t => t.padrao) || WA_TEMPLATES[0];
  let sent = 0;
  agendadosHoje.forEach(appt => {
    const pac  = PACIENTES.find(p => p.nome === appt.paciente);
    const prof = PROFISSIONAIS.find(p => p.id === appt.profId);
    const tel  = (pac?.tel || '').replace(/\D/g,'');
    if (!tel) return;
    const telFull = tel.startsWith('55') ? tel : '55'+tel;
    const dateStr = currentDate.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
    const msg = defTpl.texto
      .replace(/\{nome\}/g,      appt.paciente)
      .replace(/\{data\}/g,      dateStr)
      .replace(/\{hora\}/g,      appt.hora)
      .replace(/\{terapeuta\}/g, prof?.nome || '')
      .replace(/\{clinica\}/g,   CLINICA.nome);
    waCurrentApptId = appt.id;
    if (WA_CONFIG.method === 'api' && WA_CONFIG.connected) {
      waEnviarPelaAPI(telFull, msg);
    } else {
      // For link method, open first one only (can't open multiple popups)
      if (sent === 0) {
        window.open(`https://wa.me/${telFull}?text=${encodeURIComponent(msg)}`,'_blank');
        registrarEnvio(telFull, msg, 'link');
      }
    }
    sent++;
  });
  if (WA_CONFIG.method === 'api' && WA_CONFIG.connected) {
    showToast(`${sent} mensagem(ns) enviada(s)!`,'success');
  } else {
    showToast(`Aberto WhatsApp para o primeiro paciente. Use o botão individual nos demais.`,'success');
  }
  renderDayView();
}

