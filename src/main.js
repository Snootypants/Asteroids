// Three.js Asteroids MVP with juicy visuals
// Uses CDN modules; run via local server for CORS-safe ES modules.

import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.js';
import { EffectComposer } from 'https://unpkg.com/three@0.158.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.158.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://unpkg.com/three@0.158.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'https://unpkg.com/three@0.158.0/examples/jsm/postprocessing/ShaderPass.js';
import { OutlinePass } from 'https://unpkg.com/three@0.158.0/examples/jsm/postprocessing/OutlinePass.js';

// Boot marker for diagnostics
window.__gameBoot = 'starting';

// Config
const WORLD = {
  width: 180,  // 4x larger play area (was 90)
  height: 120,  // 4x larger play area (was 60)
};

const PLAYER = {
  accel: 40,
  maxSpeed: 40,
  friction: 0.98,
  turn: 3.2,
  fireRate: 0.16,
};

const ASTEROIDS = {
  large: { r: 6, score: 20, next: 'medium', count: 2 },
  medium: { r: 3.5, score: 50, next: 'small', count: 2 },
  small: { r: 2.0, score: 100, next: null, count: 0 },
  baseSpeed: 8,
};

const BULLET = { speed: 70, life: 1.1, r: 0.2 }; // Reduced radius by 50%

const ENEMY = {
  radius: 1.2,
  accel: 20,
  maxSpeed: 26,
  fireRate: 0.9,
  bulletSpeed: 55,
  bulletLife: 1.6,
  score: 150,
  preferredDist: 14,
};

// Utils
const rand = (a, b) => a + Math.random() * (b - a);
const randSign = () => (Math.random() < 0.5 ? -1 : 1);
const clampMag = (vx, vy, max) => {
  const m2 = vx * vx + vy * vy;
  if (m2 > max * max) {
    const m = Math.sqrt(m2);
    return [(vx / m) * max, (vy / m) * max];
  }
  return [vx, vy];
};
function clamp(v, min, max) { return v < min ? min : (v > max ? max : v); }

// Basic 2D wrapping in X/Y plane (uses full world bounds, not visible area)
function wrap(obj) {
  // Use full world bounds regardless of zoom level
  // This means objects wrap around the larger 3x3 total world, not just visible area
  const zoomFactor = 1 / 1.0; // Use the max zoom-out factor (1.0) to define full world
  const hw = (WORLD.width * 0.5) * zoomFactor;
  const hh = (WORLD.height * 0.5) * zoomFactor;
  if (obj.position.x > hw) obj.position.x = -hw;
  if (obj.position.x < -hw) obj.position.x = hw;
  if (obj.position.y > hh) obj.position.y = -hh;
  if (obj.position.y < -hh) obj.position.y = hh;
}

function circleHit(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const rr = ar + br;
  return dx * dx + dy * dy <= rr * rr;
}

// Scene setup
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
renderer.domElement.id = 'game-canvas';
console.log('[Asteroids] renderer init', renderer.capabilities.isWebGL2 ? 'WebGL2' : 'WebGL1');
// Improve overall brightness/contrast handling
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
if (window.__status) window.__status.log('Renderer: ' + (renderer.capabilities.isWebGL2 ? 'WebGL2' : 'WebGL1'));

// Orthographic camera for crisp, arcade feel
const aspect = window.innerWidth / window.innerHeight;
let currentZoom = 1.0; // Show about 1/4 of total world area
const frustumHeight = WORLD.height;
const frustumWidth = frustumHeight * aspect;
const camera = new THREE.OrthographicCamera(
  -frustumWidth / 2,
  frustumWidth / 2,
  frustumHeight / 2,
  -frustumHeight / 2,
  0.1,
  100,
);
camera.position.set(0, 0, 10);
camera.lookAt(0, 0, 0);
camera.zoom = currentZoom;
camera.updateProjectionMatrix();

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x02040a, 0.004);
renderer.setClearColor(0x070a14, 1);

// Starfield background
let currentStars = null;
let warpEffect = { active: false, progress: 0, direction: { x: 0, y: 1 } };

function makeStars() {
  // Remove existing stars
  if (currentStars) {
    scene.remove(currentStars);
  }
  
  const g = new THREE.BufferGeometry();
  const count = 1200;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  
  for (let i = 0; i < count; i++) {
    positions[i * 3 + 0] = rand(-WORLD.width * 1.5, WORLD.width * 1.5);
    positions[i * 3 + 1] = rand(-WORLD.height * 1.5, WORLD.height * 1.5);
    positions[i * 3 + 2] = rand(-50, -5); // Further back to ensure visibility
    sizes[i] = rand(0.5, 1.5);
  }
  
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  
  const m = new THREE.PointsMaterial({ 
    size: 1.0, // Larger base size
    color: 0x88aaff, 
    transparent: true, 
    opacity: 0.8, // More visible
    sizeAttenuation: true, // Size based on distance
    vertexColors: false
  });
  
  currentStars = new THREE.Points(g, m);
  currentStars.userData.kind = 'stars';
  currentStars.userData.originalPositions = positions.slice();
  currentStars.renderOrder = -1; // Render behind everything
  scene.add(currentStars);
  
  console.log('[Asteroids] Stars generated:', count);
}

function startWarpEffect() {
  if (!ship || !currentStars) return;
  
  warpEffect.active = true;
  warpEffect.progress = 0;
  warpEffect.direction.x = Math.cos(ship.rotation.z);
  warpEffect.direction.y = Math.sin(ship.rotation.z);
}

function updateWarpEffect(dt) {
  if (!warpEffect.active || !currentStars) return;
  
  warpEffect.progress += dt * 3.0; // Faster warp effect
  
  const positions = currentStars.geometry.attributes.position;
  const originalPositions = currentStars.userData.originalPositions;
  
  for (let i = 0; i < positions.count; i++) {
    const i3 = i * 3;
    const origX = originalPositions[i3];
    const origY = originalPositions[i3 + 1];
    const origZ = originalPositions[i3 + 2];
    
    if (warpEffect.progress < 1.0) {
      // Stretch stars in ship direction with more dramatic effect
      const stretchFactor = warpEffect.progress * 25; // More dramatic stretch
      const newX = origX + warpEffect.direction.x * stretchFactor;
      const newY = origY + warpEffect.direction.y * stretchFactor;
      
      positions.setXYZ(i, newX, newY, origZ);
    }
  }
  
  positions.needsUpdate = true;
  
  // Add visual feedback
  if (warpEffect.progress < 1.0) {
    // Make stars brighter during warp
    currentStars.material.opacity = 0.8 + (warpEffect.progress * 0.4);
  }
  
  if (warpEffect.progress >= 1.0) {
    warpEffect.active = false;
    console.log('[Asteroids] Warp effect complete');
    // Generate new starfield after warp
    setTimeout(() => makeStars(), 100);
  }
}

makeStars();

// Postprocessing bloom for glow
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
// Outline pass to boost asteroid/enemy readability
const outlineTargets = [];
const outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), scene, camera);
outlinePass.edgeStrength = 3.0;
outlinePass.edgeGlow = 0.4;
outlinePass.edgeThickness = 1.0;
outlinePass.pulsePeriod = 0.0;
outlinePass.visibleEdgeColor.set(0xd7f0ff);
outlinePass.hiddenEdgeColor.set(0x111319);
composer.addPass(outlinePass);
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.9, 0.8, 0.85);
bloom.threshold = 0.2;
bloom.strength = 1.25;
bloom.radius = 0.6;
composer.addPass(bloom);

// Soft vignette
const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    offset: { value: 1.15 },
    darkness: { value: 0.55 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float offset; uniform float darkness; varying vec2 vUv; void main(){ vec4 texel = texture2D(tDiffuse, vUv); vec2 uv = vUv - 0.5; float vignette = smoothstep(0.8, offset, length(uv)); gl_FragColor = vec4(texel.rgb*(1.0 - vignette*darkness), texel.a); }`
};
const vignettePass = new ShaderPass(VignetteShader);
composer.addPass(vignettePass);
if (window.__status) window.__status.log('PostFX ready');
console.log('[Asteroids] post-processing ready');

// Resize handling
function onResize() {
  const aspect = window.innerWidth / window.innerHeight;
  const frustumH = WORLD.height;
  const frustumW = frustumH * aspect;
  camera.left = -frustumW / 2;
  camera.right = frustumW / 2;
  camera.top = frustumH / 2;
  camera.bottom = -frustumH / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  outlinePass.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

// Zoom controls (Q = zoom in, A = zoom out)
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'q') { 
    currentZoom = Math.min(1.8, currentZoom + 0.1); 
    camera.zoom = currentZoom; 
    camera.updateProjectionMatrix(); 
  }
  if (k === 'a') { 
    currentZoom = Math.max(0.6, currentZoom - 0.1); 
    camera.zoom = currentZoom; 
    camera.updateProjectionMatrix(); 
  }
});

// Materials
const glowMat = new THREE.MeshStandardMaterial({ color: 0xa5c8ff, emissive: 0x335dff, emissiveIntensity: 1.7, roughness: 0.25, metalness: 0.0 });
const bulletMat = new THREE.MeshStandardMaterial({ color: 0xffcc88, emissive: 0xff8800, emissiveIntensity: 2.0, roughness: 0.2, metalness: 0.1 });
// Simple toon gradient texture
function makeToonGradient(stopsIn) {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 1;
  const ctx = c.getContext('2d');
  // Brighter stops for better readability
  const stops = stopsIn || ['#6f8fc0', '#a9c4ea', '#dceafe', '#ffffff'];
  for (let i = 0; i < 4; i++) { ctx.fillStyle = stops[i]; ctx.fillRect(i, 0, 1, 1); }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.needsUpdate = true;
  return tex;
}
const toonGradient = makeToonGradient();

function makeToonRimMaterial(color = 0xb9c9dc, gradient = toonGradient, rimColor = 0x9fd0ff, rimStrength = 0.8, rimPower = 2.0) {
  const mat = new THREE.MeshToonMaterial({ color, gradientMap: gradient });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.rimStrength = { value: rimStrength };
    shader.uniforms.rimPower = { value: rimPower };
    shader.uniforms.rimColor = { value: new THREE.Color(rimColor) };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float rimStrength;\nuniform float rimPower;\nuniform vec3 rimColor;`)
      .replace('gl_FragColor = vec4( outgoingLight, diffuseColor.a );', `
        // Rim lighting added to toon output
        vec3 V = normalize(-vViewPosition);
        vec3 N = normalize(normal);
        float rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), rimPower);
        outgoingLight += rimColor * (rim * rimStrength);
        gl_FragColor = vec4( outgoingLight, diffuseColor.a );
      `);
  };
  mat.needsUpdate = true;
  return mat;
}

const asteroidBaseMat = makeToonRimMaterial(0xeff7ff, toonGradient, 0xffffff, 1.25, 1.8);

// Palette variants for asteroids
function asteroidMaterialVariant() {
  const pick = Math.random();
  if (pick < 0.33) {
    // Ice
    return makeToonRimMaterial(0xeaf6ff, makeToonGradient(['#88aee8','#b8d4ff','#e6f2ff','#ffffff']), 0xffffff, 1.3, 1.6);
  } else if (pick < 0.66) {
    // Crystal
    return makeToonRimMaterial(0xf1e8ff, makeToonGradient(['#8b6fe0','#b79cff','#e9e1ff','#ffffff']), 0xf3eaff, 1.2, 1.8);
  } else {
    // Metal
    return makeToonRimMaterial(0xe9f0f7, makeToonGradient(['#6f7f9a','#aeb9cc','#dfe7f1','#ffffff']), 0xffffff, 1.1, 1.6);
  }
}
const enemyMat = new THREE.MeshStandardMaterial({ color: 0xff6b6b, emissive: 0x882222, emissiveIntensity: 1.0, roughness: 0.4, metalness: 0.1 });
const enemyBulletMat = new THREE.MeshStandardMaterial({ color: 0xff8888, emissive: 0xff4444, emissiveIntensity: 1.2, roughness: 0.2, metalness: 0.1 });

// Lights
const key = new THREE.PointLight(0x6688ff, 1.4, 220);
key.position.set(20, 15, 20);
scene.add(key);
scene.add(new THREE.AmbientLight(0x334455, 0.85));
const hemi = new THREE.HemisphereLight(0x98b7ff, 0x1b2030, 0.55);
scene.add(hemi);
const fill = new THREE.DirectionalLight(0x88a0ff, 0.4);
fill.position.set(-18, -12, 14);
scene.add(fill);

// Simple pooled sprite particles for hits and engine/muzzle flashes
class ParticleSystem {
  constructor(count = 300) {
    this.pool = [];
    this.active = new Set();
    const mat = new THREE.SpriteMaterial({ color: 0xffcc88, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
    for (let i = 0; i < count; i++) {
      const s = new THREE.Sprite(mat.clone());
      s.scale.set(0.4, 0.4, 1);
      s.userData = { vx: 0, vy: 0, life: 0, ttl: 0 };
      s.visible = false;
      this.pool.push(s);
      scene.add(s);
    }
  }
  emitBurst(x, y, opts = {}) {
    const { count = 14, speed = [8, 24], life = [0.35, 0.8], size = [0.25, 0.9], color = 0xffcc88 } = opts;
    for (let i = 0; i < count; i++) {
      const s = this.pool.pop();
      if (!s) break;
      s.material.color.setHex(color);
      const ang = Math.random() * Math.PI * 2;
      const spd = rand(speed[0], speed[1]);
      s.userData.vx = Math.cos(ang) * spd;
      s.userData.vy = Math.sin(ang) * spd;
      s.userData.ttl = rand(life[0], life[1]);
      s.userData.life = s.userData.ttl;
      const sz = rand(size[0], size[1]);
      s.scale.set(sz, sz, 1);
      s.position.set(x, y, 0);
      s.visible = true;
      this.active.add(s);
    }
  }
  update(dt) {
    for (const s of Array.from(this.active)) {
      s.userData.life -= dt;
      if (s.userData.life <= 0) {
        s.visible = false;
        this.active.delete(s);
        this.pool.push(s);
        continue;
      }
      s.position.x += s.userData.vx * dt;
      s.position.y += s.userData.vy * dt;
      const t = s.userData.life / s.userData.ttl;
      s.material.opacity = t;
    }
  }
}
const particles = new ParticleSystem(350);
console.log('[Asteroids] particles ready');
if (window.__status) window.__status.log('Particles ready');

// Reticle and mouse aiming system
const reticleEl = document.getElementById('reticle');
let mouseScreen = { x: window.innerWidth/2, y: window.innerHeight/2 };

function setReticle(x, y, show = true) { 
  if (!reticleEl) return; 
  reticleEl.style.left = `${x}px`; 
  reticleEl.style.top = `${y}px`; 
  reticleEl.hidden = !show; 
}

// Mouse tracking for ship rotation
window.addEventListener('mousemove', (e) => { 
  mouseScreen.x = e.clientX; 
  mouseScreen.y = e.clientY; 
  // Only show reticle when mouse aiming is active
  if (!pausedForUpgrade && !gameOver && !paused && mouse.enabled) {
    setReticle(mouseScreen.x, mouseScreen.y, true); 
  } else {
    setReticle(0, 0, false);
  }
});

// Convert screen coordinates to world coordinates
function screenToWorld(sx, sy) {
  const ndcX = (sx / window.innerWidth) * 2 - 1;
  const ndcY = -(sy / window.innerHeight) * 2 + 1;
  const wx = THREE.MathUtils.mapLinear(ndcX, -1, 1, camera.left, camera.right) + camera.position.x;
  const wy = THREE.MathUtils.mapLinear(ndcY, -1, 1, camera.bottom, camera.top) + camera.position.y;
  return new THREE.Vector3(wx, wy, 0);
}

// Simple SFX using WebAudio (oscillator based) with master volume/mute
const SFX = (() => {
  let ctx = null, master = null;
  let volume = 0.8; let muted = false;
  const storage = {
    load() {
      const v = localStorage.getItem('sfxVolume');
      const m = localStorage.getItem('sfxMuted');
      if (v !== null) volume = Math.max(0, Math.min(1, parseFloat(v)));
      if (m !== null) muted = m === 'true';
    },
    save() { localStorage.setItem('sfxVolume', String(volume)); localStorage.setItem('sfxMuted', String(muted)); }
  };
  storage.load();
  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = AC ? new AC() : null;
      if (ctx) {
        master = ctx.createGain();
        master.gain.value = muted ? 0 : volume;
        master.connect(ctx.destination);
      }
    }
  }
  function env(node, t = 0.15) {
    const now = ctx.currentTime;
    node.gain.cancelScheduledValues(now);
    node.gain.setValueAtTime(0.0001, now);
    node.gain.exponentialRampToValueAtTime(0.5, now + 0.01);
    node.gain.exponentialRampToValueAtTime(0.0001, now + t);
  }
  function tone(freq = 440, t = 0.1, type = 'square') {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type; osc.frequency.value = freq;
    osc.connect(g); g.connect(master || ctx.destination);
    env(g, t);
    osc.start();
    osc.stop(ctx.currentTime + t);
  }
  const api = {
    unlock() { ensureCtx(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    setVolume(v) { ensureCtx(); volume = Math.max(0, Math.min(1, v)); if (master) master.gain.value = muted ? 0 : volume; storage.save(); },
    toggleMute() { ensureCtx(); muted = !muted; if (master) master.gain.value = muted ? 0 : volume; storage.save(); return muted; },
    isMuted() { return muted; },
    getVolume() { return volume; },
    play(name) {
      ensureCtx(); if (!ctx) return;
      switch (name) {
        case 'shoot': tone(880, 0.08, 'square'); break;
        case 'ricochet': tone(1200, 0.06, 'triangle'); break;
        case 'hit': tone(200, 0.12, 'sawtooth'); break;
        case 'explode': tone(90, 0.2, 'sawtooth'); break;
        case 'shield': tone(440, 0.18, 'triangle'); break;
        case 'upgrade': tone(660, 0.2, 'square'); setTimeout(()=>tone(990,0.15,'square'),60); break;
        case 'gameover': tone(220, 0.3, 'sawtooth'); break;
        case 'pickup': tone(880, 0.05, 'triangle'); break;
        case 'shop': tone(520, 0.12, 'triangle'); break;
        default: break;
      }
    }
  };
  window.addEventListener('mousedown', api.unlock, { once: true });
  window.addEventListener('keydown', api.unlock, { once: true });
  return api;
})();

// Debris shards for asteroid breaks
class DebrisSystem {
  constructor(count = 220) {
    this.pool = [];
    this.active = new Set();
    const geo = new THREE.TetrahedronGeometry(0.4);
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 1, metalness: 0, transparent: true, opacity: 1 }));
      m.visible = false;
      m.userData = { vx: 0, vy: 0, life: 0, ttl: 0, rot: 0 };
      this.pool.push(m);
      scene.add(m);
    }
  }
  burst(x, y, base = 8) {
    const n = base + Math.floor(Math.random() * base);
    for (let i = 0; i < n; i++) {
      const m = this.pool.pop(); if (!m) break;
      const a = Math.random() * Math.PI * 2;
      const sp = rand(6, 20);
      m.userData.vx = Math.cos(a) * sp; m.userData.vy = Math.sin(a) * sp;
      m.userData.ttl = rand(0.6, 1.3); m.userData.life = m.userData.ttl;
      m.userData.rot = rand(-4, 4);
      m.position.set(x, y, 0);
      m.rotation.z = Math.random() * Math.PI * 2;
      m.material.opacity = 1;
      m.visible = true;
      this.active.add(m);
    }
  }
  update(dt) {
    for (const m of Array.from(this.active)) {
      m.userData.life -= dt;
      if (m.userData.life <= 0) { m.visible = false; this.active.delete(m); this.pool.push(m); continue; }
      m.position.x += m.userData.vx * dt; m.position.y += m.userData.vy * dt; wrap(m);
      m.rotation.z += m.userData.rot * dt;
      const t = m.userData.life / m.userData.ttl; m.material.opacity = t;
      const s = 0.4 + 0.6 * t; m.scale.setScalar(s);
    }
  }
}
const debris = new DebrisSystem(260);

// Minimap System
class MinimapSystem {
  constructor() {
    this.canvas = document.getElementById('minimapCanvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.worldWidth = (WORLD.width * 0.5) * (1 / 1.0); // Full world bounds
    this.worldHeight = (WORLD.height * 0.5) * (1 / 1.0);
    this.scale = Math.min(this.canvas?.width / (this.worldWidth * 2), this.canvas?.height / (this.worldHeight * 2));
  }
  
  worldToMinimap(x, y) {
    if (!this.canvas) return { x: 0, y: 0 };
    const mapX = (x + this.worldWidth) * this.scale;
    const mapY = this.canvas.height - (y + this.worldHeight) * this.scale; // Flip Y coordinate
    return { x: mapX, y: mapY };
  }
  
  render() {
    if (!this.ctx || !this.canvas) return;
    
    // Clear canvas
    this.ctx.fillStyle = 'rgba(2, 4, 10, 0.9)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw world bounds
    this.ctx.strokeStyle = 'rgba(120, 150, 255, 0.3)';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw visible area (current camera view)
    if (camera && ship) {
      const visibleWidth = (WORLD.width * 0.5) / camera.zoom;
      const visibleHeight = (WORLD.height * 0.5) / camera.zoom;
      const visX1 = (ship.position.x - visibleWidth + this.worldWidth) * this.scale;
      const visY1 = (ship.position.y - visibleHeight + this.worldHeight) * this.scale;
      const visX2 = (ship.position.x + visibleWidth + this.worldWidth) * this.scale;
      const visY2 = (ship.position.y + visibleHeight + this.worldHeight) * this.scale;
      
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(visX1, visY1, visX2 - visX1, visY2 - visY1);
    }
    
    // Draw asteroids
    if (asteroids && asteroids.length > 0) {
      asteroids.forEach(asteroid => {
        const pos = this.worldToMinimap(asteroid.position.x, asteroid.position.y);
        const size = asteroid.userData.size === 'large' ? 4 : asteroid.userData.size === 'medium' ? 3 : 2;
        
        this.ctx.fillStyle = 'rgba(180, 220, 255, 0.8)';
        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
        this.ctx.fill();
      });
    }
    
    // Draw enemies
    if (enemies && enemies.length > 0) {
      enemies.forEach(enemy => {
        const pos = this.worldToMinimap(enemy.position.x, enemy.position.y);
        this.ctx.fillStyle = 'rgba(255, 120, 120, 0.9)';
        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
        this.ctx.fill();
      });
    }
    
    // Draw player ship
    if (ship && ship.visible) {
      const pos = this.worldToMinimap(ship.position.x, ship.position.y);
      this.ctx.fillStyle = 'rgba(160, 255, 160, 1.0)';
      this.ctx.beginPath();
      this.ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Draw ship direction indicator
      const shipDirection = ship.rotation.z + Math.PI/2;
      const dirX = Math.cos(shipDirection) * 6;
      const dirY = -Math.sin(shipDirection) * 6; // Flip Y for minimap coordinate system
      this.ctx.strokeStyle = 'rgba(160, 255, 160, 0.8)';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(pos.x, pos.y);
      this.ctx.lineTo(pos.x + dirX, pos.y + dirY);
      this.ctx.stroke();
    }
  }
}

const minimap = new MinimapSystem();
console.log('[Asteroids] minimap ready');
if (window.__status) window.__status.log('Minimap ready');

// Ship
function createShip() {
  // Load ship texture
  const loader = new THREE.TextureLoader();
  const shipTexture = loader.load(
    'assets/ship/ship.png',
    // onLoad callback
    (texture) => {
      console.log('[Asteroids] Ship texture loaded successfully');
      if (window.__status) window.__status.log('Ship texture loaded');
    },
    // onProgress callback
    undefined,
    // onError callback
    (error) => {
      console.error('[Asteroids] Failed to load ship texture:', error);
      if (window.__status) window.__status.log('Ship texture FAILED to load');
    }
  );
  
  // Create ship sprite - but sprites don't rotate visually like meshes!
  // We need to use a PlaneGeometry with the texture instead for proper rotation
  const shipGeometry = new THREE.PlaneGeometry(3.0, 3.0);
  const shipMaterial = new THREE.MeshBasicMaterial({ 
    map: shipTexture, 
    transparent: true,
    opacity: 1.0,
    side: THREE.DoubleSide // Ensure it's visible from both sides
  });
  
  const mesh = new THREE.Mesh(shipGeometry, shipMaterial);
  mesh.userData = { kind: 'ship', vx: 0, vy: 0, rot: 0, alive: true, fireCooldown: 0, radius: 1.5 };
  scene.add(mesh);
  
  console.log('[Asteroids] Ship mesh created (not sprite), rotation:', mesh.rotation.z);
  return mesh;
}

// Boost flame particles system
function createBoostFlames() {
  const flameGeometry = new THREE.PlaneGeometry(0.8, 1.5);
  const flameMaterial = new THREE.MeshBasicMaterial({ 
    color: 0x4488ff, 
    transparent: true, 
    opacity: 0.8,
    blending: THREE.AdditiveBlending
  });
  
  const flame1 = new THREE.Mesh(flameGeometry, flameMaterial.clone());
  const flame2 = new THREE.Mesh(flameGeometry, flameMaterial.clone());
  
  flame1.userData = { kind: 'boostFlame', baseOpacity: 0.8, flickerOffset: 0 };
  flame2.userData = { kind: 'boostFlame', baseOpacity: 0.6, flickerOffset: Math.PI };
  
  flame1.visible = false;
  flame2.visible = false;
  
  scene.add(flame1);
  scene.add(flame2);
  
  return [flame1, flame2];
}

// Update boost flames position and effects
function updateBoostFlames(flames, ship, thrusting, dt) {
  if (!flames || flames.length === 0) return;
  
  const [flame1, flame2] = flames;
  
  if (thrusting) {
    // Position flames behind ship (opposite direction of ship facing)
    const flameDistance = 2.2; // Distance behind ship
    const flameOffset = 0.3;
    
    // Ship mesh faces up by default, rotation.z is the ship's facing direction
    const shipDirection = ship.rotation.z + Math.PI/2; // Convert to movement direction
    
    // Place flames behind ship (opposite of movement direction)
    flame1.position.set(
      ship.position.x - Math.cos(shipDirection) * flameDistance,
      ship.position.y - Math.sin(shipDirection) * flameDistance + flameOffset,
      ship.position.z
    );
    
    flame2.position.set(
      ship.position.x - Math.cos(shipDirection) * flameDistance,
      ship.position.y - Math.sin(shipDirection) * flameDistance - flameOffset,
      ship.position.z
    );
    
    // Rotate flames to match ship direction
    flame1.rotation.z = ship.rotation.z;
    flame2.rotation.z = ship.rotation.z;
    
    // Animate flame opacity for flickering effect
    const time = performance.now() * 0.01;
    flame1.material.opacity = flame1.userData.baseOpacity + Math.sin(time + flame1.userData.flickerOffset) * 0.3;
    flame2.material.opacity = flame2.userData.baseOpacity + Math.sin(time * 1.3 + flame2.userData.flickerOffset) * 0.2;
    
    // Animate flame scale for pulsing effect
    const scaleFlicker = 1.0 + Math.sin(time * 2) * 0.15;
    flame1.scale.set(scaleFlicker, scaleFlicker * 1.2, 1);
    flame2.scale.set(scaleFlicker * 0.8, scaleFlicker, 1);
    
    flame1.visible = true;
    flame2.visible = true;
  } else {
    flame1.visible = false;
    flame2.visible = false;
  }
}

// Engine trail (simple line that updates)
function createTrail() {
  const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -3, 0)];
  const g = new THREE.BufferGeometry().setFromPoints(points);
  const m = new THREE.LineBasicMaterial({ color: 0x88aaff, transparent: true, opacity: 0.7 });
  const line = new THREE.Line(g, m);
  line.userData.kind = 'trail';
  line.visible = false;
  scene.add(line);
  return line;
}

// Bullet - now thin glowing lines
function createBullet(x, y, dir, addVx = 0, addVy = 0) {
  // Create a thin cylinder instead of sphere for line-like appearance
  const g = new THREE.CylinderGeometry(BULLET.r * 0.3, BULLET.r * 0.3, 1.2, 6);
  g.rotateZ(Math.PI / 2); // Rotate to point along X axis
  const bullet = new THREE.Mesh(g, bulletMat);
  bullet.position.set(x, y, 0);
  bullet.rotation.z = dir; // Align with direction of travel
  const vx = Math.cos(dir) * BULLET.speed + addVx;
  const vy = Math.sin(dir) * BULLET.speed + addVy;
  bullet.userData = { kind: 'bullet', vx, vy, life: BULLET.life, radius: BULLET.r, damage: 1 };
  scene.add(bullet);
  return bullet;
}

// Asteroid geometry: noisy icosahedron
function makeAsteroidGeo(radius) {
  const g = new THREE.IcosahedronGeometry(radius, 1);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i);
    const n = (Math.sin(v.x * 1.7) + Math.cos(v.y * 1.3) + Math.sin(v.z * 2.1)) * 0.5;
    v.addScaledVector(v.clone().normalize(), n);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

function createAsteroid(sizeKey, x, y, vx, vy) {
  const def = ASTEROIDS[sizeKey];
  const geo = makeAsteroidGeo(def.r);
  const mat = asteroidMaterialVariant();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, 0);
  mesh.rotation.z = Math.random() * Math.PI * 2;
  mesh.userData = {
    kind: 'asteroid',
    size: sizeKey,
    vx: vx ?? rand(-ASTEROIDS.baseSpeed, ASTEROIDS.baseSpeed),
    vy: vy ?? rand(-ASTEROIDS.baseSpeed, ASTEROIDS.baseSpeed),
    rot: rand(-1, 1),
    radius: def.r * 0.9,
    ore: chooseOreType(),
  };
  // Add edge lines for readability
  const egeo = new THREE.EdgesGeometry(geo, 20);
  const lines = new THREE.LineSegments(egeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
  mesh.add(lines);
  scene.add(mesh);
  outlineTargets.push(mesh);
  return mesh;
}

function chooseOreType(){
  const r = Math.random();
  if (r > 0.995) return 'adam';
  if (r > 0.97) return 'platinum';
  if (r > 0.9) return 'gold';
  return 'iron';
}

// Boss sprite system
let bossSprites = [
  'boss1.png', 'boss2.png', 'boss3.png', 'boss4.png', 'boss5.png',
  'boss6.png', 'boss7.png', 'boss8.png', 'boss9.png', 'boss10.png'
];
let availableBossSprites = [...bossSprites]; // Copy for tracking

function getRandomBossSprite() {
  if (availableBossSprites.length === 0) {
    // Reset the pool when all sprites have been used
    availableBossSprites = [...bossSprites];
  }
  
  const randomIndex = Math.floor(Math.random() * availableBossSprites.length);
  const selectedSprite = availableBossSprites[randomIndex];
  
  // Remove from available pool
  availableBossSprites.splice(randomIndex, 1);
  
  return selectedSprite;
}

// Enemy hunter
function createHunter(x, y) {
  // Use boss texture on a plane mesh instead of sprite for proper rotation
  const loader = new THREE.TextureLoader();
  const bossSprite = getRandomBossSprite();
  const bossTexture = loader.load(`assets/boss/${bossSprite}`);
  
  // Create plane geometry with boss texture for proper rotation
  const bossGeometry = new THREE.PlaneGeometry(4.0, 4.0);
  const bossMaterial = new THREE.MeshBasicMaterial({ 
    map: bossTexture, 
    transparent: true,
    opacity: 1.0,
    side: THREE.DoubleSide // Ensure it's visible from both sides
  });
  
  const mesh = new THREE.Mesh(bossGeometry, bossMaterial);
  mesh.position.set(x, y, 0);
  
  // Calculate boss number based on wave (wave 3 = boss 1, wave 6 = boss 2, etc.)
  const bossNumber = Math.floor(wave / 3);
  // Each boss is 20% faster than the previous one
  const speedMultiplier = 1 + (bossNumber - 1) * 0.2;
  
  mesh.userData = { 
    kind: 'enemy', 
    vx: 0, 
    vy: 0, 
    radius: ENEMY.radius,
    maxSpeed: ENEMY.maxSpeed * speedMultiplier,
    accel: ENEMY.accel * speedMultiplier
  };
  
  scene.add(mesh);
  enemies.push(mesh);
  outlineTargets.push(mesh);
  console.log('[Asteroids] Boss mesh created (not sprite), rotation:', mesh.rotation.z);
  return mesh;
}

function createEnemyBullet(x, y, dir) {
  const g = new THREE.SphereGeometry(0.35, 8, 8);
  const b = new THREE.Mesh(g, enemyBulletMat);
  b.position.set(x, y, 0);
  b.userData = { kind: 'eBullet', vx: Math.cos(dir) * ENEMY.bulletSpeed, vy: Math.sin(dir) * ENEMY.bulletSpeed, life: ENEMY.bulletLife, radius: 0.35 };
  scene.add(b);
  return b;
}

function eShoot(x, y, dir) { eBullets.push(createEnemyBullet(x, y, dir)); }

// Telegraph beacon then spawn enemy
function spawnBeacon(x, y, delay, onDone) {
  const ringG = new THREE.RingGeometry(0.2, 0.35, 32);
  const ringM = new THREE.MeshBasicMaterial({ color: 0xff6688, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringG, ringM);
  ring.position.set(x, y, 0);
  ring.userData = { ttl: delay, t: 0 };
  scene.add(ring);
  const update = (dt) => {
    ring.userData.ttl -= dt; ring.userData.t += dt;
    const s = 0.2 + ring.userData.t * 3.0; ring.scale.setScalar(s);
    ring.material.opacity = Math.max(0, 0.9 - ring.userData.t * 0.7);
    if (ring.userData.ttl <= 0) {
      scene.remove(ring);
      onDone();
      afterUpdates.delete(update);
    }
  };
  afterUpdates.add(update);
}

// Input system
const keys = new Set();
const mouse = { enabled: true, lmb: false, rmb: false };

// Hook to run small update callbacks each frame (for beacons)
const afterUpdates = new Set();

// Keyboard input handling
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (document.pointerLockElement === renderer.domElement) {
      document.exitPointerLock?.();
    } else if (started && !gameOver && !pausedForUpgrade) {
      togglePause();
    }
    e.preventDefault();
    return;
  }
  
  // Debug toggle: press 't' to spawn a bright marker
  if (e.key.toLowerCase() === 't') {
    const g = new THREE.BoxGeometry(2, 2, 2);
    const m = new THREE.MeshBasicMaterial({ color: 0x00ffcc, wireframe: true });
    const cube = new THREE.Mesh(g, m);
    cube.position.set(0, 0, 0);
    scene.add(cube);
    console.log('[Asteroids] Debug cube added at origin');
  }
  
  keys.add(e.key.toLowerCase());
  if (e.key === ' ') e.preventDefault();
});

window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

// Mouse input handling
window.addEventListener('mousedown', (e) => { 
  if (pausedForUpgrade || gameOver) return; 
  if (e.button === 0) mouse.lmb = true; 
  if (e.button === 2) mouse.rmb = true; 
});

window.addEventListener('mouseup', (e) => { 
  if (e.button === 0) mouse.lmb = false; 
  if (e.button === 2) mouse.rmb = false; 
});

window.addEventListener('contextmenu', (e) => { 
  if (!pausedForUpgrade && !gameOver && mouse.enabled) e.preventDefault(); 
});

// State
let ship = createShip();
let boostFlames = createBoostFlames();
const trail = createTrail();
let bullets = [];
let asteroids = [];
let enemies = [];
let eBullets = [];
let pickups = [];
let score = 0;
let wave = 1;
let gameOver = false;
let paused = false; // Add pause state
let invuln = 0; // seconds of spawn invulnerability
let combo = 1;
let comboTimer = 0; // time left to sustain combo
let pausedForUpgrade = false;
// Drone helpers
let drones = [];
let playerShotCounter = 0; // Track player shots for drone shooting
const comboEl = document.getElementById('combo');

const scoreEl = document.getElementById('score');
const waveEl = document.getElementById('wave');
const gameoverEl = document.getElementById('gameover');
const finalScoreEl = document.getElementById('finalScore');
const sfxVolEl = document.getElementById('sfxVol');
const sfxMuteEl = document.getElementById('sfxMute');
const frameEl = document.getElementById('frameCounter');
const toggleLogBtn = document.getElementById('toggleLog');
const takenEl = document.getElementById('taken');
const startOverlay = document.getElementById('startOverlay');
const endOverlay = document.getElementById('endOverlay');
const endStatsEl = document.getElementById('endStats');
const hangarEl = document.getElementById('hangar');
const shopCardsEl = document.getElementById('shopCards');
const leaveHangarBtn = document.getElementById('leaveHangar');
const nextMissionBtn = document.getElementById('nextMission');
const rerollBtn = document.getElementById('rerollShop');
const banishBtn = document.getElementById('banishOne');
const toggleVisBtn = document.getElementById('toggleVis');

// Hangar currency display elements
const hangarSalvageEl = document.getElementById('hangarSalvage');
const hangarGoldEl = document.getElementById('hangarGold');
const hangarPlatinumEl = document.getElementById('hangarPlatinum');
const hangarAdamantiumEl = document.getElementById('hangarAdamantium');
const rerollCostEl = document.getElementById('rerollCost');

function setCanvasBlur(on){ const c = document.getElementById('game-canvas'); if(!c) return; if(on) c.classList.add('blurred'); else c.classList.remove('blurred'); }

// Currencies
let salvage=0, gold=0, platinum=0, adamantium=0;
const salvageEl = document.getElementById('salvageCount');
const goldEl = document.getElementById('goldCount');
const platEl = document.getElementById('platCount');
const adamEl = document.getElementById('adamCount');
function updateCurrencyHUD(){ 
  if(salvageEl) salvageEl.textContent=salvage; 
  if(goldEl) goldEl.textContent=gold; 
  if(platEl) platEl.textContent=platinum; 
  if(adamEl) adamEl.textContent=adamantium; 
  
  // Update hangar currency display if visible
  if(hangarSalvageEl) hangarSalvageEl.textContent=salvage;
  if(hangarGoldEl) hangarGoldEl.textContent=gold;
  if(hangarPlatinumEl) hangarPlatinumEl.textContent=platinum;
  if(hangarAdamantiumEl) hangarAdamantiumEl.textContent=adamantium;
}

// Initialize SFX controls
if (sfxVolEl && sfxMuteEl) {
  // Load persisted
  const initVol = (typeof SFX.getVolume === 'function') ? SFX.getVolume() : 0.8;
  const initMuted = (typeof SFX.isMuted === 'function') ? SFX.isMuted() : false;
  sfxVolEl.value = Math.round(initVol * 100);
  sfxMuteEl.textContent = initMuted ? 'Unmute' : 'Mute';
  sfxVolEl.addEventListener('input', () => { SFX.setVolume(parseInt(sfxVolEl.value,10)/100); if (SFX.isMuted()) SFX.toggleMute(); sfxMuteEl.textContent = SFX.isMuted() ? 'Unmute' : 'Mute'; });
  sfxMuteEl.addEventListener('click', () => { const m = SFX.toggleMute(); sfxMuteEl.textContent = m ? 'Unmute' : 'Mute'; });
}
// Log toggle button always available
if (toggleLogBtn) toggleLogBtn.onclick = () => { const s = document.getElementById('status'); if (s) s.dataset.show = s.dataset.show === '1' ? '0' : '1'; };

// Reroll system variables
let rerollCount = 0;
let baseRerollCost = 15;

// Reset reroll count each hangar visit
function resetRerollSystem() {
  rerollCount = 0;
  updateRerollCost();
}

function updateRerollCost() {
  const cost = Math.floor(baseRerollCost * Math.pow(1.15, rerollCount));
  if (rerollCostEl) rerollCostEl.textContent = cost;
  return cost;
}

function handleReroll() {
  const cost = updateRerollCost();
  if (salvage < cost) return; // Can't afford
  
  salvage -= cost;
  updateCurrencyHUD();
  rerollCount++;
  
  // Regenerate shop items with potential epic bonus
  const hasEpicBonus = rerollCount >= 4;
  generateShopItems(hasEpicBonus);
  
  updateRerollCost();
  SFX.play('shop');
}

// Initialize button handlers
if (leaveHangarBtn) leaveHangarBtn.onclick = () => closeHangar(true); // Advance wave
if (nextMissionBtn) nextMissionBtn.onclick = () => closeHangar(true); // Advance wave
if (rerollBtn) rerollBtn.onclick = handleReroll;

// Upgrade history stack
const ICONS = {
  spread: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 12h6M14 6l4 6-4 6" stroke="#bde2ff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  pierce: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="6" cy="12" r="2" stroke="#bde2ff"/><circle cx="12" cy="12" r="2" stroke="#bde2ff"/><circle cx="18" cy="12" r="2" stroke="#bde2ff"/></svg>',
  fire: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3c2 3-1 4 1 7 1 2 0 4-1 5-3 0-5-2-5-5 0-3 3-5 5-7z" fill="#ffcf88" stroke="#ffc070"/></svg>',
  engine: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 12h10l4-3v6l-4-3H4z" stroke="#bde2ff"/></svg>',
  shield: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3l7 3v5c0 5-7 10-7 10S5 16 5 11V6l7-3z" stroke="#9fe2ff"/></svg>',
  ricochet: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 4v6h6M14 14h6v6" stroke="#bde2ff"/></svg>',
  drone: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="3" stroke="#9fffe6"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4" stroke="#9fffe6"/></svg>'
};
function iconFor(key, size=18) {
  const svg = ICONS[key] || ICONS.fire;
  return svg.replace(/width=\"\d+\"/, `width=\"${size}\"`).replace(/height=\"\d+\"/, `height=\"${size}\"`);
}
function pushTaken(opt) {
  if (!takenEl) return;
  const item = document.createElement('div');
  item.className = 'taken-item';
  const key = opt.key.replace(/\d+$/, '');
  const ico = ICONS[key] || ICONS.fire;
  item.innerHTML = `<div class="ico">${ico}</div><div class="txt">${opt.label}</div>`;
  
  // Insert at the top of the stack (last upgrade first)
  if (takenEl.firstChild) {
    takenEl.insertBefore(item, takenEl.firstChild);
  } else {
    takenEl.appendChild(item);
  }
  
  // Limit to showing last 8 upgrades
  while (takenEl.children.length > 8) {
    takenEl.removeChild(takenEl.lastChild);
  }
}

// Legendary nova blast: clear nearby threats and score
function novaBlast() {
  const r = 18;
  for (let i = asteroids.length - 1; i >= 0; i--) {
    const a = asteroids[i];
    const dx = a.position.x - ship.position.x; const dy = a.position.y - ship.position.y;
    if (dx*dx + dy*dy <= r*r) {
      scene.remove(a); asteroids.splice(i, 1);
      particles.emitBurst(a.position.x, a.position.y, { count: 24, speed: [16, 40], life: [0.25, 0.6], size: [0.25, 1.1], color: 0xffe0aa });
      debris.burst(a.position.x, a.position.y, 12);
      addShake(0.8, 0.2, a.position.x, a.position.y);
      score += 50; // small bonus
    }
  }
  scoreEl.textContent = `Score: ${score}`;
  SFX.play('explode');
}

// Hangar Shop (every 3 waves)
// Hangar Shop (every 3 waves)
function openHangar(){
  pausedForUpgrade = true; mouse.enabled=false; setReticle(0,0,false); SFX.play('shop'); setCanvasBlur(true);
  if (!hangarEl) return; hangarEl.hidden=false; hangarEl.classList.add('show'); hangarEl.classList.remove('hide');
  
  // Update currency display in hangar
  updateCurrencyHUD();
  
  // Reset reroll system for new hangar visit
  resetRerollSystem();
  
  generateShopItems();
}

function generateShopItems(hasEpicBonus = false) {
  const pool = [
    { key:'overclock', label:'Overclock', desc:'+60% fire rate', rarity:'epic', cost:{salv:80,gold:2} , apply:()=>mods.fireRateMul*=1.6 },
    { key:'quantum', label:'Quantum Engine', desc:'+40% accel/speed', rarity:'epic', cost:{salv:80,plat:1} , apply:()=>mods.engineMul*=1.4 },
    { key:'magnet', label:'Magnetic Collector', desc:'Bigger pickup radius', rarity:'uncommon', cost:{salv:40}, apply:()=>{mods.magnet=(mods.magnet||1.2)+0.8; mods.magnetLvl=(mods.magnetLvl||0)+1;} },
    { key:'shield', label:'Shield Charge', desc:'+1 shield', rarity:'common', cost:{salv:30}, apply:()=>mods.shields+=1 },
    { key:'drone', label:'Drone Buddy', desc:'+1 drone', rarity:'uncommon', cost:{salv:50,gold:1}, apply:()=>{ if(mods.drones<3){ addDrone(); mods.drones+=1; } } },
    { key:'ricochet', label:'Ricochet Rounds', desc:'Bullets bounce once', rarity:'uncommon', cost:{salv:60}, apply:()=>{ if(mods.ricochet<1) mods.ricochet=1; } },
  ];
  // pick 4 with potential epic bonus
  const opts = [];
  const bag = [...pool];
  
  // If hasEpicBonus, increase chance for epic items
  if (hasEpicBonus) {
    const epicItems = bag.filter(item => item.rarity === 'epic');
    // Add extra epic items to the bag to increase their chance
    bag.push(...epicItems, ...epicItems); // Triple the epic weight
  }
  
  while(opts.length < 4 && bag.length) {
    const i = Math.floor(Math.random() * bag.length);
    const item = bag.splice(i, 1)[0];
    if (!opts.find(existing => existing.key === item.key)) {
      opts.push(item);
    }
  }
  shopCardsEl.innerHTML='';
  for(const o of opts){
    const btn=document.createElement('button'); btn.className='card-btn'; btn.dataset.rarity=o.rarity||'common';
    const costStr = [o.cost?.salv?`⛭ ${o.cost.salv}`:'', o.cost?.gold?`◆ ${o.cost.gold}`:'', o.cost?.plat?`◈ ${o.cost.plat}`:'', o.cost?.adam?`⬢ ${o.cost.adam}`:''].filter(Boolean).join(' • ');
    
    // Get icon for the upgrade
    const keyBase = o.key.replace(/\d+$/, '');
    const iconSvg = iconFor(keyBase, 48);
    
    btn.innerHTML=`
      <div class="card-icon" style="text-align:center; margin-bottom:8px;">${iconSvg}</div>
      <div class="card-title" style="text-align:center; font-weight:bold; margin-bottom:6px;">${o.label}</div>
      <div class="card-desc" style="text-align:center; font-size:12px; opacity:0.9; margin-bottom:8px;">${o.desc}</div>
      ${costStr?`<div class="card-cost" style="text-align:center; font-size:11px; opacity:0.8;">${costStr}</div>`:''}
    `;
    
    const canAfford = (salvage>=(o.cost?.salv||0)) && (gold>=(o.cost?.gold||0)) && (platinum>=(o.cost?.plat||0)) && (adamantium>=(o.cost?.adam||0));
    if(!canAfford) btn.style.filter='grayscale(0.6) brightness(0.8)';
    btn.onclick=()=>{ 
      if(!canAfford) return; 
      salvage -= (o.cost?.salv||0); 
      gold-=(o.cost?.gold||0); 
      platinum-=(o.cost?.plat||0); 
      adamantium-=(o.cost?.adam||0); 
      updateCurrencyHUD(); 
      o.apply(); 
      pushTaken(o); 
      SFX.play('upgrade');
      // Remove the purchased item from the shop
      btn.style.filter='grayscale(1.0) brightness(0.5)';
      btn.style.pointerEvents='none';
      btn.innerHTML += '<div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); color:#4a90e2; font-weight:bold; font-size:16px;">PURCHASED</div>';
    };
    shopCardsEl.appendChild(btn);
  }
  // keyboard quick-pick 1-4
  const onKey=(e)=>{const items=[...shopCardsEl.querySelectorAll('.card-btn')]; if(e.key==='1'&&items[0]) items[0].click(); if(e.key==='2'&&items[1]) items[1].click(); if(e.key==='3'&&items[2]) items[2].click(); if(e.key==='4'&&items[3]) items[3].click();};
  window.addEventListener('keydown', onKey, { once:true });
}

function closeHangar(shouldAdvanceWave = true){
  if(!hangarEl) return; 
  hangarEl.classList.remove('show'); 
  hangarEl.classList.add('hide'); 
  setTimeout(()=>hangarEl.hidden=true,350);
  setCanvasBlur(false);
  pausedForUpgrade=false; 
  mouse.enabled=true; 
  
  // Set 3-second invulnerability when exiting hangar
  invuln = 3.0;
  
  // Only advance wave if explicitly requested (via button click)
  if (shouldAdvanceWave) {
    wave++; 
    spawnWave();
  }
}

function resetGame() {
  // clear scene of bullets/asteroids
  for (const b of bullets) scene.remove(b);
  for (const a of asteroids) scene.remove(a);
  bullets = [];
  asteroids = [];
  for (const eb of eBullets) scene.remove(eb); eBullets = [];
  for (const p of pickups) scene.remove(p); pickups = [];
  for (const en of enemies) scene.remove(en); enemies = [];
  // hide overlays
  if (endOverlay) { endOverlay.classList.remove('show'); endOverlay.classList.add('hide'); endOverlay.hidden = true; }
  if (hangarEl) { hangarEl.classList.remove('show'); hangarEl.classList.add('hide'); hangarEl.hidden = true; }
  setCanvasBlur(false);
  score = 0;
  wave = 1;
  gameOver = false;
  combo = 1; comboTimer = 0; comboEl.textContent = `Combo: ${combo}x`;
  ship.userData.vx = 0;
  ship.userData.vy = 0;
  ship.position.set(0, 0, 0);
  
  // Recreate boost flames
  if (boostFlames) {
    for (const flame of boostFlames) {
      if (flame) scene.remove(flame);
    }
  }
  boostFlames = createBoostFlames();
  // remove drones
  if (typeof drones !== 'undefined') {
    for (const d of drones) if (d.mesh) scene.remove(d.mesh);
    drones = [];
  }
  
  // Reset all upgrades and mods to default values (but keep currency)
  mods.fireRateMul = 1.0;
  mods.engineMul = 1.0;
  mods.spread = false;
  mods.pierce = false;
  mods.shields = 0;
  mods.ricochet = 0;
  mods.drones = 0;
  mods.magnet = undefined;
  mods.magnetLvl = undefined;
  
  // Clear upgrade tracking display
  if (takenEl) {
    takenEl.innerHTML = '';
  }
  
  // Update score and wave display
  scoreEl.textContent = `Score: ${score}`;
  waveEl.textContent = `Wave: ${wave}`;
  
  ship.rotation.z = Math.PI / 2; // pointing up (geometry aligned to +X)
  invuln = 2.0; // brief safety window
  spawnWave();
  gameoverEl.hidden = true;
}

function spawnWave() {
  const count = 3 + wave;
  for (let i = 0; i < count; i++) {
    // Spawn asteroids off-screen accounting for full world bounds
    // Use consistent full world bounds (not based on current zoom)
    const zoomFactor = 1 / 1.0; // Use the max zoom-out factor to define full world
    const visibleWidth = (WORLD.width * 0.5) * zoomFactor;
    const visibleHeight = (WORLD.height * 0.5) * zoomFactor;
    
    // Add buffer to ensure they start completely outside visible area
    const buffer = 15 * zoomFactor; // Scale buffer with zoom
    const minX = visibleWidth + buffer;
    const minY = visibleHeight + buffer;
    
    // Randomly choose whether to spawn on X or Y boundary
    let x, y;
    if (Math.random() < 0.5) {
      // Spawn on left/right edge
      x = randSign() * rand(minX, minX + 20 * zoomFactor);
      y = randSign() * rand(0, minY);
    } else {
      // Spawn on top/bottom edge
      x = randSign() * rand(0, minX);
      y = randSign() * rand(minY, minY + 20 * zoomFactor);
    }
    
    // Point toward center with some variation
    const angle = Math.atan2(-y, -x) + rand(-0.6, 0.6);
    const speed = ASTEROIDS.baseSpeed * rand(0.6, 1.2) + wave * 0.3;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    asteroids.push(createAsteroid('large', x, y, vx, vy));
  }
  waveEl.textContent = `Wave: ${wave}`;
  spawnEnemiesForWave();
  if (window.__status) window.__status.set(`Wave ${wave} — asteroids: ${count}`);
}

function spawnEnemiesForWave() {
  if (wave < 3) return;
  const count = Math.min(1 + Math.floor((wave - 2) / 2), 4);
  for (let i = 0; i < count; i++) {
    // Account for full world bounds when spawning enemies - they should appear at safe distance from visible area
    const zoomFactor = 1 / 1.0; // Use the max zoom-out factor to define full world
    const baseDistance = Math.max(WORLD.width * 0.35, WORLD.height * 0.35) * zoomFactor;
    const maxDistance = Math.max(WORLD.width * 0.48, WORLD.height * 0.48) * zoomFactor;
    const x = randSign() * rand(baseDistance, maxDistance);
    const y = randSign() * rand(baseDistance, maxDistance);
    spawnBeacon(x, y, 1.1 + Math.random()*0.4, () => createHunter(x, y));
  }
}

function splitAsteroid(a) {
  const def = ASTEROIDS[a.userData.size];
  if (!def.next) return [];
  const children = [];
  for (let i = 0; i < def.count; i++) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(ASTEROIDS.baseSpeed * 0.6, ASTEROIDS.baseSpeed * 1.2);
    const vx = Math.cos(angle) * speed + a.userData.vx * 0.2;
    const vy = Math.sin(angle) * speed + a.userData.vy * 0.2;
    children.push(createAsteroid(def.next, a.position.x, a.position.y, vx, vy));
  }
  return children;
}

function removeFrom(arr, item) {
  const i = arr.indexOf(item);
  if (i >= 0) arr.splice(i, 1);
}

// Camera shake (calmed further)
let shakeTime = 0; let shakeMag = 0;
function addShake(mag = 0.4, time = 0.1, ox = null, oy = null) {
  // Global reduction by ~65%
  let m = mag * 0.35;
  // Distance falloff if origin provided
  if (ox !== null && oy !== null) {
    const dx = (ox - ship.position.x); const dy = (oy - ship.position.y);
    const dist = Math.hypot(dx, dy);
    const maxR = Math.hypot(WORLD.width * 0.5, WORLD.height * 0.5);
    const falloff = Math.max(0, 1 - dist / maxR); // 1 near ship → 0 at far edge
    m *= falloff * 0.9;
  }
  if (m <= 0.001) return;
  shakeMag = Math.max(shakeMag, m);
  shakeTime = Math.max(shakeTime, time * 0.8);
}

// Game loop
let last = performance.now() / 1000;
let started = false;
function startRun(){ if(started) return; started = true; if(startOverlay){ startOverlay.classList.remove('show'); startOverlay.classList.add('hide'); setTimeout(()=>startOverlay.hidden=true,350);} resetGame(); }
// click anywhere on start overlay to begin
if(startOverlay){ startOverlay.addEventListener('click', startRun); }
window.__gameBoot = 'running';
console.log('[Asteroids] game loop starting');
if (window.__status) window.__status.set('Running — Wave 1');
let frames = 0;

function tick() {
  const now = performance.now() / 1000;
  let dt = now - last; last = now;
  dt = Math.min(dt, 0.033); // clamp

  if (started && !gameOver && !pausedForUpgrade && !paused) update(dt);

  if (shakeTime > 0) {
    shakeTime -= dt;
    const t = Math.random() * Math.PI * 2;
    const shakeX = Math.cos(t) * shakeMag;
    const shakeY = Math.sin(t) * shakeMag;
    // Apply shake as offset to ship-following position
    if (ship) {
      camera.position.x = ship.position.x + shakeX;
      camera.position.y = ship.position.y + shakeY;
    } else {
      camera.position.x = shakeX; 
      camera.position.y = shakeY;
    }
  } else if (ship && !paused && !gameOver) {
    // Normal ship following when not shaking
    camera.position.x = ship.position.x;
    camera.position.y = ship.position.y;
  }

  particles.update(dt);
  debris.update(dt);
  
  // Update minimap
  if (started && !gameOver) {
    minimap.render();
  }
  
  // frame counter (debug)
  frames++; if (frameEl) frameEl.textContent = String(frames);
  composer.render();
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

function update(dt) {
  // Update warp effect
  updateWarpEffect(dt);
  
  // tick invulnerability timer
  invuln = Math.max(0, invuln - dt);
  // Ship controls
  const s = ship.userData;
  // Ship rotation - aim at current cursor position
  if (mouse.enabled && !pausedForUpgrade && !paused && !gameOver) {
    const w = screenToWorld(mouseScreen.x, mouseScreen.y);
    const dx = w.x - ship.position.x;
    const dy = w.y - ship.position.y;
    const distance = Math.hypot(dx, dy);
    
    // Scale minimum distance with zoom to prevent jittery rotation
    const minDistance = 0.8 / camera.zoom;
    
    // Only update rotation if mouse is not too close to ship
    if (distance > minDistance) {
      const ang = Math.atan2(dy, dx);
      ship.rotation.z = ang - Math.PI/2; // Adjust for mesh facing up by default
    }
  }
  const turnLeft = keys.has('a') || keys.has('arrowleft');
  const turnRight = keys.has('d') || keys.has('arrowright');
  const thrust = keys.has('w') || keys.has('arrowup');
  const fire = keys.has(' ');

  if (!mouse.enabled) {
    if (turnLeft) ship.rotation.z += PLAYER.turn * dt;
    if (turnRight) ship.rotation.z -= PLAYER.turn * dt;
  }

  const thrusting = mouse.rmb || thrust;
  if (thrusting) {
    // Ship mesh faces up, rotation.z is already the direction to move
    const shipDirection = ship.rotation.z + Math.PI/2; // Convert ship rotation to movement direction
    const ax = Math.cos(shipDirection) * tunedAccel() * dt;
    const ay = Math.sin(shipDirection) * tunedAccel() * dt;
    s.vx += ax; s.vy += ay;
    trail.visible = true;
    // occasional engine particles
    if (Math.random() < 0.5) {
      particles.emitBurst(ship.position.x - Math.cos(shipDirection) * 1.2, ship.position.y - Math.sin(shipDirection) * 1.2, { count: 2, speed: [10, 18], life: [0.15, 0.28], size: [0.18, 0.35], color: 0x88bbff });
    }
  } else {
    trail.visible = false;
  }
  
  // Update boost flames
  updateBoostFlames(boostFlames, ship, thrusting, dt);

  [s.vx, s.vy] = clampMag(s.vx, s.vy, tunedMaxSpeed());
  s.vx *= PLAYER.friction; s.vy *= PLAYER.friction;
  ship.position.x += s.vx * dt;
  ship.position.y += s.vy * dt;
  wrap(ship);

  // Update drones
  updateDrones(dt);

  // Update trail positions
  if (trail.visible) {
    const p = ship.position;
    const shipDirection = ship.rotation.z + Math.PI/2; // Convert mesh rotation to direction
    const tail = new THREE.Vector3(-Math.cos(shipDirection) * 2.4, -Math.sin(shipDirection) * 2.4, 0).add(p);
    const head = new THREE.Vector3(-Math.cos(shipDirection) * 0.6, -Math.sin(shipDirection) * 0.6, 0).add(p);
    const pts = trail.geometry.attributes.position;
    pts.setXYZ(0, head.x, head.y, 0);
    pts.setXYZ(1, tail.x, tail.y, 0);
    pts.needsUpdate = true;
  }

  // Shooting
  s.fireCooldown -= dt;
  const firing = mouse.lmb || fire;
  if (firing && s.fireCooldown <= 0) {
    shoot();
    playerShotCounter++;
    // Drones shoot every 2nd player shot
    if (playerShotCounter % 2 === 0) {
      triggerDroneShooting();
    }
    s.fireCooldown = PLAYER.fireRate / mods.fireRateMul;
    addShake(0.15, 0.06);
    // Muzzle flash particles
    const shipDirection = ship.rotation.z + Math.PI/2; // Convert mesh rotation to direction
    particles.emitBurst(ship.position.x + Math.cos(shipDirection) * 1.2, ship.position.y + Math.sin(shipDirection) * 1.2, { count: 6, speed: [10, 26], life: [0.08, 0.18], size: [0.18, 0.5], color: 0xffe6aa });
    SFX.play('shoot');
  }

  // Update bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.userData.life -= dt;
    if (b.userData.life <= 0) {
      scene.remove(b); bullets.splice(i, 1); continue;
    }
    b.position.x += b.userData.vx * dt;
    b.position.y += b.userData.vy * dt;
    wrap(b);
  }

  // Ricochet handling for bullets at bounds
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    if (!b.userData || !b.userData.ricochet) continue;
    // Use same full world bounds as wrap() function
    const zoomFactor = 1 / 1.0; // Use the max zoom-out factor to define full world
    const hw = (WORLD.width * 0.5) * zoomFactor, hh = (WORLD.height * 0.5) * zoomFactor; let bounced = false;
    if (b.position.x > hw) { b.position.x = hw; b.userData.vx *= -1; bounced = true; }
    if (b.position.x < -hw) { b.position.x = -hw; b.userData.vx *= -1; bounced = true; }
    if (b.position.y > hh) { b.position.y = hh; b.userData.vy *= -1; bounced = true; }
    if (b.position.y < -hh) { b.position.y = -hh; b.userData.vy *= -1; bounced = true; }
    if (bounced) { b.userData.ricochet -= 1; particles.emitBurst(b.position.x, b.position.y, { count: 6, speed: [8, 18], life: [0.08, 0.18], size: [0.18, 0.4], color: 0xbbe0ff }); SFX.play('ricochet'); if (b.userData.ricochet <= 0) b.userData.ricochet = 0; }
  }

  // Update asteroids
  for (const a of asteroids) {
    a.position.x += a.userData.vx * dt;
    a.position.y += a.userData.vy * dt;
    a.rotation.z += a.userData.rot * dt;
    wrap(a);
  }

  // Update enemies - bosses now chase player without shooting
  for (const e of enemies) {
    const dx = ship.position.x - e.position.x;
    const dy = ship.position.y - e.position.y;
    const dist = Math.hypot(dx, dy) + 1e-3;
    const dirx = dx / dist, diry = dy / dist;
    // Always chase the player (no preferred distance)
    e.userData.vx += dirx * e.userData.accel * dt;
    e.userData.vy += diry * e.userData.accel * dt;
    [e.userData.vx, e.userData.vy] = clampMag(e.userData.vx, e.userData.vy, e.userData.maxSpeed);
    e.position.x += e.userData.vx * dt; e.position.y += e.userData.vy * dt; wrap(e);
    
    // Make boss meshes rotate in the direction they are moving
    const moveDirection = Math.atan2(e.userData.vy, e.userData.vx);
    e.rotation.z = moveDirection - Math.PI/2; // Mesh faces up, adjust like player ship
    
    // Bosses no longer shoot - removed shooting logic
  }

  // Enemy bullets removed - bosses no longer shoot
  // Clean up any remaining enemy bullets
  for (let i = eBullets.length - 1; i >= 0; i--) {
    scene.remove(eBullets[i]);
    eBullets.splice(i, 1);
  }
  // Update floating pickups
  updatePickups(dt);
  // Run misc callbacks (beacons)
  for (const cb of Array.from(afterUpdates)) cb(dt);
  

  // Bullet-asteroid collisions
  outer: for (let i = asteroids.length - 1; i >= 0; i--) {
    const a = asteroids[i];
    for (let j = bullets.length - 1; j >= 0; j--) {
      const b = bullets[j];
      if (circleHit(a.position.x, a.position.y, a.userData.radius, b.position.x, b.position.y, b.userData.radius)) {
        // remove bullet and asteroid, add children
        // handle piercing bullets
        if (b.userData.pierce > 0) {
          b.userData.pierce -= 1;
        } else {
          scene.remove(b); bullets.splice(j, 1);
        }
        scene.remove(a); asteroids.splice(i, 1); const oi = outlineTargets.indexOf(a); if (oi>=0) outlineTargets.splice(oi,1);
        const def = ASTEROIDS[a.userData.size];
        // combo handling
        combo += 1; comboTimer = 2.3; // 2.3s to continue chain
        const mult = 1 + 0.2 * (combo - 1);
        score += Math.round(def.score * mult);
        comboEl.textContent = `Combo: ${combo}x`;
        scoreEl.textContent = `Score: ${score}`;
        // spawn pickups
        spawnDrops(a);
        // particles burst
        particles.emitBurst(a.position.x, a.position.y, { count: 16, speed: [12, 36], life: [0.25, 0.6], size: [0.25, 1.0], color: 0xaad0ff });
        debris.burst(a.position.x, a.position.y, Math.floor(def.r * 2));
        const kids = splitAsteroid(a);
        asteroids.push(...kids);
        addShake(0.5, 0.12, a.position.x, a.position.y);
        if (kids.length === 0) SFX.play('explode'); else SFX.play('hit');
        break outer;
      }
    }
  }

  // Player bullets vs enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    for (let j = bullets.length - 1; j >= 0; j--) {
      const b = bullets[j];
      if (circleHit(e.position.x, e.position.y, ENEMY.radius, b.position.x, b.position.y, b.userData.radius)) {
        if (b.userData.pierce > 0) b.userData.pierce -= 1; else { scene.remove(b); bullets.splice(j, 1); }
        scene.remove(e); enemies.splice(i, 1); { const oi = outlineTargets.indexOf(e); if (oi>=0) outlineTargets.splice(oi,1); }
        combo += 1; comboTimer = 2.3; const mult = 1 + 0.2 * (combo - 1);
        score += Math.round(ENEMY.score * mult); scoreEl.textContent = `Score: ${score}`; comboEl.textContent = `Combo: ${combo}x`;
        particles.emitBurst(e.position.x, e.position.y, { count: 18, speed: [14, 34], life: [0.25, 0.55], size: [0.22, 0.8], color: 0xffaaaa });
        debris.burst(e.position.x, e.position.y, 8); SFX.play('explode');
        addShake(0.6, 0.12, e.position.x, e.position.y);
        break;
      }
    }
  }

  // Ship-asteroid collisions
  if (invuln <= 0) {
    for (const a of asteroids) {
      if (circleHit(a.position.x, a.position.y, a.userData.radius, ship.position.x, ship.position.y, ship.userData.radius)) {
        if (mods.shields > 0) {
          mods.shields -= 1;
          invuln = 1.0;
          particles.emitBurst(ship.position.x, ship.position.y, { count: 24, speed: [20, 40], life: [0.2, 0.5], size: [0.3, 1.2], color: 0x66ccff }); SFX.play('shield');
          addShake(0.8, 0.2, ship.position.x, ship.position.y);
          break;
        } else {
          die('Asteroid collision');
        }
        break;
      }
    }
    
    // Check drone-asteroid collisions and push drones away (immunity)
    for (const drone of drones) {
      if (!drone.mesh) continue;
      for (const a of asteroids) {
        if (circleHit(a.position.x, a.position.y, a.userData.radius, drone.mesh.position.x, drone.mesh.position.y, 0.5)) {
          // Push drone away from asteroid instead of destroying it
          const dx = drone.mesh.position.x - a.position.x;
          const dy = drone.mesh.position.y - a.position.y;
          const dist = Math.hypot(dx, dy) + 1e-3;
          const pushForce = 15; // Strong push to get clear
          drone.mesh.position.x += (dx / dist) * pushForce * dt;
          drone.mesh.position.y += (dy / dist) * pushForce * dt;
        }
      }
    }
    // enemy vs ship (ram)
    for (const e of enemies) {
      if (circleHit(e.position.x, e.position.y, ENEMY.radius, ship.position.x, ship.position.y, ship.userData.radius)) {
        if (mods.shields > 0) { mods.shields -= 1; invuln = 1.0; particles.emitBurst(ship.position.x, ship.position.y, { count: 20, speed: [18, 36], life: [0.2, 0.45], size: [0.3, 1.0], color: 0x66ccff }); SFX.play('shield'); addShake(0.6, 0.12, ship.position.x, ship.position.y); }
        else { die('Enemy collision'); }
        break;
      }
    }
    // Enemy bullets removed - bosses no longer shoot
  }

  // Next wave
  if (asteroids.length === 0) {
    // Magnet pulse: after 3+ magnet upgrades, auto-collect remaining pickups on wave end
    if ((mods.magnetLvl||0) >= 3 && pickups.length) {
      for (let i = pickups.length - 1; i >= 0; i--) {
        const p = pickups[i];
        collectPickup(p);
        scene.remove(p);
        pickups.splice(i, 1);
      }
    }
    // Start warp effect before showing upgrade/hangar
    startWarpEffect();
    
    // Delay the upgrade/hangar screen to allow warp effect to play
    setTimeout(() => {
      const nextWave = wave + 1;
      if (nextWave % 3 === 0) openHangar(); else offerUpgrades();
    }, 600);
  }

  updateShieldVisual();
}

function die(reason = 'Destroyed') {
  if (gameOver) return;
  gameOver = true;
  // visual pop
  ship.visible = false;
  addShake(1.0, 0.5, ship.position.x, ship.position.y);
  finalScoreEl.textContent = `Final Score: ${score}`;
  const deathEl = document.getElementById('deathReason');
  if (deathEl) deathEl.textContent = `Cause: ${reason}`;
  gameoverEl.hidden = true;
  if (endOverlay) {
    if (endStatsEl) endStatsEl.textContent = `Score ${score} • Salvage ${salvage} • Gold ${gold} • Plat ${platinum} • Adam ${adamantium}`;
    const endDeathEl = document.getElementById('endDeathReason');
    if (endDeathEl) endDeathEl.textContent = `Destroyed by: ${reason}`;
    endOverlay.hidden = false; endOverlay.classList.add('show'); endOverlay.classList.remove('hide');
  }
  if (window.__status) window.__status.set('Crashed — Game Over');
  SFX.play('gameover');
}

function togglePause() {
  paused = !paused;
  const pauseEl = document.getElementById('pause');
  if (pauseEl) {
    if (paused) {
      pauseEl.hidden = false;
      pauseEl.classList.add('show');
      pauseEl.classList.remove('hide');
      setCanvasBlur(true);
      
      // Sync audio controls with main HUD
      syncAudioControls();
    } else {
      pauseEl.classList.remove('show');
      pauseEl.classList.add('hide');
      setTimeout(() => pauseEl.hidden = true, 350);
      setCanvasBlur(false);
    }
  }
}

function syncAudioControls() {
  const mainSfxVol = document.getElementById('sfxVol');
  const pauseSfxVol = document.getElementById('pauseSfxVol');
  const sfxVolValue = document.getElementById('sfxVolValue');
  
  if (mainSfxVol && pauseSfxVol && sfxVolValue) {
    pauseSfxVol.value = mainSfxVol.value;
    sfxVolValue.textContent = mainSfxVol.value + '%';
    
    // Sync changes both ways
    pauseSfxVol.oninput = () => {
      mainSfxVol.value = pauseSfxVol.value;
      sfxVolValue.textContent = pauseSfxVol.value + '%';
      // Trigger any existing SFX volume change handlers
      if (mainSfxVol.oninput) mainSfxVol.oninput();
    };
  }
  
  // Handle mute button
  const pauseMuteBtn = document.getElementById('pauseSfxMute');
  const mainMuteBtn = document.getElementById('sfxMute');
  if (pauseMuteBtn && mainMuteBtn) {
    pauseMuteBtn.onclick = () => {
      if (mainMuteBtn.onclick) mainMuteBtn.onclick();
    };
  }
}

// Restart
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'r') {
    ship.visible = true;
    resetGame();
    started = true; // restart immediately
  }
  
  // Tab key toggles minimap opacity
  if (e.key === 'Tab') {
    e.preventDefault(); // Prevent default tab behavior
    const minimapEl = document.getElementById('minimap');
    if (minimapEl) {
      minimapEl.classList.toggle('focused');
    }
  }
});

// Combo decay
setInterval(() => {
  if (comboTimer > 0 && !pausedForUpgrade && !gameOver) {
    comboTimer -= 0.25;
    if (comboTimer <= 0) { combo = 1; comboEl.textContent = `Combo: ${combo}x`; }
  }
}, 250);

// Upgrades system
const choicesEl = document.getElementById('choices');
const choiceCardsEl = document.getElementById('choiceCards');
const mods = {
  fireRateMul: 1.0,
  engineMul: 1.0,
  spread: false,
  pierce: false,
  shields: 0,
  ricochet: 0,
  drones: 0,
};

function offerUpgrades() {
  if (pausedForUpgrade || gameOver) return;
  pausedForUpgrade = true;
  if (window.__status) window.__status.set('Upgrade — choose 1 of 3');
  // Pause mouse aim while choosing
  mouse.enabled = false; setReticle(0,0,false);
  // build choices with rarity & simple synergies
  const pool = [
    { key: 'spread', label: 'Spread Shot', desc: '+2 side bullets', rarity: 'common', available: () => !mods.spread, apply: () => mods.spread = true },
    { key: 'spread2', label: 'Wide Spread', desc: '+2 more side bullets', rarity: 'uncommon', available: () => !!mods.spread && mods.spread !== 'wide', apply: () => mods.spread = 'wide' },
    { key: 'pierce', label: 'Piercing Rounds', desc: 'Bullets pierce 1 target', rarity: 'common', available: () => !mods.pierce, apply: () => mods.pierce = true },
    { key: 'pierce2', label: 'Super Pierce', desc: 'Pierce 2 targets', rarity: 'uncommon', available: () => mods.pierce !== 'super', apply: () => mods.pierce = 'super' },
    { key: 'fire', label: 'Rapid Fire', desc: 'Fire rate +30%', rarity: 'common', available: () => true, apply: () => mods.fireRateMul *= 1.3 },
    { key: 'engine', label: 'Engine Boost', desc: 'Accel/Speed +20%', rarity: 'common', available: () => true, apply: () => mods.engineMul *= 1.2 },
    { key: 'shield', label: 'Shield Charge', desc: 'Gain a 1-hit shield', rarity: 'common', available: () => true, apply: () => mods.shields += 1 },
    { key: 'shield2', label: 'Overshield', desc: '+2 shields', rarity: 'uncommon', available: () => true, apply: () => mods.shields += 2 },
    { key: 'ricochet', label: 'Ricochet Rounds', desc: 'Bullets bounce once on edges', rarity: 'uncommon', available: () => mods.ricochet < 1, apply: () => mods.ricochet = 1 },
    { key: 'ricochet2', label: 'Super Ricochet', desc: 'Bullets bounce twice', rarity: 'rare', available: () => mods.ricochet < 2, apply: () => mods.ricochet = 2 },
    { key: 'drone', label: 'Drone Buddy', desc: 'Add 1 auto-firing drone', rarity: 'uncommon', available: () => mods.drones < 3, apply: () => { addDrone(); mods.drones += 1; } },
    { key: 'overclock', label: 'Overclock', desc: 'Fire rate +60%', rarity: 'epic', available: () => true, apply: () => mods.fireRateMul *= 1.6 },
    { key: 'quantum', label: 'Quantum Engine', desc: 'Accel/Speed +40%', rarity: 'epic', available: () => true, apply: () => mods.engineMul *= 1.4 },
    { key: 'pierce3', label: 'Rail Pierce', desc: 'Pierce 4 targets', rarity: 'epic', available: () => mods.pierce !== 'ultra', apply: () => mods.pierce = 'ultra' },
    { key: 'swarm', label: 'Drone Swarm', desc: '+2 drones', rarity: 'epic', available: () => mods.drones < 3, apply: () => { addDrone(); addDrone(); mods.drones = Math.min(3, mods.drones + 2); } },
    { key: 'nova', label: 'Nova Burst', desc: 'Detonate a clearing blast now', rarity: 'legendary', available: () => true, apply: () => novaBlast() },
  ].filter(o => o.available());

  const synergy = (opt) => {
    if (opt.key.startsWith('ricochet') && mods.pierce) return 'Synergy: ricochet + pierce = multi-angles';
    if (opt.key.startsWith('pierce') && mods.spread) return 'Synergy: spread + pierce = crowd shredder';
    if (opt.key.startsWith('fire') && mods.engineMul > 1.0) return 'Synergy: mobility + ROF';
    return '';
  };

  const weight = (r) => r === 'rare' ? 1 : r === 'uncommon' ? 2 : 5;
  const bag = []; for (const o of pool) for (let i=0;i<weight(o.rarity);i++) bag.push(o);
  const options = [];
  while (options.length < 3 && bag.length) { const i = Math.floor(Math.random()*bag.length); const pick = bag.splice(i,1)[0]; if (!options.includes(pick)) options.push(pick); }
  choiceCardsEl.innerHTML = '';
  const optionsSynced = options.slice();
  for (const opt of options) {
    const card = document.createElement('div');
    card.className = 'choice-card';
    card.dataset.rarity = opt.rarity || 'common';
    const syn = synergy(opt);
    const keyBase = opt.key.replace(/\d+$/, '');
    const ico = iconFor(keyBase, 84);
    card.innerHTML = `<div class="icon">${ico}</div><h3>${opt.label}</h3><p class="desc">${opt.desc}</p>${syn ? `<p class=\"syn\">${syn}</p>`:''}`;
    card.onclick = () => { opt.apply(); pushTaken(opt); SFX.play('upgrade'); cleanup(); resumeNextWave(); };
    choiceCardsEl.appendChild(card);
  }
  choicesEl.hidden = false;

  // Keyboard selection: 1/2/3
  const onKey = (e) => {
    if (!pausedForUpgrade) return;
    if (e.key === '1' && optionsSynced[0]) { optionsSynced[0].apply(); pushTaken(optionsSynced[0]); SFX.play('upgrade'); cleanup(); resumeNextWave(); }
    if (e.key === '2' && optionsSynced[1]) { optionsSynced[1].apply(); pushTaken(optionsSynced[1]); SFX.play('upgrade'); cleanup(); resumeNextWave(); }
    if (e.key === '3' && optionsSynced[2]) { optionsSynced[2].apply(); pushTaken(optionsSynced[2]); SFX.play('upgrade'); cleanup(); resumeNextWave(); }
  };
  let cleanup = () => { window.removeEventListener('keydown', onKey); };
  window.addEventListener('keydown', onKey);

  // Mouse tilt towards cursor
  const onMove = (ev) => {
    const rect = choiceCardsEl.getBoundingClientRect();
    const mx = ev.clientX, my = ev.clientY;
    for (const card of choiceCardsEl.children) {
      const r = card.getBoundingClientRect();
      const cx = r.left + r.width/2; const cy = r.top + r.height/2;
      const dx = (mx - cx) / r.width; const dy = (my - cy) / r.height;
      const rx = Math.max(-1, Math.min(1, dy)) * -6; // tip towards mouse
      const ry = Math.max(-1, Math.min(1, dx)) * 6;
      card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    }
  };
  const onLeave = () => { for (const card of choiceCardsEl.children) card.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg)'; };
  choiceCardsEl.addEventListener('mousemove', onMove);
  choiceCardsEl.addEventListener('mouseleave', onLeave);
  cleanup = () => {
    window.removeEventListener('keydown', onKey);
    choiceCardsEl.removeEventListener('mousemove', onMove);
    choiceCardsEl.removeEventListener('mouseleave', onLeave);
  };
}

function resumeNextWave() {
  choicesEl.hidden = true;
  pausedForUpgrade = false;
  
  // Set 3-second invulnerability when starting new wave
  invuln = 3.0;
  
  wave++;
  spawnWave();
  if (window.__status) window.__status.set(`Running — Wave ${wave}`);
  mouse.enabled = true; // re-enable mouse aim
}

// Shield visual ring
const shieldGeo = new THREE.RingGeometry(1.2, 1.45, 32);
const shieldMat = new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
shieldMesh.rotation.x = 0;
scene.add(shieldMesh);

function updateShieldVisual() {
  shieldMesh.position.copy(ship.position);
  const target = invuln > 0 || mods.shields > 0 ? 0.6 : 0.0;
  shieldMat.opacity += (target - shieldMat.opacity) * 0.2;
}

// integrate shield visual into loop via monkey patch on composer render step already; call in update

// Fire helper that respects mods
function shoot() {
  const baseDir = ship.rotation.z + Math.PI/2; // Convert mesh rotation to direction
  const ox = Math.cos(baseDir) * 1.4;
  const oy = Math.sin(baseDir) * 1.4;
  const spawn = (dir) => {
    const b = createBullet(ship.position.x + ox, ship.position.y + oy, dir, ship.userData.vx, ship.userData.vy);
    b.userData.pierce = mods.pierce === 'super' ? 2 : (mods.pierce ? 1 : 0);
    if (mods.ricochet > 0) b.userData.ricochet = mods.ricochet;
    bullets.push(b);
  };
  if (mods.spread === 'wide') {
    spawn(baseDir - 0.28);
    spawn(baseDir - 0.12);
    spawn(baseDir);
    spawn(baseDir + 0.12);
    spawn(baseDir + 0.28);
  } else if (mods.spread) {
    spawn(baseDir - 0.18);
    spawn(baseDir);
    spawn(baseDir + 0.18);
  } else {
    spawn(baseDir);
  }
}

// Adjust engine parameters by mods each frame
function tunedAccel() { return PLAYER.accel * mods.engineMul; }
function tunedMaxSpeed() { return PLAYER.maxSpeed * mods.engineMul; }

// Drones
function addDrone() {
  const geo = new THREE.SphereGeometry(0.5, 12, 12);
  const mat = new THREE.MeshStandardMaterial({ color: 0x92ffdd, emissive: 0x227755, emissiveIntensity: 0.7, roughness: 0.3, metalness: 0.1 });
  const mesh = new THREE.Mesh(geo, mat);
  
  // Initialize with random angle offset for multiple drones
  const angleOffset = (drones.length * (Math.PI * 2)) / 3; // Spread 3 drones evenly
  mesh.userData = { 
    t: angleOffset, 
    cd: 0,
    shotsSincePlayerShot: 0,
    shouldShootNext: false
  };
  
  scene.add(mesh);
  drones.push({ mesh });
  outlineTargets.push(mesh);
}

function updateDrones(dt) {
  if (!drones.length) return;
  const r = 4.2;
  
  for (let i = 0; i < drones.length; i++) {
    const d = drones[i];
    if (!d.mesh) continue;
    
    // Orbit around ship at different speeds and radii for variation
    const speedMultiplier = 1 + (i * 0.3); // Each drone orbits at slightly different speed
    const radiusOffset = i * 0.8; // Each drone at slightly different distance
    d.mesh.userData.t += dt * 2.5 * speedMultiplier;
    
    const t = d.mesh.userData.t;
    const orbitRadius = r + radiusOffset;
    d.mesh.position.set(
      ship.position.x + Math.cos(t) * orbitRadius, 
      ship.position.y + Math.sin(t) * orbitRadius, 
      0
    );
    
    // Cooldown management
    d.mesh.userData.cd -= dt;
    
    // Drones shoot automatically at nearest target when player shoots every 2nd time
    if (d.mesh.userData.shouldShootNext && d.mesh.userData.cd <= 0) {
      const target = acquireTarget();
      if (target) {
        d.mesh.userData.cd = 0.5; // Drone fire rate
        const ang = Math.atan2(target.position.y - d.mesh.position.y, target.position.x - d.mesh.position.x);
        const b = createBullet(d.mesh.position.x, d.mesh.position.y, ang, ship.userData.vx * 0.2, ship.userData.vy * 0.2);
        b.userData.pierce = 0;
        b.userData.damage = 0.5; // Drones do half damage
        bullets.push(b);
        particles.emitBurst(d.mesh.position.x, d.mesh.position.y, { count: 4, speed: [8,14], life: [0.08,0.16], size:[0.15,0.3], color:0x9fffe6 });
        SFX.play('shoot');
      }
      d.mesh.userData.shouldShootNext = false;
    }
  }
}

// Call this when player shoots to trigger drone shooting
function triggerDroneShooting() {
  drones.forEach(d => {
    if (d.mesh) {
      d.mesh.userData.shouldShootNext = true;
    }
  });
}

function acquireTarget() {
  let best = null, bestD = 1e9;
  for (const e of enemies) {
    const dx = e.position.x - ship.position.x; const dy = e.position.y - ship.position.y; const d2 = dx*dx + dy*dy;
    if (d2 < bestD) { bestD = d2; best = e; }
  }
  if (best) return best;
  for (const a of asteroids) {
    const dx = a.position.x - ship.position.x; const dy = a.position.y - ship.position.y; const d2 = dx*dx + dy*dy;
    if (d2 < bestD) { bestD = d2; best = a; }
  }
  return best;
}

// Pickups (floating currency shards)
function spawnDrops(a){
  const def = ASTEROIDS[a.userData.size];
  const base = Math.max(1, Math.round(def.r));
  addPickup('salvage', base, a.position.x, a.position.y);
  const ore = a.userData.ore || 'iron';
  const roll = Math.random();
  if (ore === 'gold' && roll > 0.3) addPickup('gold', 1, a.position.x, a.position.y);
  if (ore === 'platinum' && roll > 0.4) addPickup('platinum', 1, a.position.x, a.position.y);
  if (ore === 'adam' && roll > 0.6) addPickup('adam', 1, a.position.x, a.position.y);
}

function addPickup(kind, amount, x, y){
  const color = kind==='gold'?0xffd77a: kind==='platinum'?0xd8f4ff: kind==='adam'?0xff9a7a:0xbde2ff;
  // Reduced opacity and normal blending to make pickups glow less
  const mat = new THREE.SpriteMaterial({ color, transparent:true, opacity:0.65, depthWrite:false, blending:THREE.NormalBlending });
  for(let i=0;i<amount;i++){
    const s = new THREE.Sprite(mat.clone());
    s.scale.set(0.8,0.8,1);
    s.position.set(x,y,0);
    s.userData={kind:'pickup',type:kind,vx:rand(-6,6),vy:rand(-6,6),age:0,collectible:0.25};
    scene.add(s); pickups.push(s);
  }
}

function updatePickups(dt){
  // Stronger attraction radius and pull strength
  const attractR = 10 * (mods.magnet || 1.5);
  for(let i=pickups.length-1;i>=0;i--){
    const p = pickups[i];
    p.userData.age += dt;
    p.position.x += p.userData.vx * dt; p.position.y += p.userData.vy * dt; p.userData.vx*=0.98; p.userData.vy*=0.98; wrap(p);
    if (p.userData.age > p.userData.collectible){
      const dx = ship.position.x - p.position.x; const dy = ship.position.y - p.position.y; const d = Math.hypot(dx,dy);
      if (d < attractR){
        const ax = (dx/d) * 60 * dt;
        const ay = (dy/d) * 60 * dt;
        p.userData.vx += ax; p.userData.vy += ay;
      }
      if (d < 0.8){
        collectPickup(p); scene.remove(p); pickups.splice(i,1); continue;
      }
    }
    const t = Math.max(0,1 - p.userData.age/10); p.material.opacity = 0.4 + 0.6*t;
  }
}

function collectPickup(p){
  switch(p.userData.type){
    case 'gold': gold += 1; break;
    case 'platinum': platinum += 1; break;
    case 'adam': adamantium += 1; break;
    default: salvage += 1; break;
  }
  updateCurrencyHUD(); SFX.play('pickup');
}
