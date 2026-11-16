/* Furqan & Farheen — animated invitation
 * - Liquid-paint WebGL shader over the painted backgrounds (sky swirls, water ripples, wet sheen, paint-flood reveal)
 * - Envelope opening (bow unties, ribbon slides off, flap folds open, envelope drops away)
 * - Scroll-driven text reveals (GSAP + ScrollTrigger), drawn gold line-work, floating petals
 */
(function () {
  'use strict';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  gsap.registerPlugin(ScrollTrigger);

  /* ---------------------------------------------------------------- preload */
  const loaderBar = document.querySelector('#loader .bar b');
  const imgs = Array.from(document.images);
  const urls = new Set(imgs.map(i => i.currentSrc || i.src));
  ['assets/garden.jpg', 'assets/garden_mask.png', 'assets/night.jpg', 'assets/night_mask.png',
    'assets/petal0.webp', 'assets/petal1.webp', 'assets/petal2.webp', 'assets/petal3.webp'].forEach(u => urls.add(new URL(u, location.href).href));
  let done = 0;
  const total = urls.size + 1;
  const tick = () => { done++; loaderBar.style.width = Math.min(100, done / total * 100) + '%'; };
  const cache = {};
  const loadImg = (u) => new Promise(res => { const im = new Image(); im.decoding = 'async'; im.onload = im.onerror = () => { tick(); res(im); }; im.src = u; cache[u] = im; });
  const ready = Promise.all([...urls].map(loadImg).concat([document.fonts ? document.fonts.ready.then(tick) : Promise.resolve()]));

  /* ------------------------------------------------------- liquid paint GL */
  const VS = 'attribute vec2 p; varying vec2 vUv; void main(){ vUv = vec2(p.x*.5+.5, .5-p.y*.5); gl_Position = vec4(p,0.,1.); }';
  const FS = `precision highp float;
  varying vec2 vUv; uniform sampler2D uTex, uMask; uniform float uTime, uReveal, uSheen; uniform vec2 uTexel; uniform vec3 uBase;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
  float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
  float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*n(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return v; }
  void main(){
    vec2 uv = vUv; float t = uTime;
    vec4 mk = texture2D(uMask, uv);
    vec2 q = vec2(fbm(uv*vec2(3.,1.6)+vec2(t*.035,0.)), fbm(uv*vec2(3.,1.6)+vec2(5.2,1.3)-vec2(t*.028,t*.01)));
    vec2 r = vec2(fbm(uv*4.+q*2.+vec2(t*.02)), fbm(uv*4.+q*2.+vec2(8.3,2.8)));
    vec2 off = (r-.5)*.022*mk.r;                                     // sky: slow swirling wet paint
    off.x += sin(uv.y*240.-t*1.7+fbm(uv*18.)*7.)*.0022*mk.g;         // water: horizontal ripples
    off.y += sin(uv.x*70.+t*1.1)*.0012*mk.g;
    off += (vec2(fbm(uv*6.+t*.05), fbm(uv*6.-t*.045+3.))-.5)*.003;   // whole canvas breathes
    float rv = clamp(uReveal,0.,1.);
    float front = fbm(uv*3.5+vec2(0.,t*.15))*.55 + (1.-uv.y)*.25 + abs(uv.x-.5)*.2;
    float m = smoothstep(front-.02, front+.06, rv*1.25);
    off += (r-.5)*.09*(1.-m);                                        // smear as paint floods in
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
    constructor(canvas, tex, mask, opts = {}) {
      this.c = canvas; this.reveal = opts.reveal ?? 1; this.base = opts.base || [0.973, 0.953, 0.914];
      this.sheen = opts.sheen ?? 0.10; this.running = false; this.t0 = performance.now();
      const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
      if (!gl) { canvas.remove(); this.ok = false; return; }
      this.ok = true; this.gl = gl;
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s)); return s; };
      const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(pr); gl.useProgram(pr); this.pr = pr;
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const mk = (img, unit) => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
      mk(tex, 0); mk(mask, 1);
      this.U = {}; ['uTex', 'uMask', 'uTime', 'uReveal', 'uSheen', 'uTexel', 'uBase'].forEach(k => this.U[k] = gl.getUniformLocation(pr, k));
      gl.uniform1i(this.U.uTex, 0); gl.uniform1i(this.U.uMask, 1);
      gl.uniform2f(this.U.uTexel, 1.5 / tex.width, 1.5 / tex.height);
      this.resize(); window.addEventListener('resize', () => this.resize());
      new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? this.start() : this.stop()), { rootMargin: '80px' }).observe(canvas);
      this.draw(0);
    }
    resize() { const d = Math.min(window.devicePixelRatio || 1, 2); const r = this.c.getBoundingClientRect();
      this.c.width = Math.max(2, Math.round(r.width * d)); this.c.height = Math.max(2, Math.round(r.height * d));
      this.gl && this.gl.viewport(0, 0, this.c.width, this.c.height); this.draw(); }
    draw(t) { if (!this.ok) return; const gl = this.gl; t = t ?? (performance.now() - this.t0) / 1000;
      gl.uniform1f(this.U.uTime, reduce ? 0 : t); gl.uniform1f(this.U.uReveal, this.reveal); gl.uniform1f(this.U.uSheen, this.sheen);
      gl.uniform3fv(this.U.uBase, this.base); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
    start() { if (this.running || !this.ok) return; this.running = true; const loop = () => { if (!this.running) return; this.draw(); requestAnimationFrame(loop); };
      reduce ? this.draw() : requestAnimationFrame(loop); }
    stop() { this.running = false; }
  }

  /* ------------------------------------------------------------- petals */
  function petals() {
    if (reduce) return;
    const cv = document.getElementById('petals'); const ctx = cv.getContext('2d');
    const sprites = [0, 1, 2, 3].map(i => cache[new URL(`assets/petal${i}.webp`, location.href).href]);
    let W, H, d; const P = [];
    const size = () => { d = Math.min(devicePixelRatio || 1, 2); W = cv.width = innerWidth * d; H = cv.height = innerHeight * d; };
    size(); addEventListener('resize', size);
    const N = innerWidth < 600 ? 9 : 16;
    const spawn = (p, top) => { p.s = sprites[Math.random() < .45 ? 0 : Math.random() < .5 ? 1 : Math.random() < .6 ? 2 : 3];
      p.x = Math.random() * W; p.y = top ? -60 * d : Math.random() * H; p.z = .45 + Math.random() * .7;
      p.vx = (Math.random() - .3) * .35 * d; p.vy = (.35 + Math.random() * .55) * d * p.z; p.r = Math.random() * 6.3; p.vr = (Math.random() - .5) * .02;
      p.w = Math.random() * 6.3; p.flip = Math.random() * 6.3; return p; };
    for (let i = 0; i < N; i++) P.push(spawn({}, false));
    let last = performance.now();
    const loop = (now) => { const dt = Math.min(3, (now - last) / 16.7); last = now; ctx.clearRect(0, 0, W, H);
      for (const p of P) { p.w += .02 * dt; p.flip += .03 * dt; p.x += (p.vx + Math.sin(p.w) * .5 * d) * dt; p.y += p.vy * dt; p.r += p.vr * dt;
        if (p.y > H + 60 * d) spawn(p, true);
        const im = p.s; if (!im || !im.width) continue; const sc = .32 * p.z * d * Math.min(1.3, Math.max(.75, innerWidth / 500));
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.scale(1, Math.cos(p.flip)); ctx.globalAlpha = .78;
        ctx.drawImage(im, -im.width * sc / 2, -im.height * sc / 2, im.width * sc, im.height * sc); ctx.restore(); }
      requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    gsap.fromTo(cv, { opacity: 0 }, { opacity: 1, duration: 3 });
  }

  /* ---------------------------------------------------- text utilities */
  function splitChars(el) { const s = el.textContent; el.textContent = '';
    for (const ch of s) { const sp = document.createElement('span'); sp.className = 'ch'; sp.textContent = ch === ' ' ? ' ' : ch; el.appendChild(sp); }
    return el.querySelectorAll('.ch'); }
  const drawSVG = (root, dur = 2, delay = 0) => root.querySelectorAll('path, line').forEach(p => {
    if (p.closest('.leafs')) { gsap.fromTo(p, { opacity: 0, scale: .3, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: .6, delay: delay + dur * .6 + Math.random() * .6 }); return; }
    const L = p.getTotalLength ? p.getTotalLength() : 100; gsap.fromTo(p, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: dur, delay, ease: 'power2.inOut' }); });

  function revealSection(sec, opts = {}) {
    const tl = gsap.timeline({ paused: true });
    sec.querySelectorAll('.name').forEach((n, i) => tl.from(splitChars(n), { opacity: 0, y: 18, filter: 'blur(8px)', duration: 1.1, stagger: .06, ease: 'power3.out' }, .35 + i * .45));
    sec.querySelectorAll('.rv').forEach((el, i) => tl.from(el, { opacity: 0, y: 14, filter: 'blur(6px)', duration: 1.0, ease: 'power2.out' }, (+el.dataset.at || .15 * i)));
    sec.querySelectorAll('.amp').forEach(el => tl.from(el, { opacity: 0, scale: .4, rotate: -20, duration: 1.2, ease: 'back.out(2)' }, +el.dataset.at || .8));
    sec.querySelectorAll('svg.orn, svg.frame').forEach(svg => tl.add(() => drawSVG(svg, svg.classList.contains('frame') ? 3.2 : 1.4), +svg.dataset.at || .4));
    if (opts.manual) return tl;
    ScrollTrigger.create({ trigger: sec, start: 'top 72%', once: true, onEnter: () => tl.play() });
    return tl;
  }

  /* ------------------------------------------------------------- setup */
  ready.then(() => {
    const L1 = document.getElementById('paint-garden');
    const L4 = document.getElementById('paint-night');
    const g = new Liquid(L1, cache[new URL('assets/garden.jpg', location.href).href], cache[new URL('assets/garden_mask.png', location.href).href], { reveal: 0, sheen: .10 });
    const nt = new Liquid(L4, cache[new URL('assets/night.jpg', location.href).href], cache[new URL('assets/night_mask.png', location.href).href], { reveal: 1, sheen: .16, base: [0.043, 0.141, 0.122] });

    const s1 = revealSection(document.getElementById('s-invite'), { manual: true });
    ['s-details', 's-night', 's-rsvp'].forEach(id => revealSection(document.getElementById(id)));
    // night paint floods in when scrolled into view
    if (nt.ok) { nt.reveal = 0; ScrollTrigger.create({ trigger: '#s-night', start: 'top 80%', once: true,
      onEnter: () => gsap.to(nt, { reveal: 1, duration: reduce ? 0 : 3.2, ease: 'power1.inOut' }) }); }
    // gentle parallax on the static painted pages
    gsap.utils.toArray('.parallax').forEach(el => gsap.fromTo(el, { yPercent: -2.5 }, { yPercent: 2.5, ease: 'none',
      scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } }));

    const loader = document.getElementById('loader');
    loader.style.opacity = 0; setTimeout(() => loader.remove(), 900);

    // intro: envelope enters
    const env = document.getElementById('envelope');
    gsap.to(env, { opacity: 1, duration: 1.2, ease: 'power2.out', delay: .2 });
    gsap.from(env.querySelectorAll('.bow, .env-fl'), { scale: .92, duration: 1.6, ease: 'power3.out', delay: .2 });
    gsap.from(env.querySelectorAll('.env-name'), { opacity: 0, y: 12, filter: 'blur(6px)', duration: 1.4, stagger: .25, delay: .9 });

    let opened = false;
    const open = () => {
      if (opened) return; opened = true;
      const q = s => env.querySelectorAll(s);
      q('.hint, .pulse, .sway').forEach(el => { el.style.animation = 'none'; });
      const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
      tl.to(q('.hint, .pulse'), { opacity: 0, duration: .3 })
        .to(q('.bow'), { scale: 1.12, duration: .25, ease: 'power1.out' }, 0)
        .to(q('.bow'), { scale: .2, rotate: 25, opacity: 0, duration: .7, ease: 'back.in(1.6)' }, .25)
        .to(q('.rib-l'), { xPercent: -115, duration: 1.1, ease: 'power3.in' }, .45)
        .to(q('.rib-r'), { xPercent: 115, duration: 1.1, ease: 'power3.in' }, .45)
        .to(q('.flap'), { rotateX: 178, duration: 1.1, ease: 'power2.inOut' }, 1.2)
        .to(q('.flap'), { opacity: 0, duration: .3 }, 2.1)
        .to(q('.env-text'), { opacity: 0, y: -14, filter: 'blur(4px)', duration: .8 }, 1.5)
        .to(q('.env-fl'), { opacity: 0, scale: 1.15, duration: 1.0 }, 1.9)
        .to(q('.env-body'), { yPercent: 115, rotate: 2, duration: 1.3, ease: 'power3.in' }, 2.0)
        .to('#intro', { opacity: 0, duration: 1.0, ease: 'power1.out' }, 2.9)
        .add(() => { window.scrollTo(0, 0); document.body.classList.remove('locked'); }, 2.9)
        .to(g, { reveal: 1, duration: reduce ? 0 : 3.4, ease: 'power1.inOut' }, 2.6)
        .from('#s-invite .window', { opacity: 0, scale: 1.04, duration: 2.0, ease: 'power2.out' }, 3.4)
        .from('#s-invite .sway', { opacity: 0, scale: .85, duration: 2.2, stagger: .15, ease: 'power2.out' }, 3.6)
        .add(() => s1.play(), 4.2)
        .to('.cue', { opacity: 1, duration: 1 }, 6.5)
        .add(() => { document.getElementById('intro').remove(); petals(); ScrollTrigger.refresh(); }, 4.0);
      if (reduce) tl.timeScale(4);
    };
    env.querySelectorAll('.tap').forEach(t => t.addEventListener('click', open));
    document.getElementById('intro').addEventListener('click', (e) => { if (!e.target.closest('.tap')) open(); });
    if (!g.ok) gsap.set(g, { reveal: 1 });
  });
})();
