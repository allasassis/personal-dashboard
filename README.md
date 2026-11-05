# Personal dashboard

A static app with no backend. Your data lives in a private GitHub repo of your own, and
the browser talks to GitHub directly. Four modules so far: **Body** (workouts, diet, metrics),
**Studies** (a weekly study plan, and notebooks with notes and covers), **To-do** and **Habits**.

## Run it

```sh
npm install
npm run dev      # development
npm test         # sync engine tests
npm run build    # production build in dist/
```

To use it on your phone, host the build. Push this code to a GitHub repo, then set
Settings → Pages → Source to **GitHub Actions**. `.github/workflows/deploy.yml` does the
rest. Keep this code repo separate from the data repo.

## Connect your data repo

The first screen walks you through it, once per device:

1. Create an empty **private** repo. The app refuses a public one.
2. Create a **fine-grained token** limited to that repo, with Contents: Read and write.
3. Paste both into the box.

The token stays in that browser's localStorage and is sent only to `api.github.com`. The
production build's Content-Security-Policy blocks third-party scripts and any other
network destination. Fine-grained tokens expire, and when yours does the app says so and
asks for a new one. Settings → Erase from this device removes the token and local copy.

## Security

The app's address is public, and free GitHub Pages can't restrict who opens it. That is fine,
because the app and your data are separate:

| | Where it lives | Who can get it |
|---|---|---|
| App code | Public site and code repo | Anyone. It contains nothing personal |
| Your data | Your private data repo | Only your GitHub account and your token |
| Your token | Your browser's storage | Only that browser profile |

Someone who opens your address sees an empty app. It only reaches your data with your token.

What to watch for:

- **Give your Pages site its own address.** Everything on `username.github.io` shares browser
  storage, including the token. Don't host other projects you don't fully trust on that same
  address, or use a custom subdomain just for this app.
- **Scope the token** to the data repo only, with Contents access and an expiry date. If it
  leaks, delete it on GitHub and paste a new one.
- **On a shared computer**, use Settings → Erase from this device when you finish.
- **Anyone using your unlocked device** can open the app. It has no lock screen of its own.
- **Linked images** (a GIF or cover from another site) tell that site your IP address when they
  load. Uploaded covers and the gallery don't. The built-in exercise photos load from GitHub.

To put the app itself behind a login, host it on a service that offers one, such as Cloudflare
Pages with Cloudflare Access.

## How data is saved

Every module saves through the same pattern, a **collection**:

```ts
const notes = defineCollection<Note>('studies/notes'); // data/studies/notes.json
notes.put({ id: newId(), text: 'hello' });
notes.remove(id);
const list = useRecords(notes);                        // React hook, live
```

```
data/
  manifest.json
  gym/routines.json   gym/sessions.json   gym/exercises.json
  diet/foods.json     diet/plans.json     diet/log.json       diet/settings.json
  metrics/definitions.json                metrics/entries.json
  studies/plan.json   studies/notebooks.json  studies/notes.json  studies/covers.json
  todo/tasks.json
  habits/habits.json  habits/checks.json
```

Each file holds one record per line, sorted by id, so git history reads as a clean log:

```json
{
  "schema": 1,
  "records": [
    {"id":"weight:2026-11-05","metricId":"weight","date":"2026-11-05","value":75.5,"updatedAt":1793879698816}
  ]
}
```

- **Local first.** Edits save to IndexedDB immediately, then go to GitHub after 2.5 seconds
  of quiet, or sooner if you leave the page. Without signal they wait and send later.
- **Conflicts merge per record.** GitHub rejects a write based on an outdated file. The app
  then fetches the file, merges by `updatedAt` (newest wins for each record) and retries.
  Two devices only clash if they edit the *same* record while out of sync.
- **Deletes are tombstones** (`"deleted": true`), so an old copy can't bring a record back.
- **Editing the repo by hand works.** Keep `updatedAt` as it is or raise it. A file that
  can't be parsed is reported and never overwritten. To remove a record, set `deleted`
  rather than deleting the line, or a device that still has it will restore it.
- A workout in progress stays on the device until you finish it, so logging sets doesn't
  create a commit per set. Notes wait for 20 seconds of quiet, so a pause while typing
  doesn't create one either.

## Add a module

Create `src/modules/<name>/index.tsx` exporting a `Module` (nav entries and routes), declare
its collections with `defineCollection`, and list it in `src/modules/index.ts`. Navigation
and sync pick it up from there.

## Exercise library

873 exercises from [free-exercise-db](https://github.com/yuhonas/free-exercise-db), which is
public domain. Each has two photos (start and end of the movement), shown in alternation.
These are not true GIFs. On any exercise, **GIF & notes** lets you link your own GIF, and
it syncs with your data. `npm run exercises` regenerates `public/exercises.json`.

## Use it with an AI agent

Copy [`docs/AGENTS.md`](docs/AGENTS.md) to the root of your **data repo** and open your agent there. It explains the file formats and rules, and how to analyze your data and create workouts, diet plans, study plans, to-dos and habits. For Claude Code, also add a `CLAUDE.md` containing the line `@AGENTS.md`.

## License

[MIT](LICENSE). The exercise library is public domain, and the Archivo font is under the SIL Open Font License.

Anyone can run their own copy: fork this repo, enable Pages, and connect a private data repo of your own. Your data never goes in the code repo.
