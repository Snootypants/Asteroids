--- a/index.html
+++ b/index.html
@@ -41,7 +41,7 @@
     <div id="hud">
       <div id="score">Score: 0</div>
       <div id="wave">Wave: 1</div>
-      <div id="combo" style="opacity:.8">Combo: 1x</div>
-      <div id="hint">W/A/D to move, Space to shoot. R to restart.</div>
+      <div id="combo" style="opacity:.8">Combo: 1x</div>
+      <div id="hint">W/A/D to move, Space to shoot. R to restart. Press M for Mouse Mode (Lock: M, Release: Esc/M; LMB shoot, RMB thrust).</div>
     </div>
     <div id="gameover" hidden>
       <h1>Game Over</h1>
@@ -58,6 +58,8 @@
         <p class="sub">Upgrades apply for this run.</p>
       </div>
     </div>
+    <!-- Mouse-mode reticle -->
+    <div id="reticle" hidden></div>
     <script type="module" src="src/main.js"></script>
     <script>
       // Simple loader diagnostic: if the module didn't set the flag,

--- a/styles.css
+++ b/styles.css
@@ -79,6 +79,37 @@
 .choices button:hover { filter: brightness(1.15); }
 .choices button:active { transform: translateY(1px); }
 
+/* Card rarity styling */
+.choices button[data-rarity="common"] {
+  border-color: rgba(150,170,255,0.35);
+  background: linear-gradient(180deg, rgba(40,60,110,0.45), rgba(25,35,70,0.45));
+}
+.choices button[data-rarity="uncommon"] {
+  border-color: rgba(120,255,180,0.45);
+  box-shadow: 0 0 14px rgba(120,255,180,0.15) inset;
+}
+.choices button[data-rarity="rare"] {
+  border-color: rgba(255,220,120,0.55);
+  box-shadow: 0 0 16px rgba(255,220,120,0.20) inset, 0 0 10px rgba(255,220,120,0.10);
+  text-shadow: 0 0 6px rgba(255,220,120,0.25);
+}
+.choices button small {
+  display:block;
+  opacity:.75;
+  font-size:11px;
+  margin-top:4px;
+}
+
+/* Mouse reticle */
+#reticle {
+  position: fixed;
+  width: 16px; height: 16px;
+  border: 2px solid rgba(180,220,255,0.9);
+  border-radius: 50%;
+  transform: translate(-50%, -50%);
+  pointer-events: none;
+  z-index: 10000;
+}
+
 #gameover h1 {
   margin: 0 0 8px 0;
   color: #ff98aa;

--- a/src/main.js
+++ b/src/main.js
@@ -1,6 +1,8 @@
 // Three.js Asteroids MVP with juicy visuals
 // Uses CDN modules; run via local server for CORS-safe ES modules.
 
+// NOTE: This patch adds Mouse Mode (M to toggle), reticle, card rarities/synergies, and new upgrades (Ricochet, Drones, Tier II variants).
+
 import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.js';
 import { EffectComposer } from 'https://unpkg.com/three@0.158.0/examples/jsm/postprocessing/EffectComposer.js';
 import { RenderPass } from 'https://unpkg.com/three@0.158.0/examples/jsm/postprocessing/RenderPass.js';
@@ -58,6 +60,14 @@
 const BULLET = { speed: 70, life: 1.1, r: 0.4 };
 
 const ENEMY = {
+  // unchanged
   radius: 1.2,
   accel: 20,
   maxSpeed: 26,
@@ -154,6 +164,12 @@
 const particles = new ParticleSystem(350);
 console.log('[Asteroids] particles ready');
 if (window.__status) window.__status.log('Particles ready');
+
+// Reticle (for mouse mode)
+const reticleEl = document.getElementById('reticle');
+function setReticle(x, y, show=true) {
+  reticleEl.style.left = `${x}px`; reticleEl.style.top = `${y}px`; reticleEl.hidden = !show;
+}
 
 // Debris shards for asteroid breaks
 class DebrisSystem {
@@ -268,6 +284,9 @@
 // Input
 const keys = new Set();
 window.addEventListener('keydown', (e) => {
+  // Mouse mode toggle handled below; still capture keys
+  if (e.key === 'm' || e.key === 'M') e.preventDefault();
+  if (e.key === 'Escape') { if (mouse.locked) toggleMouseMode(false); }
   keys.add(e.key.toLowerCase());
   if (e.key === ' ') e.preventDefault();
 });
@@ -279,6 +298,64 @@
   }
 });
 
+// Mouse Mode: pointer lock + relative aiming, LMB shoot, RMB thrust
+const mouse = {
+  enabled: false,
+  locked: false,
+  angle: Math.PI/2, // match initial ship rotation
+  lmb: false,
+  rmb: false,
+  sensitivity: 0.0035,
+};
+
+function toggleMouseMode(on) {
+  mouse.enabled = on;
+  if (on) {
+    const canvas = renderer.domElement;
+    mouse.angle = ship.rotation.z;
+    canvas.requestPointerLock?.();
+  } else {
+    document.exitPointerLock?.();
+  }
+}
+
+document.addEventListener('pointerlockchange', () => {
+  mouse.locked = document.pointerLockElement === renderer.domElement;
+  if (!mouse.locked) { mouse.enabled = false; setReticle(0,0,false); }
+});
+
+window.addEventListener('mousemove', (e) => {
+  if (!mouse.enabled || !mouse.locked) return;
+  mouse.angle += e.movementX * mouse.sensitivity;
+  // reticle in center with a small offset forward
+  const cx = window.innerWidth/2, cy = window.innerHeight/2;
+  const r = 36; // pixels ahead
+  const rx = cx + Math.cos(mouse.angle) * r;
+  const ry = cy + Math.sin(mouse.angle) * r;
+  setReticle(rx, ry, true);
+});
+
+window.addEventListener('mousedown', (e) => {
+  if (!mouse.enabled) return;
+  if (e.button === 0) mouse.lmb = true;
+  if (e.button === 2) mouse.rmb = true;
+});
+window.addEventListener('mouseup', (e) => {
+  if (e.button === 0) mouse.lmb = false;
+  if (e.button === 2) mouse.rmb = false;
+});
+window.addEventListener('contextmenu', (e) => {
+  if (mouse.enabled) e.preventDefault();
+});
+
+// Toggle with M (press again or Esc to release)
+window.addEventListener('keydown', (e) => {
+  if (e.key === 'm' || e.key === 'M') {
+    if (mouse.enabled) { toggleMouseMode(false); }
+    else { toggleMouseMode(true); }
+  }
+});
+
 // State
 let ship = createShip();
 const trail = createTrail();
@@ -294,6 +371,9 @@
 let combo = 1;
 let comboTimer = 0; // time left to sustain combo
 let pausedForUpgrade = false;
+// Drones
+let drones = [];
+
 const comboEl = document.getElementById('combo');
 
 const scoreEl = document.getElementById('score');
@@ -312,6 +392,10 @@
   ship.userData.vx = 0;
   ship.userData.vy = 0;
   ship.position.set(0, 0, 0);
+  // reset drones
+  for (const d of drones) scene.remove(d.mesh);
+  drones = [];
+
   ship.rotation.z = Math.PI / 2; // pointing up (geometry aligned to +X)
   invuln = 2.0; // brief safety window
   spawnWave();
@@ -418,6 +502,18 @@
   invuln = Math.max(0, invuln - dt);
   // Ship controls
   const s = ship.userData;
+  // Mouse mode overrides turn/thrust/fire
+  if (mouse.enabled && mouse.locked) {
+    // rotate to mouse angle
+    ship.rotation.z = mouse.angle;
+  }
+
   const turnLeft = keys.has('a') || keys.has('arrowleft');
   const turnRight = keys.has('d') || keys.has('arrowright');
   const thrust = keys.has('w') || keys.has('arrowup');
   const fire = keys.has(' ');
 
-  if (turnLeft) ship.rotation.z += PLAYER.turn * dt;
-  if (turnRight) ship.rotation.z -= PLAYER.turn * dt;
+  if (!mouse.enabled) {
+    if (turnLeft) ship.rotation.z += PLAYER.turn * dt;
+    if (turnRight) ship.rotation.z -= PLAYER.turn * dt;
+  }
 
-  if (thrust) {
+  const thrusting = mouse.enabled ? mouse.rmb : thrust;
+  if (thrusting) {
     const ax = Math.cos(ship.rotation.z) * tunedAccel() * dt;
     const ay = Math.sin(ship.rotation.z) * tunedAccel() * dt;
     s.vx += ax; s.vy += ay;
@@ -448,9 +544,13 @@
   ship.position.y += s.vy * dt;
   wrap(ship);
 
+  // Drones orbit + fire
+  updateDrones(dt);
+
   // Update trail positions
   if (trail.visible) {
     const p = ship.position;
@@ -463,7 +563,8 @@
 
   // Shooting
   s.fireCooldown -= dt;
-  if (fire && s.fireCooldown <= 0) {
+  const firing = mouse.enabled ? mouse.lmb : fire;
+  if (firing && s.fireCooldown <= 0) {
     shoot();
     s.fireCooldown = PLAYER.fireRate / mods.fireRateMul;
     addShake(0.15, 0.06);
@@ -491,6 +592,25 @@
     wrap(b);
   }
 
+  // Ricochet handling for bullets at bounds
+  for (let i = bullets.length - 1; i >= 0; i--) {
+    const b = bullets[i];
+    if (!b.userData || !b.userData.ricochet) continue;
+    const hw = WORLD.width * 0.5, hh = WORLD.height * 0.5;
+    let bounced = false;
+    if (b.position.x > hw) { b.position.x = hw; b.userData.vx *= -1; bounced = true; }
+    if (b.position.x < -hw) { b.position.x = -hw; b.userData.vx *= -1; bounced = true; }
+    if (b.position.y > hh) { b.position.y = hh; b.userData.vy *= -1; bounced = true; }
+    if (b.position.y < -hh) { b.position.y = -hh; b.userData.vy *= -1; bounced = true; }
+    if (bounced) {
+      b.userData.ricochet -= 1;
+      particles.emitBurst(b.position.x, b.position.y, { count: 6, speed: [8, 18], life: [0.08, 0.18], size: [0.18, 0.4], color: 0xbbe0ff });
+      if (b.userData.ricochet <= 0) {
+        // disable further ricochet; fallback to wrap
+        b.userData.ricochet = 0;
+      }
+    }
+  }
+
   // Update asteroids
   for (const a of asteroids) {
     a.position.x += a.userData.vx * dt;
@@ -665,15 +785,83 @@
 const choicesEl = document.getElementById('choices');
 const choiceButtonsEl = document.getElementById('choiceButtons');
 const mods = {
   fireRateMul: 1.0,
   engineMul: 1.0,
   spread: false,
   pierce: false,
   shields: 0,
+  ricochet: 0,     // number of bounces per bullet
+  drones: 0,       // number of drone buddies
 };
 
 function offerUpgrades() {
   if (pausedForUpgrade || gameOver) return;
   pausedForUpgrade = true;
   if (window.__status) window.__status.set('Upgrade — choose 1 of 3');
-  // build choices
-  const pool = [
-    { key: 'spread', label: 'Spread Shot', desc: '+2 side bullets', apply: () => mods.spread = true },
-    { key: 'pierce', label: 'Piercing Rounds', desc: 'Bullets pierce 1 target', apply: () => mods.pierce = true },
-    { key: 'fire', label: 'Rapid Fire', desc: 'Fire rate +30%', apply: () => mods.fireRateMul *= 1.3 },
-    { key: 'engine', label: 'Engine Boost', desc: 'Accel/Speed +20%', apply: () => mods.engineMul *= 1.2 },
-    { key: 'shield', label: 'Shield Charge', desc: 'Gain a 1-hit shield', apply: () => mods.shields += 1 },
-  ];
+  // build choices with rarity + simple synergies
+  const pool = [
+    { key: 'spread', label: 'Spread Shot', desc: '+2 side bullets', rarity: 'common',
+      available: () => !mods.spread, apply: () => mods.spread = true },
+    { key: 'spread2', label: 'Wide Spread', desc: '+2 more side bullets', rarity: 'uncommon',
+      available: () => mods.spread, apply: () => mods.spread = 'wide' },
+
+    { key: 'pierce', label: 'Piercing Rounds', desc: 'Bullets pierce 1 target', rarity: 'common',
+      available: () => !mods.pierce, apply: () => mods.pierce = true },
+    { key: 'pierce2', label: 'Super Pierce', desc: 'Pierce 2 targets', rarity: 'uncommon',
+      available: () => mods.pierce !== 'super', apply: () => mods.pierce = 'super' },
+
+    { key: 'fire', label: 'Rapid Fire', desc: 'Fire rate +30%', rarity: 'common',
+      available: () => true, apply: () => mods.fireRateMul *= 1.3 },
+    { key: 'engine', label: 'Engine Boost', desc: 'Accel/Speed +20%', rarity: 'common',
+      available: () => true, apply: () => mods.engineMul *= 1.2 },
+
+    { key: 'shield', label: 'Shield Charge', desc: 'Gain a 1-hit shield', rarity: 'common',
+      available: () => true, apply: () => mods.shields += 1 },
+    { key: 'shield2', label: 'Overshield', desc: '+2 shields', rarity: 'uncommon',
+      available: () => true, apply: () => mods.shields += 2 },
+
+    { key: 'ricochet', label: 'Ricochet Rounds', desc: 'Bullets bounce once on edges', rarity: 'uncommon',
+      available: () => mods.ricochet < 1, apply: () => mods.ricochet = 1 },
+    { key: 'ricochet2', label: 'Super Ricochet', desc: 'Bullets bounce twice', rarity: 'rare',
+      available: () => mods.ricochet < 2, apply: () => mods.ricochet = 2 },
+
+    { key: 'drone', label: 'Drone Buddy', desc: 'Add 1 auto-firing drone', rarity: 'uncommon',
+      available: () => mods.drones < 3, apply: () => { addDrone(); mods.drones += 1; } },
+  ].filter(o => o.available());
+
+  // synergy notes
+  const synergy = (opt) => {
+    if (opt.key.startsWith('ricochet') && mods.pierce) return 'Synergy: ricochet + pierce = multi-angles';
+    if (opt.key.startsWith('pierce') && mods.spread) return 'Synergy: spread + pierce = crowd shredder';
+    if (opt.key.startsWith('fire') && mods.engineMul > 1.0) return 'Synergy: mobility + ROF';
+    return '';
+  };
+
+  // pick 3 unique weighted by rarity
+  const weight = (r) => r === 'rare' ? 1 : r === 'uncommon' ? 2 : 5;
+  const bag = [];
+  for (const o of pool) for (let i=0;i<weight(o.rarity);i++) bag.push(o);
+  const options = [];
+  while (options.length < 3 && bag.length) {
+    const i = Math.floor(Math.random() * bag.length);
+    const pick = bag.splice(i,1)[0];
+    if (!options.includes(pick)) options.push(pick);
+  }
+
   choiceButtonsEl.innerHTML = '';
-  for (const opt of options) {
+  for (const opt of options) {
     const btn = document.createElement('button');
-    btn.textContent = `${opt.label} — ${opt.desc}`;
+    btn.dataset.rarity = opt.rarity || 'common';
+    const syn = synergy(opt);
+    btn.innerHTML = `${opt.label} — ${opt.desc}${syn ? `<small>${syn}</small>`:''}`;
     btn.onclick = () => {
       opt.apply();
       resumeNextWave();
     };
     choiceButtonsEl.appendChild(btn);
   }
   choicesEl.hidden = false;
 }
@@ -705,17 +893,64 @@
 // Fire helper that respects mods
 function shoot() {
   const baseDir = ship.rotation.z;
   const ox = Math.cos(baseDir) * 1.4;
   const oy = Math.sin(baseDir) * 1.4;
   const spawn = (dir) => {
     const b = createBullet(ship.position.x + ox, ship.position.y + oy, dir, ship.userData.vx, ship.userData.vy);
-    b.userData.pierce = mods.pierce ? 1 : 0;
+    // pierce tiers
+    b.userData.pierce = mods.pierce === 'super' ? 2 : (mods.pierce ? 1 : 0);
+    // ricochet bounces
+    if (mods.ricochet > 0) b.userData.ricochet = mods.ricochet;
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
+
+// Drones
+function addDrone() {
+  const geo = new THREE.SphereGeometry(0.5, 12, 12);
+  const mat = new THREE.MeshStandardMaterial({ color: 0x92ffdd, emissive: 0x227755, emissiveIntensity: 0.7, roughness: 0.3, metalness: 0.1 });
+  const mesh = new THREE.Mesh(geo, mat);
+  mesh.userData = { t: Math.random()*Math.PI*2, cd: 0 };
+  scene.add(mesh);
+  drones.push({ mesh });
+  outlineTargets.push(mesh);
+}
+
+function updateDrones(dt) {
+  if (!drones.length) return;
+  const r = 3.2;
+  for (const d of drones) {
+    d.mesh.userData.t += dt * 2.4;
+    const t = d.mesh.userData.t;
+    d.mesh.position.set(ship.position.x + Math.cos(t)*r, ship.position.y + Math.sin(t)*r, 0);
+    d.mesh.userData.cd -= dt;
+    if (d.mesh.userData.cd <= 0) {
+      const target = acquireTarget();
+      if (target) {
+        d.mesh.userData.cd = 0.6;
+        const ang = Math.atan2(target.position.y - d.mesh.position.y, target.position.x - d.mesh.position.x);
+        const b = createBullet(d.mesh.position.x, d.mesh.position.y, ang, ship.userData.vx*0.2, ship.userData.vy*0.2);
+        b.userData.pierce = 0;
+        bullets.push(b);
+        particles.emitBurst(d.mesh.position.x, d.mesh.position.y, { count: 4, speed: [8,14], life: [0.08,0.16], size:[0.15,0.3], color:0x9fffe6 });
+      } else {
+        d.mesh.userData.cd = 0.3;
+      }
+    }
+  }
+}
+
+function acquireTarget() {
+  // prefer enemies, else nearest asteroid
+  let best = null, bestD = 1e9;
+  for (const e of enemies) {
+    const dx = e.position.x - ship.position.x;
+    const dy = e.position.y - ship.position.y;
+    const d2 = dx*dx + dy*dy;
+    if (d2 < bestD) { bestD = d2; best = e; }
+  }
+  if (best) return best;
+  for (const a of asteroids) {
+    const dx = a.position.x - ship.position.x;
+    const dy = a.position.y - ship.position.y;
+    const d2 = dx*dx + dy*dy;
+    if (d2 < bestD) { bestD = d2; best = a; }
+  }
+  return best;
+}