import './mute-auto.mjs'
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
const PORT = 47332
const server = spawn(process.execPath, ['server.mjs'], { cwd: import.meta.dirname, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 500))
const b = await chromium.launch({ ...MUTE_LAUNCH, args: [...MUTE_LAUNCH.args, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'ja-JP' }); await muteContext(ctx)
const p = await ctx.newPage(); const errs = []
p.on('pageerror', e => errs.push(e.message))
await p.goto(`http://localhost:${PORT}/?t=${Date.now()}`)
await p.waitForFunction(() => window.__kgReady, null, { timeout: 20000 })
const N = +process.env.N || 10
const ONLY = process.env.ONLY || ''
const out = await p.evaluate(async ({ N, ONLY }) => {
  const res = {}
  const bots = {
    idle: { react: 0, steer: false, head: false },
    noJump: { react: 0.35, steer: true, head: true, err: 0.12, dead: 0.14, gift: true, jump: false },
    headOnly: { react: 0.3, steer: false, head: true, jump: true },
    human: { react: 0.35, steer: true, head: true, err: 0.12, dead: 0.14, gift: true, jump: true, jerr: 0.6 },
    slowHuman: { react: 0.42, steer: true, head: true, err: 0.3, dead: 0.22, gift: false, jump: true, jerr: 0.9 },
    expert: { react: 0.12, steer: true, head: true, err: 0.02, dead: 0.08, gift: true, jump: true, jerr: 0.25 },
  }
  for (const [name, cfg] of Object.entries(bots)) {
    if (ONLY && name !== ONLY) continue
    const rows = []
    for (let g = 0; g < N; g++) {
      kg.pause(); kg.seed(1000 + g * 37); kg.start()
      const hist = []
      let steps = 0, gifts = 0
      while (kg.G.mode === 'run' && steps < 60 * 120) {
        const P = kg.P
        hist.push({ h: P.h, hv: P.hv, x: P.x }); if (hist.length > 60) hist.shift()
        const dl = Math.min(hist.length - 1, Math.round(cfg.react * 60)), o = hist[hist.length - 1 - dl]
        // 頭
        kg.inp.hL = kg.inp.hR = false
        if (cfg.head) {
          const pred = o.h + 0.4 * o.hv, dz = cfg.dead ?? 0.1
          if (Math.random() > (cfg.err || 0)) { if (pred > dz) kg.inp.hL = true; else if (pred < -dz) kg.inp.hR = true }
        }
        // 逃げる
        kg.inp.L = kg.inp.R = false
        if (cfg.steer && steps % 6 === 0) {
          let best = null, bd = 1e9
          for (const f of kg.fans) if (f.active && f.state === 'run') { const dz = P.z - f.z; if (dz > 0 && dz < 16 && Math.abs(f.x - P.x) < 1.9 + (f.type === 'grabber' ? 0.4 : 0)) { if (dz < bd) { bd = dz; best = f } } }
          kg._dir = 0
          if (best) kg._dir = best.x < P.x ? 1 : (best.x > P.x ? -1 : (P.x > 0 ? -1 : 1))
          else if (Math.abs(P.x) > 3.2) kg._dir = P.x > 0 ? -1 : 1
        }
        if (cfg.steer) { if (kg._dir < 0) kg.inp.L = true; if (kg._dir > 0) kg.inp.R = true }
        if (cfg.gift && P.gifts > 0 && (kg.HORDE.g < 3 || kg.fans.filter(f => f.active && f.state === 'run' && P.z - f.z > 0 && P.z - f.z < 7).length >= 2)) kg.fanService()
        if (cfg.jump && !P.air) {
          for (const o of kg.obstacles) { if (!o.active || o.state !== 'idle') continue; const dz = P.z - o.z; if (dz > 0 && dz < 5.5 && Math.abs(o.x - P.x) < 0.95 + 0.4) { if (o._thr == null) o._thr = 3.2 + (Math.random() - .5) * 2 * (cfg.jerr || 0.5) + cfg.react * 1.5 - 0.6; if (dz < o._thr) { kg.tryJump(); o._thr = -9 } } }
          for (const f of kg.fans) { if (!f.active || !f.sl || f.state !== 'run') continue; const dz = P.z - f.z; if (dz > 0 && dz < 6 && Math.abs(f.x - P.x) < 1.1) { if (f._thr == null) f._thr = 3.4 + (Math.random() - .5) * 2 * (cfg.jerr || 0.5) + cfg.react * 1.5 - 0.6; if (dz < f._thr) { kg.tryJump(); f._thr = -9 } } }
        }
        kg.G.paused = false
        // 1コマ
        kg.step(1); steps++
      }
      const t = steps / 60
      rows.push({ d: Math.floor(kg.P.dist), cause: kg.G.over || 'alive', t: Math.round(t), log: JSON.stringify(kg.LOG.slice(-8)) })
      kg.inp.L = kg.inp.R = kg.inp.hL = kg.inp.hR = false
    }
    res[name] = rows
  }
  return res
}, { N, ONLY })
for (const [k, rows] of Object.entries(out)) {
  const d = rows.map(r => r.d).sort((a, b) => a - b), med = d[Math.floor(d.length / 2)]
  const fell = rows.filter(r => r.cause === 'fell').length, caught = rows.filter(r => r.cause === 'caught').length
  console.log(k.padEnd(10), 'median', med, 'min', d[0], 'max', d[d.length - 1], 'fell', fell, 'caught', caught, 'alive', rows.length - fell - caught, ' t(median)', rows.map(r => r.t).sort((a, b) => a - b)[Math.floor(rows.length / 2)])
}
for (const r of (out[ONLY || 'human'] || [])) if (r.log) console.log('LOG', r.d, r.t, r.log)
console.log(errs.join('\n') || 'no errors')
await b.close(); server.kill()
