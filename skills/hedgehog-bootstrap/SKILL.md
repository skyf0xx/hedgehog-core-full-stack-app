---
name: hedgehog-bootstrap
description: Use once, at the start of a new Hedgehog project, to land the core workspace and scaffold whichever add-ons (Auth, Queue, Mobile) planning intake turned on (`.hedgehog/addons.yaml`). Runs when the `bootstrap` agent runs, which `planner` invokes automatically after Confirm & Lock. Scoped to project scaffolding; per-module work runs through the `hedgehog-loop` skill, one step at a time.
---

# Hedgehog Bootstrap

Scaffolds a Hedgehog project's Bootstrap phase: the always-on core, plus
whichever named add-ons (Auth, Queue, Mobile) planning intake's scope
boundary (`planner`, running BMAD-METHOD's planning shelf then mining it
— see that agent) actually calls for. This is Phase 2 (Scaffold) of the
overall bootstrap sequence — Phase 0 (BMAD elicitation) and Phase 1
(mining into the build graph and `.hedgehog/addons.yaml`) already closed
by the time this skill runs. After this closes, `hedgehog-loop` takes
over per module, one step at a time.
This skill touches no domain modules — no schema, no contract, nothing
under `libs/<module>/`. That's Phase A, started fresh after Bootstrap
closes.

**Core lands via `hedgehog-bootstrap-full-stack-app-core`, run first, unconditionally.**
That skill copies a pre-built, pre-verified workspace (Nx, enforcement
config, `packages/db`, `apps/api`, `apps/web`) rather than generating it
live — core is identical on every project, so it's built once upstream
and copied, not re-derived per project. This skill covers only what's
still genuinely project-specific: whether Auth, Queue, and Mobile are on,
and — if so — scaffolding them.

Run the `nx g` commands below via nrwl's [nx-generate](https://github.com/nrwl/nx-ai-agents-config/tree/main/skills/nx-generate) skill — it dry-runs
and verifies generator flags against the installed Nx version. Run the
`nx run` / `nx affected` commands via
[nx-run-tasks](https://github.com/nrwl/nx-ai-agents-config/tree/main/skills/nx-run-tasks) the same way. The commands below are the spec; those
skills execute it correctly.

## The Stack: core + add-ons

Hedgehog has one non-negotiable **core** — applied to every project that
uses Hedgehog at all, regardless of size — plus a small set of named
**add-ons**, each scaffolded only when planning intake's scope boundary
(`planner`) actually calls for it. The core is not "the small version of
the stack"; it's the fixed floor, landed by `hedgehog-bootstrap-full-stack-app-core`.
Add-ons are not "extra polish"; each is standing infra with a real
ongoing cost (a service to run, a secret to manage, a seam to keep
idempotent) that a project without the matching need shouldn't carry.

### Core (every project, no exceptions — see `hedgehog-bootstrap-full-stack-app-core`)

| Layer | Choice |
|---|---|
| Monorepo | Nx |
| Package manager | pnpm |
| Backend framework | NestJS |
| ORM | Drizzle (+ `drizzle-zod`) |
| Database | PostgreSQL |
| Local infra | Docker Compose (Postgres) |
| Platform | Railway |
| API contract | ts-rest |
| Validation | Zod |
| Data fetching / hooks | TanStack Query |
| Web UI | Next.js (frontend only) + ShadCN + Tailwind |
| Logging | Pino (`nestjs-pino`) |
| Lint / format | ESLint (flat config) + Prettier (+ `prettier-plugin-tailwindcss`, scoped to `apps/web`) |
| Testing | Vitest (unit/integration) + Playwright (web e2e) |
| Commits | Conventional Commits + commitlint + lefthook |
| Observability | Sentry |

Constraint-contingent substitutions: Prisma for Drizzle when the team
isn't SQL-comfortable; cloud + Pulumi/SST for Railway when full
declarative IaC is a hard requirement; tRPC for ts-rest when the client is
committed TypeScript-only. A substitution here means this core's own
`workspace/` itself needs regenerating against the substitute before
this project's Bootstrap runs — not a per-project hand-edit after
landing core.

### Add-ons (scaffolded only when planning intake calls for them)

Each row is independent — on or off per project, decided at planning
intake's Confirm & Lock (`planner`) and recorded in
`.hedgehog/addons.yaml`. Turning one on inserts its Bootstrap step(s)
into the sequence below; turning it off means that step is skipped
entirely, not stubbed or partially wired.

| Add-on | Trigger (from planning intake scope) | Adds |
|---|---|---|
| **Auth** | The product has accounts, logins, or per-user data | Better Auth (+ `@thallesp/nestjs-better-auth`, Drizzle adapter), `packages/auth`, a global auth guard on `apps/api`, `BETTER_AUTH_SECRET` in the env schema |
| **Queue** | At least one operation is genuinely long-running, retried, or fanned out | BullMQ + Redis, `apps/worker`, a `Queue` port/adapter seam, `REDIS_URL` in the env schema, Redis in `docker-compose.yml` |
| **Mobile** | Mobile is explicitly in scope | Expo + React Native Reusables + NativeWind, `apps/mobile` |

A project with none of these on is still a full Hedgehog project — Nx,
NestJS, Postgres, Docker, ts-rest, the phase discipline, and every gate
still apply (all landed by `hedgehog-bootstrap-full-stack-app-core`). What's cut is
infra with no consumer, not the discipline itself.

If a project's whole description has no persistent domain data and no
real lifecycle to model at all (a static marketing page, a one-off
script, a slide deck) — not "small," but literally no state to carry
across a schema/contract/service — Hedgehog doesn't apply. `planner`
checks for this before running BMAD's planning shelf (see that agent's
opening check) and says so rather than forcing the discipline onto
something with no domain module in it.

### Monorepo layout

```
apps/
  web        (Next.js — UI only)                    core, landed by hedgehog-bootstrap-full-stack-app-core
  mobile     (Expo — only if the Mobile add-on is on)
  api        (NestJS — owns all domain logic + DB access)  core, landed by hedgehog-bootstrap-full-stack-app-core
  worker     (BullMQ consumers — only if the Queue add-on is on)

packages/
  db         (Drizzle schema + client)                core, landed by hedgehog-bootstrap-full-stack-app-core
  contracts  (ts-rest + Zod contracts)
  hooks      (TanStack Query — shared web + mobile)
  jobs       (typed job registry / queue definitions — only if Queue is on)
  auth       (Better Auth config — only if Auth is on)
  config     (locked ESLint/Prettier/tsconfig/env schema)  core, landed by hedgehog-bootstrap-full-stack-app-core
  shared     (cross-cutting types + utils)

docs/
  design     (<module>.md per module — `ux-planner` agent output)
```

`packages/auth` and `packages/jobs` are infra, built once, here (when
their add-on is on) — not touched again per module. `docs/design` fills in
per module during Phase B; nothing to scaffold here beyond the empty
directory.

### Queue add-on: seam in, usage deferred

When the Queue add-on is on, it goes in as a day-one standing default:
Redis provisioned on Railway, a `worker` app in the monorepo, a `Queue`
port with a BullMQ adapter (same pattern as repositories) — but usage
stays last-responsible-moment even then: an operation goes async only
when it genuinely needs to (long-running work, retries, fan-out).
Services don't know how their results are returned — the enqueue-vs-await
decision lives at the application/controller layer. Workers are
idempotent (at-least-once delivery). A project where nothing meets that
bar doesn't get the seam at all — see the Add-ons table above.

## Before running

Confirm planning intake already happened — intent records should exist in
the build graph (`hedgehog status`) and `.hedgehog/addons.yaml` should
exist, recording which add-ons (Auth, Queue, Mobile) are on for this
project. No intents yet, or no `.hedgehog/addons.yaml`: stop and point to
`planner` rather than guessing which add-ons apply.

Run `hedgehog-bootstrap-full-stack-app-core` first, unconditionally, if it hasn't
already landed core (check the commit log, or `nx.json` at the repo
root). That skill has its own re-run guard and Docker check — don't
duplicate those here.

## Steps (run in sequence, one commit per step that actually runs)

### 1. `packages/auth` — Better Auth config *(Auth add-on only)*

Skip this step entirely if Auth isn't on for this project (check
`.hedgehog/addons.yaml`) — don't scaffold a credential store with no
login anywhere in scope. If skipped, say so plainly (per the `bootstrap`
agent's handling of conditional steps) and move on — `.hedgehog/addons.yaml`'s
`auth.on: false` entry is already the durable record, nothing further to
write — same treatment as an out-of-scope `apps/mobile`.

```bash
npx nx g @nx/js:lib packages/auth --bundler=none --unitTestRunner=vitest
```

`better-auth` and `@thallesp/nestjs-better-auth` are already declared in
root `package.json` and resolved by `pnpm-lock.yaml` — the core ships
them, so there is nothing to install here. Don't run `pnpm add` for
either: an add resolves against npm at whatever is latest today, which
is the drift this core pins them to avoid.

Configure the Drizzle adapter against `packages/db`. Add
`BETTER_AUTH_SECRET: z.string().min(32)` to `packages/config/env.schema.ts`
now (it doesn't exist in the core schema `hedgehog-bootstrap-full-stack-app-core`
landed), and add a matching `BETTER_AUTH_SECRET=` line with a generated
value to the root `.env.example` — a schema entry with no `.env.example`
line reproduces the exact `loadEnv()` crash-on-boot that
`hedgehog-bootstrap-full-stack-app-core`'s `DATABASE_URL` entry exists to prevent, just
for this var instead. Tag: `scope:auth`, `type:adapter`.

Also wire the global auth guard on `apps/api`: register the guard
(secure-by-default) against `packages/auth` — the root declaration
already resolves `@thallesp/nestjs-better-auth` for every project in the
workspace, so `apps/api` needs no add of its own. `apps/api`'s
`depConstraints` entry needs `scope:auth` added to its allowed
dependencies now — the one deliberate exception to "api reaches things
only through ports," since auth is cross-cutting infra, not a domain
module.

Commit: `feat(auth): better auth config + global guard`

### 2. `apps/worker` — BullMQ seam (Redis, no consumers yet) *(Queue add-on only)*

Skip this step entirely if Queue isn't on for this project (check
`.hedgehog/addons.yaml`) — no operation in scope is long-running,
retried, or fanned out, so there's nothing for a queue to seam in for. If
skipped, say so plainly and move on — same treatment as an out-of-scope
`apps/mobile`.

```bash
npx nx g @nx/node:app apps/worker
```

`bullmq` and `ioredis` are already declared in root `package.json` and
resolved by `pnpm-lock.yaml` — same as Auth's packages above. Nothing to
install here; don't run `pnpm add` for either.

Add a `redis` service to the root `docker-compose.yml` that
`hedgehog-bootstrap-full-stack-app-core` landed (Postgres-only) and
`REDIS_URL: z.string().url()` to `packages/config/env.schema.ts` (it
doesn't exist in the core schema), plus a matching `REDIS_URL=` line in
`.env.example` (`redis://localhost:6379`) — same `loadEnv()`
crash-on-boot risk as `BETTER_AUTH_SECRET` above:

```yaml
  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis-data:/data
```

(and add `redis-data:` under the top-level `volumes:` key.)

Provision the Redis connection and a `Queue` port shape (port + BullMQ
adapter, same pattern repositories use later) with no consumers — usage
is deferred (see Queue add-on, above). Call `loadEnv()` at the top of
`apps/worker/src/main.ts`. Tag: `scope:worker`.

`packages/config/eslint-base.js` already ships the `scope:worker`
`depConstraints` entry — nothing to add here. The BullMQ adapter's file
name ends in `.adapter.ts`, same convention repositories use, so
`eslint-base.js`'s port-discipline rules apply to it unchanged.

Commit: `feat(worker): bullmq seam, no consumers`

### 3. `apps/mobile` — Expo shell *(Mobile add-on only)*

Skip this step entirely if Mobile isn't on for this project (check
`.hedgehog/addons.yaml`) — don't scaffold speculative infra. If skipped,
say so plainly and move on — same pattern as Auth (step 1) and Queue
(step 2) when their add-on is off.

Mobile's packages are pinned in `addon-versions.json` at the workspace
root, not named inline here and not declared in root `package.json` —
Expo pulls a native build matrix that has no business in a project that
never scaffolds `apps/mobile`. Read every version from that file rather
than typing one, so this step installs what the core was last gated
against:

```bash
NX_EXPO=$(node -p "require('./addon-versions.json').mobile['@nx/expo']")
NATIVEWIND=$(node -p "require('./addon-versions.json').mobile.nativewind")
RNR=$(node -p "require('./addon-versions.json').mobile['@react-native-reusables/cli']")

pnpm add -w -D "@nx/expo@$NX_EXPO"
pnpm add -w "nativewind@$NATIVEWIND"

npx nx g @nx/expo:app apps/mobile --unitTestRunner=jest

npx "@react-native-reusables/cli@$RNR" init
npx "@react-native-reusables/cli@$RNR" add button text
```

`-w` is required: this is a pnpm workspace, and an add without it fails
with `ERR_PNPM_ADDING_TO_ROOT` rather than installing.

`@nx/expo:app` generates `apps/mobile/src/test-setup.ts` with an untyped
`defineGlobal` helper, which is a `TS7006` error under the core's
`strict: true` base tsconfig — `mobile:typecheck` fails on a fresh
scaffold until it is annotated:

```ts
const defineGlobal = (name: string, value: unknown) => {
```

Make that edit before the step's commit. `nx-migrate.yml`'s add-on gate
applies the same annotation, so the day `@nx/expo` ships the types both
stop being needed together.

`@nx/expo`'s pin is byte-identical to every other `@nx/*` entry in root
`package.json` — Nx requires its plugin matrix to be version-identical,
and a mismatch fails at generator time with a resolution error rather
than at install. If the pin and the `@nx/*` entries have drifted apart,
stop and fix `addon-versions.json` rather than installing anyway.

`@nx/expo:app`'s own default for `--unitTestRunner` is `none` — pass it
explicitly, or `apps/mobile` has no `test` target at all and the `screen`
layer's verify command below fails on a missing target rather than a
real test.

React Native Reusables ships as a CLI, same copy-you-own-the-code model
as `apps/web`'s ShadCN setup, not a plain npm dependency: `init` wires
NativeWind and the `@/*` path alias into `apps/mobile/tsconfig.json`
(matching `apps/web`'s own `components.json` alias); `add` copies the
named components' source into `apps/mobile/src/components/ui/`. `button`
and `text` are the two the `screen` generator's mobile output imports —
add any further components `front-end-eng` needs the same way, per
module, as it builds, at the same pinned CLI version.

Edit `init`'s generated theme (`tailwind.config.js` colors, light/dark)
to match `apps/web`'s base theme (landed by
`hedgehog-bootstrap-full-stack-app-core`) rather than its own default
palette — one visual identity across platforms, set once here rather
than drifting per-screen. Tag: `scope:mobile`.

`packages/config/eslint-base.js` already ships the `scope:mobile`
`depConstraints` entry — nothing to add there.

**Set the `screen` generator's platform default to both.** The generator
ships defaulting to `web` alone — this is the one Bootstrap step that
knows `apps/mobile` exists, so it's where the default widens. Add a
`generators` entry to root `nx.json`:

```json
"generators": {
  "hedgehog:screen": {
    "platforms": "web,mobile"
  }
}
```

so every module's `screen` layer task runs the generator against both
platforms without each dispatch having to pass `--platforms` by hand.

**Extend the `screen` layer in root `core.yaml` to cover mobile.** The
shipped layer is web-only, because `apps/mobile` exists only on a project
that ran this step — which is now. This step is the one place that knows
both that the Nx `mobile` project exists and that its test target is real:

```yaml
  - id: screen
    depends_on: hook
    scope:
      [
        "apps/web/src/app/{module}/**",
        "apps/mobile/src/{module}/**",
        "apps/mobile/src/app/{module}.tsx",
      ]
    verify: "pnpm nx test web -- src/app/{module}/ && pnpm nx test mobile -- src/{module}/"
    commit: "feat({module}): screen"
```

The third scope entry is the mobile route file itself: Expo Router only
resolves routes under `src/app/`, so `screen`'s mobile output has a thin
route re-export there (mirroring `apps/web`'s own `page.tsx`) alongside
the screen/form/spec under `src/{module}/`. Both paths need to be in
scope, or `hedgehog verify` flags the route file as an unscoped write on
every module.

The commit message drops the `-web` suffix here because the layer now
covers both platforms, not just web.

Then run `hedgehog plan --recompile`. `planner` already compiled every
module's tasks before handing over, so the edit reaches the not-yet-started
`screen` tasks only through a recompile — `hedgehog status`'s DRIFT section
names them until it runs. Show the recompile output: it should list one
updated `*-SCREEN` task per module and skip nothing.

Commit: `feat(mobile): expo shell + base theme`

## Step order

A project with every add-on off runs zero steps from this file; a
project with all three on runs three, in this order (Auth before Queue
before Mobile, since Auth's guard should exist before other infra
touches `apps/api`, and Queue/Mobile have no ordering dependency on each
other).

## Locked format/lint config

One shared config, extended everywhere — landed by
`hedgehog-bootstrap-full-stack-app-core`, referenced (not re-created) by every add-on
step above:

- `packages/config/eslint-base.js` — flat config, extended by every
  app/lib.
- `packages/config/prettier.js` — the shared base, *without*
  `prettier-plugin-tailwindcss` (that's `apps/web`'s own config, already
  wired by `hedgehog-bootstrap-full-stack-app-core`).

A per-app override request signals to fix the base config at the source.

## After Bootstrap

Once every `on` add-on in `.hedgehog/addons.yaml` has its commit landed
(core's commit already landed via
`hedgehog-bootstrap-full-stack-app-core`), hand off to `hedgehog-loop` —
from here, every domain module goes through Phase A layers one at a
time via `hedgehog next`/`hedgehog verify`, each its own commit.

## Constraints

- Run `hedgehog-bootstrap-full-stack-app-core` first, unconditionally, before any step
  in this file — never scaffold an add-on against a core that hasn't
  landed and verified clean.
- Add-on steps (Auth, Queue, Mobile) run only if `.hedgehog/addons.yaml`
  (written by `planner` at planning intake) turns that add-on on — say so
  plainly and skip otherwise, don't leave it ambiguous whether the step
  was considered.
- A skipped Auth or Queue step leaves that add-on's packages declared but
  unused, since the core ships them in root `package.json`. Delete the
  skipped add-on's entries (`better-auth` and
  `@thallesp/nestjs-better-auth` for Auth; `bullmq` and `ioredis` for
  Queue) and re-run `pnpm install` so the lockfile drops them. Do this in
  the same commit that records the skip. Mobile needs nothing — its
  packages were never in the install to begin with.
- Never write a version number into a command in this file. Auth and
  Queue versions come from root `package.json`; Mobile's come from
  `addon-versions.json`. A version typed into a step is invisible to
  `nx migrate`, to `pnpm outdated`, and to CI's add-on gate, so it drifts
  silently in whichever direction the day's npm resolution happens to
  take it.
- Don't add domain schema, contracts, or any `libs/<module>/*` content —
  that's Phase A, started after Bootstrap, one module at a time.
- Don't deviate from the package/library choices above, for whichever
  steps actually run. If a generator or package name changed upstream
  since this was written, verify against current docs before running the
  command — don't substitute a different library. Skipping an add-on
  step whose trigger genuinely isn't in scope is not a deviation; adding
  a library the stack doesn't call for, or dropping one it does, is.
- Each step that runs is its own commit, in order — same unit-of-work
  discipline as every other step in the discipline, even though this is
  infra rather than a domain module.
- Never substitute a natively-installed Postgres or Redis, even to match
  a contributor's existing local setup — see `hedgehog-bootstrap-full-stack-app-core`'s
  **Local infra: Docker, always**.
