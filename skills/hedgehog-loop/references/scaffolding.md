# Scaffolding a layer

Every module in this core goes through the same layer sequence, in order:

```
schema      (Drizzle)              — types before data
contract    (Zod / ts-rest)        — the boundary
repository  (port + Drizzle adapter)
service     (domain logic)         — imports only ports
controller  (thin HTTP)
hook        (TanStack Query)       — Phase B only
screen      (Next.js / Expo)       — Phase B only
```

`workspace/core.yaml` declares this as `pattern: vertical-slice` — every
layer's scope carries `{module}`, so the chain runs once per module,
independently, joined only at the exclusive `join` layer. Each row below
is one compiled layer; `backend-eng` builds the Phase A rows (`schema`
through `controller`), `front-end-eng` builds the Phase B rows (`hook`,
`screen`), one claimed packet per dispatch — it builds the layer,
`hedgehog verify` gates and commits it.

| # | Layer | Lives in | Commit |
|---|---|---|---|
| 1 | `schema` | `packages/db` (Drizzle) | `feat(<module>): schema` |
| 2 | `contract` | `packages/contracts` (Zod via `drizzle-zod` + ts-rest) | `feat(<module>): contract` |
| 3 | `repository` | `libs/<module>/repository` (port + Drizzle adapter) | `feat(<module>): repository` |
| 4 | `service` | `libs/<module>/service` (domain logic — imports only ports) | `feat(<module>): service` |
| 5 | `controller` | `apps/api` (thin HTTP, wires contract → service; bundles Queue infra if that add-on is on and this module needs it) | `feat(<module>): api` |
| 6 | `hook` | `packages/hooks` (TanStack Query) | `feat(<module>): hooks` |
| 7 | `screen` | `apps/web`, plus `apps/mobile` when the Mobile add-on is on | `feat(<module>): screen-web`, or `feat(<module>): screen` when the Mobile add-on is on |

`tools/generators/` holds one Nx generator per layer, and every layer
starts from its own:

```bash
nx g ./tools/generators:schema     --module=<module> --fields='<name:type,...>'
nx g ./tools/generators:contract   --module=<module> --fields='<name:type,...>' [--toggleField=<boolField>]
nx g ./tools/generators:repository --module=<module>
nx g ./tools/generators:service    --module=<module> [--toggleField=<boolField>]
nx g ./tools/generators:controller --module=<module> --fields='<name:type,...>' [--toggleField=<boolField>]
nx g ./tools/generators:hook       --module=<module> [--toggleField=<boolField>]
nx g ./tools/generators:screen     --module=<module>
```

`--module` is the domain module's plural kebab-case name (`tasks`,
`order-items`). `--fields` is a comma-separated list of `name:type` pairs
over `string`, `text`, `boolean`, `integer`, and `timestamp`, with a
trailing `?` marking the column nullable
(`--fields='title:string,done:boolean,dueDate:timestamp?'`); `contract`
and `controller` take the same list the module's `schema` was generated
with. A `string` field takes an optional length in parentheses
(`title:string(500)`), threaded to both the Drizzle `varchar` and the Zod
`.max()` so the two cannot disagree; omitted, it is 255. Check every
length against the intent's own rules in the packet's **RELEVANT RULES** —
a rule like "at most 500 characters" is the field list's business, not
the authored delta's, and a Zod bound that outruns its column surfaces as
a driver error at the database rather than a 400 at the boundary.

`--toggleField` names a boolean field from the schema to expose as a
toggle, and is passed to `contract`, `service`, `controller`, and `hook`
alike — one flag, four layers, so the route, the domain method, the
handler, and the mutation are generated from one source. The toggle is
server-side by construction: `POST /<module>/:id/toggle` carries no body,
and the service reads the current value and flips it inside the same
transaction its `update` uses. The client sends only the id, so a stale
cached row cannot overwrite a newer state — which is exactly what
computing the new value on the client would do, losing one of any two
flips that raced. Note that `@ts-rest/core` generates no `body` parameter
for a `c.noBody()` route: the call is `client.toggle({ params: { id } })`,
and passing `body: undefined` is a compile error.

Each generator lands the whole conventional shape of its layer in one
deterministic step — the package shell (`package.json`, `tsconfig*.json`,
`vitest.config.mts`, `src/index.ts`) where the layer creates one, the
`nx.tags` pair `packages/config/eslint-base.js`'s `depConstraints` keys
on, the port-discipline file suffixes lint checks for, the Nest module
and controller pair with `@Controller()` left bare (the ts-rest contract
already encodes full route paths), and every barrel export the new files
need. Hand-copying a sibling module's files invites exactly the drift
`hedgehog verify`'s lint step then has to catch: missing tags, missing
project references, a doubled route prefix.

What the generator lands is the layer's skeleton, not the layer. Author
the entity-specific delta on top: the module's business rules in
`service`, its domain-error mapping in `controller`, and — for `screen`,
which is skeleton-only by design — the layout, information hierarchy, and
interaction pattern from `ux-planner`'s rationale, over the placeholders
the generator leaves for the list, filter shell, empty state, and form.

Registration inside `apps/api` is automatic and stays that way:
`apps/api/src/app/feature-modules.ts` globs
`apps/api/src/app/*/*.module.ts` and is regenerated by the
`generate-feature-modules` Nx target that `build`/`typecheck`/`test`
depend on. Never register a module by editing `app.module.ts` — a shared
file no module-scoped task can safely touch. Validation is ts-rest + Zod,
so this core has no Nest DTOs and no class-validator.

The root page is the same: `apps/web/src/app/page.tsx` renders whatever
`module-routes.ts` holds, and that file is regenerated by the
`generate-module-routes` Nx target from every
`apps/web/src/app/*/page.tsx` on disk. A screen layer creates its own
`page.tsx` in its own directory and the root page picks it up — never
edit either the root page or the generated file to add a link.

**A new package needs wiring into the workspace before `hedgehog verify`
runs on it.** A package that exists on disk isn't yet part of the
workspace:

```bash
pnpm install          # link the new workspace:* deps
pnpm nx sync          # regenerate TypeScript project references
```

`pnpm-workspace.yaml` already globs `packages/*`, `apps/*` and `libs/*/*`,
so a package under any of those needs no edit there. This is the common
case, not an edge case: any layer that is the first arrival in a package
(`contract`, `hook`, each module's `repository` and `service`) or that
wires a new package into an existing one (`controller`, adding the
module's `contracts`/`repository`/`service` packages to `apps/api`) needs
it — on a module's first pass through Phase A/B that is most of the
layers, not an occasional one. See [first arrival in a
package](first-arrival.md) for the scope-widening override this same
situation needs.

The building agent runs `pnpm install` / `pnpm nx sync` and reports back
which shared files changed (typically `pnpm-lock.yaml`, root
`tsconfig.json`, and — on a `controller` layer — `apps/api/package.json`,
`apps/api/tsconfig.app.json`), because it has the shell access to run
them, but it never commits: no agent reporting success moves a task or
touches git, only `hedgehog verify`'s passing exit code does. Committing
those shared files is the orchestrating session's job, done between
dispatch and `hedgehog verify` on every layer where the agent flagged a
change: expect it, don't wait to be reminded.

```bash
git add pnpm-lock.yaml tsconfig.json   # plus apps/*/package.json,
                                        # apps/*/tsconfig.app.json on a
                                        # controller layer
git commit -m "chore(workspace): sync project references"
```

These files are mechanically derived by `pnpm install` and `pnpm nx
sync`, not authored content, and sit outside every module-scoped layer's
scope — they belong to no layer, and no override covers them. Committing
them separately, before `hedgehog verify` runs, keeps the layer's own
commit exactly the layer.

This is the orchestrating session's step rather than a verify post-step
on purpose: `hedgehog verify` gates the tree it's handed, and a gate that
mutates that tree would manufacture the scope violation it then reports.
