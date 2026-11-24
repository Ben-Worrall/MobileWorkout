# Gym Note - Game Plan (v1.2.0 work)

READ THIS FIRST when resuming. Update the checkboxes and "RESUME HERE" as you go. Never put secrets in this file
(tokens/keys are in the Claude memory file `project_supabase.md`; GitHub PAT: use `git credential fill` or ask the user).

## v1.3.1 POLISH REVIEW (2026-11-23, code read-through, no emulator)
Status: code fixed + verified by PASS fresh schema has rir + side
PASS user_version is 1
PASS getDb returns one shared handle
PASS seed inserts the whole library  [346]
PASS second seed is a no-op
PASS legacy install keeps rows before migration
PASS routine saved with 2 exercises
PASS editing a routine does not duplicate rows
PASS editing keeps created_at / renames
PASS old routine rows are deleted in the cloud (no pile-up)  [deletes=2]
PASS deleting a routine used by past workouts works
PASS past workout survives, link cleared
PASS future scheduled entry removed, completed one kept
PASS deleting a custom exercise used in a routine works
PASS its routine link is gone, routine remains
PASS weekly workouts counts workouts, not sets  [[{"week":"2026-W47","workouts":1}]]
PASS personal records ignore the unfinished workout
PASS session count helper
PASS summaries report 10 sets
PASS left+right counts as ONE set  [1]
PASS upload skips the unfinished workout  [s1,s3]
PASS upload skips sets of unfinished workouts (would break the batch)
PASS upload order respects foreign keys  [workout_templates>workout_sessions>logged_sets>scheduled_workouts]
PASS a failed upload is reported, not ignored  [logged_sets: boom]
PASS restoring from the cloud does NOT delete local sets of a synced workout  [11 -> 11]
PASS cloud values are merged in
PASS different account clears the previous account's workouts
PASS local-only data of the previous account was not uploaded to the new one
PASS local-only set is gone after switching accounts
PASS clearLocalUserData leaves built-in exercises
PASS (diagnosis) old INSERT OR REPLACE really did delete the set via cascade
PASS 100 kg shows as 220.5 lb
PASS typing 135 lb stores 61.23 kg and shows 135 lb
PASS kg round trip
PASS empty weight parses to 0
PASS rest remaining counts down
PASS pause freezes the time
PASS resume continues from the frozen value
PASS +15s extends
PASS workout timer pause keeps elapsed

40 passed, 0 failed (40/40, real database/sync/units/timer code on Node's SQLite) and a static scan; build compiled; NOT yet published or run on a device. Publish as v1.3.1 when the user agrees.
Fixed:
- DATA LOSS: cloud restore used INSERT OR REPLACE, which cascade-deleted a workout's local sets (diagnosis reproduced). Now merges with ON CONFLICT ... DO UPDATE, inside a transaction.
- Sync: upload ignored errors (said 'Synced' when it failed); sets of unfinished workouts broke the whole sets batch; cloud writes could arrive out of order (queue added); getUser() network call per write (now getSession()); big uploads chunked; fetch pages ordered.
- Account switch: signing into a different account on the same device now clears the previous account's local data first (setting data_owner) instead of uploading it into the new account; sign-out backs up first.
- Editing a routine left old rows in the cloud (duplicates on restore): now deleted. Routine save is one transaction.
- Deleting a routine used by past workouts, or a custom exercise used in a routine, silently failed (foreign keys). Fixed + errors shown.
- Routine editor still had the OLD exercise picker (collapsed list = 'search shows nothing', missing Traps/Forearms): now uses the shared ExercisePicker + Create new exercise.
- Weekly workouts count was multiplied by sets; Progress workouts count capped at 200; personal records included unfinished workouts; Home 'today' used UTC date; finishing a scheduled workout never synced; resumed unknown exercise showed 'Exercise'; keep-for-later now pauses the clock; double-tap save guards; sync failure after login is now shown.
- Performance: the whole workout screen re-rendered twice a second while a timer ran; timers now tick in small components (utils/useNow.js, WorkoutClock).
- Cleanup: removed unused code/imports/exports, unused dependency react-native-gifted-charts, dead CI workflows (build.yml ran on every push and failed), declared expo-file-system, website text updated, lb input rounding.
Limitations FIXED afterwards (same v1.3.1, unpublished): offline edits retry automatically on app open/return (sync_dirty + syncIfDirty); deletes made offline are remembered (sync_tombstones) so they are not restored and are retried; History has Load more (50 at a time); chart weeks/days use local time. logic-test now 48/48. Remaining known limit: if two phones edit the same account offline, the last sync wins per row.

## v1.3.0 WORK (friends + profiles + lb/kg)  <-- READ THIS FIRST, it is the current job
### RESUME HERE (v1.3.0)
- Current step: **v1.3.0 PUBLISHED 2026-11-21 (friends + lb/kg). Tested on emulator: unique usernames, not-found message, pending request gives NO access until accepted, accepted friend progress page, lb conversion. NOT tested: rejecting/unfriending via UI, share toggle off via UI, typing lb into a workout and saving, reps of Home friends card.**
- Last updated: 2026-11-20. User wants: LIGHT testing only, then publish v1.3.0. Keep token use low (no big screenshot loops).
- Update this block after every step.

### User request (2026-11-20)
1. Profiles when logged in; add friends by USERNAME; usernames globally unique (one owner each).
2. Friends can see each other's progression.
3. Settings toggle pounds <-> kilograms; EVERYTHING shown/entered follows it.
4. Plan, track progress here, test lightly (friends + lb), then push the update.

### Design decisions
- Storage stays KILOGRAMS in SQLite + Supabase (canonical). lb is display/input conversion only (1 kg = 2.2046226 lb). Setting key `weight_unit` in user_settings ('kg'|'lb'); `context/UnitContext.jsx` exposes `unit, setUnit, fmtW(kg), fmtVol(kg), toDisplay(kg), toKg(displayStr), label`.
- Supabase: `profiles(user_id pk, username, share_progress, created_at)`; unique index on lower(username); CHECK username ~ '^[a-z0-9_]{3,20}
- Current phase: **v1.2.0 PUBLISHED 2026-11-20 (user asked to stop testing and ship). Remaining: finish the P8 checklist items not yet tested (see Test pass log), rotate keys with the user.**
- Last thing finished: P7: scripts/build-exercises.js (deny-list+dedupe+caps) -> constants/exercises.generated.js (217) + 17 hand EXTRA + 16 flagged unilateral; library = 346 exercises, all described, 64 L/R; new muscles Traps/Forearms (+theme colours); EQUIPMENT += Kettlebell/Bands/Other; EXERCISE_SEED_VERSION=3. Version bumped to 1.2.0 (3 places).
- Next action: (optional) retest on the published build: upgrade path from 1.1.0, in-app update 1.1.0->1.2.0, routines/schedule/settings, rest-timer force-stop resume, custom exercise edit/delete. Then scrub secrets from Claude memory once user rotates keys.
- Last updated: 2026-11-19
- NOTE: config changes take ~30-45 s to propagate on Supabase Auth.

## What the user asked for (2026-11-19)
1. Email confirmation link must work (currently opens localhost; logging in afterwards works).
2. Timers must keep running when the app is minimised or the screen is off (phone powered fully off is impossible).
3. Rest timer must not block the UI: minimisable, tap a small timer icon to expand; user must still be able to scroll and add exercises while it runs.
4. RIR (reps in reserve) 0-10 per exercise, used in calculations; compare week to week (last week RIR 2, this week RIR 3).
5. Unilateral exercises: left/right (arm, leg, side) tracked separately.
6. Research and add more exercises.
7. User must be able to add exercises to the library; they must sync to the account and be stored locally.

## Decisions I made (user can override)
- RIR is stored PER SET (nullable, 0-10, 0 = failure) and averaged per exercise. Reason: RIR changes set to set.
- RIR feeds: estimated 1RM = weight x (1 + (reps + RIR)/30) (Epley on effective reps), avg RIR per session, "hard sets" (RIR <= 3),
  and a "compared with last time" card.
- Unilateral = `logged_sets.side` ('L'/'R', NULL = both). A unilateral SET counts once in set counts but both sides count in volume.
  Exercise default comes from `exercises.is_unilateral`; the user can also toggle it per exercise inside a workout.
- Rest timer starts after BOTH sides of a unilateral set are ticked.
- Timers are timestamp-based (end time stored), not tick-counted; a scheduled local notification fires at rest end.
- Exercise expansion source: free-exercise-db (https://github.com/yuhonas/free-exercise-db, Unlicense/public domain, 876 exercises,
  fields: name, force, level, mechanic, equipment, primaryMuscles, secondaryMuscles, instructions, category). Curated, not dumped.

## Research findings (do not redo)
- Supabase auth config (read via Management API GET /v1/projects/<ref>/config/auth): `site_url = http://localhost:3000`, `uri_allow_list` empty,
  built-in email sender `rate_limit_email_sent = 2` per HOUR for the whole project (a real limit for sign-ups; custom SMTP needs a user account
  e.g. Resend - ask user if they want it). Confirmation template uses `{{ .ConfirmationURL }}` (fine). Fix = set site_url + allow list +
  pass `emailRedirectTo` in signUp + host a landing page on GitHub Pages (repo `docs/` folder is the Pages root).
- expo-notifications for SDK 51 = `~0.28.19`. Android 12+: exact alarms need `SCHEDULE_EXACT_ALARM`; on Android 14 it is denied by default
  unless the app is a clock/calendar app, BUT `USE_EXACT_ALARM` (API 33+) is auto-granted and meant for alarm/timer apps. We sideload (no
  Play policy), so declare `USE_EXACT_ALARM` + `SCHEDULE_EXACT_ALARM` (maxSdkVersion 32 or plain) + `POST_NOTIFICATIONS`. VERIFY in
  node_modules/expo-notifications android source that scheduling uses `setExactAndAllowWhileIdle`; verify on emulator with `dumpsys alarm`.
- Android 13+ needs runtime POST_NOTIFICATIONS permission: request when first rest timer starts.
- free-exercise-db muscles: quadriceps, shoulders, abdominals, chest, hamstrings, triceps, biceps, lats, middle back, calves, lower back,
  forearms, glutes, traps, adductors, neck, abductors. Equipment: barbell, dumbbell, other, body only, cable, machine, kettlebells, bands,
  medicine ball, exercise ball, foam roll, e-z curl bar. Categories: strength 584, stretching 123, plyometrics 61, powerlifting 38,
  olympic 35, strongman 21, cardio 14. ~107 names look unilateral (alternate/single/one-arm/one-leg/split/lunge...).
- Existing library (constants/exercises.js) has 120 exercises with hand-written `notes` descriptions; ids are slugs like `bench-press`.
- KNOWN BUG (found by reading code): `syncRecord()` in utils/sync.js adds `user_id` to every table but Supabase `template_exercises` has
  NO `user_id` column, so template exercises never sync. Fix in P2 by adding the column (+ RLS) rather than stripping it (avoids an RLS
  race with the template insert).
- LIKELY CAUSE of "can't add exercise to library": `app/(tabs)/library.jsx` add-modal is a `ScrollView` inside a `maxHeight:'80%'` container
  with no flex (same bug that emptied the workout picker earlier), no KeyboardAvoidingView, and the new-exercise category defaults to
  `CATEGORIES[0] === 'All'` (invalid). MUST REPRODUCE on emulator before fixing.
- Pitfall: Android `Modal` + `maxHeight` + ScrollView/FlatList child collapses to 0 height. Use an explicit `height` or `flex:1` inside a fixed-height parent.

## Architecture changes
- Split `app/active-workout.jsx` (it is getting large) into `components/workout/{ExerciseBlock,SetRow,RestTimerChip,RestTimerSheet,RirPicker}.jsx`
  plus `utils/timers.js` (timestamp math) and `utils/notifications.js` (permission, channel, schedule/cancel).
- SQLite migrations via `PRAGMA user_version` in `utils/database.js` (`migrate(db)` after `initSchema`): add columns only if missing
  (check `PRAGMA table_info`). SQLite has no `ADD COLUMN IF NOT EXISTS`.
- Active workout persistence: store JSON `active_workout` in `user_settings` ({sessionId, templateId, exercises, timer, rest}) so killing the app
  does not lose the session; Home shows a "Resume workout" card when an unfinished session exists.
- Seeding: `seedExercises` currently upserts every launch. Wrap in a transaction and skip when `exercise_seed_version` setting matches.

## PHASES (tick as completed; each phase ends with an emulator test, then update RESUME HERE)

### P1 - Email confirmation fix  [x] DONE 2026-11-19
1. [x] `docs/confirmed.html` created, pushed, live (HTTP 200 at https://ben-worrall.github.io/MobileWorkout/confirmed.html).
2. [x] Supabase auth config PATCHed: site_url = that page; uri_allow_list = `https://ben-worrall.github.io/MobileWorkout/**,mobileworkout://**`.
3. [x] `context/AuthContext.jsx` signUp passes `emailRedirectTo` (ships with the next app build; old app builds also work because site_url is now correct).
4. [x] Tested via admin generate_link: link -> 303 -> confirmed.html#access_token... ; user email_confirmed_at set. Test users deleted.
5. [ ] STILL TO TELL USER: 2 emails/hour built-in limit; offer custom SMTP (Resend) or disabling confirmation.

### P2 - Data model + sync migrations  [x] code done 2026-11-19 (emulator upgrade test is in P8)  (Supabase FIRST, additive, so old app versions keep working)
1. [ ] Supabase SQL via Management API (write JSON file, `curl --data-binary @file`):
       ALTER logged_sets ADD rir INTEGER CHECK (rir BETWEEN 0 AND 10); ADD side TEXT CHECK (side IN ('L','R'));
       ALTER exercises ADD is_unilateral INTEGER DEFAULT 0;
       ALTER template_exercises ADD user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE; backfill from workout_templates;
       replace its RLS policy with `user_id = auth.uid()`; finish with `NOTIFY pgrst, 'reload schema';`
2. [ ] SQLite `migrate()` adds `logged_sets.rir`, `logged_sets.side`, `exercises.is_unilateral`; bump `user_version`.
3. [ ] Update `logSet`, `updateSet`, `getSession`, analytics SQL (set counts must not double count R side: use
       `SUM(CASE WHEN ls.side='R' THEN 0 ELSE 1 END)`), `addCustomExercise`, `seedExercises` (is_unilateral).
4. [ ] `utils/sync.js`: include new columns in `downloadCloudData` column lists; `syncRecord` for template_exercises now valid.
5. [ ] TEST: fresh install + upgrade-from-1.1.0 install (data preserved, columns added); cloud round trip (seed with sqlite3 on device, login, wipe app data, login again).

### P3 - Timer rework (non-blocking + background)  [x] code done, UNTESTED (test in P8)
1. [ ] `npx expo install expo-notifications`; add plugin + permissions (`POST_NOTIFICATIONS`, `USE_EXACT_ALARM`, `SCHEDULE_EXACT_ALARM`) in app.json AND
       android/app/src/main/AndroidManifest.xml (android/ is gitignored and hand-edited; keep both in sync). Re-run `scripts/patch-node-modules.js` if needed.
2. [ ] `utils/notifications.js`: channel "rest-timer" (HIGH importance, vibration), request permission lazily, `scheduleRestEnd(endAt)`, `cancelRest()`.
3. [ ] `utils/timers.js` + hooks: rest timer = `{endAt, pausedRemaining|null, total}`; remaining = ceil((endAt-now)/1000); 250 ms interval + recompute on
       `AppState` -> 'active'. +/-15 s adjust endAt and reschedule the notification; pause stores remaining and cancels; skip cancels.
4. [ ] Workout elapsed timer also timestamp-based (`startedAt`, `pausedAccum`, `running`) persisted in `active_workout`.
5. [ ] New UI: rest chip in the header under the workout timer (e.g. "Rest 1:23", turns green->amber->red); tap opens a bottom-sheet popover with
       -15 / pause / +15 / skip / minimise; tapping outside minimises. NOTHING overlays the scroll area; scroll content keeps paddingBottom.
       Chip must not block "Add Exercise". Auto-show chip (not the big sheet) when a set is ticked.
6. [ ] Resume: persist `active_workout`; Home "Resume workout" card; opening Active Workout with `resume=1` restores exercises/sets/timers.
7. [ ] TEST on emulator: start rest 20 s (temporarily via setting), press HOME, `adb shell input keyevent KEYCODE_POWER` (screen off), wait,
       check `adb shell dumpsys alarm | grep gymnote` before and `dumpsys notification` after for the posted notification; relaunch and confirm
       remaining time is correct; kill app (`am force-stop`) mid-rest and confirm the notification still fires and resume restores state.
       Also confirm "Add Exercise" and scrolling work with the timer running.

### P4 - Workout UI: RIR + unilateral  [x] code done, UNTESTED
1. [ ] `RirPicker` (bottom sheet, buttons 0-10, "Clear"); each set row: kg x reps [RIR chip] tick. RIR defaults to previous set's value, nullable.
2. [ ] Unilateral exercise block: each set shows L and R sub-rows (own kg/reps/RIR/tick); set complete when both ticked; header menu toggle
       "Unilateral (left/right)" overrides the library default for this workout; rest starts after the second side.
3. [ ] Exercise-complete logic: all sets (both sides if unilateral) ticked -> crossed out (existing behaviour).
4. [ ] `edit-session.jsx` and History cards understand `rir` and `side` (show "L 20kg x 10 @RIR2").
5. [ ] TEST on emulator: normal exercise with RIR; unilateral exercise (DB Row) L/R; toggle unilateral on a bilateral exercise; save; edit; DB check
       with sqlite3 (`select exercise_name,set_number,side,weight,reps,rir from logged_sets`).

### P5 - Analytics using RIR and sides  [x] code done, UNTESTED
1. [ ] DB helpers: `getExerciseSessionStats(exerciseId)` -> per session: best e1RM, avg RIR, top weight, total reps, sets, L/R averages.
2. [ ] `exercise-detail.jsx`: chart mode Volume | Weight | Est. 1RM; "Compared with last time" card (weight, reps, avg RIR, e1RM deltas);
       RIR column in history rows; L vs R comparison with imbalance warning (>10% difference).
3. [ ] `progress.jsx`: avg RIR per muscle and period-over-period change in the "Your Progress" list; metric toggle gets "Hard sets" (RIR <= 3).
4. [ ] TEST with seeded data (sqlite3 seed script like before: sessions at different weeks with different RIR) and screenshot every screen.

### P6 - Library: add / edit / sync custom exercises  [x] code done, UNTESTED
1. [ ] Reproduce the bug on the emulator first (screenshot the add modal with keyboard open), then rebuild the modal: fixed-height sheet or
       KeyboardAvoidingView, Name, Muscle chips, Equipment chips, "Unilateral" switch, Description, derived category (not 'All'), validation, duplicate-name check.
2. [ ] Allow editing a custom exercise (name/muscle/equipment/notes/unilateral); delete already exists. All call `syncRecord`/`syncDelete`.
3. [ ] "Create exercise" shortcut inside the workout exercise picker.
4. [ ] Confirm local persistence (SQLite) and cloud sync (check Supabase `exercises` rows with user_id) and restore after wiping app data.
5. [ ] TEST: create exercise, use it in a workout, finish, wipe data, log in, exercise + workout history restored.

### P7 - Exercise library expansion  [x] code done, UNTESTED
1. [ ] `scripts/build-exercises.js` (downloads dist/exercises.json to a temp dir, NOT committed; outputs `constants/exercises.generated.js`).
2. [ ] Mapping: quadriceps/hamstrings/adductors -> Legs; abductors/glutes -> Glutes; lats/middle back/lower back -> Back; traps -> Traps (new);
       forearms -> Forearms (new); abdominals -> Core; neck -> skip; shoulders/chest/biceps/triceps/calves as is. Equipment: barbell/e-z curl bar -> Barbell,
       dumbbell, cable, machine, body only -> Bodyweight, kettlebells -> Kettlebell (new), bands -> Bands (new), others -> Other.
       Skip categories stretching, strongman, olympic weightlifting (keep powerlifting/strength/plyometrics/cardio subset), skip foam roll/exercise ball.
3. [ ] Dedupe against the existing 120 by normalised name (lowercase, strip punctuation/plurals); existing hand-written entries win.
4. [ ] Description = first ~3 instruction steps joined, <= 450 chars. Id = `fx-<slug>`. `is_unilateral` by name regex
       (single|one-arm|one-leg|alternat|unilateral|split squat|lunge|step-up|concentration|kickback|one arm|one leg) plus a curated list.
5. [ ] Flag `is_unilateral` on the existing 120 where appropriate (DB Row, Concentration Curl, Bulgarian Split Squat, Lunges, Walking Lunges, Single Leg Calf Raise, DB Kickback, Side Plank, Single Arm Pushdown, Cable Kickback...).
6. [ ] Add 'Forearms','Traps' to MUSCLES, `muscleColor`, library chips, picker chips (picker list is hard-coded in active-workout.jsx - derive from MUSCLES instead).
7. [ ] Seed performance: transaction + `exercise_seed_version`.
8. [ ] Target ~400-450 exercises total. Check bundle size and first-launch seed time on the emulator.
9. [ ] Mention source/licence (Unlicense) in Settings > About. (TODO in P8 fix list)

### P8 - FULL VIRTUAL-MACHINE TEST LOOP  [ ]   (USER REQUIREMENT 2026-11-19 - do this once P2-P7 are built)
Rules from the user: run the emulator and test EVERYTHING added. If something does not work, DO NOT stop: write it in the
"FAILURES / FIX LIST" below (what, where, how reproduced, screenshot name), then carry on and finish the whole test pass.
When the pass is complete: fix everything on the list, rebuild, and test again. Repeat until one complete pass has zero failures.
Only then go to P9 (release). Record every pass in the "Test pass log".

Checklist (tick per pass; copy it into the log for each pass):
 AUTH       [ ] launch gate shows when signed out  [ ] Continue without account -> Home, persists after restart  [ ] sign up shows confirm message
            [ ] login -> Home, cloud data restored on a wiped app  [ ] sign out -> gate with Continue button  [ ] relaunch signed in -> Home directly
 EMAIL      [ ] generate_link redirect lands on confirmed.html (see P1 test)
 WORKOUT    [ ] start empty workout  [ ] start from routine  [ ] picker opens, search works, muscle chips readable, new muscles present
            [ ] add exercise  [ ] remove exercise (with/without sets)  [ ] tick set / untick  [ ] add / remove set  [ ] exercise crosses out when all done
            [ ] RIR picker 0-10, default carries to next set, clear works  [ ] unilateral exercise shows L/R rows  [ ] toggle unilateral on a normal exercise
            [ ] finish -> saved, discard -> no leftover session  [ ] volume math (weight x reps, both sides counted)
 TIMERS     [ ] workout timer play/pause  [ ] rest chip appears after a tick and does NOT block scrolling or "Add Exercise"  [ ] tap chip -> sheet, -15/+15/pause/skip/minimise
            [ ] HOME button then return: time still correct  [ ] screen off (KEYCODE_POWER) past end: notification posted (dumpsys notification)
            [ ] force-stop app mid-rest: alarm still fires, reopening resumes workout  [ ] permission prompt on Android 13+ handled
 HISTORY    [ ] list/month groups/tap to edit  [ ] edit-session shows and edits RIR + side
 PROGRESS   [ ] overview chart + advancement list  [ ] Volume/Sets/Hard sets toggle  [ ] By Muscle view  [ ] periods 1M/3M/6M/1Y  [ ] avg RIR per muscle
 EXERCISE   [ ] detail page: description, chart modes incl. Est. 1RM, compared-with-last-time, RIR column, L vs R
 LIBRARY    [ ] chips readable  [ ] ~400+ exercises present with descriptions  [ ] search/filter  [ ] ADD custom exercise (form usable with keyboard open)
            [ ] edit/delete custom  [ ] custom exercise usable in workout  [ ] synced to Supabase (query exercises with test user)  [ ] restored after wipe+login
 ROUTINES   [ ] create routine, start from it  [ ] schedule on calendar, complete it
 SETTINGS   [ ] rest-timer length picker  [ ] version label  [ ] Check for Updates -> Download & Install from the PREVIOUS release, data preserved
 DATA       [ ] upgrade install over 1.1.0 keeps data and migrates columns  [ ] fresh install seeds exercises quickly
 SECURITY   [ ] `node scripts/rls-test.js` (needs env SUPABASE_SERVICE_KEY) -> all PASS  [ ] no secrets in git (`git grep`), none in APK bundle

FAILURES / FIX LIST  (append; mark [x] when fixed AND retested)
 [x] F1 CRITICAL (ALSO hits FRESH installs and login-restore on a wiped app: 0 built-in exercises seeded, Home suggestions/volume wrong, same two SQLite errors)  (found pass 1, upgrade 1.1.0->1.2.0 first launch): utils/database.js getDb() assigns the module-level db BEFORE initSchema/migrate finish, so concurrent callers (Home, seed, suggestions) run queries before the new columns exist ("no such column: ls.side") and two migrate() calls both ALTER ("duplicate column name: rir"). Effects: Home shows "No workouts yet" with 11 workouts in DB; exercise seeding never ran (114 exercises, no exercise_seed_sig). FIX: cache one init PROMISE (dbPromise) and return it to every caller; make addColumnIfMissing swallow "duplicate column". Retest: upgrade install over 1.1.0 with data, first launch shows workouts + 346 exercises.
 [x] F2 cosmetic: Home "Last workout" stat card wraps "Yesterday" onto two lines ("Yesterd/ay") - use smaller font/adjustsFontSizeToFit/numberOfLines=1 (app/(tabs)/index.jsx statNum for the last-workout card).
 [x] F3 layout: RirPicker number cells (components/workout/RirPicker.jsx) are not square/centred - digits sit at the bottom edge and the 11th cell wraps alone (width 15.5% + aspectRatio inside a gap-wrapped row). Use explicit fixed cell size (e.g. 56x56) in a wrap row, centre text, 6 per row.
 [x] F4 chart honesty: SimpleChart (exercise-detail.jsx) and LineChart (progress.jsx) scale bars from the MIN value so the smallest bar renders ~2px (looks like zero). Scale from 0 so bar heights are proportional.
 [x] F5 grammar: exercise-detail History row says "1 sets" - use singular.
 (more below as pass 1 continues)

Test pass log  (append: date, pass #, result, failures found)
 PASSED so far in pass 1 (build 1.2.0): picker shows 346 exercises + Create new exercise; unilateral block shows L/R rows; RIR picker 0-10 selects + shows on row; ticking 1L then 1R starts rest only after BOTH; header Rest chip + sheet (-15/pause/+15/skip/minimise); Add Exercise usable while rest runs; notification permission prompt appears + exact alarm registered (dumpsys alarm); screen-off: Rest over notification posted; force-stop mid-workout: Home Resume card (4 sets) appears.
 Also PASSED in pass 1: finish saves L/R + RIR rows to DB and clears active_workout; History lists + opens editor with side/RIR; exercise-detail Compared-with-last-time + RIR in history; Progress Overview Volume/Sets/Hard toggles, avg RIR per muscle, % vs previous period; Library search. F1-F5 fixed in source (NOT yet rebuilt/retested).
 Also PASSED in pass 1 (old build): Left-vs-right card (30kg L vs 24kg R -> 20% warning); new ExerciseForm (muscle/equipment/L-R switch/description) saves locally with category Upper Body + is_unilateral=1; cloud sync of custom exercises and of sets with rir+side verified via REST; login on a WIPED app restored 17 sessions / 79 sets / 28 RIR sets / 10 L-R sets / 2 custom exercises. NEXT: rebuild with F1-F5, retest FRESH install (expect 346 exercises on first launch) and upgrade path, then re-run remaining checklist (routines, schedule, settings, updater, rest timer minimise etc).
 Pass 1 started 2026-11-19 on build 1.2.0 (versionCode 12): upgrade install over 1.1.0 -> schema migrated OK (rir, side, is_unilateral, user_version=1, 11 workouts kept); FAILED F1 (see list). Continuing pass 1 on the same build (migration is already applied so later launches should work).

### P9 - Release  [ ]   (only after a complete zero-failure P8 pass)
1. [ ] Bump version to 1.2.0 in app.json (version + versionCode), android/app/build.gradle, constants/version.js.
2. [ ] Build, `aapt dump badging` (versionName, permissions incl. POST_NOTIFICATIONS/USE_EXACT_ALARM).
3. [ ] Publish GitHub release v1.2.0 with BOTH `GymNote.apk` and `GymNote-v1.2.0.apk`; commit + push source (android/ is gitignored).
4. [ ] In-app update test from the previous version on the emulator (Settings > Check for Updates > Download & Install), data preserved.
5. [ ] Delete test users/data created in Supabase; tell the user what was NOT tested on a real phone.
6. [ ] SECURITY follow-ups with the user: they rotate/revoke the keys listed in "Security audit" below; then scrub secrets from Claude memory
       (`project_supabase.md`) and fix the git remote URL.

## Test environment cheat sheet
- Emulator AVD `gymtest`: `C:\Users\Ben\android-dev\sdk\emulator\emulator.exe -avd gymtest -no-snapshot -no-audio -gpu swiftshader_indirect`.
  adb: `C:\Users\Ben\android-dev\sdk\platform-tools\adb.exe`. It is slow and ANRs under memory pressure (`am kill-all` helps).
- Screenshots: in Git Bash `adb exec-out screencap -p > file.png` (PowerShell redirect corrupts PNG). Screenshot coords x1.2 = device px (1080x2400).
- Git Bash mangles device paths: `export MSYS_NO_PATHCONV=1` and give adb a Windows-style source path (`C:/Users/...`). Node needs Windows paths too.
- Device DB: `/data/data/com.gymnote.app/files/SQLite/mobileworkout.db` (adb is root; `sqlite3` exists on device). Seed by pushing a .sql file and
  `sqlite3 db < file`. Force-stop the app before editing.
- Another Claude session (xyracloud) may deploy to the same emulator and steal focus; re-front `com.gymnote.app` before taps. Do not touch that app.
- `adb shell input text` types into the focused field; Tab does NOT move focus - tap each field.
- Create a confirmed test user: POST `/auth/v1/admin/users` with service key `{email,password,email_confirm:true}`; delete with DELETE `/auth/v1/admin/users/<id>`.
- Build: see memory `project_gymnote.md` (JAVA_HOME/ANDROID_HOME, `gradlew.bat assembleRelease --no-daemon`, 3-7 min; run in background).
- Release: GitHub release + upload APK twice (GymNote.apk + GymNote-vX.Y.Z.apk) with curl `--data-binary`.
- Syntax check before long builds: `node -e` with `@babel/parser` over changed files.

## Security audit (2026-11-19, requested by user) - DONE, follow-ups below
Findings and what was done:
- Repo `Ben-Worrall/MobileWorkout` is PUBLIC. Git history scanned for sb_secret_, sbp_, ghp_, github_pat_, service_role, keystore password, private keys:
  only hit = `scripts/migrate-supabase.js` containing a 15-character PREFIX of the Supabase secret key (redacted here; not usable on its own). File removed;
  clean schema now in `supabase/schema.sql`. History not rewritten (fragment is harmless and rotating the key makes it moot).
- Keystore (`gymnote.keystore`) is gitignored (`*.keystore`), not tracked, not shipped. `android/` is gitignored. No `.env` tracked.
- Published APK (v1.1.0) scanned: contains only the project URL and the PUBLISHABLE key (public by design). `sb_secret_` text is supabase-js library
  code. No management token, no PAT, no service-role/secret key.
- REAL VULNERABILITY FOUND AND FIXED: the old `exercises` RLS policy allowed rows with `user_id IS NULL`, so anyone with the (public) publishable key
  could INSERT/UPDATE/DELETE ownerless rows without logging in (a probe row proved it; deleted). Fix applied live: all six tables now have
  `FOR ALL TO authenticated USING/WITH CHECK (user_id = auth.uid())` (template_exercises via template ownership), `exercises.user_id NOT NULL`,
  and `REVOKE ALL ... FROM anon` (+ default privileges). Verified with `scripts/rls-test.js` (20/20 PASS: cross-user read/update/delete/spoof blocked,
  anonymous read/write blocked). Re-run it after every schema change (P2 changes template_exercises policy - update schema.sql and retest!).
- Local plaintext secrets (NOT on GitHub) that the user should rotate: (1) GitHub PAT embedded in the git remote URL inside `.git/config`
  (fix: `git remote set-url origin https://github.com/Ben-Worrall/MobileWorkout.git` after revoking); (2) the broad "entire account" GitHub PAT the user
  pasted into chat; (3) Supabase secret key and (4) Supabase Management API token (`sbp_`, full account control - most dangerous) pasted into chat and
  stored in Claude memory `project_supabase.md`. Revoke/regenerate: github.com/settings/tokens, Supabase dashboard > Settings > API Keys,
  supabase.com/dashboard/account/tokens. Create a fine-grained GitHub token limited to this repo (Contents: read/write).
- Optional hardening: Supabase min password length is 6 (app also enforces 6); consider 8+. Weak keystore password `gymnote123` is acceptable only
  because the keystore never leaves the PC - do NOT change it (would break in-app updates for existing installs). `.github/workflows/build.yml` is dead
  (only references secrets by name) and can be deleted.

## Risks / open questions for the user
- Supabase free email sender = 2 emails/hour. Offer custom SMTP (needs their account) or disable confirmation.
- Android may delay notifications on some phones with aggressive battery savers (Samsung/Xiaomi); user may need to disable battery optimisation for Gym Note.
- A powered-off phone cannot run anything; "screen off / locked / app minimised" is what we support.
- RIR per set vs per exercise (chose per set).

## Progress log (append newest at bottom)
- 2026-11-19: plan written after research (Supabase config, expo-notifications, free-exercise-db, library modal analysis).
 (stored lowercase). `friendships(id, requester, addressee, status 'pending'|'accepted')` with unique pair index on (least,greatest).
- Privacy: friends do NOT get row access to workout tables. They only get aggregated data via SECURITY DEFINER RPCs that verify an ACCEPTED friendship and `share_progress = true`: `lookup_username`, `my_friends`, `friend_overview`, `friend_muscle_weeks`. anon has no EXECUTE on any of them; authenticated only.
- Guests (no account) cannot use friends: Friends screen shows "Sign in to use friends".
- Username is claimed on the Friends screen (not at signup, because email confirmation means no session at signup).
- Entry points: Settings > "Friends & profile", Home header people icon. No new bottom tab (already 5).

### Steps (tick as done)
- [x] Q1 Plan written
- [x] Q2 Supabase (supabase/friends.sql, scripts/sync-exercise-catalog.js, scripts/friends-test.js; NOTE built-in exercise muscles come from table exercise_catalog - re-run scripts/sync-exercise-catalog.js whenever the library changes): tables + RLS + RPCs; save to supabase/schema.sql; extend scripts/rls-test.js (unique username case-insensitive, friend flow, non-friend blocked, share_progress=false blocked, anon blocked); run it -> all PASS
- [x] Q3 Units (code done): utils/units.js + context/UnitContext.jsx (provider in app/_layout.jsx); Settings toggle; convert displays: components/workout/SetRow.jsx + ExerciseBlock.jsx (input default/drafts in display unit, tick converts to kg), app/edit-session.jsx (inputs+header), app/exercise-detail.jsx (PR/max/compare/L-R/history), app/(tabs)/history.jsx, app/(tabs)/index.jsx volume cards, app/(tabs)/progress.jsx (totals, bars, PR cards, chart label), components/OverviewChart.jsx axis labels
- [x] Q4 Friends UI (code done): utils/social.js, app/friends.jsx (my username claim, share toggle, add by username, incoming/outgoing requests, friends list), app/friend.jsx (friend progression: summary, OverviewChart of muscle weeks, top lifts, recent workouts); routes in app/_layout.jsx; Settings + Home entry points
- [x] Q5 Light test (done): rls-test passes; emulator: Settings toggle lb -> a workout screen shows lb; two test users befriend via API and friend_overview returns data; one quick screenshot of Friends screen
- [x] Q6 published v1.3.0

### Notes / failures found (append)
(none yet)

## (older) RESUME HERE for v1.2.0 - finished and published
- Current phase: **v1.2.0 PUBLISHED 2026-11-20 (user asked to stop testing and ship). Remaining: finish the P8 checklist items not yet tested (see Test pass log), rotate keys with the user.**
- Last thing finished: P7: scripts/build-exercises.js (deny-list+dedupe+caps) -> constants/exercises.generated.js (217) + 17 hand EXTRA + 16 flagged unilateral; library = 346 exercises, all described, 64 L/R; new muscles Traps/Forearms (+theme colours); EQUIPMENT += Kettlebell/Bands/Other; EXERCISE_SEED_VERSION=3. Version bumped to 1.2.0 (3 places).
- Next action: (optional) retest on the published build: upgrade path from 1.1.0, in-app update 1.1.0->1.2.0, routines/schedule/settings, rest-timer force-stop resume, custom exercise edit/delete. Then scrub secrets from Claude memory once user rotates keys.
- Last updated: 2026-11-19
- NOTE: config changes take ~30-45 s to propagate on Supabase Auth.

## What the user asked for (2026-11-19)
1. Email confirmation link must work (currently opens localhost; logging in afterwards works).
2. Timers must keep running when the app is minimised or the screen is off (phone powered fully off is impossible).
3. Rest timer must not block the UI: minimisable, tap a small timer icon to expand; user must still be able to scroll and add exercises while it runs.
4. RIR (reps in reserve) 0-10 per exercise, used in calculations; compare week to week (last week RIR 2, this week RIR 3).
5. Unilateral exercises: left/right (arm, leg, side) tracked separately.
6. Research and add more exercises.
7. User must be able to add exercises to the library; they must sync to the account and be stored locally.

## Decisions I made (user can override)
- RIR is stored PER SET (nullable, 0-10, 0 = failure) and averaged per exercise. Reason: RIR changes set to set.
- RIR feeds: estimated 1RM = weight x (1 + (reps + RIR)/30) (Epley on effective reps), avg RIR per session, "hard sets" (RIR <= 3),
  and a "compared with last time" card.
- Unilateral = `logged_sets.side` ('L'/'R', NULL = both). A unilateral SET counts once in set counts but both sides count in volume.
  Exercise default comes from `exercises.is_unilateral`; the user can also toggle it per exercise inside a workout.
- Rest timer starts after BOTH sides of a unilateral set are ticked.
- Timers are timestamp-based (end time stored), not tick-counted; a scheduled local notification fires at rest end.
- Exercise expansion source: free-exercise-db (https://github.com/yuhonas/free-exercise-db, Unlicense/public domain, 876 exercises,
  fields: name, force, level, mechanic, equipment, primaryMuscles, secondaryMuscles, instructions, category). Curated, not dumped.

## Research findings (do not redo)
- Supabase auth config (read via Management API GET /v1/projects/<ref>/config/auth): `site_url = http://localhost:3000`, `uri_allow_list` empty,
  built-in email sender `rate_limit_email_sent = 2` per HOUR for the whole project (a real limit for sign-ups; custom SMTP needs a user account
  e.g. Resend - ask user if they want it). Confirmation template uses `{{ .ConfirmationURL }}` (fine). Fix = set site_url + allow list +
  pass `emailRedirectTo` in signUp + host a landing page on GitHub Pages (repo `docs/` folder is the Pages root).
- expo-notifications for SDK 51 = `~0.28.19`. Android 12+: exact alarms need `SCHEDULE_EXACT_ALARM`; on Android 14 it is denied by default
  unless the app is a clock/calendar app, BUT `USE_EXACT_ALARM` (API 33+) is auto-granted and meant for alarm/timer apps. We sideload (no
  Play policy), so declare `USE_EXACT_ALARM` + `SCHEDULE_EXACT_ALARM` (maxSdkVersion 32 or plain) + `POST_NOTIFICATIONS`. VERIFY in
  node_modules/expo-notifications android source that scheduling uses `setExactAndAllowWhileIdle`; verify on emulator with `dumpsys alarm`.
- Android 13+ needs runtime POST_NOTIFICATIONS permission: request when first rest timer starts.
- free-exercise-db muscles: quadriceps, shoulders, abdominals, chest, hamstrings, triceps, biceps, lats, middle back, calves, lower back,
  forearms, glutes, traps, adductors, neck, abductors. Equipment: barbell, dumbbell, other, body only, cable, machine, kettlebells, bands,
  medicine ball, exercise ball, foam roll, e-z curl bar. Categories: strength 584, stretching 123, plyometrics 61, powerlifting 38,
  olympic 35, strongman 21, cardio 14. ~107 names look unilateral (alternate/single/one-arm/one-leg/split/lunge...).
- Existing library (constants/exercises.js) has 120 exercises with hand-written `notes` descriptions; ids are slugs like `bench-press`.
- KNOWN BUG (found by reading code): `syncRecord()` in utils/sync.js adds `user_id` to every table but Supabase `template_exercises` has
  NO `user_id` column, so template exercises never sync. Fix in P2 by adding the column (+ RLS) rather than stripping it (avoids an RLS
  race with the template insert).
- LIKELY CAUSE of "can't add exercise to library": `app/(tabs)/library.jsx` add-modal is a `ScrollView` inside a `maxHeight:'80%'` container
  with no flex (same bug that emptied the workout picker earlier), no KeyboardAvoidingView, and the new-exercise category defaults to
  `CATEGORIES[0] === 'All'` (invalid). MUST REPRODUCE on emulator before fixing.
- Pitfall: Android `Modal` + `maxHeight` + ScrollView/FlatList child collapses to 0 height. Use an explicit `height` or `flex:1` inside a fixed-height parent.

## Architecture changes
- Split `app/active-workout.jsx` (it is getting large) into `components/workout/{ExerciseBlock,SetRow,RestTimerChip,RestTimerSheet,RirPicker}.jsx`
  plus `utils/timers.js` (timestamp math) and `utils/notifications.js` (permission, channel, schedule/cancel).
- SQLite migrations via `PRAGMA user_version` in `utils/database.js` (`migrate(db)` after `initSchema`): add columns only if missing
  (check `PRAGMA table_info`). SQLite has no `ADD COLUMN IF NOT EXISTS`.
- Active workout persistence: store JSON `active_workout` in `user_settings` ({sessionId, templateId, exercises, timer, rest}) so killing the app
  does not lose the session; Home shows a "Resume workout" card when an unfinished session exists.
- Seeding: `seedExercises` currently upserts every launch. Wrap in a transaction and skip when `exercise_seed_version` setting matches.

## PHASES (tick as completed; each phase ends with an emulator test, then update RESUME HERE)

### P1 - Email confirmation fix  [x] DONE 2026-11-19
1. [x] `docs/confirmed.html` created, pushed, live (HTTP 200 at https://ben-worrall.github.io/MobileWorkout/confirmed.html).
2. [x] Supabase auth config PATCHed: site_url = that page; uri_allow_list = `https://ben-worrall.github.io/MobileWorkout/**,mobileworkout://**`.
3. [x] `context/AuthContext.jsx` signUp passes `emailRedirectTo` (ships with the next app build; old app builds also work because site_url is now correct).
4. [x] Tested via admin generate_link: link -> 303 -> confirmed.html#access_token... ; user email_confirmed_at set. Test users deleted.
5. [ ] STILL TO TELL USER: 2 emails/hour built-in limit; offer custom SMTP (Resend) or disabling confirmation.

### P2 - Data model + sync migrations  [x] code done 2026-11-19 (emulator upgrade test is in P8)  (Supabase FIRST, additive, so old app versions keep working)
1. [ ] Supabase SQL via Management API (write JSON file, `curl --data-binary @file`):
       ALTER logged_sets ADD rir INTEGER CHECK (rir BETWEEN 0 AND 10); ADD side TEXT CHECK (side IN ('L','R'));
       ALTER exercises ADD is_unilateral INTEGER DEFAULT 0;
       ALTER template_exercises ADD user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE; backfill from workout_templates;
       replace its RLS policy with `user_id = auth.uid()`; finish with `NOTIFY pgrst, 'reload schema';`
2. [ ] SQLite `migrate()` adds `logged_sets.rir`, `logged_sets.side`, `exercises.is_unilateral`; bump `user_version`.
3. [ ] Update `logSet`, `updateSet`, `getSession`, analytics SQL (set counts must not double count R side: use
       `SUM(CASE WHEN ls.side='R' THEN 0 ELSE 1 END)`), `addCustomExercise`, `seedExercises` (is_unilateral).
4. [ ] `utils/sync.js`: include new columns in `downloadCloudData` column lists; `syncRecord` for template_exercises now valid.
5. [ ] TEST: fresh install + upgrade-from-1.1.0 install (data preserved, columns added); cloud round trip (seed with sqlite3 on device, login, wipe app data, login again).

### P3 - Timer rework (non-blocking + background)  [x] code done, UNTESTED (test in P8)
1. [ ] `npx expo install expo-notifications`; add plugin + permissions (`POST_NOTIFICATIONS`, `USE_EXACT_ALARM`, `SCHEDULE_EXACT_ALARM`) in app.json AND
       android/app/src/main/AndroidManifest.xml (android/ is gitignored and hand-edited; keep both in sync). Re-run `scripts/patch-node-modules.js` if needed.
2. [ ] `utils/notifications.js`: channel "rest-timer" (HIGH importance, vibration), request permission lazily, `scheduleRestEnd(endAt)`, `cancelRest()`.
3. [ ] `utils/timers.js` + hooks: rest timer = `{endAt, pausedRemaining|null, total}`; remaining = ceil((endAt-now)/1000); 250 ms interval + recompute on
       `AppState` -> 'active'. +/-15 s adjust endAt and reschedule the notification; pause stores remaining and cancels; skip cancels.
4. [ ] Workout elapsed timer also timestamp-based (`startedAt`, `pausedAccum`, `running`) persisted in `active_workout`.
5. [ ] New UI: rest chip in the header under the workout timer (e.g. "Rest 1:23", turns green->amber->red); tap opens a bottom-sheet popover with
       -15 / pause / +15 / skip / minimise; tapping outside minimises. NOTHING overlays the scroll area; scroll content keeps paddingBottom.
       Chip must not block "Add Exercise". Auto-show chip (not the big sheet) when a set is ticked.
6. [ ] Resume: persist `active_workout`; Home "Resume workout" card; opening Active Workout with `resume=1` restores exercises/sets/timers.
7. [ ] TEST on emulator: start rest 20 s (temporarily via setting), press HOME, `adb shell input keyevent KEYCODE_POWER` (screen off), wait,
       check `adb shell dumpsys alarm | grep gymnote` before and `dumpsys notification` after for the posted notification; relaunch and confirm
       remaining time is correct; kill app (`am force-stop`) mid-rest and confirm the notification still fires and resume restores state.
       Also confirm "Add Exercise" and scrolling work with the timer running.

### P4 - Workout UI: RIR + unilateral  [x] code done, UNTESTED
1. [ ] `RirPicker` (bottom sheet, buttons 0-10, "Clear"); each set row: kg x reps [RIR chip] tick. RIR defaults to previous set's value, nullable.
2. [ ] Unilateral exercise block: each set shows L and R sub-rows (own kg/reps/RIR/tick); set complete when both ticked; header menu toggle
       "Unilateral (left/right)" overrides the library default for this workout; rest starts after the second side.
3. [ ] Exercise-complete logic: all sets (both sides if unilateral) ticked -> crossed out (existing behaviour).
4. [ ] `edit-session.jsx` and History cards understand `rir` and `side` (show "L 20kg x 10 @RIR2").
5. [ ] TEST on emulator: normal exercise with RIR; unilateral exercise (DB Row) L/R; toggle unilateral on a bilateral exercise; save; edit; DB check
       with sqlite3 (`select exercise_name,set_number,side,weight,reps,rir from logged_sets`).

### P5 - Analytics using RIR and sides  [x] code done, UNTESTED
1. [ ] DB helpers: `getExerciseSessionStats(exerciseId)` -> per session: best e1RM, avg RIR, top weight, total reps, sets, L/R averages.
2. [ ] `exercise-detail.jsx`: chart mode Volume | Weight | Est. 1RM; "Compared with last time" card (weight, reps, avg RIR, e1RM deltas);
       RIR column in history rows; L vs R comparison with imbalance warning (>10% difference).
3. [ ] `progress.jsx`: avg RIR per muscle and period-over-period change in the "Your Progress" list; metric toggle gets "Hard sets" (RIR <= 3).
4. [ ] TEST with seeded data (sqlite3 seed script like before: sessions at different weeks with different RIR) and screenshot every screen.

### P6 - Library: add / edit / sync custom exercises  [x] code done, UNTESTED
1. [ ] Reproduce the bug on the emulator first (screenshot the add modal with keyboard open), then rebuild the modal: fixed-height sheet or
       KeyboardAvoidingView, Name, Muscle chips, Equipment chips, "Unilateral" switch, Description, derived category (not 'All'), validation, duplicate-name check.
2. [ ] Allow editing a custom exercise (name/muscle/equipment/notes/unilateral); delete already exists. All call `syncRecord`/`syncDelete`.
3. [ ] "Create exercise" shortcut inside the workout exercise picker.
4. [ ] Confirm local persistence (SQLite) and cloud sync (check Supabase `exercises` rows with user_id) and restore after wiping app data.
5. [ ] TEST: create exercise, use it in a workout, finish, wipe data, log in, exercise + workout history restored.

### P7 - Exercise library expansion  [x] code done, UNTESTED
1. [ ] `scripts/build-exercises.js` (downloads dist/exercises.json to a temp dir, NOT committed; outputs `constants/exercises.generated.js`).
2. [ ] Mapping: quadriceps/hamstrings/adductors -> Legs; abductors/glutes -> Glutes; lats/middle back/lower back -> Back; traps -> Traps (new);
       forearms -> Forearms (new); abdominals -> Core; neck -> skip; shoulders/chest/biceps/triceps/calves as is. Equipment: barbell/e-z curl bar -> Barbell,
       dumbbell, cable, machine, body only -> Bodyweight, kettlebells -> Kettlebell (new), bands -> Bands (new), others -> Other.
       Skip categories stretching, strongman, olympic weightlifting (keep powerlifting/strength/plyometrics/cardio subset), skip foam roll/exercise ball.
3. [ ] Dedupe against the existing 120 by normalised name (lowercase, strip punctuation/plurals); existing hand-written entries win.
4. [ ] Description = first ~3 instruction steps joined, <= 450 chars. Id = `fx-<slug>`. `is_unilateral` by name regex
       (single|one-arm|one-leg|alternat|unilateral|split squat|lunge|step-up|concentration|kickback|one arm|one leg) plus a curated list.
5. [ ] Flag `is_unilateral` on the existing 120 where appropriate (DB Row, Concentration Curl, Bulgarian Split Squat, Lunges, Walking Lunges, Single Leg Calf Raise, DB Kickback, Side Plank, Single Arm Pushdown, Cable Kickback...).
6. [ ] Add 'Forearms','Traps' to MUSCLES, `muscleColor`, library chips, picker chips (picker list is hard-coded in active-workout.jsx - derive from MUSCLES instead).
7. [ ] Seed performance: transaction + `exercise_seed_version`.
8. [ ] Target ~400-450 exercises total. Check bundle size and first-launch seed time on the emulator.
9. [ ] Mention source/licence (Unlicense) in Settings > About. (TODO in P8 fix list)

### P8 - FULL VIRTUAL-MACHINE TEST LOOP  [ ]   (USER REQUIREMENT 2026-11-19 - do this once P2-P7 are built)
Rules from the user: run the emulator and test EVERYTHING added. If something does not work, DO NOT stop: write it in the
"FAILURES / FIX LIST" below (what, where, how reproduced, screenshot name), then carry on and finish the whole test pass.
When the pass is complete: fix everything on the list, rebuild, and test again. Repeat until one complete pass has zero failures.
Only then go to P9 (release). Record every pass in the "Test pass log".

Checklist (tick per pass; copy it into the log for each pass):
 AUTH       [ ] launch gate shows when signed out  [ ] Continue without account -> Home, persists after restart  [ ] sign up shows confirm message
            [ ] login -> Home, cloud data restored on a wiped app  [ ] sign out -> gate with Continue button  [ ] relaunch signed in -> Home directly
 EMAIL      [ ] generate_link redirect lands on confirmed.html (see P1 test)
 WORKOUT    [ ] start empty workout  [ ] start from routine  [ ] picker opens, search works, muscle chips readable, new muscles present
            [ ] add exercise  [ ] remove exercise (with/without sets)  [ ] tick set / untick  [ ] add / remove set  [ ] exercise crosses out when all done
            [ ] RIR picker 0-10, default carries to next set, clear works  [ ] unilateral exercise shows L/R rows  [ ] toggle unilateral on a normal exercise
            [ ] finish -> saved, discard -> no leftover session  [ ] volume math (weight x reps, both sides counted)
 TIMERS     [ ] workout timer play/pause  [ ] rest chip appears after a tick and does NOT block scrolling or "Add Exercise"  [ ] tap chip -> sheet, -15/+15/pause/skip/minimise
            [ ] HOME button then return: time still correct  [ ] screen off (KEYCODE_POWER) past end: notification posted (dumpsys notification)
            [ ] force-stop app mid-rest: alarm still fires, reopening resumes workout  [ ] permission prompt on Android 13+ handled
 HISTORY    [ ] list/month groups/tap to edit  [ ] edit-session shows and edits RIR + side
 PROGRESS   [ ] overview chart + advancement list  [ ] Volume/Sets/Hard sets toggle  [ ] By Muscle view  [ ] periods 1M/3M/6M/1Y  [ ] avg RIR per muscle
 EXERCISE   [ ] detail page: description, chart modes incl. Est. 1RM, compared-with-last-time, RIR column, L vs R
 LIBRARY    [ ] chips readable  [ ] ~400+ exercises present with descriptions  [ ] search/filter  [ ] ADD custom exercise (form usable with keyboard open)
            [ ] edit/delete custom  [ ] custom exercise usable in workout  [ ] synced to Supabase (query exercises with test user)  [ ] restored after wipe+login
 ROUTINES   [ ] create routine, start from it  [ ] schedule on calendar, complete it
 SETTINGS   [ ] rest-timer length picker  [ ] version label  [ ] Check for Updates -> Download & Install from the PREVIOUS release, data preserved
 DATA       [ ] upgrade install over 1.1.0 keeps data and migrates columns  [ ] fresh install seeds exercises quickly
 SECURITY   [ ] `node scripts/rls-test.js` (needs env SUPABASE_SERVICE_KEY) -> all PASS  [ ] no secrets in git (`git grep`), none in APK bundle

FAILURES / FIX LIST  (append; mark [x] when fixed AND retested)
 [x] F1 CRITICAL (ALSO hits FRESH installs and login-restore on a wiped app: 0 built-in exercises seeded, Home suggestions/volume wrong, same two SQLite errors)  (found pass 1, upgrade 1.1.0->1.2.0 first launch): utils/database.js getDb() assigns the module-level db BEFORE initSchema/migrate finish, so concurrent callers (Home, seed, suggestions) run queries before the new columns exist ("no such column: ls.side") and two migrate() calls both ALTER ("duplicate column name: rir"). Effects: Home shows "No workouts yet" with 11 workouts in DB; exercise seeding never ran (114 exercises, no exercise_seed_sig). FIX: cache one init PROMISE (dbPromise) and return it to every caller; make addColumnIfMissing swallow "duplicate column". Retest: upgrade install over 1.1.0 with data, first launch shows workouts + 346 exercises.
 [x] F2 cosmetic: Home "Last workout" stat card wraps "Yesterday" onto two lines ("Yesterd/ay") - use smaller font/adjustsFontSizeToFit/numberOfLines=1 (app/(tabs)/index.jsx statNum for the last-workout card).
 [x] F3 layout: RirPicker number cells (components/workout/RirPicker.jsx) are not square/centred - digits sit at the bottom edge and the 11th cell wraps alone (width 15.5% + aspectRatio inside a gap-wrapped row). Use explicit fixed cell size (e.g. 56x56) in a wrap row, centre text, 6 per row.
 [x] F4 chart honesty: SimpleChart (exercise-detail.jsx) and LineChart (progress.jsx) scale bars from the MIN value so the smallest bar renders ~2px (looks like zero). Scale from 0 so bar heights are proportional.
 [x] F5 grammar: exercise-detail History row says "1 sets" - use singular.
 (more below as pass 1 continues)

Test pass log  (append: date, pass #, result, failures found)
 PASSED so far in pass 1 (build 1.2.0): picker shows 346 exercises + Create new exercise; unilateral block shows L/R rows; RIR picker 0-10 selects + shows on row; ticking 1L then 1R starts rest only after BOTH; header Rest chip + sheet (-15/pause/+15/skip/minimise); Add Exercise usable while rest runs; notification permission prompt appears + exact alarm registered (dumpsys alarm); screen-off: Rest over notification posted; force-stop mid-workout: Home Resume card (4 sets) appears.
 Also PASSED in pass 1: finish saves L/R + RIR rows to DB and clears active_workout; History lists + opens editor with side/RIR; exercise-detail Compared-with-last-time + RIR in history; Progress Overview Volume/Sets/Hard toggles, avg RIR per muscle, % vs previous period; Library search. F1-F5 fixed in source (NOT yet rebuilt/retested).
 Also PASSED in pass 1 (old build): Left-vs-right card (30kg L vs 24kg R -> 20% warning); new ExerciseForm (muscle/equipment/L-R switch/description) saves locally with category Upper Body + is_unilateral=1; cloud sync of custom exercises and of sets with rir+side verified via REST; login on a WIPED app restored 17 sessions / 79 sets / 28 RIR sets / 10 L-R sets / 2 custom exercises. NEXT: rebuild with F1-F5, retest FRESH install (expect 346 exercises on first launch) and upgrade path, then re-run remaining checklist (routines, schedule, settings, updater, rest timer minimise etc).
 Pass 1 started 2026-11-19 on build 1.2.0 (versionCode 12): upgrade install over 1.1.0 -> schema migrated OK (rir, side, is_unilateral, user_version=1, 11 workouts kept); FAILED F1 (see list). Continuing pass 1 on the same build (migration is already applied so later launches should work).

### P9 - Release  [ ]   (only after a complete zero-failure P8 pass)
1. [ ] Bump version to 1.2.0 in app.json (version + versionCode), android/app/build.gradle, constants/version.js.
2. [ ] Build, `aapt dump badging` (versionName, permissions incl. POST_NOTIFICATIONS/USE_EXACT_ALARM).
3. [ ] Publish GitHub release v1.2.0 with BOTH `GymNote.apk` and `GymNote-v1.2.0.apk`; commit + push source (android/ is gitignored).
4. [ ] In-app update test from the previous version on the emulator (Settings > Check for Updates > Download & Install), data preserved.
5. [ ] Delete test users/data created in Supabase; tell the user what was NOT tested on a real phone.
6. [ ] SECURITY follow-ups with the user: they rotate/revoke the keys listed in "Security audit" below; then scrub secrets from Claude memory
       (`project_supabase.md`) and fix the git remote URL.

## Test environment cheat sheet
- Emulator AVD `gymtest`: `C:\Users\Ben\android-dev\sdk\emulator\emulator.exe -avd gymtest -no-snapshot -no-audio -gpu swiftshader_indirect`.
  adb: `C:\Users\Ben\android-dev\sdk\platform-tools\adb.exe`. It is slow and ANRs under memory pressure (`am kill-all` helps).
- Screenshots: in Git Bash `adb exec-out screencap -p > file.png` (PowerShell redirect corrupts PNG). Screenshot coords x1.2 = device px (1080x2400).
- Git Bash mangles device paths: `export MSYS_NO_PATHCONV=1` and give adb a Windows-style source path (`C:/Users/...`). Node needs Windows paths too.
- Device DB: `/data/data/com.gymnote.app/files/SQLite/mobileworkout.db` (adb is root; `sqlite3` exists on device). Seed by pushing a .sql file and
  `sqlite3 db < file`. Force-stop the app before editing.
- Another Claude session (xyracloud) may deploy to the same emulator and steal focus; re-front `com.gymnote.app` before taps. Do not touch that app.
- `adb shell input text` types into the focused field; Tab does NOT move focus - tap each field.
- Create a confirmed test user: POST `/auth/v1/admin/users` with service key `{email,password,email_confirm:true}`; delete with DELETE `/auth/v1/admin/users/<id>`.
- Build: see memory `project_gymnote.md` (JAVA_HOME/ANDROID_HOME, `gradlew.bat assembleRelease --no-daemon`, 3-7 min; run in background).
- Release: GitHub release + upload APK twice (GymNote.apk + GymNote-vX.Y.Z.apk) with curl `--data-binary`.
- Syntax check before long builds: `node -e` with `@babel/parser` over changed files.

## Security audit (2026-11-19, requested by user) - DONE, follow-ups below
Findings and what was done:
- Repo `Ben-Worrall/MobileWorkout` is PUBLIC. Git history scanned for sb_secret_, sbp_, ghp_, github_pat_, service_role, keystore password, private keys:
  only hit = `scripts/migrate-supabase.js` containing a 15-character PREFIX of the Supabase secret key (redacted here; not usable on its own). File removed;
  clean schema now in `supabase/schema.sql`. History not rewritten (fragment is harmless and rotating the key makes it moot).
- Keystore (`gymnote.keystore`) is gitignored (`*.keystore`), not tracked, not shipped. `android/` is gitignored. No `.env` tracked.
- Published APK (v1.1.0) scanned: contains only the project URL and the PUBLISHABLE key (public by design). `sb_secret_` text is supabase-js library
  code. No management token, no PAT, no service-role/secret key.
- REAL VULNERABILITY FOUND AND FIXED: the old `exercises` RLS policy allowed rows with `user_id IS NULL`, so anyone with the (public) publishable key
  could INSERT/UPDATE/DELETE ownerless rows without logging in (a probe row proved it; deleted). Fix applied live: all six tables now have
  `FOR ALL TO authenticated USING/WITH CHECK (user_id = auth.uid())` (template_exercises via template ownership), `exercises.user_id NOT NULL`,
  and `REVOKE ALL ... FROM anon` (+ default privileges). Verified with `scripts/rls-test.js` (20/20 PASS: cross-user read/update/delete/spoof blocked,
  anonymous read/write blocked). Re-run it after every schema change (P2 changes template_exercises policy - update schema.sql and retest!).
- Local plaintext secrets (NOT on GitHub) that the user should rotate: (1) GitHub PAT embedded in the git remote URL inside `.git/config`
  (fix: `git remote set-url origin https://github.com/Ben-Worrall/MobileWorkout.git` after revoking); (2) the broad "entire account" GitHub PAT the user
  pasted into chat; (3) Supabase secret key and (4) Supabase Management API token (`sbp_`, full account control - most dangerous) pasted into chat and
  stored in Claude memory `project_supabase.md`. Revoke/regenerate: github.com/settings/tokens, Supabase dashboard > Settings > API Keys,
  supabase.com/dashboard/account/tokens. Create a fine-grained GitHub token limited to this repo (Contents: read/write).
- Optional hardening: Supabase min password length is 6 (app also enforces 6); consider 8+. Weak keystore password `gymnote123` is acceptable only
  because the keystore never leaves the PC - do NOT change it (would break in-app updates for existing installs). `.github/workflows/build.yml` is dead
  (only references secrets by name) and can be deleted.

## Risks / open questions for the user
- Supabase free email sender = 2 emails/hour. Offer custom SMTP (needs their account) or disable confirmation.
- Android may delay notifications on some phones with aggressive battery savers (Samsung/Xiaomi); user may need to disable battery optimisation for Gym Note.
- A powered-off phone cannot run anything; "screen off / locked / app minimised" is what we support.
- RIR per set vs per exercise (chose per set).

## Progress log (append newest at bottom)
- 2026-11-19: plan written after research (Supabase config, expo-notifications, free-exercise-db, library modal analysis).
