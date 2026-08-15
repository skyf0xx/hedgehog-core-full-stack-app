# Attribution

This directory vendors the skill shelf from
[gsap-skills](https://github.com/greensock/gsap-skills) (`greensock/gsap-skills`),
MIT-licensed. See `LICENSE` in this directory for the full license text.

- **Source repo:** https://github.com/greensock/gsap-skills
- **Vendored from:** `main` branch, commit `aed9cfd3277740755f6bfc1155c7aa645403b760`
- **Vendored on:** 2026-07-27

## What's vendored

All eight skills from the source repo's `skills/` directory, plus the
skill index, unmodified:

- `gsap-core`, `gsap-timeline`, `gsap-scrolltrigger`, `gsap-plugins`,
  `gsap-utils`, `gsap-react`, `gsap-performance`, `gsap-frameworks`
- `llms.txt` (skill index: names, summaries, trigger terms)

The source repo's plugin scaffolding (`.claude-plugin/`, `.cursor-plugin/`),
Copilot instructions (`.github/`), assets, and framework example apps
(`examples/`) are not vendored — Hedgehog's own agents (`front-end-eng`,
`ux-planner`) are the entry point into these skills, not a marketplace
install or per-agent instruction file.

## Re-vendoring

Pinned deliberately. Re-vendoring against a newer gsap-skills commit is a
manual act: repeat the fetch against the new ref and update this file's
pinned commit and date.
