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
  width: 90,
  height: 60,
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

const BULLET = { speed: 70, life: 1.1, r: 0.4 };

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

// Basic 2D wrapping in X/Y plane
function wrap(obj) {
  const hw = WORLD.width * 0.5;
  const hh = WORLD.height * 0.5;
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

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x02040a, 0.004);
renderer.setClearColor(0x070a14, 1);

// Starfield background
function makeStars() {
  const g = new THREE.BufferGeometry();
  const count = 1200;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3 + 0] = rand(-WORLD.width, WORLD.width);
    positions[i * 3 + 1] = rand(-WORLD.height, WORLD.height);
    positions[i * 3 + 2] = rand(-20, -2);
  }
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const m = new THREE.PointsMaterial({ size: 0.4, color: 0x88aaff, transparent: true, opacity: 0.7 });
  const stars = new THREE.Points(g, m);
  stars.userData.kind = 'stars';
  scene.add(stars);
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

// Materials
const glowMat = new THREE.MeshStandardMaterial({ color: 0xa5c8ff, emissive: 0x335dff, emissiveIntensity: 1.7, roughness: 0.25, metalness: 0.0 });
const bulletMat = new THREE.MeshStandardMaterial({ color: 0xffcc88, emissive: 0xff8800, emissiveIntensity: 2.0, roughness: 0.2, metalness: 0.1 });
// Simple toon gradient texture
function makeToonGradient() {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 1;
  const ctx = c.getContext('2d');
  // Brighter stops for better readability
  const stops = ['#6f8fc0', '#a9c4ea', '#dceafe', '#ffffff'];
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

// Ship
function createShip() {
  const g = new THREE.ConeGeometry(1.0, 2.0, 3);
  // Orient cone axis along +X so ship's "front" matches rotation math
  g.rotateZ(-Math.PI / 2);
  const mesh = new THREE.Mesh(g, glowMat.clone());
  mesh.userData = { kind: 'ship', vx: 0, vy: 0, rot: 0, alive: true, fireCooldown: 0, radius: 1.0 };
  scene.add(mesh);
  return mesh;
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

// Bullet
function createBullet(x, y, dir, addVx = 0, addVy = 0) {
  const g = new THREE.SphereGeometry(BULLET.r, 8, 8);
  const bullet = new THREE.Mesh(g, bulletMat);
  bullet.position.set(x, y, 0);
  const vx = Math.cos(dir) * BULLET.speed + addVx;
  const vy = Math.sin(dir) * BULLET.speed + addVy;
  bullet.userData = { kind: 'bullet', vx, vy, life: BULLET.life, radius: BULLET.r };
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
  const mat = asteroidBaseMat.clone();
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
  };
  // Add edge lines for readability
  const egeo = new THREE.EdgesGeometry(geo, 20);
  const lines = new THREE.LineSegments(egeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
  mesh.add(lines);
  scene.add(mesh);
  outlineTargets.push(mesh);
  return mesh;
}

// Enemy hunter
function createHunter(x, y) {
  const g = new THREE.ConeGeometry(1.0, 2.0, 3);
  g.rotateX(Math.PI / 2);
  // Default cone points +Z; rotate so it faces +X like our ship rotation math
  g.rotateZ(Math.PI);
  const mesh = new THREE.Mesh(g, enemyMat.clone());
  mesh.position.set(x, y, 0);
  mesh.userData = { kind: 'enemy', vx: 0, vy: 0, cool: rand(0.2, ENEMY.fireRate), radius: ENEMY.radius };
  scene.add(mesh);
  enemies.push(mesh);
  outlineTargets.push(mesh);
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

// Hook to run small update callbacks each frame (for beacons)
const afterUpdates = new Set();

// Input
const keys = new Set();
window.addEventListener('keydown', (e) => {
  keys.add(e.key.toLowerCase());
  if (e.key === ' ') e.preventDefault();
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

// Debug toggle: press 't' to spawn a bright marker
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 't') {
    const g = new THREE.BoxGeometry(2, 2, 2);
    const m = new THREE.MeshBasicMaterial({ color: 0x00ffcc, wireframe: true });
    const cube = new THREE.Mesh(g, m);
    cube.position.set(0, 0, 0);
    scene.add(cube);
    console.log('[Asteroids] Debug cube added at origin');
  }
});

// State
let ship = createShip();
const trail = createTrail();
let bullets = [];
let asteroids = [];
let enemies = [];
let eBullets = [];
let score = 0;
let wave = 1;
let gameOver = false;
let invuln = 0; // seconds of spawn invulnerability
let combo = 1;
let comboTimer = 0; // time left to sustain combo
let pausedForUpgrade = false;
const comboEl = document.getElementById('combo');

const scoreEl = document.getElementById('score');
const waveEl = document.getElementById('wave');
const gameoverEl = document.getElementById('gameover');
const finalScoreEl = document.getElementById('finalScore');

function resetGame() {
  // clear scene of bullets/asteroids
  for (const b of bullets) scene.remove(b);
  for (const a of asteroids) scene.remove(a);
  bullets = [];
  asteroids = [];
  for (const eb of eBullets) scene.remove(eb); eBullets = [];
  for (const en of enemies) scene.remove(en); enemies = [];
  score = 0;
  wave = 1;
  gameOver = false;
  combo = 1; comboTimer = 0; comboEl.textContent = `Combo: ${combo}x`;
  ship.userData.vx = 0;
  ship.userData.vy = 0;
  ship.position.set(0, 0, 0);
  ship.rotation.z = Math.PI / 2; // pointing up (geometry aligned to +X)
  invuln = 2.0; // brief safety window
  spawnWave();
  gameoverEl.hidden = true;
}

function spawnWave() {
  const count = 3 + wave;
  for (let i = 0; i < count; i++) {
    const x = randSign() * rand(WORLD.width * 0.25, WORLD.width * 0.45);
    const y = randSign() * rand(WORLD.height * 0.25, WORLD.height * 0.45);
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
    const x = randSign() * rand(WORLD.width * 0.35, WORLD.width * 0.48);
    const y = randSign() * rand(WORLD.height * 0.35, WORLD.height * 0.48);
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

// Camera shake
let shakeTime = 0; let shakeMag = 0;
function addShake(mag = 0.4, time = 0.1) { shakeMag = Math.max(shakeMag, mag); shakeTime = Math.max(shakeTime, time); }

// Game loop
let last = performance.now() / 1000;
resetGame();
window.__gameBoot = 'running';
console.log('[Asteroids] game loop starting');
if (window.__status) window.__status.set('Running — Wave 1');

function tick() {
  const now = performance.now() / 1000;
  let dt = now - last; last = now;
  dt = Math.min(dt, 0.033); // clamp

  if (!gameOver && !pausedForUpgrade) update(dt);

  if (shakeTime > 0) {
    shakeTime -= dt;
    const t = Math.random() * Math.PI * 2;
    camera.position.x = Math.cos(t) * shakeMag;
    camera.position.y = Math.sin(t) * shakeMag;
  } else {
    camera.position.x = 0; camera.position.y = 0;
  }

  particles.update(dt);
  debris.update(dt);
  composer.render();
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

function update(dt) {
  // tick invulnerability timer
  invuln = Math.max(0, invuln - dt);
  // Ship controls
  const s = ship.userData;
  const turnLeft = keys.has('a') || keys.has('arrowleft');
  const turnRight = keys.has('d') || keys.has('arrowright');
  const thrust = keys.has('w') || keys.has('arrowup');
  const fire = keys.has(' ');

  if (turnLeft) ship.rotation.z += PLAYER.turn * dt;
  if (turnRight) ship.rotation.z -= PLAYER.turn * dt;

  if (thrust) {
    const ax = Math.cos(ship.rotation.z) * tunedAccel() * dt;
    const ay = Math.sin(ship.rotation.z) * tunedAccel() * dt;
    s.vx += ax; s.vy += ay;
    trail.visible = true;
    // occasional engine particles
    if (Math.random() < 0.5) {
      particles.emitBurst(ship.position.x - Math.cos(ship.rotation.z) * 1.2, ship.position.y - Math.sin(ship.rotation.z) * 1.2, { count: 2, speed: [10, 18], life: [0.15, 0.28], size: [0.18, 0.35], color: 0x88bbff });
    }
  } else {
    trail.visible = false;
  }

  [s.vx, s.vy] = clampMag(s.vx, s.vy, tunedMaxSpeed());
  s.vx *= PLAYER.friction; s.vy *= PLAYER.friction;
  ship.position.x += s.vx * dt;
  ship.position.y += s.vy * dt;
  wrap(ship);

  // Update trail positions
  if (trail.visible) {
    const p = ship.position;
    const tail = new THREE.Vector3(-Math.cos(ship.rotation.z) * 2.4, -Math.sin(ship.rotation.z) * 2.4, 0).add(p);
    const head = new THREE.Vector3(-Math.cos(ship.rotation.z) * 0.6, -Math.sin(ship.rotation.z) * 0.6, 0).add(p);
    const pts = trail.geometry.attributes.position;
    pts.setXYZ(0, head.x, head.y, 0);
    pts.setXYZ(1, tail.x, tail.y, 0);
    pts.needsUpdate = true;
  }

  // Shooting
  s.fireCooldown -= dt;
  if (fire && s.fireCooldown <= 0) {
    shoot();
    s.fireCooldown = PLAYER.fireRate / mods.fireRateMul;
    addShake(0.15, 0.06);
    // muzzle flash
    particles.emitBurst(ship.position.x + Math.cos(ship.rotation.z) * 1.2, ship.position.y + Math.sin(ship.rotation.z) * 1.2, { count: 6, speed: [10, 26], life: [0.08, 0.18], size: [0.18, 0.5], color: 0xffe6aa });
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

  // Update asteroids
  for (const a of asteroids) {
    a.position.x += a.userData.vx * dt;
    a.position.y += a.userData.vy * dt;
    a.rotation.z += a.userData.rot * dt;
    wrap(a);
  }

  // Update enemies
  for (const e of enemies) {
    const dx = ship.position.x - e.position.x;
    const dy = ship.position.y - e.position.y;
    const dist = Math.hypot(dx, dy) + 1e-3;
    const dirx = dx / dist, diry = dy / dist;
    const toward = dist > ENEMY.preferredDist ? 1 : -1;
    e.userData.vx += (dirx * toward + -diry * 0.35) * ENEMY.accel * dt;
    e.userData.vy += (diry * toward + dirx * 0.35) * ENEMY.accel * dt;
    [e.userData.vx, e.userData.vy] = clampMag(e.userData.vx, e.userData.vy, ENEMY.maxSpeed);
    e.position.x += e.userData.vx * dt; e.position.y += e.userData.vy * dt; wrap(e);
    e.rotation.z = Math.atan2(dy, dx);
    e.userData.cool -= dt;
    if (e.userData.cool <= 0 && dist < 45) { e.userData.cool = ENEMY.fireRate; eShoot(e.position.x + Math.cos(e.rotation.z) * 1.2, e.position.y + Math.sin(e.rotation.z) * 1.2, e.rotation.z); }
  }

  // Update enemy bullets
  for (let i = eBullets.length - 1; i >= 0; i--) {
    const b = eBullets[i];
    b.userData.life -= dt;
    if (b.userData.life <= 0) { scene.remove(b); eBullets.splice(i, 1); continue; }
    b.position.x += b.userData.vx * dt; b.position.y += b.userData.vy * dt; wrap(b);
  }
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
        // particles burst
        particles.emitBurst(a.position.x, a.position.y, { count: 16, speed: [12, 36], life: [0.25, 0.6], size: [0.25, 1.0], color: 0xaad0ff });
        debris.burst(a.position.x, a.position.y, Math.floor(def.r * 2));
        const kids = splitAsteroid(a);
        asteroids.push(...kids);
        addShake(0.5, 0.12);
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
        debris.burst(e.position.x, e.position.y, 8);
        addShake(0.6, 0.12);
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
          particles.emitBurst(ship.position.x, ship.position.y, { count: 24, speed: [20, 40], life: [0.2, 0.5], size: [0.3, 1.2], color: 0x66ccff });
          addShake(0.8, 0.2);
          break;
        } else {
          die();
        }
        break;
      }
    }
    // enemy vs ship (ram)
    for (const e of enemies) {
      if (circleHit(e.position.x, e.position.y, ENEMY.radius, ship.position.x, ship.position.y, ship.userData.radius)) {
        if (mods.shields > 0) { mods.shields -= 1; invuln = 1.0; particles.emitBurst(ship.position.x, ship.position.y, { count: 20, speed: [18, 36], life: [0.2, 0.45], size: [0.3, 1.0], color: 0x66ccff }); addShake(0.6, 0.12); }
        else { die(); }
        break;
      }
    }
    // enemy bullets vs ship
    for (let i = eBullets.length - 1; i >= 0; i--) {
      const b = eBullets[i];
      if (circleHit(ship.position.x, ship.position.y, ship.userData.radius, b.position.x, b.position.y, b.userData.radius)) {
        if (mods.shields > 0) {
          mods.shields -= 1; invuln = 1.0; particles.emitBurst(ship.position.x, ship.position.y, { count: 20, speed: [18, 36], life: [0.2, 0.45], size: [0.3, 1.0], color: 0x66ccff });
          scene.remove(b); eBullets.splice(i, 1); addShake(0.5, 0.12);
        } else { die(); }
        break;
      }
    }
  }

  // Next wave
  if (asteroids.length === 0) {
    offerUpgrades();
  }

  updateShieldVisual();
}

function die() {
  if (gameOver) return;
  gameOver = true;
  // visual pop
  ship.visible = false;
  addShake(1.0, 0.5);
  finalScoreEl.textContent = `Final Score: ${score}`;
  gameoverEl.hidden = false;
  if (window.__status) window.__status.set('Crashed — Game Over');
}

// Restart
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'r') {
    ship.visible = true;
    resetGame();
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
const choiceButtonsEl = document.getElementById('choiceButtons');
const mods = {
  fireRateMul: 1.0,
  engineMul: 1.0,
  spread: false,
  pierce: false,
  shields: 0,
};

function offerUpgrades() {
  if (pausedForUpgrade || gameOver) return;
  pausedForUpgrade = true;
  if (window.__status) window.__status.set('Upgrade — choose 1 of 3');
  // build choices
  const pool = [
    { key: 'spread', label: 'Spread Shot', desc: '+2 side bullets', apply: () => mods.spread = true },
    { key: 'pierce', label: 'Piercing Rounds', desc: 'Bullets pierce 1 target', apply: () => mods.pierce = true },
    { key: 'fire', label: 'Rapid Fire', desc: 'Fire rate +30%', apply: () => mods.fireRateMul *= 1.3 },
    { key: 'engine', label: 'Engine Boost', desc: 'Accel/Speed +20%', apply: () => mods.engineMul *= 1.2 },
    { key: 'shield', label: 'Shield Charge', desc: 'Gain a 1-hit shield', apply: () => mods.shields += 1 },
  ];
  // pick 3 unique
  const options = [];
  while (options.length < 3 && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    options.push(pool.splice(i, 1)[0]);
  }
  choiceButtonsEl.innerHTML = '';
  for (const opt of options) {
    const btn = document.createElement('button');
    btn.textContent = `${opt.label} — ${opt.desc}`;
    btn.onclick = () => {
      opt.apply();
      resumeNextWave();
    };
    choiceButtonsEl.appendChild(btn);
  }
  choicesEl.hidden = false;
}

function resumeNextWave() {
  choicesEl.hidden = true;
  pausedForUpgrade = false;
  wave++;
  spawnWave();
  if (window.__status) window.__status.set(`Running — Wave ${wave}`);
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
  const baseDir = ship.rotation.z;
  const ox = Math.cos(baseDir) * 1.4;
  const oy = Math.sin(baseDir) * 1.4;
  const spawn = (dir) => {
    const b = createBullet(ship.position.x + ox, ship.position.y + oy, dir, ship.userData.vx, ship.userData.vy);
    b.userData.pierce = mods.pierce ? 1 : 0;
    bullets.push(b);
  };
  if (mods.spread) {
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
