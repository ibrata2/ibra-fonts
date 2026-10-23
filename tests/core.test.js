// Engine tests for IBRA خطوط — runs the same web/core.js the app uses, and checks the fonts it writes
// with HarfBuzz (the shaping engine browsers and many design apps use).
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), {execSync} = require('child_process');
const web = path.join(__dirname, '..', 'web');
globalThis.opentype = require(path.join(web, 'vendor', 'opentype.min.js'));
globalThis.ClipperLib = require(path.join(web, 'vendor', 'clipper.js'));
require(path.join(web, 'core.js'));
const F = globalThis.IBRAFONT, OT = globalThis.opentype;

let failed = 0, passed = 0;
function check(name, cond, info) { if (cond) { passed++; console.log('  ✓ ' + name); } else { failed++; console.log('  ✗ ' + name + (info ? '  → ' + info : '')); } }

require('harfbuzzjs').then(hb => {
  const shape = (bytes, text) => {
    const blob = hb.createBlob(bytes), face = hb.createFace(blob, 0), font = hb.createFont(face), buf = hb.createBuffer();
    buf.addText(text); buf.guessSegmentProperties(); hb.shape(font, buf);
    const out = buf.json().map(g => g.g); buf.destroy(); font.destroy(); face.destroy(); blob.destroy(); return out;
  };
  const tmp = fs.mkdtempSync('/tmp/ibra-fonts-');

  console.log('\n# Editor: build a font from drawn strokes');
  const st = pts => ({t: 'nib', w: 80, a: 35, pts: F.smoothPts(pts.map(p => [p[0], p[1], 1]), 6)});
  const G = {
    '0628': {adv: 600, strokes: [st([[560, 160], [540, 40], [300, 10], [60, 40], [30, 140]]), {t: 'round', w: 60, pts: [[300, -130, 1]]}]},
    '0628.init': {adv: 300, strokes: [st([[300, 180], [280, 60], [200, 30], [-20, 30]])]},
    '0628.medi': {adv: 260, strokes: [st([[290, 30], [150, 140], [-20, 30]])]},
    '0628.fina': {adv: 600, strokes: [st([[630, 28], [420, 18], [60, 40], [30, 140]])]},
    '0627': {adv: 260, strokes: [st([[150, 720], [130, 0]])]},
    '0627.fina': {adv: 260, strokes: [st([[150, 740], [148, 70], [290, 26]])]},
    '0644': {adv: 420, strokes: [st([[330, 740], [320, 40], [50, 30]])]},
    '0644.init': {adv: 240, strokes: [st([[200, 760], [180, 70], [-20, 30]])]},
    '0644.medi': {adv: 240, strokes: [st([[270, 30], [130, 300], [128, 740]])]},
    '0644.fina': {adv: 420, strokes: [st([[440, 30], [320, 40], [50, 30]])]},
    'la0627': {adv: 520, strokes: [st([[420, 740], [250, 80], [60, 120], [280, 0]])]},
    'la0627.fina': {adv: 560, strokes: [st([[420, 740], [250, 80], [60, 120], [580, 30]])]},
    '0645': {adv: 400, strokes: [{t: 'poly', polys: [[[0, 0], [400, 0], [400, 300], [0, 300]], [[100, 100], [100, 200], [300, 200], [300, 100]]]}]}
  };
  const built = F.buildFont({meta: {family: 'IBRA Test Hand'}, glyphs: G});
  check('wrote TTF and OTF', built.ttf.length > 1000 && built.otf.length > 1000);
  check('3 letters with joining forms + 2 lam-alef', built.forms === 3 && built.ligs === 2, JSON.stringify({forms: built.forms, ligs: built.ligs}));
  for (const [kind, bytes] of [['TTF', built.ttf], ['OTF', built.otf]]) {
    const f = OT.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    const gid = n => { for (let i = 0; i < f.glyphs.length; i++) if (f.glyphs.get(i).name === n) return i; return -1; };
    const bbb = shape(bytes, 'ببب');
    check(kind + ': ببب → three different joined forms', new Set(bbb).size === 3 && !bbb.includes(0), bbb);
    const la = shape(bytes, 'لا'), bla = shape(bytes, 'بلا');
    check(kind + ': لا becomes one lam-alef glyph', la.length === 1 && la[0] !== 0, la);
    check(kind + ': بلا uses the final lam-alef', bla.length === 2 && bla[0] !== la[0], bla);
    if (kind === 'OTF') check('OTF glyph names are standard (uni0628.init)', gid('uni0628.init') > 0 && bbb.includes(gid('uni0628.init')));
  }
  const m = OT.parse(built.otf.buffer.slice(built.otf.byteOffset)).charToGlyph('م').getPath(0, 0, 100).commands.filter(c => c.type === 'M').length;
  check('traced shape keeps its hole (م has 2 contours)', m === 2, m);
  fs.writeFileSync(path.join(tmp, 'built.ttf'), built.ttf);

  console.log('\n# Doctor: an old font with letters only in presentation forms and no GSUB');
  const box = (n, u, w) => { const p = new OT.Path(); p.moveTo(0, 0); p.lineTo(w || 300, 0); p.lineTo(w || 300, 80); p.lineTo(0, 80); p.close(); const g = new OT.Glyph({name: n, advanceWidth: w || 300, path: p}); g.unicodes = u == null ? [] : [u]; g.unicode = u; return g; };
  const pf = [box('.notdef'), box('space', 32)];
  [[0xFE8F, 4], [0xFE95, 4], [0xFEDD, 4], [0xFEE1, 4], [0xFEE5, 4], [0xFE8D, 2], [0xFEAD, 2], [0xFEA9, 2]].forEach(([c, n]) => { for (let i = 0; i < n; i++) pf.push(box('g' + (c + i).toString(16), c + i)); });
  pf.push(box('lamalef', 0xFEFB), box('lamaleff', 0xFEFC));
  const oldFont = new Uint8Array(new OT.Font({familyName: 'Old Kufi', styleName: 'Regular', unitsPerEm: 1000, ascender: 800, descender: -200, glyphs: pf}).toArrayBuffer());
  const r1 = F.analyzeSfnt(oldFont, 'old-kufi.otf');
  check('found as broken Arabic font', r1.status === 'fix' && r1.plan.arabic, r1.status);
  check('explains: letters only in old positions', r1.issues.some(t => t.includes('الأشكال الجاهزة')));
  const fixed1 = F.applyFixes(r1);
  check('re-check after fix: healthy', F.analyzeSfnt(fixed1, 'x').status === 'ok');
  const s1 = shape(fixed1, 'بلا تم');
  check('fixed font joins (no missing glyphs, lam-alef ligature)', !s1.includes(0) && s1.length === 5, s1);

  console.log('\n# Doctor: glyph names only (beh-ar.init …), base letters in cmap');
  const nm = [box('.notdef'), box('space', 32)];
  [['beh', 0x628, 1], ['teh', 0x62A, 1], ['noon', 0x646, 1], ['meem', 0x645, 1], ['seen', 0x633, 1], ['alef', 0x627, 0], ['reh', 0x631, 0], ['dal', 0x62F, 0]].forEach(([n, cp, dual]) => {
    nm.push(box(n + '-ar', cp), box(n + '-ar.fina')); if (dual) nm.push(box(n + '-ar.init'), box(n + '-ar.medi'));
  });
  const namesFont = new Uint8Array(new OT.Font({familyName: 'Glyphs Naskh', styleName: 'Regular', unitsPerEm: 1000, ascender: 800, descender: -200, glyphs: nm}).toArrayBuffer());
  const r2 = F.analyzeSfnt(namesFont, 'glyphs-naskh.otf');
  check('found as fixable', r2.status === 'fix', r2.status);
  const fixed2 = F.applyFixes(r2), s2 = shape(fixed2, 'بنتم'), s2b = shape(namesFont, 'بنتم');
  check('joined forms appear after fix', s2.join() !== s2b.join() && !s2.includes(0), s2 + ' vs ' + s2b);

  console.log('\n# Doctor: Mac-only / broken names');
  const healthy = F.analyzeSfnt(built.ttf, 'built.ttf');
  check('healthy font is left alone', healthy.status === 'ok', healthy.status + ' ' + healthy.issues.join(' | '));
  const sf = F.readSfnt(built.ttf), recs = F.parseName(sf.tables.name);
  // rebuild a name table with Mac records only
  const mac = recs.filter(r => r.pid === 3).map(r => ({nid: r.nid, s: r.s}));
  const strs = mac.map(r => Buffer.from(r.s, 'latin1')), so = 6 + mac.length * 12, nt = Buffer.alloc(so + strs.reduce((a, b) => a + b.length, 0));
  nt.writeUInt16BE(0, 0); nt.writeUInt16BE(mac.length, 2); nt.writeUInt16BE(so, 4); let off = 0;
  mac.forEach((r, i) => { const p = 6 + i * 12; nt.writeUInt16BE(1, p); nt.writeUInt16BE(0, p + 2); nt.writeUInt16BE(0, p + 4); nt.writeUInt16BE(r.nid, p + 6); nt.writeUInt16BE(strs[i].length, p + 8); nt.writeUInt16BE(off, p + 10); strs[i].copy(nt, so + off); off += strs[i].length; });
  sf.tables.name = new Uint8Array(nt);
  const macOnly = F.writeSfnt(sf.flavor, sf.tables), r3 = F.analyzeSfnt(macOnly, 'mac.ttf');
  check('Mac-only names detected', r3.status === 'fix' && r3.plan.rename, r3.issues.join(' | '));
  const fixed3 = F.applyFixes(r3), n3 = F.parseName(F.readSfnt(fixed3).tables.name);
  check('Windows names written', F.nameGet(n3, 1) === 'IBRA Test Hand' && F.nameGet(n3, 6) === 'IBRATestHand-Regular', F.nameGet(n3, 1) + ' / ' + F.nameGet(n3, 6));
  check('outlines untouched by the rename (glyf identical)', Buffer.compare(Buffer.from(F.readSfnt(fixed3).tables.glyf), Buffer.from(F.readSfnt(built.ttf).tables.glyf)) === 0);

  console.log('\n# Containers: TTC, WOFF, Type 1');
  // TTC with two fonts
  const ttcParts = [built.ttf, fixed3];
  const hdr = Buffer.alloc(12 + 4 * ttcParts.length); hdr.write('ttcf', 0); hdr.writeUInt32BE(0x00010000, 4); hdr.writeUInt32BE(ttcParts.length, 8);
  const blobs = []; let pos = hdr.length;
  ttcParts.forEach((p, i) => {
    const s = F.readSfnt(p), tags = Object.keys(s.tables).sort();
    const dir = Buffer.alloc(12 + 16 * tags.length); dir.writeUInt32BE(s.flavor, 0); dir.writeUInt16BE(tags.length, 4);
    hdr.writeUInt32BE(pos, 12 + 4 * i);
    let tpos = pos + dir.length; const datas = [];
    tags.forEach((t, k) => { const d = Buffer.from(s.tables[t]); const pad = Buffer.alloc((4 - d.length % 4) % 4); dir.write(t, 12 + 16 * k, 'latin1'); dir.writeUInt32BE(tpos, 12 + 16 * k + 8); dir.writeUInt32BE(d.length, 12 + 16 * k + 12); datas.push(d, pad); tpos += d.length + pad.length; });
    blobs.push(dir, ...datas); pos = tpos;
  });
  const parts = F.splitTTC(new Uint8Array(Buffer.concat([hdr, ...blobs])));
  check('TTC split into 2 fonts that read back', parts.length === 2 && parts.every(p => F.analyzeSfnt(p, 'p.ttf').status !== 'bad'));
  // WOFF
  const s0 = F.readSfnt(built.ttf), wt = Object.keys(s0.tables).sort();
  const wh = Buffer.alloc(44 + 20 * wt.length); wh.write('wOFF', 0); wh.writeUInt32BE(s0.flavor, 4); wh.writeUInt16BE(wt.length, 12);
  let wp = wh.length; const wd = [];
  wt.forEach((t, i) => { const raw = Buffer.from(s0.tables[t]), z = zlib.deflateSync(raw), use = z.length < raw.length ? z : raw, pad = Buffer.alloc((4 - use.length % 4) % 4); wh.write(t, 44 + 20 * i, 'latin1'); wh.writeUInt32BE(wp, 48 + 20 * i); wh.writeUInt32BE(use.length, 52 + 20 * i); wh.writeUInt32BE(raw.length, 56 + 20 * i); wd.push(use, pad); wp += use.length + pad.length; });
  F.woffToSfnt(new Uint8Array(Buffer.concat([wh, ...wd]))).then(sfnt => {
    check('WOFF converted back to an installable font', shape(sfnt, 'ببب').join() === shape(built.ttf, 'ببب').join());
    // Type 1
    const t1 = F.parseType1(new Uint8Array(fs.readFileSync(path.join(__dirname, 'data', 'cmr10.pfb'))), 'cmr10.pfb');
    const t1g = shape(t1.bytes, 'Hello');
    check('Type 1 (.pfb) converted to OpenType with ' + t1.glyphs + ' glyphs', t1.glyphs > 100 && !t1g.includes(0), t1g);
    const tf = OT.parse(t1.bytes.buffer.slice(t1.bytes.byteOffset)), gp = tf.charToGlyph('g').getPath(0, 0, 1000).commands.length;
    check('Type 1 outlines decoded (g has curves)', gp > 10, gp);
    // ZIP
    const zip = F.makeZip([{name: 'خطوط/a.ttf', data: built.ttf}, {name: 'تقرير.txt', data: new TextEncoder().encode('ok')}]);
    const zp = path.join(tmp, 't.zip'); fs.writeFileSync(zp, zip);
    let zipOk = false; try { const o = execSync('unzip -t ' + zp).toString(); zipOk = /No errors/.test(o); } catch (e) {}
    check('ZIP with Arabic names passes unzip -t', zipOk);
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
  });
}).catch(e => { console.error(e); process.exit(1); });
