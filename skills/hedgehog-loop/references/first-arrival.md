# First arrival in a package

Every layer scope names a directory *inside* a package
(`packages/contracts/src/{module}/**`, `libs/{module}/repository/**`), and
on the first module through that layer the package itself doesn't exist
yet. Its shell — `package.json`, `tsconfig*.json`, `vitest.config.mts`,
`src/index.ts` — necessarily lands outside the layer's scope glob, because
no `{module}`-bearing glob can cover a package root. Left alone those files
sit on disk uncommitted until the `join` layer's `**` scope sweeps them in,
so `git log -- packages/contracts/` shows source with no buildable package
behind it for the whole middle of the build.

A generator can also drop shared, package-wide source at the `src/` root
alongside the module's own files on that same first pass — the `contract`
generator's `timestamp.ts` is one (a shared Zod util every module in the
package imports, written once, sibling to `src/index.ts`). That file needs
the same widening as the shell itself. See [scaffolding a
layer](scaffolding.md) for what a layer's generator lands and the
`pnpm install` / `pnpm nx sync` workspace wiring a new package needs.

The packet says so: when the package a scope points into has no
`package.json` on disk yet, `hedgehog next`/`show` prints a **FIRST
ARRIVAL** section under ALLOWED SCOPE carrying the exact command for that
task. Run it before building — the widening is only available while the
task is still `ready`, and a verify that rejects the shell paths blocks
the task and turns this into a five-command recovery.

```bash
hedgehog override add TASKS-CONTRACT \
  --scope 'packages/contracts/*' \
  --scope 'packages/contracts/src/*' \
  --reason 'first module through the contract layer also creates the package shell'
```

`packages/contracts/src/*` is non-recursive, so it covers `src/index.ts`
and `src/timestamp.ts` without also granting the module subdirectory the
layer's own `packages/contracts/src/{module}/**` scope already covers.

`.hedgehog/overrides/*.json` is additive, per-task, committed, and replayed
by `plan`, `--recompile` and `db rebuild` alike, so the exception survives a
rebuild and stays reviewable in the diff — unlike a hand-edited task row,
which the next rebuild silently drops. It widens exactly the one task that
creates the package, not the layer, so module two's task keeps the narrow
scope.

Which tasks need it: the first module through `contract`
(`packages/contracts`) and through `hook` (`packages/hooks`), and every
module's `repository` and `service`, since `libs/{module}/repository` and
`libs/{module}/service` are new libs per module — there, the layer's own
`libs/{module}/repository/**` glob already covers the package root, so no
override is needed. `packages/db` and `packages/config` ship with core, so
`schema` never needs one. `controller` never needs one either — `apps/api`
ships with core, and its `apps/api/src/app/{module}/**` scope already
covers the module's generated directory.

Never widen a scope to route around a violation the Correction Protocol
should handle — this is for a package shell the layer genuinely creates,
nothing else. The shell itself comes from the layer's generator, which is
also where the workspace wiring a new package needs lives (see
[scaffolding a layer](scaffolding.md)).
