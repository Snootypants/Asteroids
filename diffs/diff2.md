```diff
--- a/index.html
+++ b/index.html
@@ -33,7 +33,9 @@
     <div id="hangar" hidden>
       <div class="card">
         <h2>Hangar</h2>
-        <div id="shopCards" class="choices"></div>
+        <!-- Centered, 3D-tilt upgrade cards -->
+        <div id="shopCards" class="choices choices-3d" aria-live="polite"></div>
+        <div id="choicesMouseLayer" aria-hidden="true"></div>
         <div class="shop-row">
           <button id="rerollShop">Reroll (🟦 <span id="rerollCost">15</span>)</button>
           <button id="banishOne">Banish 1 (free)</button>
           <button id="toggleVis">High-Vis Bullets</button>
           <button id="leaveHangar">Launch</button>
         </div>
         <p id="shopInfo" class="sub">Epics unlock after Wave 5 or when you own prerequisites.</p>
       </div>
     </div>
```

```diff
--- a/styles.css
+++ b/styles.css
@@ -86,9 +86,92 @@
 #choices .sub { opacity: 0.6; font-size: 12px; margin-top: 8px; }
 
-.choices { display: grid; grid-template-columns: 1fr; gap: 10px; margin-top: 10px; }
+.choices { margin-top: 10px; }
+.choices-3d {
+  /* Center row of cards */
+  display: flex;
+  justify-content: center;
+  align-items: center;
+  gap: clamp(16px, 5vw, 36px);
+  perspective: 1200px;
+  padding: clamp(8px, 2vh, 24px) 0;
+}
 .shop-row button { padding:8px 10px; border-radius:8px; border:1px solid rgba(140,170,255,0.35); background: rgba(30,40,80,0.5); color:#dbe6ff; cursor:pointer; }
 .shop-row button:hover { filter: brightness(1.1); }
-.choices button {
-  padding: 10px 12px;
-  border-radius: 8px;
-  border: 1px solid rgba(140,160,255,0.35);
-  background: radial-gradient(120% 120% at 50% 0%, rgba(32,44,96,0.65), rgba(22,28,60,0.65));
-  color: #e8f0ff; text-align: left;
-}
+/* Card button base */
+.choices-3d .card-btn {
+  position: relative;
+  width: clamp(220px, 22vw, 300px);
+  height: clamp(280px, 32vh, 380px);
+  padding: 14px 16px;
+  border-radius: 14px;
+  border: 1px solid rgba(150,170,255,0.35);
+  background: linear-gradient(180deg, rgba(36,48,106,0.65), rgba(22,28,64,0.65));
+  color:#eaf1ff;
+  text-align:left;
+  transform-style: preserve-3d;
+  transform: rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg)) translateZ(0);
+  transition: transform 140ms ease, filter 140ms ease, box-shadow 140ms ease;
+  box-shadow: 0 4px 16px rgba(0,0,0,0.35), 0 0 0 rgba(0,0,0,0);
+  overflow:hidden;
+}
+.choices-3d .card-btn:hover { filter: brightness(1.08); }
+.choices-3d .card-btn:active { transform: rotateX(0) rotateY(0) translateZ(0) scale(0.995); }
+
+/* Rarity glow */
+.choices-3d .card-btn::before {
+  content:"";
+  position:absolute; inset:-2px;
+  border-radius: inherit;
+  background: radial-gradient(120% 80% at 50% 0%, var(--glow, rgba(140,170,255,0.0)), transparent 70%);
+  filter: blur(14px);
+  opacity: .55;
+  z-index: -1;
+}
+.choices-3d .card-btn[data-rarity="common"]   { --glow: rgba(140,170,255,0.25); }
+.choices-3d .card-btn[data-rarity="uncommon"] { --glow: rgba(120,255,190,0.35); border-color: rgba(120,255,190,0.45); }
+.choices-3d .card-btn[data-rarity="rare"]     { --glow: rgba(255,220,120,0.45); border-color: rgba(255,220,120,0.55); }
+
+/* Shimmer highlight sweep */
+.choices-3d .card-btn::after{
+  content:"";
+  position:absolute;
+  inset:-40%;
+  background:
+    radial-gradient(60% 20% at var(--mx,50%) var(--my,0%), rgba(255,255,255,0.18), transparent 60%),
+    linear-gradient(120deg, transparent 45%, rgba(255,255,255,0.06) 50%, transparent 55%);
+  mix-blend-mode: screen;
+  transform: translateZ(1px);
+  transition: background-position 120ms ease;
+  pointer-events:none;
+}
+
+/* Title + sub inside card */
+.card-title { font-weight:700; font-size: 18px; margin-bottom: 6px; text-shadow: 0 0 8px rgba(255,255,255,0.15);}
+.card-desc  { font-size: 13px; opacity: .9; line-height: 1.35; }
+.card-cost  { margin-top:10px; font-size: 12px; opacity: .85; }
+
+/* Subtle idle float */
+@keyframes floaty {
+  0% { transform: translateZ(0) rotateX(var(--rx,0)) rotateY(var(--ry,0)) translateY(0); }
+  50% { transform: translateZ(0) rotateX(var(--rx,0)) rotateY(var(--ry,0)) translateY(-2px); }
+  100% { transform: translateZ(0) rotateX(var(--rx,0)) rotateY(var(--ry,0)) translateY(0); }
+}
+.choices-3d .card-btn { animation: floaty 4s ease-in-out infinite; }
+
+/* Accessibility focus ring */
+.choices-3d .card-btn:focus-visible{
+  outline: 2px solid rgba(255,255,255,0.7);
+  outline-offset: 2px;
+}
+
+/* Mouse layer to capture pointer without jitter */
+#choicesMouseLayer{
+  position:absolute; inset:0; pointer-events:none;
+}
```

```diff
--- a/src/main.js
+++ b/src/main.js
@@ -640,15 +640,33 @@
 function buildShop(isReroll=false) {
   shopCardsEl.innerHTML = '';
-  // Compose rows: 3 main options + 2 cheap utility options
+  // Compose rows: 3 main options + 2 cheap utility options
   const mains = weightedPick(upgradePool.filter(okForMain), 3);
   const utils = weightedPick(upgradePool.filter(u => u.key.startsWith('util_')), 2);
   const options = [...mains, ...utils];
-  for (const opt of options) {
-    const btn = document.createElement('button');
-    btn.dataset.rarity = opt.rarity || 'common';
-    const costText = opt.cost ? costToText(opt.cost) : '';
-    btn.innerHTML = `${opt.label} — ${opt.desc} ${costText ? `<small>${costText}</small>`:''}`;
+  for (const opt of options) {
+    const btn = document.createElement('button');
+    btn.className = 'card-btn';
+    btn.dataset.rarity = opt.rarity || 'common';
+    const costText = opt.cost ? costToText(opt.cost) : '';
+    // Structured inner for styling
+    btn.innerHTML = `
+      <div class="card-title">${opt.label}</div>
+      <div class="card-desc">${opt.desc}</div>
+      ${costText ? `<div class="card-cost">${costText}</div>` : ``}
+    `;
     btn.onclick = () => {
       if (opt.cost && !canAfford(opt.cost)) return;
       if (opt.cost) pay(opt.cost);
       opt.apply();
       hangarEl.hidden = true;
       resumeNextWave();
     };
     shopCardsEl.appendChild(btn);
   }
+  attachCard3DInteractions(shopCardsEl);
 }
 
@@ -688,6 +706,69 @@
   return parts.join(' • ');
 }
 
+// --------------------------------
+// 3D tilt + glow follow for cards
+// --------------------------------
+function attachCard3DInteractions(container){
+  const cards = Array.from(container.querySelectorAll('.card-btn'));
+  if (!cards.length) return;
+  // mouse parallax per-card
+  const maxTilt = 7; // degrees
+  const onMove = (e) => {
+    for (const el of cards){
+      const r = el.getBoundingClientRect();
+      const cx = r.left + r.width/2;
+      const cy = r.top + r.height/2;
+      const dx = (e.clientX - cx) / (r.width/2);
+      const dy = (e.clientY - cy) / (r.height/2);
+      const rx = clamp(-dy * maxTilt, -maxTilt, maxTilt);
+      const ry = clamp(dx * maxTilt, -maxTilt, maxTilt);
+      el.style.setProperty('--rx', rx.toFixed(2)+'deg');
+      el.style.setProperty('--ry', ry.toFixed(2)+'deg');
+      // move shimmer focal point
+      const mx = Math.round(((e.clientX - r.left) / r.width) * 100);
+      const my = Math.round(((e.clientY - r.top) / r.height) * 100);
+      el.style.setProperty('--mx', mx+'%');
+      el.style.setProperty('--my', my+'%');
+    }
+  };
+  const onLeave = () => {
+    for (const el of cards){
+      el.style.removeProperty('--rx');
+      el.style.removeProperty('--ry');
+    }
+  };
+  // listeners
+  window.addEventListener('mousemove', onMove, { passive: true });
+  container.addEventListener('mouseleave', onLeave);
+}
+
+function clamp(v,min,max){ return v<min?min:v>max?max:v; }
+
```
