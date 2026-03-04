---
name: git-conventional-commit
description: >
  Generate, validate, and manage Git commit messages following the Conventional Commits specification.
  Use this skill whenever the user mentions commits, commit messages, changelogs, git history, semantic versioning from commits, or asks to "write a commit", "review my commit", "validate this commit message", "generate a changelog", or "what type is this commit". Trigger even if the user just pastes a diff or staged changes and asks what to do next — they probably want a commit message. This skill handles all conventional commit workflows: generating messages from diffs, validating existing messages, suggesting the right type and scope, and creating changelogs from commit history.
---

# Git Conventional Commit Skill

## Overview

This skill helps Claude work with [Conventional Commits](https://www.conventionalcommits.org/) — a specification for writing structured, machine-readable git commit messages.

---

## Commit Message Format

```
<type>(<scope>): <short description>

[optional body]

[optional footer(s)]
```

### Rules
- **Header line**: max 72 characters
- **Type**: lowercase, from the allowed list
- **Scope**: optional, lowercase, noun describing the affected area (e.g., `auth`, `api`, `ui`, `db`)
- **Description**: imperative mood, no period at end, lowercase start
- **Body**: wrapped at 72 chars, explains *what* and *why* (not *how*)
- **Footer**: `BREAKING CHANGE: <description>` or `Fixes #123`, `Closes #456`

---

## Supported Commit Types

### Standard Types
| Type | Use when... |
|------|-------------|
| `feat` | Adding a new feature |
| `fix` | Fixing a bug |
| `docs` | Documentation only changes |
| `style` | Formatting, missing semi-colons (no logic change) |
| `chore` | Maintenance, dependency updates, tooling |
| `build` | Build system or external dependency changes |
| `ci` | CI/CD configuration changes |
| `revert` | Reverting a previous commit |

### Extended Types
| Type | Use when... |
|------|-------------|
| `perf` | Performance improvements |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or correcting tests |

### Custom Types (project-specific)
If the user has defined custom types for their project (e.g., `migration`, `config`, `infra`, `release`), use them. Ask if unsure.

---

## Workflows

### 1. Generate Commit Message from Diff

When the user provides a diff, staged changes, or describes what they changed:

1. **Analyze** the changes: what files were touched, what logic changed, what problem is solved
2. **Determine type**: map the change to the most appropriate type
3. **Identify scope**: infer from file paths, module names, or affected feature area
4. **Write the message** with a clear, imperative description
5. **Output format**: message + explanation (see Output Format below)

**Type selection heuristics:**
- New file with functionality → `feat`
- Modifying existing logic to fix incorrect behavior → `fix`
- Renaming, extracting, restructuring without behavior change → `refactor`
- Only `.md`, `.txt`, comments changed → `docs`
- Only whitespace, formatting, linting → `style`
- Added/modified `.test.`, `.spec.` files → `test`
- `package.json`, `Cargo.toml`, `go.mod` dep changes → `chore` or `build`
- `.github/workflows`, `Dockerfile`, CI files → `ci`
- Speed/memory improvements with benchmarks → `perf`

### 2. Validate Existing Commit Message

When the user provides a commit message to check:

1. Parse header: type, scope, description
2. Check against all rules (format, length, casing, imperative mood)
3. Check type is from the allowed list
4. Report issues clearly and suggest a corrected version

**Common issues to catch:**
- Past tense ("added", "fixed") → should be imperative ("add", "fix")
- Header too long (>72 chars)
- Type not in allowed list
- Missing colon or space after type/scope
- Description starts with uppercase
- Description ends with period

### 3. Suggest Commit Type & Scope

When the user is unsure what type or scope to use, ask clarifying questions:
- "Did this change add new behavior, fix a bug, or restructure existing code?"
- "What part of the codebase does this affect?" (to determine scope)

Then provide a recommendation with reasoning.

### 4. Decompose Large Changes into Atomic Commits

When the user provides multiple files, a large diff, or mixed-scope changes — **never collapse everything into one commit**. Instead:

#### Step-by-step process:

**Step 1 — Inventory the changes**
List every file changed and what kind of change it is (new, modified, deleted). Group by apparent concern:
```
src/auth/oauth.ts        → new OAuth login logic
src/auth/middleware.ts   → modified to support OAuth tokens
tests/auth/oauth.test.ts → new tests for OAuth
docs/auth.md             → updated auth documentation
package.json             → added oauth2 dependency
.env.example             → added GOOGLE_CLIENT_ID variable
```

**Step 2 — Identify logical groups**
Cluster files that belong to the same atomic unit of change. Ask: *"If this group were reverted, would the codebase still make sense?"*

Common grouping signals:
- Same feature area / module
- Test files always go with the code they test (same commit)
- Docs update for a feature → same commit as the feature, or separate `docs` commit if standalone
- Dependency addition → same commit as the feature that needs it, unless it's a bulk upgrade
- Config/env changes → same commit as the feature requiring them

**Step 3 — Propose the commit plan**
Present a numbered commit sequence **before writing any messages**, so the user can validate the split:

```
Proposed commit sequence (3 commits):

1. feat(auth): add Google OAuth2 login
   → src/auth/oauth.ts, src/auth/middleware.ts, tests/auth/oauth.test.ts, package.json, .env.example

2. docs(auth): document Google OAuth2 setup
   → docs/auth.md

3. [ask user if there are more changes to include]
```

**Step 4 — Write each commit message**
After the user confirms the split, produce each commit message with explanation (see Output Format).

Also suggest the **git staging commands** when helpful:
```bash
git add src/auth/oauth.ts src/auth/middleware.ts tests/auth/oauth.test.ts package.json .env.example
git commit -m "feat(auth): add Google OAuth2 login"

git add docs/auth.md
git commit -m "docs(auth): document Google OAuth2 setup"
```

#### Decomposition rules:
- **One logical change per commit** — a commit should answer "what AND why" without ambiguity
- **Never mix scopes** unless they are tightly coupled (e.g., a shared utility used by the feature)
- **Never mix types** in one commit (e.g., don't bundle `feat` + `fix` + `chore`)
- **Tests belong with their feature** — don't separate test files into their own commit unless they are standalone test infrastructure changes
- **Refactors before features** — if a refactor was needed to enable a feature, commit the refactor first
- If unsure about a file's group, **ask the user** rather than guessing

---

### 5. Generate Changelog from Commit History

When the user provides a list of commits (e.g., from `git log`):

1. Group commits by type
2. Format as a changelog with sections: **Features**, **Bug Fixes**, **Performance**, **Refactoring**, **Documentation**, **Other**
3. Highlight `BREAKING CHANGE` commits prominently at the top
4. Infer semantic version bump:
   - `BREAKING CHANGE` → **major** bump
   - `feat` → **minor** bump
   - `fix`, `perf`, others → **patch** bump
5. Format in [Keep a Changelog](https://keepachangelog.com/) style

---

## Output Format

Always provide **message + explanation** for generated or corrected commit messages:

```
**Commit message:**
feat(auth): add OAuth2 login with Google provider

Implements Google OAuth2 flow using the existing auth middleware.
Users can now sign in with their Google account in addition to
email/password. Stores OAuth tokens in the existing session table.

---
**Why this type and scope:**
- `feat` — this adds new user-facing login functionality
- `(auth)` — the change is scoped to the authentication module
- Body explains *what* was added and *why* (avoids duplicating the diff)
```

For **validation**, show:
```
**Issues found:**
1. Past tense "fixed" → use imperative "fix"
2. Header is 78 chars — trim to ≤72

**Corrected message:**
fix(payments): handle null card expiry in Stripe webhook
```

For **changelogs**, use markdown with dated headers and grouped sections.

---

## Tips & Edge Cases

- **Multiple concerns in one diff**: suggest splitting into multiple commits, then offer messages for each
- **WIP/draft commits**: note that they don't follow conventional commits and offer to clean them up
- **Merge commits**: these typically don't need conventional format — mention this
- **Breaking changes**: always add `BREAKING CHANGE:` footer AND optionally `!` after type (e.g., `feat!:`)
- **No scope needed**: if the change is truly global or affects the whole project, omit scope
- **Custom types**: if the user mentions a type you don't recognize, ask if it's a project convention before flagging it as invalid
