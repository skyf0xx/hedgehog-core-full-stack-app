# @skyf0xx/hedgehog-core-full-stack-app

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
