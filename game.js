import * as THREE from 'three'
import { GLTFLoader } from './vendor/jsm/loaders/GLTFLoader.js'
import * as SkeletonUtils from './vendor/jsm/utils/SkeletonUtils.js'
import { setupLook } from './look.js'
window.__jsUp = true

// ============================================================ 定数
const V = new URL(import.meta.url).search
const STEP = 1 / 60
const ROAD = 5.2            // 走れる幅の半分
const SEG = 12, NSEG = 9
const MODELS = ['male-a', 'male-b', 'male-c', 'male-d', 'male-e', 'male-f', 'female-a', 'female-b', 'female-c', 'female-d', 'female-e', 'female-f']
const MALE = new Set(['male-a', 'male-b', 'male-c', 'male-d', 'male-e', 'male-f'])
const $ = id => document.getElementById(id)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const lerp = (a, b, t) => a + (b - a) * t
const smooth = t => t * t * (3 - 2 * t)
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
let rnd = mulberry((Math.random() * 1e9) | 0)
const qs = new URLSearchParams(location.search)

let lang = (() => { try { const s = localStorage.getItem('kg_lang'); if (s) return s } catch (e) {} return /^ja/i.test(navigator.language || 'ja') ? 'ja' : 'en' })()
if (qs.get('lang')) lang = qs.get('lang')
const T = () => window.KG_T[lang]

// ============================================================ 描画の土台
const view = $('view')
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2))
view.appendChild(renderer.domElement)
const scene = new THREE.Scene()
const SKY = 0xbfe3f3
scene.fog = new THREE.Fog(0xcfe9f4, 34, 92)
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 140)
const lights = setupLook(renderer, scene, { exposure: 1.05, hemi: 0.95, sun: 2.0, sky: 0xffffff, ground: 0x9a8f86, sunPos: [-4, 9, 6], fill: 0.35 })

function resize() {
  const w = innerWidth, h = innerHeight
  renderer.setSize(w, h, false); camera.aspect = w / h
  camera.fov = h / w > 1.6 ? 54 : 50
  camera.updateProjectionMatrix()
}
addEventListener('resize', resize); resize()

// ---- 空
{
  const c = document.createElement('canvas'); c.width = 4; c.height = 256
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256)
  gr.addColorStop(0, '#8fcdea'); gr.addColorStop(0.55, '#cfe9f4'); gr.addColorStop(1, '#f6efe2')
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  scene.background = t
}

// ============================================================ テクスチャ
function canvasTex(w, h, draw, o = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const g = c.getContext('2d'); draw(g, w, h)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...o.repeat) }
  return t
}
const FONT = "'Yusei Magic','Hiragino Maru Gothic ProN','Hiragino Kaku Gothic ProN',sans-serif"

function paverTex() {
  const r = mulberry(7)
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#d9c6a8'; g.fillRect(0, 0, w, h)
    const cols = ['#d8c3a3', '#cdb694', '#e0cfb2', '#c9ae8c', '#d4bd9a']
    const bw = 64, bh = 32
    for (let y = 0; y < h / bh; y++) for (let x = -1; x < w / bw; x++) {
      g.fillStyle = cols[Math.floor(r() * cols.length)]
      const ox = (y % 2) * bw / 2
      g.fillRect(x * bw + ox + 1.5, y * bh + 1.5, bw - 3, bh - 3)
    }
    g.fillStyle = 'rgba(160,60,40,.55)'   // 赤いタイルの帯
    g.fillRect(0, h * 0.5 - 8, w, 16)
  }, { repeat: [1, 1] })
}
const SHOPS = [
  ['八百屋', '#e8d2a3', '#3f8f4a'], ['ふとん', '#f1d6dc', '#d9697f'], ['ラーメン', '#f0e0c0', '#c4412c'], ['写真館', '#d8e3ec', '#3d6e9c'],
  ['お茶', '#dfe8cf', '#5a8a3c'], ['とうふ', '#f4eee2', '#7a6a58'], ['本', '#e9dcc8', '#4b5d8a'], ['パン', '#f6e2bb', '#c9873a'],
  ['花', '#f2dce6', '#a85f86'], ['酒', '#d9d2c4', '#8a3a30'],
]
function facadeTex(i) {
  const [name, wall, awn] = SHOPS[i % SHOPS.length]
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = wall; g.fillRect(0, 0, w, h)
    g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(24, 14, 80, 60); g.fillRect(152, 14, 80, 60)   // 2階の窓
    g.strokeStyle = '#6d6258'; g.lineWidth = 4; g.strokeRect(24, 14, 80, 60); g.strokeRect(152, 14, 80, 60)
    g.fillStyle = '#3a4650'; g.fillRect(14, 150, 228, 100)    // 店先のガラス
    g.fillStyle = 'rgba(255,230,160,.9)'; g.fillRect(24, 160, 90, 80); g.fillRect(142, 160, 90, 80)
    g.fillStyle = 'rgba(0,0,0,.18)'; for (let k = 0; k < 6; k++) g.fillRect(30 + k * 14, 200, 8, 38)
    // ひさし（縞）
    for (let k = 0; k < 10; k++) { g.fillStyle = k % 2 ? '#fff' : awn; g.fillRect(8 + k * 24, 118, 24, 34) }
    g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(8, 148, 240, 4)
    // 看板
    g.fillStyle = '#fffaf0'; g.fillRect(70, 84, 116, 32); g.strokeStyle = '#22304a'; g.lineWidth = 3; g.strokeRect(70, 84, 116, 32)
    g.fillStyle = '#22304a'; g.font = `24px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, 128, 101)
  })
}
const wallTex = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#e9dcc8'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.05)'; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * w, Math.random() * h, 3, 3) })

function bannerTex() {
  return canvasTex(512, 96, (g, w, h) => {
    g.fillStyle = '#fffaf0'; g.fillRect(0, 0, w, h)
    g.fillStyle = '#d93a2b'; g.fillRect(0, 0, w, 12); g.fillRect(0, h - 12, w, 12)
    g.fillStyle = '#22304a'; g.font = `54px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'
    g.fillText('ゆるキャラまつり', w / 2, h / 2 + 2)
  })
}
function uchiwaTex(k) {
  const cols = ['#ff6b97', '#ffd23f', '#5cc8ff', '#ff8a3d']
  const words = ['もち', 'LOVE', 'ちゃん', 'こっち']
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = cols[k % 4]; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill()
    g.lineWidth = 6; g.strokeStyle = '#22304a'; g.stroke()
    g.fillStyle = '#fff'; g.font = `44px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(words[k % 4], 64, 70)
  })
}
function heartTex() {
  return canvasTex(64, 64, (g) => {
    g.fillStyle = '#ff6b97'; g.strokeStyle = '#fff'; g.lineWidth = 5
    g.beginPath(); g.moveTo(32, 56); g.bezierCurveTo(2, 36, 6, 8, 24, 10); g.bezierCurveTo(30, 11, 32, 16, 32, 18); g.bezierCurveTo(32, 16, 34, 11, 40, 10); g.bezierCurveTo(58, 8, 62, 36, 32, 56); g.closePath(); g.stroke(); g.fill()
  })
}
function puffTex() {
  return canvasTex(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(.6, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64)
  })
}
function starTex() {
  return canvasTex(64, 64, (g) => {
    g.fillStyle = '#ffd23f'; g.strokeStyle = '#22304a'; g.lineWidth = 4; g.beginPath()
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 11 : 26; g.lineTo(32 + Math.cos(a) * r, 34 + Math.sin(a) * r) }
    g.closePath(); g.fill(); g.stroke()
  })
}
function sweatTex() {
  return canvasTex(32, 48, (g) => { g.fillStyle = '#7ec8f2'; g.strokeStyle = '#22304a'; g.lineWidth = 3; g.beginPath(); g.moveTo(16, 4); g.bezierCurveTo(30, 24, 28, 44, 16, 44); g.bezierCurveTo(4, 44, 2, 24, 16, 4); g.fill(); g.stroke() })
}
function faceTex() {
  return canvasTex(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h)
    g.fillStyle = '#22304a'
    g.beginPath(); g.ellipse(168, 250, 36, 56, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(344, 250, 36, 56, 0, 0, 7); g.fill()
    g.fillStyle = '#fff'; g.beginPath(); g.arc(180, 228, 13, 0, 7); g.fill(); g.beginPath(); g.arc(356, 228, 13, 0, 7); g.fill()
    g.beginPath(); g.arc(160, 272, 6, 0, 7); g.fill(); g.beginPath(); g.arc(336, 272, 6, 0, 7); g.fill()
    g.fillStyle = 'rgba(244,163,180,.9)'; g.beginPath(); g.ellipse(100, 328, 40, 24, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(412, 328, 40, 24, 0, 0, 7); g.fill()
    g.strokeStyle = '#22304a'; g.lineWidth = 11; g.lineCap = 'round'; g.beginPath(); g.moveTo(222, 322); g.quadraticCurveTo(256, 362, 290, 322); g.stroke()
  })
}

// ============================================================ 街（商店街）
const world = new THREE.Group(); scene.add(world)
const roadTex = paverTex(); roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping; roadTex.repeat.set(3, 3)
const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.95 })
const sideMats = [], facadeMats = []
for (let i = 0; i < SHOPS.length; i++) facadeMats.push(new THREE.MeshStandardMaterial({ map: facadeTex(i), roughness: 0.9 }))
const plainMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 1 })
const roofMat = new THREE.MeshStandardMaterial({ color: 0x7b6a5e, roughness: 1 })
const bannerMat = new THREE.MeshBasicMaterial({ map: bannerTex(), side: THREE.DoubleSide })
const lanternMat = new THREE.MeshStandardMaterial({ color: 0xd93a2b, emissive: 0x7a1a10, roughness: 0.6 })
const poleMat = new THREE.MeshStandardMaterial({ color: 0x4a4f58, roughness: 0.7 })
const flagCols = [0xd93a2b, 0xffd23f, 0x5cc8ff, 0xffffff, 0x6bbf59, 0xff8aa6].map(c => new THREE.Color(c))
const segs = []
function bunting(len) {
  const pos = [], col = [], n = 13
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 0.7) / n, y = u => 8.4 - Math.sin(u * Math.PI) * 0.9
    const x0 = lerp(-5.8, 5.8, t0), x1 = lerp(-5.8, 5.8, t1), xm = (x0 + x1) / 2
    pos.push(x0, y(t0), 0, x1, y(t1), 0, xm, y((t0 + t1) / 2) - 0.7, 0)
    const c = flagCols[i % flagCols.length]; for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b)
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }))
}
const buntGeoMesh = bunting()
function makeSeg(i) {
  const g = new THREE.Group()
  const road = new THREE.Mesh(new THREE.PlaneGeometry(12.4, SEG), roadMat); road.rotation.x = -Math.PI / 2; g.add(road)
  const b = {}
  for (const s of [-1, 1]) {
    const bld = new THREE.Mesh(new THREE.BoxGeometry(5, 7, SEG - 0.4), [plainMat, plainMat, roofMat, plainMat, plainMat, plainMat])
    bld.position.set(s * 8.9, 3.5, 0); g.add(bld); b[s] = bld
  }
  for (const s of [-1, 1]) {   // 街灯＋ちょうちん
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 3.6, 6), poleMat); pole.position.set(s * 6.05, 1.8, -SEG / 4); g.add(pole)
    const lan = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), lanternMat); lan.scale.y = 1.25; lan.position.set(s * 6.05, 3.7, -SEG / 4); g.add(lan)
  }
  const bu = buntGeoMesh.clone(); bu.position.z = SEG / 2 - 1; g.add(bu)
  const ban = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.7), bannerMat); ban.position.set(0, 9.2, -SEG / 2 + 0.5); g.add(ban); g.userData.ban = ban
  g.userData.b = b; world.add(g); segs.push(g)
  return g
}
function dressSeg(g, k) {
  const b = g.userData.b
  for (const s of [-1, 1]) {
    const m = facadeMats[Math.floor(rnd() * facadeMats.length)]
    const bld = b[s], h = 9.5 + rnd() * 3
    bld.scale.y = h / 7; bld.position.y = h / 2
    bld.material = [s < 0 ? m : plainMat, s < 0 ? plainMat : m, roofMat, plainMat, plainMat, plainMat]
  }
  g.userData.ban.visible = (k % 3) === 0
}
for (let i = 0; i < NSEG; i++) makeSeg(i)
let segBase = 0
function layoutSegs(zc, force) {
  // zc より後ろ（+z）に出た区画を前（-z）へ回す
  const idx = Math.floor((zc + SEG * 2) / SEG)
  if (!force && idx === segBase) return
  segBase = idx
  for (let i = 0; i < NSEG; i++) {
    const k = idx - i
    const g = segs[((k % NSEG) + NSEG) % NSEG]
    const z = k * SEG - SEG / 2 + 0
    if (g.userData.k !== k || force) { g.userData.k = k; g.position.z = z; dressSeg(g, k) }
  }
}

// ============================================================ 画像資産の読み込み
const loader = new GLTFLoader()
const models = {}
let loadedN = 0, totalN = MODELS.length + 1
function bump() { loadedN++; $('ldFill').style.width = Math.round(loadedN / totalN * 100) + '%' }
const loadAll = Promise.all([
  ...MODELS.map(n => loader.loadAsync(`assets/character-${n}.glb${V}`).then(g => { models[n] = g; bump() })),
  loader.loadAsync(`assets/aid-cane.glb${V}`).then(g => { models.cane = g; bump() }),
])

// ============================================================ リグ（人物）
const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpM = new THREE.Matrix4()
const blobGeo = new THREE.CircleGeometry(1, 20); blobGeo.rotateX(-Math.PI / 2)
const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false })
const uchiwaTexs = [0, 1, 2, 3].map(uchiwaTex)
const uchiwaGeo = new THREE.CircleGeometry(0.3, 20)
const stickGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.7, 5)
const stickMat = new THREE.MeshStandardMaterial({ color: 0xd8b585 })
const bandMat = new THREE.MeshStandardMaterial({ color: 0xd93a2b, roughness: 0.8 })
const bandGeo = new THREE.TorusGeometry(0.2, 0.05, 6, 14)

function makeRig(name, o = {}) {
  const src = models[name]
  const model = SkeletonUtils.clone(src.scene)
  const root = new THREE.Group(); root.add(model)
  const box = new THREE.Box3().setFromObject(model); const H0 = Math.max(0.01, box.max.y - box.min.y)
  const sc = (o.height || 1.75) / H0
  model.scale.setScalar(sc)
  const mixer = new THREE.AnimationMixer(model)
  const acts = {}
  for (const c of src.animations) acts[c.name] = mixer.clipAction(c)
  const bones = {}
  model.traverse(n => { if (n.isBone || n.name) bones[n.name] = n; if (n.isMesh) { n.frustumCulled = false } })
  const rig = { name, root, model, mixer, acts, bones, sc, H0, cur: null, blob: null, extra: {}, arms: 0, armT: 0 }
  const blob = new THREE.Mesh(blobGeo, blobMat); blob.scale.setScalar(0.55 * (o.height || 1.75) / 1.75); blob.renderOrder = 1; blob.position.y = 0.02
  scene.add(blob); rig.blob = blob
  scene.add(root)
  root.visible = false; blob.visible = false
  return rig
}
function play(rig, name, o = {}) {
  if (rig.cur === name) return
  const a = rig.acts[name]; if (!a) return
  const prev = rig.cur && rig.acts[rig.cur]
  a.reset().setEffectiveWeight(1).setLoop(o.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = !!o.once
  a.setEffectiveTimeScale(o.speed || 1); a.time = o.t0 || 0
  if (prev) a.crossFadeFrom(prev, o.fade ?? 0.12, false)
  a.play(); rig.cur = name
}
function rigShow(rig, v) { rig.root.visible = v; rig.blob.visible = v }
function rigPlace(rig, x, z, ry) {
  rig.root.position.set(x, 0, z); rig.root.rotation.y = ry; rig.blob.position.x = x; rig.blob.position.z = z
}
// ---- 腕を前へ（手を伸ばすファン）
function armsUp(rig, k) {
  const l = rig.bones['arm-left'], r = rig.bones['arm-right']; if (!l || !r) return
  if (!rig.armBase) rig.armBase = [l.rotation.clone(), r.rotation.clone()]
  l.rotation.x = rig.armBase[0].x - 2.3 * k; r.rotation.x = rig.armBase[1].x - 2.3 * k
}
function addUchiwa(rig, k) {
  const g = new THREE.Group()
  const st = new THREE.Mesh(stickGeo, stickMat); st.position.y = 0.2; g.add(st)
  const d = new THREE.Mesh(uchiwaGeo, new THREE.MeshBasicMaterial({ map: uchiwaTexs[k % 4], side: THREE.DoubleSide })); d.position.y = 0.72; g.add(d)
  const d2 = d.clone(); d2.rotation.y = Math.PI; g.add(d2)
  g.position.set(0.32, 1.35, 0.1); rig.root.add(g); rig.extra.uchiwa = g
}
function addBand(rig) {
  const b = new THREE.Mesh(bandGeo, bandMat); b.rotation.x = Math.PI / 2; b.position.set(0, 1.6, 0)
  rig.root.add(b); rig.extra.band = b
}
function addCamera(rig) {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.2), new THREE.MeshStandardMaterial({ color: 0x1d1f26 })); g.add(body)
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.16, 10), new THREE.MeshStandardMaterial({ color: 0x555a66 })); lens.rotation.x = Math.PI / 2; lens.position.z = 0.16; g.add(lens)
  g.position.set(0, 1.5, 0.35); rig.root.add(g); rig.extra.cam = g
}
function addCane(rig) {
  if (!models.cane) return
  const c = SkeletonUtils.clone(models.cane.scene); c.scale.setScalar(1.0); c.position.set(0.38, 0, 0.18); rig.root.add(c); rig.extra.cane = c
}

// ============================================================ 着ぐるみの頭
function buildCostume() {
  const g = new THREE.Group()
  const white = new THREE.MeshStandardMaterial({ color: 0xfbf3e6, roughness: 0.85 })
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 24), white); head.scale.set(1.08, 0.96, 1.0); g.add(head)
  // 顔（前側 = +z）
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.505, 32, 24, Math.PI * 0.5 - 0.95, 1.9, Math.PI * 0.5 - 0.7, 1.4), new THREE.MeshBasicMaterial({ map: faceTex(), transparent: true, depthWrite: false }))
  face.scale.set(1.08, 0.96, 1.0); face.rotation.y = 0; g.add(face)
  // 芽
  const green = new THREE.MeshStandardMaterial({ color: 0x6bbf59, roughness: 0.7 })
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.2, 6), green); stem.position.y = 0.52; g.add(stem)
  for (const s of [-1, 1]) { const lf = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), green); lf.scale.set(1.6, 0.4, 0.8); lf.position.set(s * 0.14, 0.64, 0); lf.rotation.z = s * -0.5; g.add(lf) }
  // 後ろ側: ファスナーと通気口（走る間はこちらが見える）
  const dark = new THREE.MeshStandardMaterial({ color: 0xb9ae9f, roughness: 0.7 })
  const zip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, 0.02), dark); zip.position.set(0, 0.0, -0.5); g.add(zip)
  const pull = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.04), new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 0.3, roughness: 0.4 })); pull.position.set(0, 0.3, -0.52); g.add(pull)
  g.traverse(m => { if (m.isMesh) m.frustumCulled = false })
  return g
}

// ============================================================ 演出部品（スプライト）
const sprites = []
const heartT = heartTex(), puffT = puffTex(), starT = starTex(), sweatT = sweatTex()
function spawnSprite(tex, x, y, z, o = {}) {
  const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: o.op ?? 1, fog: false })
  const s = new THREE.Sprite(m); s.position.set(x, y, z); s.scale.setScalar(o.size ?? 0.5); scene.add(s)
  sprites.push({ s, vx: o.vx || 0, vy: o.vy ?? 1, vz: o.vz || 0, life: o.life ?? 1, t: 0, grow: o.grow ?? 0, fade: o.fade ?? true, g: o.g || 0 })
  return s
}
function stepSprites(dt) {
  for (let i = sprites.length - 1; i >= 0; i--) {
    const p = sprites[i]; p.t += dt
    p.vy -= p.g * dt
    p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt
    const k = p.t / p.life
    p.s.scale.setScalar(p.s.scale.x + p.grow * dt)
    if (p.fade) p.s.material.opacity = Math.max(0, 1 - k * k)
    if (p.t >= p.life) { scene.remove(p.s); p.s.material.dispose(); sprites.splice(i, 1) }
  }
}
function puff(x, y, z, n = 5, big = 1) {
  for (let i = 0; i < n; i++) spawnSprite(puffT, x + (rnd() - .5) * .6, y + rnd() * .4, z + (rnd() - .5) * .6, { size: 0.5 * big, vx: (rnd() - .5) * 2.2, vy: 0.6 + rnd(), vz: (rnd() - .5) * 2.2, life: 0.55, grow: 1.6 * big })
}
function stars(x, y, z, n = 4) {
  for (let i = 0; i < n; i++) { const a = rnd() * 6.28; spawnSprite(starT, x, y, z, { size: 0.28, vx: Math.cos(a) * 1.8, vy: 1.6 + rnd(), vz: Math.sin(a) * 1.8, life: 0.7, g: 4 }) }
}

// ============================================================ 状態
const inp = { L: false, R: false, hL: false, hR: false }
const G = { mode: 'load', time: 0, ts: 1, camS: 1, camA: Math.PI, shake: 0, z0: 0, seed: 0, runs: 0, over: null, hintShown: {}, muted: false, paused: false, bestKey: 'kg_best' }
const P = { x: 0, z: 0, vx: 0, speed: 0, h: 0, hv: 0, slowT: 0, na: 0, dist: 0, gifts: 0, flips: [], lastSteer: 0, cling: [], warn: 0, stepT: 0, wobT: 0 }
const HORDE = { g: 4.8, x: 0, n: 7, rigs: [], offs: [], stun: 0 }
let perf = null, costume = null, headBody = null
const fans = []         // 前から来るファン
let gift = null, giftT = 4
let flashT = 0, vigT = 0
let hordeBeat = 0
let waveNext = 150

function getBest() { try { return +localStorage.getItem(G.bestKey) || 0 } catch (e) { return 0 } }
function setBest(v) { try { localStorage.setItem(G.bestKey, String(v)) } catch (e) {} }

// ============================================================ 人物の用意
const scratchBox = new THREE.Box3()
function buildPerformer(modelName) {
  if (perf) { scene.remove(perf.root); scene.remove(perf.blob) }
  if (costume && costume.parent) costume.parent.remove(costume)
  perf = makeRig(modelName, { height: 1.55 })
  perf.persona = MALE.has(modelName) ? 'm' : 'f'
  perf.model.traverse(n => {
    if (n.isMesh && n.name === 'body-mesh') n.material = new THREE.MeshStandardMaterial({ color: 0xf7d3da, roughness: 0.95 })
    if (n.isMesh && n.name === 'head-mesh') { perf.headMesh = n; n.visible = false }
  })
  perf.model.updateMatrixWorld(true)
  const hb = perf.bones['head']
  const wp = new THREE.Vector3(); hb.getWorldPosition(wp)
  costume = buildCostume()
  const ws = new THREE.Vector3(); hb.getWorldScale(ws)
  // 頭ボーンの子にして、体の座標系でちょうど頭を包む位置へ
  const pivot = new THREE.Group(); hb.add(pivot)
  pivot.scale.setScalar(1 / ws.x)
  const q = new THREE.Quaternion(); hb.getWorldQuaternion(q); pivot.quaternion.copy(q.invert())
  pivot.add(costume)
  costume.scale.setScalar(1.12)
  perf.pivot = pivot; perf.neckY = wp.y
  costume.position.set(0, 0.04, 0)
  // しっぽ
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), new THREE.MeshStandardMaterial({ color: 0xfbf3e6, roughness: 0.9 }))
  tail.position.set(0, 0.55, -0.2); perf.root.add(tail)
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), new THREE.MeshStandardMaterial({ color: 0xfffaf0, roughness: 0.9 })); belly.scale.set(1, 1.1, 0.4); belly.position.set(0, 0.78, 0.2); perf.root.add(belly)
  rigShow(perf, true)
  play(perf, 'idle')
  return perf
}

function newFanRig(i, kind) {
  const name = kind === 'granny' ? ['female-a', 'female-c', 'female-e'][i % 3] : MODELS[(i * 5 + 3) % MODELS.length]
  const r = makeRig(name)
  addUchiwa(r, i); addBand(r); addCamera(r)
  if (name.startsWith('female')) addCane(r)
  r.extra.uchiwa.visible = r.extra.band.visible = r.extra.cam.visible = false
  if (r.extra.cane) r.extra.cane.visible = false
  return r
}
function buildFans() {
  for (let i = 0; i < 26; i++) {
    const rig = newFanRig(i)
    fans.push({ rig, active: false, type: 'normal', state: 'run', x: 0, z: 0, vx: 0, vz: 0, t: 0, side: 1, ph: 0, uch: null, sc: 1 })
  }
  for (let i = 0; i < 14; i++) {
    const rig = newFanRig(i + 40)
    rig.extra.uchiwa.visible = i % 2 === 0; rig.extra.band.visible = i % 5 === 1
    HORDE.rigs.push(rig)
    HORDE.offs.push({ ox: ((i % 7) - 3) * 0.95 + (Math.sin(i * 7.1) * 0.25), oz: Math.floor(i / 7) * 1.5 + Math.abs(Math.sin(i * 3.3)) * 0.9, ph: i * 0.37 })
  }
}

function stateColorFans() {}

function fanAcquire() { return fans.find(f => !f.active) }
function fanSpawn(type, x, z, vz) {
  const f = fanAcquire(); if (!f) return null
  const r = f.rig
  f.active = true; f.type = type; f.state = 'run'; f.x = x; f.z = z; f.vz = vz ?? 5.2; f.vx = 0; f.t = 0; f.ph = rnd() * 6; f.side = x < P.x ? -1 : 1; f.done = false
  const sc = type === 'kid' ? 0.64 : type === 'granny' ? 0.88 : 1
  r.root.scale.setScalar(sc); r.blob.scale.setScalar(0.55 * sc)
  r.extra.uchiwa.visible = type === 'normal' || type === 'kid'
  r.extra.band.visible = type === 'grabber'
  r.extra.cam.visible = type === 'photo'
  if (r.extra.cane) r.extra.cane.visible = type === 'granny'
  rigShow(r, true)
  play(r, type === 'photo' ? 'idle' : 'sprint', { speed: type === 'granny' ? 1.5 : type === 'kid' ? 1.3 : 1 })
  r.armT = type === 'grabber' ? 1 : type === 'photo' ? 0.55 : 0
  r.root.rotation.z = 0; r.root.position.y = 0
  f.rig.cur = r.cur
  return f
}
function fanRetire(f) { f.active = false; rigShow(f.rig, false); if (f.rig.heart) f.rig.heart.visible = false }

// ============================================================ プレゼント
const giftMesh = (() => {
  const g = new THREE.Group()
  const sh = new THREE.Shape(); sh.moveTo(0, -0.3); sh.bezierCurveTo(-0.55, 0.05, -0.3, 0.45, 0, 0.2); sh.bezierCurveTo(0.3, 0.45, 0.55, 0.05, 0, -0.3)
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.22, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 }), new THREE.MeshStandardMaterial({ color: 0xf4789a, roughness: 0.5, emissive: 0x4a1020 }))
  m.position.z = -0.11; g.add(m); g.scale.setScalar(1.25); g.visible = false; scene.add(g)
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, side: THREE.DoubleSide }))
  ring.rotation.x = -Math.PI / 2; ring.position.y = -0.82; g.add(ring)
  return g
})()
const fxRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 40), new THREE.MeshBasicMaterial({ color: 0xff8aa6, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, fog: false }))
fxRing.rotation.x = -Math.PI / 2; scene.add(fxRing)
let ringT = 0

// ============================================================ 音
const SOUNDS = {
  bgm: 'snd/bgm.mp3', crowd: 'snd/crowd.mp3', street: 'snd/street.mp3',
  squeak: ['snd/sq1.mp3', 'snd/sq2.mp3', 'snd/sq3.mp3', 'snd/sq4.mp3'], thwack: ['snd/thwack1.mp3', 'snd/thwack2.mp3'],
  pop: ['snd/pop1.mp3', 'snd/pop2.mp3', 'snd/pop3.mp3'], bonk: ['snd/bonk1.mp3', 'snd/bonk2.mp3', 'snd/bonk3.mp3'],
  grunt: ['snd/grunt1.mp3', 'snd/grunt2.mp3', 'snd/grunt3.mp3'], giggle: 'snd/giggle.mp3', applause: 'snd/applause.mp3',
  lose: 'snd/lose.mp3', start: 'snd/start.mp3', step: ['snd/step1.mp3', 'snd/step2.mp3'], wobble: 'snd/wobble.mp3',
}
Snd.def(SOUNDS)
const sfx = (n, o) => Snd.play(n, o)
function setAmb(mode) {
  if (mode === 'title') { Snd.loop('bgm', SOUNDS.bgm, 0.0001, 0.3); Snd.loop('crowd', SOUNDS.crowd, 0.12, 0.8); Snd.loop('street', SOUNDS.street, 0.12, 0.8) }
  if (mode === 'run') { Snd.loop('bgm', SOUNDS.bgm, 0.2, 1.2); Snd.loop('crowd', SOUNDS.crowd, 0.16, 0.8); Snd.loop('street', SOUNDS.street, 0.1, 0.8) }
  if (mode === 'off') { Snd.loop('bgm', null); Snd.loop('crowd', null); Snd.loop('street', null) }
}

// ============================================================ ゲームの流れ
function say(txt, id = 'bubble') { const b = $(id); if (!txt) { b.hidden = true; return } b.textContent = txt; b.hidden = false; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '' }
function showHint(key) {
  const h = $('hint')
  if (!key) { h.hidden = true; clearGlow(); return }
  h.textContent = T()[key]; h.hidden = false; h.style.animation = 'none'; void h.offsetWidth; h.style.animation = ''
  clearGlow()
  const tgt = key === 'hint1' ? ['bL', 'bR'] : key === 'hint2' ? ['hL', 'hR'] : key === 'hint3' ? ['bGift'] : []
  tgt.forEach(i => $(i).classList.add('glow'))
}
function clearGlow() { document.querySelectorAll('.glow').forEach(e => e.classList.remove('glow')) }

function hordeLayout() {
  HORDE.rigs.forEach((r, i) => { rigShow(r, i < HORDE.n); if (i < HORDE.n) { play(r, 'sprint', { speed: 1.1 + (i % 3) * 0.08, t0: i * 0.13 }); r.armT = i % 3 === 0 ? 0.9 : 0.35 } })
}

function resetRun() {
  for (const f of fans) fanRetire(f)
  const mm = MODELS[Math.floor(rnd() * MODELS.length)]
  buildPerformer(mm)
  P.x = 0; P.z = 0; P.vx = 0; P.speed = 0; P.h = 0; P.hv = 0; P.slowT = 0; P.na = 0; P.dist = 0; P.gifts = 0; P.flips = []; P.lastSteer = 0; P.cling = []; P.warn = 0
  G.z0 = 0; G.time = 0; G.ts = 1; G.shake = 0; G.over = null
  HORDE.g = 4.8; HORDE.x = 0; HORDE.n = 8; HORDE.stun = 0
  gift = null; giftT = 4; giftMesh.visible = false; waveNext = 150
  fanT = 1.2; hintT = 0
  hordeLayout()
  say(null); $('giftN').textContent = '0'; $('bGift').hidden = true
  updateHud(true)
  layoutSegs(0, true)
}
let fanT = 1.2, hintT = 0

function startRun() {
  Snd.init(); Snd.wake?.()
  G.runs++
  const first = G.mode === 'title'
  resetRun()
  G.mode = 'run'; G.startT = 0
  G.camS = 1; G.camTarget = 0
  setAmb('run'); sfx('start', { vol: 0.5 })
  $('title').hidden = true; $('result').hidden = true; $('hud').hidden = false
  say(null)
  play(perf, 'sprint', { speed: 1.0 })
  hordeLayout()
  placeHorde(0)
}

function placeHorde(dt) {
  HORDE.x += (P.x - HORDE.x) * Math.min(1, dt * 2.4)
  const base = P.z + 1.9 + HORDE.g * 0.5
  HORDE.rigs.forEach((r, i) => {
    if (i >= HORDE.n) return
    const o = HORDE.offs[i]
    const w = Math.sin(G.time * 3.1 + o.ph) * 0.18
    const x = clamp(HORDE.x + o.ox * (0.9 + Math.min(0.3, HORDE.g * 0.03)) + w, -ROAD - 0.6, ROAD + 0.6)
    const z = base + o.oz
    rigPlace(r, x, z, Math.PI)
    r.root.position.y = Math.abs(Math.sin(G.time * 6 + o.ph)) * 0.05
    armsUp(r, r.armT * (HORDE.g < 3.5 ? 1 : 0.7))
    if (r.extra.uchiwa.visible) r.extra.uchiwa.rotation.z = Math.sin(G.time * 7 + o.ph) * 0.4
  })
}

function popHead(cause) {
  if (G.mode !== 'run') return
  G.mode = 'reveal'; G.over = cause; G.revT = 0; G.ts = 0.3; G.shake = 0.8
  sfx('pop', { vol: 0.9 }); sfx('bonk', { vol: 0.7, delay: 0.06 })
  Snd.duck(0.25, 2.5)
  setAmb('off'); Snd.loop('crowd', SOUNDS.crowd, 0.06, 0.4)
  showHint(null); $('bGift').hidden = true
  // 頭を体から外す
  const wp = new THREE.Vector3(), wq = new THREE.Quaternion(), ws = new THREE.Vector3()
  costume.updateWorldMatrix(true, false); costume.matrixWorld.decompose(wp, wq, ws)
  perf.pivot.remove(costume); scene.add(costume)
  costume.position.copy(wp); costume.quaternion.copy(wq); costume.scale.copy(ws)
  const dir = cause === 'fell' ? Math.sign(P.h || 1) : (rnd() < 0.5 ? -1 : 1)
  headBody = { v: new THREE.Vector3(dir * (0.4 + rnd() * 0.5), 5.0, -(1.5 + rnd() * 0.6)), w: new THREE.Vector3(rnd() * 2, 0, -dir * 7), rest: 0, bounces: 0 }
  perf.headMesh.visible = true; perf.root.userData.rx = 'idle'
  puff(wp.x, wp.y, wp.z, 8, 1.2); stars(wp.x, wp.y + 0.3, wp.z, 8)
  // 汗
  perf.sweat = spawnSprite(sweatT, P.x, 1.5, P.z - 0.3, { size: 0.28, vy: 0, life: 99, fade: false })
  // ファンは立ち止まって輪になる
  R.ringAng = []
  for (const f of fans) if (f.active) { f.state = 'ring'; f.t = 0 }
  HORDE.n = Math.min(HORDE.rigs.length, HORDE.n + 2); hordeLayout()
  const m = (perf.persona === 'm' ? T().persMale : T().persFemale)
  R.line = m[Math.floor(rnd() * m.length)]; R.shot = false; R.cam = 0; R.said1 = R.said2 = 0
  for (const c of P.cling) { c.state = 'ring' } ; P.cling = []
  const sc = G.dist = Math.floor(P.dist); G.final = sc
}
const R = { t: 0, line: '', shot: false, ringAng: [] }

function stepRun(dt) {
  const steer = (inp.L ? -1 : 0) + (inp.R ? 1 : 0)
  if (steer !== 0 && steer !== P.lastSteer) { if (P.lastSteer !== 0) P.flips.push(G.time); P.lastSteer = steer }
  P.flips = P.flips.filter(t => G.time - t < 0.85)
  if (P.flips.length >= 2 && P.cling.length) shakeOff()
  const tvx = steer * 5.6
  const ax = (tvx - P.vx) * 11
  P.vx += ax * dt
  P.x += P.vx * dt
  if (Math.abs(P.x) > ROAD) { P.x = Math.sign(P.x) * ROAD; P.vx *= -0.2 }
  const cruise = 8.0 + Math.min(P.dist / 110, 3.8)
  P.slowT = Math.max(0, P.slowT - dt * 1.3)
  const target = cruise * (1 - 0.6 * P.slowT - 0.06 * P.cling.length)
  P.speed += (target - P.speed) * Math.min(1, dt * 6)
  P.z -= P.speed * dt
  P.dist = G.z0 - P.z
  // ---- 頭のずれ
  const ramp = Math.min(1, 0.2 + P.dist / 120)
  const sf = P.speed / 10
  const gauss = (rnd() + rnd() + rnd() - 1.5) * 2
  P.na += -2.2 * P.na * dt + 6.0 * gauss * Math.sqrt(dt)
  const bob = Math.sin(G.time * Math.PI * 2 * 1.4) * 0.8 * sf
  const hard = 1 + Math.min(0.9, P.dist / 650)
  let acc = (1.0 + 0.55 * (hard - 1)) * P.h - 1.5 * P.hv + (P.na * 0.34 + bob * 0.8) * ramp * hard - 0.035 * ax
  for (const c of P.cling) acc += c.side * 1.5
  if (HORDE.g < 2.6) acc += Math.sin(G.time * 5.3) * (2.0 + (2.6 - HORDE.g) * 3.2)
  const push = (inp.hR ? 1 : 0) - (inp.hL ? 1 : 0)
  acc += push * 6.2
  P.hv += acc * dt; P.h += P.hv * dt
  P.warn = Math.abs(P.h)
  // ---- 群れ
  const hs = HORDE.stun > 0 ? 0.15 : 0.972 + Math.min(P.dist / 15000, 0.018)
  HORDE.stun = Math.max(0, HORDE.stun - dt)
  HORDE.g = Math.min(9, HORDE.g + (P.speed - cruise * hs) * dt)
  HORDE.n = Math.min(14, 8 + Math.floor(P.dist / 70))
  // ---- 足音
  P.stepT -= dt
  if (P.stepT <= 0) { P.stepT = 0.37 - Math.min(0.08, P.dist / 3000); sfx('step', { vol: 0.16, jitter: 0.12 }) }
  // ---- 出現
  fanT -= dt
  if (fanT <= 0) spawnFan()
  if (P.dist >= waveNext) { spawnWall(); waveNext += 170 + Math.floor(P.dist / 6) }
  giftT -= dt
  if (!gift && giftT <= 0) { gift = { x: (rnd() * 2 - 1) * (ROAD - 0.8), z: P.z - 40 }; giftMesh.visible = true }
  if (gift) {
    gift.z += 0; const dx = gift.x - P.x, dz = gift.z - P.z
    if (Math.abs(dz) < 1.1 && Math.abs(dx) < 1.15) {
      P.gifts = Math.min(2, P.gifts + 1); giftMesh.visible = false; gift = null; giftT = 5 + rnd() * 5
      sfx('pop', { vol: 0.8, rate: 1.3 }); $('giftN').textContent = P.gifts; $('bGift').hidden = false; puff(P.x, 1.2, P.z, 3, 0.7)
      if (!G.hintShown.h3) { G.hintShown.h3 = 1; if (G.runs <= 3) { showHint('hint3'); hintT = 3.2 } }
    } else if (gift.z > P.z + 6) { giftMesh.visible = false; gift = null; giftT = 4 }
  }
  // ---- ファン
  stepFans(dt)
  // ---- 負け
  if (Math.abs(P.h) >= 1) { P.h = Math.sign(P.h) * 1.02; popHead('fell'); return }
  if (HORDE.g <= 0) { popHead('caught'); return }
  hintLogic(dt)
}

function hintLogic(dt) {
  if (G.runs > 3) return
  if (hintT > 0) { hintT -= dt; if (hintT <= 0) showHint(null) }
  if (P.dist < 1 && !G.hintShown.h1) { G.hintShown.h1 = 1; showHint('hint1'); hintT = 4 }
  else if (Math.abs(P.h) > 0.42 && !G.hintShown.h2) { G.hintShown.h2 = 1; showHint('hint2'); hintT = 4 }
  else if (P.cling.length && !G.hintShown.sw && G.hintShown.h2) { G.hintShown.sw = 1; showHint('hintSwing'); hintT = 3.5 }
}

function spawnFan() {
  const d = P.dist
  fanT = Math.max(0.5, 1.75 - d / 380) * (0.75 + rnd() * 0.5)
  const r = rnd()
  let type = 'normal'
  if (d > 60 && r < 0.2) type = 'grabber'
  else if (d > 30 && r < 0.34) type = 'kid'
  else if (d > 90 && r < 0.38) type = 'granny'
  else if (d > 50 && r < 0.45) type = 'photo'
  const near = rnd() < 0.55
  let x = near ? clamp(P.x + (rnd() * 2 - 1) * 3.2, -ROAD, ROAD) : (rnd() * 2 - 1) * (ROAD + 0.6)
  if (type === 'photo') x = (rnd() < 0.5 ? -1 : 1) * (ROAD + 0.3)
  const sp = type === 'normal' ? 5.2 : type === 'grabber' ? 6.3 : type === 'kid' ? 6.8 : type === 'granny' ? 10.5 : 0
  const f = fanSpawn(type, x, P.z - 44, sp)
  if (f && type === 'granny') f.x = clamp(P.x + P.vx * 0.5, -ROAD, ROAD)
}
function spawnWall() {
  const slots = 8, gap = Math.floor(rnd() * (slots - 2)) + 1
  for (let i = 0; i < slots; i++) {
    if (i === gap || i === gap + 1) continue
    const x = lerp(-ROAD - 0.2, ROAD + 0.2, i / (slots - 1))
    const f = fanSpawn('normal', x, P.z - 48 - (i % 2) * 1.2, 4.6); if (f) { f.wall = true }
  }
}

function hug(f) {
  const mag = f.type === 'grabber' ? 2.3 : f.type === 'granny' ? 3.0 : f.type === 'kid' ? 1.0 : 1.7
  const dir = Math.abs(f.x - P.x) < 0.15 ? (rnd() < 0.5 ? -1 : 1) : Math.sign(f.x - P.x)
  P.hv += dir * mag
  P.slowT = Math.min(1, P.slowT + (f.type === 'granny' ? 1 : f.type === 'kid' ? 0.4 : 0.75))
  sfx('squeak', { vol: 0.8 }); sfx('thwack', { vol: 0.55, delay: 0.02 }); if (rnd() < 0.5) sfx('grunt', { vol: 0.5, delay: 0.05 })
  G.shake = Math.max(G.shake, 0.35); puff(f.x, 1.0, f.z, 4); stars(P.x, 2.0, P.z, 3)
  if (f.type === 'kid') { f.state = 'leave'; f.t = 0; play(f.rig, 'idle'); return }
  f.state = 'cling'; f.t = 0; f.life = 3.4; f.side = dir; P.cling.push(f); play(f.rig, 'sprint', { speed: 1.2 }); f.rig.armT = 1
}
function shakeOff() {
  for (const f of P.cling) { f.state = 'fling'; f.t = 0; f.vx = f.side * 8; f.vy = 4; play(f.rig, 'fall') ; sfx('squeak', { vol: 0.5, rate: 1.4 }) }
  puff(P.x, 1.0, P.z, 5)
  P.cling = []; P.flips = []
}
function fanService() {
  if (G.mode !== 'run' || P.gifts <= 0) return
  P.gifts--; $('giftN').textContent = P.gifts; if (!P.gifts) $('bGift').hidden = true
  sfx('giggle', { vol: 0.8 }); sfx('pop', { vol: 0.6, rate: 1.5 })
  let n = 0
  for (const f of fans) if (f.active && (f.state === 'run') && f.z > P.z - 30 && f.z < P.z + 3) { f.state = 'stun'; f.t = 0; f.life = 2.8; f.sweet = true; n++ ; heartsAt(f.x, f.z, 1.8 * f.rig.root.scale.y + 0.2) }
  for (const f of [...P.cling]) { f.state = 'leave'; f.t = 0; play(f.rig, 'emote-yes'); heartsAt(f.x, f.z, 2) }
  P.cling = []
  HORDE.stun = 2.2; hordeHearts()
  ringT = 0.6; fxRing.position.set(P.x, 0.06, P.z)
  P.slowT = 0
}
function heartsAt(x, z, y) { for (let i = 0; i < 3; i++) spawnSprite(heartT, x + (rnd() - .5) * .5, y, z, { size: 0.4, vy: 0.9 + rnd() * 0.5, vx: (rnd() - .5) * .8, life: 1.3 + rnd() * 0.5 }) }
function hordeHearts() { for (let i = 0; i < Math.min(HORDE.n, 9); i++) { const r = HORDE.rigs[i]; heartsAt(r.root.position.x, r.root.position.z, 2.1) } }

function stepFans(dt) {
  for (const f of fans) {
    if (!f.active) continue
    const r = f.rig
    f.t += dt
    if (f.state === 'run') {
      if (f.type === 'photo') {
        if (!f.flashed && f.z > P.z - 7.5) { f.flashed = true; flashT = 0.5; P.hv += (rnd() < .5 ? -1 : 1) * 0.9; sfx('thwack', { vol: 0.3, rate: 1.8 }) }
        f.z += 0
        rigPlace(r, f.x, f.z, f.x < 0 ? Math.PI / 2 : -Math.PI / 2)
        // 世界は動かない: 相対的に後ろへ流れる
      } else {
        if (!f.wall && f.type !== 'granny') {
          const lead = P.x + P.vx * 0.35
          let want = clamp((lead - f.x) * 1.8, -3.3, 3.3)
          if (f.type === 'kid') want += Math.sin(f.t * 5 + f.ph) * 2.6
          f.vx += (want - f.vx) * Math.min(1, dt * 4)
          f.x += f.vx * dt
        }
        f.z += f.vz * dt
        const dir = Math.atan2(f.vx, f.vz)
        rigPlace(r, f.x, f.z, dir)
        r.root.position.y = Math.abs(Math.sin(f.t * 9 + f.ph)) * 0.05
        // 当たり
        const rr = f.type === 'kid' ? 0.75 : 0.95
        if (Math.abs(f.z - P.z) < rr && Math.abs(f.x - P.x) < rr) hug(f)
      }
      if (f.z > P.z + 9) fanRetire(f)
    } else if (f.state === 'cling') {
      f.x = P.x + f.side * 0.85; f.z = P.z + 0.15
      rigPlace(r, f.x, f.z, Math.PI)
      r.root.position.y = Math.abs(Math.sin(f.t * 9)) * 0.05
      if (f.t > f.life) { P.cling = P.cling.filter(c => c !== f); f.state = 'leave'; f.t = 0; play(r, 'fall'); f.leaveZ = f.z }
    } else if (f.state === 'leave') {
      rigPlace(r, f.x, f.z, r.root.rotation.y)
      if (f.t > 1.6 || f.z > P.z + 9) fanRetire(f)
    } else if (f.state === 'fling') {
      f.x += f.vx * dt; f.vy -= 14 * dt; r.root.position.y = Math.max(0, r.root.position.y + f.vy * dt); r.root.rotation.z += 9 * dt * Math.sign(f.vx)
      f.z += 0
      rigPlace(r, f.x, f.z, r.root.rotation.y); if (f.t > 0.9) { r.root.rotation.z = 0; fanRetire(f) }
    } else if (f.state === 'stun') {
      if (f.t > f.life) { f.state = 'run'; f.t = 0 } else if (rnd() < dt * 1.2) heartsAt(f.x, f.z, 1.9)
      play(r, 'emote-yes')
      rigPlace(r, f.x, f.z, f.vx >= 0 ? 0 : 0)
      r.root.rotation.y = Math.PI * 0.0
      if (f.z > P.z + 9) fanRetire(f)
    } else if (f.state === 'ring') {
      // 輪になって中の人を見る
    }
    if (f.active) {
      if (r.extra.uchiwa.visible) r.extra.uchiwa.rotation.z = Math.sin(G.time * 8 + f.ph) * 0.35
      armsUp(r, f.state === 'stun' ? 0 : f.state === 'leave' ? 0 : r.armT)
    }
  }
}

// ============================================================ 正体バレ
function stepReveal(dt, rdt) {
  R.t += rdt
  // 時間の流れ: 最初はスローで、すぐ戻す
  G.ts = R.t < 0.9 ? 0.3 : lerp(0.3, 1, smooth(clamp((R.t - 0.9) / 0.5, 0, 1)))
  P.speed *= Math.pow(0.02, dt)
  P.z -= P.speed * dt
  if (R.t > 0.6 && perf.cur !== 'emote-no' && R.t > 1.5) play(perf, 'emote-no', { speed: 1.1 })
  else if (R.t > 0.55 && perf.cur === 'sprint') play(perf, 'idle')
  // 頭の物理
  const hb = headBody
  if (hb) {
    hb.v.y -= 18 * dt
    costume.position.addScaledVector(hb.v, dt)
    const r = 0.62
    if (costume.position.y < r) {
      costume.position.y = r
      if (hb.v.y < -1.2) { hb.bounces++; sfx('bonk', { vol: clamp(Math.abs(hb.v.y) / 7, 0.2, 0.9), rate: 0.9 + rnd() * 0.3 }); if (hb.bounces < 4) sfx('squeak', { vol: 0.3, delay: 0.03 }); puff(costume.position.x, 0.2, costume.position.z, 2, 0.6) }
      hb.v.y *= -0.52; hb.v.x *= 0.82; hb.v.z *= 0.82
      if (Math.abs(hb.v.y) < 1.0) hb.v.y = 0
    }
    if (costume.position.y <= r + 0.001) { hb.v.x *= Math.pow(0.35, dt); hb.v.z *= Math.pow(0.35, dt) }
    costume.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), -hb.v.z * dt / r)
    costume.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), hb.v.x * dt / r)
    costume.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), hb.w.y * dt)
  }
  if (perf.sweat) perf.sweat.position.set(P.x + 0.35, 1.45 + Math.sin(R.t * 8) * 0.03, P.z - 0.2)
  // 輪
  const members = []
  for (const f of fans) if (f.active) members.push(f.rig)
  HORDE.rigs.forEach((r, i) => { if (i < HORDE.n) members.push(r) })
  members.forEach((r, i) => {
    const n = members.length
    // カメラ側（-z）をあける
    const a = Math.PI + 0.8 + (i + 0.5) / n * (Math.PI * 2 - 1.6)
    const rad = 3.0 + (i % 3) * 0.9
    const tx = P.x + Math.sin(a) * rad, tz = P.z + Math.cos(a) * rad
    const px = r.root.position.x, pz = r.root.position.z
    const d = Math.hypot(tx - px, tz - pz)
    const k = Math.min(1, dt * 3.2)
    let nx = px + (tx - px) * k, nz = pz + (tz - pz) * k
    if (d > 0.5) { play(r, 'sprint', { speed: 1.2 }); r.root.rotation.y = Math.atan2(tx - px, tz - pz) } else {
      play(r, r.root.userData.rx || 'idle'); r.root.rotation.y = Math.atan2(P.x - px, P.z - pz)
    }
    r.root.position.set(nx, 0, nz); r.blob.position.set(nx, 0.02, nz)
    armsUp(r, d > 0.5 ? 0.3 : 0)
    if (r.extra.uchiwa && r.extra.uchiwa.visible) r.extra.uchiwa.rotation.z = Math.sin(R.t * 6 + i) * 0.3
    if (d <= 0.5 && R.t > 1.8 && rnd() < dt * 0.4) spawnSprite(starT, nx, 2.0, nz, { size: 0.22, vy: 0.8, life: 0.6 })
  })
  if (R.t > 1.0 && !R.cam) { R.cam = 1; setCamTarget(1, 1.25) }
  if (R.t > 1.9 && !R.said1) { R.said1 = 1; say(R.line); sfx('giggle', { vol: 0.4 }); sfx('lose', { vol: 0.6 }) }
  if (R.t > 3.6 && !R.said2) { R.said2 = 1; say(T().perfLine) }
  if (R.t > 3.4 && !R.shot) { R.shot = true; capturePhoto() }
  if (R.t > 4.9 && G.mode === 'reveal') showResult()
}

let photoCv = null
function capturePhoto() {
  renderer.render(scene, camera)
  const c = renderer.domElement
  const W = c.width, H = c.height
  const ar = 624 / 380
  let sw = W, sh = Math.round(W / ar)
  if (sh > H) { sh = H; sw = Math.round(H * ar) }
  photoCv = document.createElement('canvas'); photoCv.width = 624; photoCv.height = 380
  const g = photoCv.getContext('2d')
  g.drawImage(c, (W - sw) / 2, Math.max(0, H * 0.5 - sh * 0.5), sw, sh, 0, 0, 624, 380)
}
function rankOf(m) { let r = T().ranks[0][1]; for (const [n, name] of T().ranks) if (m >= n) r = name; return r }
function drawCard() {
  const cv = $('cv'), g = cv.getContext('2d'), W = cv.width, H = cv.height
  g.fillStyle = '#fffaf0'; g.fillRect(0, 0, W, H)
  if (photoCv) g.drawImage(photoCv, 8, 8, 624, 380)
  g.strokeStyle = '#22304a'; g.lineWidth = 5; g.strokeRect(8, 8, 624, 380)
  // 激写タグ
  g.save(); g.translate(26, 34); g.rotate(-0.08)
  g.fillStyle = '#d93a2b'; g.fillRect(0, 0, 150, 54); g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(5, 5, 140, 44)
  g.fillStyle = '#fff'; g.font = `38px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(T().shot, 75, 29); g.restore()
  // ふきだし
  if (R.line) {
    g.font = `34px ${FONT}`; const w = g.measureText(R.line).width + 40
    const x = 624 - w - 14, y = 28
    g.fillStyle = '#fff'; g.strokeStyle = '#22304a'; g.lineWidth = 4
    g.beginPath(); g.roundRect(x + 8, y, w, 58, 24); g.fill(); g.stroke()
    g.fillStyle = '#22304a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(R.line, x + 8 + w / 2, y + 31)
  }
  g.fillStyle = '#22304a'; g.textAlign = 'left'; g.textBaseline = 'alphabetic'
  g.font = `22px ${FONT}`; g.fillText(T().shotSub, 24, 424)
  g.fillStyle = '#d93a2b'; g.font = `96px ${FONT}`; g.fillText(String(G.final || 0), 22, 510)
  const nw = g.measureText(String(G.final || 0)).width
  g.font = `40px ${FONT}`; g.fillText('m', 28 + nw, 510)
  g.fillStyle = '#22304a'; g.font = `32px ${FONT}`; g.textAlign = 'right'; g.fillText(rankOf(G.final || 0), 616, 470)
  g.font = `22px ${FONT}`; g.fillText(`${T().best} ${getBest()}${T().m}`, 616, 512)
  g.textAlign = 'left'; g.font = `18px ${FONT}`; g.globalAlpha = 0.7; g.fillText(T().title, 24, 544); g.globalAlpha = 1
}
function showResult() {
  G.mode = 'result'
  const f = G.final || 0
  if (f > getBest()) setBest(f)
  say(null); showHint(null)
  drawCard()
  $('result').hidden = false; $('hud').hidden = true
  $('bAgain').textContent = T().again
}

// ============================================================ カメラ
function updateCamera(rdt) {
  if (G.camTween != null) {
    G.camTweenT = (G.camTweenT || 0) + rdt
    const k = smooth(clamp(G.camTweenT / (G.camDur || 1.1), 0, 1))
    G.camS = lerp(G.camFrom, G.camTarget, k)
    if (k >= 1) G.camTween = null
  }
  const s = G.camS
  const a = Math.PI * s
  const r = lerp(7.2, 5.8, s), hgt = lerp(4.8, 2.9, s)
  const off = lerp(-1.6, -1.3, s), ly = lerp(0.9, 0.9, s)
  const px = P.x * 0.78
  camera.position.set(px + Math.sin(a) * r, hgt, P.z + Math.cos(a) * r)
  if (G.shake > 0.001) { camera.position.x += (rnd() - .5) * G.shake * 0.5; camera.position.y += (rnd() - .5) * G.shake * 0.4; G.shake = Math.max(0, G.shake - rdt * 2.4) }
  camera.lookAt(P.x * 0.9, ly, P.z + off)
}
function setCamTarget(t, dur) { G.camFrom = G.camS; G.camTarget = t; G.camTween = 1; G.camTweenT = 0; G.camDur = dur || 1.1 }

// ============================================================ 1コマ（固定60Hz）
function simStep(rdt) {
  const dt = rdt * G.ts
  G.time += dt
  if (G.mode === 'run') {
    stepRun(dt)
    if (G.mode === 'run') {
      placeHorde(dt)
      const k = Math.abs(P.h)
      if (k > 0.72) { P.wobT -= dt; if (P.wobT <= 0) { P.wobT = 1.1; sfx('wobble', { vol: 0.35, rate: 0.9 + k * 0.4 }) } }
    }
  } else if (G.mode === 'reveal') stepReveal(dt, rdt)
  else if (G.mode === 'title') placeHorde(dt)
  // 頭の見た目
  if (costume && costume.parent === perf.pivot) {
    const h = P.h, wob = Math.sin(G.time * 17) * 0.05 * Math.max(0, Math.abs(h) - 0.5)
    costume.rotation.z = h * 0.95 + wob
    costume.rotation.x = Math.sin(G.time * Math.PI * 2 * 1.4 * 2) * 0.05 * (G.mode === 'run' ? 1 : 0)
    costume.position.x = -h * 0.34
    costume.position.y = 0.04 + Math.max(0, Math.abs(h) - 0.7) * 0.2
  }
  // 人物の位置
  if (G.mode === 'run' || G.mode === 'title') {
    rigPlace(perf, P.x, P.z, Math.PI)
    perf.root.rotation.z = 0
    perf.root.position.y = G.mode === 'run' ? Math.abs(Math.sin(G.time * 8.8)) * 0.05 : 0
    perf.root.rotation.z = G.mode === 'run' ? -P.vx * 0.02 : 0
  } else if (G.mode === 'reveal') {
    rigPlace(perf, P.x, P.z, Math.PI + Math.sin(clamp((R.t - 1.3) * 2, 0, 1) * Math.PI) * 0.35)
  }
  if (G.mode === 'run') {
    const a = perf.acts.sprint; if (a) a.setEffectiveTimeScale(clamp(P.speed / 8, 0.8, 1.6))
    armsUp(perf, 0)
  }
  // ミキサー
  for (const f of fans) if (f.active) f.rig.mixer.update(dt)
  HORDE.rigs.forEach((r, i) => { if (i < HORDE.n) r.mixer.update(dt) })
  perf.mixer.update(dt)
  stepSprites(dt)
  // ひとこと演出
  if (ringT > 0) { ringT -= rdt; const k = 1 - ringT / 0.6; fxRing.scale.setScalar(1 + k * 12); fxRing.material.opacity = Math.max(0, 0.8 * (1 - k)); fxRing.position.set(P.x, 0.06, P.z); if (ringT <= 0) fxRing.material.opacity = 0 }
  if (gift) { giftMesh.visible = true; giftMesh.position.set(gift.x, 1.1 + Math.sin(G.time * 4) * 0.12, gift.z); giftMesh.rotation.y = G.time * 2 }
  if (flashT > 0) flashT -= rdt
  layoutSegs(P.z)
}

function updateHud(force) {
  $('bibN').textContent = String(Math.floor(P.dist))
  const h = P.h, a = Math.abs(h)
  $('hL').classList.toggle('warn', h > 0.5 && G.mode === 'run')   // 右に傾いたら左へ押す
  $('hR').classList.toggle('warn', h < -0.5 && G.mode === 'run')
  const dang = Math.max(clamp((a - 0.55) / 0.45, 0, 1) * 0.75, G.mode === 'run' ? clamp((3 - HORDE.g) / 3, 0, 1) * 0.55 : 0)
  $('vig').style.opacity = dang.toFixed(2)
  $('flash').style.opacity = flashT > 0 ? Math.min(1, flashT / 0.5 * 1.1).toFixed(2) : '0'
  $('bGift').classList.toggle('ready', P.gifts > 0)
  $('bGift').disabled = P.gifts <= 0
  for (const [id, key] of [['bL', 'L'], ['bR', 'R'], ['hL', 'hL'], ['hR', 'hR']]) $(id).classList.toggle('on', !!inp[key])
}

// ============================================================ ループ
let last = performance.now(), acc = 0, dbgPause = false, frames = 0
function render() { renderer.render(scene, camera) }
function frame(now) {
  requestAnimationFrame(frame)
  const real = Math.min(0.1, (now - last) / 1000); last = now
  if (!G.paused && !dbgPause && G.mode !== 'load') {
    acc += real
    let n = 0
    while (acc >= STEP && n++ < 6) { simStep(STEP); acc -= STEP; updateCamera(STEP) }
    if (n >= 6) acc = 0
  }
  frames++
  if (G.mode !== 'load') { if ((frames & 1) === 0 || G.mode !== 'run') updateHud() }
  render()
}

// ============================================================ 入力
function bindHold(id, key) {
  const el = $(id)
  const on = e => { e.preventDefault(); inp[key] = true; try { el.setPointerCapture(e.pointerId) } catch (x) {} Snd.init() }
  const off = e => { inp[key] = false }
  el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off)
  el.addEventListener('contextmenu', e => e.preventDefault())
}
bindHold('bL', 'L'); bindHold('bR', 'R'); bindHold('hL', 'hL'); bindHold('hR', 'hR')
$('bGift').addEventListener('pointerdown', e => { e.preventDefault(); fanService() })
const KEYS = { ArrowLeft: 'L', ArrowRight: 'R', a: 'L', d: 'R', j: 'hL', l: 'hR', ',': 'hL', '.': 'hR' }
addEventListener('keydown', e => { const k = KEYS[e.key]; if (k) { inp[k] = true; e.preventDefault() } if (e.key === ' ' || e.key === 'ArrowUp') { if (G.mode === 'run') fanService(); e.preventDefault() } })
addEventListener('keyup', e => { const k = KEYS[e.key]; if (k) inp[k] = false })
addEventListener('blur', () => { inp.L = inp.R = inp.hL = inp.hR = false })

function applyLang() {
  const t = T()
  document.documentElement.lang = lang
  document.title = lang === 'ja' ? '着ぐるみ、頭が取れたら終わり｜ゆるキャラの中の人が逃げるバカゲー' : 'Mascot Head Off | Run from mad fans in a mascot suit'
  $('tA').textContent = t.titleA; $('tB').textContent = t.titleB; $('tSub').textContent = t.sub
  $('bStart').textContent = t.start; $('bHow').textContent = t.how; $('bLang').textContent = t.lang
  $('hT').textContent = t.howTitle; ['how1', 'how2', 'how3', 'how4', 'how5'].forEach((k, i) => $('h' + (i + 1)).textContent = t[k])
  $('hCr').textContent = t.credit; $('bHowClose').textContent = t.back
  $('lbRun').textContent = t.lbRun; $('lbHead').textContent = t.lbHead; $('lbGift').textContent = t.lbGift
  $('pT').textContent = t.pause; $('bResume').textContent = t.resume
  $('bAgain').textContent = t.again; $('bShare').textContent = t.share; $('bSave').textContent = t.save
  $('ldTxt').textContent = t.loading
  $('tBest').textContent = getBest() ? `${t.best} ${getBest()}${t.m}` : ''
  document.querySelector('.band').textContent = lang === 'ja' ? 'ゆるキャラ 脱出劇' : 'MASCOT ESCAPE'
  if (G.mode === 'result') drawCard()
}
$('bLang').addEventListener('click', () => { lang = lang === 'ja' ? 'en' : 'ja'; try { localStorage.setItem('kg_lang', lang) } catch (e) {} applyLang() })
$('bStart').addEventListener('click', () => { Snd.init(); startRun(); setCamTarget(0, 1.1) })
$('bHow').addEventListener('click', () => { $('how').hidden = false })
$('bHowClose').addEventListener('click', () => { $('how').hidden = true })
$('bAgain').addEventListener('click', () => { Snd.init(); $('result').hidden = true; startRun(); G.camS = 1; setCamTarget(0, 1.1) })
$('bPause').addEventListener('click', () => { if (G.mode === 'run') { G.paused = true; $('pauseS').hidden = false } })
$('bResume').addEventListener('click', () => { G.paused = false; $('pauseS').hidden = true })
$('bMute').addEventListener('click', () => { G.muted = !G.muted; Snd.setMute(G.muted); $('bMute').classList.toggle('off', G.muted); try { localStorage.setItem('kg_mute', G.muted ? '1' : '') } catch (e) {} })
$('bShare').addEventListener('click', () => {
  const t = T().shareText(G.final || 0, rankOf(G.final || 0))
  const u = 'https://x.com/intent/post?text=' + encodeURIComponent(t) + '&url=' + encodeURIComponent('https://tom3games.github.io/kigurumi-run/')
  window.open(u, '_blank', 'noopener')
})
$('bSave').addEventListener('click', () => {
  $('cv').toBlob(b => {
    if (!b) return
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'kigurumi-run.png'; document.body.appendChild(a); a.click(); a.remove()
    const s = $('bSave'); const old = s.textContent; s.textContent = T().copied; setTimeout(() => { s.textContent = old }, 1400)
  })
})

// ============================================================ 起動
async function boot() {
  applyLang()
  try { if (localStorage.getItem('kg_mute')) { G.muted = true; Snd.setMute(true); $('bMute').classList.add('off') } } catch (e) {}
  await loadAll
  buildFans()
  G.mode = 'title'
  resetRun(); G.mode = 'title'
  G.camS = 1; G.camTween = null
  placeHorde(0); setAmbTitle()
  $('hud').hidden = true
  render()
  setTimeout(() => { $('loading').hidden = true; $('title').hidden = false; window.__kgReady = true }, 250)
  requestAnimationFrame(frame)
  const demo = qs.get('demo')
  if (demo) setTimeout(() => { startRun(); setCamTarget(0, 0.5); if (demo === 'pop') setTimeout(() => { P.h = 1.05 }, 4500) }, 600)
}
function setAmbTitle() { /* 音は最初の操作の後 */ }
boot().catch(e => { console.error(e); const d = document.createElement('div'); d.id = 'boot-err'; d.textContent = 'boot: ' + e.message; document.body.appendChild(d) })

// ============================================================ 検証用の窓口
window.kg = {
  G, P, HORDE, inp, fans, get perf() { return perf }, get costume() { return costume }, R,
  pause(v = true) { dbgPause = !!v }, step(n = 1) { for (let i = 0; i < n; i++) { simStep(STEP); updateCamera(STEP) } updateHud(); render() },
  seed(s) { rnd = mulberry(s) },
  start() { startRun(); G.camS = 0; G.camTween = null },
  pop() { P.h = 1.05 },
  rank: rankOf,
  frames: () => frames,
  scene, camera, renderer, THREE,
  fanService, spawn: (t, x, dz, v) => fanSpawn(t, x, P.z - dz, v),
  proj(id) { const el = $(id).getBoundingClientRect(); return { x: el.x + el.width / 2, y: el.y + el.height / 2, w: el.width } },
}
