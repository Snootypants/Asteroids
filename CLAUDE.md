# CLAUDE.md - MANDATORY AI WORKFLOW - DO NOT SKIP ANY STEP

## 🔴 STOP! YOU MUST FOLLOW THIS 4-STEP PROCESS 🔴
**FOR EVERY TASK, NO MATTER HOW SMALL:**
1. **READ** TECHNICAL_GUIDE.md FIRST
2. **PLAN** in PLAN.md BEFORE coding  
3. **EXECUTE** the plan with TodoWrite tracking
4. **UPDATE** TECHNICAL_GUIDE.md after changes

## ⚠️ CRITICAL: THIS IS A MANDATORY 4-STEP WORKFLOW ⚠️
**YOU MUST COMPLETE ALL 4 STEPS IN ORDER. NO EXCEPTIONS.**
**IF YOU SKIP ANY STEP, YOU HAVE FAILED.**

### STEP 1 (MANDATORY): READ TECHNICAL_GUIDE.md FIRST
```bash
# YOU MUST READ THIS BEFORE ANYTHING ELSE - NO EXCEPTIONS
cat TECHNICAL_GUIDE.md
```
**❌ DO NOT PROCEED TO STEP 2 UNTIL YOU HAVE READ TECHNICAL_GUIDE.md**

### STEP 2 (MANDATORY): WRITE YOUR PLAN TO PLAN.md BEFORE ANY CODE CHANGES
**You MUST append your plan to PLAN.md BEFORE making ANY code changes:**
```markdown
## [Short description] - [YYMMDDHHMMSS timestamp]
Plan: [Describe the work]

- Step 1: [Specific action with line numbers]
- Step 2: [Specific action with line numbers]
- Step 3: [Specific action with line numbers]
- ...
```
Include:
- List the specific changes needed
- Identify which functions/variables will be affected
- Note line numbers from TECHNICAL_GUIDE.md
- Check for dependencies and side effects
- Use TodoWrite tool to track tasks

**❌ DO NOT WRITE ANY CODE UNTIL YOU HAVE WRITTEN YOUR PLAN TO PLAN.md**

### STEP 3 (MANDATORY): EXECUTE Your Plan
- Follow the plan exactly
- Reference TECHNICAL_GUIDE.md for:
  - Global state variables to check
  - Function signatures and locations
  - Common patterns to follow
  - Warnings to avoid
- Test changes if possible
- Use TodoWrite tool to track progress

### STEP 4 (MANDATORY): UPDATE TECHNICAL_GUIDE.md
**You MUST update TECHNICAL_GUIDE.md after making changes:**
- New functions added (with line numbers)
- Modified state variables
- New DOM elements
- Updated warnings/issues
- Changed configuration values

**❌ YOUR WORK IS NOT COMPLETE UNTIL TECHNICAL_GUIDE.md IS UPDATED**

## 🛑 WORKFLOW VERIFICATION CHECKLIST 🛑
Before considering ANY task complete, verify:
- [ ] ✅ Step 1: I read TECHNICAL_GUIDE.md FIRST
- [ ] ✅ Step 2: I wrote my plan to PLAN.md BEFORE coding
- [ ] ✅ Step 3: I executed the plan and used TodoWrite
- [ ] ✅ Step 4: I updated TECHNICAL_GUIDE.md with ALL changes

**IF ANY CHECKBOX IS UNCHECKED, YOU HAVE NOT COMPLETED THE TASK**

## Why This Workflow Is MANDATORY
- The codebase is 1389 lines in a single file (src/main.js)
- Without the guide, you're searching blindly
- The guide tracks known issues (like missing attachCard3DInteractions)
- State management is complex with many interdependencies

## 📋 MANDATORY EXECUTION CHECKLIST 📋
**YOU MUST CHECK EVERY BOX:**
- [ ] Step 1: Read TECHNICAL_GUIDE.md COMPLETELY before starting
- [ ] Step 2: Write detailed plan to PLAN.md with timestamp BEFORE coding
- [ ] Step 3a: Create todo list with TodoWrite tool
- [ ] Step 3b: Execute changes following the plan exactly
- [ ] Step 3c: Mark todos as completed as you work
- [ ] Step 4: Update TECHNICAL_GUIDE.md with ALL changes made

**⚠️ IF YOU CANNOT CHECK ALL BOXES, YOU HAVE NOT COMPLETED THE TASK ⚠️**

## Common Tasks Reference

### Adding a new upgrade
1. Check TECHNICAL_GUIDE.md section "Adding New Upgrade"
2. Find the pool array at src/main.js:1153
3. Add new object with key, label, desc, rarity, available, apply
4. Update mods object if needed
5. Update TECHNICAL_GUIDE.md with new mod property

### Fixing a bug
1. Check TECHNICAL_GUIDE.md "WARNINGS" section first
2. Locate the relevant function/system
3. Check state dependencies
4. Make fix
5. Update guide if bug was systemic

### Adding new features
1. Review similar existing features in guide
2. Check which arrays/systems need updating
3. Follow existing patterns (entity creation, collision, etc.)
4. Add to appropriate update loop section
5. Document in guide

## Remember
- **attachCard3DInteractions()** is MISSING - don't try to call it
- Shop buttons (#rerollShop, #banishOne, #toggleVis) have no handlers
- Always check if DOM elements exist before using them
- Update currency HUD after ANY currency change
- Set pausedForUpgrade before showing overlays

## 🚨 REMEMBER: THE 4-STEP WORKFLOW IS MANDATORY 🚨
1. **READ** TECHNICAL_GUIDE.md → 2. **PLAN** in PLAN.md → 3. **EXECUTE** → 4. **UPDATE** TECHNICAL_GUIDE.md

**FAILURE TO FOLLOW ALL 4 STEPS = TASK FAILURE**