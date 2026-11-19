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
const out = await p.evaluate(async ({ N }) => {
  const res = {}
  const bots = {
    idle: { react: 0, steer: false, head: false },
    runOnly: { react: 0.3, steer: true, head: false },
    headOnly: { react: 0.3, steer: false, head: true },
    human: { react: 0.35, steer: true, head: true, err: 0.12, dead: 0.14, gift: true },
    slowHuman: { react: 0.55, steer: true, head: true, err: 0.2, dead: 0.2, gift: false },
    expert: { react: 0.12, steer: true, head: true, err: 0.02, dead: 0.08, gift: true },
  }
  for (const [name, cfg] of Object.entries(bots)) {
    const rows = []
    for (let g = 0; g < N; g++) {
      kg.pause(); kg.seed(1000 + g * 37); kg.start()
      const hist = []
      let steps = 0, gifts = 0
      while (kg.G.mode === 'run' && steps < 60 * 150) {
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
        kg.G.paused = false
        // 1コマ
        kg.step(1); steps++
      }
      const t = steps / 60
      rows.push({ d: Math.floor(kg.P.dist), cause: kg.G.over || 'alive', t: Math.round(t) })
      kg.inp.L = kg.inp.R = kg.inp.hL = kg.inp.hR = false
    }
    res[name] = rows
  }
  return res
}, { N })
for (const [k, rows] of Object.entries(out)) {
  const d = rows.map(r => r.d).sort((a, b) => a - b), med = d[Math.floor(d.length / 2)]
  const fell = rows.filter(r => r.cause === 'fell').length, caught = rows.filter(r => r.cause === 'caught').length
  console.log(k.padEnd(10), 'median', med, 'min', d[0], 'max', d[d.length - 1], 'fell', fell, 'caught', caught, 'alive', rows.length - fell - caught, ' t(median)', rows.map(r => r.t).sort((a, b) => a - b)[Math.floor(rows.length / 2)])
}
console.log(errs.join('\n') || 'no errors')
await b.close(); server.kill()
