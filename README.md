# Daily Journal | يومياتي

React + TypeScript + Vite. English/Arabic (RTL), one font (Cairo), installable PWA.

## Run
    npm install
    npm run dev          # http://localhost:5173
    npm run build        # type-check + production build into dist/

## Deploy (Vercel)
Push to GitHub, import the repo in Vercel, keep the defaults (Vite is auto-detected).

## Install as an app
- Windows: open the site in Edge/Chrome, click the install icon in the address bar.
- Android: Chrome menu, then "Install app" / "Add to Home screen".

## Where data lives
Journals are saved in IndexedDB on each device (private, works offline).
To move journals between devices use History, Export/Import backup.
For automatic sync, implement `JournalRepository` (src/storage.ts) against a cloud database
and swap it in for `journalRepo`. No screen needs to change.

## Structure
    src/types.ts        data model
    src/storage.ts      storage interface + IndexedDB implementation
    src/backup.ts       JSON export/import
    src/i18n.tsx        EN/AR text, language + direction
    src/screens/        Home, Write, History
    public/             manifest, service worker, icons

## Add a feature
New screen: add a file in src/screens/ and a route line in src/App.tsx.
New field: add it to JournalEntry, Write.tsx, History.tsx and both dictionaries.
New language: add a dictionary in i18n.tsx and extend the Lang type.

## v2: To-Do list + cloud sync
- `#/tasks` Kick Off Your Day: single tasks, project groups, time slots, long-term (daily) tasks, partial/complete status.
- `#/sync` account + sync. Needs a free Supabase project: run `supabase/schema.sql`, then set
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see `.env.example`, and in Vercel project settings).
- Sync is local-first: the app works offline and merges by "latest edit wins". Engine: `src/syncCore.ts` (tested with `npm test`).
- New feature that should sync? Create its local repository like `src/taskStorage.ts` and call `registerStore('<kind>', ...)`.
