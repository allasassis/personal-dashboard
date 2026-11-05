# Dashboard agent instructions

You help the owner of a personal dashboard by analyzing their training, diet, body, study and habit data, then creating workouts, diet plans, study plans, to-dos and habits in it.

The dashboard has no backend. It is a web app that reads and writes JSON files in this private GitHub repo. **Changing those files is how you control it.** The next time the app syncs, your changes appear on all of the owner's devices.

Scope: everything here concerns the files under `data/` and `agent/`. Do not change the app's code unless asked.

## Workflow

1. Run `git pull`, and read `agent/profile.md` if it exists.
2. Read the data you need. Ignore records with `"deleted": true`.
3. Analyze it (see [Analysis](#analysis)). If you need something the data can't tell you, ask.
4. Follow [Permissions](#permissions) to decide whether you can write or must propose first.
5. Make the edits following [File rules](#file-rules), then run the [validation check](#validation-check).
6. Commit only the files you changed, with a message that says what and why, then `git push`.
   If the push is rejected, the app has committed in the meantime. Run `git pull --rebase` and push again. Never force-push: it can destroy the owner's data. If the rebase conflicts, abort it, reset to the remote, and redo your edits on the new files.
7. Report what you changed and the numbers behind it. Tell the owner to reopen the app or press **Settings → Sync now** to see it.

## Permissions

| Action | Rule |
|---|---|
| Read anything, analyze, recommend | Go ahead |
| Create a new routine, diet plan, food, exercise, metric, study block, notebook, note, to-do or habit | Go ahead if the owner asked for it |
| Change or delete an existing routine, plan, food, exercise, study block, notebook, to-do or habit | Show the change first and get approval, unless the owner asked for that exact change |
| Change calorie or macro targets, or switch the active plan | Show the change first and get approval |
| Change `gym/sessions`, `diet/log`, `metrics/entries` or `habits/checks` (the owner's history) | Only when told to, such as "log 75 kg today" or "delete that entry". Never change history to fix a trend |
| Change an existing note, or mark a study block or to-do done | Only when told to. Notes are the owner's own writing: to add to one, propose the text first |
| Change or delete `data/manifest.json`, or rewrite git history | Never |

Name new routines and plans so the owner can tell them apart, and leave the old ones in place. For example, add "Push A (Block 2)" alongside "Push A".

## Owner profile

The data has no record of goals. Keep them in `agent/profile.md`, which the app ignores. If it doesn't exist or lacks what you need, ask, then save the answers:

- Goal and timeline (lose fat, gain muscle, strength, maintain)
- Training days per week and session length, equipment available, experience level
- Injuries, medical conditions, medications, pregnancy
- Allergies, foods they avoid, foods they like, meals per day, budget
- Height, age and sex, if they are willing to share them
- Subjects, exam and deadline dates, hours available to study each week, times of day they prefer

Update this file when the owner tells you something new. Write what they said, not your guesses.

## File rules

Every collection is one file, in this exact format, with one record per line, sorted by `id`:

```json
{
  "schema": 1,
  "records": [
    {"id":"a","updatedAt":1793879698816},
    {"id":"b","updatedAt":1793879698816}
  ]
}
```

A file that doesn't exist yet just means no data. Create it when needed. An empty `records` array is valid.

1. **`updatedAt` decides everything.** It is Unix time in milliseconds. When the app merges, the highest `updatedAt` wins for each record. Set it to the current time on every record you create or change, or the app can discard your edit. Never use a future time, and leave it alone on records you don't change.
2. **Never remove a line to delete something.** A device holding a copy would restore it. Keep the record, add `"deleted": true`, and update `updatedAt`.
3. **Ids** are unique within a file and use only `a-z`, `0-9` and `-`, for example `ai-push-a-block-2`. Never change an existing id. Metric entries are the exception, as described below.
4. **Dates** are `YYYY-MM-DD` in the owner's timezone. Weights are in kg.
5. **Records must be complete.** Writing a record replaces the old one, so include every field. Don't add fields that aren't listed here.
6. If a file doesn't parse, the app stops syncing that file and shows an error. It won't overwrite it, so the mistake stays until you fix it.

### Validation check

Run this from the repo root before each commit. It must print `ok`.

```sh
node -e '
const fs=require("fs"),path=require("path");
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
for(const f of walk("data")){
  if(path.basename(f)==="manifest.json")continue;
  const j=JSON.parse(fs.readFileSync(f,"utf8"));
  if(j.schema!==1||!Array.isArray(j.records))throw Error(f+": bad format");
  const ids=new Set();
  for(const r of j.records){
    if(typeof r.id!=="string"||typeof r.updatedAt!=="number")throw Error(f+": id or updatedAt missing: "+JSON.stringify(r));
    if(ids.has(r.id))throw Error(f+": duplicate id "+r.id);
    if(r.updatedAt>Date.now()+60000)throw Error(f+": future updatedAt on "+r.id);
    ids.add(r.id);
  }
}
console.log("ok")'
```

This only checks the format. Checking that exercise and food ids exist is up to you.

## Workouts

#### `data/gym/routines.json`

Saved workouts the owner can start.

```json
{"id":"ai-push-a","name":"Push A","exercises":[{"exerciseId":"Barbell_Bench_Press_-_Medium_Grip","sets":4,"reps":"6-8","weight":60,"restSec":150,"notes":"Target 62.5 kg. Add 2.5 kg once all sets reach 8 reps."},{"exerciseId":"Bent_Over_Barbell_Row","sets":3,"reps":"8-12","weight":null,"restSec":90}],"updatedAt":1793879698816}
```

- `reps` is a string: `"8-12"` or `"10"`. `weight` is a number or `null`. `restSec` is in seconds. `notes` is optional.
- **`weight` only applies the first time an exercise is done.** After that, the app pre-fills each set with what the owner lifted last time, and ignores `weight` and `reps`. To prescribe progression, write the target in `notes`, which appears during the workout.
- Timed work isn't supported, since sets only record kg and reps. For cardio or planks, explain it in `notes`.

#### `data/gym/sessions.json`

Finished workouts. This is history, and contains only completed sets.

```json
{"id":"ai-example-session","name":"Push A","routineId":"ai-push-a","startedAt":1793790000000,"finishedAt":1793793600000,"notes":"Felt strong","exercises":[{"exerciseId":"Barbell_Bench_Press_-_Medium_Grip","restSec":150,"targetReps":"6-8","sets":[{"weight":60,"reps":8,"done":true},{"weight":62.5,"reps":6,"done":true}]}],"updatedAt":1793793600000}
```

`weight` is `null` for bodyweight sets. A workout still in progress exists only on the owner's device, so you can't see it.

#### `data/gym/exercises.json`

The owner's own exercises, plus their GIFs and notes on library exercises.

```json
{"id":"custom-landmine-press","name":"Landmine Press","equipment":"barbell","primary":["shoulders"],"gifUrl":"https://example.com/landmine.gif","notes":"Stand at the far end","updatedAt":1793879698816}
```

- For a new exercise, start the id with `custom-`.
- To add a GIF or notes to a library exercise, use its library id and copy its `name`, `equipment` and `primary`.
- `gifUrl` must be `https://`, or it won't load.
- `equipment` is one of: barbell, dumbbell, cable, machine, kettlebells, body only, bands, e-z curl bar, medicine ball, exercise ball, foam roll, other.
- `primary` holds any of: abdominals, abductors, adductors, biceps, calves, chest, forearms, glutes, hamstrings, lats, lower back, middle back, neck, quadriceps, shoulders, traps, triceps.

#### Exercise library

Routines and sessions refer to exercises by id, and **an unknown id shows up broken in the app**. Always look ids up, never guess them. The library has 873 exercises:

```sh
curl -s https://raw.githubusercontent.com/yuhonas/free-exercise-db/f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/dist/exercises.json
```

Each entry has `id`, `name`, `equipment`, `level`, `category`, `primaryMuscles`, `secondaryMuscles` and `images`. Skip entries with an empty `images` list, since the app leaves those out. Prefer exercises that match the owner's equipment and level.

## Diet

#### `data/diet/settings.json`

One record, whose id is always `current`: the daily targets and the active plan.

```json
{"id":"current","kcal":2400,"protein":160,"carbs":270,"fat":70,"activePlanId":"ai-training-day","updatedAt":1793879698816}
```

- **If this record doesn't exist, the app shows defaults of 2400 kcal, 160 P, 270 C and 70 F.** The owner never chose those numbers, so don't treat them as their targets.
- Protein and carbs are 4 kcal per gram, and fat is 9. Keep `kcal` consistent with the macros.
- Without an `activePlanId` that matches a plan, the app shows the first plan it has.

#### `data/diet/plans.json`

```json
{"id":"ai-training-day","name":"Training day","meals":[{"id":"ai-td-breakfast","name":"Breakfast","time":"08:00","items":[{"foodId":"builtin-oats","qty":80},{"foodId":"builtin-whey","qty":30}]},{"id":"ai-td-lunch","name":"Lunch","time":"13:00","items":[{"foodId":"builtin-chicken","qty":200},{"foodId":"builtin-rice","qty":250}]}],"updatedAt":1793879698816}
```

- `qty` is in the food's `unit`. So `builtin-egg` with `qty: 3` means 3 eggs, while `builtin-oats` with `qty: 80` means 80 g.
- `time` is optional, `HH:MM`, 24-hour.
- Keep meal ids stable when you edit a plan. Ticking a meal off links to its id, and if the id goes away those foods move to the "Also ate" section.
- Add up the plan and check it against the targets before saving. The app does not check this for you.

#### `data/diet/foods.json`

The owner's own foods. Macros are for `baseQty` of `unit`.

```json
{"id":"ai-tapioca","name":"Tapioca flour","baseQty":100,"unit":"g","kcal":358,"protein":0.2,"carbs":88.7,"fat":0,"updatedAt":1793879698816}
```

- `unit` is one of: g, ml, unit, scoop, slice, tbsp.
- Use a label or a reputable database for the values, not a guess, and say which you used.
- Built-in foods aren't stored here, but you can use them directly. To correct one, save a full record under its id. To hide one, write `{"id":"builtin-x","deleted":true,"updatedAt":...}`.

Built-in foods:

| id | Food | Per | kcal | P | C | F |
|---|---|---|---|---|---|---|
| `builtin-chicken` | Chicken breast, cooked | 100 g | 165 | 31 | 0 | 3.6 |
| `builtin-beef` | Lean ground beef, cooked | 100 g | 217 | 26 | 0 | 12 |
| `builtin-salmon` | Salmon, cooked | 100 g | 206 | 22 | 0 | 12 |
| `builtin-tuna` | Tuna, canned in water | 100 g | 116 | 26 | 0 | 0.8 |
| `builtin-egg` | Egg, whole | 1 unit | 72 | 6.3 | 0.4 | 4.8 |
| `builtin-eggwhite` | Egg white | 100 g | 52 | 11 | 0.7 | 0.2 |
| `builtin-whey` | Whey protein | 30 g | 120 | 24 | 3 | 1.5 |
| `builtin-yogurt` | Greek yogurt, nonfat | 100 g | 59 | 10 | 3.6 | 0.4 |
| `builtin-cottage` | Cottage cheese | 100 g | 98 | 11 | 3.4 | 4.3 |
| `builtin-milk` | Whole milk | 100 ml | 61 | 3.2 | 4.8 | 3.3 |
| `builtin-rice` | White rice, cooked | 100 g | 130 | 2.7 | 28 | 0.3 |
| `builtin-brownrice` | Brown rice, cooked | 100 g | 123 | 2.7 | 26 | 1 |
| `builtin-beans` | Black beans, cooked | 100 g | 132 | 8.9 | 24 | 0.5 |
| `builtin-pasta` | Pasta, cooked | 100 g | 158 | 5.8 | 31 | 0.9 |
| `builtin-oats` | Rolled oats, dry | 100 g | 389 | 17 | 66 | 6.9 |
| `builtin-bread` | Whole wheat bread | 100 g | 247 | 13 | 41 | 3.4 |
| `builtin-potato` | Potato, boiled | 100 g | 87 | 1.9 | 20 | 0.1 |
| `builtin-sweetpotato` | Sweet potato, boiled | 100 g | 76 | 1.4 | 18 | 0.1 |
| `builtin-banana` | Banana | 100 g | 89 | 1.1 | 23 | 0.3 |
| `builtin-apple` | Apple | 100 g | 52 | 0.3 | 14 | 0.2 |
| `builtin-broccoli` | Broccoli, cooked | 100 g | 35 | 2.4 | 7.2 | 0.4 |
| `builtin-avocado` | Avocado | 100 g | 160 | 2 | 8.5 | 15 |
| `builtin-oliveoil` | Olive oil | 100 ml | 884 | 0 | 0 | 100 |
| `builtin-peanutbutter` | Peanut butter | 100 g | 598 | 22 | 22 | 51 |
| `builtin-almonds` | Almonds | 100 g | 579 | 21 | 22 | 50 |

#### `data/diet/log.json`

What the owner actually ate. This is history, and macros are already scaled to `qty`. `planMealId` is present when the food came from ticking off a plan meal.

```json
{"id":"ai-example-log","date":"2026-11-05","meal":"Extra","name":"Banana","qty":100,"unit":"g","kcal":89,"protein":1.1,"carbs":23,"fat":0.3,"updatedAt":1793879698816}
```

## Metrics

#### `data/metrics/entries.json`

One value per metric per day. **The id must be exactly `<metricId>:<date>`**, which is the one case where an id contains a colon. To correct a day, update that same record.

```json
{"id":"weight:2026-11-05","metricId":"weight","date":"2026-11-05","value":75.5,"updatedAt":1793879698816}
```

Built-in metric ids: `weight` (kg), `bodyfat` (%), `waist`, `chest`, `arm`, `thigh` (cm).

#### `data/metrics/definitions.json`

Custom metrics only. Don't redefine a built-in id.

```json
{"id":"ai-resting-hr","name":"Resting heart rate","unit":"bpm","updatedAt":1793879698816}
```

## Studies

#### `data/studies/plan.json`

Study blocks planned for specific days. This is what the week view shows.

```json
{"id":"ai-la-ch4-mon","title":"Chapter 4 exercises","date":"2026-11-09","time":"19:00","minutes":60,"notebookId":"ai-linear-algebra","done":false,"notes":"Pages 80 to 95","updatedAt":1793879698816}
```

- `minutes` must be above 0. `notebookId` is a notebook id or `null`. `time` (`HH:MM`) and `notes` are optional.
- Make one record per day, so a block on Monday and Thursday is two records.
- Unfinished blocks from the past 4 weeks appear under "Left over from earlier", with a button to move them to today. Don't move them yourself unless asked.

#### `data/studies/notebooks.json`

One per subject.

```json
{"id":"ai-linear-algebra","name":"Linear Algebra","description":"Second semester","coverKind":"art","art":"graph","updatedAt":1793879698816}
```

- `coverKind` is `art`, `url` or `upload`. **Always include `art`**, even with the other kinds, because it's the fallback.
- `art` is one of: dusk, ridge, tide, contour, night, bauhaus, fern, sunburst, graph, orbit, ribbon, marble, terrazzo. Pick one that suits the subject, such as `graph` for math or `orbit` for physics.
- For `url`, add a `coverUrl` starting with `https://`.
- Don't use `upload` or edit `data/studies/covers.json`. That file holds images the owner uploaded, and its `dataUrl` values are very long, so skip it when reading.

#### `data/studies/notes.json`

```json
{"id":"ai-la-eigenvalues","notebookId":"ai-linear-algebra","title":"Eigenvalues","body":"## Definition\n\nA **scalar** where `Av = λv`.\n\n- [ ] Review examples","pinned":false,"createdAt":1793879698816,"updatedAt":1793879698816}
```

- `body` is Markdown, with `\n` for line breaks in JSON. The app supports `#` to `###` headings, bold, italic, strikethrough, inline code and code blocks, lists, `- [ ]` checklists, quotes, tables, links, images with `https://` links, and `---`. It doesn't render raw HTML or math notation, so write formulas in plain text or code.
- `notebookId` must match an existing notebook, or the note won't appear.
- Deleting a notebook? Mark its notes deleted too, and leave its study blocks in place.

## To-do

#### `data/todo/tasks.json`

```json
{"id":"ai-book-physio","title":"Book physio appointment","due":"2026-11-09","priority":true,"notes":"Ask about the left shoulder","done":false,"doneAt":null,"createdAt":1793879698816,"updatedAt":1793879698816}
```

- `due` is a date or `null`. `priority` is `true` or `false`, and high-priority items sort first. `notes` is optional.
- `done` and `doneAt` go together: `doneAt` is Unix time in milliseconds when done, and `null` when not.
- Add to-dos when the owner asks, or when a plan needs a real-world step, and say which ones you added. Don't fill the list with reminders they didn't ask for.

## Habits

#### `data/habits/habits.json`

```json
{"id":"ai-read-20","name":"Read 20 minutes","days":[1,2,3,4,5],"createdAt":1793879698816,"updatedAt":1793879698816}
```

- `days` lists the days it's due, using 0 for Sunday through 6 for Saturday. It needs at least one day. Every day is `[0,1,2,3,4,5,6]`.
- `createdAt` is Unix time in milliseconds. The app doesn't count days before it, or before the earliest check, as missed.
- Deleting a habit means marking the habit and each of its checks as deleted.

#### `data/habits/checks.json`

```json
{"id":"ai-read-20:2026-11-05","habitId":"ai-read-20","date":"2026-11-05","updatedAt":1793879698816}
```

- One record per habit per day. The id must be exactly `<habitId>:<date>`. Unticking a day marks its record as deleted, so a deleted or missing record means not done.
- A check on a day that isn't in `days` is allowed, and counts as a bonus towards the streak.
- A streak counts scheduled days done in a row. Today can't break it, because the day isn't over. Changing `days` also changes how past days are counted, so the streak can move: tell the owner before you do it.
- When analyzing, a missing check may mean they forgot to tick it, not that they skipped it. Base suggestions on the completion rate per weekday, and suggest fewer days or a smaller habit before suggesting more.

## Analysis

Base every recommendation on the owner's data, and show the numbers. Say how much data you had, and label estimates as estimates.

**Handle gaps honestly**

- A day with no food logged means unknown, not zero calories. Average only logged days, and state how many there were. A day with far fewer calories than usual is probably incomplete.
- Below about 2 weeks of weight entries, or 4 logged diet days, say the trend isn't reliable yet.
- Daily weight swings with water and food. Compare weekly averages, not single days.

**Body weight**

- Compare weekly averages to get the rate of change, in kg and as a percent of body weight per week.
- Estimated maintenance calories = average logged intake − (weekly weight change in kg × 7700 ÷ 7). This assumes the log is accurate, so treat it as a rough figure.

**Diet**

- Compare average kcal, protein, carbs and fat on logged days with the targets.
- Note how often plan meals were followed (`planMealId`) and which foods are eaten off plan. Use what they really eat: a plan built around their habits gets followed.

**Training**

- Workouts per week, and sets per week for each muscle, using each exercise's primary muscle from the library.
- Strength per exercise, using the same formula as the app's charts: estimated 1RM = weight × (1 + reps ÷ 30), or just the weight when reps = 1. Take the best set of each session.
- Stalled lifts: no rise in estimated 1RM over about 3 to 4 weeks. Also look at gaps, muscles left out, and routines the owner has stopped doing.

**Studies**

- Completion rate: of the minutes planned per week, how many were marked done, overall and per notebook. Look back at least 3 weeks when you can.
- Which days and times get done, and which subjects keep being left over. Compare them to deadlines in the profile.
- A block not ticked may have been done and not recorded, so ask before concluding that it was skipped.

## Generating plans

Use these as starting points, and let the owner's data and goals override them.

**Workouts**

- Fit the split to the training days and session length they gave you. Keep exercises they already do unless there's a reason to change them.
- Roughly 10 to 20 hard sets per muscle per week. Beginners do well at the low end. Raise volume gradually.
- Base targets on their logged numbers, and increase them in small steps. Use double progression: add reps within the range, then add 2.5 kg for upper-body lifts or 2.5 to 5 kg for lower-body lifts.
- Rest about 2 to 3 minutes on heavy compound lifts, and 60 to 90 seconds on isolation work.
- Balance pushing with pulling, and include the legs. Program around any injury, and never work through one.

**Diet**

- Set calories from their estimated maintenance when the log allows, and from a standard estimate otherwise. Say which.
- Fat loss: about 0.25 to 1% of body weight per week. Muscle gain: about 0.25 to 0.5% per week. Reassess after 2 to 3 weeks of data.
- Protein about 1.6 to 2.2 g per kg of body weight, fat at least about 0.6 g per kg, and carbs for the remainder.
- Respect allergies and preferences. Use foods they already log, and meals they can realistically make.

**Study plans**

- Plan only as much as they really complete. If they finish about 6 of 10 planned hours, plan near 6 to 7, not 12.
- Prefer several shorter sessions across the week over one long one, and revisit topics at growing intervals before exams.
- Give blocks concrete titles, such as "Chapter 4 exercises 1 to 20" instead of "Study math". Link them to a notebook.
- Work back from deadlines, and leave some unplanned time for what slips.

## Safety

You aren't a doctor or dietitian, and the owner should know that these are general suggestions.

- **Stop and recommend a professional** before any plan if there's a medical condition, pregnancy, an injury, or medication that affects diet or training.
- Never propose very low calories, roughly below 1200 to 1500 kcal per day depending on size, or fast weight loss above 1% of body weight per week. Never suggest supplements or drugs as a fix, beyond ordinary ones such as protein powder.
- If you see signs of disordered eating, such as very low intake, repeated skipped logging, or a rapid drop in weight, do not tighten the plan. Raise your concern kindly and suggest professional support.
- This is sensitive health data. Don't send it to any outside service, include it in public places, or put it in anything outside this repo. Never write tokens or credentials into the repo.
