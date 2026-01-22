
// === Leaderboard embedded ke Home (tanpa iframe) ===

// KONFIGURASI
const SHEET_ID = "1UBrdYls_Ed0GIXCSPghK9C3du5dEhbdx"; // ganti jika perlu
const GID = "371192175"; // ganti jika perlu
const HEADERS_EXPECT = ["No Member","Nama","Point"];

const GVIZ_URL = (id,gid) => `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json&gid=${gid}`;
const CSV_URL  = (id,gid) => `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;

const state = { rows: [], filtered: [], limit: 10, query: "", rankMap: {} };

// Ambil elemen sekali
const el = {
  body: document.getElementById("boardBody"),
  meta: document.getElementById("meta"),
  search: document.getElementById("searchBox"),
  limit: document.getElementById("limitSelect"),
  refresh: document.getElementById("refreshBtn"),
  info: document.getElementById("searchInfo"),
  statTotal: document.getElementById("statTotal"),
  statAvg: document.getElementById("statAvg"),
  barTotal: document.getElementById("barTotal"),
  barAvg: document.getElementById("barAvg"),
};

// Fetch dengan fallback GVIZ -> CSV
async function fetchSheet(){
  if (el.body) el.body.innerHTML = `<tr><td colspan="4" class="empty">Memuat data…</td></tr>`;
  if (await tryFetchGviz()) return;
  if (await tryFetchCsv())  return;

  if (el.body) el.body.innerHTML = `<tr><td colspan="4" class="empty">Gagal memuat data. Pastikan Sheet dibagikan publik dan sudah <strong>Publish to the web</strong>.</td></tr>`;
  if (el.meta) el.meta.textContent = `Fetch gagal • ${new Date().toLocaleString('id-ID')}`;
}

async function tryFetchGviz(){
  try{
    const res = await fetch(GVIZ_URL(SHEET_ID, GID), { cache: 'no-store' });
    const text = await res.text();
    // Buang wrapper google.visualization
    const jsonStr = text.replace(/^[\s\S]*?\(/, '').replace(/\);\s*$/, '');
    const payload = JSON.parse(jsonStr);
    if (!payload.table) throw new Error('payload.table kosong');

    const headers = payload.table.cols.map(c => (c.label || '').trim());
    const rows = payload.table.rows.map(r => {
      const c = r.c || [];
      const o = {};
      headers.forEach((label, i) => { o[label] = c[i]?.v ?? ''; });
      return o;
    });

    applyAndRender(rows, headers, 'Google Visualization (JSON)');
    return true;
  } catch(e){
    console.warn('GVIZ gagal:', e);
    return false;
  }
}

async function tryFetchCsv(){
  try{
    const res = await fetch(CSV_URL(SHEET_ID, GID), { cache: 'no-store' });
    const csv = await res.text();
    const { headers, rows } = parseCsv(csv);
    applyAndRender(rows, headers, 'CSV export');
    return true;
  } catch(e){
    console.warn('CSV gagal:', e);
    return false;
  }
}

function parseCsv(text){
  const lines = text.trim().split(/\r?\n/);
  const headers = splitCsvLine(lines[0]).map(h=>h.trim());
  const rows = lines.slice(1).map(line=>{
    const cols = splitCsvLine(line);
    const o = {};
    headers.forEach((h,i)=>{ o[h] = (cols[i]??'').trim(); });
    return o;
  });
  return { headers, rows };
}

// Parser CSV aman (kutip ganda & koma)
function splitCsvLine(line){
  const out = [];
  let cur = '', quoted = false;
  for (let i=0; i<line.length; i++){
    const ch = line[i];
    if (ch === '"'){
      if (quoted && line[i+1] === '"'){ cur += '"'; i++; }
      else { quoted = !quoted; }
    } else if (ch === ',' && !quoted){
      out.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function normalizeHeaderMap(headers, expected){
  const lower = headers.map(h => String(h||'').toLowerCase());
  const map = {};
  expected.forEach(exp=>{
    const idx = lower.indexOf(exp.toLowerCase());
    if (idx >= 0) map[exp] = headers[idx];
  });
  return map;
}

function applyAndRender(rows, headers, source){
  const map = normalizeHeaderMap(headers, HEADERS_EXPECT);
  const data = rows.map(r => ({
    'No Member': r[map['No Member']] ?? r['No Member'] ?? '',
    'Nama'     : r[map['Nama']]      ?? r['Nama']      ?? '',
    'Point'    : Number(r[map['Point']] ?? r['Point'] ?? 0) || 0
  }));

  // Sort desc by Point
  data.sort((a,b)=> Number(b['Point']) - Number(a['Point']));

  // Rank map
  const rankMap = {};
  data.forEach((row, i) => {
    const key = String(row['No Member'] ?? '').trim();
    if (key) rankMap[key] = i + 1;
  });

  state.rows = data;
  state.rankMap = rankMap;

  renderPodium(state.rows);
  updateStats();
  applyFilter();
  render();

  if (el.meta) el.meta.textContent = `Sumber: ${source} • ${state.filtered.length} baris • ${new Date().toLocaleString('id-ID')}`;
}

function applyFilter(){
  const q = state.query.trim().toLowerCase();
  state.filtered = !q
    ? [...state.rows]
    : state.rows.filter(r =>
        String(r['No Member']).toLowerCase().includes(q) ||
        String(r['Nama']).toLowerCase().includes(q)
      );
}

function rankBadge(rank){
  const n = Number(rank);
  return `<span class="rank-badge">#${n}</span>`;
}

function render(){
  const isSearching = !!state.query.trim();
  const top1Points = Number(state.rows[0]?.['Point'] ?? 0);

  // Search info
  if (isSearching){
    if (state.filtered.length === 0){
      el.info.style.display='none';
      el.info.innerHTML='';
    } else {
      const r = state.filtered[0];
      const no = String(r['No Member'] ?? '').trim();
      const nama = String(r['Nama'] ?? '').trim();
      const pts = Number(r['Point'] ?? 0);
      const rank = state.rankMap[no] ?? '-';
      const gap = Math.max(top1Points - pts, 0);
      el.info.innerHTML = `
        <div class="search-item">
          <div class="rank">#${rank}</div>
          <div>
            <div class="name">${nama}</div>
            <div class="member">${no}</div>
          </div>
          <div class="points mono">${pts.toLocaleString('id-ID')} pts</div>
          <div class="gap mono">Gap ke #1: ${gap.toLocaleString('id-ID')}</div>
        </div>`;
      el.info.style.display='block';
    }
  } else {
    el.info.style.display='none';
    el.info.innerHTML='';
  }

  // Skip podium 3 besar jika tidak mencari
  const startIndex = isSearching ? 0 : Math.min(3, state.filtered.length);
  const remaining = Math.max(state.filtered.length - startIndex, 0);
  const limit = state.limit === 0 ? remaining : Math.min(state.limit, remaining);
  const slice = state.filtered.slice(startIndex, startIndex + limit);

  if (slice.length === 0){
    el.body.innerHTML = `<tr><td colspan="4" class="empty">Tidak ada data.</td></tr>`;
    return;
  }

  const rowsHtml = slice.map(r => {
    const key = String(r['No Member'] ?? '').trim();
    const rank = state.rankMap[key] ?? '-';
    const point = Number(r['Point'] ?? 0).toLocaleString('id-ID');
    return `
      <tr>
        <td>${rankBadge(rank)}</td>
        <td class="mono">${r['No Member'] ?? ''}</td>
        <td>${r['Nama'] ?? ''}</td>
        <td class="mono"><strong>${point}</strong></td>
      </tr>`;
  }).join('');

  el.body.innerHTML = rowsHtml;
}

function renderPodium(sortedRows){
  const top3 = (sortedRows || state.rows).slice(0, 3);
  const p1 = top3[0] || { 'Nama':'—', 'No Member':'—', 'Point':0 };
  const p2 = top3[1] || { 'Nama':'—', 'No Member':'—', 'Point':0 };
  const p3 = top3[2] || { 'Nama':'—', 'No Member':'—', 'Point':0 };

  const set = (id, text) => { const e = document.getElementById(id); if (e) e.textContent = text; };

  set('podium1-name', String(p1['Nama']));
  set('podium1-member', String(p1['No Member']));
  set('podium1-point', Number(p1['Point']||0).toLocaleString('id-ID'));

  set('podium2-name', String(p2['Nama']));
  set('podium2-member', String(p2['No Member']));
  set('podium2-point', Number(p2['Point']||0).toLocaleString('id-ID'));

  set('podium3-name', String(p3['Nama']));
  set('podium3-member', String(p3['No Member']));
  set('podium3-point', Number(p3['Point']||0).toLocaleString('id-ID'));

  const meta = document.getElementById('podiumMeta');
  if (meta) meta.textContent = `Teratas saat ini • diperbarui ${new Date().toLocaleString('id-ID')}`;
}

function updateStats(){
  const total = state.rows.length;
  const sumPts = state.rows.reduce((s,r)=> s + Number(r['Point']||0), 0);
  const avg = total ? (sumPts / total) : 0;

  if (el.statTotal) el.statTotal.textContent = total.toLocaleString('id-ID');
  if (el.statAvg)   el.statAvg.textContent   = Math.round(avg).toLocaleString('id-ID');

  if (el.barTotal) el.barTotal.style.width = Math.min(100, (total/100)*100) + '%';
  if (el.barAvg)   el.barAvg.style.width   = Math.min(100, (avg/5000)*100) + '%';
}

/* Events */
el.search && el.search.addEventListener('input',(e)=>{ state.query=e.target.value; applyFilter(); render(); });
el.limit  && el.limit.addEventListener('change',(e)=>{ state.limit=Number(e.target.value); render(); });
el.refresh&& el.refresh.addEventListener('click',()=>{ fetchSheet(); });

/* Start */
fetchSheet();
``
