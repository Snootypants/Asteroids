# Asteroids v1 — Three.js Roguelite Arcade (MVP)

A modern, juicy re‑imagining of the classic Asteroids built with Three.js. The MVP focuses on tight controls, crunchy visuals, and a clear path for roguelite upgrades and future content.

This repo currently contains a fully playable MVP with glow, particles, toon/rim‑lit asteroids, screen shake, enemies, and a between‑wave upgrade system. It runs entirely in the browser with no build step.

## Demo (Local)

- Serve the folder with any static server (examples below) and open `index.html`.
- Do not use `file://` — ES module imports require `http://`.

Quick options:
- Python: `python3 -m http.server` then visit `http://localhost:8000`
- VS Code: “Go Live” / Live Server extension

## Controls

- Thrust: `W` or `ArrowUp`
- Turn: `A/D` or `ArrowLeft/ArrowRight`
- Shoot: `Space`
- Restart: `R`
- Toggle status overlay: `` ` `` (backtick) or `F1`

## Features Implemented

- Three.js orthographic scene with bloom, vignette, and toned color space
- Starfield background, screen shake, engine trail, muzzle flashes
- Toon + rim‑lit asteroids with bright outlines for readability
- Bullets inherit ship velocity and fire from the ship’s nose
- Asteroid splitting: large → medium → small
- Enemy “hunters” starting wave 3 with telegraphed spawns, strafing AI, and shots
- Particle systems: impact bursts, engine puffs, debris shards
- Waves, scoring, HUD, game over, restart
- Combo multiplier on quick chains (+20% per chained kill)
- Between‑wave upgrade choices: Spread, Pierce, Rapid Fire, Engine Boost, Shield
- Spawn + shield invulnerability windows with visual shield ring
- Status overlay with live logs and failure diagnostics

## Tech Stack

- Three.js (ESM via CDN import map)
- No framework, no build step — just static files
- Post‑processing: UnrealBloomPass, OutlinePass, custom Vignette shader

## Project Structure

- `index.html` — bootstrap, HUD, upgrade/status overlays, import map
- `styles.css` — simple HUD/overlay styling
- `src/main.js` — entire game: scene, loop, entities, AI, effects
- `docs/prd.md` — product requirements and roadmap

## Local Development

1) Start a local server in the repo root (pick one):

- `python3 -m http.server` (Python)
- `npx http-server -p 8000` (Node)
- VS Code Live Server

2) Open `http://localhost:8000` (or whichever port your server reports).

3) If the page shows “Game failed to start”:

- Open DevTools → Console; copy any red errors
- Some networks/extensions block CDN imports; whitelist `unpkg.com` or vendor Three locally

### Vendoring Three.js (optional)

If your environment blocks CDN access, the imports can be switched to local files. Create a `vendor/three/` folder with `three.module.js` and the examples modules used: `EffectComposer`, `RenderPass`, `UnrealBloomPass`, `ShaderPass`, `OutlinePass`. Update the imports in `src/main.js` and the import map in `index.html` to point to local paths.

## Roadmap

Short‑term polish
- Hit particles for every fragment burst (tuned per size)
- Near‑miss slow‑mo + slight zoom on multi‑kill
- Color variants: icy/metal/crystal asteroid palettes
- SFX: engine hum, fire, impacts, warning pings

Gameplay expansions
- Enemy types: bomber (mines), sniper (charge shots), swarm drones
- Boss every 5 waves with loot burst
- Hazards/biomes: gravity wells, nebula slow, explosive zones
- Persistent meta: salvage currency, unlock tree, ship variants
- Daily seeded runs and leaderboards (cloud optional)

## License

All Rights Reserved. See `LICENSE` and `NOTICE` for details.

- Copyright © 2025 Snootypants. All rights reserved.
- Public viewing is allowed for evaluation. No copying, modification, or redistribution without explicit written permission from the owner.

## Acknowledgements

- Three.js and the examples team for the excellent post‑processing stack
- The many Asteroids clones for decades of inspiration

---

Have ideas or requests? PRs and issues welcome.
