---
name: nx-run-tasks
description: Helps with running tasks in an Nx workspace. USE WHEN the user wants to execute build, test, lint, serve, or run any other tasks defined in the workspace.
---

Adapted from Nx's stock task-running skill for this workspace's own
targets (`build`, `lint`, `test`, `typecheck`, `serve`) and projects
(`api`, `web`, `mobile` when the Mobile add-on is on, plus each domain
module's `libs/<module>/*`).

Run tasks via `pnpm nx` (see the `nx-workspace` skill for the pnpm-only convention and for checking which targets a project has before running one).

For more details on any command, run it with `--help` (e.g. `pnpm nx run-many --help`, `pnpm nx affected --help`).

## Run a single task

```
pnpm nx run <project>:<task>
```

where `project` is the project name defined in `package.json` or `project.json` (if present) — e.g. `pnpm nx run api:test`, `pnpm nx run web:build`.

## Run multiple tasks

```
pnpm nx run-many -t build test lint typecheck
```

You can pass a `-p` flag to filter to specific projects, otherwise it runs on all projects. You can also use `--exclude` to exclude projects, and `--parallel` to control the number of parallel processes (default is 3).

Examples:

- `pnpm nx run-many -t test -p api web` — test specific projects
- `pnpm nx run-many -t test --projects=*-e2e` — test projects matching a pattern
- `pnpm nx run-many -t test --projects=tag:type:service` — test projects by tag (see `hedgehog-loop`'s "Port discipline" for this core's tag scheme)

## Run tasks for affected projects

Use `pnpm nx affected` to only run tasks on projects that have been changed and projects that depend on changed projects. This is especially useful in CI and for large workspaces.

```
pnpm nx affected -t build test lint
```

By default it compares against the base branch. You can customize this:

- `pnpm nx affected -t test --base=main --head=HEAD` — compare against a specific base and head
- `pnpm nx affected -t test --files=libs/mylib/src/index.ts` — specify changed files directly

## Useful flags

These flags work with `run`, `run-many`, and `affected`:

- `--skipNxCache` — rerun tasks even when results are cached
- `--verbose` — print additional information such as stack traces
- `--nxBail` — stop execution after the first failed task
- `--configuration=<name>` — use a specific configuration (e.g. `production`)
