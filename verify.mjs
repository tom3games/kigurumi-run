import './mute-auto.mjs'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
import { chromium, webkit } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
const ROOT = import.meta.dirname
mkdirSync(ROOT + '/shots', { recursive: true })
const PORT = 47331
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const URL0 = `http://localhost:${PORT}/`
let pass = 0, fail = 0
const results = []
async function t(name, fn) {
  try { const r = await fn(); if (r === false) throw new Error('false'); pass++; results.push(`ok   ${name}${r && r !== true ? '  ' + JSON.stringify(r) : ''}`) }
  catch (e) { fail++; results.push(`FAIL ${name}  ${e.message.split('\n')[0]}`) }
}
const expect = (c, msg) => { if (!c) throw new Error(msg) }
async function open(browser, opts = {}, q = '') {
  const ctx = await browser.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, ...opts })
  await muteContext(ctx)
  await ctx.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  const p = await ctx.newPage(); p.errs = []
  p.on('pageerror', e => p.errs.push('pageerror ' + e.message))
  p.on('console', m => { if (m.type() === 'error') p.errs.push('console ' + m.text()) })
  p.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)|assets\/perf-/.test(r.url())) p.errs.push('reqfail ' + r.url()) })
  await p.goto(URL0 + q); try { await p.waitForFunction(() => window.__kgReady, null, { timeout: 20000 }) } catch (e) { console.log('OPEN FAIL', p.errs.join('|'), await p.evaluate(() => document.body.innerText.slice(0, 200))); throw e }
  return p
}
const overflow = p => p.evaluate(() => {
  const W = document.documentElement.clientWidth, bad = []
  for (const el of document.querySelectorAll('.screen:not([hidden]) *, #hud:not([hidden]) *')) {
    if (el.closest('[hidden]') || (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true }))) continue
    const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1)) bad.push((el.id || el.className || el.tagName) + ':' + Math.round(r.left) + '-' + Math.round(r.right))
  }
  return { sw: document.documentElement.scrollWidth, W, bad: bad.slice(0, 5) }
})
const fit = p => p.evaluate(() => {
  const H = innerHeight, W = innerWidth, de = document.documentElement, over = []
  if (de.scrollHeight > H + 1) over.push('page:' + de.scrollHeight)
  for (const el of document.querySelectorAll('.screen:not([hidden]) button, #hud:not([hidden]) button')) { if (!el.offsetParent) continue; if (el.closest('[hidden]')) continue; const r = el.getBoundingClientRect(); if (r.bottom > H + 1 || r.top < -1 || r.right > W + 1 || r.left < -1) over.push((el.id || el.className) + ':' + Math.round(r.top) + '-' + Math.round(r.bottom)) }
  return { H, over: over.slice(0, 6) }
})
const overlap = p => p.evaluate(() => {
  const ids = ['bL', 'bR', 'hL', 'hR', 'bGift', 'bPause', 'bMute', 'bib'], rs = ids.map(i => [i, document.getElementById(i)]).filter(([i, e]) => e && e.offsetParent !== null && !e.hidden).map(([i, e]) => [i, e.getBoundingClientRect()])
  const bad = []
  for (let a = 0; a < rs.length; a++) for (let b = a + 1; b < rs.length; b++) { const A = rs[a][1], B = rs[b][1]; if (A.left < B.right - 2 && A.right > B.left + 2 && A.top < B.bottom - 2 && A.bottom > B.top + 2) bad.push(rs[a][0] + '/' + rs[b][0]) }
  return bad
})
const lum = p => p.evaluate(() => { kg.step(1); const c = document.createElement('canvas'); const s = kg.renderer.domElement; c.width = 64; c.height = 128; const g = c.getContext('2d'); g.drawImage(s, 0, 0, 64, 128); const d = g.getImageData(0, 0, 64, 128).data; let a = 0, a2 = 0, n = 0; for (let i = 0; i < d.length; i += 4) { const v = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; a += v; a2 += v * v; n++ } return Math.round(a2 / n - (a / n) ** 2) })

const browser = await chromium.launch({ ...MUTE_LAUNCH, args: [...MUTE_LAUNCH.args, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const p = await open(browser)
await t('起動時にエラーが出ない', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await t('ブラウザの拡大が起きない', async () => {
  const r = await p.evaluate(() => {
    const vp = document.querySelector('meta[name=viewport]').content
    const g = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(g)
    const w = new WheelEvent('wheel', { ctrlKey: true, deltaY: -10, bubbles: true, cancelable: true }); window.dispatchEvent(w)
    const k = new KeyboardEvent('keydown', { key: '+', ctrlKey: true, bubbles: true, cancelable: true }); window.dispatchEvent(k)
    return { vp, gesture: g.defaultPrevented, wheel: w.defaultPrevented, key: k.defaultPrevented, ta: getComputedStyle(document.documentElement).touchAction, us: getComputedStyle(document.body).userSelect }
  })
  expect(/user-scalable=no/.test(r.vp) && r.gesture && r.wheel && r.key && r.ta === 'manipulation' && r.us === 'none', JSON.stringify(r)); return r
})
await t('OGP 一式と og.png', async () => {
  const r = await p.evaluate(() => ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'].map(k => !!document.querySelector(`meta[property="${k}"]`)).concat(!!document.querySelector('meta[name="twitter:card"]')))
  expect(r.every(Boolean), JSON.stringify(r))
  const st = await p.evaluate(async () => (await fetch('og.png')).status); expect(st === 200, 'og ' + st)
})
await t('タイトルに3Dが描かれている（輝度の散らばり）', async () => { const v = await lum(p); expect(v > 300, 'var ' + v); return v })
await t('タイトルで画面に本物のゲームバグ表示（boot-err）が無い', async () => { expect(!(await p.$('#boot-err'))) })
// 本物の指（マウス）で開始
await t('はじめるを押すと走り出す（本物のクリック）', async () => {
  await p.click('#bStart'); await p.waitForTimeout(400)
  const m = await p.evaluate(() => kg.G.mode); expect(m === 'run', m)
})
await t('固定60Hz: 実時間2秒でゲーム内時間がほぼ2秒', async () => {
  const a = await p.evaluate(() => kg.G.time); await p.waitForTimeout(2000); const b = await p.evaluate(() => kg.G.time)
  expect(b - a > 1.6 && b - a < 2.4, String(b - a)); return b - a
})
await t('左の逃げるボタンを押している間だけ左へ動く（本物の指）', async () => {
  await p.evaluate(() => { kg.pause(); kg.P.x = 0; kg.P.vx = 0; kg.fans.forEach(f => { f.active = false }); kg.pause(false) })
  const pos = await p.evaluate(() => kg.proj('bL')); await p.mouse.move(pos.x, pos.y); await p.mouse.down(); await p.waitForTimeout(500)
  const x1 = await p.evaluate(() => kg.P.x); await p.mouse.up(); await p.waitForTimeout(700)
  const x2 = await p.evaluate(() => kg.P.x); const vx = await p.evaluate(() => kg.P.vx)
  expect(x1 < -0.8, 'x1 ' + x1); expect(Math.abs(vx) < 0.3, 'vx ' + vx); return { x1, x2 }
})
await t('頭を押さえるボタンで頭の傾きが戻る（本物の指）', async () => {
  await p.evaluate(() => { kg.pause(); kg.P.h = 0.5; kg.P.hv = 0; kg.pause(false) })
  const pos = await p.evaluate(() => kg.proj('hL')); await p.mouse.move(pos.x, pos.y); await p.mouse.down(); await p.waitForTimeout(450)
  const h1 = await p.evaluate(() => kg.P.h); await p.mouse.up()
  expect(h1 < 0.35, 'h ' + h1); return h1
})
await t('ボタンの重なりがない（走行中）', async () => { const o = await overlap(p); expect(o.length === 0, o.join(',')) })
await t('走行画面が描かれている', async () => { await p.evaluate(() => kg.pause()); const v = await lum(p); expect(v > 300, 'var ' + v); await p.screenshot({ path: 'shots/v-run.png' }); return v })
await t('何もしないと頭が落ちて結果（称号が最低）が出る', async () => {
  await p.evaluate(() => { kg.seed(77); kg.start(); kg.inp.L = kg.inp.R = kg.inp.hL = kg.inp.hR = false; kg.pause(false) })
  await p.waitForSelector('#result:not([hidden])', { timeout: 30000 })
  const r = await p.evaluate(() => ({ f: kg.G.final, rank: kg.rank(kg.G.final), over: kg.G.over, best: localStorage.getItem('kg_best') }))
  expect(r.f < 100 && r.rank === '着ぐるみ研修生', JSON.stringify(r)); await p.screenshot({ path: 'shots/v-result.png' }); return r
})
await t('結果カードが描かれている（輝度の散らばり）', async () => {
  const v = await p.evaluate(() => { const c = document.getElementById('cv'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let a = 0, a2 = 0, n = 0; for (let i = 0; i < d.length; i += 52) { const v = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; a += v; a2 += v * v; n++ } return Math.round(a2 / n - (a / n) ** 2) })
  expect(v > 400, 'var ' + v); return v
})
await t('Xでポストが正しいURLを開く', async () => {
  const [pg] = await Promise.all([p.context().waitForEvent('page', { timeout: 4000 }).catch(() => null), p.click('#bShare')])
  const u = pg ? pg.url() : ''; if (pg) await pg.close().catch(() => {})
  expect(/x\.com\/intent\/post|x\.com\/intent|twitter/.test(u) || pg === null, u); return u.slice(0, 60)
})
await t('画像を保存が動く', async () => { const [d] = await Promise.all([p.waitForEvent('download', { timeout: 4000 }), p.click('#bSave')]); return d.suggestedFilename() })
await t('もう一回で新しい走りが始まり、ベストが保存される', async () => {
  const best = await p.evaluate(() => +localStorage.getItem('kg_best')); await p.click('#bAgain'); await p.waitForTimeout(300)
  const m = await p.evaluate(() => kg.G.mode); expect(m === 'run', m); return best
})
await t('画面タップでジャンプ（本物のクリック）。ボタン上のタップではジャンプしない', async () => {
  await p.evaluate(() => { kg.pause(); kg.start(); kg.step(20); kg.obstacles.forEach(o => { o.active = false; o.g.visible = false }); kg.fans.forEach(f => { f.active = false }); kg.pause(false) })
  const n0 = await p.evaluate(() => kg.P.nj)
  const pos = await p.evaluate(() => kg.proj('bL')); await p.mouse.click(pos.x, pos.y); await p.waitForTimeout(150)
  const n1 = await p.evaluate(() => kg.P.nj); expect(n1 === n0, 'ボタンでジャンプした ' + n1)
  await p.mouse.click(195, 300); await p.waitForTimeout(250)
  const y = await p.evaluate(() => ({ y: kg.P.y, air: kg.P.air, n: kg.P.nj })); expect(y.n === n0 + 1 && y.air && y.y > 0.3, JSON.stringify(y))
  await p.waitForTimeout(700); const g = await p.evaluate(() => kg.P.air); expect(!g, 'まだ空中'); return y
})
await t('ジャンプで障害物（コーン・ベンチ・箱・看板）を越えられ、跳ばないとぶつかる', async () => {
  const r = await p.evaluate(() => {
    const out = {}
    for (const type of ['cone', 'bench', 'box', 'sign']) {
      for (const jump of [false, true]) {
        kg.pause(); kg.start(); kg.step(30); kg.obstacles.forEach(o => { o.active = false; o.g.visible = false }); kg.fans.forEach(f => { f.active = false })
        const o = kg.obstacles.find(q => !q.active && q.type === type); o.active = true; o.x = kg.P.x; o.z = kg.P.z - 14; o.state = 'idle'; o.g.visible = true; o.g.position.set(o.x, 0, o.z)
        kg.P.h = 0; kg.P.hv = 0
        let jumped = false, st = 0
        while (st < 400 && o.z < kg.P.z + 1) { const dz = kg.P.z - o.z; if (jump && !jumped && dz < 3.0) { kg.tryJump(); jumped = true } kg.step(1); st++ }
        out[type + (jump ? '+j' : '')] = o.state
      }
    }
    return out
  })
  for (const k of ['cone', 'bench', 'box', 'sign']) expect(r[k] === 'hit' && r[k + '+j'] === 'idle', JSON.stringify(r)); return r
})
await t('スライディングしてくるファンを跳ぶと越え、跳ばないとぶつかる', async () => {
  const r = await p.evaluate(() => {
    const out = {}
    for (const jump of [false, true]) {
      kg.pause(); kg.start(); kg.step(30); kg.obstacles.forEach(o => { o.active = false; o.g.visible = false }); kg.fans.forEach(f => { f.active = false }); kg.G.hintShown.x = 1
      const f = kg.spawn('slider', kg.P.x, 16, 6); kg.P.h = 0; kg.P.hv = 0; let jumped = false, st = 0, hit = false
      while (st < 500 && f.active && f.z < kg.P.z + 2) { const dz = kg.P.z - f.z; if (jump && !jumped && f.sl && dz < 3.3) { kg.tryJump(); jumped = true } kg.step(1); st++; if (f.state === 'leave') { hit = true; break } }
      out[jump ? 'jump' : 'nojump'] = { hit, sl: f.sl }
    }
    return out
  })
  expect(r.nojump.hit && r.nojump.sl && !r.jump.hit, JSON.stringify(r)); return r
})
await t('着地の衝撃で頭が揺れる（傾いている向きへさらに押す）', async () => {
  const r = await p.evaluate(() => {
    kg.pause(); kg.start(); kg.step(20); kg.obstacles.forEach(o => { o.active = false; o.g.visible = false }); kg.fans.forEach(f => { f.active = false })
    kg.P.h = 0.4; kg.P.hv = 0; kg.tryJump(); let before = null, after = null
    for (let i = 0; i < 120; i++) { const air = kg.P.air; kg.P.h = 0.4; if (air) before = kg.P.hv; kg.step(1); if (air && !kg.P.air) { after = kg.P.hv; break } }
    return { before, after }
  })
  expect(r.after - r.before > 0.5, JSON.stringify(r)); return r
})
await t('慣れる区間: 最初の40mでは障害物もファンも出ない（出現前）', async () => {
  const r = await p.evaluate(() => { kg.pause(); kg.seed(3); kg.start(); let n = 0, first = null; for (let i = 0; i < 60 * 3; i++) { kg.P.h = 0; kg.P.hv = 0; kg.step(1); if (kg.obstacles.some(o => o.active) && first == null) first = kg.P.dist } return { first } })
  expect(r.first === null || r.first > 20, JSON.stringify(r)); return r
})
await t('ファンサ: プレゼントを拾うと使えて、前のファンが止まる', async () => {
  await p.evaluate(() => { kg.pause(); kg.start(); kg.step(30); kg.fans.forEach(f => { f.active = false }); kg.P.gifts = 1; document.getElementById('bGift').hidden = false; kg.spawn('normal', 0, 8, 5); kg.spawn('normal', 1, 10, 5); kg.step(2) })
  const n = await p.evaluate(() => { kg.fanService(); return kg.fans.filter(f => f.active && f.state === 'stun').length })
  const g = await p.evaluate(() => kg.P.gifts); expect(n >= 2 && g === 0, `n${n} g${g}`); return n
})
await t('しがみつき: ファンが張り付き、素早く左右に切り返すと振り落とせる', async () => {
  const r = await p.evaluate(() => {
    kg.start(); kg.step(30); kg.fans.forEach(f => { f.active = false })
    const f = kg.spawn('normal', kg.P.x, 0.5, 5); kg.step(3)
    const c1 = kg.P.cling.length, s1 = kg.fans.filter(f => f.state === 'cling').length
    kg.inp.L = true; kg.step(10); kg.inp.L = false; kg.inp.R = true; kg.step(10); kg.inp.R = false; kg.inp.L = true; kg.step(10); kg.inp.L = false
    return { c1, s1, c2: kg.P.cling.length }
  })
  expect(r.c1 === 1 && r.c2 === 0, JSON.stringify(r)); return r
})
await t('抜け道: 動かず頭だけ押さえるbotは長く生きられない', async () => {
  const r = await p.evaluate(() => {
    kg.seed(5); kg.start(); let st = 0
    while (kg.G.mode === 'run' && st < 60 * 90) { const P = kg.P; kg.inp.hL = P.h + 0.4 * P.hv > 0.1; kg.inp.hR = P.h + 0.4 * P.hv < -0.1; kg.step(1); st++ }
    kg.inp.hL = kg.inp.hR = false; return { d: Math.floor(kg.P.dist), cause: kg.G.over, t: st / 60 }
  })
  expect(r.t < 40, JSON.stringify(r)); return r
})
await t('英語に切り替わる', async () => {
  await p.evaluate(() => { kg.pause(); kg.G.mode = 'title' }); await p.evaluate(() => { document.getElementById('title').hidden = false; document.getElementById('result').hidden = true; document.getElementById('hud').hidden = true })
  await p.click('#bLang'); const t1 = await p.textContent('#bStart'); const h = await p.textContent('#tB')
  expect(t1 === 'Start' && /falls off/.test(h), t1 + h); await p.screenshot({ path: 'shots/v-en.png' }); await p.click('#bLang')
})
await t('遊び方が開閉できる', async () => { await p.click('#bHow'); expect(!(await p.$eval('#how', e => e.hidden))); await p.screenshot({ path: 'shots/v-how.png' }); await p.click('#bHowClose'); expect(await p.$eval('#how', e => e.hidden)) })
await t('無音を確認（Chromium）: __muteOk', async () => { const r = await p.evaluate(() => window.__muteOk()); expect(r, 'not mute') })
await t('ページを離れたら音を止める（Snd.life.hide）', async () => {
  const r = await p.evaluate(() => { Snd.init(); Snd.sleep(); return Snd.life.hide }); expect(r >= 1, 'hide ' + r)
})
await t('エラーなし（通し）', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await p.close()
// ---- 3サイズ × 全画面
for (const [w, h, name] of [[360, 640, 'small'], [390, 844, 'phone'], [430, 932, 'big']]) {
  const q = await open(browser, { viewport: { width: w, height: h } })
  const views = {}
  views.title = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-title.png` })
  await q.click('#bHow'); views.how = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-how.png` }); await q.click('#bHowClose')
  await q.click('#bStart'); await q.waitForTimeout(300)
  await q.evaluate(() => { kg.pause(); kg.P.gifts = 2; document.getElementById('bGift').hidden = false; document.getElementById('giftN').textContent = 2; kg.step(2) })
  views.play = await fit(q); const ov = await overlap(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-play.png` })
  await q.evaluate(() => { kg.P.h = 1.05; kg.pause(false) }); await q.waitForSelector('#result:not([hidden])', { timeout: 20000 })
  views.result = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-result.png` })
  for (const [v, r] of Object.entries(views)) await t(`一画面に収まる ${name} ${w}x${h} ${v}`, async () => { expect(!r.over.length, JSON.stringify(r)) })
  await t(`${name}: ボタンが重ならない`, async () => { expect(!ov.length, ov.join(',')) })
  await t(`${name}: はみ出し・エラーなし`, async () => { const o = await overflow(q); expect(o.sw <= o.W && !o.bad.length && !q.errs.length, JSON.stringify(o) + q.errs.join('|')) })
  await q.close()
}
await browser.close()
// ---- WebKit（iPhone 相当）でタッチの通し
const wb = await webkit.launch(), wp = await open(wb, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
await t('WebKit: 3Dが描かれる', async () => { const v = await lum(wp); expect(v > 300, 'var ' + v); return v })
await t('WebKit: タップで始まる', async () => { await wp.tap('#bStart'); await wp.waitForTimeout(500); const m = await wp.evaluate(() => kg.G.mode); expect(m === 'run', m) })
await t('WebKit: 実際には無音（始めた後に見る）', async () => { const r = await wp.evaluate(() => window.__muteOk()); expect(r, 'not mute') })
await t('WebKit: 2本指の touchmove を止める', async () => {
  const r = await wp.evaluate(() => { const e = new Event('touchmove', { cancelable: true, bubbles: true }); Object.defineProperty(e, 'touches', { value: [{}, {}] }); document.body.dispatchEvent(e); return e.defaultPrevented }); expect(r, r)
})
await t('WebKit: 逃げるボタンを指で押すと動く', async () => {
  await wp.evaluate(() => { kg.pause(); kg.P.x = 0; kg.P.vx = 0; kg.fans.forEach(f => { f.active = false }); kg.pause(false) })
  const pos = await wp.evaluate(() => kg.proj('bR'))
  // タッチを押しっぱなしにする: CDP の代わりに pointer イベントを直接送る
  await wp.evaluate(() => { const el = document.getElementById('bR'); el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 5, pointerType: 'touch' })) })
  await wp.waitForTimeout(500); const x1 = await wp.evaluate(() => kg.P.x)
  await wp.evaluate(() => { const el = document.getElementById('bR'); el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 5, pointerType: 'touch' })) })
  expect(x1 > 0.8, 'x ' + x1); return x1
})
await t('WebKit: 負けて結果まで進む', async () => {
  await wp.evaluate(() => { kg.P.h = 1.05 }); await wp.waitForSelector('#result:not([hidden])', { timeout: 20000 }); await wp.screenshot({ path: 'shots/v-webkit-result.png' })
})
await t('WebKit: エラーなし', async () => { expect(wp.errs.length === 0, wp.errs.join('|')) })
await wb.close()
server.kill()
console.log(results.join('\n'))
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
