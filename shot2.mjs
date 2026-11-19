import './mute-auto.mjs'
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
const PORT = 47333
const server = spawn(process.execPath, ['server.mjs'], { cwd: import.meta.dirname, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 500))
const b = await chromium.launch({ ...MUTE_LAUNCH, args: [...MUTE_LAUNCH.args, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5, locale: 'ja-JP' }); await muteContext(ctx)
const p = await ctx.newPage(); const errs = []
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://localhost:${PORT}/?t=${Date.now()}`)
await p.waitForFunction(() => window.__kgReady, null, { timeout: 20000 })
const sh = n => p.screenshot({ path: `shots/${n}.png` })
await p.evaluate(() => { kg.pause(); kg.seed(5); kg.start(); kg.step(60); kg.P.dist = 80; kg.G.z0 = kg.P.z + 80; kg.step(60) })
await sh('c1-run')
await p.evaluate(() => { kg.obstacles.forEach(o => { o.active = false; o.g.visible = false }); const P = kg.P; for (const [t, dx, dz] of [['cone', -1.2, 7], ['bench', 1.0, 11], ['box', -0.8, 15], ['sign', 1.5, 19]]) { const o = kg.obstacles.find(q => !q.active && q.type === t); o.active = true; o.x = P.x + dx; o.z = P.z - dz; o.state = 'idle'; o.g.visible = true; o.g.position.set(o.x, 0, o.z) } ; kg.spawn('slider', 0, 12, 6); kg.step(2) })
await sh('c2-obst')
await p.evaluate(() => { kg.tryJump(); kg.step(14) })
await sh('c3-jump')
await p.evaluate(() => { kg.step(40) })
await sh('c4-after')
await p.evaluate(() => { kg.P.h = 0.6; kg.step(1) })
await sh('a1-lean')
await p.evaluate(() => { kg.P.h = 1.05; kg.step(1) })
for (const [i, n] of [[10, 'b1'], [30, 'b2'], [60, 'b3'], [90, 'b4'], [120, 'b5'], [150, 'b6'], [180, 'b7'], [210,'b8']]) { await p.evaluate(k => kg.step(k), i === 10 ? 10 : 30); await sh(n) }
console.log(await p.evaluate(()=>JSON.stringify({c:kg.costume.position,p:[kg.P.x,kg.P.z],cam:kg.camera.position,par:kg.costume.parent===kg.scene}))); console.log(errs.join('\n') || 'no errors')
await b.close(); server.kill()
