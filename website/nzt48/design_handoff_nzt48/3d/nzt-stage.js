// NZT48 V1 stage: one persistent 3D bottle that travels between [data-nzt-anchor] slots as the page scrolls,
// over a full-screen amber smoke shader whose light follows the bottle.
// Anchor attributes: data-ry (yaw deg), data-tilt (roll deg), data-open (0-1 cap), data-pills (0-1),
// data-fit (bottle height / slot height), data-scrub (extra yaw deg across the slot's parent), data-out="right".
import * as THREE from './vendor/three.module.min.js';
import { setupNZTStudio } from './studio-lighting.js?v=v2-20261017d';
import { loadNZT } from './nzt-model.js?v=v2-20261017d';
import { setupGoldStudio } from './gold-studio.js?v=v2-20261017d';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * t * (t * (t * 6 - 15) + 10);
const D2R = Math.PI / 180, TAU = Math.PI * 2;
const wrapPi = a => a - TAU * Math.round(a / TAU);

// One physical scale per viewport. Scroll changes position and orientation only.
export function stageBottleHeight(width, height) {
  if (width < 820) return Math.min(height * .5, width * .8, 440); // phones: about 1.8x the old size, the bottle leads the screen
  return Math.min(360, height * .39, width * .27);
}

const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
const FRAG = `precision highp float;
uniform vec2 uR;uniform float uT;uniform vec3 uG;uniform float uS;uniform float uA;uniform vec4 uP;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int k=0;k<5;k++){v+=a*n(p);p=p*2.02+vec2(1.7,9.2);a*=.5;}return v;}
void main(){
  vec2 fc=gl_FragCoord.xy;vec2 uv=fc/uR.y;
  vec2 gp=uG.xy/uR.y;float gs=max(uG.z/uR.y,.05);
  vec2 dv=(uv-gp)/gs;dv.y*=.75;float d=length(dv);
  vec2 q=uv*1.35+vec2(0.,uS*.55);
  float w=fbm(q*1.2+vec2(uT*.018,-uT*.012));
  float sm=fbm(q+vec2(w*1.7,w*.9)+vec2(uT*.028,uT*.008));
  float halo=exp(-d*d*.85)*uA,core=exp(-d*d*4.5)*uA;
  vec3 c=vec3(.03,.029,.034);
  c+=vec3(.95,.55,.12)*halo*(.05+.34*sm*sm);
  c+=vec3(1.,.78,.38)*core*.07;
  c+=vec3(.5,.3,.1)*smoothstep(.56,.98,sm)*.09;
  if(uP.w>.002){
    vec2 pp=uP.xy/uR.y;float ps=uP.z/uR.y;vec2 q2=uv-pp;
    float top=uR.x/uR.y>0.?1.:1.;float tt=max(top-uv.y,0.);
    float bw=ps*.1+tt*.3;
    float beam=exp(-pow(q2.x/bw,2.))*smoothstep(pp.y-ps*.9,pp.y+ps*.2,uv.y);
    float flick=.6+.4*fbm(vec2(q2.x*7.,uv.y*2.-uT*.15));
    float pool=exp(-dot(q2,q2)/(ps*ps)*2.2);
    float floorg=exp(-pow(q2.x/(ps*.9),2.))*exp(-pow((q2.y+ps*.95)/(ps*.07),2.));
    float streak=exp(-pow(q2.y/(ps*.018),2.))*exp(-abs(q2.x)/(ps*1.4));
    vec2 g=uv*vec2(52.)+vec2(sin(uT*.2)*.6,-uT*.35);vec2 id=floor(g);vec2 fq=fract(g)-.5;float r=h(id);
    float mote=smoothstep(.09,0.,length(fq-(vec2(h(id+3.1),h(id+7.3))-.5)*.6))*step(.83,r)*(.45+.55*sin(uT*1.7+r*40.));
    vec3 L=vec3(1.,.74,.32)*beam*flick*.24+vec3(1.,.66,.22)*pool*.2+vec3(1.,.86,.55)*streak*.22+vec3(.95,.62,.2)*floorg*.18+vec3(1.,.85,.55)*mote*(beam*1.6+pool*.9);
    c=mix(c,c*.55,uP.w*(1.-pool))+L*uP.w;
  }
  vec2 v=fc/uR-.5;c*=1.-dot(v,v)*.85;
  c+=(h(fc+fract(uT*.7)*91.)-.5)*.028;
  gl_FragColor=vec4(max(c,0.),1.);
}`;

function makeBg() {
  const c = document.createElement('canvas');
  c.setAttribute('aria-hidden', 'true');
  Object.assign(c.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', zIndex: '-1', pointerEvents: 'none' });
  const gl = c.getContext('webgl', { antialias: false, depth: false, alpha: false, preserveDrawingBuffer: true });
  if (!gl) return null;
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(pr); gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = n => gl.getUniformLocation(pr, n), uR = U('uR'), uT = U('uT'), uG = U('uG'), uS = U('uS'), uA = U('uA'), uP = U('uP');
  const scale = .5;
  const resize = () => { c.width = Math.ceil(innerWidth * scale); c.height = Math.ceil(innerHeight * scale); gl.viewport(0, 0, c.width, c.height); };
  resize();
  document.body.prepend(c);
  return {
    resize,
    render(t, gx, gy, gs, s, a, px = 0, py = 0, pz = 0, pw = 0) {
      gl.uniform2f(uR, c.width, c.height); gl.uniform1f(uT, t);
      gl.uniform3f(uG, gx * scale, (innerHeight - gy) * scale, gs * scale);
      gl.uniform1f(uS, s); gl.uniform1f(uA, a);
      gl.uniform4f(uP, px * scale, (innerHeight - py) * scale, pz * scale, pw);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() { c.remove(); }
  };
}

function setupReveal(cleanup) {
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.style.opacity = '1'; e.target.style.transform = 'none'; io.unobserve(e.target);
  }), { rootMargin: '0px 0px -6% 0px' });
  const arm = () => document.querySelectorAll('[data-reveal]:not([data-reveal-armed])').forEach(el => {
    el.setAttribute('data-reveal-armed', '');
    if (el.getBoundingClientRect().top < innerHeight) return;
    el.style.opacity = '0'; el.style.transform = 'translateY(28px)';
    el.style.transition = 'opacity .9s cubic-bezier(.2,.7,.2,1), transform .9s cubic-bezier(.2,.7,.2,1)';
    io.observe(el);
  });
  arm();
  const iv = setInterval(arm, 1200);
  cleanup.push(() => { clearInterval(iv); io.disconnect(); });
}

function readAnchors() {
  const out = [], vc = innerHeight / 2;
  for (const el of document.querySelectorAll('[data-nzt-anchor]')) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const d = el.dataset;
    const h = stageBottleHeight(innerWidth, innerHeight);
    let ry = (+d.ry || 0) * D2R;
    if (d.scrub) {
      const p = el.parentElement.getBoundingClientRect();
      ry += (+d.scrub) * D2R * clamp((vc - p.top - r.height / 2) / Math.max(1, p.height - r.height));
    }
    out.push({
      cx: d.out === 'right' ? innerWidth + h * .95 : r.left + r.width / 2,
      cy: r.top + r.height / 2, top: r.top + scrollY, h, ry,
      tilt: (+d.tilt || 0) * D2R, open: +d.open || 0, pills: +d.pills || 0, solo: +d.solo || 0, arm: d.bottling === '1' ? 1 : 0, bottle: 1, glow: 1
    });
  }
  return out.sort((a, b) => a.top - b.top);
}

export function mountStage(opts = {}) {
  if (window.__nztStage) window.__nztStage.dispose();
  const base = opts.base || './3d/';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cleanup = [];
  const api = { force: null, ready: false };
  let alive = true, raf = 0, three = null, mx = 0, my = 0, px = -1e4, py = -1e4, aspect = .62, primed = false;

  let bg = null;
  // Background shader removed by request; the page background stays flat.
  if (bg) cleanup.push(() => bg.dispose());
  if (!reduced) setupReveal(cleanup);
  // Soft warm glow behind the bottle (under page content, follows the bottle, flares during bottling).
  const halo = document.createElement('div');
  halo.setAttribute('aria-hidden', 'true');
  Object.assign(halo.style, { position: 'fixed', left: '0', top: '0', width: '100px', height: '100px', zIndex: '0', pointerEvents: 'none', borderRadius: '50%', opacity: '0', willChange: 'transform,opacity',
    background: 'radial-gradient(closest-side, rgba(255,200,92,.42), rgba(244,170,48,.2) 38%, rgba(200,120,20,.07) 68%, rgba(0,0,0,0))', filter: 'blur(8px)' });
  document.body.prepend(halo);
  cleanup.push(() => halo.remove());
  let haloBoost = 0;

  // Drag to spin: grab the bottle, it turns with your hand and eases back to its pose on release.
  const drag = { yaw: 0, pitch: 0, vy: 0, vp: 0, on: false, x: 0, y: 0, t: 0 };
  const grip = document.createElement('div');
  grip.setAttribute('aria-hidden', 'true');
  Object.assign(grip.style, { position: 'fixed', left: '0', top: '0', width: '100px', height: '100px', zIndex: '4', cursor: 'grab', touchAction: 'pan-y', borderRadius: '42%', display: 'none' });
  document.body.appendChild(grip);
  grip.addEventListener('pointerdown', e => { drag.on = true; drag.x = e.clientX; drag.y = e.clientY; drag.t = e.timeStamp; drag.vy = drag.vp = 0; grip.setPointerCapture(e.pointerId); grip.style.cursor = 'grabbing'; });
  grip.addEventListener('pointermove', e => {
    if (!drag.on) return;
    const dt = Math.max(.008, (e.timeStamp - drag.t) / 1000), dx = (e.clientX - drag.x) * .011, dy = (e.clientY - drag.y) * .005;
    drag.yaw += dx; drag.pitch = clamp(drag.pitch + dy, -.45, .45);
    drag.vy = dx / dt; drag.vp = dy / dt; drag.x = e.clientX; drag.y = e.clientY; drag.t = e.timeStamp;
  });
  const release = () => {
    if (!drag.on) return;
    drag.on = false; grip.style.cursor = 'grab';
    drag.yaw = wrapPi(drag.yaw); // spring back the short way
    if (performance.now() - drag.t > 90) drag.vy = drag.vp = 0; // held still before letting go: no fling
    drag.vy = clamp(drag.vy, -12, 12); drag.vp = clamp(drag.vp, -4, 4);
  };
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) grip.addEventListener(ev, release);
  cleanup.push(() => grip.remove());

  const onPM = e => { px = e.clientX; py = e.clientY; mx = px / innerWidth * 2 - 1; my = py / innerHeight * 2 - 1; };
  addEventListener('pointermove', onPM, { passive: true });
  cleanup.push(() => removeEventListener('pointermove', onPM));
  const onResize = () => { bg && bg.resize(); three && three.resize(); };
  addEventListener('resize', onResize);
  cleanup.push(() => removeEventListener('resize', onResize));

  const cur = { x: innerWidth * .72, y: innerHeight * .5, h: innerHeight * .6, ry: 0, tilt: 0, open: 0, pills: 0, solo: 0, arm: 0, bottle: 1, glow: 1 };

  function target() {
    const A = readAnchors();
    if (!A.length) return null;
    const vc = innerHeight / 2, L = A[A.length - 1];
    if (innerWidth < 820) { // phones: no side room to travel through, so the bottle lives in its nearest slot and scrolls with it
      let n = A[0]; for (const s of A) if (Math.abs(s.cy - vc) < Math.abs(n.cy - vc)) n = s;
      const o = { h: stageBottleHeight(innerWidth, innerHeight), tilt: n.tilt, open: n.open, pills: n.pills, solo: n.solo, arm: n.arm, bottle: n.bottle, glow: n.glow };
      o.ry = n.ry + (vc - n.cy) * .0025; o.x = n.cx; o.y = n.cy; o.pin = 1; // gentle turn as the slot passes
      return api.force ? Object.assign(o, api.force) : o;
    }
    let a = A[0], b = A[0], t = 0;
    if (vc >= L.cy) a = b = L;
    else if (vc > A[0].cy) for (let i = 0; i < A.length - 1; i++) {
      if (vc >= A[i].cy && vc <= A[i + 1].cy) { a = A[i]; b = A[i + 1]; t = (vc - a.cy) / Math.max(1, b.cy - a.cy); break; }
    }
    const e = smooth(clamp((t - .14) / .72));
    const o = {};
    for (const k of ['h', 'tilt', 'open', 'pills', 'solo', 'arm', 'bottle', 'glow']) o[k] = lerp(a[k], b[k], e);
    // Shortest way round between slots, so scrolling never adds a full extra spin.
    o.ry = a.ry + wrapPi(b.ry - a.ry) * e;
    o.h = stageBottleHeight(innerWidth, innerHeight);
    const headerBottom = document.querySelector('header')?.getBoundingClientRect().bottom || 72;
    o.x = lerp(a.cx, b.cx, e);
    // Reserve the full cap-open envelope before the animation starts. Never
    // resize the bottle to fit a section. Dense content has a smooth side exit.
    o.y = clamp(lerp(a.cy, b.cy, e), headerBottom + 24 + o.h * (.56 + .24 * o.arm), innerHeight - 28 - o.h * .57);
    // Past the last slot (the finale) the bottle stays in its section and scrolls away with it.
    if (vc >= L.cy && L.arm) o.y = L.cy;
    return api.force ? Object.assign(o, api.force) : o;
  }

  async function initThree() {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', zIndex: '3', pointerEvents: 'none', opacity: '1' });
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    renderer.physicallyCorrectLights = true;
    renderer.setClearColor(0x000000, 0);
    const dpr = () => Math.min(window.devicePixelRatio || 1, innerWidth < 820 ? 1.5 : 2);
    renderer.setPixelRatio(dpr()); renderer.setSize(innerWidth, innerHeight, false);
    const scene = new THREE.Scene();
    const studio = setupNZTStudio(renderer, scene);
    renderer.toneMappingExposure = 1.12;
    const camera = new THREE.PerspectiveCamera(20, innerWidth / innerHeight, .1, 50);
    camera.position.set(0, 0, 4);
    // Contact shadow disc under the bottle, fades with the bottle's lean.
    const shadowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const r = g.createRadialGradient(128, 128, 10, 128, 128, 128); r.addColorStop(0, 'rgba(0,0,0,.5)'); r.addColorStop(.55, 'rgba(0,0,0,.32)'); r.addColorStop(.8, 'rgba(0,0,0,.08)'); /* tight footprint under the base */ r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 256, 256); const t = new THREE.CanvasTexture(c); return t; })();
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, toneMapped: false }));
    shadow.renderOrder = -1; scene.add(shadow);
    cleanup.push(() => { shadow.geometry.dispose(); shadow.material.dispose(); shadowTex.dispose(); }); camera.lookAt(0, 0, 0);
    const product = await loadNZT(scene, { bottleUrl: base + 'nzt48-bottle-cap-v2.glb?v=v2-20261017d', pillUrl: base + 'nzt48-gold-pill-pbr.glb' });
    if (!alive) { product.dispose(); studio.dispose(); renderer.dispose(); return null; }
    const bottleEnv = scene.environment;
    const goldStudio = setupGoldStudio(renderer, scene);
    scene.environment = bottleEnv;
    renderer.toneMappingExposure = 1.0;
    cleanup.push(() => goldStudio.dispose());
    // The approved PBR capsule already contains the doubled dimensions in meters.
    // Clone the loader's single template; no baked capsule or second GLB request.
    const makePill = parent => {
      const holder = new THREE.Group();
      product.createPill(holder);
      parent.add(holder);
      return holder;
    };

    const model = product.model;
    model.rotation.set(0, 0, 0); product.resetCap();
    const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
    const H = size.y; aspect = Math.max(size.x, size.z) / H;
    // Bottling sequence geometry: mouth height (in bottle heights from centre) and cap-local units per bottle height.
    const capBox = new THREE.Box3().setFromObject(product.cap);
    const mouthY = (capBox.min.y - ctr.y) / H;
    const capUnit = H / product.cap.parent.getWorldScale(new THREE.Vector3()).y;
    const composition = new THREE.Group(); scene.add(composition);
    const pivot = new THREE.Group(), yawG = new THREE.Group();
    composition.add(pivot); pivot.add(yawG); yawG.add(model); model.position.sub(ctr);

    const pillsG = new THREE.Group(); composition.add(pillsG);
    const ORBIT = [[-.64, .30, .25], [.64, .02, .32], [-.54, -.40, -.35], [.52, .46, -.42], [.10, .80, -.22], [-.80, -.08, -.6], [.74, -.46, .06]];
    const SPILL = [[-.30, .64, .18], [.02, .80, .26], [.31, .67, .12], [-.17, .95, -.06], [.25, .97, -.1], [-.47, .84, -.25], [.47, .82, -.2]];
    const pills = ORBIT.map((o, i) => {
      const obj = makePill(pillsG), mats = [];
      obj.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.envMap = goldStudio.texture; m.material.envMapIntensity = .35; m.material.transparent = true; m.material.opacity = 0; mats.push(m.material); } });
      obj.visible = false;
      return { obj, mats, v: 0, spin: 0, init: false, pos: new THREE.Vector3(), o, s: SPILL[i], b: new THREE.Euler(i * 1.3, i * 2.1, .4 + i * .7), spd: (.07 + (i % 3) * .035) * (i % 2 ? 1 : -1) };
    });

    const tv = new THREE.Vector3();
    const key = new THREE.PointLight(0xffc56a, 0, 0, 2), rim = new THREE.PointLight(0xffe2b0, 0, 0, 2);
    scene.add(key, rim);
    let orbA = 0, lastT = 0, nextStrike = 2.5 + Math.random() * 3, nextRush = 0;
    // "Genie" bottling timeline (seconds from arrival at the data-bottling anchor):
    // lean into the hand → cap unscrews and swings aside, tilted → one lead capsule dives in →
    // the rest rush in a left-to-right spiral with lightning → cap swings back and seals → one spin → rests.
    const HAND = .2, CAP0 = .4, CAP1 = 1.6, CLOSE0 = 4.6, CLOSE1 = 5.6, SP0 = 5.6, SP1 = 7.2;
    const pillStart = i => i ? 2.3 + (i - 1) * .1 : 1.5, pillDur = i => i ? 1.6 : 1.3;
    const RUSH_END = pillStart(pills.length - 1) + pillDur(pills.length - 1);
    const easeOut = t => 1 - Math.pow(1 - t, 3);
    const seq = { t0: -1, yawOff: 0, lastYaw: 0 };
    const yAxis = new THREE.Vector3(0, 1, 0), capOff = new THREE.Vector3(), capE = new THREE.Euler(), capTilt = new THREE.Quaternion(), yawQ = new THREE.Quaternion();

    // ---- Finale FX: lightning arcs, twinkles, an orbiting sparkle trail and a glow on the lead capsule. ----
    const spriteTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
      const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.18, 'rgba(255,236,190,.85)'); r.addColorStop(.5, 'rgba(255,190,90,.18)'); r.addColorStop(1, 'rgba(255,170,60,0)');
      g.fillStyle = r; g.fillRect(0, 0, 64, 64);
      g.fillStyle = 'rgba(255,240,200,.55)'; g.fillRect(31, 6, 2, 52); g.fillRect(6, 31, 52, 2);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    const fx = o => Object.assign(o, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    function makePoints(n) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial(fx({ map: spriteTex, vertexColors: true, size: .02 })));
      pts.frustumCulled = false; return pts;
    }
    const TWN = 46, RING = 180, twinkles = makePoints(TWN), ring = makePoints(RING);
    pillsG.add(twinkles, ring);
    const twk = Array.from({ length: TWN }, () => { const a = Math.random() * TAU, r = .45 + Math.random() * .5; return { x: Math.cos(a) * r, y: -.55 + Math.random() * 1.4, z: Math.sin(a) * r, f: 1.2 + Math.random() * 2.6, ph: Math.random() * TAU }; });
    twk.forEach((q, i) => twinkles.geometry.attributes.position.setXYZ(i, q.x * H, q.y * H, q.z * H));
    const ringTilt = new THREE.Euler(.38, 0, -.22), rv = new THREE.Vector3();
    const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial(fx({ map: spriteTex, color: 0xffd27a, opacity: 0 })));
    scene.add(glowSprite);
    // Lightning: a thin jagged stroke that shoots out of a capsule into the bottle (power being delivered),
    // with a few finer forks and a small spark where it lands. Never more than two at once.
    const SEG = 18, BSEG = 7, NBR = 3, CORE_OP = 1, GLOW_OP = .14, FORK_OP = .8;
    function ribbon(n, color) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
      const idx = []; for (let j = 0; j < n - 1; j++) { const a = j * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(idx);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial(fx({ color, opacity: 0, depthTest: false, side: THREE.DoubleSide })));
      m.frustumCulled = false; m.visible = false; m.renderOrder = 5; scene.add(m); return m;
    }
    const bolts = Array.from({ length: 2 }, () => {
      const flash = new THREE.Sprite(new THREE.SpriteMaterial(fx({ map: spriteTex, color: 0xffe2a0, opacity: 0 }))); scene.add(flash);
      return { core: ribbon(SEG, 0xfff4d6), glow: ribbon(SEG, 0xffbf55), forks: Array.from({ length: NBR }, () => ribbon(BSEG, 0xffe9b8)), flash, on: false, t0: 0, dur: .3, seed: 0, src: -1 };
    });
    const boltMeshes = b => [b.core, b.glow, ...b.forks];
    cleanup.push(() => {
      spriteTex.dispose(); glowSprite.material.dispose();
      for (const o of [twinkles, ring]) { o.geometry.dispose(); o.material.dispose(); }
      for (const b of bolts) { for (const m of boltMeshes(b)) { m.geometry.dispose(); m.material.dispose(); } b.flash.material.dispose(); }
    });
    const hash = x => { const q = Math.sin(x * 127.1 + 311.7) * 43758.5453; return q - Math.floor(q); };
    const A3 = new THREE.Vector3(), B3 = new THREE.Vector3(), P3 = new THREE.Vector3(), D3 = new THREE.Vector3(), E3 = new THREE.Vector3(), perp = new THREE.Vector3();
    const pts = Array.from({ length: SEG }, () => new THREE.Vector3()), fpts = Array.from({ length: BSEG }, () => new THREE.Vector3());
    function writeRibbon(m, list, n, width, opacity) {
      const pos = m.geometry.attributes.position;
      for (let j = 0; j < n; j++) {
        const p = list[j], q = list[Math.min(j + 1, n - 1)], o = list[Math.max(j - 1, 0)];
        perp.set(o.y - q.y, q.x - o.x, 0); if (perp.lengthSq() < 1e-14) perp.set(0, 1, 0); perp.normalize();
        const w = width * (1 - .6 * j / (n - 1));
        pos.setXYZ(j * 2, p.x + perp.x * w, p.y + perp.y * w, p.z);
        pos.setXYZ(j * 2 + 1, p.x - perp.x * w, p.y - perp.y * w, p.z);
      }
      pos.needsUpdate = true; m.material.opacity = opacity; m.visible = opacity > .003;
    }
    function hideBolt(bo) { for (const mm of boltMeshes(bo)) mm.visible = false; bo.flash.material.opacity = 0; }
    function startBolt(src, t0, dur = .32) {
      const bo = bolts.find(x => !x.on); if (!bo) return;
      Object.assign(bo, { on: true, t0, dur, seed: Math.random() * 1000, src });
    }
    // Draws one bolt from a to b for this frame and returns its brightness (0 once it has finished).
    function drawBolt(bo, a, b, width, time) {
      const age = time - bo.t0;
      if (age < 0) { hideBolt(bo); return 0; }
      if (age > bo.dur) { bo.on = false; hideBolt(bo); return 0; }
      const tick = Math.floor(age / .055), reveal = smooth(clamp(age / .08)); // shoots from the capsule to the bottle in 80 ms
      const fade = (1 - smooth(clamp((age - bo.dur * .55) / (bo.dur * .45)))) * (.65 + .35 * hash(bo.seed + tick * 7.7));
      D3.subVectors(b, a); const len = D3.length() || 1;
      E3.set(-D3.y, D3.x, 0); if (E3.lengthSq() < 1e-14) E3.set(0, 1, 0); E3.normalize();
      for (let j = 0; j < SEG; j++) {
        const t = j / (SEG - 1) * reveal;
        pts[j].lerpVectors(a, b, t).addScaledVector(E3, (hash(bo.seed + tick * 13.7 + j * 1.93) - .5) * .22 * len * Math.sin(Math.PI * t));
      }
      writeRibbon(bo.core, pts, SEG, width, CORE_OP * fade);
      writeRibbon(bo.glow, pts, SEG, width * 3, GLOW_OP * fade);
      const dx = D3.x / len, dy = D3.y / len;
      bo.forks.forEach((fk, k) => {
        const j0 = 3 + Math.floor(hash(bo.seed + k * 3.1) * (SEG - 8));
        if (j0 / (SEG - 1) > reveal) { fk.visible = false; return; }
        const ang = (k % 2 ? 1 : -1) * (.45 + .45 * hash(bo.seed + k * 5.3)), ca = Math.cos(ang), sa = Math.sin(ang), fl = len * (.1 + .16 * hash(bo.seed + k * 9.1));
        const fxd = dx * ca - dy * sa, fyd = dx * sa + dy * ca;
        for (let i = 0; i < BSEG; i++) {
          const t = i / (BSEG - 1), jag = (hash(bo.seed + tick * 5.1 + k * 17 + i * 2.7) - .5) * .35 * fl * Math.sin(Math.PI * t);
          fpts[i].copy(pts[j0]).add(P3.set((fxd - fyd * jag / fl) * fl * t, (fyd + fxd * jag / fl) * fl * t, 0));
        }
        writeRibbon(fk, fpts, BSEG, width * .55, FORK_OP * fade);
      });
      bo.flash.material.opacity = reveal >= 1 ? .55 * fade : 0;
      if (reveal >= 1) { bo.flash.position.copy(b); bo.flash.scale.setScalar(width * (16 + 8 * hash(bo.seed + tick))); }
      return fade;
    }

    function pose(c, time, ie) {
      const vh = 2 * 4 * Math.tan(10 * D2R), k = vh / innerHeight;
      const s = stageBottleHeight(innerWidth, innerHeight) * k / H, W = H * s;
      const idle = reduced ? 0 : 1;
      const dt = Math.min(.05, Math.max(0, time - lastT)); lastT = time;
      if (c.arm > .95 && !reduced && ie > .99) { if (seq.t0 < 0) seq.t0 = time; }
      else if (c.arm < .4 && seq.t0 >= 0) { seq.t0 = -1; seq.yawOff = ((seq.lastYaw % TAU) + TAU + Math.PI) % TAU - Math.PI; }
      const st = seq.t0 >= 0 ? time - seq.t0 : -1;
      seq.yawOff *= Math.exp(-dt * 2.5);
      // Settle: bob and sway ease out on arrival, return gently once the spin is done.
      const calm = st >= 0 ? Math.min(1, 1 - smooth(clamp(st / .9)) + smooth(clamp((st - 7) / 1.6))) : 1;
      // Hand-held lean toward the incoming capsules; back to the slot's lean after the seal.
      const hand = st >= 0 ? smooth(clamp(st / 1.1)) * (1 - smooth(clamp((st - CLOSE1) / 1.4))) : 0;
      const tilt = lerp(c.tilt, HAND, hand);
      const seal = st >= 0 ? Math.exp(-Math.pow((st - CLOSE1) / .14, 2)) : 0;
      // Drifts a little left as the cap opens, then glides back right while the capsules pour in.
      const sweep = st >= 0 ? -.07 * smooth(clamp(st / .8)) * (1 - smooth(clamp((st - 1.5) / 3.2))) : 0;
      const bob = Math.sin(time * .9) * c.h * .012 * idle * calm - seal * c.h * .012;
      pivot.position.set((c.x - innerWidth / 2) * k + sweep * W, -(c.y - innerHeight / 2) * k + bob * k, 0);
      pivot.scale.setScalar(s);
      pivot.rotation.set(my * .06 * idle + .04 + drag.pitch, 0, tilt + Math.sin(time * .6) * .018 * idle * calm);
      shadow.position.set(pivot.position.x + Math.sin(pivot.rotation.z) * .1, pivot.position.y - W * .515 - bob * k * .5, -.05);
      shadow.scale.set(W * .6, W * .085, 1); // as wide as the bottle base, a thin flat ellipse
      shadow.material.opacity = ie * (1 - Math.min(1, Math.abs(tilt) * 2.2)) * .45;
      let sy = 0;
      if (st >= 0) {
        sy = -.55 * smooth(clamp((st - 1) / 3.3)) * (1 - smooth(clamp((st - 4.6) / 2))) - TAU * easeOut(clamp((st - SP0) / (SP1 - SP0)));
        seq.lastYaw = sy;
      }
      yawG.rotation.y = c.ry + sy + seq.yawOff + drag.yaw + (Math.sin(time * .45) * .12 * calm + mx * .2) * idle;
      let swing = 0;
      if (st >= 0) {
        const openP = smooth(clamp((st - CAP0) / (CAP1 - CAP0))) * (1 - smooth(clamp((st - CLOSE0) / (CLOSE1 - CLOSE0))));
        product.setCapOpening(clamp(openP / .45) * .42); // unscrew only; the swing below lifts it clear
        swing = smooth(clamp((openP - .4) / .6));
        // Up and out to the right of the mouth (in the bottle's lean frame, not its spin), tilted like a flipped lid.
        yawQ.setFromAxisAngle(yAxis, -yawG.rotation.y);
        capOff.set(.48, .32 + Math.sin(time * 1.6) * .012, .1).multiplyScalar(swing * capUnit).applyQuaternion(yawQ);
        product.cap.position.add(capOff);
        capTilt.setFromEuler(capE.set(.3 * swing, 0, -1.05 * swing));
        capTilt.premultiply(yawQ).multiply(yawQ.invert());
        product.cap.quaternion.premultiply(capTilt);
      } else product.resetCap();
      pillsG.position.copy(pivot.position); pillsG.scale.setScalar(s);
      pillsG.rotation.set(pivot.rotation.x, 0, pivot.rotation.z * (st >= 0 ? smooth(clamp(st / .9)) : 0));
      let pulse = 0;
      if (st >= 0) for (let i = 0; i < pills.length; i++) { const u = clamp((st - pillStart(i)) / pillDur(i)); pulse = Math.max(pulse, Math.exp(-Math.pow((u - .9) / .08, 2))); }
      orbA += dt * .05 * idle;
      const ca = Math.cos(orbA), sa = Math.sin(orbA);
      const want = Math.round(c.pills * pills.length);
      const kf = 1 - Math.exp(-dt * 2.4), kp = 1 - Math.exp(-dt * 2.8);
      const m = mouthY * H;
      // How close the pointer is to the bottle (1 while dragging): makes the occasional lightning a little more frequent.
      const near = drag.on ? 1 : 1 - clamp((Math.hypot(px - c.x, py - c.y) - c.h * .55) / (c.h * .9));
      pills.forEach((p, i) => {
        const pst = pillStart(i), dur = pillDur(i), lead = i === 0;
        if (st >= pst) {
          if (!p.vx) p.vx = { start: p.pos.clone(), v: p.v, jr: (hash(i * 7.1) - .5) * .08, jy: (hash(i * 3.3) - .5) * .06 };
          const u = clamp((st - pst) / dur), w = clamp((u - .15) / .85), b = smooth(clamp(u / .35));
          // Spiral funnel: enters from the left, sweeps across the front, tightens and dives into the mouth.
          const r = ((lead ? .5 : .6) + p.vx.jr) * H * Math.pow(1 - w, 1.2);
          const a = Math.PI - w * TAU * 1.15;
          const y = m + ((lead ? .5 : .55) + p.vx.jy) * H * Math.pow(1 - w, 1.1) - .1 * H * smooth(clamp((u - .85) / .15));
          tv.set(Math.cos(a) * r, y, Math.sin(a) * r);
          p.pos.lerpVectors(p.vx.start, tv, b);
          p.obj.position.copy(p.pos);
          p.spin += dt * (2 + u * 7);
          const up = smooth(clamp((u - .55) / .3));
          p.obj.rotation.set(lerp(p.b.x, 0, up), p.b.y + p.spin, lerp(p.b.z, Math.PI / 2, up));
          p.obj.scale.setScalar((lead ? 1.25 : 1) * (1 - .65 * smooth(clamp((u - .78) / .22))));
          p.v = Math.max(p.vx.v, smooth(clamp(u / .15))) * (1 - smooth(clamp((u - .9) / .1)));
          p.obj.visible = p.v > .004;
          for (const mm of p.mats) mm.opacity = p.v;
          p.flight = u;
          return;
        }
        p.flight = -1;
        if (p.vx) { p.vx = null; if (st < 0) p.v = 0; }
        if (st >= 0 && st > RUSH_END) return;
        const so = i ? 0 : c.solo;
        const tgt = i < want && (i === 0 || c.solo < .5) ? ie : 0;
        p.v += (tgt - p.v) * (p.init ? kf : 1);
        p.obj.visible = p.v > .004;
        const spread = 1 + .3 * swing; // waiting capsules make room for the swung-out cap
        const ox = (p.o[0] * ca - p.o[2] * sa) * spread, oz = (p.o[0] * sa + p.o[2] * ca) * spread;
        const f = Math.sin(time * .6 + i * 1.7) * .025 * idle;
        tv.set(lerp(ox, -.34, so) * H, (lerp(p.o[1], -.1, so) + f) * H, lerp(oz, .6, so) * H);
        if (!p.init) { p.pos.copy(tv); p.init = true; } else p.pos.lerp(tv, kp);
        p.obj.position.copy(p.pos);
        p.spin += dt * lerp(p.spd, .2, so) * (reduced ? 0 : 1);
        p.obj.rotation.set(lerp(p.b.x + p.spin * .2, .14, so), p.b.y + p.spin, lerp(p.b.z, Math.PI / 2 - .3, so));
        p.obj.scale.setScalar((.85 + .15 * p.v) * (1 + so * 1.5));
        for (const mm of p.mats) mm.opacity = p.v;
      });

      // Lightning is a surprise, not a show: now and then one floating capsule (rarely two) shoots power into the
      // bottle, a little more often while you're near it. In the finale the lead capsule and a few of the rushing
      // ones fire into the mouth. Never more than two bolts at once.
      composition.updateMatrixWorld(true);
      if (!reduced) {
        if ((st < 0 || st > RUSH_END) && time >= nextStrike) {
          // Only capsules off to the side with clear air to the bottle, so the bolt reads.
          const br = aspect * H * .5;
          const live = pills.map((p, i) => i).filter(i => {
            const p = pills[i]; if (!p.obj.visible || p.v < .5 || p.flight >= 0) return false;
            p.obj.getWorldPosition(P3); pivot.worldToLocal(P3);
            return Math.abs(P3.x) - br > .22 * H; // clear sideways gap on screen
          });
          if (live.length) {
            const first = live[Math.floor(Math.random() * live.length)];
            startBolt(first, time);
            const rest = live.filter(i => i !== first);
            if (rest.length && Math.random() < .3) startBolt(rest[Math.floor(Math.random() * rest.length)], time + .09);
          }
          nextStrike = time + (!live.length ? .4 : near > .5 ? 1.4 + Math.random() * 1.8 : 3.5 + Math.random() * 4.5);
        }
        if (st >= 0 && st <= RUSH_END) {
          if (pills[0].flight > .3 && pills[0].flight < .8 && !bolts.some(b => b.on && b.src === 0)) startBolt(0, time, .45);
          if (time >= nextRush) {
            const flying = pills.map((p, i) => i).filter(i => i && pills[i].flight > .35 && pills[i].flight < .75);
            if (flying.length) { startBolt(flying[Math.floor(Math.random() * flying.length)], time, .28); nextRush = time + .4; }
          }
        }
      }
      let strike = 0;
      for (const bo of bolts) {
        if (!bo.on) continue;
        const p = pills[bo.src];
        if (!p || !p.obj.visible) { bo.on = false; hideBolt(bo); continue; }
        p.obj.getWorldPosition(A3);
        if (p.flight >= 0) { B3.set(0, m, 0); yawG.localToWorld(B3); } // into the mouth
        else { // the bottle wall facing the capsule
          P3.copy(A3); pivot.worldToLocal(P3);
          const rr = Math.hypot(P3.x, P3.z) || 1, br = aspect * H * .5;
          B3.set(P3.x / rr * br, clamp(P3.y, -.38 * H, .28 * H), P3.z / rr * br); pivot.localToWorld(B3);
        }
        strike = Math.max(strike, drawBolt(bo, A3, B3, W * .003, time));
      }
      const lp = pills[0];
      glowSprite.material.opacity = st >= 0 && lp.flight >= 0 ? lp.v * .55 : 0;
      if (glowSprite.material.opacity > 0) { lp.obj.getWorldPosition(glowSprite.position); glowSprite.scale.setScalar(W * .32); }

      haloBoost = (pulse * .45 + seal * .9) * c.arm + strike * .1;
      key.intensity = 5 * c.solo + (pulse * 7 + seal * 10) * c.arm + strike * 2; rim.intensity = 4 * c.solo + (pulse * 4 + seal * 6) * c.arm + strike * 1.2;
      key.position.set(pivot.position.x - .45, pivot.position.y + .5, .9);
      rim.position.set(pivot.position.x + .5, pivot.position.y + .2, -.4);

      // Twinkles near the bottle everywhere (brighter in the finale) and a sparkle trail orbiting it after the seal.
      const fin = st >= 0 ? smooth(clamp((st - CLOSE1 + .2) / .7)) : 0;
      const twA = 2.2 * (.3 + .7 * Math.max(fin, pulse * .6)) * ie * c.bottle * (reduced ? .5 : 1);
      const tc = twinkles.geometry.attributes.color;
      twk.forEach((q, i) => { const v = Math.pow(Math.max(0, Math.sin(time * q.f + q.ph)), 8) * twA; tc.setXYZ(i, v, v * .86, v * .55); });
      tc.needsUpdate = true;
      twinkles.material.size = W * .085;
      ring.visible = fin > .002;
      if (ring.visible) {
        const rc = ring.geometry.attributes.color, rp = ring.geometry.attributes.position, head = time * 1.5;
        for (let j = 0; j < RING; j++) {
          const th = head - j * .03, f = 2.6 * Math.pow(1 - j / RING, 1.6) * fin * (j < 4 ? 2 : 1) * (.75 + .25 * Math.sin(time * 9 + j * 1.7));
          rv.set(Math.cos(th) * .62 * H, (.02 + .04 * Math.sin(th * 2)) * H, Math.sin(th) * .62 * H).applyEuler(ringTilt);
          rp.setXYZ(j, rv.x, rv.y, rv.z); rc.setXYZ(j, f, f * .84, f * .5);
        }
        rp.needsUpdate = rc.needsUpdate = true;
        ring.material.size = W * .06;
      }
    }

    // Product still for bundle cards and cart, rendered from the same model and lighting.
    function still() {
      const w = 480, h = 720;
      renderer.setPixelRatio(1); renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      pillsG.visible = false; product.resetCap();
      pivot.position.set(0, 0, 0); pivot.rotation.set(.05, 0, 0); yawG.rotation.y = -.28;
      pivot.scale.setScalar(2 * 4 * Math.tan(10 * D2R) * .92 / H);
      renderer.render(scene, camera);
      const url = canvas.toDataURL('image/png');
      pillsG.visible = true;
      resize();
      return url;
    }
    function resize() {
      renderer.setPixelRatio(dpr()); renderer.setSize(innerWidth, innerHeight, false);
      camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    }
    try { window.__nztStill = still(); window.dispatchEvent(new Event('nzt-still')); } catch (e) { console.warn(e); }
    document.body.appendChild(canvas);

    cleanup.push(() => { canvas.remove(); product.dispose(); studio.dispose(); renderer.dispose(); });
    return {
      resize,
      draw(c, time) {
        pose(c, time, 1);
        // The same composition stays visible and keeps its physical scale.
        canvas.dataset.nztMotion = 'continuous';
        canvas.dataset.nztBottleScale = String(pivot.scale.x);
        canvas.dataset.nztBottleYaw = String(yawG.rotation.y);
        canvas.dataset.nztBolts = String(bolts.filter(b => b.on && b.core.visible).length);
        renderer.render(scene, camera);
      }
    };
  }

  initThree().then(t => { three = t; api.ready = !!t; }).catch(e => {
    console.warn('NZT 3D unavailable, showing static bottle', e);
    document.querySelectorAll('[data-nzt-fallback]').forEach(el => { el.style.opacity = '1'; });
  });

  // Pinned horizontal tracks ([data-hscroll] > sticky > [data-htrack]) and drifting display type ([data-parallax]).
  function layoutFx() {
    for (const el of document.querySelectorAll('[data-hscroll]')) {
      const track = el.querySelector('[data-htrack]');
      if (!track) continue;
      const travel = Math.max(0, track.scrollWidth - track.parentElement.clientWidth);
      const want = Math.round(travel + innerHeight) + 'px';
      if (el.style.height !== want) el.style.height = want;
      const r = el.getBoundingClientRect();
      const p = clamp(-r.top / Math.max(1, r.height - innerHeight));
      track.style.transform = 'translate3d(' + (-p * travel).toFixed(1) + 'px,0,0)';
    }
    if (reduced) return;
    for (const el of document.querySelectorAll('[data-parallax]')) {
      const r = el.getBoundingClientRect();
      const d = (r.top + r.height / 2 - innerHeight / 2) * (+el.dataset.parallax || .15);
      el.style.transform = 'translate3d(0,' + d.toFixed(1) + 'px,0)';
    }
  }

  let last = performance.now();
  const t0 = last;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (document.hidden) return;
    const dt = Math.min((now - last) / 1000, .05); last = now;
    const time = (now - t0) / 1000;
    layoutFx();
    const tg = target();
    if (tg) {
      const k = primed && !reduced ? 1 - Math.exp(-dt * 6.5) : 1;
      for (const key in cur) cur[key] += (key === 'ry' ? wrapPi(tg.ry - cur.ry) : tg[key] - cur[key]) * k;
      if (tg.pin) { cur.x = tg.x; cur.y = tg.y; } // phones: stick to the slot exactly, no lag
      primed = true;
    }
    if (!drag.on) { // soft spring home, slightly under-damped so it settles with an ease
      const K = 16, C = 5.6;
      drag.vy += (-K * drag.yaw - C * drag.vy) * dt; drag.yaw += drag.vy * dt;
      drag.vp += (-K * drag.pitch - C * drag.vp) * dt; drag.pitch += drag.vp * dt;
    }
    if (three) {
      const gw = cur.h * aspect * 1.25, gh = cur.h * 1.12, show = cur.x + gw / 2 > 0 && cur.x - gw / 2 < innerWidth && cur.y + gh / 2 > 0 && cur.y - gh / 2 < innerHeight;
      grip.style.display = show ? 'block' : 'none';
      if (show) Object.assign(grip.style, { width: gw.toFixed(0) + 'px', height: gh.toFixed(0) + 'px', transform: 'translate3d(' + (cur.x - gw / 2).toFixed(1) + 'px,' + (cur.y - gh / 2).toFixed(1) + 'px,0)' });
      three.draw(cur, time);
    }
    {
      const sz = cur.h * 1.45 * (1 + haloBoost * .25), breathe = reduced ? 1 : .92 + .08 * Math.sin(time * .8);
      halo.style.transform = 'translate3d(' + (cur.x - 50).toFixed(1) + 'px,' + (cur.y - 50).toFixed(1) + 'px,0) scale(' + (sz / 100).toFixed(3) + ',' + (sz * 1.08 / 100).toFixed(3) + ')';
      halo.style.opacity = (three ? Math.min(1, cur.bottle * cur.glow * (breathe + haloBoost)) : 0).toFixed(3);
    }
    if (bg) bg.render(reduced ? 0 : time, cur.x, cur.y, cur.h * .95, scrollY / innerHeight, cur.glow);
  }
  raf = requestAnimationFrame(frame);

  api.dispose = () => {
    alive = false; cancelAnimationFrame(raf);
    cleanup.forEach(f => { try { f(); } catch (e) { } });
    if (window.__nztStage === api) window.__nztStage = null;
  };
  api.cur = cur;
  window.__nztStage = api;
  return api;
}
