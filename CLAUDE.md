# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

An English vocabulary/grammar quiz web app, built to run entirely as static files on GitHub Pages (no backend server). Source material is a set of Obsidian markdown notes (word lists + grammar notes per lesson unit). Those are converted at build time into a SQLite file, which the browser then queries directly using sql.js (SQLite compiled to WebAssembly) — this avoids needing a server-side database while still letting the user write and learn real SQL.

The intended user of this app (and the person driving development) is a JavaScript/DB beginner; code changes should stay simple and avoid introducing frameworks or build tooling (bundlers, React, TypeScript, etc.) unless explicitly requested.

## Commands

- `npm run build:db` — parses everything in `content/*.md` and regenerates `public/words.db`. Run this any time a markdown file under `content/` is added or edited; the script always rebuilds the whole DB from scratch (drops and recreates `public/words.db`).
- No test suite or linter is configured.
- To run the app locally: open `public/index.html` with the VSCode "Live Server" extension (installed). It must be served over `http://localhost`, not opened via `file://` — `app.js` uses `fetch()` to load `words.db`, which browsers block under the `file://` origin.

## Architecture

Data pipeline (one direction, build-time → static assets, no runtime backend):

```
content/*.md  →  scripts/build-db.js (Node)  →  public/words.db  →  public/app.js (sql.js/WASM, runs in-browser)
```

- `content/*.md` — one file per lesson unit (e.g. `Unit7.md`), copied in from the user's Obsidian vault. Each file is organized as `## LessonN` sections containing `### Words` and `### Grammar` subsections.
- `scripts/build-db.js` — reads every `.md` file in `content/`, parses it, and writes all of them into a single `public/words.db` (SQLite via `better-sqlite3`). It is NOT incremental — re-running it rebuilds the entire DB from every file currently in `content/`, so all units end up in one shared `.db` file rather than one file per unit.
- `public/words.db` — schema is `units → lessons → words` / `grammar_points` (lessons belong to a unit, words/grammar belong to a lesson). `grammar_points.note` stores the freeform explanation/translation text for a grammar item as one newline-joined blob (it isn't further structured).
- `public/app.js` — loads sql.js and `words.db` once at startup (`init()`), then runs plain SQL (`ORDER BY RANDOM() LIMIT n`) against the in-memory DB to pick quiz words and multiple-choice distractors. Two quiz modes toggle which panel is visible: `input-mode-ui` (show Japanese, type the English word) and `choice-mode-ui` (show English, pick from 4 Japanese options).

### Markdown parsing rules the build script relies on (`scripts/build-db.js`)

- A lesson starts at a line matching `## LessonN` or `# LessonN`.
- Under `### Words`, each vocabulary line is `- english<sep>japanese`. The separator can be either `：` (fullwidth colon) or `；` (fullwidth semicolon) — the source notes are inconsistent about this, so both must keep being accepted.
- Under `### Grammar`, a line starting with `- ` begins a new grammar point (its phrase/example sentence); subsequent indented lines are appended to that grammar point's `note` until the next `- ` line or heading.
- Lines before the first `## LessonN` heading are ignored.

### Known in-progress state

- Only `content/Unit7.md` has real data; `content/Unit1.md` is currently an empty placeholder. More units (through Unit8) will be added the same way — drop a new `UnitN.md` into `content/` and re-run `npm run build:db`.
- `isAnswerCorrect()` in `public/app.js` (the input-mode grading function — case/whitespace-insensitive comparison) is being left for the project owner to implement as a learning exercise; don't assume it's finished without checking.
- No GitHub Pages deploy workflow exists yet — deployment approach (committing `public/words.db` directly vs. building it in CI) hasn't been decided.
