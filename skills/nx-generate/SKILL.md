---
name: nx-generate
description: Run one of this core's own Nx generators to scaffold a domain-module layer. INVOKE when a claimed packet's LAYER SHAPE section names a `tools/generators:<layer>` command to run.
---

# Run Nx Generator

Adapted from Nx's stock `nx-generate` skill for this core's closed set of
generators: `tools/generators/` holds exactly one generator per domain
module layer (`schema`, `contract`, `repository`, `service`, `controller`,
`hook`, `screen`), and every layer's task packet already names which one
to run and with what flags — there is no generator discovery or matching
step here. `hedgehog-loop`'s "Scaffolding a layer" section owns the full
flag contract; this skill covers only the mechanics of invoking one.

## Steps

### 1. Run the packet's command

The claimed packet's LAYER SHAPE section prints the exact command,
already filled in with `--module` and `--fields`. Run it as given:

```bash
nx g ./tools/generators:<layer> --module=<module> [--fields='<name:type,...>'] [--toggleField=<boolField>]
```

Always pass `--no-interactive` if the command is going to run
unattended and might otherwise prompt.

### 2. Dry-run first when the placement is unfamiliar

```bash
nx g ./tools/generators:<layer> --module=<module> --dry-run --no-interactive
```

Most of the time the generator's target paths are already well
understood (they're fixed by layer, per `hedgehog-loop`), so this step is
optional — reach for it when something about the module name or flags is
unusual enough to want to see the file list before it lands.

### 3. Read the generator source if a flag's effect is unclear

The generator's own source lives in `tools/generators/<layer>/generator.ts`
next to its `schema.json`. Read it before guessing at what a flag does —
the schema alone doesn't show side effects (barrel wiring, tag
assignment, module registration).

### 4. Author the entity-specific delta

The generator lands the layer's skeleton — package shell, `nx.tags`,
port-discipline file suffixes, barrel wiring, and (for `screen`)
placeholder sections. It does not write the module's field-specific
logic, business rules, or UX. Author that on top, per the packet's
INTENT and RELEVANT RULES.

**Important:** if a generated test file needs replacing rather than
extending, write a meaningful replacement — an empty test suite fails
`nx test`.

### 5. Wire the new package into the workspace

A layer that's the first arrival in its package needs
`pnpm install && pnpm nx sync` before verify can see it — see
`hedgehog-loop`'s "First arrival in a package" for which layers this
applies to and the override that widens scope for it. The
`link-workspace-packages` skill covers adding a dependency between two
existing packages.

### 6. Verify

Run whatever the packet's VERIFICATION command specifies. `nx-run-tasks`
covers running build/lint/test/typecheck directly if you need to check
something the packet's own command doesn't cover.
