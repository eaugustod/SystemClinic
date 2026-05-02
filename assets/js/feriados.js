// ═══════════════════════════════════════════════════════════════════
//  FERIADOS — Cadastro e gestão
// ═══════════════════════════════════════════════════════════════════
let FERIADOS = []; // [{data:'2026-04-21',desc:'Tiradentes'}, ...]

function carregarFeriados() {
  try {
    const saved = localStorage.getItem('cf_feriados');
    if (saved) FERIADOS = JSON.parse(saved);
    // Feriados nacionais fixos de 2026 como padrão inicial
    if (!FERIADOS.length) {
      FERIADOS = [
        {data:'2026-01-01',desc:'Confraternização Universal'},
        {data:'2026-02-16',desc:'Carnaval'},
        {data:'2026-02-17',desc:'Carnaval'},
        {data:'2026-02-18',desc:'Quarta de Cinzas'},
        {data:'2026-04-03',desc:'Sexta-feira Santa'},
        {data:'2026-04-05',desc:'Páscoa'},
        {data:'2026-04-21',desc:'Tiradentes'},
        {data:'2026-05-01',desc:'Dia do Trabalho'},
        {data:'2026-06-04',desc:'Corpus Christi'},
        {data:'2026-09-07',desc:'Independência do Brasil'},
        {data:'2026-10-12',desc:'Nossa Senhora Aparecida'},
        {data:'2026-11-02',desc:'Finados'},
        {data:'2026-11-15',desc:'Proclamação da República'},
        {data:'2026-11-20',desc:'Consciência Negra'},
        {data:'2026-12-25',desc:'Natal'},
      ];
    }
  } catch(e) { FERIADOS = []; }
}

function isFeriado(isoDate) {
  return FERIADOS.some(f => f.data === isoDate);
}

function abrirFeriados() {
  carregarFeriados();
  renderFeriadosTable();
  const inp = document.getElementById('feriado-data');
  if (inp) inp.valueAsDate = new Date();
  openModal('modal-feriados');
}

function renderFeriadosTable() {
  const tbody = document.getElementById('feriados-tbody');
  if (!tbody) return;
  const sorted = [...FERIADOS].sort((a,b) => a.data.localeCompare(b.data));
  if (!sorted.length) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:var(--text-muted)">Nenhum feriado cadastrado</td></tr>';
    return;
  }
  tbody.innerHTML = sorted.map(f => {
    const [y,m,d] = f.data.split('-');
    const dateFmt = `${d}/${m}/${y}`;
    const dow = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][new Date(f.data+'T12:00:00').getDay()];
    return `<tr>
      <td style="font-family:var(--font-mono);font-size:12px">${dateFmt} <span style="color:var(--text-muted);font-size:11px">${dow}</span></td>
      <td>${f.desc}</td>
      <td><button class="action-btn" style="color:var(--danger)" onclick="removerFeriado('${f.data}')">${DEL_ICON}</button></td>
    </tr>`;
  }).join('');
}

function adicionarFeriado() {
  const data = document.getElementById('feriado-data')?.value;
  const desc = document.getElementById('feriado-desc')?.value.trim();
  if (!data) { showToast('Informe a data','error'); return; }
  if (!desc) { showToast('Informe a descrição','error'); return; }
  if (FERIADOS.some(f => f.data === data)) { showToast('Data já cadastrada','error'); return; }
  FERIADOS.push({data, desc});
  FERIADOS.sort((a,b) => a.data.localeCompare(b.data));
  renderFeriadosTable();
  document.getElementById('feriado-desc').value = '';
}

function removerFeriado(data) {
  FERIADOS = FERIADOS.filter(f => f.data !== data);
  renderFeriadosTable();
}

function salvarFeriados() {
  localStorage.setItem('cf_feriados', JSON.stringify(FERIADOS));
  showToast('Feriados salvos!', 'success');
  closeModal('modal-feriados');
}

