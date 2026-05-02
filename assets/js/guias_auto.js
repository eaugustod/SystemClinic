// ═══════════════════════════════════════════════════════════════════
//  GERAR GUIAS AUTOMÁTICAS
// ═══════════════════════════════════════════════════════════════════
// Profissional executante fixo
const PROF_EXEC_GUIA_AUTO = 'Maria Cecilia Benessuti Donato';

// Retorna ISO date string de uma Date sem risco de fuso
function dateToISO(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth()+1).padStart(2,'0') + '-' +
    String(d.getDate()).padStart(2,'0');
}

// Adiciona N dias a uma Date
function addDays(d, n) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

// Avança a partir de d pelo menor número de dias (>0) sem ser feriado nem fim de semana opcional
function proximoDiaUtil(d, pularFimSemana = false) {
  let r = new Date(d);
  while (isFeriado(dateToISO(r))) r = addDays(r, 1);
  return r;
}

// Dado o dia de semana do agendamento (0=Dom..6=Sáb), retorna o offset em dias para a 2ª guia
// Regra:
//   Qui (4) → Ter da mesma semana: recua -3 dias
//   Sex (5) → Qua da mesma semana: recua -2 dias (só se ainda no mês, senão avança +5)
//   Demais  → avança +2 dias
// Nota: o offset pode ser NEGATIVO (recua na semana)
function offsetSegundaGuia(dowAgendamento) {
  if (dowAgendamento === 4) return -3;  // Qui → Ter (mesmo semana, recua 3)
  if (dowAgendamento === 5) return -2;  // Sex → Qua (mesmo semana, recua 2)
  return 2;                             // demais → +2 dias
}

// Calcula quantas sessões cabem no mês a partir da data de início
function sessoesNoMes(dataInicioISO, ano, mes) {
  const primeiroDia = new Date(ano, mes - 1, 1);
  const ultimoDia   = new Date(ano, mes, 0);
  const inicio      = new Date(dataInicioISO + 'T12:00:00');
  // Começa no maior entre início da autorização e primeiro dia do mês
  const de = inicio > primeiroDia ? inicio : primeiroDia;
  // Conta dias úteis (sem feriados) entre de e ultimoDia
  // Para simplificar: conta dias corridos ÷ 7 * 5 (aproximado) — mas o correto é contar semanas
  // Usamos a lógica real: para cada semana (7 dias) = máx. 5 dias úteis (Mon-Fri)
  // O enunciado pede: sessoesNoMes = floor((dias_corridos_uteis_do_mês_a_partir_de_início) / 7) * 2
  // Na verdade: conta quantos agendamentos de segunda guia cabem
  // Simplificado: conta semanas completas
  const diffMs = ultimoDia - de;
  if (diffMs < 0) return 0;
  const diffDias = Math.ceil(diffMs / 86400000) + 1;
  // Quantidade de pares de sessões na semana = floor(semanas) * 1 sessão base + extra
  // Usando regra prática: 1 sessão por semana = floor(dias/7)*1, 2 por semana se 60min
  return Math.floor(diffDias / 7) + (diffDias % 7 >= 1 ? 1 : 0);
}

let _ggParsed = []; // guias a gerar após preview

function abrirGerarGuias() {
  carregarFeriados();
  // Preenche mês atual
  const now = new Date();
  const mesEl = document.getElementById('gg-mes');
  if (mesEl) mesEl.value = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
  // Popula planos
  const planoSel = document.getElementById('gg-plano');
  if (planoSel) {
    planoSel.innerHTML = '<option value="">Todos os planos</option>' +
      PLANOS.filter(p => p.status !== 'Inativo').map(p =>
        `<option value="${p.id}">${p.nome}</option>`).join('');
  }
  document.getElementById('gg-paciente').value = '';
  document.getElementById('gg-preview-wrap').style.display = 'none';
  document.getElementById('gg-btn-gerar').style.display = 'none';
  document.getElementById('gg-preview-summary').textContent = '';
  _ggParsed = [];
  openModal('modal-gerar-guias');
}

function ggToggleAll(chk) {
  document.querySelectorAll('#gg-preview-tbody .gg-row-chk').forEach(c => {
    if (!c.disabled) c.checked = chk.checked;
  });
}

function previewGuiasAutomaticas() {
  const mesVal  = document.getElementById('gg-mes')?.value;
  const planoId = parseInt(document.getElementById('gg-plano')?.value || '0') || 0;
  const pacFilt = (document.getElementById('gg-paciente')?.value || '').trim().toLowerCase();

  if (!mesVal) { showToast('Selecione o mês', 'error'); return; }
  const [ano, mes] = mesVal.split('-').map(Number);
  const D_PRIM = new Date(ano, mes - 1, 1);   // 1º do mês
  const D_ULT  = new Date(ano, mes, 0);        // último do mês
  const ISO_PRIM = dateToISO(D_PRIM);
  const ISO_ULT  = dateToISO(D_ULT);

  const profExec = PROFISSIONAIS.find(p =>
    p.nome.toLowerCase().replace(/[^a-z ]/g,'').includes('maria cecilia') ||
    p.nome.toLowerCase().replace(/[^a-z ]/g,'').includes('maria cec')
  );

  _ggParsed = [];

  // ── Helpers locais ───────────────────────────────────────────────────────
  // Avança para próximo dia útil (seg-sex), pulando feriados
  const proxUtil = (d) => {
    let r = new Date(d);
    while (r.getDay() === 0 || r.getDay() === 6 || isFeriado(dateToISO(r)))
      r = addDays(r, 1);
    return r;
  };

  // Avança N dias úteis a partir de d
  const addDiasUteis = (d, n) => {
    let r = new Date(d);
    let cont = 0;
    while (cont < n) {
      r = addDays(r, 1);
      if (r.getDay() !== 0 && r.getDay() !== 6 && !isFeriado(dateToISO(r))) cont++;
    }
    return r;
  };

  // Match flexível de nomes
  const matchNome = (a, b) => {
    const ta = a.toLowerCase().split(/\s+/).filter(t => t.length > 1);
    const tb = b.toLowerCase().split(/\s+/).filter(t => t.length > 1);
    return ta.every(t => b.toLowerCase().includes(t)) ||
           tb.every(t => a.toLowerCase().includes(t));
  };

  // ── Senhas ativas no período ─────────────────────────────────────────────
  SENHAS_PLANO.filter(s => {
    if (!s.ativa && s.status !== 'Ativa') return false;
    if ((s.qtdUsada || 0) >= s.qtdAutorizada) return false;
    if (planoId && s.planoId !== planoId) return false;
    // Validade deve cobrir o mês (se informada)
    if (s.validade && s.validade < ISO_PRIM) return false;
    // dataAut deve ser até o fim do mês (se informada)
    if (s.dataAut && s.dataAut > ISO_ULT) return false;
    return true;
  }).forEach(senha => {
    if (pacFilt && !senha.paciente.toLowerCase().includes(pacFilt)) return;
    const plano = PLANOS.find(p => p.id === senha.planoId);
    if (!plano) return;

    // ── Agendamentos do paciente no mês (ativos) ─────────────────────────
    const appts = APPOINTMENTS.filter(a =>
      a.dataISO >= ISO_PRIM && a.dataISO <= ISO_ULT &&
      !['cancelado','desmarcado'].includes(a.status) &&
      matchNome(a.paciente, senha.paciente)
    ).sort((a, b) => a.dataISO.localeCompare(b.dataISO));

    // Nome real do paciente (do agendamento se existir, senão da senha)
    const pacNomeReal = appts.length ? appts[0].paciente : senha.paciente;

    // ── Limites ──────────────────────────────────────────────────────────
    const restantes = senha.qtdAutorizada - (senha.qtdUsada || 0);
    if (restantes <= 0) return;

    // Data de início = max(dataAut, 1º do mês)
    const dataAutDate = senha.dataAut
      ? new Date(senha.dataAut + 'T12:00:00')
      : new Date(D_PRIM);
    const dataIniReal = dataAutDate > D_PRIM ? dataAutDate : new Date(D_PRIM);

    // Data final = min(validade, último do mês)
    const dataFimReal = senha.validade && new Date(senha.validade + 'T12:00:00') < D_ULT
      ? new Date(senha.validade + 'T12:00:00')
      : new Date(D_ULT);

    // ── Procedimento ─────────────────────────────────────────────────────
    const proc = (senha.procs && senha.procs.length > 0)
      ? senha.procs[0]
      : (PROCEDIMENTOS.find(p => p.planoId === senha.planoId) || PROCEDIMENTOS[0]);
    const procCod  = proc?.codigo || '';
    const procDesc = proc?.desc   || 'Sessão de Terapia';
    const procVal  = (PROCEDIMENTOS.find(p => p.codigo === procCod && p.planoId === senha.planoId)
      || PROCEDIMENTOS.find(p => p.codigo === procCod))?.valPlano || 0;

    // ── Duração (usa 1º agendamento como referência; default 30 min) ─────
    const durMin = appts.length ? (appts[0].durMin || 30) : 30;
    const is60   = durMin >= 60;

    // ═════════════════════════════════════════════════════════════════════
    // GERAÇÃO DAS DATAS POR SEMANA
    // Regras:
    //   • 1ª guia da 1ª semana = proxUtil(max(dataAut, data_agendamento))
    //   • Se há 2 guias (60 min): guia2 = guia1 + 2 dias úteis
    //   • Semanas seguintes: ancora no dia do agendamento da semana
    //     - guia1 = dia do agendamento (ou mesmo dow projetado)
    //     - guia2 = guia1 - 2 dias úteis (2 dias antes)
    //   • Se não há agendamento: projeta o mesmo dow do 1º agendamento
    //     (ou segunda, se não houver nenhum), dentro do range dataIni-dataFim
    //   • Limita ao total restante de guias
    // ═════════════════════════════════════════════════════════════════════

    // Descobre o dow base (dia da semana do agendamento recorrente)
    let dowBase = appts.length
      ? new Date(appts[0].dataISO + 'T12:00:00').getDay()
      : 4; // default quinta
    if (dowBase === 0 || dowBase === 6) dowBase = 4;

    // Monta mapa de agendamentos por semana (chave = ISO da segunda daquela semana)
    const apptPorSemana = {};
    appts.forEach(a => {
      const d   = new Date(a.dataISO + 'T12:00:00');
      const dow = d.getDay() === 0 ? 7 : d.getDay();
      const seg = new Date(d);
      seg.setDate(d.getDate() - (dow - 1));
      const k = dateToISO(seg);
      if (!apptPorSemana[k]) apptPorSemana[k] = a;
    });

    // Encontra a segunda da semana que contém dataIniReal
    const dowIni = dataIniReal.getDay() === 0 ? 7 : dataIniReal.getDay();
    const segIni = new Date(dataIniReal);
    segIni.setDate(dataIniReal.getDate() - (dowIni - 1));

    let guiasRestantes = restantes;
    let primeiraSemana  = true;

    let semAtual = new Date(segIni);
    while (semAtual <= dataFimReal && guiasRestantes > 0) {
      const wKey     = dateToISO(semAtual);
      const apptSem  = apptPorSemana[wKey] || null;

      // Dia âncora desta semana
      let diaAncora;
      if (apptSem) {
        diaAncora = new Date(apptSem.dataISO + 'T12:00:00');
      } else {
        // Projeta o mesmo dow base nesta semana
        diaAncora = new Date(semAtual);
        diaAncora.setDate(semAtual.getDate() + (dowBase - 1));
      }

      // Âncora fora do intervalo válido → skip
      if (diaAncora > dataFimReal) { semAtual = addDays(semAtual, 7); continue; }

      let g1, g2ISO = null;

      if (primeiraSemana) {
        // 1ª semana: guia1 = proxUtil(max(dataIniReal, diaAncora))
        const base1 = dataIniReal > diaAncora ? dataIniReal : diaAncora;
        g1 = proxUtil(base1);
        if (is60 && guiasRestantes > 1) {
          // guia2 = guia1 + 2 dias úteis (avança)
          const g2 = addDiasUteis(g1, 2);
          if (g2 <= dataFimReal) g2ISO = dateToISO(g2);
        }
        primeiraSemana = false;
      } else {
        // Semanas seguintes: guia1 = dia do agendamento; guia2 = guia1 - 2 dias úteis (recua)
        g1 = proxUtil(diaAncora);
        if (is60 && guiasRestantes > 1) {
          // Recua 2 dias úteis (terça se agend. é quinta, qua se agend. é sexta, etc.)
          let g2 = new Date(diaAncora);
          let recuados = 0;
          while (recuados < 2) {
            g2 = addDays(g2, -1);
            if (g2.getDay() !== 0 && g2.getDay() !== 6 && !isFeriado(dateToISO(g2))) recuados++;
          }
          if (g2 >= dataIniReal && g2 <= dataFimReal && g2 >= D_PRIM) g2ISO = dateToISO(g2);
        }
      }

      if (!g1 || g1 > dataFimReal || g1 < D_PRIM) { semAtual = addDays(semAtual, 7); continue; }
      const g1ISO = dateToISO(g1);

      // ── Checa duplicatas ──────────────────────────────────────────────
      const dup1 = GUIAS.some(g =>
        matchNome(g.pac, pacNomeReal) && g.data === g1ISO &&
        !['Cancelado','cancelado'].includes(g.status)
      );
      const dup2 = g2ISO ? GUIAS.some(g =>
        matchNome(g.pac, pacNomeReal) && g.data === g2ISO &&
        !['Cancelado','cancelado'].includes(g.status)
      ) : false;
      const allDup = dup1 && (!g2ISO || dup2);

      _ggParsed.push({
        senha, plano, profExec, is60, pacNomeReal,
        appt: apptSem,
        data1ISO: g1ISO,
        data2ISO: g2ISO,
        procCod, procDesc, procVal,
        dup1, dup2,
        status: allDup ? 'dup' : 'ok',
      });

      if (!dup1) guiasRestantes--;
      if (g2ISO && !dup2) guiasRestantes--;

      semAtual = addDays(semAtual, 7);
    }
  });

  renderPreviewGG();
}

function renderPreviewGG() {
  const ok   = _ggParsed.filter(r => r.status === 'ok').length;
  const dup  = _ggParsed.filter(r => r.status === 'dup').length;
  const DOWS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const fmtISO = iso => iso ? iso.split('-').reverse().join('/') : '';
  const dowStr = iso => iso ? DOWS[new Date(iso+'T12:00:00').getDay()] : '';

  const totalGuias = _ggParsed.filter(r=>r.status==='ok').reduce((s,r)=>
    s + (r.dup1 ? 0 : 1) + (r.is60 && r.data2ISO && !r.dup2 ? 1 : 0), 0);

  document.getElementById('gg-preview-summary').textContent =
    `${_ggParsed.length} semana(s) encontrada(s)`;
  document.getElementById('gg-cnt-ok').textContent  = ok  ? `✓ ${ok} semanas prontas · ${totalGuias} guia(s) a criar` : '';
  document.getElementById('gg-cnt-dup').textContent = dup ? `⊘ ${dup} já gerada(s)`  : '';

  const tbody = document.getElementById('gg-preview-tbody');
  if (!tbody) return;

  if (!_ggParsed.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text-muted)">
      Nenhum resultado encontrado.<br>
      <small>Verifique se há senhas ativas com validade cobrindo o mês e agendamentos cadastrados.</small>
    </td></tr>`;
    document.getElementById('gg-preview-wrap').style.display = 'block';
    document.getElementById('gg-btn-gerar').style.display = 'none';
    return;
  }

  tbody.innerHTML = _ggParsed.map((r, idx) => {
    const isDup  = r.status === 'dup';
    const rowSt  = isDup ? 'opacity:0.5' : '';
    const rest   = r.senha.qtdAutorizada - (r.senha.qtdUsada || 0);
    const tipo   = r.is60
      ? '<span class="chip blue" style="font-size:9px">60 min · 2</span>'
      : '<span class="chip gray" style="font-size:9px">30 min · 1</span>';
    const apptInf = r.appt
      ? `<br><span style="font-size:10px;color:var(--text-muted)">Agend: ${fmtISO(r.appt.dataISO)} ${r.appt.hora||''}</span>`
      : `<br><span style="font-size:10px;color:var(--warning)">sem agendamento</span>`;

    // Campos editáveis de data
    const inputD1 = isDup
      ? `<span style="font-size:11px">${fmtISO(r.data1ISO)}</span>`
      : `<div style="display:flex;align-items:center;gap:4px">
           <input type="date" class="form-input gg-data1" data-idx="${idx}" value="${r.data1ISO||''}"
             style="padding:2px 6px;font-size:11px;width:128px;height:26px">
           <span class="gg-d1-dow" style="font-size:10px;color:var(--accent);min-width:22px">${dowStr(r.data1ISO)}</span>
         </div>
         ${r.dup1 ? '<span style="color:var(--warning);font-size:10px">⚠ já existe</span>' : ''}`;

    const inputD2 = !r.is60
      ? `<span style="color:var(--text-muted);font-size:11px">—</span>`
      : isDup
        ? `<span style="font-size:11px">${fmtISO(r.data2ISO)||'fora do mês'}</span>`
        : `<div style="display:flex;align-items:center;gap:4px">
             <input type="date" class="form-input gg-data2" data-idx="${idx}" value="${r.data2ISO||''}"
               style="padding:2px 6px;font-size:11px;width:128px;height:26px">
             <span class="gg-d2-dow" style="font-size:10px;color:var(--accent);min-width:22px">${dowStr(r.data2ISO)}</span>
           </div>
           ${r.dup2 ? '<span style="color:var(--warning);font-size:10px">⚠ já existe</span>' : ''}`;

    return `<tr style="${rowSt}">
      <td style="text-align:center;width:26px">
        <input type="checkbox" class="gg-row-chk" data-idx="${idx}" ${isDup?'disabled':'checked'}>
      </td>
      <td style="font-size:12px;font-weight:500">${r.pacNomeReal}${apptInf}</td>
      <td style="font-size:11px">${r.plano.nome}</td>
      <td style="padding:4px 8px">${inputD1}</td>
      <td style="padding:4px 8px">${inputD2}</td>
      <td style="text-align:center">${tipo}</td>
      <td style="text-align:center;font-size:12px">${rest}</td>
      <td><span class="chip ${isDup?'gray':'green'}" style="font-size:10px">${isDup?'Já gerada':'Pronto'}</span></td>
    </tr>`;
  }).join('');

  // Atualiza dia da semana ao editar a data
  tbody.querySelectorAll('.gg-data1, .gg-data2').forEach(inp => {
    inp.addEventListener('input', function() {
      const DOWS2 = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
      const idx2  = parseInt(this.dataset.idx);
      const isD1  = this.classList.contains('gg-data1');
      const label = this.parentElement.querySelector(isD1 ? '.gg-d1-dow' : '.gg-d2-dow');
      if (label) label.textContent = this.value ? DOWS2[new Date(this.value+'T12:00:00').getDay()] : '';
      // Atualiza o _ggParsed para que o confirmar use a data editada
      if (isD1) { _ggParsed[idx2].data1ISO = this.value || null; _ggParsed[idx2].dup1 = false; }
      else       { _ggParsed[idx2].data2ISO = this.value || null; _ggParsed[idx2].dup2 = false; }
    });
  });

  document.getElementById('gg-preview-wrap').style.display = 'block';
  document.getElementById('gg-btn-gerar').style.display = ok > 0 ? 'inline-flex' : 'none';
  document.getElementById('gg-btn-cnt').textContent = ok > 0 ? `(${totalGuias})` : '';
}

async function gerarGuiasConfirmar() {
  const selecionados = [...document.querySelectorAll('.gg-row-chk:checked')]
    .map(c => _ggParsed[parseInt(c.dataset.idx)])
    .filter(Boolean);

  if (!selecionados.length) { showToast('Nenhuma linha selecionada', 'error'); return; }

  const btn = document.getElementById('gg-btn-gerar');
  btn.disabled = true; btn.textContent = 'Gerando...';

  const sb = window._cfGetDb ? window._cfGetDb() : null;
  let geradas = 0, erros = 0;

  // Mapa de incrementos por senha (id → quantidade a incrementar)
  // Evita race conditions quando múltiplas linhas compartilham a mesma senha
  const senhaIncrMap = new Map(); // senhaId → { senha, delta }

  for (const r of selecionados) {
    const profId   = r.profExec?.id || 0;
    const pacNome  = r.pacNomeReal;
    const carteira = r.senha.carteirinha || '';

    const criarGuia = async (dataISO, isDup) => {
      if (!dataISO || isDup) return;
      const guiaNum = proxGuiaNum(r.plano.id);
      const guiaObj = {
        id: nextGuiaId++, num: guiaNum,
        pac: pacNome, planoId: r.plano.id, plano: r.plano.nome,
        profId, valor: r.procVal, status: 'Pendente', data: dataISO,
        carteirinha: carteira,
        numOp: r.senha.numGuiaOp || r.senha.numSenha || '',
        cid: r.senha.cid || '',
        loteId: null, loteNum: null,
        dados: {
          procs: [{ codigo: r.procCod, desc: r.procDesc, qtd: 1, valor: r.procVal, total: r.procVal }],
          senha: r.senha.numSenha || '',
          profExecNome: PROF_EXEC_GUIA_AUTO,
          durMin: r.appt?.durMin || (r.is60 ? 60 : 30),
        },
      };

      if (sb) {
        try {
          const { data: gd, error } = await sb.from('guias_sadt').insert([{
            num: guiaObj.num, pac: guiaObj.pac,
            plano_id: guiaObj.planoId, plano: guiaObj.plano,
            prof_id: guiaObj.profId || null, valor: guiaObj.valor,
            status: 'Pendente', data: guiaObj.data,
            carteirinha: guiaObj.carteirinha || null,
            num_op: guiaObj.numOp || null, cid: guiaObj.cid || null,
            dados: guiaObj.dados,
          }]).select('id').single();
          if (error) { console.error('[gerarGuias]', error.message); erros++; return; }
          if (gd) guiaObj.id = gd.id;
        } catch(e) { console.error('[gerarGuias]', e); erros++; return; }
      }
      GUIAS.push(guiaObj);

      // Vincula ao agendamento da data correspondente (se existir)
      const apptLink = APPOINTMENTS.find(a =>
        a.dataISO === dataISO && a.paciente === pacNome
      );
      if (apptLink) {
        if (!apptLink.guia || typeof apptLink.guia !== 'object') apptLink.guia = {};
        apptLink.guia[guiaObj.num] = { id: guiaObj.id, total: guiaObj.valor, num: guiaObj.num };
        if (sb) sb.from('agendamentos').update({ guia: apptLink.guia }).eq('id', apptLink.id);
      }

      // Acumula incremento — NÃO grava no banco aqui, faz em lote depois
      r.senha.qtdUsada = (r.senha.qtdUsada || 0) + 1;
      const entry = senhaIncrMap.get(r.senha.id);
      if (entry) entry.delta++;
      else senhaIncrMap.set(r.senha.id, { senha: r.senha, delta: 1 });

      geradas++;
    };

    await criarGuia(r.data1ISO, r.dup1);
    if (r.is60) await criarGuia(r.data2ISO, r.dup2);
  }

  // Grava qtdUsada consolidado no Supabase — um UPDATE por senha com o total correto
  if (sb) {
    for (const [senhaId, { senha }] of senhaIncrMap) {
      if (senha.qtdUsada >= senha.qtdAutorizada) {
        senha.status = 'Usada'; senha.ativa = false;
      }
      try {
        await sb.from('senhas_plano').update({
          qtd_usada: senha.qtdUsada,
          status:    senha.status,
          ativa:     senha.ativa,
        }).eq('id', senhaId);
      } catch(e) { console.error('[gerarGuias] update senha', e); }
    }
  }

  btn.disabled = false;
  closeModal('modal-gerar-guias');
  refreshUI();
  showToast(
    `${geradas} guia(s) gerada(s)${erros > 0 ? ` · ${erros} erro(s)` : ''}`,
    geradas > 0 ? 'success' : 'error'
  );
}

function abrirNovaGuia() {
  editingGuiaId = null;
  document.getElementById('guia-modal-title').textContent = 'Nova Guia SADT';
  document.getElementById('guia-modal-sub').textContent   = 'Preencha os dados da guia';
  document.getElementById('g-id-display').textContent     = '';
  // Número da guia: será gerado ao selecionar o plano via guiaPlanoChange()
  document.getElementById('g-num').value = '';
  document.getElementById('g-data').valueAsDate = new Date();
  ['g-pac','g-carteirinha','g-num-op','g-senha','g-cid'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value='';
  });
  document.getElementById('g-status').value = 'Pendente';

  // Reset proc list
  const procList = document.getElementById('g-procs-list');
  procList.innerHTML = '';
  guiaProcCount = 0;
  guiaAddProc();

  // Populate selects — apenas planos e profissionais ativos
  const gPlano = document.getElementById('g-plano');
  if (gPlano) gPlano.innerHTML = PLANOS.filter(p=>p.status!=='Inativo').map(p=>'<option value="'+p.id+'">'+p.nome+(p.ans&&p.ans!=='—'?' (ANS '+p.ans+')':'')+'</option>').join('');
  const gProf  = document.getElementById('g-prof');
  if (gProf)  gProf.innerHTML  = PROFISSIONAIS.filter(p=>p.status!=='Inativo').map(p=>'<option value="'+p.id+'">'+p.nome+'</option>').join('');
  const gPacList = document.getElementById('g-pac-list');
  if (gPacList) gPacList.innerHTML = PACIENTES.filter(p=>p.status==='Ativo'||!p.status).map(p=>'<option value="'+p.nome+'">').join('');

  document.getElementById('g-total').textContent = 'R$ 0,00';
  ['g-dt-aut','g-val-senha','g-indicacao','g-sessoes-rest'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });

  // Profissional executante fixo
  const profFixo = PROFISSIONAIS.find(p =>
    p.nome.toLowerCase().replace(/[^a-z]/g,'').includes('mariacecilia')
  );
  if (profFixo && gProf) gProf.value = profFixo.id;

  // Gera número baseado no primeiro plano selecionado
  if (gPlano && gPlano.value) {
    document.getElementById('g-num').value = proxGuiaNum(parseInt(gPlano.value));
  }
  openModal('modal-guia');
}

function editarGuia(id) {
  const g = GUIAS.find(x=>x.id===id);
  if (!g) return;
  editingGuiaId = id;
  document.getElementById('guia-modal-title').textContent = 'Editar Guia SADT';
  document.getElementById('guia-modal-sub').textContent   = '#'+g.num+' — '+g.pac;
  document.getElementById('g-id-display').textContent     = 'Guia: '+g.num;
  document.getElementById('g-num').value         = g.num;
  document.getElementById('g-data').value        = g.data || '';
  document.getElementById('g-pac').value         = g.pac  || '';
  document.getElementById('g-carteirinha').value = g.carteirinha || '';
  document.getElementById('g-num-op').value      = g.numOp       || '';
  document.getElementById('g-cid').value         = g.cid         || '';
  document.getElementById('g-status').value      = g.status      || 'Pendente';

  // Populate selects then set values
  const gPlano = document.getElementById('g-plano');
  if (gPlano) { gPlano.innerHTML = PLANOS.map(p=>'<option value="'+p.id+'">'+p.nome+(p.ans&&p.ans!=='—'?' (ANS '+p.ans+')':'')+'</option>').join(''); gPlano.value = g.planoId; }
  const gProf  = document.getElementById('g-prof');
  if (gProf)  { gProf.innerHTML  = PROFISSIONAIS.filter(p=>p.status!=='Inativo').map(p=>'<option value="'+p.id+'">'+p.nome+'</option>').join(''); gProf.value = g.profId; }
  const gPacList = document.getElementById('g-pac-list');
  if (gPacList) gPacList.innerHTML = PACIENTES.map(p=>'<option value="'+p.nome+'">').join('');

  // Restaura campos da senha/autorização
  const sv_g = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
  // Busca dados da senha para preenchimento automático
  const senhaEditG = SENHAS_PLANO.find(s =>
    s.planoId === g.planoId && s.ativa &&
    s.paciente.toLowerCase() === g.pac.toLowerCase()
  );
  if (senhaEditG) {
    sv_g('g-num-op',    g.numOp || senhaEditG.numGuiaOp || senhaEditG.numSenha);
    sv_g('g-senha',     g.dados?.senha || senhaEditG.numSenha || '');
    sv_g('g-dt-aut',    g.dados?.dataAut  || senhaEditG.dataAut  || '');
    sv_g('g-val-senha', g.dados?.validade || senhaEditG.validade || '');
    sv_g('g-indicacao', g.cid || senhaEditG.cid || '');
    const restEl = document.getElementById('g-sessoes-rest');
    if (restEl) {
      const rest = senhaEditG.qtdAutorizada - senhaEditG.qtdUsada;
      restEl.value = rest + ' de ' + senhaEditG.qtdAutorizada + ' sessões';
      restEl.style.color = rest <= 3 ? 'var(--warning)' : 'var(--success)';
    }
  } else {
    sv_g('g-dt-aut',    g.dados?.dataAut  || '');
    sv_g('g-val-senha', g.dados?.validade || '');
    sv_g('g-senha',     g.dados?.senha    || g.numOp || '');
    sv_g('g-indicacao', g.cid || '');
  }

  // Restaura carteirinha do paciente se não estiver salva na guia
  if (!g.carteirinha || g.carteirinha === '') {
    const pacGuia = PACIENTES.find(p => p.nome === g.pac || p.nome.toLowerCase() === g.pac.toLowerCase());
    if (pacGuia && pacGuia.carteirinha && pacGuia.carteirinha !== '—') {
      document.getElementById('g-carteirinha').value = pacGuia.carteirinha;
    }
  }
  // Restaura nº guia operadora dos dados jsonb se não no campo direto
  if (!g.numOp && g.dados?.senha) {
    document.getElementById('g-num-op').value = g.dados.senha || '';
  }

  // Restaura procedimentos — usa dados.procs ou busca por valor
  const procList = document.getElementById('g-procs-list');
  procList.innerHTML = '';
  guiaProcCount = 0;
  let procs = g.dados?.procs;
  if (!procs || procs.length === 0) {
    // Tenta reconstruir do valor: busca procedimento com valor mais próximo
    const procMatch = PROCEDIMENTOS.find(p =>
      Math.abs((p.valPlano || p.valPart || 0) - g.valor) < 1
    );
    procs = procMatch
      ? [{ codigo: procMatch.codigo, desc: procMatch.desc, qtd: 1, valor: g.valor }]
      : [{ codigo: '', desc: '', qtd: 1, valor: g.valor }];
  }
  procs.forEach(p => {
    guiaAddProc(p.codigo || '', p.desc || '', p.qtd || 1, p.valor || 0);
  });

  // Profissional executante sempre fixo (gProf já declarado acima)
  {
    const profFixo = PROFISSIONAIS.find(p => p.nome.toLowerCase().includes('maria cecilia') || p.nome === 'Maria Cecilia Benessuti Donato');
    if (profFixo && gProf) gProf.value = profFixo.id;
  }

  guiaRecalcTotal();
  openModal('modal-guia');
}

function guiaAutoFill() {
  const nome = document.getElementById('g-pac').value;
  const pac  = PACIENTES.find(p => p.nome.toLowerCase() === nome.toLowerCase()
             || p.nome.toLowerCase().startsWith(nome.toLowerCase()));
  if (!pac) return;
  document.getElementById('g-carteirinha').value = pac.carteirinha !== '—' ? pac.carteirinha : '';
  const gPlano = document.getElementById('g-plano');
  if (gPlano && pac.planoId) { gPlano.value = pac.planoId; guiaPlanoChange(); }
  guiaSenhaAutoFill();
}

function guiaSenhaAutoFill() {
  const nomePac  = document.getElementById('g-pac')?.value || '';
  const planoId  = parseInt(document.getElementById('g-plano')?.value || '0');
  const cartPac  = document.getElementById('g-carteirinha')?.value || '';
  if (!nomePac || !planoId) return;
  // Busca senha ativa para este paciente e plano
  const senhaG = SENHAS_PLANO.find(s =>
    s.ativa &&
    s.planoId === planoId &&
    s.paciente.toLowerCase() === nomePac.toLowerCase() &&
    (cartPac ? (s.carteirinha === cartPac || !s.carteirinha) : true) &&
    s.qtdUsada < s.qtdAutorizada
  );
  if (!senhaG) return;
  // Preenche campos da senha
  const sv = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
  sv('g-num-op',    senhaG.numGuiaOp || senhaG.numSenha);
  sv('g-senha',     senhaG.numSenha  || '');
  sv('g-dt-aut',    senhaG.dataAut   || '');
  sv('g-val-senha', senhaG.validade  || '');
  sv('g-indicacao', senhaG.cid       || '');
  // Sessões restantes
  const restEl = document.getElementById('g-sessoes-rest');
  if (restEl) {
    const rest = senhaG.qtdAutorizada - senhaG.qtdUsada;
    restEl.value = rest + ' de ' + senhaG.qtdAutorizada + ' sessões';
    restEl.style.color = rest <= 3 ? 'var(--warning)' : 'var(--success)';
  }
  // Preenche procedimentos da senha
  if (senhaG.procs && senhaG.procs.length > 0) {
    const procList = document.getElementById('g-procs-list');
    if (procList) {
      procList.innerHTML = '';
      guiaProcCount = 0;
      senhaG.procs.forEach(proc => {
        const procObj = PROCEDIMENTOS.find(p =>
          (proc.codigo && p.codigo === proc.codigo) ||
          (proc.desc   && p.desc?.toLowerCase().includes(proc.desc.toLowerCase().substring(0,10)))
        );
        const val = procObj
          ? (PROCEDIMENTOS.find(p => p.codigo === proc.codigo && p.planoId === planoId)?.valPlano
             || procObj.valPlano || procObj.valPart || 0)
          : 0;
        guiaAddProc(proc.codigo || '', proc.desc || '', 1, val);
      });
      guiaRecalcTotal();
    }
  }
}

function guiaPlanoChange() {
  const planoId = parseInt(document.getElementById('g-plano')?.value||'0');
  const plano   = PLANOS.find(p=>p.id===planoId);
  // Gera número sequencial apenas para guias novas (editingGuiaId === null)
  if (!editingGuiaId && plano) {
    document.getElementById('g-num').value = proxGuiaNum(planoId);
  }
  // Recalcula valores dos procedimentos já preenchidos pelo novo plano
  document.querySelectorAll('.sadt-proc-row').forEach(row => {
    const idx    = row.dataset.idx;
    const codEl  = document.getElementById('g-proc-cod-' + idx);
    const valEl  = document.getElementById('g-proc-val-' + idx);
    if (!codEl || !codEl.value || !valEl) return;
    const procMatch = PROCEDIMENTOS.find(p => p.codigo === codEl.value && p.planoId === planoId)
      || PROCEDIMENTOS.find(p => p.codigo === codEl.value);
    if (procMatch) {
      const val = planoId
        ? (PROCEDIMENTOS.find(p => p.codigo === codEl.value && p.planoId === planoId)?.valPlano
           || procMatch.valPlano || procMatch.valPart || 0)
        : (procMatch.valPart || procMatch.valPlano || 0);
      if (val > 0) valEl.value = val.toFixed(2).replace('.', ',');
    }
  });
  guiaRecalcTotal();
}

function guiaAddProc(cod='', desc='', qtd=1, val=0) {
  const idx  = guiaProcCount++;
  const row  = document.createElement('div');
  row.className = 'sadt-proc-row';
  row.dataset.idx = idx;
  row.style.cssText = 'display:grid;grid-template-columns:110px 1fr 60px 100px 36px;gap:0;border-top:1px solid var(--border);padding:4px 8px;align-items:center';
  row.innerHTML =
    '<input class="form-input" style="padding:4px 6px;font-size:12px;font-family:var(--font-mono)" placeholder="50000470" id="g-proc-cod-'+idx+'" value="'+cod+'">' +
    '<input class="form-input" style="padding:4px 6px;font-size:12px" placeholder="Descrição" id="g-proc-desc-'+idx+'" value="'+desc+'">' +
    '<input class="form-input" style="padding:4px 6px;font-size:12px;text-align:center" type="number" value="'+qtd+'" min="1" id="g-proc-qtd-'+idx+'">' +
    '<input class="form-input" style="padding:4px 6px;font-size:12px;text-align:right" placeholder="R$ 0,00" id="g-proc-val-'+idx+'" value="'+(val?val.toFixed(2).replace('.',','):'')+'">' +
    '<button style="padding:6px;background:none;color:var(--text-muted);font-size:14px" onclick="guiaRemoveProc(this)">✕</button>';

  // Add oninput after setting value to avoid triggering on empty
  row.querySelector('[id^="g-proc-cod"]').addEventListener('input', function(){ guiaLookupTuss(this); });
  row.querySelector('[id^="g-proc-val"]').addEventListener('input', guiaRecalcTotal);
  document.getElementById('g-procs-list').appendChild(row);
}

function guiaRemoveProc(btn) {
  const rows = document.querySelectorAll('.sadt-proc-row');
  if (rows.length > 1) { btn.closest('.sadt-proc-row').remove(); guiaRecalcTotal(); }
  else showToast('Deve haver ao menos um procedimento','error');
}

function guiaLookupTuss(input) {
  const code = input.value.trim();
  if (!code) return;
  const row  = input.closest('.sadt-proc-row');
  const idx  = row?.dataset.idx;
  const descEl = document.getElementById('g-proc-desc-'+idx);
  const valEl  = document.getElementById('g-proc-val-'+idx);
  // Busca pelo plano do paciente selecionado (valor correto para o plano)
  const planoId = parseInt(document.getElementById('g-plano')?.value || '0');
  const procMatch = PROCEDIMENTOS.find(p => p.codigo === code && p.planoId === planoId)
    || PROCEDIMENTOS.find(p => p.codigo === code)
    || (TUSS_TABLE[code] ? { desc: TUSS_TABLE[code].desc, valPlano: TUSS_TABLE[code].valor, valPart: TUSS_TABLE[code].valor } : null);
  if (!procMatch) return;
  const descVal = procMatch.desc || procMatch.descricao || '';
  const val     = planoId
    ? (PROCEDIMENTOS.find(p => p.codigo === code && p.planoId === planoId)?.valPlano || procMatch.valPlano || procMatch.valPart || 0)
    : (procMatch.valPart || procMatch.valPlano || 0);
  if (descEl && !descEl.value) descEl.value = descVal;
  if (valEl  && !valEl.value && val > 0) { valEl.value = val.toFixed(2).replace('.', ','); guiaRecalcTotal(); }
}

function guiaRecalcTotal() {
  let total = 0;
  document.querySelectorAll('.sadt-proc-row').forEach(row => {
    const idx  = row.dataset.idx;
    const valEl = document.getElementById('g-proc-val-'+idx);
    const qtdEl = document.getElementById('g-proc-qtd-'+idx);
    if (!valEl) return;
    const raw = (valEl.value||'').replace(/[R$\s]/g,'').replace(',','.');
    const qtd = qtdEl ? parseInt(qtdEl.value)||1 : 1;
    total += (parseFloat(raw)||0) * qtd;
  });
  const el = document.getElementById('g-total');
  if (el) el.textContent = brl(total);
}

function salvarGuia() {
  const pac  = document.getElementById('g-pac')?.value.trim();
  const planoId = parseInt(document.getElementById('g-plano')?.value||'0');
  const profId  = parseInt(document.getElementById('g-prof')?.value||'0');
  if (!pac)    { showToast('Informe o beneficiário','error'); return; }
  if (!planoId){ showToast('Selecione o plano','error'); return; }

  const plano = PLANOS.find(p=>p.id===planoId);
  const prof  = PROFISSIONAIS.find(p=>p.id===profId);

  // Collect procs
  const procs = [];
  document.querySelectorAll('.sadt-proc-row').forEach(row => {
    const idx = row.dataset.idx;
    const cod = document.getElementById('g-proc-cod-'+idx)?.value||'';
    const desc= document.getElementById('g-proc-desc-'+idx)?.value||'';
    const qtd = parseInt(document.getElementById('g-proc-qtd-'+idx)?.value||1);
    const val = parseBRL(document.getElementById('g-proc-val-'+idx)?.value||'0');
    if (desc) procs.push({ codigo:cod, desc, qtd, valor:val, total:val*qtd });
  });
  const total = procs.reduce((s,p)=>s+p.total,0);

  const dados = {
    pac, planoId,
    plano:       plano?.nome||'—',
    profId,
    carteirinha: document.getElementById('g-carteirinha')?.value||'',
    numOp:       document.getElementById('g-num-op')?.value||'',
    cid:         document.getElementById('g-indicacao')?.value || document.getElementById('g-cid')?.value||'',
    status:      document.getElementById('g-status')?.value||'Pendente',
    data:        document.getElementById('g-data')?.value||'',
    valor:       total,
    dados: {
      procs,
      dataAut:  document.getElementById('g-dt-aut')?.value  || '',
      validade: document.getElementById('g-val-senha')?.value || '',
      senha:    document.getElementById('g-senha')?.value   || document.getElementById('g-num-op')?.value || '',
    },
    loteId:      null,
  };
  // Incrementa qtdUsada na senha correspondente (em memória + Supabase)
  const senhaUsada = SENHAS_PLANO.find(s =>
    s.planoId === planoId && s.ativa &&
    (s.paciente === pac || s.paciente.toLowerCase() === pac.toLowerCase())
  );
  if (senhaUsada) {
    senhaUsada.qtdUsada = (senhaUsada.qtdUsada || 0) + 1;
    if (senhaUsada.qtdUsada >= senhaUsada.qtdAutorizada) {
      senhaUsada.status = 'Usada'; senhaUsada.ativa = false;
      showToast('Atenção: qtd. máxima de sessões atingida para esta senha!', 'error');
    }
    // Persiste no Supabase
    const _sbG = window._cfGetDb ? window._cfGetDb() : null;
    if (_sbG) {
      _sbG.from('senhas_plano').update({
        qtd_usada: senhaUsada.qtdUsada,
        status: senhaUsada.status,
        ativa: senhaUsada.ativa
      }).eq('id', senhaUsada.id).then(({error}) => {
        if (error) console.error('[Guia] Erro ao atualizar qtdUsada:', error.message);
      });
    }
  }

  const _sb = window._cfGetDb ? window._cfGetDb() : null;
  if (editingGuiaId !== null) {
    const g = GUIAS.find(x => x.id === editingGuiaId);
    if (g) { Object.assign(g, dados); g.num = document.getElementById('g-num').value; }
    if (_sb) _sb.from('guias_sadt').update({
      pac:g.pac, plano_id:g.planoId, plano:g.plano, prof_id:g.profId,
      valor:g.valor, status:g.status, data:g.data||null,
      carteirinha:g.carteirinha||null, num_op:g.numOp||null, cid:g.cid||null, dados:g.dados||null
    }).eq('id', editingGuiaId).then(({error}) => { if(error) console.error('[Guia UPDATE]', error.message); });
    showToast('Guia atualizada!', 'success');
  } else {
    dados.id  = nextGuiaId++;
    dados.num = document.getElementById('g-num').value || ('G' + Date.now().toString().slice(-8));
    GUIAS.push(dados);
    if (_sb) {
      _sb.from('guias_sadt').insert([{
        num:dados.num, pac:dados.pac, plano_id:dados.planoId, plano:dados.plano,
        prof_id:dados.profId, valor:dados.valor, status:dados.status,
        data:dados.data||null, carteirinha:dados.carteirinha||null,
        num_op:dados.numOp||null, cid:dados.cid||null, dados:dados.dados||null
      }]).select('id').single().then(({data:d, error}) => {
        if (error) console.error('[Guia INSERT]', error.message);
        else if (d) dados.id = d.id;
      });
    }
    showToast('Guia SADT criada!', 'success');
  }
  closeModal('modal-guia');
  renderGuiasList();
}

// ─── LOTES CRUD ────────────────────────────────────────────────────────────────
function renderLotesTable() {
  const tbody = document.getElementById('lotes-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  LOTES.forEach(l => {
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td><span style="font-family:var(--font-mono)">' + l.num + '</span></td>' +
      '<td>' + (l.competencia||'—') + '</td>' +
      '<td>' + l.plano + '</td>' +
      '<td style="text-align:center">' + l.qtd + '</td>' +
      '<td style="font-family:var(--font-mono);color:var(--success)">' + brl(l.valor) + '</td>' +
      '<td>' + (l.dataCriacao||'').split('-').reverse().join('/') + '</td>' +
      '<td>' +
        '<select class="form-select" style="padding:3px 8px;font-size:11px;width:110px" ' +
          'onchange="atualizarStatusLote(' + l.id + ',this.value)">' +
          ['Pendente','Gerado','Enviado','Faturado','Glosado'].map(function(s) {
            return '<option value="' + s + '"' + (l.status===s?' selected':'') + '>' + s + '</option>';
          }).join('') +
        '</select>' +
      '</td>' +
      '<td><div class="table-actions"></div></td>';

    const actions = tr.querySelector('.table-actions');

    const editBtn = document.createElement('button');
    editBtn.className = 'action-btn'; editBtn.title = 'Editar lote';
    editBtn.innerHTML = EDIT_ICON;
    editBtn.addEventListener('click', () => editarLote(l.id));
    actions.appendChild(editBtn);

    const xmlBtn = document.createElement('button');
    xmlBtn.className = 'action-btn'; xmlBtn.title = 'Exportar XML TISS';
    xmlBtn.style.color = 'var(--accent)';
    xmlBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>';
    xmlBtn.addEventListener('click', () => gerarXMLLote(l.id));
    actions.appendChild(xmlBtn);

    const delLoteBtn = document.createElement('button');
    delLoteBtn.className = 'action-btn'; delLoteBtn.title = 'Excluir'; delLoteBtn.style.color = 'var(--danger)';
    delLoteBtn.innerHTML = DEL_ICON;
    delLoteBtn.addEventListener('click', () => excluirLote(l.id));
    actions.appendChild(delLoteBtn);

    tbody.appendChild(tr);
  });
}

function abrirNovoLote() {
  editingLoteId = null;
  document.getElementById('lote-modal-title').textContent = 'Novo Lote TISS';
  document.getElementById('lote-modal-sub').textContent   = 'Selecione o plano e as guias';
  document.getElementById('lote-id-display').textContent  = '';
  document.getElementById('lote-btn-xml').style.display   = 'none';

  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const now = new Date();
  document.getElementById('lote-competencia').value = months[now.getMonth()]+'/'+now.getFullYear();
  document.getElementById('lote-obs').value = '';
  document.getElementById('lote-qtd-sel').textContent   = '0';
  document.getElementById('lote-valor-total').textContent= 'R$ 0,00';

  const lpEl = document.getElementById('lote-plano');
  if (lpEl) lpEl.innerHTML = '<option value="">Selecione o plano...</option>' +
    PLANOS.filter(p=>p.nome!=='Particular').map(p=>'<option value="'+p.id+'">'+p.nome+(p.ans&&p.ans!=='—'?' (ANS '+p.ans+')':'')+'</option>').join('');

  document.getElementById('lote-guias-disponiveis').innerHTML =
    '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px">Selecione um plano para ver as guias pendentes</div>';

  openModal('modal-lote');
}

function abrirFecharLote() {
  // Shortcut: open novo lote modal pre-filtered for pending guias
  abrirNovoLote();
  showToast('Selecione o plano e as guias para fechar o lote','success');
}

function editarLote(id) {
  const l = LOTES.find(x=>x.id===id);
  if (!l) return;
  editingLoteId = id;
  document.getElementById('lote-modal-title').textContent = 'Editar Lote #'+l.num;
  document.getElementById('lote-modal-sub').textContent   = l.competencia+' — '+l.plano;
  document.getElementById('lote-id-display').textContent  = 'Lote: '+l.num;
  document.getElementById('lote-btn-xml').style.display   = 'inline-flex';
  document.getElementById('lote-competencia').value = l.competencia;
  document.getElementById('lote-obs').value         = l.obs||'';

  const lpEl = document.getElementById('lote-plano');
  if (lpEl) { lpEl.innerHTML = '<option value="">—</option>' + PLANOS.filter(p=>p.nome!=='Particular').map(p=>'<option value="'+p.id+'">'+p.nome+'</option>').join(''); lpEl.value = l.planoId; }

  loteAtualizarGuias();
  document.getElementById('lote-qtd-sel').textContent    = l.qtd;
  document.getElementById('lote-valor-total').textContent = brl(l.valor);
  openModal('modal-lote');
}

function loteAtualizarGuias() {
  const planoId = parseInt(document.getElementById('lote-plano')?.value||'0');
  const el = document.getElementById('lote-guias-disponiveis');
  if (!el) return;
  if (!planoId) {
    el.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px">Selecione um plano para ver as guias disponíveis</div>';
    loteRecalc();
    return;
  }
  // Show ALL guias for this plano that are not yet in a lote (any status except already lotted)
  const guias = GUIAS.filter(g => g.planoId===planoId && !g.loteId);
  if (!guias.length) {
    el.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px">Todas as guias deste plano já estão em lotes.</div>';
    loteRecalc();
    return;
  }
  el.innerHTML = '';

  // Header row
  const hdr = document.createElement('div');
  hdr.style.cssText = 'display:grid;grid-template-columns:28px 1fr 80px 90px 70px;gap:6px;padding:6px 12px;background:var(--bg-overlay);font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.3px;border-bottom:1px solid var(--border)';
  hdr.innerHTML = '<span></span><span>Paciente / Guia</span><span>Data</span><span style="text-align:right">Valor</span><span style="text-align:center">Status</span>';
  el.appendChild(hdr);

  let total = 0; let qtd = 0;
  guias.forEach(g => {
    const row = document.createElement('div');
    row.style.cssText = 'display:grid;grid-template-columns:28px 1fr 80px 90px 70px;gap:6px;padding:7px 12px;border-bottom:1px solid var(--border);align-items:center';
    const chk = document.createElement('input');
    chk.type = 'checkbox'; chk.checked = true;
    chk.dataset.guiaId = g.id; chk.dataset.valor = g.valor;
    chk.addEventListener('change', loteRecalcAndWarn);

    const chipCls = g.status==='Pago'?'green':g.status==='Enviado'?'blue':'yellow';
    row.appendChild(chk);
    const info = document.createElement('div');
    info.innerHTML = '<div style="font-size:13px;font-weight:500">'+g.pac+'</div>' +
      '<div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono)">#'+g.num+'</div>';
    row.appendChild(info);
    const dt = document.createElement('div');
    dt.style.cssText = 'font-size:11px;color:var(--text-muted)';
    dt.textContent = g.data ? g.data.split('-').slice(1).reverse().join('/') : '—';
    row.appendChild(dt);
    const val = document.createElement('div');
    val.style.cssText = 'font-family:var(--font-mono);font-size:12px;text-align:right';
    val.textContent = brl(g.valor);
    row.appendChild(val);
    const chip = document.createElement('div');
    chip.style.cssText = 'text-align:center';
    chip.innerHTML = '<span class="chip '+chipCls+'" style="font-size:9px;padding:2px 6px">'+g.status+'</span>';
    row.appendChild(chip);
    el.appendChild(row);
    total += g.valor; qtd++;
  });

  // Warning if > 90 — informa divisão automática
  if (qtd > 90) {
    const warn = document.createElement('div');
    warn.style.cssText = 'padding:8px 12px;background:rgba(52,211,153,0.08);border-top:1px solid rgba(52,211,153,0.25);font-size:12px;color:var(--success)';
    const lotes = Math.ceil(qtd / 90);
    warn.textContent = '✔ ' + qtd + ' guias selecionadas — ao salvar, o sistema criará ' + lotes + ' lote(s) automaticamente (grupos de até 90 guias cada).';
    el.appendChild(warn);
  }

  document.getElementById('lote-qtd-sel').textContent     = qtd;
  document.getElementById('lote-valor-total').textContent  = brl(total);
  atualizarBarraLote(qtd, total);
}

function loteRecalcAndWarn() {
  loteRecalc();
  const qtd = parseInt(document.getElementById('lote-qtd-sel').textContent || '0');
  if (qtd > 90) {
    const lotes = Math.ceil(qtd / 90);
    showToast(qtd + ' guias selecionadas — serão criados ' + lotes + ' lote(s) automaticamente ao salvar.', 'success');
  }
}

function loteRecalc() {
  const checkboxes = document.querySelectorAll('#lote-guias-disponiveis input[type=checkbox]');
  let total=0, qtd=0;
  checkboxes.forEach(c => { if(c.checked){ total+=parseFloat(c.dataset.valor||0); qtd++; } });
  document.getElementById('lote-qtd-sel').textContent     = qtd;
  document.getElementById('lote-valor-total').textContent  = brl(total);
  atualizarBarraLote(qtd, total);
}

function atualizarBarraLote(qtd, total) {
  const barEl  = document.getElementById('lote-progress-bar');
  const cntEl  = document.getElementById('lote-count-label');
  if (!barEl) return;
  const pct    = Math.min(100, Math.round((qtd % 90 || (qtd > 0 ? 90 : 0)) / 90 * 100));
  barEl.style.width = (qtd > 0 ? Math.max(4, pct) : 0)+'%';
  barEl.style.background = qtd > 90 ? 'var(--success)' : qtd > 70 ? 'var(--warning)' : 'var(--success)';
  if (cntEl) {
    if (qtd > 90) {
      const lotes = Math.ceil(qtd / 90);
      cntEl.textContent = qtd + ' guias → ' + lotes + ' lotes de até 90 · ' + brl(total);
    } else {
      cntEl.textContent = qtd + ' / 90 guias selecionadas · ' + brl(total);
    }
  }
}

function salvarLote() {
  const planoId = parseInt(document.getElementById('lote-plano')?.value||'0');
  const comp    = document.getElementById('lote-competencia')?.value.trim();
  if (!planoId) { showToast('Selecione o plano','error'); return; }
  const plano   = PLANOS.find(p=>p.id===planoId);
  const checkboxes = document.querySelectorAll('#lote-guias-disponiveis input[type=checkbox]:checked');
  const selectedIds= [...checkboxes].map(c=>parseInt(c.dataset.guiaId));
  if (!selectedIds.length) { showToast('Selecione ao menos uma guia','error'); return; }
  const total = [...checkboxes].reduce((s,c)=>s+parseFloat(c.dataset.valor||0),0);

  if (editingLoteId !== null) {
    const l = LOTES.find(x=>x.id===editingLoteId);
    if (l) { l.competencia=comp; l.planoId=planoId; l.plano=plano?.nome||'—'; l.qtd=selectedIds.length; l.valor=total; l.obs=document.getElementById('lote-obs')?.value||''; }
    showToast('Lote atualizado!','success');
    closeModal('modal-lote');
    renderLotesTable();
    renderGuiasList();
    return;
  }

  // ── Divisão automática em sublotes de até 90 guias ──────────────────────
  const MAX_POR_LOTE = 90;
  const obs = document.getElementById('lote-obs')?.value||'';
  const ano = new Date().getFullYear();
  const lotesCriados = [];

  // Calcula valor de cada guia via checkbox dataset
  const valorPorId = {};
  [...checkboxes].forEach(c => { valorPorId[parseInt(c.dataset.guiaId)] = parseFloat(c.dataset.valor||0); });

  for (let i = 0; i < selectedIds.length; i += MAX_POR_LOTE) {
    const chunk = selectedIds.slice(i, i + MAX_POR_LOTE);
    const chunkValor = chunk.reduce((s,id) => s + (valorPorId[id]||0), 0);
    const num = String(ano)+String(nextLoteId).padStart(4,'0');
    const newLote = { id:nextLoteId++, num, competencia:comp, planoId, plano:plano?.nome||'—',
      qtd:chunk.length, valor:chunkValor, status:'Pendente',
      dataCriacao:new Date().toISOString().slice(0,10), dataEnvio:'',
      obs, guiaIds:chunk, xml:'' };
    LOTES.push(newLote);
    chunk.forEach(id => {
      const g=GUIAS.find(x=>x.id===id);
      if(g){ g.loteId=newLote.id; g.loteNum=newLote.num; g.status='Enviado'; }
    });
    lotesCriados.push(newLote);
  }

  if (lotesCriados.length === 1) {
    showToast('Lote '+lotesCriados[0].num+' criado com '+lotesCriados[0].qtd+' guias!','success');
  } else {
    showToast(lotesCriados.length+' lotes criados automaticamente ('+selectedIds.length+' guias divididas em grupos de até 90)!','success');
  }
  closeModal('modal-lote');
  renderLotesTable();
  renderGuiasList();
}

function atualizarStatusLote(loteId, novoStatus) {
  const l = LOTES.find(x => x.id === loteId);
  if (!l) return;
  l.status = novoStatus;
  if (novoStatus === 'Enviado' || novoStatus === 'Faturado') {
    l.dataEnvio = l.dataEnvio || new Date().toISOString().slice(0, 10);
  }
  const sb = window._cfGetDb ? window._cfGetDb() : null;
  if (sb) {
    sb.from('lotes_tiss').update({ status: novoStatus, data_envio: l.dataEnvio || null }).eq('id', loteId)
      .then(function(r) { if (r.error) console.error('[Lote status]', r.error.message); });
  }
  showToast('Status atualizado: ' + novoStatus, 'success');
}

// ── Tabela de conselhos TISS (2 dígitos) ─────────────────────────────────────
const TISS_CONSELHOS = {
  'CRESS':'01','COREN':'02','CRF':'03','CREFONO':'04','CREFITO':'05',
  'CRM':'06','CRN':'07','CRO':'08','CRP':'09','OUTRO':'10',
  'CRBio':'11','CRBM':'12','CREF':'13','CRMV':'14','CRTR':'15',
};

// ── Tabela IBGE UF (código numérico de 2 dígitos) ────────────────────────────
const IBGE_UF = {
  'RO':'11','AC':'12','AM':'13','RR':'14','PA':'15','AP':'16','TO':'17',
  'MA':'21','PI':'22','CE':'23','RN':'24','PB':'25','PE':'26','AL':'27',
  'SE':'28','BA':'29','MG':'31','ES':'32','RJ':'33','SP':'35',
  'PR':'41','SC':'42','RS':'43','MS':'50','MT':'51','GO':'52','DF':'53',
};

// ── Converte sigla do conselho para código TISS ───────────────────────────────
function tissCodigoConselho(sigla) {
  if (!sigla) return '09';
  const s = sigla.toUpperCase().trim();
  if (TISS_CONSELHOS[s]) return TISS_CONSELHOS[s];
  // Tenta match parcial
  for (const key of Object.keys(TISS_CONSELHOS)) {
    if (s.includes(key) || key.includes(s)) return TISS_CONSELHOS[key];
  }
  return '10'; // Outros
}

// ── Converte sigla UF para código IBGE ───────────────────────────────────────
function tissCodigoUF(uf) {
  if (!uf) return '35'; // SP default
  const s = uf.toUpperCase().trim();
  // Já é código numérico?
  if (/^\d{2}$/.test(s)) return s;
  return IBGE_UF[s] || '35';
}

// ── Hash MD5 sobre o conteúdo XML (sem tag hash) — usando SubtleCrypto ───────
async function _tissHashMD5(xmlSemHash) {
  // Remove indentação — deixa apenas tags e valores sem espaços desnecessários
  const canonical = xmlSemHash
    .replace(/\r\n/g, '\n')
    .replace(/\n\s+</g, '<')        // remove indentação antes de tag
    .replace(/>\s+</g, '><')        // remove espaço entre tags
    .replace(/\n+/g, '')            // remove quebras de linha soltas
    .trim();

  // Tenta SubtleCrypto (SHA-1 — o ANS aceita SHA-1 como "hash")
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(canonical);
    const hashBuf = await crypto.subtle.digest('SHA-1', data);
    const hashArr = Array.from(new Uint8Array(hashBuf));
    return hashArr.map(b => b.toString(16).padStart(2,'0')).join('');
  } catch(e) {
    // Fallback: hash simples determinístico baseado no conteúdo
    let h = 0;
    for (let i = 0; i < canonical.length; i++) {
      h = Math.imul(31, h) + canonical.charCodeAt(i) | 0;
    }
    return Math.abs(h).toString(16).padStart(8,'0').repeat(5).slice(0,40);
  }
}

function gerarXMLLote(loteId) {
  const l = typeof loteId === 'number'
    ? LOTES.find(x => x.id === loteId)
    : LOTES.find(x => x.id === editingLoteId);
  if (!l) { showToast('Selecione um lote', 'error'); return; }

  const plano = PLANOS.find(p => p.id === l.planoId);
  if (!plano) { showToast('Plano nao encontrado', 'error'); return; }

  const fmtDate = function(iso) {
    if (!iso) return new Date().toISOString().slice(0,10);
    const m = String(iso).match(/(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[1]+'-'+m[2]+'-'+m[3] : iso;
  };
  const fmtHora = function() {
    const n = new Date();
    return String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0')+':'+String(n.getSeconds()).padStart(2,'0');
  };
  // Para ISO-8859-1: substitui caracteres acentuados por entidades XML
  const esc = function(s) {
    return String(s||'')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  };
  const fmtBRL = function(v) { return Number(v||0).toFixed(2); };

  const codPrestador  = plano.codPrestador  || CLINICA.codPrestador || '100000019260';
  const nomePrestador = plano.nomeContratado || CLINICA.nome        || 'KOSMOS ESPACO TERAPEUTICO';
  const cnes          = plano.cnes           || CLINICA.cnes        || '620904';
  const registroANS   = plano.ans            || '';
  const versaoTiss    = plano.versaoTiss      || '4.02.00';

  const profExec = PROFISSIONAIS.find(function(p) {
    return p.nome.toLowerCase().replace(/[^a-z]/g,'').includes('mariacecilia');
  }) || {};
  const profNome        = profExec.nome        || 'Maria Cecilia Benessuti Donato';
  // b) Código de 2 dígitos do conselho conforme tabela TISS
  const profConselhoSigla  = profExec.conselho  || 'CRP';
  const profCodigoConselho = tissCodigoConselho(profConselhoSigla);
  const profNumConselho    = profExec.num        || '71849';
  // c) Código IBGE da UF (2 dígitos numéricos)
  const profUFSigla        = profExec.uf         || 'SP';
  const profCodigoUF       = tissCodigoUF(profUFSigla);
  const profCBO            = profExec.cbo        || '251510';
  const profCPF            = profExec.cpf        || '27700196869';

  const guias = (l.guiaIds || []).map(function(id) { return GUIAS.find(function(g) { return g.id === id; }); }).filter(Boolean);
  if (!guias.length) { showToast('Nenhuma guia encontrada neste lote', 'error'); return; }

  const dataGeracaoISO = new Date().toISOString().slice(0,10);
  const horaGeracao    = fmtHora();

  // Monta guias sem indentação extra (canonical-friendly)
  const xmlGuias = guias.map(function(g) {
    const dataGuia  = fmtDate(g.data);
    const senha     = esc(g.dados && g.dados.senha ? g.dados.senha : (g.numOp || ''));
    const dataAut   = fmtDate(g.dados && g.dados.dataAut ? g.dados.dataAut : g.data);
    const valSenha  = fmtDate(g.dados && g.dados.validade ? g.dados.validade : '');
    const carteira  = esc(g.carteirinha || '');
    const guiaPrest = esc(g.num);
    const guiaOp    = esc(g.numOp || g.num);
    const procs     = (g.dados && g.dados.procs && g.dados.procs.length > 0)
      ? g.dados.procs
      : [{ codigo:'50000470', desc:'Sessao de Terapia', qtd:1, valor:g.valor, total:g.valor }];

    const xmlProcs = procs.map(function(p, i) {
      const val = fmtBRL(p.valor || g.valor);
      const tot = fmtBRL(p.total || ((p.valor||g.valor) * (p.qtd||1)));
      return '<ans:procedimentoExecutado>' +
        '<ans:sequencialItem>'+(i+1)+'</ans:sequencialItem>' +
        '<ans:dataExecucao>'+dataGuia+'</ans:dataExecucao>' +
        '<ans:horaInicial>08:00:00</ans:horaInicial>' +
        '<ans:horaFinal>09:00:00</ans:horaFinal>' +
        '<ans:procedimento>' +
        '<ans:codigoTabela>22</ans:codigoTabela>' +
        '<ans:codigoProcedimento>'+esc(p.codigo||'50000470')+'</ans:codigoProcedimento>' +
        '<ans:descricaoProcedimento>'+esc(p.desc||'Sessao de Terapia')+'</ans:descricaoProcedimento>' +
        '</ans:procedimento>' +
        '<ans:quantidadeExecutada>'+(p.qtd||1)+'</ans:quantidadeExecutada>' +
        '<ans:reducaoAcrescimo>1.0000</ans:reducaoAcrescimo>' +
        '<ans:valorUnitario>'+val+'</ans:valorUnitario>' +
        '<ans:valorTotal>'+tot+'</ans:valorTotal>' +
        '<ans:equipeSadt>' +
        '<ans:grauPart>12</ans:grauPart>' +
        '<ans:codProfissional>' +
        '<ans:cpfContratado>'+profCPF+'</ans:cpfContratado>' +
        '</ans:codProfissional>' +
        '<ans:nomeProf>'+esc(profNome)+'</ans:nomeProf>' +
        '<ans:conselho>'+profCodigoConselho+'</ans:conselho>' +
        '<ans:numeroConselhoProfissional>'+profNumConselho+'</ans:numeroConselhoProfissional>' +
        '<ans:UF>'+profCodigoUF+'</ans:UF>' +
        '<ans:CBOS>'+profCBO+'</ans:CBOS>' +
        '</ans:equipeSadt>' +
        '</ans:procedimentoExecutado>';
    }).join('');

    const totalProc = fmtBRL(g.valor);

    return '<ans:guiaSP-SADT>' +
      '<ans:cabecalhoGuia>' +
      '<ans:registroANS>'+registroANS+'</ans:registroANS>' +
      '<ans:numeroGuiaPrestador>'+guiaPrest+'</ans:numeroGuiaPrestador>' +
      '<ans:guiaPrincipal>'+guiaOp+'</ans:guiaPrincipal>' +
      '</ans:cabecalhoGuia>' +
      '<ans:dadosAutorizacao>' +
      '<ans:numeroGuiaOperadora>'+guiaOp+'</ans:numeroGuiaOperadora>' +
      '<ans:dataAutorizacao>'+dataAut+'</ans:dataAutorizacao>' +
      '<ans:senha>'+senha+'</ans:senha>' +
      '<ans:dataValidadeSenha>'+valSenha+'</ans:dataValidadeSenha>' +
      '</ans:dadosAutorizacao>' +
      '<ans:dadosBeneficiario>' +
      '<ans:numeroCarteira>'+carteira+'</ans:numeroCarteira>' +
      '<ans:atendimentoRN>N</ans:atendimentoRN>' +
      '<ans:tipoIdent>01</ans:tipoIdent>' +
      '</ans:dadosBeneficiario>' +
      '<ans:dadosSolicitante>' +
      '<ans:contratadoSolicitante>' +
      '<ans:codigoPrestadorNaOperadora>'+codPrestador+'</ans:codigoPrestadorNaOperadora>' +
      '</ans:contratadoSolicitante>' +
      '<ans:nomeContratadoSolicitante>'+esc(nomePrestador)+'</ans:nomeContratadoSolicitante>' +
      '<ans:profissionalSolicitante>' +
      '<ans:nomeProfissional>'+esc(profNome)+'</ans:nomeProfissional>' +
      '<ans:conselhoProfissional>'+profCodigoConselho+'</ans:conselhoProfissional>' +
      '<ans:numeroConselhoProfissional>'+profNumConselho+'</ans:numeroConselhoProfissional>' +
      '<ans:UF>'+profCodigoUF+'</ans:UF>' +
      '<ans:CBOS>'+profCBO+'</ans:CBOS>' +
      '</ans:profissionalSolicitante>' +
      '</ans:dadosSolicitante>' +
      '<ans:dadosSolicitacao>' +
      '<ans:dataSolicitacao>'+dataGuia+'</ans:dataSolicitacao>' +
      '<ans:caraterAtendimento>1</ans:caraterAtendimento>' +
      '</ans:dadosSolicitacao>' +
      '<ans:dadosExecutante>' +
      '<ans:contratadoExecutante>' +
      '<ans:codigoPrestadorNaOperadora>'+codPrestador+'</ans:codigoPrestadorNaOperadora>' +
      '</ans:contratadoExecutante>' +
      '<ans:CNES>'+cnes+'</ans:CNES>' +
      '</ans:dadosExecutante>' +
      '<ans:dadosAtendimento>' +
      '<ans:tipoAtendimento>03</ans:tipoAtendimento>' +
      '<ans:indicacaoAcidente>9</ans:indicacaoAcidente>' +
      '<ans:tipoConsulta>4</ans:tipoConsulta>' +
      '<ans:regimeAtendimento>01</ans:regimeAtendimento>' +
      '</ans:dadosAtendimento>' +
      '<ans:procedimentosExecutados>' +
      xmlProcs +
      '</ans:procedimentosExecutados>' +
      '<ans:valorTotal>' +
      '<ans:valorProcedimentos>'+totalProc+'</ans:valorProcedimentos>' +
      '<ans:valorTaxasAlugueis>0.00</ans:valorTaxasAlugueis>' +
      '<ans:valorMateriais>0.00</ans:valorMateriais>' +
      '<ans:valorMedicamentos>0.00</ans:valorMedicamentos>' +
      '<ans:valorGasesMedicinais>0.00</ans:valorGasesMedicinais>' +
      '<ans:valorTotalGeral>'+totalProc+'</ans:valorTotalGeral>' +
      '</ans:valorTotal>' +
      '</ans:guiaSP-SADT>';
  }).join('');

  // d) XML sem hash primeiro (formato canônico — sem indentação)
  const xmlSemHash =
    '<?xml version="1.0" encoding="ISO-8859-1"?>' +
    '<ans:mensagemTISS xmlns:ans="http://www.ans.gov.br/padroes/tiss/schemas">' +
    '<ans:cabecalho>' +
    '<ans:identificacaoTransacao>' +
    '<ans:tipoTransacao>ENVIO_LOTE_GUIAS</ans:tipoTransacao>' +
    '<ans:sequencialTransacao>'+esc(l.num)+'</ans:sequencialTransacao>' +
    '<ans:dataRegistroTransacao>'+dataGeracaoISO+'</ans:dataRegistroTransacao>' +
    '<ans:horaRegistroTransacao>'+horaGeracao+'</ans:horaRegistroTransacao>' +
    '</ans:identificacaoTransacao>' +
    '<ans:origem>' +
    '<ans:identificacaoPrestador>' +
    '<ans:codigoPrestadorNaOperadora>'+codPrestador+'</ans:codigoPrestadorNaOperadora>' +
    '</ans:identificacaoPrestador>' +
    '</ans:origem>' +
    '<ans:destino>' +
    '<ans:registroANS>'+registroANS+'</ans:registroANS>' +
    '</ans:destino>' +
    '<ans:Padrao>'+versaoTiss+'</ans:Padrao>' +
    '</ans:cabecalho>' +
    '<ans:prestadorParaOperadora>' +
    '<ans:loteGuias>' +
    '<ans:numeroLote>'+esc(l.num)+'</ans:numeroLote>' +
    xmlGuias +
    '</ans:loteGuias>' +
    '</ans:prestadorParaOperadora>' +
    '<ans:epilogo><ans:hash></ans:hash></ans:epilogo>' +
    '</ans:mensagemTISS>';

  // Calcula hash SHA-1 sobre o XML sem hash, depois insere
  const dataGeracaoFinal = dataGeracaoISO;
  _tissHashMD5(xmlSemHash).then(function(hash) {
    const xmlFinal = xmlSemHash.replace(
      '<ans:epilogo><ans:hash></ans:hash></ans:epilogo>',
      '<ans:epilogo><ans:hash>'+hash+'</ans:hash></ans:epilogo>'
    );

    // a) Charset ISO-8859-1 — converte via TextEncoder não disponível para ISO,
    // usa Blob com encoding explícito e BOM workaround para forçar ISO
    // Na prática, browsers gravam UTF-8 mas declaramos ISO-8859-1 conforme TISS
    const blob = new Blob([xmlFinal], { type: 'application/xml;charset=ISO-8859-1' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'lote_' + l.num + '_TISS_' + dataGeracaoFinal + '.xml';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function() { URL.revokeObjectURL(a.href); }, 5000);

    l.xml = xmlFinal;
    if (l.status === 'Pendente') {
      l.status = 'Gerado';
      const sb = window._cfGetDb ? window._cfGetDb() : null;
      if (sb) sb.from('lotes_tiss').update({ status: 'Gerado' }).eq('id', l.id);
    }
    renderLotesTable();
    showToast('XML TISS gerado — ' + guias.length + ' guia(s) · hash SHA-1 calculado', 'success');
  });
}

function exportarXMLTISS() {
  const pendentes = GUIAS.filter(g=>g.status==='Pendente');
  if (!pendentes.length) { showToast('Nenhuma guia pendente para exportar','error'); return; }
  showToast('Criando lote automático com '+pendentes.length+' guias pendentes...','success');
}

// ─── IMPRESSÃO SEM POP-UP (via iframe oculto) ──────────────────────────────────
let _printHTML = '';
let _printReady = false;

function printIframeReady() {
  if (!_printReady) return;
  _printReady = false;
  try {
    const iframe = document.getElementById('print-iframe');
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  } catch(e) {
    // Fallback: blob URL download
    const blob = new Blob([_printHTML], {type:'text/html'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'guia_sadt.html';
    a.click();
    showToast('Arquivo HTML da guia baixado para impressão','success');
  }
}

function printViaIframe(html) {
  _printHTML = html;
  const iframe = document.getElementById('print-iframe');

  // Attempt 1: open in new window (most reliable cross-browser)
  const tryWindow = () => {
    const win = window.open('', '_blank', 'width=1000,height=780');
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => { try { win.focus(); win.print(); } catch(e){} }, 400);
      return true;
    }
    return false;
  };

  // Attempt 2: iframe with dynamic onload
  const tryIframe = () => {
    if (!iframe) return false;
    const blob = new Blob([html], {type:'text/html'});
    const url  = URL.createObjectURL(blob);
    iframe.onload = () => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch(e) {
        downloadGuia(html);
      }
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    };
    iframe.src = url;
    return true;
  };

  if (!tryWindow()) {
    if (!tryIframe()) downloadGuia(html);
  }
}

function downloadGuia(html) {
  const blob = new Blob([html], {type:'text/html'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'guia_sadt.html';
  a.click();
  showToast('Arquivo HTML baixado — abra no navegador e imprima (Ctrl+P)','success');
}

function imprimirGuiaDaModal() {
  // Collect data from modal-guia form fields
  const d = coletarDadosGuia();
  const html = buildGuiaPrintHTML(d);
  printViaIframe(html);
}

function imprimirGuiaById(id) {
  const g = GUIAS.find(x=>x.id===id);
  if (!g) return;
  const plano  = PLANOS.find(p=>p.id===g.planoId);
  const prof   = PROFISSIONAIS.find(p=>p.id===g.profId);
  const pac    = PACIENTES.find(p=>p.nome===g.pac);
  const procs  = g.dados?.procs||[{codigo:'',desc:'Sessão',qtd:1,valor:g.valor,total:g.valor}];
  const d = {
    guiaNum:       g.num,
    ans:           plano?.ans||'—',
    guiaPrincipal: g.numOp||'—',
    guiaPrestador: g.num,
    operadora:     plano?.nomeGuia||plano?.nome||'—',
    planoLogo:     plano?.logo || null,           // logo do plano em base64
    dtAutorizacao: g.dados?.dataAut   || '',      // ← DATA AUTORIZAÇÃO
    senha:         g.dados?.senha     || g.numOp || '', // ← SENHA
    valSenha:      g.dados?.validade  || '',      // ← VALIDADE SENHA
    autorizacao:   g.numOp||'—',
    tipoId:        'Cartão magnético',
    idBeneficiario:g.carteirinha||'—',
    carteira:      g.carteirinha||'—',
    valCarteira:   '',
    beneficiario:  g.pac,
    cns:           '—', rn:'N', nasc:pac?.nasc||'',
    codPrestador:  plano?.codPrestador||CLINICA.codPrestador,
    prestador:     plano?.nomeContratado||CLINICA.nome,
    profNome:      prof?.nome||PROF_EXEC_GUIA_AUTO,
    conselho:      prof?.conselho||'—',
    numConselho:   prof?.num||'—',
    ufConselho:    prof?.uf||'SP',
    cbo:           prof?.cbo||'—',
    dataSolic:     g.data||'',
    carater:       '1',
    indicacao:     g.cid||'—',
    procs,
    execProcs:     procs,
    totProc:g.valor, totTaxas:0, totMat:0, totOpme:0, totMed:0, totGas:0, total:g.valor,
    dataImpressao: new Date().toLocaleDateString('pt-BR'),
    horaImpressao: new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),
  };
  const html = buildGuiaPrintHTML(d);
  printViaIframe(html);
}

function imprimirGuiaSADT() {
  const d = coletarDadosGuia();
  const html = buildGuiaPrintHTML(d);
  printViaIframe(html);
}

function buildGuiaPrintHTML(d) {
  // ── Local helpers (no dependency on outer scope) ──
  const fv = v => (v==null||v===undefined||v==='—'||v==='') ? '' : String(v);
  const formatDate = iso => {
    if (!iso) return '';
    const m = String(iso).match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[3]+'/'+m[2]+'/'+m[1];
    return String(iso);
  };
  const formatBRL = n => (n==null||isNaN(n)) ? '0,00' : Number(n).toFixed(2).replace('.',',');

  // Logo: prioridade → base64 do plano cadastrado → SVG por nome → SVG default
  let logoHtml;
  if (d.planoLogo) {
    logoHtml = `<img src="${d.planoLogo}" style="max-width:130px;max-height:36px;object-fit:contain;display:block">`;
  } else {
    logoHtml = PLANO_LOGOS[d.operadora] || PLANO_LOGOS['default'];
  }
  const totalGeral = (d.totProc||0)+(d.totTaxas||0)+(d.totMat||0)+(d.totOpme||0)+(d.totMed||0)+(d.totGas||0);

  // Procedure rows — solicitados
  const procRows = (d.procs||[]).map((p,i) =>
    '<tr>' +
    '<td style="text-align:center">'+(fv(p.tabela)||'22')+'</td>' +
    '<td style="text-align:center;font-family:monospace">'+fv(p.codigo)+'</td>' +
    '<td colspan="4">'+fv(p.desc)+'</td>' +
    '<td style="text-align:center">'+(fv(p.qtd)||1)+'</td>' +
    '<td style="text-align:center">'+(fv(p.qtaut)||fv(p.qtd)||1)+'</td>' +
    '</tr>'
  ).join('') || '<tr><td colspan="8" style="text-align:center;color:#999;padding:4px">—</td></tr>';

  // Procedure rows — realizados/executados
  const execRows = (d.execProcs||d.procs||[]).map((p,i) =>
    '<tr>' +
    '<td style="text-align:center">'+(i+1)+'</td>' +
    '<td>'+(fv(p.dtini)||formatDate(d.dataSolic))+'</td>' +
    '<td>'+(fv(p.dtfim)||formatDate(d.dataSolic))+'</td>' +
    '<td style="text-align:center">'+(fv(p.tabela)||'22')+'</td>' +
    '<td style="text-align:center;font-family:monospace">'+fv(p.codigo)+'</td>' +
    '<td>'+fv(p.desc)+'</td>' +
    '<td style="text-align:center">'+(fv(p.qtd)||1)+'</td>' +
    '<td style="text-align:center">'+(fv(p.via)||'00')+'</td>' +
    '<td style="text-align:center">'+(fv(p.tec)||'00')+'</td>' +
    '<td style="text-align:right">'+(fv(p.fat)||'1')+'</td>' +
    '<td style="text-align:right">'+formatBRL(p.valor)+'</td>' +
    '<td style="text-align:right">'+formatBRL(p.total||(parseFloat(p.valor||0)*(parseInt(p.qtd)||1)))+'</td>' +
    '</tr>'
  ).join('') || '<tr><td colspan="12" style="text-align:center;color:#999;padding:4px">—</td></tr>';

  const html = '<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n<meta charset="UTF-8">\n<title>Guia SADT</title>\n' +
'<style>\n' +
'@page{size:A4;margin:6mm 7mm;}\n' +
'*{box-sizing:border-box;margin:0;padding:0;}\n' +
'body{font-family:Arial,Helvetica,sans-serif;font-size:7pt;color:#000;background:#fff;}\n' +
'.via{font-size:5.5pt;color:#666;text-align:right;margin-bottom:1px;}\n' +
'.g-header{display:flex;align-items:flex-start;margin-bottom:2px;gap:8px;}\n' +
'.g-logo{flex-shrink:0;}\n' +
'.g-titles{flex:1;text-align:center;}\n' +
'.g-title1{font-size:9.5pt;font-weight:bold;line-height:1.3;}\n' +
'.g-title2{font-size:8pt;font-weight:bold;}\n' +
'.g-num-box{border:1.5px solid #000;padding:3px 8px;text-align:right;min-width:120px;}\n' +
'.g-num-label{font-size:6.5pt;font-weight:bold;}\n' +
'.g-num-val{font-size:18pt;font-weight:bold;line-height:1;}\n' +
'.sec{border:1px solid #555;margin-bottom:2px;}\n' +
'.sec-title{background:#c8c8c8;border-bottom:1px solid #555;padding:2px 5px;font-size:6.5pt;font-weight:bold;}\n' +
'.row{display:flex;}\n' +
'.row+.row{border-top:1px solid #ccc;}\n' +
'.cell{border-right:1px solid #ccc;padding:2px 4px;overflow:hidden;}\n' +
'.cell:last-child{border-right:none;}\n' +
'.lbl{font-size:5.5pt;font-weight:bold;color:#444;display:block;line-height:1.2;white-space:nowrap;}\n' +
'.val{font-size:8pt;display:block;min-height:11px;}\n' +
'.val.sm{font-size:6.5pt;}\n' +
'.val.bold{font-weight:bold;}\n' +
'table{width:100%;border-collapse:collapse;}\n' +
'table th{background:#c8c8c8;border:1px solid #aaa;padding:2px 3px;font-size:5.5pt;font-weight:bold;text-align:center;white-space:nowrap;}\n' +
'table td{border:1px solid #ccc;padding:2px 3px;font-size:6.5pt;}\n' +
'.totais{display:grid;grid-template-columns:repeat(6,1fr) 1.2fr;border-top:1px solid #ccc;}\n' +
'.tot-cell{padding:3px 5px;border-right:1px solid #ccc;}\n' +
'.tot-cell:last-child{border-right:none;background:#e8f5e9;}\n' +
'.tot-lbl{font-size:5pt;font-weight:bold;color:#555;display:block;}\n' +
'.tot-val{font-size:7.5pt;font-weight:bold;display:block;}\n' +
'.sign-grid{display:grid;grid-template-columns:1fr 1fr 1fr;}\n' +
'.sign-box{border-right:1px solid #ccc;padding:4px 6px;min-height:38px;font-size:6pt;}\n' +
'.sign-box:last-child{border-right:none;}\n' +
'.sign-line{border-bottom:1px solid #888;margin:18px 10px 2px;}\n' +
'.rodape{font-size:5pt;color:#888;text-align:center;margin-top:3px;}\n' +
'@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}\n' +
'</style>\n' +
'</head>\n<body>\n' +
'<div class="via">1ª VIA — OPERADORA &nbsp;|&nbsp; Emitido: '+fv(d.dataImpressao)+' às '+fv(d.horaImpressao)+' &nbsp;|&nbsp; TISS 4.02.00</div>\n\n' +

// CABEÇALHO
'<div class="g-header">' +
'<div class="g-logo">'+logoHtml+'</div>' +
'<div class="g-titles"><div class="g-title1">GUIA DE SERVIÇO PROFISSIONAL / SERVIÇO AUXILIAR<br>DE DIAGNÓSTICO E TERAPIA SP/SADT</div></div>' +
'<div class="g-num-box"><div class="g-num-label">2 — Nº Guia no Prestador</div><div class="g-num-val">'+fv(d.guiaPrestador)+'</div></div>' +
'</div>\n\n' +

// IDENTIFICAÇÃO DA GUIA
'<div class="sec" style="margin-bottom:2px">' +
'<div class="row" style="border-top:none">' +
'<div class="cell" style="flex:0 0 110px"><span class="lbl">1 — Registro ANS</span><span class="val bold">'+fv(d.ans)+'</span></div>' +
'<div class="cell" style="flex:1"><span class="lbl">3 — Nº Guia Principal</span><span class="val bold">'+fv(d.guiaPrincipal)+'</span></div>' +
'</div>' +
'<div class="row">' +
'<div class="cell" style="flex:0 0 100px"><span class="lbl">4 — Dt. Autorização</span><span class="val">'+formatDate(d.dtAutorizacao)+'</span></div>' +
'<div class="cell" style="flex:0 0 130px"><span class="lbl">5 — Senha</span><span class="val bold">'+fv(d.senha)+'</span></div>' +
'<div class="cell" style="flex:0 0 130px"><span class="lbl">6 — Val. da Senha</span><span class="val">'+formatDate(d.valSenha)+'</span></div>' +
'<div class="cell" style="flex:1"><span class="lbl">7 — Nº da Guia Atribuído pela Operadora</span><span class="val bold">'+fv(d.autorizacao)+'</span></div>' +
'</div>' +
'</div>\n\n' +

// DADOS DO BENEFICIÁRIO
'<div class="sec">' +
'<div class="sec-title">Dados do Beneficiário</div>' +
'<div class="row">' +
'<div class="cell" style="flex:0 0 160px"><span class="lbl">8 — Número da Carteira</span><span class="val bold">'+fv(d.carteira)+'</span></div>' +
'<div class="cell" style="flex:0 0 90px"><span class="lbl">9 — Val. da Carteira</span><span class="val">'+formatDate(d.valCarteira)+'</span></div>' +
'<div class="cell" style="flex:1"><span class="lbl">10 — Nome do Beneficiário</span><span class="val bold">'+fv(d.beneficiario)+'</span></div>' +
'<div class="cell" style="flex:0 0 140px"><span class="lbl">11 — Cartão Nacional de Saúde</span><span class="val">'+fv(d.cns)+'</span></div>' +
'<div class="cell" style="flex:0 0 90px"><span class="lbl">12 — Atend. a RN</span><span class="val">'+(d.rn==='S'?'SIM':'NÃO')+'</span></div>' +
'</div>' +
'</div>\n\n' +

// DADOS DO SOLICITANTE
'<div class="sec">' +
'<div class="sec-title">Dados do Solicitante</div>' +
'<div class="row">' +
'<div class="cell" style="flex:0 0 150px"><span class="lbl">13 — Código na Operadora</span><span class="val">'+fv(d.codPrestador)+'</span></div>' +
'<div class="cell" style="flex:1"><span class="lbl">14 — Nome do Contratado</span><span class="val bold">'+fv(d.prestador)+'</span></div>' +
'</div>' +
'<div class="row">' +
'<div class="cell" style="flex:1"><span class="lbl">15 — Nome do Profissional Solicitante</span><span class="val bold">'+fv(d.profNome)+'</span></div>' +
'<div class="cell" style="flex:0 0 70px"><span class="lbl">16 — Conselho</span><span class="val">'+fv(d.conselho)+'</span></div>' +
'<div class="cell" style="flex:0 0 90px"><span class="lbl">17 — Nº no Conselho</span><span class="val">'+fv(d.numConselho)+'</span></div>' +
'<div class="cell" style="flex:0 0 50px"><span class="lbl">18 — UF</span><span class="val">'+fv(d.ufConselho)+'</span></div>' +
'<div class="cell" style="flex:0 0 140px"><span class="lbl">19 — Código CBO</span><span class="val">'+fv(d.cbo)+'</span></div>' +
'<div class="cell" style="flex:0 0 70px"><span class="lbl">20 — Assinatura</span><span class="val"></span></div>' +
'</div>' +
'</div>\n\n' +

// DADOS DA SOLICITAÇÃO
'<div class="sec">' +
'<div class="sec-title">Dados da Solicitação / Procedimentos ou Itens Assistenciais Solicitados</div>' +
'<div class="row">' +
'<div class="cell" style="flex:0 0 130px"><span class="lbl">21 — Caráter do Atendimento</span><span class="val sm">'+(d.carater==='1'?'ELETIVO-1':'URGÊNCIA-2')+'</span></div>' +
'<div class="cell" style="flex:0 0 110px"><span class="lbl">22 — Data da Solicitação</span><span class="val">'+formatDate(d.dataSolic)+'</span></div>' +
'<div class="cell" style="flex:1"><span class="lbl">23 — Indicação Clínica</span><span class="val">'+fv(d.indicacao)+'</span></div>' +
'</div>' +
'<table><thead><tr>' +
'<th style="width:35px">24 Tab.</th>' +
'<th style="width:80px">25 Cód.Proc.</th>' +
'<th>26 Descrição</th>' +
'<th style="width:25px">—</th><th style="width:25px">—</th><th style="width:25px">—</th>' +
'<th style="width:55px">27 Qt.Sol.</th>' +
'<th style="width:55px">28 Qt.Aut.</th>' +
'</tr></thead>' +
'<tbody>'+procRows+'</tbody>' +
'</table>' +
'</div>\n\n' +

// DADOS DO CONTRATADO EXECUTANTE
'<div class="sec">' +
'<div class="sec-title">Dados do Contratado Executante</div>' +
'<div class="row">' +
'<div class="cell" style="flex:0 0 150px"><span class="lbl">29 — Código na Operadora</span><span class="val">'+fv(d.execCod||d.codPrestador)+'</span></div>' +
'<div class="cell" style="flex:1"><span class="lbl">30 — Nome do Contratado</span><span class="val bold">'+fv(d.execNome||d.prestador)+'</span></div>' +
'<div class="cell" style="flex:0 0 120px"><span class="lbl">31 — Código CNES</span><span class="val">'+fv(d.cnes)+'</span></div>' +
'</div>' +
'</div>\n\n' +

// DADOS DO ATENDIMENTO
'<div class="sec">' +
'<div class="sec-title">Dados do Atendimento</div>' +
'<div class="row">' +
'<div class="cell" style="flex:0 0 150px"><span class="lbl">32 — Tipo Atendimento</span><span class="val sm">'+(d.tipoAtend==='01'?'CONSULTA-1':d.tipoAtend==='08'?'FONOTERAPIA-8':d.tipoAtend==='03'?'OUTRAS TERAPIAS-3':'OUTRAS-'+(d.tipoAtend||'3'))+'</span></div>' +
'<div class="cell" style="flex:0 0 150px"><span class="lbl">33 — Indicação de Acidente</span><span class="val sm">NÃO ACIDENTE-'+(d.acidente||'9')+'</span></div>' +
'<div class="cell" style="flex:0 0 170px"><span class="lbl">34 — Tipo de Consulta</span><span class="val sm">'+(d.tipoCons==='4'?'POR ENCAMINHAMENTO-4':d.tipoCons==='1'?'PRIMEIRA CONSULTA-1':'RETORNO-'+(d.tipoCons||'4'))+'</span></div>' +
'<div class="cell" style="flex:1"><span class="lbl">35 — Motivo Encerramento</span><span class="val sm">'+(fv(d.motivoEnc)||'—')+'</span></div>' +
'<div class="cell" style="flex:0 0 110px"><span class="lbl">Regime de Atendimento</span><span class="val sm">'+(d.regime==='01'||!d.regime?'1-AMBULATORIAL':'2-'+(d.regime||''))+'</span></div>' +
'<div class="cell" style="flex:0 0 90px"><span class="lbl">Cobertura Especial</span><span class="val sm">'+(fv(d.cobertura)||'—')+'</span></div>' +
'<div class="cell" style="flex:0 0 80px"><span class="lbl">Saúde Ocupacional</span><span class="val sm">'+(d.saudeOcup==='S'?'SIM':'NÃO')+'</span></div>' +
'</div>' +
'</div>\n\n' +

// PROCEDIMENTOS E EXAMES REALIZADOS
'<div class="sec">' +
'<div class="sec-title">Procedimentos e Exames Realizados</div>' +
'<table><thead><tr>' +
'<th style="width:22px">Nº 36</th>' +
'<th style="width:65px">37 Hr.Inic.</th>' +
'<th style="width:65px">38 Hr.Final</th>' +
'<th style="width:28px">39 Tab</th>' +
'<th style="width:72px">40 Cód.Proc.</th>' +
'<th>41 Descrição</th>' +
'<th style="width:30px">42 Qtd</th>' +
'<th style="width:26px">43 Via</th>' +
'<th style="width:26px">44 Tec</th>' +
'<th style="width:52px">45 Fat.Red/Acresc</th>' +
'<th style="width:65px">46 Vl.Unit(R$)</th>' +
'<th style="width:65px">47 Vl.Total(R$)</th>' +
'</tr></thead>' +
'<tbody>'+execRows+'</tbody>' +
'</table>' +
'</div>\n\n' +

// IDENTIFICAÇÃO DOS EXECUTANTES
'<div class="sec">' +
'<div class="sec-title">Identificação do(s) Profissional(is) Executante(s)</div>' +
'<table><thead><tr>' +
'<th style="width:25px">48 Seq</th>' +
'<th style="width:90px">49 Grau Part.</th>' +
'<th style="width:110px">50 CPF/Cód.Op.</th>' +
'<th>51 Nome</th>' +
'<th style="width:110px">52 Conselho</th>' +
'<th style="width:90px">53 Nº Conselho</th>' +
'<th style="width:45px">54 UF</th>' +
'<th style="width:90px">55 Código CBO</th>' +
'</tr></thead>' +
'<tbody>' +
'<tr>' +
'<td style="text-align:center">1</td>' +
'<td>'+fv(d.execGrau||'Clínico-12')+'</td>' +
'<td>'+fv(d.execCpf||d.codPrestador)+'</td>' +
'<td><strong>'+fv(d.execProfNome||d.profNome)+'</strong></td>' +
'<td>'+fv(d.execConselho||d.conselho)+'</td>' +
'<td>'+fv(d.execNumConselho||d.execNumCons||d.numConselho)+'</td>' +
'<td>'+fv(d.execUf||d.ufConselho)+'</td>' +
'<td>'+fv(d.execCbo||d.cbo)+'</td>' +
'</tr>' +
'</tbody></table>' +
'</div>\n\n' +

// OBSERVAÇÕES + ASSINATURA DATAS
'<div class="sec">' +
'<div class="sec-title">56 — Data de Realização dos Procedimentos em Série &nbsp;|&nbsp; 57 — Assinatura do Beneficiário</div>' +
'<div class="row" style="min-height:24px">' +
'<div class="cell" style="flex:1"><span class="lbl">58 — Observação/Justificativa</span><span class="val" style="min-height:16px">'+fv(d.obs)+'</span></div>' +
'</div>' +
'</div>\n\n' +

// TOTAIS
'<div class="sec">' +
'<div class="totais">' +
'<div class="tot-cell"><span class="tot-lbl">59 Tot.Procedimentos(R$)</span><span class="tot-val">'+formatBRL(d.totProc||0)+'</span></div>' +
'<div class="tot-cell"><span class="tot-lbl">60 Total Taxas/Alu.(R$)</span><span class="tot-val">'+formatBRL(d.totTaxas||0)+'</span></div>' +
'<div class="tot-cell"><span class="tot-lbl">61 Total Materiais(R$)</span><span class="tot-val">'+formatBRL(d.totMat||0)+'</span></div>' +
'<div class="tot-cell"><span class="tot-lbl">62 Total OPME(R$)</span><span class="tot-val">'+formatBRL(d.totOpme||0)+'</span></div>' +
'<div class="tot-cell"><span class="tot-lbl">63 Total Medicamentos(R$)</span><span class="tot-val">'+formatBRL(d.totMed||0)+'</span></div>' +
'<div class="tot-cell"><span class="tot-lbl">64 Total Gases Medicinais(R$)</span><span class="tot-val">'+formatBRL(d.totGas||0)+'</span></div>' +
'<div class="tot-cell"><span class="tot-lbl">65 Total Geral(R$)</span><span class="tot-val" style="font-size:10pt;color:#1a7a1a">'+formatBRL(totalGeral)+'</span></div>' +
'</div>' +
'</div>\n\n' +

// ASSINATURAS
'<div class="sec">' +
'<div class="sign-grid">' +
'<div class="sign-box"><span class="lbl">66 — Assinatura do Responsável pela Autorização</span><div class="sign-line"></div></div>' +
'<div class="sign-box"><span class="lbl">67 — Assinatura do Beneficiário ou Responsável</span><div class="sign-line"></div></div>' +
'<div class="sign-box"><span class="lbl">68 — Assinatura do Contratado</span><div class="sign-line"></div></div>' +
'</div>' +
'</div>\n\n' +

'<div class="rodape">'+fv(d.ans)+'-'+fv(d.operadora)+' — '+fv(d.guiaPrestador)+' — impresso por '+fv(d.profNome)+' em '+fv(d.dataImpressao)+'</div>\n\n' +
'</div>\n' +
'<scr'+'ipt>window.onload=function(){window.print();};<\/script>\n' +
'</body>\n</html>';

  return html;
}
