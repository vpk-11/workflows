# workflows

Reusable GitHub Actions workflows shared across my repositories. Each project keeps a thin caller file with only its parameters; the logic lives here once.

## Workflows

| Workflow | Purpose | Key inputs |
|---|---|---|
| `version-bump.yml` | Classifies the push since the last bump commit (skip, patch, minor, major), stamps the README marker plus version files, commits to `main`, optionally cuts a GitHub Release | `generated`, `nonsource`, `stamp`, `github_release`, `level` |
| `node-ci.yml` | Install, then run lint, typecheck, test, build (pnpm or npm) | `dir`, `pm`, `node-version`, `pnpm-version`, `scripts` |
| `python-ci.yml` | pip install, ruff (syntax and undefined names), optional Redis, test command | `python-version`, `working-directory`, `redis`, `test-cmd` |
| `java-ci.yml` | Maven verify per module (matrix), optional Docker build | `java-version`, `modules`, `build-docker` |
| `secret-scan.yml` | Local-path and secret-shaped string scan plus gitleaks | none |
| `frontend-dist.yml` | Build a frontend and commit `dist/` to `main` | `dir`, `node-version`, `pnpm-version` |
| `pages-deploy.yml` | Deploy to GitHub Pages via the official artifact flow | `path`, `build-script`, `node-version` |
| `actionlint.yml` | Lint workflow files | none |

## Caller example

```yaml
name: Version Bump
on:
  push: { branches: [main] }
  workflow_dispatch:
    inputs:
      level: { type: choice, default: auto, options: [auto, patch, minor, major] }
permissions:
  contents: write
  pull-requests: read
jobs:
  bump:
    uses: vpk-11/workflows/.github/workflows/version-bump.yml@v1
    with:
      level: ${{ inputs.level || 'auto' }}
      generated: '^(graphify-out/)'
      nonsource: '(\.md$|^tests/|^\.github/|^LICENSE$)'
      stamp: 'package.json'
```

A called workflow cannot hold more permissions than its caller grants, so callers must declare the permissions the callee jobs need (`contents: read` for CI and scans, `contents: write` for bump and dist).

## Version tracking

The bump reads `<!-- version: vX.Y.Z -->` in `README.md` and rewrites that marker, the version badge and the `## Changelog` heading. Files listed in `stamp` are kept equal to it: `.json` files through `jq`, `.toml` files (`pyproject.toml`) through a top-level `version =` rewrite. A missing marker fails the run.

## Conventions

- Every action is pinned to a full commit SHA with a version comment.
- Top-level `permissions: {}`; each job requests only what it needs.
- `persist-credentials: false` on every checkout that does not push.
- Callers pin to a major tag (`@v1`); Dependabot keeps them current.
