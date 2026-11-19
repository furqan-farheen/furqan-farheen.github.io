/* Furqan & Farheen — immersive invitation
 * Liquid-paint WebGL per scene (touch ripples, scroll smear, paint-flood reveal) · silk envelope opening ·
 * per-event chapters (Mehndi · Barat · Walima) · smooth scroll (Lenis) · masked reveals (GSAP) ·
 * drawn gold line-work · three.js petals themed per event (petals3d.js).
 */
(function () {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // motion toggle: starts paused for reduced-motion users; the choice is remembered on this device
  let still = reduce;
  try { const v = localStorage.getItem('ff-still'); if (v !== null) still = v === '1'; } catch (e) {}
  document.documentElement.classList.toggle('still', still);
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  // phones & tablets get a lighter renderer (fewer pixels, cheaper paint shader, 30 fps effects)
  const MOBILE = !fine || Math.min(innerWidth, innerHeight) < 820;
  let lite = false;                       // switched on automatically if the device can't keep up
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  // every visit starts at the envelope (browsers otherwise restore the old scroll position behind it)
  try { history.scrollRestoration = 'manual'; } catch (e) {}
  scrollTo(0, 0);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const aspectKey = () => { const a = innerWidth / innerHeight; return a < 0.62 ? 'p' : a < 1.05 ? 't' : 'l'; };
  let KEY = aspectKey();
  const A = (n) => `assets/v3/${n}`;
  const SCENES = $$('canvas.paint').map(c => c.dataset.scene);

  /* ------------------------------------------------------------ preload */
  const cache = {}, IM = {};
  // images retry up to 3 times (slow or flaky mobile data), then resolve null so nothing ever hangs
  const fetchImg = (u, tries = 0) => new Promise(res => { const im = new Image(); im.decoding = 'async';
    im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => res(im)); im.onerror = () => tries < 3 ? setTimeout(() => fetchImg(u, tries + 1).then(res), 800 * 2 ** tries) : res(null);
    im.src = tries ? `${u}${u.includes('?') ? '&' : '?'}r=${tries}` : u; });
  const load = (u) => cache[u] || (cache[u] = fetchImg(u).then(im => { if (im) IM[u] = im; return im; }));
  const sceneUrls = (s, k) => [A(`${s}_${k}.webp`), A(`${s}_mask_${k}.png`)];
  // the loader waits only for what the opening shows: envelope, garden painting, hero flowers, fonts
  const urls = [...sceneUrls('garden', KEY), ...$$('#card img, #s-invite img.corner').map(i => i.getAttribute('src')).filter(Boolean)];
  const prog = { v: 0 }, cnt = $('#loader .count'), bar = $('#loader .rule b');
  let loaded = 0;
  const all = Promise.all(urls.map(u => load(u).then(() => { loaded++; gsap.to(prog, { v: loaded / urls.length, duration: .6, overwrite: true }); })))
    .then(() => document.fonts ? document.fonts.ready : null);
  const counter = () => { if (!cnt.isConnected) return gsap.ticker.remove(counter); const p = Math.round(prog.v * 100); cnt.textContent = String(p).padStart(3, '0'); bar.style.transform = `scaleX(${prog.v})`; };
  gsap.ticker.add(counter);

  /* --------------------------------------------------------- liquid GL */
  const VS = 'attribute vec2 p; varying vec2 vUv; void main(){ vUv = vec2(p.x*.5+.5, .5-p.y*.5); gl_Position = vec4(p,0.,1.); }';
  const FS = `precision highp float;
  varying vec2 vUv; uniform sampler2D uTex, uMask; uniform float uTime, uReveal, uSheen, uVel, uImg, uCan; uniform vec2 uTexel; uniform vec3 uBase;
  uniform vec4 uDrop[8];
  uniform vec4 uL[16];   // lights: x, y, kind (1 hanging lamp, 2 flame), phase
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
  float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
  float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<${MOBILE ? 3 : 5};i++){ v+=a*n(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return v; }
  void main(){
    vec2 sc = uCan > uImg ? vec2(1., uImg/uCan) : vec2(uCan/uImg, 1.);
    vec2 uv = (vUv-.5)*sc+.5; float t = uTime;
    vec4 mk = texture2D(uMask, uv);
    vec2 q = vec2(fbm(uv*vec2(3.,1.6)+vec2(t*.035,0.)), fbm(uv*vec2(3.,1.6)+vec2(5.2,1.3)-vec2(t*.028,t*.01)));
    vec2 r = vec2(fbm(uv*4.+q*2.+vec2(t*.02)), fbm(uv*4.+q*2.+vec2(8.3,2.8)));
    vec2 off = (r-.5)*.014*mk.r;
    off.x += sin(uv.y*240.-t*1.7+fbm(uv*18.)*7.)*.0022*mk.g;
    off.y += sin(uv.x*70.+t*1.1)*.0012*mk.g;
    off += (vec2(fbm(uv*6.+t*.05), fbm(uv*6.-t*.045+3.))-.5)*.0008*(mk.r+mk.g);
    off.y += (fbm(uv*vec2(2.,8.)+t*.2)-.5)*uVel*.004;
    for(int i=0;i<8;i++){ vec4 d = uDrop[i]; float age = t - d.z; if(age < 0. || age > 5.) continue;
      vec2 dv = (vUv - d.xy)*vec2(uCan,1.); float rr = length(dv);
      float w = sin(rr*48. - age*6.5)*exp(-rr*5.5)*exp(-age*1.1)*d.w;
      off += dv/(rr+1e-4)*w*.0028*sc*(.35+.65*max(mk.r,mk.g)); }
    for(int i=0;i<16;i++){ vec4 L = uL[i]; if(L.z < .5 || L.z > 1.5) continue;     // hanging lamps swing on their chains
      vec2 piv = vec2(L.x, L.y - .06); vec2 asp = vec2(uImg, 1.);
      vec2 d = (uv - piv)*asp; float dl = length((uv - L.xy)*asp);
      float wgt = (1. - smoothstep(.028, .07, dl)) * smoothstep(-.02, .02, d.y);
      float a = sin(t*1.2 + L.w)*.09*wgt;
      vec2 rd = vec2(d.x*cos(a) - d.y*sin(a), d.x*sin(a) + d.y*cos(a));
      off += (rd - d)/asp; }
    float rv = clamp(uReveal,0.,1.);
    float front = fbm(uv*3.5+vec2(0.,t*.15))*.55 + (1.-uv.y)*.25 + abs(uv.x-.5)*.2;
    float m = smoothstep(front-.02, front+.06, rv*1.25);
    off += (r-.5)*.09*(1.-m);
    vec2 su = uv+off;
    vec3 c = texture2D(uTex, su).rgb;
    float lx = dot(texture2D(uTex, su+vec2(uTexel.x,0.)).rgb - texture2D(uTex, su-vec2(uTexel.x,0.)).rgb, vec3(.333));
    float ly = dot(texture2D(uTex, su+vec2(0.,uTexel.y)).rgb - texture2D(uTex, su-vec2(0.,uTexel.y)).rgb, vec3(.333));
    vec3 N = normalize(vec3(-lx*5., -ly*5., 1.));
    vec3 L = normalize(vec3(cos(t*.23)*.7, sin(t*.19)*.5-.35, .75));
    float sp = pow(max(dot(reflect(-L,N), vec3(0.,0.,1.)),0.), 28.);
    c += sp*uSheen*(.6+.4*mk.r+.6*mk.g);
    for(int i=0;i<16;i++){ vec4 L = uL[i]; if(L.z < 1.5) continue;                     // diyas & candles flicker
      float dd = length((uv - L.xy)*vec2(uImg, 1.));
      float f = .5 + .5*sin(t*8.3 + L.w)*sin(t*5.1 + L.w*2.7) + .25*sin(t*17. + L.w*3.1);
      c += vec3(1., .74, .38)*exp(-dd*dd/.00022)*.2*f; }
    float edge = smoothstep(front-.02, front+.02, rv*1.25) - smoothstep(front+.02, front+.08, rv*1.25);
    c = mix(uBase, c, m) - edge*.06;
    gl_FragColor = vec4(c, 1.);
  }`;

  class Liquid {
    constructor(canvas, opts) {
      this.c = canvas; Object.assign(this, { reveal: 1, base: [0.973, 0.953, 0.914], sheen: .1, vel: 0 }, opts);
      this.drops = new Float32Array(32); this.lights = new Float32Array(64); this.di = 0; this.t0 = performance.now(); this.running = false;
      const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
      if (!gl) { this.ok = false; return; }
      this.ok = true; this.gl = gl;
      canvas.addEventListener('webglcontextlost', () => { this.ok = false; this.running = false; canvas.remove(); });
      const sh = (ty, src) => { const s = gl.createShader(ty); gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s)); return s; };
      const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(pr); gl.useProgram(pr);
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      this.U = {}; ['uTex', 'uMask', 'uTime', 'uReveal', 'uSheen', 'uTexel', 'uBase', 'uVel', 'uImg', 'uCan', 'uDrop', 'uL'].forEach(k => this.U[k] = gl.getUniformLocation(pr, k));
      gl.uniform1i(this.U.uTex, 0); gl.uniform1i(this.U.uMask, 1);
      this.tex = [gl.createTexture(), gl.createTexture()];
      this.resize(); let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => this.resize(), 120); });
      this.visible = false;
      new IntersectionObserver(es => es.forEach(e => { this.visible = e.isIntersecting; e.isIntersecting ? this.start() : this.stop(); }), { rootMargin: '100px' }).observe(canvas);
      document.addEventListener('visibilitychange', () => document.hidden ? this.stop() : this.visible && this.start());
    }
    setImages(img, mask) {
      if (!this.ok || !img) return; const gl = this.gl; this.img = img; this.c.style.opacity = 1;
      [img, mask].forEach((im, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, this.tex[i]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); });
      gl.uniform2f(this.U.uTexel, 1.4 / img.width, 1.4 / img.height); gl.uniform1f(this.U.uImg, img.width / img.height); this.draw();
    }
    resize() { const d = Math.min(devicePixelRatio || 1, MOBILE ? 1.25 : 2); const cw = this.c.clientWidth, ch = this.c.clientHeight;
      const W = Math.max(2, Math.round(cw * d)), H = Math.max(2, Math.round(ch * d));
      if (W === this.c.width && H === this.c.height) return;
      this.c.width = W; this.c.height = H;
      if (this.gl) { this.gl.viewport(0, 0, W, H); this.gl.uniform1f(this.U.uCan, cw / Math.max(1, ch)); } this.draw(); }
    now() { return (performance.now() - this.t0) / 1000; }
    setLights(arr) { this.lights.fill(0); (arr || []).slice(0, 16).forEach(([x, y], i) => this.lights.set([x, y, y < .3 ? 1 : 2, i * 1.71], i * 4)); this.draw(); }
    drop(x, y, s = 1) { const i = (this.di++ % 8) * 4; this.drops.set([x, y, this.now(), s], i); }
    draw() { if (!this.ok || !this.img) return; const gl = this.gl, U = this.U;
      if (!still) this.t = this.now(); gl.uniform1f(U.uTime, this.t || 0); gl.uniform1f(U.uReveal, this.reveal); gl.uniform1f(U.uSheen, this.sheen);
      gl.uniform1f(U.uVel, this.vel); gl.uniform3fv(U.uBase, this.base); gl.uniform4fv(U.uDrop, this.drops); gl.uniform4fv(U.uL, this.lights); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
    start() { if (this.running || !this.ok) return; this.running = true;
      let f = 0; const loop = () => { if (!this.running) return; if (!MOBILE || this.busy || (f++ & 1) === 0) this.draw();
        if ((still || lite) && !this.busy) { this.running = false; return; } requestAnimationFrame(loop); };
      requestAnimationFrame(loop); }
    stop() { this.running = false; }
    // map image-space (fx, fy) to element-space fractions for the current cover crop
    map(fx, fy) { const r = this.c.getBoundingClientRect(); const ca = r.width / r.height, ia = this.img.width / this.img.height;
      const sc = ca > ia ? [1, ia / ca] : [ca / ia, 1]; return [(fx - .5) / sc[0] + .5, (fy - .5) / sc[1] + .5]; }
  }



  /* --------------------------------------------------------- dupatta breeze */
  const CFS = `precision mediump float; varying vec2 vUv; uniform sampler2D uT; uniform float uTime;
  void main(){ vec2 uv = vUv;
    float m = smoothstep(.6, .84, uv.x) * smoothstep(.13, .42, uv.y) * (1. - smoothstep(.8, .96, uv.y));
    float w = sin(uv.y*7. - uTime*1.5)*.6 + sin(uv.y*13. - uTime*2.2 + 1.3)*.4;
    uv.x += w*.016*m*clamp((uv.x - .55)*3., 0., 1.);
    uv.y += sin(uTime*1.1 + uv.x*5.)*.003*m;
    gl_FragColor = texture2D(uT, uv); }`;
  const cloths = new Set();
  class Cloth {
    constructor(img) {
      const c = document.createElement('canvas'); c.className = img.className + ' cloth'; c.setAttribute('aria-hidden', 'true');
      const gl = c.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
      if (!gl) return;
      this.img = img; this.c = c; this.gl = gl; this.t0 = performance.now(); this.running = false; this.visible = false;
      const sh = (ty, src) => { const s = gl.createShader(ty); gl.shaderSource(s, src); gl.compileShader(s); return s; };
      const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, CFS));
      gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return; gl.useProgram(pr);
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      this.uT = gl.getUniformLocation(pr, 'uTime');
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      const tx = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tx);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.LINEAR));
      [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE));
      img.after(c); img.style.visibility = 'hidden'; this.ok = true; cloths.add(this);
      this.onR = () => this.resize(); this.onV = () => document.hidden ? this.stop() : this.start();
      addEventListener('resize', this.onR); document.addEventListener('visibilitychange', this.onV);
      c.addEventListener('webglcontextlost', () => dropCloth(img));
      this.resize();
    }
    resize() { const d = Math.min(devicePixelRatio || 1, MOBILE ? 1.25 : 2), w = this.img.clientWidth, h = this.img.clientHeight; if (!w) return;
      this.c.width = Math.round(w * d); this.c.height = Math.round(h * d); this.gl.viewport(0, 0, this.c.width, this.c.height); this.draw(); }
    draw() { const gl = this.gl; gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.uniform1f(this.uT, (performance.now() - this.t0) / 1000); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
    start() { if (this.running) return; this.running = true; let f = 0; const loop = () => { if (!this.running) return; if (!MOBILE || (f++ & 1) === 0) this.draw(); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
    stop() { this.running = false; }
    destroy() { this.stop(); removeEventListener('resize', this.onR); document.removeEventListener('visibilitychange', this.onV);
      const x = this.gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext();
      this.c.remove(); this.img.style.visibility = ''; cloths.delete(this); }
  }
  const clothFor = new Map(), clothVis = new Map();
  const makeCloth = (im) => { if (!im.naturalWidth) { im.addEventListener('load', () => clothVis.get(im) && makeCloth(im), { once: true }); return; }
    if (still || reduce || lite || clothFor.get(im)) return; const c = new Cloth(im); if (c.ok) { clothFor.set(im, c); c.start(); } };
  const dropCloth = (im) => { const c = clothFor.get(im); if (c) { c.destroy(); clothFor.delete(im); } };
  const clothNear = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { clothVis.set(e.target, true); makeCloth(e.target); } }), { rootMargin: '100% 0px' });
  const clothFar = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) { clothVis.set(e.target, false); dropCloth(e.target); } }), { rootMargin: '220% 0px' });
  const clothIO = { observe: (im) => { clothNear.observe(im); clothFar.observe(im); } };

  /* --------------------------------------------------------- geometry */
  function cuspedArch(cx, base, w, h, springFrac = .7, cusps = 9, depth = .028, n = 260) {
    const hs = h * springFrac, ha = h - hs, spy = base - hs, hw = w / 2, e = hw * .35, R = hw + e;
    const apex = Math.acos(-e / R), rise = R * Math.sin(apex); const left = [];
    for (let i = 0; i < n; i++) { const t = i / (n - 1), a = Math.PI - (Math.PI - apex) * t;
      left.push([cx + e + R * Math.cos(a), spy - R * Math.sin(a) * (ha / rise)]); }
    const right = left.slice().reverse().map(([x, y]) => [2 * cx - x, y]);
    let arch = left.concat(right.slice(1));
    const N = arch.length, cxy = [cx, spy + ha * .15];
    arch = arch.map(([x, y], i) => { const t = i / (N - 1); const d = depth * w * Math.pow(1 - Math.abs(Math.cos(Math.PI * cusps * t)), 1.6);
      let vx = cxy[0] - x, vy = cxy[1] - y; const L = Math.hypot(vx, vy) || 1; return [x + vx / L * d, y + vy / L * d]; });
    return [[cx - hw, base], ...arch, [cx + hw, base]];
  }
  const pathD = (pts, close) => 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L') + (close ? 'Z' : '');

  function buildArches() {
    $$('.arch').forEach(box => { const svg = $('svg.paper', box); const w = box.clientWidth, h = box.clientHeight; if (!w) return;
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      const sf = Math.max(.55, 1 - .5 * w / h), sfi = Math.max(.55, 1 - .5 * w * .92 / (h - w * .07));   // curve height tied to width, so tall cards keep the same crown
      const outer = cuspedArch(w / 2, h, w, h, sf, 9, .028);
      const inner = cuspedArch(w / 2, h - w * .03, w * .92, h - w * .07, sfi, 9, .028);
      $$('.a-fill, .a-lip, .a-clip', svg).forEach(p => p.setAttribute('d', pathD(outer, true)));
      const g = $('.a-gold', svg); g.setAttribute('d', pathD(inner.slice(1, -1), false)); g.setAttribute('stroke-width', Math.max(.8, w * .0035));
      const sh = $('.a-shine', svg); if (sh) { sh.setAttribute('d', g.getAttribute('d')); sh.setAttribute('stroke-width', Math.max(1.4, w * .0065)); glint(sh); } });
  }
  // a short bright dash that runs along a gold line, like light catching gold leaf
  const glints = new Set();
  function glint(path, dur = 7) {
    if (path._gl) { path._gl.kill(); glints.delete(path._gl); }
    const L = path.getTotalLength(), seg = Math.min(140, L * .12);
    path.setAttribute('stroke-dasharray', `${seg} ${L + seg}`);
    path._gl = gsap.fromTo(path, { strokeDashoffset: seg }, { strokeDashoffset: -L, duration: dur, ease: 'sine.inOut', repeat: -1, repeatDelay: 2.5, delay: Math.random() * 3, paused: still });
    glints.add(path._gl);
  }
  function buildFrame() {
    const card = $('#s-rsvp .card'), svg = $('#s-rsvp svg.frame'); const w = card.clientWidth, h = card.clientHeight;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const arch = (inset) => { const top = cuspedArch(w / 2, inset + (w - 2 * inset) * .62, w - 2 * inset, (w - 2 * inset) * .62, .12, 9, .02);
      return [[inset, h - inset], ...top.slice(1, -1), [w - inset, h - inset], [inset, h - inset]]; };
    const sw = Math.max(1, w / 420);
    let html = `<path d="${pathD(arch(0))}" stroke-width="${sw * 1.4}"/><path d="${pathD(arch(9))}" stroke-width="${sw * .7}" opacity=".85"/>`;
    const vine = (px, py, ang, len, flip) => { const pts = [];
      for (let i = 0; i < 60; i++) { const t = i / 59, a = ang + flip * t * 2.4, rr = len * (1 - .55 * t);
        pts.push([px + Math.cos(ang) * len * t * .9 + Math.cos(a) * rr * .12, py + Math.sin(ang) * len * t * .9 + Math.sin(a) * rr * .12]); }
      let s = `<path d="${pathD(pts)}" stroke-width="${sw}"/>`;
      for (let j = 4; j < 60; j += 9) { const [x, y] = pts[j], la = ang + flip * (1.2 + j / 40), L = len * .2 * (1 - j / 90), wd = L * .26;
        s += `<path class="leaf" d="M${x} ${y} Q${x + Math.cos(la) * L * .5 - Math.sin(la) * wd} ${y + Math.sin(la) * L * .5 + Math.cos(la) * wd} ${x + Math.cos(la) * L} ${y + Math.sin(la) * L} Q${x + Math.cos(la) * L * .5 + Math.sin(la) * wd} ${y + Math.sin(la) * L * .5 - Math.cos(la) * wd} ${x} ${y}Z"/>`; }
      const [ex, ey] = pts[59]; return s + `<circle class="leaf" cx="${ex}" cy="${ey}" r="${sw * 2.2}"/>`; };
    const L = Math.min(110, w * .2);
    html += vine(0, h, -Math.PI / 2 + .25, L, -1) + vine(0, h, 0, L * .9, 1) + vine(w, h, -Math.PI / 2 - .25, L, 1) + vine(w, h, Math.PI, L * .9, -1);
    html += `<path class="leaf" d="M${w / 2} ${-24} L${w / 2 + 6} ${-9} L${w / 2} ${-1} L${w / 2 - 6} ${-9}Z"/>`;
    svg.innerHTML = html + `<path class="shine" d="${pathD(arch(0))}" stroke-width="${sw * 2.4}"/>`;
    glint($('.shine', svg), 9);
  }
  /* ---------------------------------------------------------- text fx */
  function splitChars(el) { const s = el.textContent; el.textContent = ''; el.setAttribute('aria-label', s);
    return [...s].map(ch => { const sp = document.createElement('span'); sp.textContent = ch === ' ' ? ' ' : ch; sp.style.display = 'inline-block';
      sp.setAttribute('aria-hidden', 'true'); el.appendChild(sp); return sp; }); }
  const drawPaths = (root, dur = 2.4, delay = 0) => {
    $$('path, line', root).forEach((p, i) => { if (p.classList.contains('leaf') || p.classList.contains('dot')) {
        gsap.fromTo(p, { opacity: 0, scale: .2, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: .7, delay: delay + dur * .55 + i * .02, ease: 'back.out(2)' }); return; }
      const L = p.getTotalLength ? p.getTotalLength() : 200;
      gsap.fromTo(p, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: dur, delay, ease: 'power2.inOut' }); });
    $$('circle', root).forEach(c => gsap.fromTo(c, { opacity: 0 }, { opacity: 1, duration: .6, delay: delay + dur * .7 }));
  };
  function reveals(scope, opts = {}) {
    const tl = gsap.timeline({ paused: true });
    $$('[data-r]', scope).forEach(el => {
      const at = +el.dataset.at || 0, kind = el.dataset.r;
      if (kind === 'line') tl.from($$('.line > span', el).length ? $$('.line > span', el) : el, { yPercent: 115, duration: 1.3, stagger: .12, ease: 'expo.out' }, at);
      else if (kind === 'write') tl.fromTo(el, { clipPath: 'inset(-40% 100% -40% -12%)', opacity: .2 },   // script lines are drawn on, left to right, like ink
        { clipPath: 'inset(-40% -12% -40% -12%)', opacity: 1, duration: 2.1, ease: 'power2.inOut', clearProps: 'clipPath', immediateRender: true }, at);
      else if (kind === 'chars') tl.from(splitChars(el), { yPercent: 70, opacity: 0, duration: 1.4, stagger: .05, ease: 'expo.out' }, at);
      else if (kind === 'draw') tl.add(() => drawPaths(el, +el.dataset.dur || 1.6), at);
      else if (kind === 'amp') tl.from(el, { opacity: 0, scale: .3, rotate: -25, duration: 1.4, ease: 'back.out(1.8)' }, at);
      else tl.from(el, { opacity: 0, y: 24, duration: 1.2, ease: 'power3.out' }, at);
    });
    if (!opts.manual) ScrollTrigger.create({ trigger: scope, start: 'top 70%', once: true, onEnter: () => tl.play() });
    return tl;
  }

  /* -------------------------------------------------------------- main */
  const fx = { theme: (n) => window.FX3D && window.FX3D.setTheme(n), level: (v) => window.FX3D && window.FX3D.setLevel(v),
    burst: () => window.FX3D && window.FX3D.burst && window.FX3D.burst() };
  const OPTS = { garden: { reveal: 1, sheen: .1 }, night: { reveal: 0, sheen: .16, base: [0.043, 0.141, 0.122] },
    mehndi: { reveal: 0, sheen: .14, base: [0.23, 0.11, 0.2] }, barat: { reveal: 0, sheen: .1, base: [0.97, 0.95, 0.91] },
    walima: { reveal: 0, sheen: .16, base: [0.92, 0.86, 0.77] } };

  all.then(async () => {
    const lenis = new Lenis({ lerp: .085, smoothWheel: true, syncTouch: false });
    lenis.stop(); lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0);

    const LQ = {};
    $$('canvas.paint').forEach(c => { const L = new Liquid(c, { ...(OPTS[c.dataset.scene] || {}) }); if (!L.ok) c.remove(); LQ[c.dataset.scene] = L; });
    const G = LQ.garden;
    const placeGlows = () => $$('.glows').forEach(wrap => { const s = wrap.dataset.scene, L = LQ[s]; wrap.innerHTML = '';
      if (!L || !L.img) return; L.setLights(window.LIGHTS[`${s}_${KEY}`]);
      (window.LIGHTS[`${s}_${KEY}`] || []).forEach(([fx_, fy, w], i) => { const [x, y] = L.map(fx_, fy); if (x < -.05 || x > 1.05 || y < -.05 || y > 1.05) return;
        const el = document.createElement('i'); el.className = 'glow ' + (fy < .3 ? 'hang' : 'flame'); const sz = (w >= 1 ? 15 : w >= .6 ? 9 : 6) * (0.6 + .4 * Math.min(1, w));
        Object.assign(el.style, { left: x * 100 + '%', top: y * 100 + '%', width: sz + 'vmin', height: sz + 'vmin', animationDuration: (2.2 + (i * .37) % 1.8) + 's', animationDelay: -((i * .61) % 2) + 's' });
        wrap.appendChild(el); }); });
    const wanted = new Set(['garden']);
    const hydrate = (root) => { $$('source[data-srcset]', root).forEach(el => { el.srcset = el.dataset.srcset; el.removeAttribute('data-srcset'); });
      $$('img[data-src]', root).forEach(el => { el.src = el.dataset.src; el.removeAttribute('data-src'); });
      // a static painting that fails (flaky data) retries as JPEG, then once more, instead of showing a broken icon
      $$('picture.paint-fallback img', root).forEach(im => { if (im._guard) return; im._guard = 1; let n = 0;
        im.addEventListener('error', () => { if (n++ > 2) return; $$('source', im.parentNode).forEach(x => x.remove());
          setTimeout(() => { im.src = A(`${im.dataset.scene}_${KEY}.jpg?r=${n}`); }, 700 * n); }); }); };
    const ensure = async (s) => { wanted.add(s); const k = KEY; const sec = $(`section.scene[data-theme="${s}"]`); if (sec) hydrate(sec); const [im, mk] = await Promise.all(sceneUrls(s, k).map(load));
      if (k !== KEY) return; const L = LQ[s];
      if (L && L.ok) { if (im && mk) L.setImages(im, mk); else { L.ok = false; L.c.remove(); } }   // failed: static painting stays
      placeGlows(); };
    const apply = () => Promise.all([...wanted].map(ensure));
    const sceneIO = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) ensure(e.target.dataset.theme); }), { rootMargin: '150% 0px' });
    $$('section.scene[data-theme]').forEach(sec => sec.dataset.theme !== 'garden' && sceneIO.observe(sec));
    const strip = $('#s-rsvp .strip img.sky');
    new IntersectionObserver((es, o) => es.forEach(e => { if (e.isIntersecting) { strip.src = A(`strip_${KEY}.webp`); hydrate($('#s-rsvp')); o.disconnect(); } }), { rootMargin: '150% 0px' }).observe($('#s-rsvp'));
    await ensure('garden');
    $$('img.couple').forEach(im => clothIO.observe(im));
    buildArches(); buildFrame();
    let rT, lastW = innerWidth; addEventListener('resize', () => { if (MOBILE && innerWidth === lastW) return; lastW = innerWidth;
      clearTimeout(rT); rT = setTimeout(() => { buildArches(); buildFrame(); const k = aspectKey();
      if (k !== KEY) { KEY = k; apply(); if (strip.getAttribute('src')) strip.src = A(`strip_${KEY}.webp`); } else placeGlows(); ScrollTrigger.refresh(); }, 160); });

    // pointer ripples on whichever painting is under the finger
    const ripple = (e, s) => Object.values(LQ).forEach(L => { if (!L.ok) return; const r = L.c.getBoundingClientRect();
      if (e.clientY < r.top || e.clientY > r.bottom) return; L.drop((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, s); });
    let lastDrop = 0; addEventListener('pointermove', e => { const t = performance.now(); if (t - lastDrop > 90) { lastDrop = t; ripple(e, .35); } }, { passive: true });
    addEventListener('pointerdown', e => ripple(e, 1), { passive: true });
    lenis.on('scroll', ({ velocity }) => { const v = Math.max(-1, Math.min(1, velocity / 40)); Object.values(LQ).forEach(L => L.vel = v); });
    gsap.ticker.add(() => Object.values(LQ).forEach(L => L.vel *= .92));

    // cursor
    if (fine) { const c = $('#cursor'), ring = $('#cursor-ring'), pos = { x: innerWidth / 2, y: innerHeight / 2 }, rp = { ...pos };
      addEventListener('pointermove', e => { pos.x = e.clientX; pos.y = e.clientY; c.style.transform = `translate(${pos.x}px,${pos.y}px)`; });
      gsap.ticker.add(() => { rp.x += (pos.x - rp.x) * .16; rp.y += (pos.y - rp.y) * .16; ring.style.transform = `translate(${rp.x}px,${rp.y}px)`; });
      document.addEventListener('pointerover', e => { const t = e.target.closest('a, button, .tap'); ring.classList.toggle('big', !!t);
        ring.querySelector('.lbl').textContent = t ? (t.dataset.cursor || '') : ''; }); }

    // parallax
    if (!reduce) {
      $$('section .corner').forEach(el => { const sec = el.closest('section');
        gsap.fromTo(el, { y: 0 }, { y: () => (el.classList.contains('tl') || el.classList.contains('tr') ? -1 : 1) * innerHeight * .06, ease: 'none',
          scrollTrigger: { trigger: sec, start: 'top top', end: 'bottom top', scrub: true } }); });
      if (fine && !still) { const qs = $$('#s-invite .corner, #card').map(el => ({ el, k: el.id === 'card' ? -6 : 14 }));
        addEventListener('pointermove', e => { const nx = e.clientX / innerWidth - .5, ny = e.clientY / innerHeight - .5;
          qs.forEach(({ el, k }) => gsap.to(el, { x: nx * k, y: ny * k, duration: 1.4, ease: 'power3.out', overwrite: 'auto' })); }); }
      $$('section.scene:not(#s-invite)').forEach(sec => gsap.fromTo($$('canvas.paint, picture.paint-fallback', sec), { yPercent: -4, scale: 1.1 }, { yPercent: 4, scale: 1.1, ease: 'none',
        scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: true } }));
    }

    const heroTL = reveals($('#s-invite'), { manual: true });
    $$('main > section:not(#s-invite)').forEach(s => reveals(s));
    // paint floods in as each scene arrives; petals follow the chapter's theme
    $$('section.scene:not(#s-invite)').forEach(sec => { const c = $('canvas.paint', sec); const L = c && LQ[c.dataset.scene];
      if (L && L.ok) ScrollTrigger.create({ trigger: sec, start: 'top 80%', once: true, onEnter: () => { L.busy = true; L.start();
        gsap.to(L, { reveal: 1, duration: still ? .01 : 3.2, ease: 'power1.inOut', onComplete: () => { L.busy = false; L.draw(); } }); } }); });
    $$('main > section[data-theme]').forEach(sec => ScrollTrigger.create({ trigger: sec, start: 'top 55%', end: 'bottom 55%',
      onToggle: st => { if (st.isActive) { fx.theme(sec.dataset.theme); if (sec.classList.contains('ev') && !still) fx.burst(); } } }));
    ScrollTrigger.create({ trigger: '#s-rsvp .card', start: 'top 75%', once: true, onEnter: () => drawPaths($('#s-rsvp svg.frame'), 3.2) });

    gsap.set(['#s-invite .arch', '#s-invite .corner'], { opacity: 0 });

    // -------- loader out, envelope in
    const card = $('#card');
    gsap.set(card, { opacity: 0, scale: .94 });
    gsap.timeline()
      .to('#loader .in', { opacity: 0, y: -10, duration: .6, ease: 'power2.in' })
      .to('#loader', { clipPath: 'inset(0 0 100% 0)', duration: 1.2, ease: 'expo.inOut' }, .4)
      .add(() => $('#loader').remove())
      .to(card, { opacity: 1, scale: 1, duration: 1.8, ease: 'expo.out' }, 1.0)
      .fromTo($$('#card .n, #card .a'), { clipPath: 'inset(-40% 100% -40% -12%)' }, { clipPath: 'inset(-40% -12% -40% -12%)', duration: 1.8, stagger: .35, ease: 'power2.inOut', clearProps: 'clipPath' }, 1.5)
      .from($$('#card .cel, #card .ur, #card .orn'), { opacity: 0, y: 12, duration: 1.2, stagger: .1, ease: 'power3.out' }, 2.4)
      .from('#card .hint', { opacity: 0, duration: 1 }, 2.4);
    let openedOnce = false;
    const fxInit = () => { fx.theme('garden'); fx.level(openedOnce ? (lite ? .4 : 1) : .25); if (window.FX3D) window.FX3D.setPaused(still); };
    window.FX3D ? fxInit() : addEventListener('fx3d-ready', fxInit, { once: true });
    let fxLoading = false;
    const loadFX = () => { if (fxLoading || reduce || !window.FXSRC) return; fxLoading = true; import(window.FXSRC).catch(() => {}); };
    if (!MOBILE) setTimeout(loadFX, 1500);   // desktops: petals already drift over the envelope; phones: loaded on the tap

    // ------- music: original Raag Yaman piece; starts on the envelope tap (a user gesture, so phones allow it)
    const music = $('#music'), snd = $('#sound');
    let musicOn = false;
    const fadeTo = (v, d = 2.5) => gsap.to(music, { volume: v, duration: d, ease: 'sine.inOut', overwrite: true });
    const startMusic = () => { if (!music) return; music.volume = 0; const p = music.play(); if (p && p.catch) p.catch(() => {});
      musicOn = true; snd.className = 'on'; fadeTo(.55, 3); };
    let userMuted = false;   // the guest switched the music off themselves (the pause button then leaves it off)
    const stopMusic = () => { musicOn = false; snd.className = 'off'; gsap.to(music, { volume: 0, duration: .8, onComplete: () => music.pause() });
      setTimeout(() => { if (!musicOn) music.pause(); }, 950); };
    if (snd) snd.addEventListener('click', () => { if (musicOn) { userMuted = true; stopMusic(); } else { userMuted = false; startMusic(); } });
    document.addEventListener('visibilitychange', () => { if (!music) return; if (document.hidden) music.pause(); else if (musicOn) music.play().catch(() => {}); });

    // ------- opening: bow loosens, ribbon halves part, flap swings on its top hinge, invitation rises
    let opened = false, playing = false;
    const intro = $('#intro');
    const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.inOut' } });
    tl.to('#card .hint, #card .halo', { opacity: 0, duration: .4 })
      .to('#card .bow', { scaleX: 1.05, scaleY: .96, duration: .35, ease: 'sine.inOut' }, 0)
      .to('#card .bow', { y: '-2%', scale: .7, rotate: -10, opacity: 0, duration: 1.0, ease: 'power3.in' }, .3)
      .to('#card .rib-l', { xPercent: -55, opacity: 0, duration: 1.3, ease: 'power3.in' }, .55)
      .to('#card .rib-r', { xPercent: 55, opacity: 0, duration: 1.3, ease: 'power3.in' }, .55)
      .to('#card .flap', { rotateX: 176, duration: 1.4, ease: 'power2.inOut' }, 1.3)
      .to('#card .flap', { opacity: 0, duration: .45 }, 2.35)
      .to('#card .txtgrp', { opacity: 0, y: -20, duration: .9 }, 1.8)
      .to('#card .env-fl', { opacity: 0, scale: 1.08, duration: 1.2 }, 2.0)
      .to(card, { yPercent: 70, rotate: 2, opacity: 0, duration: 1.6, ease: 'power3.in' }, 2.3)
      .to('#intro .veil', { opacity: 0, duration: 1.2 }, 2.6)
      .add(() => { if (G) { G.busy = true; G.start(); G.drop(.5, .5, 2.2); } }, 3.0)
      .fromTo(G || {}, { reveal: 0 }, { reveal: 1, duration: 3.6, ease: 'power1.inOut', immediateRender: false, onComplete: () => { if (G) G.busy = false; } }, 3.0)
      .fromTo('#s-invite .arch', { opacity: 0, clipPath: 'circle(0% at 50% 45%)' }, { opacity: 1, clipPath: 'circle(85% at 50% 45%)', duration: 2.6, ease: 'expo.inOut' }, 3.8)
      .fromTo('#s-invite .corner', { opacity: 0, scale: .8 }, { opacity: 1, scale: 1, duration: 2.6, stagger: .12, ease: 'expo.out' }, 4.2)
      .add(() => { heroTL.play(); fx.level(1); }, 4.6)
      .add(() => { intro.style.display = 'none'; document.body.classList.remove('locked'); lenis.start(); ScrollTrigger.refresh(); playing = false; setTimeout(loadFX, 600); }, 5.2)
      .fromTo('.cue', { opacity: 0 }, { opacity: 1, duration: 1.2 }, 7.2);
    const open = () => {
      if (opened || playing) return; opened = playing = true; openedOnce = true; if (!MOBILE) loadFX();
      startMusic();
      $$('#card .halo, #card .sway').forEach(el => el.style.animation = 'none');
      if (G) G.drop(.5, .38, 1.6);
      tl.timeScale(still ? 4 : 1).play(0);
    };
    const replay = () => {
      if (playing) return;
      lenis.stop(); lenis.scrollTo(0, { immediate: true, force: true }); window.scrollTo(0, 0);
      tl.pause(0); opened = false; if (G) { G.reveal = 1; G.busy = false; G.draw(); }
      $$('#card .halo, #card .sway').forEach(el => el.style.animation = '');
      intro.style.display = ''; document.body.classList.add('locked');
      gsap.fromTo(card, { opacity: 0, scale: .96 }, { opacity: 1, scale: 1, duration: 1.2, ease: 'expo.out' });
    };
    $('#card .tap').addEventListener('click', open);
    intro.addEventListener('click', e => { if (!e.target.closest('.tap')) open(); });
    addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && intro.style.display !== 'none' && !e.target.closest('button, a')) { e.preventDefault(); open(); } });
    $$('.replay').forEach(b => b.addEventListener('click', replay));

    // ------- motion toggle (pauses paint, petals, sway and glows; remembered per device)
    const mot = $('#motion');
    const setStill = (v) => { still = v; document.documentElement.classList.toggle('still', v);
      try { localStorage.setItem('ff-still', v ? '1' : '0'); } catch (e) {}
      if (mot) { mot.setAttribute('aria-pressed', String(v)); mot.setAttribute('aria-label', v ? 'Play animation' : 'Pause animation'); }
      if (window.FX3D) window.FX3D.setPaused(v);
      glints.forEach(t => v ? t.pause() : t.play()); clothVis.forEach((on, im) => v || !on ? dropCloth(im) : makeCloth(im));
      Object.values(LQ).forEach(L => { if (L.ok && L.visible) { L.stop(); L.start(); } });
      // the pause button pauses the music too, and play brings it back (unless the guest muted it themselves)
      if (openedOnce && music) { if (v && musicOn) stopMusic(); else if (!v && !musicOn && !userMuted) startMusic(); } };
    if (mot) { mot.classList.add('ready'); mot.addEventListener('click', () => setStill(!still)); }
    const fxPause = () => window.FX3D && window.FX3D.setPaused(still);
    window.FX3D ? fxPause() : addEventListener('fx3d-ready', fxPause, { once: true });
    setStill(still);
    if (!still) {
      let frames = 0, t0 = 0, slow = 0;
      const meter = (t) => { if (!openedOnce || document.hidden) { t0 = 0; return; } if (!t0) { t0 = t; frames = 0; return; } frames++;
        if (t - t0 >= 2) { const fps = frames / (t - t0); t0 = t; frames = 0; slow = fps < 26 ? slow + 1 : 0;
          if (slow >= 2) { lite = true; document.documentElement.classList.add('lite'); gsap.ticker.remove(meter);
            clothVis.forEach((on, im) => dropCloth(im)); fx.level(.4); } } };
      gsap.ticker.add(meter);
    }
    $('.cue').addEventListener('click', () => lenis.scrollTo($('#s-invite').nextElementSibling, { duration: 2 }));
  });
})();
