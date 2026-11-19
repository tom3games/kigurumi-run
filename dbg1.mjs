import './mute-auto.mjs'
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
const PORT = 47335
const server = spawn(process.execPath, ['server.mjs'], { cwd: import.meta.dirname, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 500))
const b = await chromium.launch({ ...MUTE_LAUNCH, args: [...MUTE_LAUNCH.args, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
p.on('console', m => console.log(m.text().slice(0, 400)))
await p.goto(`http://localhost:${PORT}/?t=${Date.now()}`)
await p.waitForFunction(() => window.__kgReady)
console.log(await p.evaluate(() => {
  const perf = kg.perf, out = {}
  perf.root.updateMatrixWorld(true)
  const V = kg.THREE.Vector3
  for (const n of ['Hips', 'Abdomen', 'Torso', 'Head', 'FootL', 'PTL', 'Middle1L', 'UpperLegL', 'Neck']) { const b = perf.bones[n]; if (!b) { out[n] = 'none'; continue } const v = new V(); b.getWorldPosition(v); const s = new V(); b.getWorldScale(s); out[n] = [v.x, v.y, v.z, s.x].map(x => +x.toFixed(3)) }
  out.sc = perf.sc; out.H0 = perf.H0
  const meshes = []; perf.model.traverse(n => { if (n.isMesh) meshes.push(n.name + ':' + n.parent.name + ':' + n.visible) })
  out.meshes = meshes
  return JSON.stringify(out)
}))
await b.close(); server.kill()
