# PLAN.md - Work Planning Log

This file contains all planned work with timestamps and detailed steps.
Each entry should be appended before starting work.

---

## Add death reason to game over screen - 20250831T1830
Plan: Display what caused the game to end on the endOverlay so players understand what killed them

- Step 1: Check die() function at src/main.js:1098 to see current death reasons being passed
  - Found: "Asteroid collision", "Enemy collision", "Enemy bullet"
- Step 2: Add death reason element to endOverlay in index.html:90-95
  - Add <p id="endDeathReason"> between endStats and restart instruction
- Step 3: Update die() function at src/main.js:1108-1113
  - Get endDeathReason element and set its textContent with the death reason
- Step 4: Style the death reason text for visibility
  - Use red color (#ff6b6b) to make it stand out
- Step 5: Update TECHNICAL_GUIDE.md with changes

---

## Update CLAUDE.md to enforce mandatory workflow - 20250831T1845
Plan: Make the 4-step workflow absolutely mandatory and impossible to skip

- Step 1: Read current CLAUDE.md to understand existing structure
- Step 2: Add urgent stop notice at the very top of the file
- Step 3: Make each step explicitly MANDATORY with warning symbols
- Step 4: Add blocking statements between steps (DO NOT PROCEED warnings)
- Step 5: Create detailed verification checklist with consequences
- Step 6: Add visual indicators (🔴, ⚠️, 🛑, ❌, ✅) for maximum visibility
- Step 7: Emphasize "FAILURE TO FOLLOW = TASK FAILURE" throughout
- Step 8: Update TECHNICAL_GUIDE.md (Note: No technical changes needed for this doc update)

---

## Fix asteroids spawning in visible play area - 251231104800
Plan: Ensure asteroids always spawn off-screen to prevent instant player death at wave start

- Step 1: Locate spawnWave() function at src/main.js:766
- Step 2: Analyze current spawn logic (lines 769-770) - currently spawning at 25-45% of world size from center
- Step 3: Calculate proper off-screen spawn positions beyond visible boundaries (world is ±45 width, ±30 height)
- Step 4: Modify spawn positions to ensure asteroids start outside visible area (>45 units on X or >30 units on Y)
- Step 5: Maintain existing velocity pointing toward center for gameplay balance
- Step 6: Test that asteroids spawn off-screen and move into play area naturally

---

## Fix missing attachCard3DInteractions function crash - 251231105000
Plan: Remove or implement the missing function that crashes the game when opening hangar

- Step 1: Locate the call to attachCard3DInteractions() at src/main.js:723
- Step 2: Check what this function was supposed to do (3D card interactions for shop)
- Step 3: Either comment out the call or implement basic version to prevent crash
- Step 4: Verify hangar shop opens without crashing after wave 3
- Step 5: Update TECHNICAL_GUIDE.md with fix

---

## Remove boss shooting and make them chase player with incremental speed - 20250831183000
Plan: Change boss behavior from shooting to chasing with speed increases per boss

- Step 1: Locate Hunter enemy AI in update loop at src/main.js:865-1096
  - Find enemy shooting logic around lines 972-980
  - Find enemy movement logic around lines 961-971
- Step 2: Remove/disable enemy shooting behavior
  - Comment out or remove the shooting logic for enemies
  - Remove eBullets creation and updates
- Step 3: Implement chase behavior for bosses
  - Calculate direction from enemy to player ship
  - Apply acceleration toward player instead of random movement
- Step 4: Make each boss incrementally faster
  - Track boss number (based on wave/3 or similar)
  - Increase maxSpeed and accel for each successive boss
- Step 5: Test boss behavior at waves 3, 6, 9 etc.

---

## Reduce glow on currency pickups - 20250831183100
Plan: Make coin/metal drops glow less intensely

- Step 1: Locate addPickup() function at src/main.js:1347
- Step 2: Find material/emissive settings for pickup sprites
- Step 3: Reduce emissiveIntensity or emissive color brightness
- Step 4: Test that pickups are still visible but less glowing

---

## Make player bullets smaller and thinner - 20250831183200
Plan: Reduce bullet size by 50% and make them thin glowing lines

- Step 1: Locate createBullet() function at src/main.js:456
- Step 2: Find bullet geometry creation (likely a sphere or cylinder)
- Step 3: Reduce geometry size to 50% of current
- Step 4: Adjust shape to be more line-like (possibly use cylinder with small radius)
- Step 5: Maintain glow effect but with smaller size
- Step 6: Update BULLET constant if needed at src/main.js:44

---