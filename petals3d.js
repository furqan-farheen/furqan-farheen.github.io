/* Three.js petal & spark field.
 * Real 3D petals (cupped, double-sided, lit) tumble through depth with wind gusts,
 * gold sparks twinkle with additive light, and the pointer gently parts them.
 * Each chapter sets a theme: garden · mehndi (marigold) · barat (crimson rose) · walima (ivory & gold) · night.
 */
import * as THREE from './vendor/three.module.min.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.getElementById('fx');
const small = Math.min(innerWidth, innerHeight) < 700;

const THEMES = {
  garden: { mix: { rose: .72, jasmine: .28, marigold: 0 }, rose: ['#E8B7AE', '#D9A7A0', '#F1D4CC', '#C98F87'], marigold: ['#E9962E'], spark: '#F3D9A0', sparks: .45, petals: .75 },
  mehndi: { mix: { marigold: .68, rose: .14, jasmine: .18 }, rose: ['#D0575A', '#C2508A'], marigold: ['#E9962E', '#F2BE3A', '#E37F1E', '#F6CF5A'], spark: '#FFC66B', sparks: 1, petals: 1 },
  barat: { mix: { rose: .82, jasmine: .18, marigold: 0 }, rose: ['#C2453F', '#D0575A', '#B3373B', '#E07A72'], marigold: ['#E9962E'], spark: '#E6C27A', sparks: .9, petals: 1 },
  walima: { mix: { rose: .55, jasmine: .45, marigold: 0 }, rose: ['#F4EEE6', '#E9C6BE', '#EADBC4', '#F8F3E9'], marigold: ['#E9962E'], spark: '#F6E3B0', sparks: .9, petals: .8 },
  night: { mix: { rose: .6, jasmine: .4, marigold: 0 }, rose: ['#D9A7A0', '#C98F87'], marigold: ['#E9962E'], spark: '#FFD58A', sparks: 1.3, petals: .35 },
};

let theme = THEMES.garden, level = 0, levelTarget = 0, paused = false, wake = null, gust = null;

let renderer = null;
try { if (canvas && !reduce) renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !small, powerPreference: 'high-performance' }); }
catch (e) { renderer = null; }          // no WebGL: the painted scenes stay, petals are simply skipped
if (!renderer && canvas) canvas.style.display = 'none';
if (renderer) canvas.addEventListener('webglcontextlost', () => { canvas.style.display = 'none'; paused = true; });
if (renderer) {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.25 : 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, .1, 60);
  camera.position.set(0, 0, 10);
  scene.add(new THREE.HemisphereLight(0xfff6ea, 0xc9a090, 3.4));
  scene.add(new THREE.AmbientLight(0xffffff, .9));
  const sun = new THREE.DirectionalLight(0xffe8c8, 3.4); sun.position.set(3, 6, 7); scene.add(sun);
  const back = new THREE.DirectionalLight(0xffd2b4, 1.4); back.position.set(-4, -2, -6); scene.add(back);

  // cupped petal geometry
  const geo = new THREE.PlaneGeometry(1, 1, 8, 8);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, .26 * x * x - .1 * y * y + .04 * y); }
  geo.computeVertexNormals();
  const jgeo = new THREE.PlaneGeometry(1, 1, 6, 6);
  const jp = jgeo.attributes.position;
  for (let i = 0; i < jp.count; i++) { const x = jp.getX(i), y = jp.getY(i); jp.setZ(i, -.18 * (x * x + y * y)); }
  jgeo.computeVertexNormals();

  const loader = new THREE.TextureLoader();
  const tex = (n) => { const t = loader.load(`assets/v3/tex_${n}.png`); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const mat = (n) => new THREE.MeshStandardMaterial({ map: tex(n), alphaTest: .35, side: THREE.DoubleSide, roughness: .55, metalness: 0, transparent: false, emissive: 0x000000 });
  const N = small ? 22 : 44;
  const kinds = {
    rose: new THREE.InstancedMesh(geo, mat('rose'), N),
    marigold: new THREE.InstancedMesh(geo, mat('marigold'), N),
    jasmine: new THREE.InstancedMesh(jgeo, mat('jasmine'), Math.ceil(N * .6)),
  };
  Object.values(kinds).forEach(m => { m.userData.cap = m.count; m.count = 0; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; scene.add(m); });

  // sparks
  const S = small ? 70 : 150;
  const sg = new THREE.BufferGeometry();
  const spos = new Float32Array(S * 3), sph = new Float32Array(S), ssz = new Float32Array(S);
  for (let i = 0; i < S; i++) { spos.set([(Math.random() - .5) * 16, (Math.random() - .5) * 11, -6 + Math.random() * 10], i * 3); sph[i] = Math.random() * 6.28; ssz[i] = .5 + Math.random(); }
  sg.setAttribute('position', new THREE.BufferAttribute(spos, 3)); sg.setAttribute('phase', new THREE.BufferAttribute(sph, 1)); sg.setAttribute('sz', new THREE.BufferAttribute(ssz, 1));
  const smat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 }, uC: { value: new THREE.Color(theme.spark) }, uA: { value: 0 }, uMap: { value: tex('spark') }, uPR: { value: renderer.getPixelRatio() } },
    vertexShader: `attribute float phase; attribute float sz; uniform float uT, uPR; varying float vA;
      void main(){ vec3 p = position; p.y += mod(uT*.12*sz + phase, 11.) - 5.5; p.x += sin(uT*.3 + phase)*.25;
        vec4 mv = modelViewMatrix * vec4(p,1.); gl_Position = projectionMatrix * mv;
        vA = .25 + .75*pow(.5+.5*sin(uT*(1.2+sz) + phase*3.), 3.);
        gl_PointSize = (10. + 14.*sz) * uPR * (8. / -mv.z); }`,
    fragmentShader: `uniform sampler2D uMap; uniform vec3 uC; uniform float uA; varying float vA;
      void main(){ vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(uC, t.a*vA*uA); }`,
  });
  scene.add(new THREE.Points(sg, smat));

  // particle state
  const parts = [];
  const view = { w: 10, h: 10 };
  const pickKind = () => { const r = Math.random(), m = theme.mix; return r < m.rose ? 'rose' : r < m.rose + m.marigold ? 'marigold' : 'jasmine'; };
  const spawn = (o, top) => {
    o.kind = pickKind(); const z = -8 + Math.random() * 8.5; const sc = (view.h / 10);
    o.pos = new THREE.Vector3((Math.random() - .5) * view.w * 1.4 * (1 + (2 - z) / 10), top ? view.h * .62 + Math.random() * 2 : (Math.random() - .5) * view.h * 1.2, z);
    o.vel = new THREE.Vector3(.15 + Math.random() * .25, -(.35 + Math.random() * .5), 0);
    o.rot = new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    o.spin = new THREE.Vector3((Math.random() - .5) * 1.6, (Math.random() - .5) * 1.6, (Math.random() - .5) * 1.2);
    o.scale = (o.kind === 'jasmine' ? .34 : o.kind === 'marigold' ? .32 : .36) * (0.75 + Math.random() * .55) * sc;
    o.ph = Math.random() * 6.28;
    const pal = o.kind === 'rose' ? theme.rose : o.kind === 'marigold' ? theme.marigold : ['#FBF6EC', '#F4EEE6'];
    o.col = new THREE.Color(pal[(Math.random() * pal.length) | 0]);
    return o;
  };
  // a sweep of petals in the new chapter's colours, carried across the screen on a breeze
  let burstUntil = -1;
  gust = () => {
    const now = clock.elapsedTime; if (now < burstUntil - 2) return; burstUntil = now + 4.5;
    parts.forEach((o, i) => { if (i % 3 === 2) return; spawn(o, false);
      o.pos.set(-view.w * (.7 + Math.random() * .6), (Math.random() - .35) * view.h * .9, -3.5 + Math.random() * 5);
      o.vel.set(3.2 + Math.random() * 2.6, -.15 - Math.random() * .45, 0); o.burst = true; });
  };
  const TOTAL = Math.round(N * 1.25);
  for (let i = 0; i < TOTAL; i++) parts.push(spawn({}, false));

  const mouse = new THREE.Vector2(9, 9), mWorld = new THREE.Vector3();
  addEventListener('pointermove', e => { mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); }, { passive: true });
  const resize = () => { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    view.h = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z; view.w = view.h * camera.aspect; };
  resize(); addEventListener('resize', resize);

  const dummy = new THREE.Object3D(), tmpC = new THREE.Color();
  const clock = new THREE.Clock();
  let running = true;
  const resume = () => { const go = !document.hidden && !paused; if (go && !running) { running = true; clock.getDelta(); loop(); } else if (!go) running = false; };
  document.addEventListener('visibilitychange', resume); wake = resume;
  function loop() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime;
    level += (levelTarget - level) * Math.min(1, dt * 1.2);
    const wind = .5 + .5 * Math.sin(t * .21) * Math.sin(t * .13 + 1.7);
    mWorld.set(mouse.x * view.w / 2, mouse.y * view.h / 2, 0);
    const counts = { rose: 0, marigold: 0, jasmine: 0 };
    const active = t < burstUntil ? parts.length : Math.round(parts.length * Math.min(1, level * theme.petals));
    for (let i = 0; i < parts.length; i++) {
      const o = parts[i];
      if (i >= active) { if (o.pos.y > -view.h) o.pos.y -= dt * 2; continue; }
      if (o.burst) { o.vel.x += ((.15 + (o.ph % 1) * .25) - o.vel.x) * Math.min(1, dt * .45); if (o.vel.x < .5) o.burst = false; }
      o.pos.x += (o.vel.x * (1 + wind * 1.8) + Math.sin(t * .7 + o.ph) * .25) * dt;
      o.pos.y += (o.vel.y + Math.cos(t * .9 + o.ph) * .12) * dt;
      const dx = o.pos.x - mWorld.x, dy = o.pos.y - mWorld.y, d2 = dx * dx + dy * dy;
      if (o.pos.z > -2 && d2 < 2.2) { const f = (2.2 - d2) * .9 * dt; o.pos.x += dx * f; o.pos.y += dy * f; o.rot.z += f * 3; }
      o.rot.x += o.spin.x * dt; o.rot.y += o.spin.y * dt * (1 + wind + (o.burst ? 2 : 0)); o.rot.z += o.spin.z * dt;
      if (o.pos.y < -view.h * .65 - 1 || o.pos.x > view.w * .8 + 2) spawn(o, true);
      const m = kinds[o.kind]; const idx = counts[o.kind]++;
      if (idx >= m.userData.cap) continue;
      dummy.position.copy(o.pos); dummy.rotation.copy(o.rot); dummy.scale.setScalar(o.scale); dummy.updateMatrix();
      m.setMatrixAt(idx, dummy.matrix); m.setColorAt(idx, tmpC.copy(o.col));
    }
    Object.entries(kinds).forEach(([k, m]) => { m.count = Math.min(counts[k], m.userData.cap); m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
    smat.uniforms.uT.value = t; smat.uniforms.uA.value += (Math.min(1, level) * theme.sparks * .8 - smat.uniforms.uA.value) * Math.min(1, dt * 1.5);
    smat.uniforms.uC.value.lerp(new THREE.Color(theme.spark), Math.min(1, dt));
    camera.position.x += (mouse.x * .25 - camera.position.x) * dt * .8; camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  loop();
}

window.FX3D = {
  setTheme(name) { if (THEMES[name]) theme = THEMES[name]; },
  setLevel(v) { levelTarget = v; },
  burst() { if (gust && !paused) gust(); },
  setPaused(v) { paused = !!v; if (canvas) canvas.style.opacity = v ? '0' : ''; if (wake) wake(); },
};
window.dispatchEvent(new Event('fx3d-ready'));
