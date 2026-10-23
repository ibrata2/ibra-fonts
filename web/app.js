(function () {
'use strict';
const F = window.IBRAFONT, $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
const toastEl = $('#toast'); let tT;
function toast(m) { toastEl.textContent = m; toastEl.classList.add('on'); clearTimeout(tT); tT = setTimeout(() => toastEl.classList.remove('on'), 2600); }
const store = {get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }, del(k) { try { localStorage.removeItem(k); } catch (e) {} }};

/* ---------- downloads ---------- */
let dl = null;
const dlReady = (window.claude && window.claude.use) ? window.claude.use('downloads').then(d => { dl = d; }).catch(() => {}) : Promise.resolve();
async function saveFile(name, data) {
  if (window.NATIVE) {
    try {
      const u8 = data instanceof Uint8Array ? data : data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : new TextEncoder().encode(String(data));
      const p = await NATIVE.call('saveFile', {name, b64: NATIVE.toB64(u8)});
      if (p) toast('انحفظ: ' + p); return;
    } catch (e) { toast('ما انحفظ: ' + e.message); return; }
  }
  await Promise.race([dlReady, new Promise(r => setTimeout(r, 1500))]);
  const blob = data instanceof Blob ? data : new Blob([data]);
  if (dl) {
    try { await dl.save({filename: name, data: blob}); toast('انحفظ: ' + name); return; }
    catch (e) { if (e && e.code === 'declined') { toast('انلغى الحفظ'); return; } if (e && e.code === 'rate_limited') { toast('اكو نافذة حفظ مفتوحة، كمّلها أول'); return; } }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
$$('[data-copy]').forEach(b => b.addEventListener('click', () => {
  const t = document.getElementById(b.dataset.copy).textContent;
  const sel = () => { const r = document.createRange(); r.selectNodeContents(document.getElementById(b.dataset.copy)); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast('محدد — اضغط Ctrl+C'); };
  try { navigator.clipboard.writeText(t).then(() => toast('انسخ'), sel); } catch (e) { sel(); }
}));

/* ---------- tabs ---------- */
function showTab(t) {
  $$('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t));
  $('#v-doc').hidden = t !== 'doc'; $('#v-ed').hidden = t !== 'ed';
  store.set('ibra-tab', t);
  if (t === 'ed') { resizeCanvas(); renderAll(); }
}
$$('.tabs button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));

/* =====================================================================
   DOCTOR
   ===================================================================== */
const D = {entries: [], seq: 0};
const STATUS = {ok: 'سليم', fix: 'تصلّح', legacy: 'قديم Non-Unicode', noforms: 'ما يتصلح', bad: 'تالف', dup: 'مكرر', unsupported: 'غير مدعوم', companion: 'ملف مرافق'};
const extOf = n => (n.split('.').pop() || '').toLowerCase();
const safeFile = s => (s || 'Font').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim() || 'Font';

async function ingest(name, path, u8, extra) {
  const ext = extOf(name);
  const base = Object.assign({file: name, path: path || name, id: ++D.seq}, extra || {});
  try {
    if (['pfm', 'afm', 'inf', 'ofm', 'fon'].includes(ext)) { D.entries.push(Object.assign(base, {raw: null, kind: 'companion', note: ext === 'fon' ? 'خط نقطي قديم (FON) لنظام ويندوز — فوتوشوب ما يستخدمه.' : 'ملف مقاسات مرافق لخط Type 1 — ما يحتاجه الخط بعد التحويل.'})); return; }
    const tag = F.tagAt(u8, 0);
    if (tag === 'wOF2') { D.entries.push(Object.assign(base, {kind: 'unsupported', note: 'WOFF2 خط ويب مضغوط بطريقة ما تدعمها الأداة. حمّل نسخة TTF/OTF من مصدر الخط.'})); return; }
    if (tag === 'ttcf') { const parts = F.splitTTC(u8); parts.forEach((p, i) => D.entries.push(Object.assign({}, base, {id: ++D.seq, raw: p, kind: 'sfnt', part: i, pre: ['فصلناه من مجموعة TTC (خط رقم ' + (i + 1) + ').']}))); return; }
    if (tag === 'wOFF') { D.entries.push(Object.assign(base, {raw: await F.woffToSfnt(u8), kind: 'sfnt', pre: ['حولناه من صيغة الويب WOFF إلى خط ينصب على ويندوز.'], converted: true})); return; }
    if (u8[0] === 0x80 || /^%!/.test(String.fromCharCode(u8[0], u8[1])) || ext === 'pfb' || ext === 'pfa') {
      const t = F.parseType1(u8, name);
      D.entries.push(Object.assign(base, {raw: t.bytes, kind: 'sfnt', converted: true, pre: ['حولناه من Type 1 القديم (أدوبي وقّف دعمه) إلى OpenType — ' + t.glyphs + ' شكل.'].concat(t.arabicForms ? ['بنينا وصل الحروف العربية لـ ' + t.arabicForms + ' حرف.'] : [])}));
      return;
    }
    if ([0x00010000, 0x4F54544F, 0x74727565].includes(new DataView(u8.buffer, u8.byteOffset).getUint32(0))) { D.entries.push(Object.assign(base, {raw: u8, kind: 'sfnt'})); return; }
    D.entries.push(Object.assign(base, {kind: 'unsupported', note: 'هذا مو ملف خط معروف (' + (ext || 'بدون امتداد') + ').'}));
  } catch (e) { D.entries.push(Object.assign(base, {kind: 'unsupported', note: 'ما قدرنا نقرأ الملف: ' + (e.message || e)})); }
}
async function addFiles(files) {
  const list = Array.from(files); if (!list.length) return;
  D.entries = D.entries.filter(e => !e.demo);
  toast('جاري فحص ' + list.length + ' ملف…');
  for (const f of list) await ingest(f.name, f.webkitRelativePath || f.name, new Uint8Array(await f.arrayBuffer()));
  process();
}
const sleep0 = () => new Promise(r => setTimeout(r, 0));
async function scanInstalled() {
  const btn = $('#scanBtn'), txt = $('#scanTxt'); btn.disabled = true;
  try {
    const list = await NATIVE.call('listFonts');
    D.entries = D.entries.filter(e => !e.demo && !e.installed);
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      if (i % 6 === 0) { txt.textContent = 'جاري القراءة ' + (i + 1) + ' من ' + list.length + '… ' + f.file; await sleep0(); }
      try {
        const res = await fetch(f.url); if (!res.ok) throw new Error(res.status);
        await ingest(f.file, (f.scope === 'user' ? 'خطوطك/' : 'Windows/') + f.file, new Uint8Array(await res.arrayBuffer()), {installed: f});
      } catch (e) { D.entries.push({file: f.file, path: f.file, id: ++D.seq, kind: 'unsupported', installed: f, note: 'ما انقرى من مجلد الخطوط: ' + e.message}); }
    }
    txt.textContent = 'خلصنا: ' + list.length + ' ملف خط بالجهاز.';
    process();
  } catch (e) { txt.textContent = 'ما قدرنا نقرأ الخطوط: ' + e.message; }
  btn.disabled = false;
}
function hashKey(u8) { return u8.length + ':' + F.crc32(u8).toString(16); }
function process() {
  const unlock = $('#unlock').checked, suffix = $('#suffix').value.trim();
  const seenHash = {}, psGroups = {};
  D.entries.forEach(e => {
    e.out = null; e.status = null;
    if (e.kind !== 'sfnt') { e.status = e.kind; return; }
    const h = hashKey(e.raw);
    if (seenHash[h] && !e.demo) { e.status = 'dup'; e.note = 'نفس الملف ' + seenHash[h] + ' بالضبط — شلناه من الحزمة.'; return; }
    seenHash[h] = e.file;
    const r = F.analyzeSfnt(e.raw, e.file, {unlock}); e.r = r; e.status = r.status;
    const key = (r.info.family + '|' + r.info.style).toLowerCase();
    (psGroups[key] = psGroups[key] || []).push(e);
  });
  Object.values(psGroups).forEach(g => {
    if (g.length < 2) return;
    g.forEach((e, i) => {
      if (!i) return;
      const r = e.r; r.newFamily = r.info.family + ' ' + (i + 1); r.plan.rename = true;
      r.issues.push('اكو خط ثاني بنفس الاسم "' + r.info.family + '" بس ملف مختلف — هذا يخلي قائمة فوتوشوب تتخربط وتعرض واحد بس.');
      if (r.status === 'ok') r.status = 'fix';
    });
  });
  D.entries.forEach(e => {
    if (!e.r || e.status === 'bad') return;
    const r = e.r;
    if (suffix && (r.status === 'fix' || e.converted)) { r.newFamily = (r.newFamily || r.info.family) + ' ' + suffix; r.plan.rename = true; }
    else if (e.installed && e.installed.scope === 'system' && (r.status === 'fix' || e.converted)) {
      r.newFamily = (r.newFamily || r.info.family) + ' Fix'; r.plan.rename = true;
      r.issues.push('هذا خط نظام (يحتاج صلاحية مدير حتى ينحذف)، فالنسخة المصلحة تنصب باسم "' + r.newFamily + '" حتى ما تتضارب وية الأصلي.');
    }
    if (r.status === 'fix' || e.converted || r.plan.rename) {
      r.fixes = [];
      try { e.out = F.applyFixes(r, {}); e.status = 'fix'; } catch (err) { e.status = 'bad'; r.issues.push('صار خطأ أثناء التصليح: ' + err.message); }
    } else if (r.status === 'ok' || r.status === 'legacy' || r.status === 'noforms') e.out = e.raw;
    const fam = r.newFamily || r.info.family, sty = r.info.style || 'Regular';
    const isCFF = e.out && F.readSfnt(e.out).flavor === 0x4F54544F;
    e.outName = safeFile(fam) + '-' + safeFile(sty).replace(/\s+/g, '') + (isCFF ? '.otf' : '.ttf');
    e.folder = safeFile(fam);
  });
  renderDoctor();
}
const fontFaces = new Map();
function faceFor(id, u8) {
  if (!u8) return null;
  const name = 'ibraf' + id;
  if (fontFaces.has(name)) return name;
  try { const ff = new FontFace(name, u8.slice().buffer); ff.load().then(() => document.fonts.add(ff)).catch(() => {}); fontFaces.set(name, ff); return name; } catch (e) { return null; }
}
function el(tag, attrs, kids) { const n = document.createElement(tag); if (attrs) Object.entries(attrs).forEach(([k, v]) => { if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else n.setAttribute(k, v); }); (kids || []).forEach(k => k && n.appendChild(k)); return n; }
function renderDoctor() {
  const list = $('#list'); list.textContent = '';
  const counts = {}; D.entries.forEach(e => counts[e.status] = (counts[e.status] || 0) + 1);
  const chips = $('#chips'); chips.textContent = '';
  chips.appendChild(el('span', {class: 'chip'}, [document.createTextNode('الكل'), el('b', {text: String(D.entries.length)})]));
  Object.keys(STATUS).forEach(k => { if (counts[k]) chips.appendChild(el('span', {class: 'chip'}, [document.createTextNode(STATUS[k]), el('b', {text: String(counts[k])})])); });
  $('#zipBtn').disabled = !D.entries.some(e => e.out); $('#repBtn').disabled = !D.entries.length;
  if (!D.entries.length) { list.appendChild(el('div', {class: 'empty', text: 'ماكو خطوط بعد. اسحب ملفات أو مجلد الخطوط فوق.'})); return; }
  const groups = {};
  const q = filterQ();
  const onlyAr = window.NATIVE && $('#onlyAr').checked && !q;
  let hidden = 0;
  const visible = D.entries.filter(e => { if (!matches(e, q)) return false; const h = onlyAr && e.installed && (e.status === 'ok' || e.status === 'companion') && (!e.r || e.r.kind !== 'arabic'); if (h) hidden++; return !h; });
  if (hidden) chips.appendChild(el('span', {class: 'chip'}, [document.createTextNode('مخفية (لاتينية سليمة)'), el('b', {text: String(hidden)})]));
  const sel = selected();
  if (window.NATIVE) $('#installAll').disabled = !sel.some(e => e.out && e.status === 'fix');
  $('#selCount').textContent = q ? 'محدد: ' + sel.length + ' ملف' : '';
  $('#zipBtn').textContent = q ? 'تنزيل المحدد ZIP' : 'تنزيل الكل مرتب ZIP';
  $('#zipBtn').disabled = !sel.some(e => e.out);
  if (q && !visible.length) list.appendChild(el('div', {class: 'empty', text: window.NATIVE && !D.entries.some(e => e.installed) ? 'ماكو خطوط بهذا الاسم بالقائمة. اضغط "افحص الخطوط المنصبة بجهازك" حتى نقرأ خطوط ويندوز.' : 'ماكو خطوط اسمها يحتوي "' + q + '".'}));
  visible.forEach(e => { const g = e.r ? (e.r.newFamily || e.r.info.family) : 'ملفات أخرى'; (groups[g] = groups[g] || []).push(e); });
  const sample = $('#sample').value || 'ابراهيم روسم';
  Object.keys(groups).forEach(g => {
    list.appendChild(el('div', {class: 'fam'}, [el('h4', {text: g}), el('small', {text: groups[g].length + ' ملف'})]));
    groups[g].forEach(e => {
      const r = e.r, st = e.status;
      const meta = el('div', {class: 'meta'});
      const head = el('div', {}, [el('span', {class: 'pill ' + st, text: STATUS[st] || st})]);
      if (e.demo) head.appendChild(el('span', {class: 'pill demo', text: 'مثال تجريبي'}));
      if (e.installed) head.appendChild(el('span', {class: 'scope', text: e.installed.scope === 'user' ? 'منصب لك' : 'خط ويندوز'}));
      if (r) head.appendChild(el('span', {class: 'mono', style: 'font-size:12px;color:var(--mute)', text: r.info.style + ' · ' + r.info.flavor + ' · ' + r.info.numGlyphs + ' شكل' + (r.info.arabic ? ' · عربي ' + r.info.arabic + ' حرف' : '')}));
      meta.appendChild(head);
      const fn = el('div', {class: 'fn'}); fn.textContent = e.path + (e.out && e.outName ? '  →  ' : ''); if (e.out && e.outName) fn.appendChild(el('i', {text: e.folder + '/' + e.outName}));
      meta.appendChild(fn);
      const iss = (r ? r.issues : []).slice(); if (e.note) iss.push(e.note);
      if (iss.length) meta.appendChild(el('ul', {class: 'iss'}, iss.map(t => el('li', {text: t}))));
      else if (st === 'ok') meta.appendChild(el('ul', {class: 'fx'}, [el('li', {text: 'ماكو مشاكل — الخط جاهز لفوتوشوب.'})]));
      const fx = (e.pre || []).concat(r && st === 'fix' ? r.fixes : []);
      if (fx.length) meta.appendChild(el('ul', {class: 'fx'}, fx.map(t => el('li', {text: t}))));
      if (e.out) {
        const acts = el('div', {class: 'acts row'});
        if (window.NATIVE && st === 'fix') { const ib = el('button', {class: 'btn gold', text: e.installed && e.installed.scope === 'user' ? 'بدّل المنصب بالمصلّح' : 'نصّب بجهازك'}); ib.addEventListener('click', () => installEntry(e, ib)); acts.appendChild(ib); }
        const b = el('button', {class: 'btn', text: 'تنزيل هذا الخط'}); b.addEventListener('click', () => downloadOne(e)); acts.appendChild(b);
        meta.appendChild(acts);
      }
      const prev = el('div', {class: 'prev'});
      if (e.kind === 'sfnt') {
        const bf = !e.converted && faceFor('b' + e.id, e.raw), af = e.out && e.out !== e.raw ? faceFor('a' + e.id, e.out) : null;
        const mk = (label, fam, na) => { const d = el('div', {class: 'pv' + (fam ? '' : ' na')}); d.appendChild(el('small', {text: label})); d.appendChild(document.createTextNode(fam ? sample : na)); if (fam) d.style.fontFamily = '"' + fam + '", "Times New Roman"'; return d; };
        prev.appendChild(mk(af ? 'قبل' : 'معاينة', bf, e.converted ? 'النوع القديم ما ينعرض بالمتصفح' : 'ما انعرض'));
        if (af) prev.appendChild(mk('بعد', af));
      }
      list.appendChild(el('div', {class: 'card s-' + st}, [meta, prev]));
    });
  });
}
function readme() {
  const L = ['IBRA خطوط — تقرير فحص الخطوط', 'التاريخ: ' + new Date().toLocaleString('ar-IQ'), ''];
  selected().forEach(e => {
    L.push('■ ' + e.path + '  [' + (STATUS[e.status] || e.status) + ']');
    if (e.out && e.outName) L.push('   الملف الجديد: ' + e.folder + '/' + e.outName);
    (e.r ? e.r.issues : []).concat(e.note ? [e.note] : []).forEach(t => L.push('   - ' + t));
    (e.pre || []).concat(e.r && e.status === 'fix' ? e.r.fixes : []).forEach(t => L.push('   ✓ ' + t));
    L.push('');
  });
  L.push('ملاحظة: احذف النسخ القديمة من ويندوز قبل تنصيب الجديدة، وامسح كاش خطوط فوتوشوب (CT Font Cache).');
  return L.join('\r\n');
}
async function downloadOne(e) {
  if (/\.ttf$/.test(e.outName)) return saveFile(e.outName, e.out);
  await saveFile(e.outName.replace(/\.otf$/, '') + '.zip', F.makeZip([{name: e.outName, data: e.out}]));
}
/* selection by name (e.g. all FS_ fonts) */
function filterQ() { return ($('#nameFilter').value || '').trim().toLowerCase(); }
function matches(e, q) {
  if (!q) return true;
  const fam = e.r ? (e.r.info.family + ' ' + (e.r.newFamily || '')) : '';
  return (e.file + ' ' + e.path + ' ' + fam).toLowerCase().includes(q);
}
function selected() { const q = filterQ(); return D.entries.filter(e => matches(e, q)); }
let fT; $('#nameFilter').addEventListener('input', () => { clearTimeout(fT); fT = setTimeout(renderDoctor, 180); });
function subName() { const q = ($('#nameFilter').value || '').trim().replace(/[\\/:*?"<>|]+/g, '').replace(/[_\s-]+$/, ''); return q ? 'خطوط ' + q : 'خطوط IBRA'; }
async function ensureScanned() {
  if (!D.entries.some(e => e.installed)) { toast('نقرأ خطوط جهازك أول…'); await scanInstalled(); }
}
if (window.NATIVE) {
  $('#copyOrig').addEventListener('click', async () => {
    await ensureScanned();
    const paths = [...new Set(selected().filter(e => e.installed).map(e => e.installed.path))];
    if (!paths.length) return toast(filterQ() ? 'ماكو خطوط منصبة بهذا الاسم' : 'اكتب جزء من اسم الخطوط أول، مثلاً FS_');
    try {
      const folder = await NATIVE.call('pickFolder', {title: 'اختار وين تنسخ ' + paths.length + ' خط'});
      if (!folder) return;
      const r = await NATIVE.call('copyFiles', {paths, folder, sub: subName()});
      toast('انسخ ' + r.count + ' خط إلى ' + r.folder);
      NATIVE.call('openFolder', {path: r.folder}).catch(() => {});
    } catch (e) { toast('ما انسخت: ' + e.message); }
  });
  $('#saveFixed').addEventListener('click', async () => {
    await ensureScanned();
    const list = selected().filter(e => e.out && e.status !== 'dup');
    if (!list.length) return toast('ماكو خطوط جاهزة بالتحديد الحالي');
    try {
      const folder = await NATIVE.call('pickFolder', {title: 'اختار وين تنحفظ ' + list.length + ' خط مصلّح'});
      if (!folder) return;
      const used = {}, files = list.map(e => {
        let n = e.outName, k = 2; while (used[n.toLowerCase()]) n = e.outName.replace(/(\.\w+)$/, '-' + (k++) + '$1');
        used[n.toLowerCase()] = 1; return {name: n, b64: NATIVE.toB64(e.out)};
      });
      files.push({name: 'تقرير.txt', b64: NATIVE.toB64(new TextEncoder().encode('\uFEFF' + readme()))});
      const r = await NATIVE.call('writeFiles', {folder, sub: subName() + ' - مصلحة', files});
      toast('انحفظ ' + (r.count - 1) + ' خط بـ ' + r.folder);
      NATIVE.call('openFolder', {path: r.folder}).catch(() => {});
    } catch (e) { toast('ما انحفظت: ' + e.message); }
  });
}
async function installEntry(e, btn) {
  if (!window.NATIVE || !e.out) return;
  const fam = e.r ? (e.r.newFamily || e.r.info.family) : 'Font';
  if (btn) btn.disabled = true;
  try {
    const replace = e.installed && e.installed.scope === 'user' ? e.installed.path : null;
    const res = await NATIVE.call('installFont', {file: e.outName, b64: NATIVE.toB64(e.out), family: fam, replace});
    e.installedNow = res.path; toast('تنصّب: ' + fam + (res.note ? ' — ' + res.note : ''));
    if (btn) btn.textContent = 'تنصّب ✓';
    return true;
  } catch (err) { toast('ما تنصّب: ' + err.message); if (btn) btn.disabled = false; return false; }
}
if (window.NATIVE) {
  $('#scanBtn').addEventListener('click', scanInstalled);
  $('#onlyAr').addEventListener('change', renderDoctor);
  $('#openFontsDir').addEventListener('click', () => NATIVE.call('openFontsFolder').catch(() => {}));
  $('#installAll').addEventListener('click', async () => {
    const todo = selected().filter(e => e.out && e.status === 'fix' && !e.installedNow);
    let n = 0; for (const e of todo) if (await installEntry(e)) n++;
    toast('تنصّب ' + n + ' خط — سكّر وافتح فوتوشوب حتى يشوفها'); renderDoctor();
  });
  const cb = $('#cacheBtn'); let armed = 0;
  cb.addEventListener('click', async () => {
    if (Date.now() - armed > 3000) { armed = Date.now(); cb.textContent = 'متأكد؟ اضغط مرة ثانية'; setTimeout(() => cb.textContent = 'امسح كاش خطوط أدوبي الآن', 3000); return; }
    cb.textContent = 'امسح كاش خطوط أدوبي الآن';
    try {
      const r = await NATIVE.call('clearAdobeCache');
      if (r.running && r.running.length) toast('سكّر أول: ' + r.running.join('، '));
      else toast(r.deleted ? 'انمسح ' + r.deleted + ' ملف/مجلد كاش — افتح فوتوشوب من جديد' : 'ماكو كاش خطوط لأدوبي بهذا الجهاز');
    } catch (e) { toast('ما انمسح: ' + e.message); }
  });
  NATIVE.call('info').then(i => { $('#verTxt').textContent = 'v' + i.version; }).catch(() => {});
  // fonts opened with "افحص بـ IBRA خطوط" from the right-click menu
  NATIVE.call('pendingFiles').then(async list => {
    if (!list || !list.length) return;
    D.entries = D.entries.filter(e => !e.demo);
    for (const f of list) { try { const r = await fetch(f.url); await ingest(f.file, f.file, new Uint8Array(await r.arrayBuffer())); } catch (e) {} }
    process(); showTab('doc');
  }).catch(() => {});
  setTimeout(() => NATIVE.call('checkUpdate').then(u => {
    if (!u || !u.newer) return;
    const b = $('#updBtn'); b.hidden = false; b.textContent = 'تحديث ' + u.latest; let arm = 0;
    b.addEventListener('click', () => {
      if (Date.now() - arm > 4000) { arm = Date.now(); b.textContent = 'اضغط مرة ثانية للتثبيت'; return; }
      b.textContent = 'جاري التحميل…'; b.disabled = true;
      NATIVE.call('installUpdate').catch(e => { toast('ما تحدث: ' + e.message); b.disabled = false; b.textContent = 'تحديث ' + u.latest; });
    });
  }).catch(() => {}), 4000);
}
$('#zipBtn').addEventListener('click', () => {
  const files = [], used = {};
  selected().forEach(e => {
    if (!e.out || e.status === 'dup') return;
    const dir = e.status === 'legacy' || e.status === 'noforms' ? 'قديمة - ما تتصلح/' + e.folder : e.folder;
    let n = dir + '/' + e.outName; let k = 2; while (used[n]) n = dir + '/' + e.outName.replace(/(\.\w+)$/, '-' + (k++) + '$1');
    used[n] = 1; files.push({name: n, data: e.out});
  });
  files.push({name: 'تقرير.txt', data: new TextEncoder().encode('﻿' + readme())});
  saveFile('IBRA-Fonts-' + new Date().toISOString().slice(0, 10) + '.zip', F.makeZip(files));
});
$('#repBtn').addEventListener('click', () => saveFile('تقرير-الخطوط.txt', '﻿' + readme()));
$('#clearDoc').addEventListener('click', () => { D.entries = []; renderDoctor(); });
$('#fIn').addEventListener('change', e => { addFiles(e.target.files); e.target.value = ''; });
$('#dIn').addEventListener('change', e => { addFiles(e.target.files); e.target.value = ''; });
['unlock', 'suffix'].forEach(id => $('#' + id).addEventListener('change', process));
$('#sample').addEventListener('input', () => $$('.pv:not(.na)').forEach(p => { p.lastChild.textContent = $('#sample').value; }));
const drop = $('#drop');
['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', async e => {
  const items = e.dataTransfer.items, out = [];
  const walk = (entry) => new Promise(res => {
    if (entry.isFile) entry.file(f => { out.push(f); res(); }, () => res());
    else if (entry.isDirectory) { const rd = entry.createReader(); const all = []; const next = () => rd.readEntries(es => { if (!es.length) Promise.all(all.map(walk)).then(res); else { all.push(...es); next(); } }, () => res()); next(); }
    else res();
  });
  if (items && items[0] && items[0].webkitGetAsEntry) { await Promise.all(Array.from(items).map(i => i.webkitGetAsEntry()).filter(Boolean).map(walk)); addFiles(out); }
  else addFiles(e.dataTransfer.files);
});

/* =====================================================================
   EDITOR
   ===================================================================== */
const CAT = F.glyphCatalog(), BYKEY = {}; CAT.forEach(c => BYKEY[c.key] = c);
const X0 = -250, Y1 = 1150, SPAN = 1700;
let P = null; // project
let cur = '0628', group = 'letters', tool = 'nib';
let refImg = null, hist = [], redo = [];
const cv = $('#cv'), ctx = cv.getContext('2d');
let S = 1, DPR = 1;

function sampleProject() {
  const st = (pts, w, t) => ({t: t || 'nib', w: w || 70, a: 35, pts: F.smoothPts(pts.map(p => [p[0], p[1], 1]), 6)});
  const dot = (x, y, w) => ({t: 'round', w: w || 62, a: 0, pts: [[x, y, 1]]});
  const G = {
    '0627': {adv: 260, strokes: [st([[150, 720], [140, 360], [132, 40], [128, 0]])]},
    '0627.fina': {adv: 260, strokes: [st([[150, 740], [142, 320], [148, 70], [200, 22], [290, 26]])]},
    '0628': {adv: 600, strokes: [st([[560, 170], [548, 50], [420, 18], [200, 18], [70, 50], [36, 150]]), dot(300, -130)]},
    '0628.init': {adv: 300, strokes: [st([[300, 190], [282, 70], [200, 32], [80, 28], [-20, 30]]), dot(160, -130)]},
    '0628.medi': {adv: 260, strokes: [st([[290, 30], [180, 30], [150, 140], [120, 30], [-20, 30]]), dot(140, -130)]},
    '0628.fina': {adv: 600, strokes: [st([[630, 28], [548, 40], [420, 18], [200, 18], [70, 50], [36, 150]]), dot(300, -130)]},
    '0631': {adv: 280, strokes: [st([[210, 220], [228, 90], [190, -80], [70, -220], [-20, -250]])]},
    '0631.fina': {adv: 320, strokes: [st([[350, 30], [250, 40], [212, 10], [180, -100], [70, -230], [-10, -250]])]},
    '0647': {adv: 360, strokes: [st([[230, 30], [310, 120], [240, 260], [120, 200], [90, 70], [200, 30], [300, 34]])]},
    '0647.init': {adv: 300, strokes: [st([[230, 40], [272, 210], [205, 340], [140, 210], [170, 70], [260, 34], [100, 30], [-20, 30]])]},
    '0647.medi': {adv: 330, strokes: [st([[360, 30], [210, 30], [150, 130], [205, 260], [262, 130], [180, 30], [-20, 30]])]},
    '064A': {adv: 520, strokes: [st([[470, 260], [420, 120], [470, 30], [380, -60], [200, -110], [60, -60], [40, 40]]), dot(230, -230, 55), dot(320, -230, 55)]},
    '064A.medi': {adv: 270, strokes: [st([[300, 30], [170, 30], [150, 120], [130, 30], [-20, 30]]), dot(100, -120, 55), dot(190, -120, 55)]},
    '0645': {adv: 360, strokes: [st([[300, 40], [230, 150], [150, 120], [180, 40], [250, 30], [190, -60], [170, -320]])]},
    '0645.fina': {adv: 400, strokes: [st([[430, 30], [260, 30], [195, 140], [130, 110], [160, 40], [230, 30], [180, -60], [160, -320]])]},
    '0648': {adv: 340, strokes: [st([[240, 50], [250, 170], [160, 180], [150, 70], [240, 40], [210, -90], [90, -230], [0, -260]])]},
    '0648.fina': {adv: 360, strokes: [st([[390, 30], [270, 40], [250, 160], [165, 180], [150, 70], [240, 40], [210, -90], [90, -230], [0, -260]])]},
    '0633': {adv: 640, strokes: [st([[600, 160], [585, 40], [540, 90], [505, 34], [460, 90], [430, 34], [380, 40], [300, -40], [150, -70], [50, -10], [30, 110]])]},
    '0633.init': {adv: 400, strokes: [st([[390, 130], [372, 34], [320, 90], [290, 34], [240, 90], [210, 34], [120, 30], [-20, 30]])]},
    '0644': {adv: 420, strokes: [st([[330, 740], [318, 300], [320, 40], [240, -60], [120, -70], [50, 30]])]},
    '0644.init': {adv: 240, strokes: [st([[200, 760], [186, 320], [180, 70], [120, 30], [-20, 30]])]},
    '0644.medi': {adv: 240, strokes: [st([[270, 30], [150, 30], [130, 300], [128, 740]]), st([[130, 30], [-20, 30]])]},
    'la0627': {adv: 520, strokes: [st([[420, 740], [380, 400], [250, 80], [130, 30], [60, 120], [130, 230], [230, 60], [280, 0]])]},
    '0661': {adv: 300, strokes: [st([[170, 700], [150, 300], [150, 0]])]},
    '0662': {adv: 360, strokes: [st([[110, 700], [200, 600], [280, 690], [200, 500], [180, 0]])]},
    '0663': {adv: 400, strokes: [st([[80, 700], [140, 600], [200, 690], [250, 600], [320, 690], [240, 500], [220, 0]])]}
  };
  return {meta: {family: 'Ibrahem Rosem Hand', designer: 'Ibrahim Rosem', joinH: 60, space: 260, version: '1.000'}, glyphs: G, sample: true};
}
function loadProject() {
  try { const s = store.get('ibra-fonts-project'); if (s) { const p = JSON.parse(s); if (p && p.glyphs) return p; } } catch (e) {}
  return sampleProject();
}
let saveT;
function persist() {
  clearTimeout(saveT);
  saveT = setTimeout(() => { if (!store.set('ibra-fonts-project', JSON.stringify(P))) toast('ما انحفظ بالمتصفح — استخدم "حفظ المشروع"'); }, 600);
}
function G(k) { k = k || cur; return P.glyphs[k] || (P.glyphs[k] = {adv: defaultAdv(k), strokes: []}); }
function defaultAdv(k) { const c = BYKEY[k]; if (!c) return 600; if (c.group === 'digits') return 420; if (c.group === 'punct') return 300; if (c.form === 'init' || c.form === 'medi') return 300; return 520; }
function hasG(k) { const g = P.glyphs[k]; return !!(g && g.strokes && g.strokes.length); }

/* coords */
function resizeCanvas() {
  const r = cv.getBoundingClientRect(); if (!r.width) return;
  DPR = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(r.width * DPR); cv.height = Math.round(r.width * DPR); S = cv.width / SPAN;
}
const toPx = (x, y) => [(x - X0) * S, (Y1 - y) * S];
function toFont(e) { const r = cv.getBoundingClientRect(); const px = (e.clientX - r.left) * DPR, py = (e.clientY - r.top) * DPR; return [px / S + X0, Y1 - py / S]; }

function pathOf(strokes, map, tx, ty) {
  const p = new Path2D();
  strokes.forEach(st => F.strokePolys(st).forEach(poly => { poly.forEach((q, i) => { const [a, b] = map(q[0] + (tx || 0), q[1] + (ty || 0)); i ? p.lineTo(a, b) : p.moveTo(a, b); }); p.closePath(); }));
  return p;
}
let live = null, traceRect = null, dragInfo = null;
function draw() {
  const W = cv.width, g = G(), c = BYKEY[cur];
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, W);
  ctx.fillStyle = '#0a0907'; ctx.fillRect(0, 0, W, W);
  // metrics
  const hline = (y, col, dash, lab) => { const [, py] = toPx(0, y); ctx.strokeStyle = col; ctx.setLineDash(dash || []); ctx.lineWidth = 1 * DPR; ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(W, py); ctx.stroke(); ctx.setLineDash([]); if (lab) { ctx.fillStyle = col; ctx.font = (10 * DPR) + 'px IBM Plex Mono, monospace'; ctx.direction = 'ltr'; ctx.textAlign = 'left'; ctx.fillText(lab, 6 * DPR, py - 4 * DPR); } };
  hline(800, '#3a3322', [4 * DPR, 4 * DPR], 'ascender 800'); hline(400, '#2c271b', [2 * DPR, 6 * DPR], '400');
  hline(-350, '#3a3322', [4 * DPR, 4 * DPR], 'descender -350');
  const jh = P.meta.joinH || 60; const [, jy0] = toPx(0, 0), [, jy1] = toPx(0, jh);
  ctx.fillStyle = 'rgba(201,168,76,.07)'; ctx.fillRect(0, jy1, W, jy0 - jy1);
  hline(0, '#c9a84c', null, 'baseline 0');
  // box
  const [x0] = toPx(0, 0), [x1] = toPx(g.adv, 0);
  ctx.strokeStyle = '#5b4d2a'; ctx.lineWidth = 1.5 * DPR; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0, W); ctx.moveTo(x1, 0); ctx.lineTo(x1, W); ctx.stroke();
  ctx.fillStyle = '#c9a84c'; ctx.beginPath(); ctx.arc(x1, W - 16 * DPR, 6 * DPR, 0, 7); ctx.fill();
  // join markers
  const needL = c && (c.form === 'init' || c.form === 'medi'), needR = c && (c.form === 'fina' || c.form === 'medi' || (c.lam && c.form === 'fina'));
  const mark = (x) => { const [px, py] = toPx(x, jh / 2); ctx.fillStyle = '#e2675a'; ctx.beginPath(); ctx.arc(px, py, 7 * DPR, 0, 7); ctx.fill(); };
  if (needL) mark(0); if (needR) mark(g.adv);
  // reference
  if (refImg && g.ref !== false) {
    const rf = refOf(g); ctx.globalAlpha = (+$('#refOp').value) / 100;
    const [rx, ry] = toPx(rf.x, rf.y); ctx.drawImage(refImg, rx, ry, refImg.width * rf.s * S, refImg.height * rf.s * S); ctx.globalAlpha = 1;
  }
  // onion
  if ($('#onion').checked && c && c.form !== 'isol') {
    const base = c.lam ? 'la' + c.lam.toString(16).toUpperCase().padStart(4, '0') : c.cp.toString(16).toUpperCase().padStart(4, '0');
    if (hasG(base)) { ctx.fillStyle = 'rgba(121,168,216,.18)'; ctx.fill(pathOf(G(base).strokes, toPx), 'nonzero'); }
  }
  // glyph
  ctx.fillStyle = '#e6c770'; ctx.fill(pathOf(g.strokes, toPx), 'nonzero');
  if (live) { ctx.fillStyle = '#f3dc95'; ctx.fill(pathOf([live], toPx), 'nonzero'); }
  if (traceRect) { const [a, b] = toPx(traceRect[0], traceRect[1]), [cc, d] = toPx(traceRect[2], traceRect[3]); ctx.strokeStyle = '#79a8d8'; ctx.setLineDash([6 * DPR, 4 * DPR]); ctx.lineWidth = 1.5 * DPR; ctx.strokeRect(Math.min(a, cc), Math.min(b, d), Math.abs(cc - a), Math.abs(d - b)); ctx.setLineDash([]); }
}
function refOf(g) { if (!g.ref) g.ref = Object.assign({}, P.lastRef || {x: -150, y: 1050, s: refImg ? 1500 / refImg.width : 1}); return g.ref; }

/* pointer */
cv.addEventListener('pointerdown', e => {
  cv.setPointerCapture(e.pointerId); const [x, y] = toFont(e), g = G();
  const pr = e.pointerType === 'pen' ? Math.max(.25, e.pressure * 1.4) : 1;
  if (tool === 'nib' || tool === 'round') { live = {t: tool, w: +$('#w').value, a: +$('#ang').value, pts: [[x, y, pr]]}; live.start = [x, y, pr]; }
  else if (tool === 'erase') { pushHist(); eraseAt(x, y); }
  else if (tool === 'move') { pushHist(); const [ax] = toPx(g.adv, 0), [px] = toPx(x, 0); dragInfo = {mode: Math.abs(ax - px) < 18 * DPR ? 'adv' : 'all', x, y}; }
  else if (tool === 'ref') { if (!refImg) { toast('حمّل صورة مرجع أول'); return; } pushHist(); dragInfo = {mode: 'ref', x, y}; }
  else if (tool === 'trace') { if (!refImg) { toast('حمّل صورة اللوگو أول، بعدين حدد الحرف بمستطيل'); return; } traceRect = [x, y, x, y]; }
  draw();
});
cv.addEventListener('pointermove', e => {
  const [x, y] = toFont(e), g = G();
  if (live) {
    const pr = e.pointerType === 'pen' ? Math.max(.25, e.pressure * 1.4) : 1;
    if (e.shiftKey) { const s = live.start; live.pts = Array.from({length: 13}, (_, i) => [s[0] + (x - s[0]) * i / 12, s[1] + (y - s[1]) * i / 12, 1]); live._p = null; }
    else { const l = live.pts[live.pts.length - 1]; if (Math.hypot(x - l[0], y - l[1]) > 3) { live.pts.push([x, y, pr]); live._p = null; } }
    draw();
  } else if (dragInfo) {
    const dx = x - dragInfo.x, dy = y - dragInfo.y; dragInfo.x = x; dragInfo.y = y;
    if (dragInfo.mode === 'adv') { g.adv = Math.max(40, Math.round(g.adv + dx)); syncAdv(); }
    else if (dragInfo.mode === 'all') { g.strokes.forEach(st => translateStroke(st, dx, dy)); }
    else if (dragInfo.mode === 'ref') { const r = refOf(g); r.x += dx; r.y += dy; P.lastRef = Object.assign({}, r); }
    draw();
  } else if (traceRect && e.buttons) { traceRect[2] = x; traceRect[3] = y; draw(); }
  else if (tool === 'erase' && e.buttons) { eraseAt(x, y); }
});
const endPtr = () => {
  if (live) {
    if (live.pts.length) { pushHist(); const st = {t: live.t, w: live.w, a: live.a, pts: F.smoothPts(live.pts, Math.max(4, live.w * .12))}; G().strokes.push(st); }
    live = null; changed();
  } else if (dragInfo) { dragInfo = null; changed(); }
  else if (traceRect) { const r = traceRect; traceRect = null; if (Math.abs(r[2] - r[0]) > 30 && Math.abs(r[3] - r[1]) > 30) doTrace(r); else draw(); }
};
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
function translateStroke(st, dx, dy) {
  if (st.t === 'poly') st.polys = st.polys.map(p => p.map(q => [q[0] + dx, q[1] + dy]));
  else st.pts = st.pts.map(q => [q[0] + dx, q[1] + dy, q[2]]);
  st._p = null;
}
function eraseAt(x, y) {
  const g = G(); const [px, py] = toPx(x, y);
  for (let i = g.strokes.length - 1; i >= 0; i--) {
    const p = pathOf([g.strokes[i]], toPx); ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (ctx.isPointInPath(p, px, py, 'nonzero')) { g.strokes.splice(i, 1); changed(); return; }
  }
}
function doTrace(r) {
  const g = G(), rf = refOf(g);
  const xa = Math.min(r[0], r[2]), xb = Math.max(r[0], r[2]), ya = Math.min(r[1], r[3]), yb = Math.max(r[1], r[3]);
  const res = Math.max(1.5, (xb - xa) / 600), W = Math.ceil((xb - xa) / res), H = Math.ceil((yb - ya) / res);
  const oc = document.createElement('canvas'); oc.width = W; oc.height = H; const o = oc.getContext('2d');
  o.fillStyle = '#fff'; o.fillRect(0, 0, W, H);
  o.drawImage(refImg, (rf.x - xa) / res, (yb - rf.y) / res, refImg.width * rf.s / res, refImg.height * rf.s / res);
  const d = o.getImageData(0, 0, W, H).data, ink = new Uint8Array(W * H), th = +$('#th').value, inv = $('#inv').checked;
  for (let i = 0; i < W * H; i++) { const l = d[i * 4] * .3 + d[i * 4 + 1] * .59 + d[i * 4 + 2] * .11; ink[i] = inv ? l > th : l < th; }
  const loops = F.traceBitmap(ink, W, H), polys = [];
  loops.forEach(lp => {
    if (Math.abs(F.area(lp)) < 12) return;
    let p = F.simplifyClosed(lp, 0.9); if (p.length < 3) return;
    p = F.chaikinClosed(p, 2).map(q => [Math.round((xa + q[0] * res) * 10) / 10, Math.round((yb - q[1] * res) * 10) / 10]);
    polys.push(p);
  });
  if (!polys.length) { toast('ما لكينا كتابة بالمنطقة — غيّر العتبة أو فعّل "الكتابة فاتحة"'); draw(); return; }
  pushHist(); g.strokes.push({t: 'poly', polys}); changed(); toast('تتبعنا ' + polys.length + ' شكل — نظف الزوائد بالممحاة');
}

/* history */
function pushHist() { hist.push({k: cur, d: JSON.stringify(G())}); if (hist.length > 80) hist.shift(); redo = []; }
function restore(from, to) { const h = from.pop(); if (!h) return; to.push({k: h.k, d: JSON.stringify(G(h.k))}); P.glyphs[h.k] = JSON.parse(h.d); if (h.k !== cur) selectGlyph(h.k); changed(); }
$('#undo').addEventListener('click', () => restore(hist, redo));
$('#redo').addEventListener('click', () => restore(redo, hist));
document.addEventListener('keydown', e => {
  if ($('#v-ed').hidden || /INPUT|TEXTAREA/.test(document.activeElement.tagName) || document.activeElement.isContentEditable) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); restore(e.shiftKey ? redo : hist, e.shiftKey ? hist : redo); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); restore(redo, hist); }
});
$('#clearG').addEventListener('click', () => { if (!G().strokes.length) return; pushHist(); G().strokes = []; changed(); toast('انمسح — تقدر تتراجع'); });
$('#joinBtn').addEventListener('click', () => {
  const c = BYKEY[cur], g = G(), jh = P.meta.joinH || 60;
  const needL = c.form === 'init' || c.form === 'medi', needR = c.form === 'fina' || c.form === 'medi';
  if (!needL && !needR) { toast('الشكل المنفرد ما يحتاج وصلة'); return; }
  pushHist();
  const bar = (x1, x2) => ({t: 'poly', polys: [[[x1, 0], [x2, 0], [x2, jh], [x1, jh]]]});
  if (needL) g.strokes.push(bar(-15, Math.min(140, g.adv / 2)));
  if (needR) g.strokes.push(bar(Math.max(g.adv - 140, g.adv / 2), g.adv + 15));
  changed();
});
$('#copyFrom').addEventListener('change', e => {
  const k = e.target.value; e.target.value = ''; if (!k || !hasG(k)) return;
  pushHist(); const src = JSON.parse(JSON.stringify(G(k))); const g = G(); g.strokes = g.strokes.concat(src.strokes); if (!g.strokes.length || g.adv === defaultAdv(cur)) g.adv = src.adv; changed(); syncAdv();
});

/* tools UI */
const HINTS = {nib: 'قلم القصبة: سميك وخفيف حسب اتجاه الحركة مثل الخط الحقيقي. القلم الضوئي يغير السماكة بالضغط.', round: 'قلم دائري بسماكة ثابتة — للنقاط والتفاصيل.', erase: 'اضغط على أي ضربة لمسحها كاملة.', move: 'اسحب لتحريك الحرف كله. اسحب الخط العمودي الأيسر (النقطة الذهبية) لتغيير عرض الحرف.', ref: 'اسحب الصورة لتطابق الحرف على المربع. الحجم من الشريط تحت.', trace: 'ارسم مستطيل حول الحرف بالصورة — الأداة تحوله لشكل جاهز.'};
$$('#toolSeg button').forEach(b => b.addEventListener('click', () => { tool = b.dataset.t; $$('#toolSeg button').forEach(x => x.setAttribute('aria-pressed', x === b)); $('#toolHint').textContent = HINTS[tool]; cv.style.cursor = tool === 'move' || tool === 'ref' ? 'grab' : 'crosshair'; }));
$('#toolHint').textContent = HINTS.nib;
const bindOut = (id, fmt, fn) => { const i = $('#' + id), o = $('#' + id + 'o'); const up = () => { o.textContent = fmt ? fmt(i.value) : i.value; fn && fn(+i.value); }; i.addEventListener('input', up); up(); };
bindOut('w'); bindOut('ang', v => v + '°'); bindOut('th');
bindOut('adv', null, v => { if (!P) return; G().adv = v; draw(); renderPreview(); persist(); });
bindOut('refOp', null, () => P && draw());
bindOut('refSc', null, v => { if (!P || !refImg) return; const r = refOf(G()); const cx = r.x + refImg.width * r.s / 2, cy = r.y - refImg.height * r.s / 2; r.s = (1500 / refImg.width) * v / 100; r.x = cx - refImg.width * r.s / 2; r.y = cy + refImg.height * r.s / 2; P.lastRef = Object.assign({}, r); draw(); });
$('#onion').addEventListener('change', draw);
function syncAdv() { const g = G(); $('#adv').value = g.adv; $('#advo').textContent = g.adv; }
// meta
const metaBind = (id, key, num) => { const i = $('#' + id); i.addEventListener('input', () => { P.meta[key] = num ? +i.value : i.value; const o = $('#' + id + 'o'); if (o) o.textContent = i.value; persist(); if (num) { draw(); renderPreview(); } }); };
metaBind('mFam', 'family'); metaBind('mDes', 'designer'); metaBind('mJoin', 'joinH', 1); metaBind('mSpace', 'space', 1);

/* reference image */
$('#refIn').addEventListener('change', e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  const rd = new FileReader(); rd.onload = () => setRef(rd.result, true); rd.readAsDataURL(f);
});
function setRef(url, fresh) {
  const im = new Image(); im.onload = () => {
    refImg = im; if (fresh) { Object.values(P.glyphs).forEach(g => delete g.ref); P.lastRef = null; $('#refSc').value = 100; $('#refSco').textContent = '100'; store.set('ibra-fonts-ref', url) || toast('الصورة كبيرة للحفظ بالمتصفح — تنحفظ وية "حفظ المشروع"'); }
    P.refData = url; draw(); if (fresh) { toast('الصورة جاهزة — استخدم أداة "الصورة" لتحريكها و"تتبّع" لتحويلها'); $('#toolSeg [data-t="ref"]').click(); }
  }; im.src = url;
}
$('#refDel').addEventListener('click', () => { refImg = null; P.refData = null; store.del('ibra-fonts-ref'); draw(); });

/* picker */
function baseKeyOf(c) { return c.lam ? 'la' + c.lam.toString(16).toUpperCase().padStart(4, '0') : c.cp.toString(16).toUpperCase().padStart(4, '0'); }
function familyOf(base) { return CAT.filter(c => baseKeyOf(c) === base); }
$$('#grpSeg button').forEach(b => b.addEventListener('click', () => { group = b.dataset.g; $$('#grpSeg button').forEach(x => x.setAttribute('aria-pressed', x === b)); renderPicker(); }));
function renderPicker() {
  const gl = $('#glist'); gl.textContent = '';
  const bases = []; CAT.filter(c => c.group === group).forEach(c => { const b = baseKeyOf(c); if (!bases.includes(b)) bases.push(b); });
  const curBase = baseKeyOf(BYKEY[cur]);
  bases.forEach(b => {
    const fam = familyOf(b), n = fam.filter(c => hasG(c.key)).length;
    const btn = el('button', {class: 'gl' + (n === fam.length ? ' done' : n ? ' part' : ''), 'aria-current': String(b === curBase), title: n + ' من ' + fam.length + ' مرسوم'});
    btn.textContent = fam[0].ch; btn.addEventListener('click', () => selectGlyph(fam[0].key)); gl.appendChild(btn);
  });
  const fm = $('#forms'); fm.textContent = '';
  const fam = familyOf(curBase);
  ['isol', 'fina', 'init', 'medi'].forEach(f => {
    const c = fam.find(x => x.form === f);
    const b = el('button', {class: 'fm' + (c ? '' : ' na'), 'aria-current': String(!!c && c.key === cur)});
    const tc = document.createElement('canvas'); tc.width = 120; tc.height = 120; b.appendChild(tc); b.appendChild(document.createTextNode(F.FORM_AR[f]));
    if (c) { b.addEventListener('click', () => selectGlyph(c.key)); thumb(tc, c.key); }
    fm.appendChild(b);
  });
  const sel = $('#copyFrom'); sel.textContent = ''; sel.appendChild(el('option', {value: '', text: 'نسخ من…'}));
  fam.filter(c => c.key !== cur && hasG(c.key)).forEach(c => sel.appendChild(el('option', {value: c.key, text: F.FORM_AR[c.form]})));
  const total = CAT.length, done = CAT.filter(c => hasG(c.key)).length;
  $('#progTxt').textContent = 'مرسوم ' + done + ' من ' + total + ' شكل'; $('#progBar').style.width = (done / total * 100) + '%';
}
function thumb(tc, k) {
  const t = tc.getContext('2d'), s = tc.width / SPAN; t.clearRect(0, 0, tc.width, tc.height);
  if (!hasG(k)) { t.fillStyle = '#3a3322'; t.font = '54px "Readex Pro"'; t.textAlign = 'center'; t.textBaseline = 'middle'; t.fillText(BYKEY[k].ch, 60, 62); return; }
  t.fillStyle = '#e6c770'; t.fill(pathOf(G(k).strokes, (x, y) => [(x - X0) * s, (Y1 - y) * s]), 'nonzero');
}
function selectGlyph(k) {
  cur = k; const c = BYKEY[k];
  const grp = c.group; if (grp !== group) { group = grp; $$('#grpSeg button').forEach(x => x.setAttribute('aria-pressed', x.dataset.g === grp)); }
  $('#tag').innerHTML = ''; $('#tag').appendChild(document.createTextNode(c.ch)); $('#tag').appendChild(el('small', {text: F.FORM_AR[c.form]}));
  syncAdv(); renderPicker(); draw();
}
function changed() { renderPicker(); draw(); renderPreview(); persist(); if (P.sample) { P.sample = false; $('#sampleNote').hidden = true; } }

/* live preview */
const pcv = $('#pcv'), pctx = pcv.getContext('2d');
function renderPreview() {
  const text = $('#ptext').value || '', items = F.shapeKeys(text), sc = 0.065, pad = 20;
  const glyphFor = it => {
    if (hasG(it.key)) return [{k: it.key}];
    if (it.alt) { const out = []; const lamK = '0644', alK = it.alt[1].toString(16).toUpperCase().padStart(4, '0'); return [{k: hasG(alK + '.fina') ? alK + '.fina' : alK}, {k: hasG('0644.init') ? '0644.init' : lamK}]; }
    if (it.base && hasG(it.base)) return [{k: it.base, weak: true}];
    return [{ch: it.cp}];
  };
  const seq = []; items.forEach(it => glyphFor(it).forEach(g => seq.push(g)));
  const advOf = g => g.k ? G(g.k).adv : (g.ch === 32 ? (P.meta.space || 260) : 420);
  const total = seq.reduce((a, g) => a + advOf(g), 0) * sc + pad * 2;
  const H = 120, w = Math.max(pcv.parentElement.clientWidth - 16, Math.ceil(total)), dpr = Math.min(2, devicePixelRatio || 1);
  pcv.style.width = w + 'px'; pcv.width = w * dpr; pcv.height = H * dpr;
  pctx.setTransform(dpr, 0, 0, dpr, 0, 0); pctx.clearRect(0, 0, w, H);
  const base = 78; let x = w - pad;
  pctx.strokeStyle = 'rgba(141,117,54,.25)'; pctx.beginPath(); pctx.moveTo(0, base); pctx.lineTo(w, base); pctx.stroke();
  seq.forEach(g => {
    const a = advOf(g) * sc; x -= a;
    if (g.k) { pctx.fillStyle = g.weak ? '#8a6d2a' : '#1b160c'; pctx.fill(pathOf(G(g.k).strokes, (fx, fy) => [x + fx * sc, base - fy * sc]), 'nonzero'); }
    else if (g.ch !== 32) { pctx.fillStyle = 'rgba(27,22,12,.28)'; pctx.font = '34px "Readex Pro", Tahoma'; pctx.textAlign = 'center'; pctx.fillText(String.fromCodePoint(g.ch), x + a / 2, base); }
  });
}
$('#ptext').addEventListener('input', () => { renderPreview(); if (!$('#realTest').hidden) $('#realTest').textContent = $('#ptext').value; });

/* build / export */
let realN = 0;
function build() { const t0 = performance.now(); const r = F.buildFont(P); r.ms = Math.round(performance.now() - t0); return r; }
$('#realBtn').addEventListener('click', async () => {
  let r; try { r = build(); } catch (e) { toast('صار خطأ بالبناء: ' + e.message); return; }
  if (r.drawn < 1) { toast('ارسم حرف واحد على الأقل'); return; }
  const name = 'IBRAtest' + (++realN), ff = new FontFace(name, r.ttf.slice().buffer);
  try { await ff.load(); document.fonts.add(ff); } catch (e) { toast('المتصفح رفض الخط: ' + e.message); return; }
  const box = $('#realTest'); box.hidden = false; box.style.fontFamily = '"' + name + '", "Times New Roman"'; box.textContent = $('#ptext').value;
  toast('هذا ملف الخط الحقيقي — ' + r.drawn + ' شكل، ' + r.forms + ' حرف موصول' + (r.ligs ? '، لام ألف' : ''));
});
function fileBase() { return F.psSafe(P.meta.family || 'IBRA Hand') || 'IBRA-Hand'; }
$('#dlTTF').addEventListener('click', () => { try { const r = build(); if (r.drawn < 1) return toast('ارسم حرف واحد على الأقل'); r.warn.slice(0, 2).forEach(toast); saveFile(fileBase() + '.ttf', r.ttf); } catch (e) { toast('خطأ: ' + e.message); } });
$('#dlZip').addEventListener('click', () => { try { const r = build(); if (r.drawn < 1) return toast('ارسم حرف واحد على الأقل'); saveFile(fileBase() + '.zip', F.makeZip([{name: fileBase() + '.ttf', data: r.ttf}, {name: fileBase() + '.otf', data: r.otf}, {name: fileBase() + '-project.json', data: new TextEncoder().encode(JSON.stringify(P))}])); } catch (e) { toast('خطأ: ' + e.message); } });
$('#instFont').addEventListener('click', async () => {
  if (!window.NATIVE) return;
  try {
    const r = build(); if (r.drawn < 1) return toast('ارسم حرف واحد على الأقل');
    const res = await NATIVE.call('installFont', {file: fileBase() + '.ttf', b64: NATIVE.toB64(r.ttf), family: P.meta.family || 'IBRA Hand', replace: P.meta.installedPath || null});
    P.meta.installedPath = res.path; persist();
    toast('تنصّب "' + (P.meta.family || '') + '" — بفوتوشوب سكّر وافتح البرنامج حتى يظهر');
  } catch (e) { toast('ما تنصّب: ' + e.message); }
});
$('#saveP').addEventListener('click', () => saveFile(fileBase() + '-project.json', JSON.stringify(P)));
$('#openP').addEventListener('change', e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  f.text().then(t => { const p = JSON.parse(t); if (!p.glyphs) throw new Error('مو ملف مشروع'); useProject(p); toast('انفتح المشروع'); }).catch(err => toast('ما انفتح: ' + err.message));
});
const newBtn = $('#newP'); let newArm = 0;
newBtn.addEventListener('click', () => {
  if (Date.now() - newArm > 3000) { newArm = Date.now(); newBtn.textContent = 'متأكد؟ اضغط مرة ثانية'; setTimeout(() => newBtn.textContent = 'مشروع جديد', 3000); return; }
  newBtn.textContent = 'مشروع جديد';
  useProject({meta: Object.assign({}, P.meta), glyphs: {}}); refImg = null; hist = []; redo = []; toast('بدينا مشروع جديد — ابدأ بالحرف ب');
});
function useProject(p) {
  P = p; P.meta = Object.assign({family: 'Ibrahem Rosem Hand', designer: 'Ibrahim Rosem', joinH: 60, space: 260}, P.meta || {});
  $('#mFam').value = P.meta.family; $('#mDes').value = P.meta.designer; $('#mJoin').value = P.meta.joinH; $('#mJoino').textContent = P.meta.joinH; $('#mSpace').value = P.meta.space; $('#mSpaceo').textContent = P.meta.space;
  $('#sampleNote').hidden = !P.sample;
  refImg = null; if (P.refData) setRef(P.refData, false);
  persist(); selectGlyph(BYKEY[cur] ? cur : '0628'); renderPreview();
}
function renderAll() { if (!P) return; renderPicker(); draw(); renderPreview(); }
let rzT; window.addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(() => { if (!$('#v-ed').hidden) { resizeCanvas(); renderAll(); } }, 120); });

/* ---------- boot ---------- */
P = loadProject();
const savedRef = store.get('ibra-fonts-ref'); if (savedRef && !P.refData) P.refData = savedRef;
useProject(P);
// doctor demo: an old-style font made from the sample letters (no joining table)
try {
  const sp = sampleProject(); sp.meta.family = 'Old Diwani Demo'; const demo = F.buildFont(sp, {legacy: true});
  D.entries.push({file: 'مثال - خط قديم.otf', path: 'مثال - خط قديم.otf', id: ++D.seq, raw: demo.otf, kind: 'sfnt', demo: true});
  process();
} catch (e) { renderDoctor(); }
showTab(store.get('ibra-tab') === 'ed' ? 'ed' : 'doc');
if (window.NATIVE && /selftest/.test(location.search)) {
  setTimeout(() => {
    const d = D.entries[0] || {}; let ed = {};
    try { ed = build(); } catch (e) { ed = {error: e.message}; }
    NATIVE.call('selftest', {demo: d.status || 'none', fixes: d.r ? d.r.fixes.length : 0, after: d.out ? F.analyzeSfnt(d.out, 'x').status : 'none', editorGlyphs: ed.drawn || 0, editorForms: ed.forms || 0, error: ed.error || ''});
  }, 1500);
}
})();
