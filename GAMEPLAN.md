# Gym Note - Game Plan (v1.2.0 work)

READ THIS FIRST when resuming. Update the checkboxes and "RESUME HERE" as you go. Never put secrets in this file
(tokens/keys are in the Claude memory file `project_supabase.md`; GitHub PAT: use `git credential fill` or ask the user).

## RESUME HERE
- Current phase: **P0 done, starting P1**
- Last thing finished: plan written
- Next action: P1 step 1 (Supabase site_url)
- Last updated: 2026-11-19

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

### P1 - Email confirmation fix  [ ]
1. [ ] Create `docs/confirmed.html` (dark theme like docs/index.html): "Email confirmed - open Gym Note and log in" + button `mobileworkout://` deep link
       + friendly message if the URL hash contains `error=` (expired link) + note about the hourly email limit not needed.
2. [ ] Commit+push so GitHub Pages serves it; `curl -I https://ben-worrall.github.io/MobileWorkout/confirmed.html` must be 200.
3. [ ] PATCH Supabase auth config: `site_url = https://ben-worrall.github.io/MobileWorkout/confirmed.html`,
       `uri_allow_list = https://ben-worrall.github.io/MobileWorkout/**,mobileworkout://**` (Management API PATCH /config/auth, JSON via file + --data-binary).
4. [ ] `context/AuthContext.jsx` signUp: pass `options: { emailRedirectTo: 'https://ben-worrall.github.io/MobileWorkout/confirmed.html' }`.
5. [ ] TEST without an inbox: Admin API `POST /auth/v1/admin/generate_link {type:'signup',email,password}` returns `action_link`;
       `curl -sIL` it and confirm the final redirect lands on confirmed.html (not localhost). Then delete the test user.
6. [ ] Tell user about the 2 emails/hour limit and offer custom SMTP (Resend free tier) or turning confirmation off.

### P2 - Data model + sync migrations  [ ]  (Supabase FIRST, additive, so old app versions keep working)
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

### P3 - Timer rework (non-blocking + background)  [ ]
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

### P4 - Workout UI: RIR + unilateral  [ ]
1. [ ] `RirPicker` (bottom sheet, buttons 0-10, "Clear"); each set row: kg x reps [RIR chip] tick. RIR defaults to previous set's value, nullable.
2. [ ] Unilateral exercise block: each set shows L and R sub-rows (own kg/reps/RIR/tick); set complete when both ticked; header menu toggle
       "Unilateral (left/right)" overrides the library default for this workout; rest starts after the second side.
3. [ ] Exercise-complete logic: all sets (both sides if unilateral) ticked -> crossed out (existing behaviour).
4. [ ] `edit-session.jsx` and History cards understand `rir` and `side` (show "L 20kg x 10 @RIR2").
5. [ ] TEST on emulator: normal exercise with RIR; unilateral exercise (DB Row) L/R; toggle unilateral on a bilateral exercise; save; edit; DB check
       with sqlite3 (`select exercise_name,set_number,side,weight,reps,rir from logged_sets`).

### P5 - Analytics using RIR and sides  [ ]
1. [ ] DB helpers: `getExerciseSessionStats(exerciseId)` -> per session: best e1RM, avg RIR, top weight, total reps, sets, L/R averages.
2. [ ] `exercise-detail.jsx`: chart mode Volume | Weight | Est. 1RM; "Compared with last time" card (weight, reps, avg RIR, e1RM deltas);
       RIR column in history rows; L vs R comparison with imbalance warning (>10% difference).
3. [ ] `progress.jsx`: avg RIR per muscle and period-over-period change in the "Your Progress" list; metric toggle gets "Hard sets" (RIR <= 3).
4. [ ] TEST with seeded data (sqlite3 seed script like before: sessions at different weeks with different RIR) and screenshot every screen.

### P6 - Library: add / edit / sync custom exercises  [ ]
1. [ ] Reproduce the bug on the emulator first (screenshot the add modal with keyboard open), then rebuild the modal: fixed-height sheet or
       KeyboardAvoidingView, Name, Muscle chips, Equipment chips, "Unilateral" switch, Description, derived category (not 'All'), validation, duplicate-name check.
2. [ ] Allow editing a custom exercise (name/muscle/equipment/notes/unilateral); delete already exists. All call `syncRecord`/`syncDelete`.
3. [ ] "Create exercise" shortcut inside the workout exercise picker.
4. [ ] Confirm local persistence (SQLite) and cloud sync (check Supabase `exercises` rows with user_id) and restore after wiping app data.
5. [ ] TEST: create exercise, use it in a workout, finish, wipe data, log in, exercise + workout history restored.

### P7 - Exercise library expansion (research done, build it)  [ ]
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
9. [ ] Mention source/licence (Unlicense) in Settings > About.

### P8 - Verify, release, update-test  [ ]
1. [ ] Bump version to 1.2.0 in app.json (version + versionCode), android/app/build.gradle, constants/version.js.
2. [ ] Build, `aapt dump badging` (versionName, permissions incl. POST_NOTIFICATIONS/USE_EXACT_ALARM).
3. [ ] Full regression on emulator (login gate, guest, history, overview chart, remove exercise, picker, library chips, updater).
4. [ ] Publish GitHub release v1.2.0 with BOTH `GymNote.apk` and `GymNote-v1.2.0.apk`; commit + push source (android/ is gitignored).
5. [ ] In-app update test from the previous version on the emulator (Settings > Check for Updates > Download & Install), data preserved.
6. [ ] Delete test users/data created in Supabase; update memory notes; tell the user what was NOT tested on a real phone.

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

## Risks / open questions for the user
- Supabase free email sender = 2 emails/hour. Offer custom SMTP (needs their account) or disable confirmation.
- Android may delay notifications on some phones with aggressive battery savers (Samsung/Xiaomi); user may need to disable battery optimisation for Gym Note.
- A powered-off phone cannot run anything; "screen off / locked / app minimised" is what we support.
- RIR per set vs per exercise (chose per set).

## Progress log (append newest at bottom)
- 2026-11-19: plan written after research (Supabase config, expo-notifications, free-exercise-db, library modal analysis).
