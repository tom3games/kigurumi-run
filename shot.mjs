import './mute-auto.mjs'
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
const PORT = 47333
const server = spawn(process.execPath, ['server.mjs'], { cwd: import.meta.dirname, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 500))
const b = await chromium.launch({ ...MUTE_LAUNCH, args: [...MUTE_LAUNCH.args, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ja-JP' }); await muteContext(ctx)
const p = await ctx.newPage(); const errs = []
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://localhost:${PORT}/?t=${Date.now()}`)
await p.waitForFunction(() => window.__kgReady, null, { timeout: 20000 })
await p.screenshot({ path: 'shots/s1-title.png' })
await p.evaluate(() => { kg.pause(); kg.start(); kg.step(5) })
await p.screenshot({ path: 'shots/s2-run0.png' })
await p.evaluate(() => { kg.step(120) })
await p.screenshot({ path: 'shots/s3-run2s.png' })
console.log(errs.join('\n') || 'no errors')
await b.close(); server.kill()
