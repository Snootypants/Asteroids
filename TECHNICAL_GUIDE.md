# TECHNICAL_GUIDE.md - AI Assistant Reference

## Quick Context
Three.js Asteroids roguelite with currency/shop system. Single-file game logic (src/main.js, 1389 lines). Uses CDN imports, no build process.

## Critical File Locations
- **Game logic**: `src/main.js` (ALL game code here)
- **UI/Layout**: `index.html` (overlays, HUD elements)
- **Styling**: `styles.css` (3D card effects, animations)
- **Assets**: `assets/` (start_screen.png, gameEnd.png)

## Global State Variables (ALWAYS CHECK THESE)
```javascript
// Core game objects - src/main.js:595-610
ship         // Player THREE.Mesh
bullets[]    // Player projectiles
asteroids[]  // Asteroid meshes
enemies[]    // Hunter enemy meshes  
eBullets[]   // Enemy projectiles
pickups[]    // Currency sprites
drones[]     // Helper drone objects

// Game state - src/main.js:602-608
score        // Current score
wave         // Current wave number
gameOver     // Boolean game state
pausedForUpgrade // In upgrade menu
invuln       // Invulnerability timer (seconds)
combo        // Current combo multiplier
comboTimer   // Seconds to maintain combo

// Currencies - src/main.js:635-636
salvage, gold, platinum, adamantium

// Modifiers object - src/main.js:1136-1144
mods = {
  fireRateMul  // Fire rate multiplier
  engineMul    // Speed/accel multiplier
  spread       // false | true | 'wide'
  pierce       // false | true | 'super' | 'ultra'
  shields      // Number of shield charges
  ricochet     // Bounce count (0-2)
  drones       // Active drone count
  magnet       // Pickup attraction multiplier
  magnetLvl    // Magnet upgrade level
}
```

## Key DOM Elements (MUST EXIST BEFORE USE)
```javascript
// HUD - index.html:49-66
document.getElementById('score')
document.getElementById('wave') 
document.getElementById('combo')
document.getElementById('salvageCount')
document.getElementById('goldCount')
document.getElementById('platCount')
document.getElementById('adamCount')

// Overlays - index.html:76-121
document.getElementById('choices')      // Upgrade cards
document.getElementById('choiceCards')  // Card container
document.getElementById('startOverlay') // Start screen
document.getElementById('endOverlay')   // End screen
document.getElementById('endDeathReason') // Death reason display (index.html:93)
document.getElementById('hangar')       // Shop overlay
document.getElementById('shopCards')    // Shop items container
```

## Core Functions to Modify Game State

### Starting/Resetting
```javascript
resetGame()      // src/main.js:735 - Clears all entities, resets state
startRun()       // src/main.js:832 - Initial game start
spawnWave()      // src/main.js:766 - Creates asteroids/enemies for current wave
                 // Asteroids now spawn off-screen (>55 units X or >40 units Y from center)
                 // Prevents instant collision at wave start
```

### Combat/Damage
```javascript
shoot()          // src/main.js:1256 - Fire bullets with all modifiers
die(reason)      // src/main.js:1098 - Trigger game over, displays reason on endOverlay
circleHit()      // src/main.js:71 - Collision detection
```

### Progression
```javascript
offerUpgrades()  // src/main.js:1146 - Show 3 upgrade cards
openHangar()     // src/main.js:699 - Show shop (every 3 waves)
closeHangar()    // src/main.js:729 - Exit shop, advance wave
resumeNextWave() // src/main.js:1231 - After upgrade selection
```

### Entity Creation
```javascript
createShip()             // src/main.js:434 - Returns ship mesh
createBullet(x,y,dir)    // src/main.js:456 - Returns bullet mesh
createAsteroid(size,x,y,vx,vy) // src/main.js:482 - Returns asteroid mesh
createHunter(x,y)        // src/main.js:516 - Returns enemy mesh
addPickup(type,amt,x,y)  // src/main.js:1347 - Creates currency pickup
addDrone()               // src/main.js:1286 - Adds helper drone
```

## Update Loop Pattern (src/main.js:865-1096)
```javascript
function update(dt) {
  // 1. Update timers (invuln, combo)
  // 2. Handle input → ship movement
  // 3. Update bullets, handle wrapping
  // 4. Update asteroids movement
  // 5. Update enemy AI
  // 6. Check all collisions
  // 7. Check wave completion → offer upgrades/shop
  // 8. Update visual effects
}
```

## Common Modification Patterns

### Adding New Upgrade
```javascript
// In offerUpgrades() pool array - src/main.js:1153
{ 
  key: 'unique_key',
  label: 'Display Name',
  desc: 'Description text',
  rarity: 'common|uncommon|rare|epic|legendary',
  available: () => true,  // Condition function
  apply: () => { /* modify mods object */ }
}
```

### Modifying Weapon Behavior
```javascript
// Edit shoot() - src/main.js:1256
// Check mods.spread, mods.pierce, mods.ricochet
// Bullets get userData.pierce and userData.ricochet properties
```

### Adding Currency Costs
```javascript
// In shop items - src/main.js:703
cost: { salv: 30, gold: 1, plat: 0, adam: 0 }
// Check affordability - src/main.js:718
canAfford = (salvage >= cost.salv) && (gold >= cost.gold) ...
```

### Spawning Entities
```javascript
// Always add to appropriate array
asteroids.push(createAsteroid(...))
bullets.push(createBullet(...))
enemies.push(createHunter(...))
// Remove with: scene.remove(obj) + array.splice()
```

## WARNINGS - Common Issues

### Missing Function (FIXED)
**attachCard3DInteractions()** - Was referenced at src/main.js:723 but NOT DEFINED. Now commented out to prevent crash.

### Incomplete Handlers
- `#leaveHangar` button - No onclick handler
- `#rerollShop`, `#banishOne`, `#toggleVis` - Shop controls without implementations

### State Dependencies
- Must call `resetGame()` before `spawnWave()`
- Must set `pausedForUpgrade = true` before showing overlays
- Must update currency HUD after any currency change via `updateCurrencyHUD()`

### Three.js Specifics
- Ship/enemy rotation uses +X as forward (cones rotated)
- World coordinates: ±45 width, ±30 height
- Wrapping handled by `wrap()` function
- Camera is orthographic, not perspective

## Configuration Constants (src/main.js:14-46)
```javascript
WORLD = { width: 90, height: 60 }
PLAYER = { accel: 40, maxSpeed: 40, friction: 0.98, turn: 3.2, fireRate: 0.16 }
ASTEROIDS = {
  large: { r: 6, score: 20, next: 'medium', count: 2 }
  medium: { r: 3.5, score: 50, next: 'small', count: 2 }
  small: { r: 2.0, score: 100, next: null, count: 0 }
}
BULLET = { speed: 70, life: 1.1, r: 0.2 }  // Reduced size by 50%
ENEMY = { radius: 1.2, accel: 20, maxSpeed: 26, fireRate: 0.9 }  // Note: bosses no longer shoot
```

## Post-Processing Pipeline Order (src/main.js:129-158)
1. RenderPass (base scene)
2. OutlinePass (entity highlights via `outlineTargets[]`)
3. UnrealBloomPass (glow effects)
4. VignetteShader (edge darkening)

## Input Handling
- **Keys**: Stored in `keys` Set, check with `keys.has('w')`
- **Mouse**: `mouse.lmb` (shoot), `mouse.rmb` (thrust), `mouse.enabled` flag
- **Special**: R (restart), M (mouse mode), Space (shoot), Q/A (zoom)

## Visual Effects Systems
- **ParticleSystem** (src/main.js:254) - Pooled sprites for explosions
- **DebrisSystem** (src/main.js:391) - 3D shards for breaks
- **Camera shake** - `addShake(magnitude, duration, x, y)`
- **Shield visual** - Ring mesh, opacity based on shield state

## Audio
- All sounds via `SFX.play('name')` - src/main.js:368
- Types: shoot, hit, explode, pickup, upgrade, gameover, shield
- Note: enemy_shoot sound no longer used (bosses don't shoot)

## Frame Update Sequence
```javascript
tick() {  // src/main.js:840
  1. Calculate delta time
  2. Call update(dt) if not paused
  3. Update camera shake
  4. Update particles/debris
  5. Render via composer
  6. Request next frame
}
```

## Quick Debugging
- Press F1 or ` to toggle status log
- Press T to spawn debug cube at origin
- Check `window.__status` for logging
- Frame counter in top-right shows frame count

## Death Reasons
The die() function accepts a reason parameter that is displayed on game over:
- "Asteroid collision" - When ship hits an asteroid
- "Enemy collision" - When ship collides with Hunter enemy
Death reason appears in endDeathReason element (index.html:93) styled in red (#ff6b6b)

Note: "Enemy bullet" death reason removed - bosses no longer shoot

## When Making Changes
1. Check if entity needs to be in an array (bullets[], asteroids[], etc.)
2. Check if it needs outline (add to outlineTargets[])
3. Check if it needs collision detection
4. Check if it affects any mods values
5. Remember to call scene.remove() when removing entities
6. Update relevant HUD elements after state changes

## Boss Behavior Changes (Aug 31, 2025)
### Enemy AI Overhaul
- **Bosses no longer shoot** - All enemy shooting logic removed from update loop (src/main.js:979-993)
- **Chase behavior** - Bosses now chase player directly without preferred distance
- **Incremental speed** - Each boss is 20% faster than previous (boss number = Math.floor(wave/3))
- **Speed calculation** - maxSpeed and accel multiplied by (1 + (bossNumber - 1) * 0.2)

### Visual Changes
- **Bullets redesigned** - Now thin glowing cylinders instead of spheres (src/main.js:457-470)
- **Bullet size reduced** - BULLET.r changed from 0.4 to 0.2 (50% smaller)
- **Pickup glow reduced** - Pickups use NormalBlending instead of AdditiveBlending, opacity reduced to 0.65

### Removed Systems
- **Enemy bullets** - eBullets array cleaned up, collision detection removed
- **Enemy shooting** - eShoot() function calls removed from enemy AI loop
- **Enemy bullet materials** - enemyBulletMat still exists but unused