# Architecture

Hedgehog's full-stack-app core: a pre-built, pre-verified Nx/pnpm
workspace (NestJS + Drizzle + PostgreSQL on the backend, Next.js +
ShadCN + Tailwind on the frontend, ts-rest contracts, TanStack Query
hooks) plus the agents, skills, and manifest that drive a Hedgehog
project built on it.

## Contents

- `workspace/` — the workspace a Hedgehog install copies to a
  project's repo root: Nx configuration, `packages/config`,
  `packages/db`, `apps/api`, `apps/web`, and every enforcement file
  (lefthook, commitlint, the CI phase gate).
- `agents/` — `backend-eng`, `ux-planner`, `front-end-eng`.
- `skills/` — `hedgehog-loop`, `hedgehog-bootstrap`,
  `hedgehog-bootstrap-full-stack-app-core`, and the Nx tooling skills
  (`nx-generate`, `nx-run-tasks`, `nx-workspace`,
  `link-workspace-packages`).
- `vendor-skills/GSAP` — the vendored GSAP skill set `front-end-eng`
  reads for motion work.
- `CLAUDE.core.md` — fills a Hedgehog project's root `CLAUDE.md`
  `{{CORE_SECTION}}` placeholder for this core.
- `hedgehog-core.yaml` — this package's manifest: which agents, skills,
  and vendor skills it carries, and its workspace and CLAUDE.md section.
  The prose `planner` matches a project description against lives in the
  engine's `cores.json`, not here.
- `scripts/regenerate-full-stack-app-core.sh` — the deterministic
  generator that regenerates `workspace/` from scratch. Run by hand
  when a workspace dependency needs bumping; not part of any install
  path.
- `repro/` — reproductions that drive `workspace/`'s real lefthook
  configuration and pinned lefthook binary against a real `git commit`,
  proving the commit gate runs on a fresh install and fails closed when
  its tooling is missing.

## Using this package

A Hedgehog installation depends on this package for the `full-stack-app`
core rather than carrying its content directly. See the Hedgehog engine
(`@skyf0xx/hedgehog`) for the installer and build-graph tooling that
consumes it.

## Working on this core

This is a versioned npm package that the Hedgehog engine's `init` fetches
by name, carrying `full-stack-app`'s own agents, skills, a pre-built
workspace, and the `hedgehog-core.yaml` manifest that names all three to
the engine. See the engine repo
([`skyf0xx/hedgehog`](https://github.com/skyf0xx/hedgehog)) and its
[`ARCHITECTURE.md`](https://github.com/skyf0xx/hedgehog/blob/master/ARCHITECTURE.md)
for how `init` resolves and fetches a core package — that mechanism lives
there, not here.

No root `CLAUDE.md` lives in this repo. `CLAUDE.core.md` is a payload
file: its content is installed into a *consuming project's* generated
`CLAUDE.md`, filling that project's `{{CORE_SECTION}}` placeholder. A
plain root `CLAUDE.md` here would auto-load into any coding agent working
on this package itself, bleeding project-build context into a repo where
no Hedgehog build ever runs — build guidance for a project using this
core lives in that project's own generated `CLAUDE.md`, never here.

Changing this core means editing one of: the `workspace/` template (the
scaffold a Hedgehog install copies into a project's repo root), an agent
under `agents/`, a skill under `skills/`, or the vendored asset set under
`vendor-skills/GSAP`. `scripts/regenerate-full-stack-app-core.sh` is the
deterministic generator that rebuilds `workspace/` from scratch — run it
by hand after bumping a workspace dependency, then diff the result before
committing. A change here is a release of this package, not of the
engine: bump `package.json`'s version, commit, and merge to `main` — this
repo's own `publish.yml` tags and publishes from there.

When `workspace/`'s template needs a new piece of repeatable boilerplate
— a new module shape, a new generated file type — prefer building or
extending a generator over hand-authoring the output once. This core
already models the pattern: `workspace/tools/generators/` carries Nx
generators for every domain-module layer (`schema`, `contract`,
`repository`, `service`, `controller`, `hook`, `screen`) that
`nx-generate` drives instead of an agent writing that boilerplate
freehand. Other cores and future add-ons should model new scaffolding
against this one.

## Workspace invariants

`workspace/` is committed as a verified tree, and each of these is
load-bearing. Check each before "cleaning up" what looks like an
unnecessary pin or directive, and keep it when regenerating with
`scripts/regenerate-full-stack-app-core.sh`.

- **`tsconfig.base.json` uses `esnext`/`bundler` module resolution, not
  `nodenext`.** Turbopack (Next 16's dev bundler) can't resolve a
  `nodenext`-style `.js`-extension relative import specifier (`export *
  from './tasks/index.js'` where only `index.ts` exists) across a pnpm
  workspace-package boundary — `apps/web` importing a runtime value
  (not just a type) from `packages/hooks`, `packages/contracts`, or
  `packages/db` 500s with `Module not found`. `bundler` is TypeScript's
  mode for exactly this case and is Next's own tsconfig default; nothing
  in this stack runs raw `tsc` output directly with Node (`apps/api`
  builds via `webpack-cli`, `apps/web` via Next/Turbopack, tests via
  Vitest), so `nodenext`'s stricter runtime-accurate extension
  enforcement isn't load-bearing anywhere here. Every relative import
  specifier across the template is extensionless accordingly — a
  `schema`/`contract`/`hook` layer adding a new barrel re-export must
  match (`export * from './tasks/index'`, not `'./tasks/index.js'`).
- **`packages/db/src/schema/index.ts` needs `export {};`.** It's an
  empty barrel-of-barrels (see the schema layer's scope in `core.yaml`)
  until the first module's schema layer adds a line to it, but a
  comment-only file with zero import/export statements compiles as an
  ambient script, not a module, under `isolatedModules` +
  `declaration`/`composite`. `packages/db/src/index.ts`'s `export *
  from './schema/index'` fails `db:typecheck` (`TS2306: File ... is not
  a module`) without it.
- **`apps/web/package.json` needs `"nx": { "tags": ["scope:web"] }`.**
  `packages/config/eslint-base.js`'s `depConstraints` already defines a
  `sourceTag: 'scope:web'` rule, but `@nx/next:app` doesn't tag the
  project it generates — an untagged project is barred from depending on
  any tagged library at all under `@nx/enforce-module-boundaries`, so
  `apps/web` fails lint on its first import from any workspace package
  without this.
- **`apps/web-e2e/tsconfig.json` needs an explicit `"types": ["node"]`.**
  `@nx/next:app`'s generated Playwright config (`playwright.config.mts`)
  uses `process.env` and `import.meta.dirname`, but the generator's
  `tsconfig.json` for `apps/web-e2e` has no `types` array — unlike
  `apps/api-e2e`'s Vitest config, which explicitly lists `node` among
  its types. Without it, `nx run web-e2e:typecheck` fails with
  `TS2591`/`TS2339` on both. Add `"types": ["node"]` to
  `compilerOptions` there.
- **`prettier-plugin-tailwindcss` must stay pinned to `^0.7.4`, not
  `^0.8.x`.** `0.8.0+` made `parser.preprocess` async, but Prettier core
  calls it synchronously — crashes with `TypeError: e.charAt is not a
  function` on every `.ts`/`.tsx` file, independent of Tailwind config,
  module format, or Nx/pnpm. `0.7.4` fully supports Tailwind v4's
  `tailwindStylesheet` option, so nothing is lost by staying on it.
  Re-check this pin when bumping the plugin.
- **Tailwind v4 needs `tailwindStylesheet` set explicitly in
  `apps/web/.prettierrc.js`.** There's no `tailwind.config.js` for the
  plugin to autodetect under v4 — point it at
  `./src/app/global.css` (the file with `@import 'tailwindcss'`),
  resolved relative to the `.prettierrc.js` file itself.
- **Any component that imports Radix's `Slot` (the `asChild` pattern —
  e.g. `components/ui/button.tsx`) needs `'use client'` as its first
  line, even if a given render path never actually sets `asChild`.**
  `Slot` calls `React.createContext` at module scope, which crashes
  Server Component builds (`TypeError: e.createContext is not a
  function`) purely on import. Verify with a clean `.next`/Nx cache
  (`rm -rf apps/web/.next .nx/cache`) — a warm cache can mask this.
- **`apps/web/package.json` needs `"type": "module"`, same reasoning as
  the root `package.json`** — `apps/web/.prettierrc.js`
  is ESM (`export default`), and without a matching `"type": "module"`
  Node emits a `MODULE_TYPELESS_PACKAGE_JSON` warning on every prettier
  invocation touching that directory.
- **`apps/api`'s dev port defaults to 3333, not 3000.** `apps/web`'s
  `next dev` also defaults to port 3000, and the root `dev` script runs
  both side by side (`nx run-many --target=serve,dev
  --projects=api,web`). If `apps/api/src/main.ts` ever falls back to
  `process.env.PORT || 3000`, whichever process binds the port second
  either crashes or is silently unreachable, and every API call from the
  web client 404s against Next's own dev server instead (Next has no
  matching route, so it serves its catch-all 404 page rather than a
  connection error — easy to mistake for a routing bug in the api
  itself). Keep `apps/api`'s fallback at `3333` and don't let it drift
  back to matching Next's default.
- **`apps/web/vitest.config.mts` needs `environment: 'jsdom'`, the
  `@vitejs/plugin-react` plugin, and the `@/*` -> `./src/*` alias resolved
  explicitly.** `@nx/next:app --unitTestRunner=vitest` generates a
  Node-flavored config with no JSX plugin and no alias resolution — wrong
  for a React app, and Vitest doesn't read `tsconfig.json`'s `paths` on
  its own. `apps/web/src/test-setup.ts` (loading
  `@testing-library/jest-dom/vitest`) is wired as the config's
  `setupFiles` entry so `toBeInTheDocument()` and friends resolve in every
  spec without a per-file import.
- **No `NODE_ENV=production` build-target override needed** (Nx
  23.1.0, Next 16.1.7). Targets are inferred from
  `package.json`/`next.config.js` via the `@nx/next` plugin, with no
  per-app `project.json` to override. If a future Nx/Next bump ever
  produces a dev-mode production build crash
  (`web:build` succeeds but crashes prerendering `/_global-error` with a
  React-internals error), set `NODE_ENV=production` explicitly on
  `apps/web`'s `build` target as the fix.
