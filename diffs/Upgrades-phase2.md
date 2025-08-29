# Asteroids Roguelite Expansion — Phase 2+ Design Doc

## Core Additions

### Currency Drops
- **Salvage Shards** (common, from all asteroids) — basic money.
- **Ore Types** (from special asteroid variants):
  - **Iron Ore** (gray asteroids): cheap, common; fuels baseline shop upgrades.
  - **Gold Ore** (golden asteroids): rarer, high-value; unlocks stronger weapons.
  - **Platinum** (white/blue asteroids): rare drops, used for tech upgrades like drones or shields.
  - **Adamantium** (dark red/black asteroids): ultra-rare, unlocks permanent meta upgrades across runs.
- **Enemy Core Fragments**: dropped by hunters/bosses; used for exotic abilities.

Each pickup floats in space briefly, forcing the player to move aggressively to grab them.

### Hangar Shop (Between Waves)
Every 3–5 waves, player drops into a **Hangar** (overlay screen) where they can spend accumulated currency. Shop shows 4–6 random cards pulled from a large pool. Currencies add depth:
- Salvage = baseline cost.
- Gold/Platinum = required for higher-tier cards.
- Adamantium = banked between runs for meta unlocks.

### Upgrade Categories

#### Weapons
- **Double Barrel**: fire two shots per trigger.
- **Chain Lightning Rounds**: bullets arc to nearby enemies.
- **Rocket Pod**: secondary fire (fires a rocket every few seconds).
- **Laser Beam**: sustained beam for damage over time.
- **Shotgun Blast**: close-range cone with knockback.
- **Sawblade Drones**: spinning blades orbit and slice asteroids.
- **Mag Rail**: piercing shots that travel across the whole map.
- **Plasma Mines**: drop mines that explode in AoE.
- **Homing Missiles**: slow-tracking rockets.
- **Overcharge Rounds**: shots that grow in size and damage the longer you don’t shoot.

#### Ship Upgrades
- **Afterburner Dash**: double-tap to dash in a direction.
- **Recharging Shield**: regain 1 shield every 20s.
- **Hull Plating**: +50% HP, slower acceleration.
- **Magnetic Collector**: tractor beam pulls salvage/currency to the ship.
- **Time Dilation**: slow down game for 2s when hit.
- **Thruster Control**: strafe thrusters, more precise movement.
- **Energy Core Expansion**: +1 active ability slot.

#### Drones
- **Basic Drone**: small shooter.
- **Assault Drone**: fires faster.
- **Shield Drone**: blocks bullets.
- **Medic Drone**: slowly recharges your shields.
- **Explosive Drone**: kamikaze attacks on impact.
- **Mining Drone**: increases currency drop chance from asteroids.
- **Drone Commander**: all drones gain +20% damage and +10% fire rate.

#### Active Utilities
- **EMP Blast**: stuns enemies for 2s.
- **Gravity Well**: creates a field that slows asteroids.
- **Deployable Turret**: stationary auto-gun for 10s.
- **Phase Blink**: short teleport in aim direction.
- **Black Hole Bomb**: sucks in enemies and explodes.

#### Meta Unlocks (Adamantium Sink)
Persistent upgrades available only from Adamantium collected across runs:
- **New Ship Classes**:
  - Interceptor (fast, fragile, high DPS).
  - Juggernaut (slow, tanky, melee rams).
  - Engineer (extra drones, cheaper hangar upgrades).
- **Permanent Weapon Mods**: start with double gun, start with drone, start with shield regen.
- **Unlock New Biomes**: crystalline sector, nebula sector, volcanic sector.

### New Asteroid Types
- **Iron Asteroid**: standard rock, drops Salvage + Iron.
- **Gold Asteroid**: shiny, drops Gold Ore.
- **Platinum Asteroid**: icy glow, higher HP, drops Platinum.
- **Adamantium Asteroid**: dark, pulsing red, rare spawn; drops Adamantium.
- **Crystal Asteroid**: refracts bullets, splitting them randomly.
- **Volatile Asteroid**: explodes on destruction.
- **Magnetic Asteroid**: pulls nearby pickups toward it, dangerous to harvest.

### Boss Ideas
- **Colossus Rock**: massive asteroid with multiple cores, each spawning enemies when cracked.
- **Asteroid Worm**: segmented rock worm that tunnels in/out of screen.
- **Obsidian Sentinel**: armored asteroid that fires laser beams.

---

## Flow
1. Player clears waves, picks up salvage + ores.
2. Every 3–5 waves, game pauses → Hangar Shop opens.
3. Player spends Salvage/Gold/Platinum for run upgrades.
4. Rare Adamantium banked to persistent profile for meta unlocks.
5. Continue waves, facing stronger asteroid types, enemies, and bosses.

---

## UI/UX Additions
- **Hangar Screen**: grid of upgrade cards, each shows cost + rarity.
- **Starting Screen**: animated background with starfield, big “Asteroids Roguelite” logo, Start Game / Options / Quit.
- **Currencies HUD**: icons + counts top-right (Salvage, Gold, Platinum, Adamantium).

---

# Task List for Codex
- Implement resource drops from asteroid variants.
- Add currency tracking & HUD display.
- Build Hangar Shop UI (random cards, costs, apply effects).
- Extend upgrade pool with weapon/ship/drone/utility upgrades.
- Add persistent meta system with Adamantium.
- Implement new asteroid types with visuals + drop logic.
- Add starting screen with background image placeholder.
- Wire transitions: Game → Shop → Next Wave.

---
