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
await p.evaluate(() => { kg.pause(); kg.seed(5); kg.start(); kg.step(90); kg.P.h = 0.6; kg.P.hv = 0; kg.step(1); kg.spawn('normal', 0, 9, 5); kg.spawn('grabber', 2, 12, 6); kg.spawn('kid', -2, 15); kg.spawn('granny', 1, 18); kg.step(20) })
await sh('a1-lean')
await p.evaluate(() => { kg.step(40) })
await sh('a2')
await p.evaluate(() => { kg.P.h = 1.05; kg.step(1) })
for (const [i, n] of [[10, 'b1'], [20, 'b2'], [30, 'b3'], [40, 'b4'], [60, 'b5'], [80, 'b6'], [100,'b7'], [120,'b8']]) { await p.evaluate(k => kg.step(k), i === 10 ? 10 : 30); await sh(n) }
console.log(await p.evaluate(()=>JSON.stringify({c:kg.costume.position,p:[kg.P.x,kg.P.z],cam:kg.camera.position,par:kg.costume.parent===kg.scene}))); console.log(errs.join('\n') || 'no errors')
await b.close(); server.kill()
