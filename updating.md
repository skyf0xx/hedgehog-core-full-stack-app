# Updating dependencies

Ground rules, learned the hard way from PR #13.

## The process

1. Ignore individual Dependabot PRs for `workspace/`. Close them.
2. Instead, from `workspace/`, run a best-effort bump to latest locally:
   ```
   pnpm install
   npx nx migrate latest && npx nx migrate --run-migrations
   pnpm install --no-frozen-lockfile
   ```
3. Run the real checks locally:
   ```
   npx nx run-many --target=lint,typecheck,test,build --all
   npx nx run-many --target=e2e --all   # needs `docker compose up -d` first
   ```
4. If that's green, push one branch, one PR. Done.
5. **If it's not green within ~30 minutes of active debugging, stop.** Revert, close the PR, leave the Dependabot PRs (or a fresh set) for next week. Do not chase CI infrastructure bugs, generator bugs, or unpatched security advisories that surface incidentally — file them separately if they're real, but they are not this task.

## Hard limits

- **Time-box it.** One sitting. If root-causing a CI failure requires spinning up worktrees, bisecting workflow steps, or fixing generator internals, that's scope creep — stop and punt to next week.
- **`workspace-build` in CI is not the bar.** It's flaky/slow and was broken for unrelated reasons the first time this was tried (missing DB, missing pnpm workspace links, generator bugs). Local `lint/typecheck/test/build/e2e` green is enough to merge. Don't wait on GitHub Actions to referee this.
- **Unpatched security advisories block merge but are not this task's problem.** If `dependency-review` fails on a transitive dep with no `first_patched_version`, don't try to solve it inline (excluding installs, allow-listing advisories, etc. are real decisions, not busywork). Note it and move on — ask separately if it needs a decision.
- **No new problem-solving mid-update.** If something looks like a pre-existing bug unrelated to the version bump, don't fix it as part of this task. Note it, keep going.

## Why not per-package Dependabot PRs

This is an Nx monorepo — `nx` core and `@nx/*` plugins must move together, and Dependabot bumps them one at a time, which routinely produces individually-green, jointly-broken combinations. A single local bump-to-latest avoids that entirely.
