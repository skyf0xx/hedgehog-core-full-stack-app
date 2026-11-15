---
name: hedgehog-bootstrap-full-stack-app-core
description: Use once, at the start of a new Hedgehog project on the full-stack-app core, before hedgehog-bootstrap's add-on steps, to land the full-stack-app core workspace (Nx, packages/config, packages/db, apps/api, apps/web, and every enforcement file) and verify it's green. Runs as the first move of the `bootstrap` agent, which `planner` invokes automatically after Confirm & Lock. No per-project decisions, no add-on awareness.
---

# Hedgehog Bootstrap — full-stack-app Core

Lands the always-on core of a Hedgehog project — the same four pieces on
every project, regardless of size or which add-ons are on — by copying a
pre-built, pre-verified workspace (this package's `workspace/`) rather
than generating it live: Nx workspace + enforcement
config, `packages/db`, `apps/api`, `apps/web`. These pieces are
deterministic — the same commands produce the same output on every
project — so the output is committed once, upstream, and copied here
instead of re-derived by an agent on every run. `hedgehog-bootstrap`
calls this skill first, unconditionally, then continues with its own
add-on steps (Auth, Queue, Mobile) — those genuinely vary per project
and stay live.

This skill has no per-project decisions to make: no Add-ons dependency,
no Add-ons check, nothing to ask. Core is identical on every Hedgehog
project.

## What lands

Everything under this package's `workspace/`, copied to the repo root:

- Root: `nx.json`, `pnpm-workspace.yaml`, `package.json` (with the
  `pnpm.overrides.esbuild` pin, `packageManager` field, and a `dev`
  script — `docker compose up -d && nx run-many --target=serve,dev
  --projects=api,web --parallel` — so a fresh clone has one command that
  brings up Postgres and both apps together), `eslint.config.mjs`,
  `docker-compose.yml` (Postgres only — Redis joins later, only if the
  Queue add-on turns on), `.env.example`
  (`DATABASE_URL`/`NODE_ENV`/`WEB_ORIGIN`, copied to `.env` in step 4),
  `lefthook.yml`, `commitlint.config.cjs`,
  `tools/phase-gate.cjs`, `.github/workflows/phase-gate.yml`,
  `tsconfig.base.json`, `pnpm-lock.yaml`, and `core.yaml` — the shipped
  layer sequence `hedgehog plan`/`verify`/`next` read for this project.
  This root `core.yaml` is a different file from `.hedgehog/core.yaml`,
  which only exists on an authored core — the two never coexist on the
  same project.
- `packages/config/` — `eslint-base.js`, `prettier.js` (no
  `prettier-plugin-tailwindcss` — that's `apps/web`'s own config, already
  wired), `env.schema.ts` (core fields only: `DATABASE_URL`, `NODE_ENV`,
  and `WEB_ORIGIN` — the origin `apps/api` enables CORS for, defaulted to
  `apps/web`'s dev origin). Tagged `type:util`.
- `packages/db/` — Drizzle client/connection wired to `loadEnv()`, no
  domain schema. `src/index.ts` re-exports `src/schema/index.ts`, an
  empty barrel-of-barrels a module's `schema` layer adds one re-export
  line to (in that layer's scope — see `core.yaml`). Tagged `scope:db`,
  `type:adapter`.
- `apps/api/` — Nest shell, `nestjs-pino` wired, CORS enabled for
  `WEB_ORIGIN`, health check only, no domain controllers. Vitest wired
  (`vitest.config.mts`, `tsconfig.spec.json` with
  `experimentalDecorators`/`emitDecoratorMetadata` for `Test.createTestingModule`),
  with a smoke test (`app.module.spec.ts`) instantiating `AppModule`.
  `apps/api/src/app/feature-modules.ts` is a generated barrel — see
  **Generated barrels** below — that `AppModule` imports and spreads
  into its `imports`, so no domain module's controller layer ever edits
  `app.module.ts`. Depends on `packages/db` (the controller layer imports
  it by construction). `apps/api-e2e` already converted to Vitest with an
  explicit `e2e` target. Tagged `scope:api`.
- `apps/web/` — `.env.example` (`NEXT_PUBLIC_API_BASE_URL`, copied to
  `apps/web/.env.local` in step 4 — Next loads env files from the app
  directory, so the root `.env` never reaches it; the value carries
  `apps/api`'s `/api` global prefix), Next shell, Tailwind v4 (PostCSS
  plugin, no `tailwind.config.js`), hand-built ShadCN base (`components.json`,
  `cn()` util, CSS variable theme, light/dark toggle via an inline
  pre-hydration script + a client-side `ThemeToggle`), TanStack Query
  provider at the root layout, `prettier-plugin-tailwindcss` scoped to
  its own `.prettierrc.js`. Vitest wired for jsdom (`vitest.config.mts`
  with the `@vitejs/plugin-react` plugin and the `@/*` -> `./src/*` alias
  apps/web/tsconfig.json already declares, `tsconfig.spec.json`,
  `src/test-setup.ts` loading `@testing-library/jest-dom`'s matchers),
  with a smoke test (`theme-toggle.spec.tsx`) rendering and clicking
  `ThemeToggle` via Testing Library. Tagged `scope:web`. `apps/web-e2e`
  (Playwright, scaffolded automatically by `@nx/next:app`) gets its own
  `e2e` target by default — no rename needed, unlike `apps/api-e2e`.
- The full `@nx/enforce-module-boundaries` `depConstraints` list for
  exactly these tags, matching the project shape `core.yaml`'s layer
  sequence actually produces — plus the `no-restricted-imports` rules that
  carry port discipline, which a tag constraint can't express because a
  module's port interface and its Drizzle adapter share one lib
  (`libs/<module>/repository`). `enforceBuildableLibDependency` is off:
  `packages/contracts` and `packages/hooks` are source-only by design, and
  it fails `apps/web` for importing either. `scope:auth`/`scope:worker`/
  `scope:mobile` entries are added live by the matching add-on step in
  `hedgehog-bootstrap`, only if that add-on turns on.
- The `@nx/js/typescript` plugin registration (`typecheck` target) with
  `composite`/`declaration` already set on every `tsconfig.lib.json` /
  `tsconfig.app.json` / `tsconfig.spec.json` this core touches.

`node_modules` is not part of the copy — `pnpm install` regenerates it
from the committed `pnpm-lock.yaml`, which is a fast resolve against a
locked graph, not a fresh solve.

## Generated barrels

Two files are generated, never hand-edited, so no module's layer touches a
file outside its own scope:

- `apps/api/src/app/feature-modules.ts` — written by
  `tools/generate-feature-modules.cjs` from every
  `apps/api/src/app/*/*.module.ts`; `AppModule` spreads its
  `featureModules` array into `imports`. A module's controller layer only
  creates its own `{module}.module.ts`. The `generate-feature-modules` Nx
  target runs ahead of `build`, `test` and `typecheck`. The imports are
  literal rather than a runtime directory scan, because `apps/api` bundles
  by walking `main.ts`'s static import graph.
- `apps/web/src/app/module-routes.ts` — written by
  `tools/generate-module-routes.cjs` from every
  `apps/web/src/app/*/page.tsx` (route groups and `_`/`.`-prefixed
  directories skipped); the root page renders a link per entry. A module's
  screen layer only creates its own `page.tsx`. The `generate-module-routes`
  Nx target runs ahead of `build`, `dev`, `test` and `typecheck`.

With no domain module yet, both files export empty arrays.

## Steps

### 1. Confirm this hasn't already run

Check for `nx.json` at the repo root. Present means core already
landed — stop, don't re-copy. If something about the landed core seems
wrong, that's a Correction Protocol case (`hedgehog-loop`), not a
re-copy: patch the specific file at its source.

### 2. Confirm Docker is available

`docker --version`. Core's `docker-compose.yml` (Postgres) needs it
immediately after landing, on every host OS — macOS, Windows, Linux
alike. No Docker: stop and point to installing Docker Desktop
(macOS/Windows) or Docker Engine (Linux) rather than falling back to a
natively-installed Postgres. See **Local infra: Docker, always** below.

### 3. Land this package's `workspace/`

`hedgehog init --ts-full-stack-app` copies this package's `workspace/`
to the repo root at install time, the same way it copies the engine's
`src/agents` to this host's own agents directory — check whether the
core files are already present (same check as step 1) before copying
again. On a project that ran plain `init` (no core flag) and only
reaches `full-stack-app` because `planner` picked it at Phase 0, this
hasn't happened yet: copy `workspace/`'s contents to the repo root now.
Also merge this core's `CLAUDE.md` section into root `CLAUDE.md`
(this package's `CLAUDE.core.md` fills the shell's `{{CORE_SECTION}}`
placeholder left unfilled by a deferred install) — skip this if the
section is already filled. Either way, by the end of this step every
file listed in "What lands" above should be on disk.

### 4. Install and start local infra

```bash
pnpm install
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
docker compose up -d
```

Two env files, because the two apps load env from different places. The
root `.env` is `apps/api`'s: gitignored and never shipped, with
`.env.example` as the committed template (`DATABASE_URL` matching
`docker-compose.yml`'s Postgres credentials, `NODE_ENV=development`,
`WEB_ORIGIN`). Skipping that copy means `packages/config`'s `loadEnv()`
fails its Zod check the moment `apps/api` boots (`DATABASE_URL` missing) —
a confusing crash to debug live instead of one line here.

`apps/web/.env.local` is Next's, loaded from the app directory rather than
the workspace root, so nothing in the root file reaches the browser.
Skipping that copy is worse than a crash: `NEXT_PUBLIC_API_BASE_URL` comes
back `undefined`, the ts-rest client builds a relative URL, and every hook
404s against Next's own dev server rather than the api — a routing bug in
appearance, an env bug in fact.

`pnpm install` resolves against the committed `pnpm-lock.yaml` — this
should be fast and produce no lockfile changes. A lockfile diff here
means the shipped `pnpm-lock.yaml` doesn't match `package.json` — that's
a packaging bug in this package's `workspace/`, not something to patch
locally (see **If verification fails**, below).

### 5. Verify

```bash
npx nx run-many -t typecheck,lint,test
npx nx format:write
```

Both must be clean: 0 errors, 0 warnings from the first command; no
diff produced by the second. This is the one live check that replaces
four separate live generate-and-verify passes — core isn't proven
correct by trusting the copy, it's proven correct by actually running
the same gate every other step in this discipline runs.

The commit gate is already active by this point: `lefthook.yml` came
with the copy, and lefthook's own postinstall ran `lefthook install -f`
during step 4's `pnpm install`. Run `pnpm dlx lefthook install` only if
`.git/hooks/pre-commit` is somehow absent.

Confirm the gate is real rather than assuming it, with:

```bash
hedgehog status
```

Its `COMMIT GATE` line reads `active` only when the hooks exist, were
generated with `lefthook.yml`'s `assert_lefthook_installed: true`, and
the lefthook binary actually resolves. Anything else is a gate that
isn't enforcing, and the line names the repair. Two failure modes it
catches that nothing else does: hooks generated before that flag
existed (they fail open — regenerate with `pnpm dlx lefthook install`),
and a `node_modules` that has since been cleared (`pnpm install`).

Also check the hook resolves to the project's pinned local lefthook
(`lefthook version` during a commit, or that `.git/hooks/` resolves
into `node_modules/`) rather than a global Homebrew-installed shadow.

### 6. Commit

```
feat(config): workspace + shared config
```

One commit for all of core, landed as a verified copy.

## If verification fails

A clean copy of `workspace/` that fails typecheck/lint/test or needs a
lockfile change means the shipped template itself is broken — not a
per-project problem to hand-patch around. Stop and report exactly what
failed (which target, which error). The template is fixed upstream and shipped as a
new package version — never patch a consuming project's copy to route
around a broken template and call core done.

## Local infra: Docker, always

Postgres runs through the `docker-compose.yml` this step lands, on
every host OS, regardless of which add-ons a project turns on later.
This isn't a convenience default — it's what makes "clone the repo, run
the stack" mechanically true regardless of who's building. Don't offer
a native-Postgres alternative even if a contributor already has one
running locally for another project. Redis joins the same file only if
the Queue add-on turns on later, in `hedgehog-bootstrap`'s own step —
not here.

## Constraints

- Run once per project, always as `hedgehog-bootstrap`'s first move —
  never invoked on its own by a user.
- No add-on awareness. If a check here ever seems to need
  `.hedgehog/addons.yaml`, that check belongs in `hedgehog-bootstrap`
  instead — this skill's whole point is being identical across every
  project.
- Don't hand-edit any file this step lands to work around a verification
  failure. Fix `workspace/` at the source instead (see **If
  verification fails**).
- Don't add domain schema, contracts, or any `libs/<module>/*` content —
  that's Phase A, after every Bootstrap box (core and whichever add-ons
  are on) is checked.
- Local Postgres always runs through the copied `docker-compose.yml`, on
  every host OS. Never substitute a natively-installed Postgres, even to
  match a contributor's existing local setup.
