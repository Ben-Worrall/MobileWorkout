# Gym Note - Game Plan (v1.2.0 work)

READ THIS FIRST when resuming. Update the checkboxes and "RESUME HERE" as you go. Never put secrets in this file
(tokens/keys are in the Claude memory file `project_supabase.md`; GitHub PAT: use `git credential fill` or ask the user).

## RESUME HERE
- Current phase: **P1 done, security audit done. Starting P2.**
- Last thing finished: security audit (RLS hole fixed + verified 20/20, repo/APK scanned). P1 verified (confirm link -> confirmed.html).
- Next action: P2 step 1 (Supabase SQL migration: rir, side, is_unilateral, template_exercises.user_id) - REMEMBER to update supabase/schema.sql
  and re-run `scripts/rls-test.js` afterwards. Then continue P3..P7, then the P8 FULL TEST LOOP (user requirement), then P9 release.
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
 (none yet)

Test pass log  (append: date, pass #, result, failures found)
 (none yet)

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
