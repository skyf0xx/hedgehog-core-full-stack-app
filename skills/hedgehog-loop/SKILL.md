---
name: hedgehog-loop
description: Use for every unit of work once a Hedgehog project is bootstrapped — building one layer (schema, contract, repository, service, controller, hook, screen) per module, gated by `hedgehog verify` and committed one layer at a time. Triggers on "next step", "build this module", "what's next", or the start of any work session on a bootstrapped project. Also covers the Correction Protocol for fixing a wrong upstream step.
---

# Hedgehog Loop

The operating loop for a bootstrapped full-stack-app project. The
core-neutral cycle (claim, dispatch, verify, debt and decisions, the
intent check), the Test-depth and review rule, the Friction log, the
Correction Protocol with its Post-build entry, the Stop Condition, the
Graph exits, and clearing context are owned by `hedgehog-orchestrating`;
this skill cites those sections by name and adds only what is specific to
this core. `hedgehog core show` prints the layer sequence with each
layer's scope, verify command and commit message; `hedgehog status` and
`hedgehog ready` are the live list of what is built and what is next.

## Determine phase

Before touching code, know which phase applies to the module in scope:

- **Phase A** — building/extending the backend. Every module in scope
  needs schema → contract → repository → service → controller before
  Phase B starts for any of them.
- **Phase B** — Phase A is closed for the module. Build hooks and screens.

Phase A is closed for a module when `hedgehog status` shows its
`controller` task `complete` (`hedgehog why <path>` names the task behind
a specific file). Until then the module is in Phase A.

## The Domain Module Pattern

Root CLAUDE.md's Core rules own "one table = one domain module" and
"FK-by-ID only" — this section is their mechanics. `users`, `orders`,
`order_items` are each their own module, carrying the full layer sequence
`hedgehog core show` prints. The schema is the source of truth for module
boundaries.

If `orders.user_id` references `users`, the `orders` schema holds a plain
FK column. The `orders` repository and service depend only on their own
ports — a service knows related entities only as an ID.

- Need the related row? Resolve it at the contract/controller layer
  (parallel calls to each module's own endpoint), or join against the
  other module's *schema* directly inside the repository (Drizzle query).
- This keeps every service importing only its own module's port, which is
  what `eslint-base.js`'s `no-restricted-imports` rule for
  `libs/*/service/**` enforces (wired at bootstrap) — a service reaching
  a `*.adapter`, `drizzle-orm`, or `packages/db` fails lint.

A junction table (e.g. `order_items`) is one table, one module, with two
FK-by-ID columns instead of one, each resolved the same way.

`pattern: vertical-slice` in the root `core.yaml` means every layer's
scope carries `{module}`, so the chain runs once per module,
independently, joined only at the exclusive `join` layer.

Plus, when an operation needs async **and the Queue add-on is on for this
project** (check `.hedgehog/addons.yaml`'s `queue.on`): **queue = port +
BullMQ adapter**, same port/adapter shape as the repository. The service
imports only ports. Queue is one-time project infra, not a compiled
layer — the root `core.yaml` has no `queue` layer, so this step has
no `hedgehog verify` gate of its own; build it as part of the
`controller` layer's packet, verified by that layer's own check. If the
Queue add-on is off, there's no `apps/worker` and no queue step, full
stop — an operation that seems to want async processing on a Queue-off
project is a signal to revisit that add-on decision with `planner`, not
to build a one-off queue outside the add-on's scaffolding.

Every layer scaffolds from its own generator in `tools/generators/` (see
"Scaffolding a layer" below) — package shell, tags, files, barrel wiring,
and the layer's conventional shape all land in one deterministic step.
What's authored on top is the entity-specific delta: the field list and
its types, the module's business rules, and the UX intent behind its
screen.

## Who builds what

The cycle's dispatch step (`hedgehog-orchestrating`, "The cycle") names
the agent per layer here: `backend-eng` builds Phase A layers (`schema`
through `controller`), `front-end-eng` builds Phase B layers (`hook`,
`screen`), one claimed packet per dispatch, matching the packet's ALLOWED
SCOPE. The API is complete, typed, and callable (Postman/curl/contract
tests) before frontend work starts.

Between the `hook` task going `complete` and `front-end-eng` starting the
`screen` layer, `ux-planner` runs once per module to decide "how it
should feel", from the UX spec in `.hedgehog/BMAD/05-ux-spec/` or — where
the archive holds none — from the contract and hook plus whatever the
user supplies when it asks. Its first run for a module also signals to the
user that Phase B has started, and is the point a mockup, screenshot, or
export (Google Stitch, Figma) can be handed over. It writes
`docs/design/<module>.md`, which is in the `screen` layer's scope, so the
`screen` layer's `hedgehog verify` gates and commits it.

## Core additions to the cycle

- **Verify radius.** Every per-module layer's verify radius equals its own
  scope (the root `core.yaml`'s header says so), so a layer's verify
  measures internal consistency only. The real test bar and the `reviewer`
  pass sit at `join`, the workspace-wide `exclusive: true` layer that runs
  the full typecheck and test suite after every module's layers land
  (`hedgehog-orchestrating`, "Test-depth and review rule").

## Scaffolding a layer

Every layer starts from its own generator in `tools/generators/`, which
lands the layer's package shell, tags, and conventional shape in one
deterministic step, and a new package needs `pnpm install`/`pnpm nx sync`
wired in before `hedgehog verify` can run on it. Read the [scaffolding
reference](references/scaffolding.md) for the generator commands, flag
contract, and workspace-wiring steps.

## First arrival in a package

The first module through a layer whose scope names a directory inside a
package that doesn't exist yet on disk needs its scope widened for that
one task, since the package shell lands outside the layer's own
`{module}`-bearing glob. Read the [first arrival
reference](references/first-arrival.md) for which layers this applies to
and the `hedgehog override add` command it calls for.

## Intra-step conventions

The Nx boundaries, phase gate, and lint own the *structural* rules
(what imports what, what gets built when). These are the conventions
*inside* a step that those gates can't see — apply them uniformly so a
fresh-context session builds module N the same way it built module 1. The
`reviewer` agent checks these at a phase boundary.

- **Errors are thrown, typed, and domain-named.** A service throws a
  domain error (`OrderNotFoundError`, not a bare `Error` or an HTTP
  exception) — services don't know they're behind HTTP. The controller is
  the only layer that maps domain errors to status codes. Never return
  `null`/`undefined` to signal a failure a caller must branch on.
- **Repository not-found returns `undefined`; the service decides.** A
  `findById` that misses returns `undefined` (a plain absence, not an
  error); the service turns that into a thrown domain error when the
  operation requires the row. Adapters don't throw domain errors — they
  report absence, the service interprets it.
- **Validation lives at the contract boundary, once.** Input is
  Zod-validated at the controller via the ts-rest contract. Past that
  boundary, types are trusted — services and repositories don't re-parse.
  A service-level invariant that isn't expressible in the Zod schema
  (e.g. "can't cancel after payment") is enforced in the service as a
  thrown domain error, not a second validation pass.
- **Multi-write operations are transactional.** A service method that
  writes more than once wraps the writes in one Drizzle transaction,
  passed through the port — partial writes never escape a failed
  operation.
- **Services are pure domain logic.** No logging, no HTTP, no queue
  mechanics inside a service method — those live at the controller /
  adapter edge. A service reads as the business rule and nothing else.


## Friction log

`hedgehog-orchestrating`'s "Friction log" section owns the log and its
mechanics; this core adds nothing to it.

## Correction Protocol

`hedgehog-orchestrating`'s "Correction Protocol" section owns the steps
(including its "Post-build entry" for a structural fault found after the
Stop Condition). One addition on this core: if the patched layer lives in
a workspace package (e.g. `packages/hooks`, `packages/contracts`) that a
running `web`/`mobile` dev server consumes, run that package's `nx run
<pkg>:build` before re-verifying anything downstream — the dev server
resolves the package's built `dist/`, not its `src/`, so an unbuilt patch
looks unchanged to anything downstream even though the source is fixed.

## Phase Transition Checks

Before starting Phase B for a module, confirm:

- `hedgehog status` shows that module's `controller` task `complete`.
- The contract is callable and typed (contract tests pass).

Use the `reviewer` agent for this — it checks what the mechanical gate
can't. Everything lefthook already enforces (typecheck, lint, unit test
pass/fail) is out of scope for that review; these are the checks this
core adds on top of it, and the list `reviewer` works from at a
full-stack-app phase boundary:

- **Port discipline**: a module's port interface and its Drizzle adapter
  share one lib, so the tag graph has to allow `type:service →
  type:adapter` and the real check is at the import level: does the
  service import the port from the repository lib's entry point, or the
  concrete `*.adapter`? Does anything in `apps/api` outside a
  `*.module.ts` construct an adapter? `eslint-base.js`'s
  `no-restricted-imports` rules catch the named cases — read the actual
  imports anyway, since an adapter file not named `*.adapter.ts` opts
  itself out of the rule. Use `nx show project <name> --json` (per the
  `nx-workspace` skill) to check a project's resolved tags and
  dependencies rather than reading `project.json` directly — it only
  holds partial configuration, not tags inferred by plugins.
- **FK-by-ID discipline**: does a module's repository/service reach into
  another module's tables directly, or only resolve related entities by
  ID at the contract/controller layer (cross-module references, above)?
- **Module granularity**: is this actually one table = one module, or has
  scope crept — two tables sharing a service, or a junction table
  absorbed into one side's module instead of standing alone?
- **Contract shape**: does the Zod/ts-rest contract match what Phase B
  will need, or does it leak implementation detail that will force a
  breaking change once hooks are built against it?
- **Phase leakage**: any hook or screen code, or frontend-shaped
  reasoning, showing up before this module's `controller` task is
  `complete`?
- **Queue seam**: if the Queue add-on is on and queue infra was added,
  does the operation genuinely need async (long-running, retries,
  fan-out) — or was the seam reached for out of habit? If the Queue
  add-on is off (check `.hedgehog/addons.yaml`'s `queue.on`), there should
  be no `apps/worker` and no queue infra at all for this module — queue
  infra appearing anyway is itself a finding, not something to review the
  contents of.
- **Intra-step conventions**: does the module follow the conventions the
  gate can't see (Intra-step conventions, above)? Check against that list
  rather than re-deriving it. A module drifting from them is a Warning
  unless it breaks Phase B.
- **Security/correctness**: unvalidated input reaching a Drizzle query
  outside the Zod-validated contract boundary, secrets, obvious logic
  errors — same bar any reviewer would apply, scoped to what's new since
  the last review point.

The review point is the commit that closed the module's `controller`
task (`hedgehog why <a controller file>` names it); `git diff` from
there, then read every layer of the module rather than the diff
alone — boundary violations are invisible from a diff.

Before starting Phase A for a module, confirm it's inside the stated scope
boundary from planning intake (`planner`). If not, stop and ask — and if
the answer is that the scope really should grow, that's `planner`'s
Re-entry pass, which adds it to the graph properly. Don't build a module
the graph doesn't have a task for.


## Rules

- **Phase A closes before Phase B opens.** Every module in scope has a
  working, tested API before any hook or screen starts.
- **Concurrent within a phase, bounded by the scheduler.** Never assume
  two tasks are safe to run together because they look independent — ask
  `hedgehog ready`.
- **Queue infra is conditional twice over** — only if the Queue add-on is
  on for this project at all (per `.hedgehog/addons.yaml`'s `queue.on`),
  and even then only when a given operation genuinely needs async
  (long-running, retries, fan-out); the normal case has no queue.
- **A wrong step gets fixed at its source** — the Correction Protocol, not
  a downstream workaround.
- **Tests gate every commit** in the sequence.
- A module's frontend code (hook, screen) is built after its API is
  committed.
- The screen step doesn't start blank — `ux-planner` runs once per module,
  after the hook task is `complete`, before `front-end-eng` starts the
  screen.
- `packages/config` is the single source for shared config (root
  CLAUDE.md's Core rules).

## Stop Condition

`hedgehog-orchestrating`'s "Stop Condition" section owns the stop, the
`hedgehog boundary` check, and the handoff to `tweaker` (adjustments) or
`planner` (new scope). On this core, new scope is a new module or feature
and goes to `planner`'s Re-entry pass.
