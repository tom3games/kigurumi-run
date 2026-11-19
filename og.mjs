import './mute-auto.mjs'
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
const PORT = 47334
const server = spawn(process.execPath, ['server.mjs'], { cwd: import.meta.dirname, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 500))
const b = await chromium.launch({ ...MUTE_LAUNCH, args: [...MUTE_LAUNCH.args, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx = await b.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, locale: 'ja-JP' }); await muteContext(ctx)
const p = await ctx.newPage()
await p.goto(`http://localhost:${PORT}/?t=${Date.now()}`)
await p.waitForFunction(() => window.__kgReady, null, { timeout: 20000 })
await p.evaluate(() => {
  kg.pause(); kg.seed(+(new URLSearchParams(location.search).get('s') || 11)); kg.start(); kg.step(100)
  kg.P.h = 0.9; kg.P.hv = 2; kg.step(60)
  document.getElementById('title').hidden = true
})
// 頭が飛んだ直後〜輪ができた頃まで
await p.evaluate(() => { for (let i = 0; i < 150; i++) kg.step(1) })
await p.evaluate(() => {
  const g = kg; g.camera.setViewOffset(1200, 630, -300, 0, 1200, 630)
  g.camera.zoom = 1.12; g.camera.updateProjectionMatrix(); g.camera.setViewOffset(1200, 630, -250, -40, 1200, 630); g.costume.rotation.set(0.15, Math.PI - 0.35, 0.25); g.costume.position.x += 0.5
  document.getElementById('bubble').style.display = 'none'
  g.scene.traverse(o => { if ((o.isGroup && o.parent === g.scene && o !== g.costume) || (o.isMesh && o.geometry.type === 'CircleGeometry')) { const dx = o.position.x - g.camera.position.x, dz = o.position.z - g.camera.position.z; if (Math.hypot(dx, dz) < 5.6) o.visible = false } })
  document.querySelectorAll('#hud,#vig,#flash').forEach(e => e.style.display = 'none')
  const d = document.createElement('div')
  d.style.cssText = "position:fixed;left:30px;top:26px;width:540px;background:#fffaf0;border:6px solid #22304a;transform:rotate(-2.5deg);font-family:'Yusei Magic','Hiragino Maru Gothic ProN',sans-serif;z-index:50;box-shadow:0 8px 0 rgba(0,0,0,.2)"
  d.innerHTML = "<div style='background:#d93a2b;color:#fff;font-size:26px;padding:6px 22px;letter-spacing:.15em'>ゆるキャラ 脱出劇</div><div style='padding:14px 24px 6px;font-size:46px;line-height:1.12;color:#22304a'>着ぐるみ、<br><span style='color:#d93a2b;font-size:55px;white-space:nowrap'>頭が取れたら終わり</span></div><div style='padding:0 24px 16px;font-size:25px;color:#22304a'>ゆるキャラの中の人は、今日も逃げる</div>"
  document.body.appendChild(d)
  kg.step(1)
})
await p.waitForTimeout(150)
await p.screenshot({ path: 'og.png' })
console.log('ok')
await b.close(); server.kill()
