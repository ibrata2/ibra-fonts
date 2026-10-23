/* IBRA Fonts core — shared logic (no DOM). Needs globals: opentype, ClipperLib */
(function (root) {
'use strict';
const OT = root.opentype, CL = root.ClipperLib;

/* ================= Arabic data ================= */
// [cp, joining, pfFirst(isol), pfCount, name, label]
const LETTERS = [
  [0x0621,'U',0xFE80,1,'hamza'],[0x0622,'R',0xFE81,2,'alefmadda'],[0x0623,'R',0xFE83,2,'alefhamzaabove'],
  [0x0624,'R',0xFE85,2,'wawhamzaabove'],[0x0625,'R',0xFE87,2,'alefhamzabelow'],[0x0626,'D',0xFE89,4,'yehhamzaabove'],
  [0x0627,'R',0xFE8D,2,'alef'],[0x0628,'D',0xFE8F,4,'beh'],[0x0629,'R',0xFE93,2,'tehmarbuta'],[0x062A,'D',0xFE95,4,'teh'],
  [0x062B,'D',0xFE99,4,'theh'],[0x062C,'D',0xFE9D,4,'jeem'],[0x062D,'D',0xFEA1,4,'hah'],[0x062E,'D',0xFEA5,4,'khah'],
  [0x062F,'R',0xFEA9,2,'dal'],[0x0630,'R',0xFEAB,2,'thal'],[0x0631,'R',0xFEAD,2,'reh'],[0x0632,'R',0xFEAF,2,'zain'],
  [0x0633,'D',0xFEB1,4,'seen'],[0x0634,'D',0xFEB5,4,'sheen'],[0x0635,'D',0xFEB9,4,'sad'],[0x0636,'D',0xFEBD,4,'dad'],
  [0x0637,'D',0xFEC1,4,'tah'],[0x0638,'D',0xFEC5,4,'zah'],[0x0639,'D',0xFEC9,4,'ain'],[0x063A,'D',0xFECD,4,'ghain'],
  [0x0640,'C',0,0,'tatweel'],[0x0641,'D',0xFED1,4,'feh'],[0x0642,'D',0xFED5,4,'qaf'],[0x0643,'D',0xFED9,4,'kaf'],
  [0x0644,'D',0xFEDD,4,'lam'],[0x0645,'D',0xFEE1,4,'meem'],[0x0646,'D',0xFEE5,4,'noon'],[0x0647,'D',0xFEE9,4,'heh'],
  [0x0648,'R',0xFEED,2,'waw'],[0x0649,'D',0xFEEF,2,'alefmaksura'],[0x064A,'D',0xFEF1,4,'yeh'],
  [0x067E,'D',0xFB56,4,'peh'],[0x0686,'D',0xFB7A,4,'tcheh'],[0x06A4,'D',0xFB6A,4,'veh'],[0x06AF,'D',0xFB92,4,'gaf'],
  [0x06A9,'D',0xFB8E,4,'keheh'],[0x06CC,'D',0xFBFC,4,'farsiyeh']
];
const FORMS = ['isol','fina','init','medi'];
const FORM_AR = {isol:'منفرد',fina:'نهاية',init:'بداية',medi:'وسط'};
const LAMALEF = [[0x0627,0xFEFB,''],[0x0623,0xFEF7,'hamzaabove'],[0x0625,0xFEF9,'hamzabelow'],[0x0622,0xFEF5,'madda']];
const JT = {}; LETTERS.forEach(l => JT[l[0]] = l[1]);
const LBY = {}; LETTERS.forEach(l => LBY[l[0]] = l);
function joinType(cp) {
  if (JT[cp]) return JT[cp];
  if ((cp >= 0x064B && cp <= 0x065F) || cp === 0x0670) return 'T';
  return 'U';
}
const PF = new Map(); // pf code -> {cp,form} | {lam:alefCp, form}
LETTERS.forEach(l => { for (let i = 0; i < l[3]; i++) PF.set(l[2] + i, {cp: l[0], form: FORMS[i]}); });
LAMALEF.forEach(a => { PF.set(a[1], {lam: a[0], form: 'isol'}); PF.set(a[1] + 1, {lam: a[0], form: 'fina'}); });
function pfCode(cp, form) {
  const l = LBY[cp]; if (!l || !l[2]) return 0;
  const i = FORMS.indexOf(form); return i < l[3] ? l[2] + i : 0;
}
const NAME2CP = {};
LETTERS.forEach(l => NAME2CP[l[4]] = l[0]);
Object.assign(NAME2CP, {alefmaddaabove:0x0622, alefwithmaddaabove:0x0622, alefhamza:0x0623, alefwithhamzaabove:0x0623,
  alefwithhamzabelow:0x0625, wawhamza:0x0624, wawwithhamzaabove:0x0624, yehhamza:0x0626, yehwithhamzaabove:0x0626,
  tehmarbutah:0x0629, alefmaksurah:0x0649, dotlessyeh:0x0649, yehfarsi:0x06CC, kehehe:0x06A9, tcheharabic:0x0686,
  hehgoal:0x0647, kashida:0x0640, haa:0x062D, kha:0x062E, thaa:0x062B, taa:0x062A, baa:0x0628, jim:0x062C});
const AFII = {57388:0x060C,57403:0x061B,57407:0x061F,57409:0x0621,57410:0x0622,57411:0x0623,57412:0x0624,57413:0x0625,
  57414:0x0626,57415:0x0627,57416:0x0628,57417:0x0629,57418:0x062A,57419:0x062B,57420:0x062C,57421:0x062D,57422:0x062E,
  57423:0x062F,57424:0x0630,57425:0x0631,57426:0x0632,57427:0x0633,57428:0x0634,57429:0x0635,57430:0x0636,57431:0x0637,
  57432:0x0638,57433:0x0639,57434:0x063A,57440:0x0640,57441:0x0641,57442:0x0642,57443:0x0643,57444:0x0644,57445:0x0645,
  57446:0x0646,57470:0x0647,57448:0x0648,57449:0x0649,57450:0x064A,57506:0x067E,57507:0x0686,57509:0x06AF};
for (let i = 0; i < 10; i++) AFII[57392 + i] = 0x0660 + i;

function formWord(s) {
  if (/^(init|initial|ini)$/.test(s)) return 'init';
  if (/^(medi|medial|med|mid)$/.test(s)) return 'medi';
  if (/^(fina|final|fin|end)$/.test(s)) return 'fina';
  if (/^(isol|isolated|iso)$/.test(s)) return 'isol';
  return null;
}
// glyph name -> {cp, form} | {lam, form} | {pf} | {uni}
function parseGlyphName(n) {
  if (!n || n === '.notdef') return null;
  let m;
  if ((m = /^uni0644(0622|0623|0625|0627)(?:\.(\w+))?$/i.exec(n))) return {lam: parseInt(m[1], 16), form: (m[2] && formWord(m[2].toLowerCase())) || 'isol'};
  if ((m = /^(?:uni([0-9A-F]{4})|u([0-9A-F]{4,6}))(?:\.(.+))?$/i.exec(n))) {
    const cp = parseInt(m[1] || m[2], 16), suf = m[3] ? m[3].toLowerCase() : '';
    if (PF.has(cp)) return {pf: cp};
    if (JT[cp]) { const f = suf.split(/[._]/).map(formWord).find(Boolean); return {cp, form: f || (suf ? null : 'isol')}; }
    return suf ? null : {uni: cp};
  }
  if ((m = /^afii(\d{5})(?:\.(.+))?$/i.exec(n))) {
    const cp = AFII[+m[1]]; if (!cp) return null;
    const f = m[2] ? m[2].toLowerCase().split(/[._]/).map(formWord).find(Boolean) : 'isol';
    return JT[cp] ? (f ? {cp, form: f} : null) : (m[2] ? null : {uni: cp});
  }
  let s = n.toLowerCase(), parts = s.split('.'), base = parts.shift(), form = null;
  for (const p of parts) { const f = formWord(p); if (f) form = f; else if (!/^(ar|alt\d*|ss\d+|salt|swsh|\d+)$/.test(p)) return null; }
  base = base.replace(/arabic$/, '').replace(/[-_]ar$/, '').replace(/[-_]arab$/, '');
  if (!form) {
    const fm = /(initial|init|medial|medi|final|fina|isolated|isol)$/.exec(base);
    if (fm) { form = formWord(fm[1]); base = base.slice(0, -fm[1].length); }
  }
  const key = base.replace(/[^a-z]/g, '');
  if (key.startsWith('lamalef')) {
    const rest = key.slice(7);
    const a = {'':0x0627, hamzaabove:0x0623, hamza:0x0623, hamzabelow:0x0625, madda:0x0622, maddaabove:0x0622}[rest];
    return a ? {lam: a, form: form || 'isol'} : null;
  }
  if (NAME2CP[key]) return {cp: NAME2CP[key], form: form || 'isol'};
  return null;
}

/* Build letter-forms table from cmap + glyph names */
function arabicTable(cmap, names) {
  const T = {}, LA = {};
  const set = (cp, f, g) => { if (g == null || g <= 0) return; const o = T[cp] || (T[cp] = {}); if (o[f] == null) o[f] = g; };
  const setLA = (a, f, g) => { if (g == null || g <= 0) return; const o = LA[a] || (LA[a] = {}); if (o[f] == null) o[f] = g; };
  LETTERS.forEach(l => set(l[0], 'isol', cmap.get(l[0])));
  for (const [code, info] of PF) { const g = cmap.get(code); if (g) info.lam ? setLA(info.lam, info.form, g) : set(info.cp, info.form, g); }
  if (names) names.forEach((n, gid) => {
    if (!gid) return; const i = parseGlyphName(n); if (!i) return;
    if (i.pf) { const p = PF.get(i.pf); p.lam ? setLA(p.lam, p.form, gid) : set(p.cp, p.form, gid); }
    else if (i.lam) setLA(i.lam, i.form, gid);
    else if (i.cp && i.form) set(i.cp, i.form, gid);
  });
  return {T, LA};
}
function planArabic(tab) {
  const subs = {init: [], medi: [], fina: []}, ligs = [], baseMap = new Map();
  let letters = 0, withForms = 0;
  for (const l of LETTERS) {
    const o = tab.T[l[0]]; if (!o) continue;
    const src = o.isol != null ? o.isol : (o.fina != null ? o.fina : null);
    if (src == null) continue;
    letters++; baseMap.set(l[0], src);
    let had = false;
    for (const f of ['fina', 'init', 'medi']) {
      if (l[1] === 'R' && f !== 'fina') continue;
      if (l[1] === 'U' || l[1] === 'C') continue;
      const d = o[f]; if (d != null && d !== src) { subs[f].push([src, d]); had = true; }
    }
    if (had) withForms++;
  }
  const lam = tab.T[0x0644];
  if (lam) {
    const lamI = lam.init != null ? lam.init : lam.isol, lamM = lam.medi != null ? lam.medi : lam.isol;
    for (const a of LAMALEF) {
      const la = tab.LA[a[0]], al = tab.T[a[0]]; if (!la || !al || lamI == null) continue;
      const alF = al.fina != null ? al.fina : al.isol; if (alF == null) continue;
      if (la.isol != null) ligs.push([[lamI, alF], la.isol]);
      if (la.fina != null && lamM !== lamI) ligs.push([[lamM, alF], la.fina]);
    }
  }
  return {subs, ligs, baseMap, letters, withForms};
}

/* ================= binary helpers ================= */
const latin1 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return s; };
const tagAt = (u8, p) => String.fromCharCode(u8[p], u8[p + 1], u8[p + 2], u8[p + 3]);
const dvOf = u8 => new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
function concatU8(arr) { let n = 0; arr.forEach(a => n += a.length); const o = new Uint8Array(n); let p = 0; arr.forEach(a => { o.set(a, p); p += a.length; }); return o; }

function readSfnt(u8, base = 0) {
  const dv = dvOf(u8), flavor = dv.getUint32(base), n = dv.getUint16(base + 4), tables = {};
  for (let i = 0; i < n; i++) {
    const p = base + 12 + 16 * i, tag = tagAt(u8, p), off = dv.getUint32(p + 8), len = dv.getUint32(p + 12);
    if (off + len <= u8.length) tables[tag] = u8.slice(off, off + len);
  }
  return {flavor, tables};
}
function checksum(u8) {
  const n = Math.ceil(u8.length / 4) * 4; let s = 0;
  for (let i = 0; i < n; i += 4) s = (s + (((u8[i] || 0) << 24) | ((u8[i + 1] || 0) << 16) | ((u8[i + 2] || 0) << 8) | (u8[i + 3] || 0))) >>> 0;
  return s;
}
function writeSfnt(flavor, tables) {
  const tags = Object.keys(tables).sort(), n = tags.length;
  let es = 0; while ((1 << (es + 1)) <= n) es++;
  const sr = (1 << es) * 16;
  let off = 12 + 16 * n, size = off;
  tags.forEach(t => size += Math.ceil(tables[t].length / 4) * 4);
  const out = new Uint8Array(size), dv = dvOf(out);
  dv.setUint32(0, flavor); dv.setUint16(4, n); dv.setUint16(6, sr); dv.setUint16(8, es); dv.setUint16(10, n * 16 - sr);
  let headOff = -1;
  tags.forEach((t, i) => {
    let d = tables[t];
    if (t === 'head') { d = d.slice(); dvOf(d).setUint32(8, 0); headOff = off; }
    const p = 12 + 16 * i;
    for (let k = 0; k < 4; k++) out[p + k] = t.charCodeAt(k);
    dv.setUint32(p + 4, checksum(d)); dv.setUint32(p + 8, off); dv.setUint32(p + 12, d.length);
    out.set(d, off); off += Math.ceil(d.length / 4) * 4;
  });
  if (headOff >= 0) dv.setUint32(headOff + 8, (0xB1B0AFBA - checksum(out)) >>> 0);
  return out;
}

/* ---------- cmap ---------- */
function parseCmap(d) {
  const dv = dvOf(d), n = dv.getUint16(2), subs = [];
  for (let i = 0; i < n; i++) { const pid = dv.getUint16(4 + i * 8), eid = dv.getUint16(6 + i * 8), off = dv.getUint32(8 + i * 8); if (off < d.length) subs.push({pid, eid, off, format: dv.getUint16(off)}); }
  const read = (s) => {
    const m = new Map(), o = s.off;
    try {
      if (s.format === 4) {
        const seg = dv.getUint16(o + 6) / 2, eO = o + 14, sO = eO + seg * 2 + 2, dO = sO + seg * 2, rO = dO + seg * 2;
        for (let i = 0; i < seg; i++) {
          const e = dv.getUint16(eO + i * 2), st = dv.getUint16(sO + i * 2), de = dv.getInt16(dO + i * 2), ro = dv.getUint16(rO + i * 2);
          for (let c = st; c <= e && c !== 0xFFFF; c++) {
            let g;
            if (!ro) g = (c + de) & 0xFFFF;
            else { const p = rO + i * 2 + ro + (c - st) * 2; if (p + 2 > d.length) continue; g = dv.getUint16(p); if (g) g = (g + de) & 0xFFFF; }
            if (g) m.set(c, g);
          }
        }
      } else if (s.format === 12) {
        const ng = dv.getUint32(o + 12);
        for (let i = 0; i < ng; i++) { const a = dv.getUint32(o + 16 + i * 12), b = dv.getUint32(o + 20 + i * 12), g = dv.getUint32(o + 24 + i * 12); for (let c = a; c <= b && c - a < 70000; c++) m.set(c, g + c - a); }
      } else if (s.format === 0) { for (let c = 0; c < 256; c++) { const g = d[o + 6 + c]; if (g) m.set(c, g); } }
      else if (s.format === 6) { const f = dv.getUint16(o + 6), cnt = dv.getUint16(o + 8); for (let i = 0; i < cnt; i++) { const g = dv.getUint16(o + 10 + i * 2); if (g) m.set(f + i, g); } }
    } catch (e) {}
    return m;
  };
  const uni = new Map(); let symbol = null, mac = null;
  subs.filter(s => s.pid === 0 || (s.pid === 3 && (s.eid === 1 || s.eid === 10))).sort((a, b) => b.format - a.format)
    .forEach(s => read(s).forEach((g, c) => { if (!uni.has(c)) uni.set(c, g); }));
  const sy = subs.find(s => s.pid === 3 && s.eid === 0); if (sy) symbol = read(sy);
  const mc = subs.find(s => s.pid === 1 && s.eid === 0); if (mc) mac = read(mc);
  return {subs, uni, symbol, mac};
}

/* ---------- name ---------- */
const MACROMAN_HI = 'ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄€‹›ﬁﬂ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ';
function parseName(d) {
  const dv = dvOf(d), cnt = dv.getUint16(2), so = dv.getUint16(4), recs = [];
  for (let i = 0; i < cnt; i++) {
    const p = 6 + i * 12, r = {pid: dv.getUint16(p), eid: dv.getUint16(p + 2), lid: dv.getUint16(p + 4), nid: dv.getUint16(p + 6)};
    const len = dv.getUint16(p + 8), off = so + dv.getUint16(p + 10); if (off + len > d.length) continue;
    const b = d.subarray(off, off + len); let s = '';
    if (r.pid === 0 || r.pid === 3) { for (let k = 0; k + 1 < b.length; k += 2) s += String.fromCharCode((b[k] << 8) | b[k + 1]); r.ok = true; }
    else if (r.pid === 1 && r.eid === 0) { for (const c of b) s += c < 128 ? String.fromCharCode(c) : MACROMAN_HI[c - 128]; r.ok = true; }
    else { s = latin1(b); r.ok = false; }
    r.s = s; recs.push(r);
  }
  return recs;
}
function badString(s) { return !s || /[\uFFFD\u0000-\u001F\uE000-\uF8FF]/.test(s) || (s.length > 2 && (s.match(/\?/g) || []).length > s.length / 3); }
function nameGet(recs, nid) {
  const c = recs.filter(r => r.nid === nid && r.ok);
  const pick = c.find(r => r.pid === 3 && r.eid === 1 && r.lid === 0x409) || c.find(r => r.pid === 3 && (r.eid === 1 || r.eid === 10)) || c.find(r => r.pid === 0) || c.find(r => r.pid === 1);
  return pick ? pick.s : '';
}
function buildName(records) { // records: [{nid, s}] windows unicode en-US
  const rs = records.filter(r => r.s).sort((a, b) => a.nid - b.nid);
  const strs = rs.map(r => { const b = new Uint8Array(r.s.length * 2); for (let i = 0; i < r.s.length; i++) { b[i * 2] = r.s.charCodeAt(i) >> 8; b[i * 2 + 1] = r.s.charCodeAt(i) & 255; } return b; });
  const so = 6 + rs.length * 12, out = new Uint8Array(so + strs.reduce((a, b) => a + b.length, 0)), dv = dvOf(out);
  dv.setUint16(0, 0); dv.setUint16(2, rs.length); dv.setUint16(4, so);
  let off = 0;
  rs.forEach((r, i) => { const p = 6 + i * 12; dv.setUint16(p, 3); dv.setUint16(p + 2, 1); dv.setUint16(p + 4, 0x409); dv.setUint16(p + 6, r.nid); dv.setUint16(p + 8, strs[i].length); dv.setUint16(p + 10, off); out.set(strs[i], so + off); off += strs[i].length; });
  return out;
}
function psSafe(s) { return (s || '').normalize('NFKD').replace(/[^A-Za-z0-9-]/g, '').slice(0, 60); }

/* ---------- GSUB scripts/features ---------- */
function parseLayout(d) {
  try {
    const dv = dvOf(d), sl = dv.getUint16(4), fl = dv.getUint16(6), scripts = [], features = [];
    const sc = dv.getUint16(sl); for (let i = 0; i < sc; i++) scripts.push(tagAt(d, sl + 2 + i * 6));
    const fc = dv.getUint16(fl); for (let i = 0; i < fc; i++) features.push(tagAt(d, fl + 2 + i * 6));
    return {scripts, features};
  } catch (e) { return {scripts: [], features: []}; }
}

/* ================= Analyzer ================= */
function analyzeSfnt(u8, fileName, opts) {
  opts = opts || {};
  const r = {issues: [], fixes: [], plan: {}, info: {}};
  let sf;
  try { sf = readSfnt(u8); } catch (e) { r.status = 'bad'; r.issues.push('الملف تالف وما ينقرأ كخط.'); return r; }
  const t = sf.tables;
  r.info.flavor = sf.flavor === 0x4F54544F ? 'OTF (CFF)' : 'TTF';
  r.info.numGlyphs = t.maxp ? dvOf(t.maxp).getUint16(4) : 0;
  if (!t.cmap || !t.head || !t.maxp) { r.status = 'bad'; r.issues.push('جداول أساسية ناقصة (cmap/head/maxp) — الخط تالف.'); return r; }
  r.info.version = t.head ? (dvOf(t.head).getInt32(4) / 65536).toFixed(3) : '';
  // names
  const recs = t.name ? parseName(t.name) : [];
  const win = recs.filter(r2 => r2.pid === 3);
  let fam = nameGet(recs, 16) || nameGet(recs, 1), sty = nameGet(recs, 17) || nameGet(recs, 2) || 'Regular';
  const ps = nameGet(recs, 6);
  r.plan.rename = false;
  if (!win.length) { r.issues.push('أسماء الخط مكتوبة بنظام ماك القديم بس — فوتوشوب على ويندوز يعرضه مخربط أو ما يعرضه.'); r.plan.rename = true; }
  if (badString(fam)) { r.issues.push('اسم الخط مخربط (رموز غريبة أو علامات استفهام).'); r.plan.rename = true; fam = ''; }
  if (badString(sty)) sty = 'Regular';
  if (!ps || ps !== psSafe(ps) || ps.length > 63) { r.issues.push('اسم PostScript ناقص أو بيه حروف غير مسموحة — يسبب تضارب بقائمة خطوط أدوبي.'); r.plan.rename = true; }
  if (!fam) fam = (fileName || 'Font').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\s+(regular|bold|italic|light|medium)$/i, '').trim() || 'Font';
  r.info.family = fam; r.info.style = sty; r.info.ps = ps; r.info.recs = recs;
  // OS/2
  r.plan.os2 = {};
  if (t['OS/2'] && t['OS/2'].length >= 58) {
    const dv = dvOf(t['OS/2']), fs = dv.getUint16(8);
    r.info.fsType = fs;
    if (fs & 0x0302 && opts.unlock) { r.plan.os2.fsType = true; }
    else if (fs & 0x0002) r.info.restricted = true;
  } else r.issues.push('جدول OS/2 ناقص — ويندوز ممكن يرفض تنصيبه.');
  // cmap
  const cm = parseCmap(t.cmap);
  let map = cm.uni;
  if (!map.size && cm.symbol && cm.symbol.size) { r.info.symbol = true; }
  r.info.cmapCount = map.size;
  const effective = new Map(map);
  if (r.info.symbol) cm.symbol.forEach((g, c) => effective.set(c, g));
  const lay0 = t.GSUB ? parseLayout(t.GSUB) : {scripts: [], features: []};
  const healthy0 = lay0.scripts.includes('arab') && lay0.features.includes('init') && LETTERS.filter(l => map.has(l[0])).length >= 20;
  // glyph names are only needed when the cmap alone does not show a healthy Arabic font (slow on big fonts)
  let names = null;
  if (!healthy0 && u8.length < 8e6) {
    try { const f = OT.parse(u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength)); names = []; for (let i = 0; i < f.glyphs.length; i++) names.push(f.glyphs.get(i).name || ''); } catch (e) { names = null; }
  }
  const tab = arabicTable(effective, names), plan = planArabic(tab);
  const baseCount = LETTERS.filter(l => map.has(l[0])).length;
  const lay = t.GSUB ? parseLayout(t.GSUB) : {scripts: [], features: []};
  const gsubOK = lay.scripts.includes('arab') && lay.features.includes('init') && lay.features.includes('fina');
  r.info.arabic = plan.letters; r.info.forms = plan.withForms; r.info.base = baseCount; r.info.gsub = gsubOK;
  const enough = Math.max(4, Math.ceil(plan.letters * 0.7));
  if (plan.letters < 4) {
    r.kind = 'latin';
    if (/[؀-ۿ]/.test(fam) || /arab|ae_|af_|hacen|kufi|naskh|thuluth|diwani|farsi/i.test(fam + (fileName || ''))) {
      r.issues.push('شكله خط عربي قديم مبني على مواقع الحروف الإنكليزية (Non-Unicode). هذا النوع ما يتصلح تلقائياً: يشتغل بس إذا تكتب بكيبورد/محول خاص بيه.');
      r.status = 'legacy';
    }
  } else {
    r.kind = 'arabic';
    if (gsubOK && baseCount >= enough) { /* healthy */ }
    else if (plan.withForms >= 3) {
      r.plan.arabic = plan;
      if (baseCount < enough) r.issues.push('الحروف العربية محطوطة بس بمواقع "الأشكال الجاهزة" القديمة — فوتوشوب يطلعها فراغات أو مربعات.');
      if (!gsubOK) r.issues.push('ما بيه جدول وصل الحروف (GSUB init/medi/fina) — بفوتوشوب الحروف تطلع منفصلة/مقطعة.');
    } else if (!gsubOK) {
      r.issues.push('الخط ما بيه أشكال الحروف الموصولة أصلاً — يطلع منفصل بأي برنامج، وما يتصلح بدون رسم الأشكال.');
      r.status = 'noforms';
    }
    if (t['OS/2'] && t['OS/2'].length >= 86) {
      const dv = dvOf(t['OS/2']);
      if (!(dv.getUint32(42) & (1 << 13)) || !(dv.getUint32(78) & (1 << 6))) { r.plan.os2.arabicBits = true; r.issues.push('ويندوز ما معلّم الخط كخط عربي (OS/2 Arabic range) — بعض البرامج تخفيه من قائمة الخطوط العربية.'); }
    }
  }
  if (r.info.restricted) r.issues.push('الخط عليه قفل تضمين (Restricted License) — ممكن يمنع حفظ PDF من الستريتر. (فك القفل خيار يدوي)');
  if (!r.status) r.status = (r.plan.arabic || r.plan.rename || r.plan.os2.arabicBits || r.plan.os2.fsType) ? 'fix' : 'ok';
  r.names = names; r.map = map; r.sf = sf;
  return r;
}

/* Apply fixes -> new sfnt bytes */
function applyFixes(r, opts) {
  opts = opts || {};
  const t = Object.assign({}, r.sf.tables);
  if (r.plan.arabic) {
    const p = r.plan.arabic, n = r.info.numGlyphs;
    const cmapAll = new Map(r.map);
    p.baseMap.forEach((g, cp) => { if (!cmapAll.has(cp)) cmapAll.set(cp, g); });
    const glyphs = [];
    for (let i = 0; i < n; i++) { const g = new OT.Glyph({name: i ? 'g' + i : '.notdef', advanceWidth: 500, path: new OT.Path()}); g.unicodes = []; glyphs.push(g); }
    cmapAll.forEach((g, cp) => { if (g < n) glyphs[g].unicodes.push(cp); });
    glyphs.forEach(g => { g.unicodes.sort((a, b) => a - b); g.unicode = g.unicodes[0]; });
    const f = new OT.Font({familyName: 'T', styleName: 'R', unitsPerEm: 1000, ascender: 800, descender: -200, glyphs});
    ['fina', 'init', 'medi'].forEach(ft => p.subs[ft].forEach(([s, d]) => f.substitution.addSingle(ft, {sub: s, by: d}, 'arab', 'dflt')));
    p.ligs.forEach(([seq, d]) => f.substitution.addLigature('rlig', {sub: seq, by: d}, 'arab', 'dflt'));
    const tmp = readSfnt(new Uint8Array(f.toArrayBuffer()));
    t.cmap = tmp.tables.cmap; t.GSUB = tmp.tables.GSUB;
    r.fixes.push('بنينا جدول وصل الحروف (بداية/وسط/نهاية' + (p.ligs.length ? ' + لام ألف' : '') + ') لـ ' + p.withForms + ' حرف.');
    if (r.info.base < Math.ceil(r.info.arabic * 0.7)) r.fixes.push('ربطنا الحروف العربية العادية (يونيكود) بأشكالها حتى تنكتب مباشرة.');
  }
  if (t['OS/2'] && (r.plan.os2.arabicBits || r.plan.os2.fsType)) {
    const o = t['OS/2'].slice(), dv = dvOf(o);
    if (r.plan.os2.fsType) { dv.setUint16(8, 0); r.fixes.push('فكّينا قفل التضمين (fsType).'); }
    if (r.plan.os2.arabicBits && o.length >= 86) { dv.setUint32(42, dv.getUint32(42) | (1 << 13)); dv.setUint32(78, dv.getUint32(78) | (1 << 6)); r.fixes.push('علّمنا الخط كعربي لويندوز (Arabic codepage).'); }
    t['OS/2'] = o;
  }
  if (r.plan.rename || opts.forceRename) {
    const fam = r.newFamily || r.info.family, sty = r.info.style || 'Regular';
    const rib = /^(regular|bold|italic|bold italic)$/i.test(sty);
    const keep = (r.info.recs || []).filter(x => x.pid === 3 && x.ok && [0, 5, 7, 8, 9, 10, 11, 12, 13, 14].includes(x.nid) && !badString(x.s));
    const seen = {}, recs = [];
    keep.forEach(x => { if (!seen[x.nid]) { seen[x.nid] = 1; recs.push({nid: x.nid, s: x.s}); } });
    const ps = r.newPS || (psSafe(fam) || 'Font') + '-' + (psSafe(sty) || 'Regular');
    recs.push({nid: 1, s: rib ? fam : fam + ' ' + sty}, {nid: 2, s: rib ? sty : 'Regular'},
      {nid: 3, s: ps + ';IBRA-fix'}, {nid: 4, s: /^regular$/i.test(sty) ? fam : fam + ' ' + sty}, {nid: 6, s: ps});
    if (!seen[5]) recs.push({nid: 5, s: 'Version ' + (r.info.version || '1.000')});
    if (!rib) recs.push({nid: 16, s: fam}, {nid: 17, s: sty});
    t.name = buildName(recs);
    r.fixes.push('رتبنا أسماء الخط: "' + fam + '" — ' + sty + ' (PostScript: ' + ps + ').');
  }
  return writeSfnt(r.sf.flavor === 0x4F54544F ? 0x4F54544F : 0x00010000, t);
}

/* ================= Containers ================= */
function splitTTC(u8) {
  const dv = dvOf(u8), n = dv.getUint32(8), out = [];
  for (let i = 0; i < n; i++) { const sf = readSfnt(u8, dv.getUint32(12 + i * 4)); out.push(writeSfnt(sf.flavor, sf.tables)); }
  return out;
}
async function woffToSfnt(u8) {
  const dv = dvOf(u8), flavor = dv.getUint32(4), n = dv.getUint16(12), tables = {};
  for (let i = 0; i < n; i++) {
    const p = 44 + i * 20, tag = tagAt(u8, p), off = dv.getUint32(p + 4), cl = dv.getUint32(p + 8), ol = dv.getUint32(p + 12);
    let d = u8.slice(off, off + cl);
    if (cl < ol) {
      const ds = new Blob([d]).stream().pipeThrough(new DecompressionStream('deflate'));
      d = new Uint8Array(await new Response(ds).arrayBuffer());
    }
    tables[tag] = d;
  }
  return writeSfnt(flavor, tables);
}

/* ================= Type 1 -> OTF ================= */
const STD_ENC = (() => {
  const a = []; const s = 'space exclam quotedbl numbersign dollar percent ampersand quoteright parenleft parenright asterisk plus comma hyphen period slash zero one two three four five six seven eight nine colon semicolon less equal greater question at A B C D E F G H I J K L M N O P Q R S T U V W X Y Z bracketleft backslash bracketright asciicircum underscore quoteleft a b c d e f g h i j k l m n o p q r s t u v w x y z braceleft bar braceright asciitilde'.split(' ');
  s.forEach((n, i) => a[32 + i] = n);
  'grave acute circumflex tilde macron breve dotaccent dieresis'.split(' ').forEach((n, i) => a[193 + i] = n);
  a[202] = 'ring'; a[203] = 'cedilla'; a[205] = 'hungarumlaut'; a[206] = 'ogonek'; a[207] = 'caron';
  return a;
})();
const ASCII_NAME = {}; STD_ENC.forEach((n, c) => { if (n && c < 127) ASCII_NAME[n] = c === 39 ? 0x2019 : c === 96 ? 0x2018 : c; });
Object.assign(ASCII_NAME, {quotesingle: 39, grave: 96, nbspace: 0xA0, endash: 0x2013, emdash: 0x2014});
function t1decrypt(u8, r, skip) {
  const out = new Uint8Array(Math.max(0, u8.length - skip));
  for (let i = 0; i < u8.length; i++) { const c = u8[i], p = c ^ (r >> 8); r = ((c + r) * 52845 + 22719) & 0xFFFF; if (i >= skip) out[i - skip] = p; }
  return out;
}
function parseType1(u8, fileName) {
  let clear = '', bin;
  if (u8[0] === 0x80) {
    let p = 0; const bins = [];
    while (p + 6 <= u8.length && u8[p] === 0x80) {
      const ty = u8[p + 1]; if (ty === 3) break;
      const len = (u8[p + 2] | (u8[p + 3] << 8) | (u8[p + 4] << 16) | (u8[p + 5] << 24)) >>> 0;
      const seg = u8.subarray(p + 6, p + 6 + len);
      if (ty === 1) { if (!bins.length) clear += latin1(seg); } else bins.push(seg);
      p += 6 + len;
    }
    bin = concatU8(bins);
  } else {
    const s = latin1(u8), i = s.indexOf('eexec'); if (i < 0) throw new Error('not type1');
    clear = s.slice(0, i + 5);
    const hex = s.slice(i + 5).replace(/[^0-9a-fA-F]/g, '');
    bin = new Uint8Array(hex.length >> 1); for (let k = 0; k < bin.length; k++) bin[k] = parseInt(hex.substr(k * 2, 2), 16);
  }
  const dec = t1decrypt(bin, 55665, 4), priv = latin1(dec);
  const g = (re) => { const m = re.exec(clear); return m ? m[1] : ''; };
  const fontName = g(/\/FontName\s*\/(\S+)/), familyName = g(/\/FamilyName\s*\(([^)]*)\)/), weight = g(/\/Weight\s*\(([^)]*)\)/);
  const fm = g(/\/FontMatrix\s*\[([^\]]+)\]/).trim().split(/\s+/).map(Number);
  const bb = (g(/\/FontBBox\s*[\[{]([^\]}]+)[\]}]/) || '0 -250 1000 900').trim().split(/\s+/).map(Number);
  const enc = [];
  if (/\/Encoding\s+StandardEncoding/.test(clear)) STD_ENC.forEach((n, c) => enc[c] = n);
  else { const re = /dup\s+(\d+)\s*\/([^\s\/\[\]{}()<>]+)\s+put/g; let m; while ((m = re.exec(clear))) enc[+m[1]] = m[2]; }
  const lenIV = +((/\/lenIV\s+(-?\d+)/.exec(priv) || [0, 4])[1]);
  const cs = (b) => lenIV < 0 ? b : t1decrypt(b, 4330, lenIV);
  const subrs = [];
  let si = priv.indexOf('/Subrs');
  if (si >= 0) {
    const cnt = +((/\/Subrs\s+(\d+)/.exec(priv.slice(si)) || [0, 0])[1]);
    const re = /dup\s+(\d+)\s+(\d+)\s+\S+\s/g; re.lastIndex = si;
    for (let k = 0; k < cnt; k++) { const m = re.exec(priv); if (!m) break; const st = re.lastIndex, len = +m[2]; subrs[+m[1]] = cs(dec.subarray(st, st + len)); re.lastIndex = st + len; }
  }
  const charStrings = {}, order = [];
  const ci = priv.indexOf('/CharStrings');
  if (ci < 0) throw new Error('no CharStrings');
  const re = /\/([^\s\/\[\]{}()<>]+)\s+(\d+)\s+\S+\s/g; re.lastIndex = ci + 12;
  const cnt = +((/\/CharStrings\s+(\d+)/.exec(priv.slice(ci)) || [0, 5000])[1]);
  for (let k = 0; k < cnt; k++) { const m = re.exec(priv); if (!m) break; const st = re.lastIndex, len = +m[2]; charStrings[m[1]] = cs(dec.subarray(st, st + len)); order.push(m[1]); re.lastIndex = st + len; }
  const scale = fm.length === 6 && fm[0] ? fm[0] * 1000 : 1;
  function interp(name, path, dx, dy, depth) {
    const c0 = charStrings[name]; if (!c0) return 0;
    const st = [], ps = []; let x = 0, y = 0, w = 0, open = false, flex = false, fp = [];
    const S = v => v * scale;
    const mv = (ax, ay) => { if (flex) { x += ax; y += ay; return; } if (open) path.close(); x += ax; y += ay; path.moveTo(S(x + dx), S(y + dy)); open = true; };
    const ln = (ax, ay) => { x += ax; y += ay; path.lineTo(S(x + dx), S(y + dy)); };
    const cv = (a, b, c, d, e, f) => { const x1 = x + a, y1 = y + b, x2 = x1 + c, y2 = y1 + d; x = x2 + e; y = y2 + f; path.curveTo(S(x1 + dx), S(y1 + dy), S(x2 + dx), S(y2 + dy), S(x + dx), S(y + dy)); };
    let done = false, calls = 0;
    function run(c) {
      let i = 0;
      while (i < c.length && !done) {
        const v = c[i++];
        if (v >= 32) {
          if (v <= 246) st.push(v - 139);
          else if (v <= 250) st.push((v - 247) * 256 + c[i++] + 108);
          else if (v <= 254) st.push(-(v - 251) * 256 - c[i++] - 108);
          else { st.push((c[i] << 24) | (c[i + 1] << 16) | (c[i + 2] << 8) | c[i + 3]); i += 4; }
          continue;
        }
        switch (v) {
          case 1: case 3: st.length = 0; break;
          case 4: mv(0, st[st.length - 1]); st.length = 0; break;
          case 5: ln(st[0], st[1]); st.length = 0; break;
          case 6: ln(st[0], 0); st.length = 0; break;
          case 7: ln(0, st[0]); st.length = 0; break;
          case 8: cv(st[0], st[1], st[2], st[3], st[4], st[5]); st.length = 0; break;
          case 9: if (open) { path.close(); open = false; } st.length = 0; break;
          case 10: { const n = st.pop(); if (subrs[n] && ++calls < 5000) run(subrs[n]); break; }
          case 11: return;
          case 12: {
            const e = c[i++];
            if (e === 6) { // seac
              const [asb, adx, ady, bc, ac] = st; st.length = 0;
              if (open) { path.close(); open = false; }
              if (depth < 2) { interp(STD_ENC[bc], path, dx, dy, depth + 1); interp(STD_ENC[ac], path, dx + adx - asb + 0, dy + ady, depth + 1); }
              done = true; return;
            } else if (e === 7) { x = st[0]; y = st[1]; w = st[2]; st.length = 0; }
            else if (e === 12) { const b = st.pop(), a = st.pop(); st.push(a / b); }
            else if (e === 16) {
              const n = st.pop(), argc = st.pop(), args = []; for (let k = 0; k < argc; k++) args.push(st.pop());
              if (n === 1) { flex = true; fp = []; }
              else if (n === 2) fp.push([x, y]);
              else if (n === 0) {
                flex = false;
                if (fp.length >= 7) {
                  const P = fp.map(q => [S(q[0] + dx), S(q[1] + dy)]);
                  path.curveTo(P[1][0], P[1][1], P[2][0], P[2][1], P[3][0], P[3][1]);
                  path.curveTo(P[4][0], P[4][1], P[5][0], P[5][1], P[6][0], P[6][1]);
                }
                ps.length = 0; ps.push(args[0], args[1]);
              } else if (n === 3) { ps.length = 0; ps.push(3); }
              else { ps.length = 0; for (const a of args) ps.push(a); }
            }
            else if (e === 17) st.push(ps.length ? ps.pop() : 0);
            else if (e === 33) { x = st[0]; y = st[1]; st.length = 0; }
            else st.length = 0;
            break;
          }
          case 13: x = st[0]; y = 0; w = st[1]; st.length = 0; break;
          case 14: if (open) { path.close(); open = false; } done = true; return;
          case 21: mv(st[0], st[1]); st.length = 0; break;
          case 22: mv(st[0], 0); st.length = 0; break;
          case 30: cv(0, st[0], st[1], st[2], st[3], 0); st.length = 0; break;
          case 31: cv(st[0], 0, st[1], st[2], 0, st[3]); st.length = 0; break;
          default: st.length = 0;
        }
      }
    }
    run(c0);
    if (open) path.close();
    return w * scale;
  }
  const codeOf = {}; enc.forEach((n, c) => { if (n && codeOf[n] == null) codeOf[n] = c; });
  const glyphs = [new OT.Glyph({name: '.notdef', advanceWidth: 500, path: new OT.Path()})];
  const used = new Set();
  order.filter(n => n !== '.notdef').forEach(n => {
    const path = new OT.Path(); const w = interp(n, path, 0, 0, 0);
    const gl = new OT.Glyph({name: n, advanceWidth: Math.round(w), path}); gl.unicodes = [];
    const pi = parseGlyphName(n);
    let cp = pi && pi.uni ? pi.uni : (pi && pi.cp && pi.form === 'isol' ? pi.cp : (pi && pi.pf) || ASCII_NAME[n]);
    if (cp == null && codeOf[n] != null && codeOf[n] >= 32) cp = codeOf[n];
    if (cp != null && !used.has(cp)) { used.add(cp); gl.unicodes.push(cp); gl.unicode = cp; }
    glyphs.push(gl);
  });
  if (!used.has(32)) { const sp = new OT.Glyph({name: 'space', unicode: 32, advanceWidth: 250, path: new OT.Path()}); sp.unicodes = [32]; glyphs.push(sp); }
  const fam = familyName || fontName || (fileName || 'Font').replace(/\.[^.]+$/, '');
  const style = (weight && !/^(regular|normal|book|roman|medium)$/i.test(weight)) ? weight : 'Regular';
  const font = new OT.Font({familyName: fam, styleName: style, unitsPerEm: 1000, ascender: Math.round(Math.max(bb[3] * scale, 700)), descender: Math.round(Math.min(bb[1] * scale, -200)), glyphs,
    designer: '', manufacturer: 'Converted by IBRA Fonts'});
  // Arabic shaping if names reveal forms
  const cmap = new Map(); glyphs.forEach((gl, i) => (gl.unicodes || []).forEach(c => cmap.set(c, i)));
  const tab = arabicTable(cmap, glyphs.map(gl => gl.name)), plan = planArabic(tab);
  let ar = 0;
  if (plan.withForms >= 4) {
    plan.baseMap.forEach((gi, cp) => { const gl = glyphs[gi]; if (!cmap.has(cp)) { gl.unicodes.push(cp); if (gl.unicode == null) gl.unicode = cp; } });
    ['fina', 'init', 'medi'].forEach(ft => plan.subs[ft].forEach(([s, d]) => font.substitution.addSingle(ft, {sub: s, by: d}, 'arab', 'dflt')));
    plan.ligs.forEach(([seq, d]) => font.substitution.addLigature('rlig', {sub: seq, by: d}, 'arab', 'dflt'));
    ar = plan.withForms;
  }
  return {bytes: new Uint8Array(font.toArrayBuffer()), family: fam, style, arabicForms: ar, glyphs: glyphs.length};
}

/* ================= ZIP (store) ================= */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function makeZip(files) { // [{name, data:Uint8Array}]
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  files.forEach(f => {
    const nb = enc.encode(f.name), crc = crc32(f.data), h = new Uint8Array(30 + nb.length), dv = dvOf(h);
    dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 0x0800, true); dv.setUint16(8, 0, true);
    dv.setUint32(14, crc, true); dv.setUint32(18, f.data.length, true); dv.setUint32(22, f.data.length, true); dv.setUint16(26, nb.length, true); h.set(nb, 30);
    const c = new Uint8Array(46 + nb.length), cv = dvOf(c);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, f.data.length, true); cv.setUint32(24, f.data.length, true); cv.setUint16(28, nb.length, true); cv.setUint32(42, off, true); c.set(nb, 46);
    parts.push(h, f.data); central.push(c); off += h.length + f.data.length;
  });
  const cd = concatU8(central), e = new Uint8Array(22), ev = dvOf(e);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true); ev.setUint32(12, cd.length, true); ev.setUint32(16, off, true);
  return concatU8(parts.concat([cd, e]));
}

/* ================= Editor geometry ================= */
function hull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  up.pop(); lo.pop(); return lo.concat(up); // CCW (y-up)
}
function nibShape(st, pr) {
  const w = st.w * pr / 2;
  if (st.t === 'round') { const o = []; for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; o.push([Math.cos(a) * w, Math.sin(a) * w]); } return o; }
  const a = (st.a || 0) * Math.PI / 180, th = Math.max(4, st.w * 0.1) * pr / 2;
  const vx = Math.cos(a) * w, vy = Math.sin(a) * w, ux = -Math.sin(a) * th, uy = Math.cos(a) * th;
  return [[vx + ux, vy + uy], [-vx + ux, -vy + uy], [-vx - ux, -vy - uy], [vx - ux, vy - uy]];
}
function strokePolys(st) {
  if (st._p) return st._p;
  let res = [];
  if (st.t === 'poly') res = st.polys;
  else {
    const P = st.pts; if (!P || !P.length) return (st._p = []);
    const sh = P.map(q => nibShape(st, q[2] || 1));
    if (P.length === 1) res.push(hull(sh[0].map(v => [P[0][0] + v[0], P[0][1] + v[1]])));
    for (let i = 0; i + 1 < P.length; i++) {
      const a = P[i], b = P[i + 1], pts = [];
      sh[i].forEach(v => pts.push([a[0] + v[0], a[1] + v[1]])); sh[i + 1].forEach(v => pts.push([b[0] + v[0], b[1] + v[1]]));
      res.push(hull(pts));
    }
  }
  Object.defineProperty(st, '_p', {value: res, enumerable: false, writable: true, configurable: true});
  return res;
}
function smoothPts(P, spacing) { // resample + chaikin
  if (P.length < 3) return P;
  let out = [P[0]];
  for (let i = 1; i < P.length; i++) { const l = out[out.length - 1], q = P[i]; if (Math.hypot(q[0] - l[0], q[1] - l[1]) >= spacing || i === P.length - 1) out.push(q); }
  for (let it = 0; it < 2 && out.length > 2; it++) {
    const n = [out[0]];
    for (let i = 0; i + 1 < out.length; i++) { const a = out[i], b = out[i + 1]; n.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25, a[2] * .75 + b[2] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75, a[2] * .25 + b[2] * .75]); }
    n.push(out[out.length - 1]); out = n;
  }
  return out.map(q => [Math.round(q[0] * 10) / 10, Math.round(q[1] * 10) / 10, Math.round((q[2] || 1) * 100) / 100]);
}
function area(p) { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[i], r = p[(i + 1) % p.length]; a += q[0] * r[1] - r[0] * q[1]; } return a / 2; }
function rdp(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop(); let md = 0, mi = -1; const A = pts[a], B = pts[b], dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1e-9;
    for (let i = a + 1; i < b; i++) { const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + B[0] * A[1] - B[1] * A[0]) / L; if (d > md) { md = d; mi = i; } }
    if (md > tol && mi > 0) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
function simplifyClosed(p, tol) {
  if (p.length < 8) return p;
  let far = 0, fd = 0; p.forEach((q, i) => { const d = Math.hypot(q[0] - p[0][0], q[1] - p[0][1]); if (d > fd) { fd = d; far = i; } });
  const a = rdp(p.slice(0, far + 1), tol), b = rdp(p.slice(far).concat([p[0]]), tol);
  return a.concat(b.slice(1, -1));
}
// Union all polygons of a glyph -> clean contours (CCW outer, y-up, integer)
function unionGlyph(strokes) {
  const SC = 8, paths = [];
  strokes.forEach(st => strokePolys(st).forEach(p => { if (p.length >= 3) paths.push(p.map(q => ({X: Math.round(q[0] * SC), Y: Math.round(q[1] * SC)}))); }));
  if (!paths.length) return [];
  const c = new CL.Clipper(); c.AddPaths(paths, CL.PolyType.ptSubject, true);
  const sol = new CL.Paths(); c.Execute(CL.ClipType.ctUnion, sol, CL.PolyFillType.pftNonZero, CL.PolyFillType.pftNonZero);
  const out = [];
  CL.Clipper.CleanPolygons(sol, SC * 0.5).forEach(path => {
    let p = path.map(q => [q.X / SC, q.Y / SC]);
    if (Math.abs(area(p)) < 6) return;
    p = simplifyClosed(p, 0.6).map(q => [Math.round(q[0]), Math.round(q[1])]);
    p = p.filter((q, i) => { const n = p[(i + 1) % p.length]; return q[0] !== n[0] || q[1] !== n[1]; });
    if (p.length >= 3) out.push(p);
  });
  return out;
}
// trace binary bitmap -> polygons (pixel coords, y-down) ; outer CW on screen
function traceBitmap(ink, W, H) {
  const at = (x, y) => x >= 0 && y >= 0 && x < W && y < H && ink[y * W + x];
  const edges = new Map(); const key = (x, y) => y * (W + 1) + x;
  const add = (x1, y1, x2, y2) => { const k = key(x1, y1); let l = edges.get(k); if (!l) edges.set(k, l = []); l.push([x2, y2]); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!ink[y * W + x]) continue;
    if (!at(x, y - 1)) add(x, y, x + 1, y);
    if (!at(x + 1, y)) add(x + 1, y, x + 1, y + 1);
    if (!at(x, y + 1)) add(x + 1, y + 1, x, y + 1);
    if (!at(x - 1, y)) add(x, y + 1, x, y);
  }
  const loops = [];
  for (const [k0, l0] of edges) {
    while (l0.length) {
      const sx = k0 % (W + 1), sy = (k0 / (W + 1)) | 0, loop = [[sx, sy]];
      let [cx, cy] = l0.pop(), guard = 0;
      while (!(cx === sx && cy === sy) && guard++ < 1e6) {
        loop.push([cx, cy]); const l = edges.get(key(cx, cy)); if (!l || !l.length) break;
        [cx, cy] = l.pop();
      }
      if (loop.length >= 4) loops.push(loop);
    }
  }
  return loops;
}
function chaikinClosed(p, it) {
  for (let k = 0; k < it; k++) { const n = []; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; n.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]); } p = n; }
  return p;
}

/* ================= Font builder (editor) ================= */
// project: {meta:{family, designer, version}, glyphs:{key:{adv, strokes}}}
// keys: '0628' (isol) | '0628.init' | 'la0627' / 'la0627.fina' | '0661' etc.
function glyphCatalog() {
  const C = [];
  LETTERS.forEach(l => {
    const hex = l[0].toString(16).toUpperCase().padStart(4, '0'), ch = String.fromCharCode(l[0]);
    const forms = l[1] === 'D' ? FORMS : l[1] === 'R' ? ['isol', 'fina'] : ['isol'];
    forms.forEach(f => C.push({key: f === 'isol' ? hex : hex + '.' + f, cp: l[0], form: f, ch, group: 'letters', jt: l[1]}));
  });
  LAMALEF.forEach(a => ['isol', 'fina'].forEach(f => C.push({key: 'la' + a[0].toString(16).toUpperCase().padStart(4, '0') + (f === 'fina' ? '.fina' : ''), lam: a[0], form: f, ch: 'ل' + String.fromCharCode(a[0]), group: 'lamalef'})));
  for (let i = 0; i < 10; i++) C.push({key: (0x0660 + i).toString(16).toUpperCase(), cp: 0x0660 + i, form: 'isol', ch: String.fromCharCode(0x0660 + i), group: 'digits'});
  [0x060C, 0x061B, 0x061F, 0x21, 0x2E, 0x3A, 0x28, 0x29, 0xAB, 0xBB, 0x2D].forEach(cp => C.push({key: cp.toString(16).toUpperCase().padStart(4, '0'), cp, form: 'isol', ch: String.fromCharCode(cp), group: 'punct'}));
  return C;
}
function writeGlyf(contourSets) { // array per glyph of contours (CW for TT)
  const glyf = [], loca = [0]; let off = 0, maxP = 0, maxC = 0;
  contourSets.forEach(cs => {
    if (!cs || !cs.length) { loca.push(off); return; }
    let xMin = 1e9, yMin = 1e9, xMax = -1e9, yMax = -1e9, np = 0;
    cs.forEach(c => c.forEach(([x, y]) => { xMin = Math.min(xMin, x); yMin = Math.min(yMin, y); xMax = Math.max(xMax, x); yMax = Math.max(yMax, y); np++; }));
    maxP = Math.max(maxP, np); maxC = Math.max(maxC, cs.length);
    const len = 10 + cs.length * 2 + 2 + np + np * 4, pad = (len + 3) & ~3, b = new Uint8Array(pad), dv = dvOf(b);
    dv.setInt16(0, cs.length); dv.setInt16(2, xMin); dv.setInt16(4, yMin); dv.setInt16(6, xMax); dv.setInt16(8, yMax);
    let p = 10, e = -1; cs.forEach(c => { e += c.length; dv.setUint16(p, e); p += 2; });
    dv.setUint16(p, 0); p += 2;
    for (let i = 0; i < np; i++) b[p++] = 1;
    let lx = 0; cs.forEach(c => c.forEach(([x]) => { dv.setInt16(p, x - lx); lx = x; p += 2; }));
    let ly = 0; cs.forEach(c => c.forEach(([, y]) => { dv.setInt16(p, y - ly); ly = y; p += 2; }));
    glyf.push(b); off += pad; loca.push(off);
  });
  const lb = new Uint8Array(loca.length * 4), lv = dvOf(lb); loca.forEach((o, i) => lv.setUint32(i * 4, o));
  return {glyf: concatU8(glyf.length ? glyf : [new Uint8Array(0)]), loca: lb, maxP, maxC};
}
function buildFont(project, opt) {
  opt = opt || {};
  const meta = project.meta || {}, cat = glyphCatalog(), G = project.glyphs || {};
  const items = []; // {name, unicodes, adv, contours}
  const keyIndex = {};
  const notdef = [[[50, 0], [50, 700], [450, 700], [450, 0]], [[100, 50], [400, 50], [400, 650], [100, 650]]];
  items.push({name: '.notdef', unicodes: [], adv: 500, contours: notdef.map(c => c)});
  items.push({name: 'space', unicodes: [32, 0xA0], adv: Math.round(meta.space || 260), contours: []});
  const warn = [];
  cat.forEach(c => {
    const g = G[c.key]; if (!g || !g.strokes || !g.strokes.length) return;
    const contours = unionGlyph(g.strokes); if (!contours.length) return;
    let name, uni = [];
    if (opt.legacy) {
      const L = c.cp && LBY[c.cp];
      if (c.lam) { name = 'lam_alef' + ({0x0627:'',0x0623:'hamzaabove',0x0625:'hamzabelow',0x0622:'madda'})[c.lam] + '-ar' + (c.form === 'fina' ? '.fina' : ''); }
      else if (L) { name = L[4] + '-ar' + (c.form === 'isol' ? '' : '.' + c.form); if (c.form === 'isol') uni.push(c.cp); }
      else { name = 'uni' + c.cp.toString(16).toUpperCase().padStart(4, '0'); uni.push(c.cp); }
    } else if (c.lam) { name = 'uni0644' + c.lam.toString(16).toUpperCase().padStart(4, '0') + (c.form === 'fina' ? '.fina' : ''); const la = LAMALEF.find(a => a[0] === c.lam); uni.push(la[1] + (c.form === 'fina' ? 1 : 0)); }
    else { const hex = c.cp.toString(16).toUpperCase().padStart(4, '0'); name = 'uni' + hex + (c.form === 'isol' ? '' : '.' + c.form); if (c.form === 'isol') uni.push(c.cp); const pf = pfCode(c.cp, c.form); if (pf) uni.push(pf); }
    keyIndex[c.key] = items.length;
    items.push({name, unicodes: uni, adv: Math.round(g.adv || 600), contours, cat: c});
  });
  // tatweel auto
  if (!keyIndex['0640'] && opt.autoTatweel !== false && !opt.legacy) {
    const t = Math.round(meta.joinH || 60), w = 220;
    keyIndex['0640'] = items.length; items.push({name: 'uni0640', unicodes: [0x0640], adv: w, contours: [[[-10, 0], [w + 10, 0], [w + 10, t], [-10, t]]]});
  }
  // forms without isolated -> promote to base
  if (!opt.legacy) LETTERS.forEach(l => {
    const hex = l[0].toString(16).toUpperCase().padStart(4, '0');
    if (keyIndex[hex] == null) { const alt = ['fina', 'init', 'medi'].map(f => keyIndex[hex + '.' + f]).find(v => v != null); if (alt != null) { items[alt].unicodes.unshift(l[0]); warn.push('الحرف ' + String.fromCharCode(l[0]) + ' ما مرسوم منفرد — استخدمنا شكل ثاني بداله.'); } }
  });
  const cmap = new Map(); items.forEach((it, i) => it.unicodes.forEach(u => { if (!cmap.has(u)) cmap.set(u, i); }));
  const T = {}, LA = {};
  cat.forEach(c => { const i = keyIndex[c.key]; if (i == null) return; if (c.lam) (LA[c.lam] = LA[c.lam] || {})[c.form] = i; else (T[c.cp] = T[c.cp] || {})[c.form] = i; });
  LETTERS.forEach(l => { const g = cmap.get(l[0]); if (g != null) { T[l[0]] = T[l[0]] || {}; if (T[l[0]].isol == null) T[l[0]].isol = g; } });
  const plan = planArabic({T, LA});
  let yMin = 0, yMax = 0;
  items.forEach(it => it.contours.forEach(c => c.forEach(([, y]) => { yMin = Math.min(yMin, y); yMax = Math.max(yMax, y); })));
  const asc = Math.max(900, Math.ceil(yMax / 10) * 10 + 20), desc = Math.min(-400, Math.floor(yMin / 10) * 10 - 20);
  const glyphs = items.map(it => {
    const path = new OT.Path();
    it.contours.forEach(c => { path.moveTo(c[0][0], c[0][1]); for (let k = 1; k < c.length; k++) path.lineTo(c[k][0], c[k][1]); path.close(); });
    const g = new OT.Glyph({name: it.name, advanceWidth: it.adv, path}); g.unicodes = it.unicodes.slice(); g.unicode = g.unicodes[0]; return g;
  });
  const family = (meta.family || 'IBRA Hand').trim();
  const font = new OT.Font({familyName: family, styleName: 'Regular', unitsPerEm: 1000, ascender: asc, descender: desc, glyphs,
    designer: meta.designer || 'Ibrahim Rosem', designerURL: '', manufacturer: 'IBRA Fonts', version: meta.version || '1.000',
    description: 'Made with IBRA Fonts', copyright: '© ' + (meta.designer || 'Ibrahim Rosem')});
  if (!opt.legacy) {
    ['fina', 'init', 'medi'].forEach(ft => plan.subs[ft].forEach(([s, d]) => font.substitution.addSingle(ft, {sub: s, by: d}, 'arab', 'dflt')));
    plan.ligs.forEach(([seq, d]) => font.substitution.addLigature('rlig', {sub: seq, by: d}, 'arab', 'dflt'));
  }
  const otfRaw = new Uint8Array(font.toArrayBuffer());
  const sf = readSfnt(otfRaw);
  // OS/2: Arabic bits, metrics
  const os2 = sf.tables['OS/2'].slice(), ov = dvOf(os2);
  ov.setUint16(8, 0);
  if (!opt.legacy) ov.setUint32(42, ov.getUint32(42) | (1 << 13) | 1); ov.setUint32(46, ov.getUint32(46) | (1 << 31)); ov.setUint32(50, ov.getUint32(50) | (1 << 3));
  if (os2.length >= 86) ov.setUint32(78, opt.legacy ? 1 : (1 << 6) | 1);
  ov.setInt16(68, asc); ov.setInt16(70, desc); ov.setInt16(72, 0); ov.setUint16(74, asc); ov.setUint16(76, -desc);
  sf.tables['OS/2'] = os2;
  const hh = sf.tables.hhea.slice(), hv = dvOf(hh); hv.setInt16(4, asc); hv.setInt16(6, desc); hv.setInt16(8, 0); sf.tables.hhea = hh;
  const otf = writeSfnt(0x4F54544F, sf.tables);
  // TTF
  const tt = Object.assign({}, sf.tables); delete tt['CFF ']; delete tt.CFF2;
  const gl = writeGlyf(items.map(it => it.contours.map(c => c.slice().reverse())));
  tt.glyf = gl.glyf; tt.loca = gl.loca;
  const head = tt.head.slice(); dvOf(head).setInt16(50, 1); tt.head = head;
  const mx = new Uint8Array(32), mv = dvOf(mx);
  mv.setUint32(0, 0x00010000); mv.setUint16(4, items.length); mv.setUint16(6, gl.maxP); mv.setUint16(8, gl.maxC); mv.setUint16(14, 2);
  tt.maxp = mx;
  const post = new Uint8Array(32); dvOf(post).setUint32(0, 0x00030000); tt.post = post;
  const ttf = writeSfnt(0x00010000, tt);
  const drawn = items.length - 2;
  return {otf, ttf, glyphCount: items.length, drawn, forms: plan.withForms, ligs: plan.ligs.length, warn, family};
}

/* ================= Shaping for live preview ================= */
function shapeKeys(text) {
  const chars = Array.from(text).map(c => c.codePointAt(0)), out = [];
  const jt = chars.map(joinType);
  const prevJ = i => { for (let k = i - 1; k >= 0; k--) { if (jt[k] === 'T') continue; return jt[k] === 'D' || jt[k] === 'C'; } return false; };
  const nextJ = i => { for (let k = i + 1; k < chars.length; k++) { if (jt[k] === 'T') continue; return jt[k] === 'D' || jt[k] === 'R' || jt[k] === 'C'; } return false; };
  for (let i = 0; i < chars.length; i++) {
    const cp = chars[i], t = jt[i];
    if (t === 'T') continue;
    if (cp === 0x0644) { let k = i + 1; while (k < chars.length && jt[k] === 'T') k++; const a = chars[k]; if (LAMALEF.some(x => x[0] === a)) { const pj = prevJ(i); out.push({key: 'la' + a.toString(16).toUpperCase().padStart(4, '0') + (pj ? '.fina' : ''), alt: [cp, a], cp}); i = k; continue; } }
    const hex = cp.toString(16).toUpperCase().padStart(4, '0');
    let form = 'isol';
    if (t === 'D') { const p = prevJ(i), n = nextJ(i); form = p && n ? 'medi' : p ? 'fina' : n ? 'init' : 'isol'; }
    else if (t === 'R') form = prevJ(i) ? 'fina' : 'isol';
    out.push({key: form === 'isol' ? hex : hex + '.' + form, base: hex, cp, form});
  }
  return out;
}

root.IBRAFONT = {LETTERS, FORMS, FORM_AR, LAMALEF, joinType, parseGlyphName, arabicTable, planArabic, readSfnt, writeSfnt,
  parseCmap, parseName, nameGet, analyzeSfnt, applyFixes, splitTTC, woffToSfnt, parseType1, makeZip, crc32,
  strokePolys, smoothPts, unionGlyph, traceBitmap, chaikinClosed, simplifyClosed, area, glyphCatalog, buildFont, shapeKeys, psSafe, tagAt};
})(typeof window !== 'undefined' ? window : globalThis);
