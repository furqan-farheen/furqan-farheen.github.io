/* Furqan & Farheen — immersive invitation
 * Liquid-paint WebGL (touch ripples, scroll smear, paint-flood reveal) · silk envelope opening ·
 * smooth scroll (Lenis) · masked line reveals (GSAP) · drawn gold line-work · petals & gold dust with depth.
 */
(function () {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  gsap.registerPlugin(ScrollTrigger);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const aspectKey = () => { const a = innerWidth / innerHeight; return a < 0.62 ? 'p' : a < 1.05 ? 't' : 'l'; };
  let KEY = aspectKey();
  const A = (n) => `assets/r/${n}`;

  /* ------------------------------------------------------------ preload */
  const cache = {}, IM = {};
  const load = (u) => cache[u] || (cache[u] = new Promise(res => { const im = new Image(); im.decoding = 'async';
    im.onload = () => { IM[u] = im; res(im); }; im.onerror = () => res(null); im.src = u; }));
  const setFor = (k) => [A(`garden_${k}.jpg`), A(`garden_mask_${k}.png`), A(`night_${k}.jpg`), A(`night_mask_${k}.png`)];
  const urls = [...setFor(KEY), ...$$('img').map(i => i.getAttribute('src')), ...[0, 1, 2, 3].flatMap(i => [A(`petal${i}.webp`), A(`petal${i}_b4.webp`), A(`petal${i}_b10.webp`)])];
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
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
  float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
  float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*n(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return v; }
  void main(){
    vec2 sc = uCan > uImg ? vec2(1., uImg/uCan) : vec2(uCan/uImg, 1.);
    vec2 uv = (vUv-.5)*sc+.5; float t = uTime;
    vec4 mk = texture2D(uMask, uv);
    vec2 q = vec2(fbm(uv*vec2(3.,1.6)+vec2(t*.035,0.)), fbm(uv*vec2(3.,1.6)+vec2(5.2,1.3)-vec2(t*.028,t*.01)));
    vec2 r = vec2(fbm(uv*4.+q*2.+vec2(t*.02)), fbm(uv*4.+q*2.+vec2(8.3,2.8)));
    vec2 off = (r-.5)*.022*mk.r;
    off.x += sin(uv.y*240.-t*1.7+fbm(uv*18.)*7.)*.0022*mk.g;
    off.y += sin(uv.x*70.+t*1.1)*.0012*mk.g;
    off += (vec2(fbm(uv*6.+t*.05), fbm(uv*6.-t*.045+3.))-.5)*.003;
    off.y += (fbm(uv*vec2(2.,8.)+t*.2)-.5)*uVel*.012;
    for(int i=0;i<8;i++){ vec4 d = uDrop[i]; float age = t - d.z; if(age < 0. || age > 5.) continue;
      vec2 dv = (vUv - d.xy)*vec2(uCan,1.); float rr = length(dv);
      float w = sin(rr*48. - age*6.5)*exp(-rr*5.5)*exp(-age*1.1)*d.w;
      off += dv/(rr+1e-4)*w*.0065*sc; }
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
    float edge = smoothstep(front-.02, front+.02, rv*1.25) - smoothstep(front+.02, front+.08, rv*1.25);
    c = mix(uBase, c, m) - edge*.06;
    gl_FragColor = vec4(c, 1.);
  }`;

  class Liquid {
    constructor(canvas, opts) {
      this.c = canvas; Object.assign(this, { reveal: 1, base: [0.973, 0.953, 0.914], sheen: .1, vel: 0 }, opts);
      this.drops = new Float32Array(32); this.di = 0; this.t0 = performance.now(); this.running = false;
      const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
      if (!gl) { this.ok = false; return; }
      this.ok = true; this.gl = gl;
      const sh = (ty, src) => { const s = gl.createShader(ty); gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s)); return s; };
      const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(pr); gl.useProgram(pr);
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      this.U = {}; ['uTex', 'uMask', 'uTime', 'uReveal', 'uSheen', 'uTexel', 'uBase', 'uVel', 'uImg', 'uCan', 'uDrop'].forEach(k => this.U[k] = gl.getUniformLocation(pr, k));
      gl.uniform1i(this.U.uTex, 0); gl.uniform1i(this.U.uMask, 1);
      this.tex = [gl.createTexture(), gl.createTexture()];
      this.resize(); addEventListener('resize', () => this.resize());
      new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? this.start() : this.stop()), { rootMargin: '100px' }).observe(canvas);
    }
    setImages(img, mask) {
      if (!this.ok || !img) return; const gl = this.gl; this.img = img;
      [img, mask].forEach((im, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, this.tex[i]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); });
      gl.uniform2f(this.U.uTexel, 1.4 / img.width, 1.4 / img.height); gl.uniform1f(this.U.uImg, img.width / img.height); this.draw();
    }
    resize() { const d = Math.min(devicePixelRatio || 1, 2); const r = this.c.getBoundingClientRect();
      this.c.width = Math.max(2, Math.round(r.width * d)); this.c.height = Math.max(2, Math.round(r.height * d));
      if (this.gl) { this.gl.viewport(0, 0, this.c.width, this.c.height); this.gl.uniform1f(this.U.uCan, r.width / Math.max(1, r.height)); } this.draw(); }
    now() { return (performance.now() - this.t0) / 1000; }
    drop(x, y, s = 1) { const i = (this.di++ % 8) * 4; this.drops.set([x, y, this.now(), s], i); }
    draw() { if (!this.ok || !this.img) return; const gl = this.gl, U = this.U;
      gl.uniform1f(U.uTime, reduce ? 0 : this.now()); gl.uniform1f(U.uReveal, this.reveal); gl.uniform1f(U.uSheen, this.sheen);
      gl.uniform1f(U.uVel, this.vel); gl.uniform3fv(U.uBase, this.base); gl.uniform4fv(U.uDrop, this.drops); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
    start() { if (this.running || !this.ok) return; this.running = true; const loop = () => { if (!this.running) return; this.draw(); requestAnimationFrame(loop); };
      reduce ? this.draw() : requestAnimationFrame(loop); }
    stop() { this.running = false; }
    // map image-space (fx, fy) to element-space fractions for the current cover crop
    map(fx, fy) { const r = this.c.getBoundingClientRect(); const ca = r.width / r.height, ia = this.img.width / this.img.height;
      const sc = ca > ia ? [1, ia / ca] : [ca / ia, 1]; return [(fx - .5) / sc[0] + .5, (fy - .5) / sc[1] + .5]; }
  }

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

  function buildArch() {
    const box = $('.arch'), svg = $('.arch svg.paper'); const w = box.clientWidth, h = box.clientHeight;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const outer = cuspedArch(w / 2, h, w, h, .70, 9, .028);
    const inner = cuspedArch(w / 2, h - w * .03, w * .92, h - w * .07, .70, 9, .028);
    $('#archPaper').setAttribute('d', pathD(outer, true));
    $('#archLip').setAttribute('d', pathD(outer, true));
    $('#archGold').setAttribute('d', pathD(inner.slice(1, -1), false));
    $('#archGold').setAttribute('stroke-width', Math.max(.8, w * .0035));
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
    svg.innerHTML = html;
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
      else if (kind === 'chars') tl.from(splitChars(el), { yPercent: 70, opacity: 0, filter: 'blur(10px)', duration: 1.4, stagger: .05, ease: 'expo.out' }, at);
      else if (kind === 'draw') tl.add(() => drawPaths(el, +el.dataset.dur || 1.6), at);
      else if (kind === 'amp') tl.from(el, { opacity: 0, scale: .3, rotate: -25, duration: 1.4, ease: 'back.out(1.8)' }, at);
      else tl.from(el, { opacity: 0, y: 24, filter: 'blur(6px)', duration: 1.2, ease: 'power3.out' }, at);
    });
    if (!opts.manual) ScrollTrigger.create({ trigger: scope, start: 'top 70%', once: true, onEnter: () => tl.play() });
    return tl;
  }

  /* ----------------------------------------------------------- fx canvas */
  function fx() {
    const cv = $('#fx'), ctx = cv.getContext('2d'); let W, H, d;
    const size = () => { d = Math.min(devicePixelRatio || 1, 2); W = cv.width = innerWidth * d; H = cv.height = innerHeight * d; };
    size(); addEventListener('resize', size);
    const sp = (n) => IM[A(n)];
    const sharp = [0, 1, 2, 3], P = [], D = [];
    const small = innerWidth < 700;
    // three depth planes: far (soft, small, slow) · mid (sharp) · near (large, very soft, fast, rare)
    const planes = [{ n: small ? 5 : 8, z: .38, blur: 4 }, { n: small ? 5 : 7, z: .7, blur: 0 }, { n: small ? 1 : 2, z: 1.5, blur: 10 }];
    const make = (pl, top) => ({ pl, z: pl.z * (0.85 + Math.random() * .3), x: Math.random() * W, y: top ? -80 * d : Math.random() * H,
      vx: (.15 + Math.random() * .35) * d, vy: (.25 + Math.random() * .35) * d, r: Math.random() * 6.3, vr: (Math.random() - .5) * .012,
      fl: Math.random() * 6.3, vf: .008 + Math.random() * .02, w: Math.random() * 6.3, k: sharp[(Math.random() * 4) | 0] });
    planes.forEach(pl => { for (let i = 0; i < pl.n; i++) P.push(make(pl, false)); });
    for (let i = 0; i < (small ? 26 : 46); i++) D.push({ x: Math.random(), y: Math.random(), s: .5 + Math.random() * 1.6, p: Math.random() * 6.3, v: .2 + Math.random() * .6 });
    const mote = document.createElement('canvas'); mote.width = mote.height = 32; const mc = mote.getContext('2d');
    const g = mc.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,236,190,1)'); g.addColorStop(.25, 'rgba(232,200,130,.55)'); g.addColorStop(1, 'rgba(232,200,130,0)');
    mc.fillStyle = g; mc.fillRect(0, 0, 32, 32);
    let gust = 0, last = performance.now(); state.fx = { petals: 0, dust: 1 };
    const loop = (now) => {
      const dt = Math.min(3, (now - last) / 16.7); last = now; const T = now / 1000; ctx.clearRect(0, 0, W, H);
      gust = .5 + .5 * Math.sin(T * .23) * Math.sin(T * .11 + 1.3);
      // dust
      ctx.globalCompositeOperation = 'lighter';
      for (const m of D) { m.y -= .00012 * m.v * dt; m.x += Math.sin(T * .3 + m.p) * .00008 * dt; if (m.y < -.02) { m.y = 1.02; m.x = Math.random(); }
        const tw = .35 + .65 * Math.pow(.5 + .5 * Math.sin(T * (0.6 + m.v) + m.p * 3), 3);
        const s = (4 + m.s * 5) * d; ctx.globalAlpha = tw * .55 * state.fx.dust; ctx.drawImage(mote, m.x * W - s / 2, m.y * H - s / 2, s, s); }
      ctx.globalCompositeOperation = 'source-over';
      if (state.fx.petals > 0) for (const p of P) {
        p.w += .015 * dt; p.fl += p.vf * dt; p.r += p.vr * dt;
        p.x += (p.vx * (1 + gust * 1.6) + Math.sin(p.w) * .4 * d) * p.z * dt; p.y += (p.vy + Math.cos(p.w * .7) * .15 * d) * p.z * dt;
        if (p.y > H + 90 * d || p.x > W + 90 * d) Object.assign(p, make(p.pl, true), { x: Math.random() * W * .9 - W * .2 });
        const im = sp(p.pl.blur ? `petal${p.k}_b${p.pl.blur}.webp` : `petal${p.k}.webp`); if (!im) continue;
        const base = (small ? 22 : 30) * d * p.z, sx = Math.cos(p.fl), sy = .75 + .25 * Math.sin(p.fl * .7);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.scale(sx, sy);
        ctx.globalAlpha = state.fx.petals * (p.pl.z > 1 ? .55 : p.pl.z < .5 ? .6 : .92) * (.7 + .3 * Math.abs(sx));
        ctx.drawImage(im, -base / 2, -base / 2 * 1.15, base, base * 1.15); ctx.restore(); }
      requestAnimationFrame(loop);
    };
    if (!reduce) requestAnimationFrame(loop);
  }
  const state = {};

  /* -------------------------------------------------------------- main */
  all.then(async () => {
    const lenis = new Lenis({ lerp: .085, smoothWheel: true, syncTouch: false });
    lenis.stop(); lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0);

    const G = new Liquid($('#gl-garden'), { reveal: 1, sheen: .1 });
    const N = new Liquid($('#gl-night'), { reveal: 0, sheen: .16, base: [0.043, 0.141, 0.122] });
    const apply = async () => { const [g, gm, n, nm] = await Promise.all(setFor(KEY).map(load));
      G.setImages(g, gm); N.setImages(n, nm);
      $('#fb-garden').src = A(`garden_${KEY}.jpg`); $('#fb-night').src = A(`night_${KEY}.jpg`);
      $$('#s-rsvp .strip img.sky').forEach(i => i.src = A(`strip_${KEY}.webp`)); placeGlows(); };
    const placeGlows = () => { const wrap = $('#glows'); if (!N.img) return; wrap.innerHTML = '';
      (window.LIGHTS[KEY] || []).forEach(([fx, fy, w], i) => { const [x, y] = N.map(fx, fy); if (x < -.05 || x > 1.05) return;
        const el = document.createElement('i'); el.className = 'glow'; const s = (w >= 1 ? 15 : 7) * (0.6 + .4 * w);
        Object.assign(el.style, { left: x * 100 + '%', top: y * 100 + '%', width: s + 'vmin', height: s + 'vmin', animationDuration: (2.2 + (i * .37) % 1.8) + 's', animationDelay: -((i * .61) % 2) + 's' });
        wrap.appendChild(el); }); };
    if (!G.ok) $('#gl-garden').remove(); if (!N.ok) $('#gl-night').remove();
    await apply();
    buildArch(); buildFrame();
    let rT; addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(() => { buildArch(); buildFrame(); const k = aspectKey();
      if (k !== KEY) { KEY = k; apply(); } else placeGlows(); ScrollTrigger.refresh(); }, 160); });

    // pointer ripples on the paint
    const ripple = (e, s) => { [G, N].forEach(L => { if (!L.ok) return; const r = L.c.getBoundingClientRect();
      if (e.clientY < r.top || e.clientY > r.bottom) return; L.drop((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, s); }); };
    let lastDrop = 0; addEventListener('pointermove', e => { const t = performance.now(); if (t - lastDrop > 90) { lastDrop = t; ripple(e, .35); } }, { passive: true });
    addEventListener('pointerdown', e => ripple(e, 1), { passive: true });
    lenis.on('scroll', ({ velocity }) => { const v = Math.max(-1, Math.min(1, velocity / 40)); G.vel = N.vel = v; });
    gsap.ticker.add(() => { G.vel *= .92; N.vel *= .92; });

    // cursor
    if (fine) { const c = $('#cursor'), ring = $('#cursor-ring'), pos = { x: innerWidth / 2, y: innerHeight / 2 }, rp = { ...pos };
      addEventListener('pointermove', e => { pos.x = e.clientX; pos.y = e.clientY; c.style.transform = `translate(${pos.x}px,${pos.y}px)`; });
      gsap.ticker.add(() => { rp.x += (pos.x - rp.x) * .16; rp.y += (pos.y - rp.y) * .16; ring.style.transform = `translate(${rp.x}px,${rp.y}px)`; });
      document.addEventListener('pointerover', e => { const t = e.target.closest('a, button, .tap'); ring.classList.toggle('big', !!t);
        ring.querySelector('.lbl').textContent = t ? (t.dataset.cursor || '') : ''; }); }

    // parallax: corners drift with pointer & scroll
    if (!reduce) {
      $$('.corner').forEach((el, i) => { const sec = el.closest('section') || el.closest('#intro');
        if (sec && sec.tagName === 'SECTION') gsap.fromTo(el, { y: 0 }, { y: () => (el.classList.contains('tl') || el.classList.contains('tr') ? -1 : 1) * innerHeight * .06, ease: 'none',
          scrollTrigger: { trigger: sec, start: 'top top', end: 'bottom top', scrub: true } }); });
      if (fine) { const qs = $$('#s-invite .corner, #card').map(el => ({ el, k: el.id === 'card' ? -6 : 14 }));
        addEventListener('pointermove', e => { const nx = e.clientX / innerWidth - .5, ny = e.clientY / innerHeight - .5;
          qs.forEach(({ el, k }) => gsap.to(el, { x: nx * k, y: ny * k, duration: 1.4, ease: 'power3.out', overwrite: 'auto' })); }); }
      gsap.fromTo('#gl-night, #fb-night', { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: '#s-night', start: 'top bottom', end: 'bottom top', scrub: true } });
    }

    const heroTL = reveals($('#s-invite'), { manual: true });
    ['#s-details', '#s-night', '#s-rsvp'].forEach(s => reveals($(s)));
    ScrollTrigger.create({ trigger: '#s-night', start: 'top 75%', once: true, onEnter: () => gsap.to(N, { reveal: 1, duration: reduce ? 0 : 3.4, ease: 'power1.inOut' }) });
    ScrollTrigger.create({ trigger: '#s-rsvp .card', start: 'top 75%', once: true, onEnter: () => drawPaths($('#s-rsvp svg.frame'), 3.2) });
    gsap.set('#s-rsvp svg.frame', { opacity: 1 });
    ScrollTrigger.create({ trigger: '#s-night', start: 'top 60%', end: 'bottom top', onToggle: s => gsap.to(state.fx, { dust: s.isActive ? 2 : 1, duration: 1.5 }) });

    fx();
    // hero pieces hidden until the envelope opens
    gsap.set(['.arch', '#s-invite .corner'], { opacity: 0 });

    // -------- loader out, envelope in
    const card = $('#card');
    gsap.set(card, { opacity: 0, scale: .94 });
    const intro = gsap.timeline();
    intro.to('#loader .in', { opacity: 0, y: -10, duration: .6, ease: 'power2.in' })
      .to('#loader', { clipPath: 'inset(0 0 100% 0)', duration: 1.2, ease: 'expo.inOut' }, .4)
      .add(() => $('#loader').remove())
      .to(card, { opacity: 1, scale: 1, duration: 1.8, ease: 'expo.out' }, 1.0)
      .from($$('#card .n, #card .a, #card .cel, #card .ur, #card .orn'), { opacity: 0, y: 14, filter: 'blur(6px)', duration: 1.4, stagger: .1, ease: 'power3.out' }, 1.6)
      .from('#card .hint', { opacity: 0, duration: 1 }, 2.4);

    let opened = false;
    const open = () => {
      if (opened) return; opened = true;
      $$('#card .halo, #card .sway').forEach(el => el.style.animation = 'none');
      G.drop(.5, .38, 1.6);
      const tl = gsap.timeline({ defaults: { ease: 'power3.inOut' } });
      tl.to('#card .hint, #card .halo', { opacity: 0, duration: .4 })
        // the bow loosens, then slips off
        .to('#card .bow', { scaleX: 1.06, scaleY: .96, duration: .35, ease: 'sine.inOut' }, 0)
        .to('#card .bow', { y: '-3%', scale: .55, rotate: -14, opacity: 0, filter: 'blur(4px)', duration: 1.0, ease: 'power3.in' }, .3)
        .to('#card .rib-l', { xPercent: -60, opacity: 0, duration: 1.3, ease: 'power3.in' }, .55)
        .to('#card .rib-r', { xPercent: 60, opacity: 0, duration: 1.3, ease: 'power3.in' }, .55)
        // flap folds back in 3D
        .to('#card .flap', { rotateX: 178, duration: 1.4, ease: 'power2.inOut' }, 1.3)
        .to('#card .flap', { opacity: 0, duration: .4 }, 2.4)
        .to('#card .txtgrp', { opacity: 0, y: -20, filter: 'blur(6px)', duration: .9 }, 1.8)
        .to('#card .env-fl', { opacity: 0, scale: 1.12, duration: 1.2 }, 2.0)
        .to(card, { yPercent: 75, rotate: 3, opacity: 0, duration: 1.6, ease: 'power3.in' }, 2.3)
        .to('#intro .veil', { opacity: 0, duration: 1.2 }, 2.6)
        .add(() => { G.reveal = 0; G.drop(.5, .5, 2.2); }, 3.0)
        .to(G, { reveal: 1, duration: reduce ? 0 : 3.6, ease: 'power1.inOut' }, 3.0)
        .fromTo('.arch', { opacity: 0, clipPath: 'circle(0% at 50% 45%)' }, { opacity: 1, clipPath: 'circle(85% at 50% 45%)', duration: 2.6, ease: 'expo.inOut' }, 3.8)
        .fromTo('#s-invite .corner', { opacity: 0, scale: .8 }, { opacity: 1, scale: 1, duration: 2.6, stagger: .12, ease: 'expo.out' }, 4.2)
        .add(() => { heroTL.play(); gsap.to(state.fx, { petals: 1, duration: 4 }); }, 4.6)
        .add(() => { $('#intro').remove(); document.body.classList.remove('locked'); lenis.start(); ScrollTrigger.refresh(); }, 5.2)
        .to('.cue', { opacity: 1, duration: 1.2 }, 7.2);
      if (reduce) tl.timeScale(5);
    };
    $('#card .tap').addEventListener('click', open);
    $('#intro').addEventListener('click', e => { if (!e.target.closest('.tap')) open(); });
    addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') open(); });
    $('.cue').addEventListener('click', () => lenis.scrollTo('#s-details', { duration: 2 }));
  });
})();
