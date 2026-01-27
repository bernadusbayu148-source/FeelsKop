/* assets/js/leaderboard-inline.js — podium bertingkat + top10 + search
   Penambahan:
   - Hasil pencarian MUNCUL di bawah kolom pencarian (inline).
   - Tampilkan selisih poin ke #1.
   - Tombol 'hapus' (X) untuk membersihkan kolom pencarian.
   Mode tampilan daftar:
   - ≤ 480px : list-card mobile (tanpa header keterangan)
   - > 480px : tabel seperti biasa
*/
(() => {
  // ====== Konfigurasi ======
  const SHEET_ID = "1UBrdYls_Ed0GIXCSPghK9C3du5dEhbdx";
  const GID = "371192175";
  const HEADERS_EXPECT = ["No Member","Nama","Point"];
  const GVIZ_URL = (id,gid) => `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json&gid=${gid}`;
  const CSV_URL  = (id,gid) => `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;

  // ====== State & element ======
  const nf = new Intl.NumberFormat('id-ID');
  const el = {
    podium: document.getElementById('lb-podium'),
    tbBody: document.getElementById('lb-table-body'),
    meta: document.getElementById('lb-meta'),
    search: document.getElementById('lb-search'),
    refresh: document.getElementById('lb-refresh'),
    sInfo: document.getElementById('lb-search-info'),
    statTotal: document.getElementById('lb-stat-total'),
    statAvg: document.getElementById('lb-stat-avg'),
    barTotal: document.getElementById('lb-bar-total'),
    barAvg: document.getElementById('lb-bar-avg'),
  };
  const state = { rows: [], filtered: [], query: "", rankMap: {} };
  let currentAbort;

  // ====== Utils ======
  const toInt = v => {
    const n = Number(String(v ?? '').replace(/[^\d\-.]/g,''));
    return Number.isFinite(n) ? n : 0;
  };
  function normalizeHeaderMap(headers, expects){
    const lower = headers.map(h => String(h ?? '').trim().toLowerCase());
    const map = {};
    expects.forEach(exp => {
      const target = exp.toLowerCase();
      const idx = lower.findIndex(h =>
        h === target ||
        h.replace(/\s+/g,'') === target.replace(/\s+/g,'') ||
        (exp === "No Member" && /no.*member|member.*no|nomor.*member/.test(h)) ||
        (exp === "Point" && /point|poin|score|nilai/.test(h))
      );
      if (idx >= 0) map[exp] = headers[idx];
    });
    return map;
  }
  // CSV parser aman
  function splitCsvLine(line){
    const out=[]; let cur=""; let q=false;
    for (let i=0;i<line.length;i++){
      const ch=line[i];
      if (ch === '"'){
        if (q && line[i+1] === '"'){ cur+='"'; i++; }
        else q = !q;
      } else if (ch === ',' && !q){
        out.push(cur); cur="";
      } else cur += ch;
    }
    out.push(cur);
    return out;
  }
  function parseCsv(text){
    const lines = text.trim().split(/\r?\n/);
    const headers = splitCsvLine(lines[0]).map(h=>h.trim());
    const rows = lines.slice(1).map(line=>{
      const cols = splitCsvLine(line);
      const o={}; headers.forEach((h,i)=> o[h] = (cols[i] ?? '').trim());
      return o;
    });
    return { headers, rows };
  }
  function esc(s){
    return String(s ?? '').replace(/[&<>\"']/g,c=>({'&':'&','<':'<','>':'>','"':'"','\'':'&#39;'}[c]));
  }

  // ====== Buat UI tambahan: wrapper search + tombol hapus + container hasil inline ======
  function ensureSearchEnhancements(){
    // Bungkus input agar bisa menaruh tombol hapus di dalamnya
    if (!el.search.closest('.search-wrap')){
      const wrap = document.createElement('div');
      wrap.className = 'search-wrap';
      el.search.parentNode.insertBefore(wrap, el.search);
      wrap.appendChild(el.search);
      // Tombol clear
      const clr = document.createElement('button');
      clr.type = 'button';
      clr.className = 'clear-btn';
      clr.setAttribute('aria-label', 'Bersihkan pencarian');
      clr.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
      wrap.appendChild(clr);
      // Event clear
      clr.addEventListener('click', () => {
        el.search.value = '';
        state.query = '';
        applyFilter();
        renderTable();
        renderSearchInline(); // kosongkan
        el.search.focus();
        toggleClearButton();
      });
      // Toggle visibilitas tombol
      function toggleClearButton(){
        if (el.search.value.trim().length > 0) clr.classList.add('visible');
        else clr.classList.remove('visible');
      }
      el.search.addEventListener('input', toggleClearButton);
      // panggil sekali awal
      toggleClearButton();
    }
    // Container hasil inline di bawah baris kontrol
    if (!document.getElementById('lb-search-inline')){
      const controls = el.search.closest('.lb-controls');
      if (controls){
        const inline = document.createElement('div');
        inline.id = 'lb-search-inline';
        inline.className = 'lb-search-inline';
        controls.insertAdjacentElement('afterend', inline);
      }
    }
  }

  // ====== Fetch ======
  function cancelInFlight(){ if (currentAbort) currentAbort.abort(); }
  async function fetchSheet(){
    cancelInFlight(); currentAbort = new AbortController();
    el.podium.innerHTML = `<div class="empty" style="grid-column:1/-1; text-align:center;">Memuat data…</div>`;
    el.tbBody.innerHTML = `<tr><td colspan="4" class="empty">Memuat data…</td></tr>`;
    if (el.sInfo){ el.sInfo.hidden = true; el.sInfo.innerHTML = ''; } // tidak dipakai lagi
    if (el.meta) el.meta.textContent = ''; // disembunyikan via CSS
    const okG = await tryFetchGviz(currentAbort.signal); if (okG) return;
    const okC = await tryFetchCsv(currentAbort.signal);  if (okC) return;
    el.tbBody.innerHTML = `<tr><td colspan="4" class="empty">Gagal memuat data. Pastikan Sheet publik & telah dipublikasikan.</td></tr>`;
  }
  async function tryFetchGviz(signal){
    try{
      const res = await fetch(GVIZ_URL(SHEET_ID, GID), { cache:'no-store', signal });
      const text = await res.text();
      const jsonStr = text.replace(/^[^\(]+\(/,"").replace(/\)\s*;?\s*$/,"");
      const payload = JSON.parse(jsonStr);
      if (!payload.table) throw new Error('payload.table kosong');
      const headers = payload.table.cols.map(c => (c.label ?? '').trim());
      const rows = payload.table.rows.map(r => {
        const c = r.c ?? []; const o={};
        headers.forEach((label,i)=> o[label] = c[i]?.v ?? '');
        return o;
      });
      applyAndRender(rows, headers);
      return true;
    }catch(e){ console.warn('GVIZ gagal:', e); return false; }
  }
  async function tryFetchCsv(signal){
    try{
      const res = await fetch(CSV_URL(SHEET_ID, GID), { cache:'no-store', signal });
      const csv = await res.text();
      const { headers, rows } = parseCsv(csv);
      applyAndRender(rows, headers);
      return true;
    }catch(e){ console.warn('CSV gagal:', e); return false; }
  }

  // ====== Transform & render ======
  function applyAndRender(rows, headers){
    const map = normalizeHeaderMap(headers, HEADERS_EXPECT);
    const data = rows.map(r => ({
      'No Member': r[map['No Member']] ?? r['No Member'] ?? '',
      'Nama'     : r[map['Nama']]      ?? r['Nama']      ?? '',
      'Point'    : toInt(r[map['Point']] ?? r['Point']   ?? 0),
    }));
    data.sort((a,b) => b['Point'] - a['Point']);
    const rankMap={}; data.forEach((row,i)=>{ const key=String(row['No Member'] ?? '').trim(); if (key) rankMap[key]=i+1; });
    state.rows = data; state.rankMap = rankMap;
    ensureSearchEnhancements(); // buat UI tambahan
    updateStats();
    renderPodium();
    applyFilter();
    renderTable();
    renderSearchInline(); // kosongkan/isi sesuai query
  }

  function updateStats(){
    const total = state.rows.length;
    const sumPts = state.rows.reduce((s,r)=> s + Number(r['Point'] ?? 0), 0);
    const avg = total ? (sumPts/total) : 0;
    el.statTotal.textContent = nf.format(total);
    el.statAvg.textContent   = nf.format(Math.round(avg));
    el.barTotal.style.width  = Math.min(100, (total/100)*100) + '%';
    el.barAvg.style.width    = Math.min(100, (avg/5000)*100) + '%';
  }

  // ====== PODIUM: 2 – 1 – 3 ======
  function renderPodium(){
    const [p1 = {Nama:'—','No Member':'—','Point':0},
           p2 = {Nama:'—','No Member':'—','Point':0},
           p3 = {Nama:'—','No Member':'—','Point':0}] = state.rows.slice(0,3);

    // Gambar PNG per juara (pastikan file tersedia di assets/img)
    const podiumImg = (rank) => {
      const src = `assets/img/podium-${rank}.png`;
      const alt = `Juara ${rank}`;
      return `<img class="podium-img" src="${src}" alt="${alt}">`;
    };

    // Kolom podium tanpa ikon piala & tanpa chip poin
    const col = (rank, cls, row) => `
      <article class="podium-col ${cls}" aria-label="Juara ${rank}">
        <h3 class="p-name">${esc(row['Nama'])}</h3>
        <p class="p-member mono">${esc(row['No Member'])}</p>
        <div class="stage">${podiumImg(rank)}</div>
        <div class="p-point">
          <span class="num mono">${nf.format(Number(row['Point'] ?? 0))}</span>
          <span>poin</span>
        </div>
      </article>`;

    el.podium.innerHTML = col(2,'second',p2) + col(1,'first',p1) + col(3,'third',p3);
  }

  function applyFilter(){
    state.query = el.search.value.trim();
    const q = state.query.toLowerCase();
    state.filtered = !q ? [...state.rows] : state.rows.filter(r =>
      String(r['No Member']).toLowerCase().includes(q) ||
      String(r['Nama']).toLowerCase().includes(q)
    );
  }

  // ====== RENDER: pilih TABEL (>480px) atau LIST-CARD (≤480px) ======
  function renderTable(){
    const q = state.query.trim();
    const isSearching = q.length > 0;
    if (el.sInfo){ el.sInfo.hidden = true; el.sInfo.innerHTML = ''; }

    let rowsToShow = [];
    if (!isSearching){
      rowsToShow = state.rows.slice(3, 10); // default: #4–#10
    } else {
      rowsToShow = state.filtered;
    }

    const isMobileList = window.matchMedia('(max-width: 480px)').matches;
    if (isMobileList){
      renderListMobile(rowsToShow);
      return;
    }

    if (rowsToShow.length === 0){
      el.tbBody.innerHTML = `<tr><td colspan="4" class="empty">${isSearching ? 'Tidak ada hasil.' : 'Data kosong.'}</td></tr>`;
      return;
    }
    const tr = rowsToShow.map(r => {
      const key = String(r['No Member'] ?? '').trim();
      const rank = state.rankMap[key] ?? '-';
      return `<tr>
        <td><span class="rank-badge">#${rank}</span></td>
        <td class="mono">${esc(String(r['No Member'] ?? ''))}</td>
        <td>${esc(String(r['Nama'] ?? ''))}</td>
        <td class="mono" style="text-align:right">${nf.format(Number(r['Point'] ?? 0))}</td>
      </tr>`;
    }).join('');
    el.tbBody.innerHTML = tr;
  }

  // ===== LIST-CARD untuk mobile (≤480px), TANPA HEADER KETERANGAN =====
  function renderListMobile(rows){
    let card = document.querySelector('#leaderboard-host .lb-table-card');
    if (!card) return;
    // Hapus list lama bila ada
    let oldList = card.querySelector('.lb-list');
    if (oldList) oldList.remove();
    // Buat list-wrap
    card.insertAdjacentHTML('beforeend', `<div class="lb-list"></div>`);
    const list = card.querySelector('.lb-list');
    if (rows.length === 0){
      list.innerHTML = `<div class="empty">Tidak ada data.</div>`;
      return;
    }
    const html = rows.map(r => {
      const key = String(r['No Member'] ?? '').trim();
      const rank = state.rankMap[key] ?? '-';
      const name = esc(String(r['Nama'] ?? ''));
      const memb = esc(key);
      const pts = nf.format(Number(r['Point'] ?? 0));
      return `<div class="lb-li">
        <div class="rk"><span class="rank-badge">#${rank}</span></div>
        <div class="who">
          <span class="nm">${name}</span>
          <span class="mb mono">${memb}</span>
        </div>
        <div class="pt mono">${pts}</div>
      </div>`;
    }).join('');
    list.innerHTML = html;
  }

  // ====== RENDER HASIL PENCARIAN INLINE (di bawah kolom pencarian) ======
  function renderSearchInline(){
    const inline = document.getElementById('lb-search-inline');
    if (!inline) return;
    const q = state.query.trim();
    if (!q){
      inline.style.display = 'none';
      inline.innerHTML = '';
      return;
    }
    if (state.filtered.length === 0){
      inline.style.display = 'block';
      inline.innerHTML = `<div class="hit"><div></div><div>Tidak ada hasil untuk "<strong>${esc(q)}</strong>"</div><div></div></div>`;
      return;
    }
    // Ambil hasil teratas dari filter
    const r = state.filtered[0];
    const no = String(r['No Member'] ?? '').trim();
    const nama = String(r['Nama'] ?? '').trim();
    const pts = Number(r['Point'] ?? 0);
    const rank = state.rankMap[no] ?? '-';
    // Hitung selisih dengan #1
    const top1 = Number(state.rows[0]?.['Point'] ?? 0);
    const gap = Math.max(top1 - pts, 0);
    inline.innerHTML = `
      <div class="hit">
        <div><span class="rank-badge">#${rank}</span></div>
        <div>
          <strong>${esc(nama)}</strong>
          <div class="mono" style="color:var(--muted)">${esc(no)}</div>
        </div>
        <div class="mono" style="text-align:right">${nf.format(pts)} poin</div>
      </div>
      <div class="gap mono">Selisih ke #1: ${nf.format(gap)} poin</div>
    `;
    inline.style.display = 'block';
  }

  // ====== Events ======
  el.search.addEventListener('input', () => { applyFilter(); renderTable(); renderSearchInline(); });
  el.refresh.addEventListener('click', () => fetchSheet());
  window.addEventListener('resize', () => { renderTable(); renderSearchInline(); }); // switch mulus list <-> tabel

  // Start
  ensureSearchEnhancements();
  fetchSheet();
})();
