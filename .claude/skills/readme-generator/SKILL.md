---
name: readme-generator
description: Generate and update professional, developer-focused README.md files for full-stack repositories. Use this skill whenever the user asks to create, update, regenerate, or improve a README, write documentation for a project, or when the codebase has changed and the README needs to reflect new features, dependencies, or structure. Also trigger when the user says the README is outdated, missing info, or incomplete. This skill should be used proactively when invoked via hooks after code changes — don't wait to be asked explicitly if context makes it clear.
---

# README Generator

You are a senior software engineer writing documentation for developers who will use or contribute to this repository. Your task is to generate a clean, professional, developer-focused `README.md`.

## Step 1 — Gather Context Before Writing

Before writing anything, always read in this order:

1. **`spec.md`** — Extract: requirements, feature descriptions, architecture decisions , constraints.
2. **`roadmap.md`** — Extract: planned features, known issues.
3. **Project structure** — run `find . -maxdepth 3 -not -path '*/node_modules/*' -not -path '*/.git/*'` to understand the layout.
4. **`package.json` / `requirements.txt` ** etc. — extract real dependency names and versions.
5. **`.env.example`** — if it exists. Use it as the source of truth for environment variables.
6. **Existing `README.md`** — if updating, preserve accurate sections, only change what's outdated or missing.

> If `spec.md` or `roadmap.md` don't exist, infer from the codebase structure and file contents. Do not leave sections empty — make a reasonable inference and note it with a `<!-- inferred -->` comment if uncertain.

---

## Step 2 — Infer Missing Details

When information is not explicitly documented:
- Check folder names and file contents to infer feature areas
- Check `package.json` scripts to infer how the app is run
- Check migration files or schema files for DB structure
- Check Docker or CI config for deployment approach
- **Never fabricate** specific values (ports, URLs, secrets) — use placeholders like `<your-value>`

---

## Step 3 — Write the README

Use `references/structure.md` as a **starting blueprint, not a rigid template**. Adapt it to what the project actually is:

- **Add sections** that the project needs (e.g. WebSocket events, CLI usage, multi-tenancy, feature flags)
- **Remove or merge sections** that don't apply (e.g. no Redis? drop that section. Simple CRUD with no architecture complexity? skip the architecture diagram)
- **Rename sections** to match the project's domain and vocabulary
- **Reorder** if a different flow makes more sense for onboarding on this specific project
- **Adjust depth** — a monorepo with 5 services needs more structure detail than a simple API

> The blueprint exists to prevent you from forgetting important sections, not to force every README into the same shape. A good README reflects the actual project — use your judgment.

Core writing rules (non-negotiable):
- **Concise and technical** — no marketing language, no fluff
- **Bullet points over paragraphs** — keep prose minimal
- **Code blocks for all commands** — use correct syntax highlighting (```bash, ```env, etc.)
- **Developer onboarding lens** — assume the reader is joining the project today
- **Real values when known** — use actual package names, actual folder names, actual scripts

---

## Step 4 — Output

Write the complete `README.md` to the root of the repository.

If called from a hook (automated context), only rewrite sections that are stale:
- New features → update Overview + Project Structure + API Overview
- Dependency changes → update Tech Stack + Prerequisites + Installation
- Missing docs inferred → update relevant sections and add `<!-- auto-updated -->` comment at top

---

## Reference Files

- `references/structure.md` — Full README section structure with instructions per section. **Read this before writing.**
