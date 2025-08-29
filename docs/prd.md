# PRD: Asteroids Rethink (Updated)

## Vision
Reimagine the classic *Asteroids* as a modern browser-based roguelite arcade game. The core stays simple and immediately playable, but with layers of depth: upgrades, enemy variety, modes, and juicy polish. Scope starts tight, then expands iteratively.

---

## Core Loop (Phase 1)
1. Player controls a ship with thrust, rotation, and shoot.
2. Large asteroids drift across screen. Shooting splits them into medium, then small, then dust.
3. Score is awarded for each destruction.
4. A new wave spawns once all asteroids are cleared.
5. Game ends on player death (Phase 1: one life).

---

## Phase 1 Scope (MVP)
- **Ship**: triangle sprite, thrust + shoot controls.
- **Asteroids**: three sizes, random drift.
- **Collision**: bullets split asteroids; ship dies on contact.
- **Scoring**: points per asteroid destroyed.
- **HUD**: score, wave counter.
- **Game Over Screen**: restart prompt.

---

## Expansion Hooks (Post-MVP)

### Ship Upgrades
- **Permanent Meta Unlocks**: salvage currency between runs; unlock new base ships, armor, or shields.
- **Run-Based Mods**: randomized upgrade choices during a run (spread shot, piercing bullets, temporary shield, homing missiles, engine boost).
- **Modular Parts**: hull (durability), engine (speed), weapon bay (weapon type) with trade-offs.

### Weapons
- **Procedural Mods**: ricochet, explosive, rapid-fire, charge-shot, cluster bombs.
- **Synergies**: combine two mods for unique effects (piercing + explosive = railgun cluster).

### Enemies
- **Enemy Ships**: appear after wave 3–5; hunters that dodge and shoot back.
- **Mini-Boss Asteroids**: armored, explosive, or spawning mines.
- **Boss Fights**: giant asteroids with phases and bullet-hell attacks every N waves.

### Environments & Modes
- **Alternate Modes**: endless survival, time attack, boss rush.
- **Hazards**: nebula slows bullets, gravity wells curve trajectories, explosive zones.
- **Biomes**: ice (slippery inertia), magma (lava trails), crystal (fragmenting shards).

### Roguelite Meta
- **Salvage Currency**: earned on runs; spent on permanent unlocks.
- **Unlock Trees**: branching upgrades (offense, defense, utility).
- **Random Events**: mid-run drops (supply crates, curses).
- **Ghost Runs**: optional playback of previous attempts for comparison.

### Polish
- **Visual Feedback**: screen shake, particles, trails, juicy explosions.
- **Audio Cues**: warning sirens, asteroid crack sounds, upgrade jingles.
- **Visual Variety**: asteroid variants (metallic, crystalline, glowing).

### Community
- **Leaderboards**: online high scores with names and dates.
- **Daily/Weekly Challenges**: fixed seed runs with special rules.
- **Replay Sharing**: deterministic run replays that can be watched or shared.

---

## Tech Targets
- **Engine**: JavaScript/TypeScript + Canvas/WebGL (Three.js optional).
- **Lines Target**: <1K for Phase 1 core loop, modular expansion after.
- **Persistence**: localStorage for offline play, cloud integration optional for leaderboards.

---

## Success Criteria
- **MVP**: Playable, bug-free Asteroids clone with juicy polish.
- **Expansion**: Roguelite systems and enemy variety keep players returning.
- **Retention**: Meta unlocks, upgrades, and challenges extend play beyond nostalgia.