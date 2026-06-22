# Repo Guardian Claw

## Purpose

Create an autonomous maintenance Claw for GitHub repos.

## Inputs

- Repository owner/name
- Optional issue or PR focus
- Optional release cadence
- Optional security focus

## Behavior

1. Review open issues and PRs.
2. Summarize recent pushes, failures, and stale work.
3. Flag security, dependency, or workflow concerns.
4. Draft maintainer actions and changelog notes.
5. Notify only when a maintainer decision is needed.

## Output

Write results to `.outputs/repo-guardian-claw.md` and state to `memory/clawtrl/repo-guardian.json`.
