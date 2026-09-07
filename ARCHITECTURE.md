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
- `vendor-skills/GSAP` — the vendored asset set `hedgehog-loop`'s
  build steps reference.
- `CLAUDE.core.md` — fills a Hedgehog project's root `CLAUDE.md`
  `{{CORE_SECTION}}` placeholder for this core.
- `hedgehog-core.yaml` — this package's manifest: name, flag, the
  selection prose the Hedgehog planner matches a project description
  against, and which agents/skills/vendor skills it carries.
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
