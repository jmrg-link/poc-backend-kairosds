# express-clean-scaffold

Scaffolding **without source code**. Each folder ships a `CLAUDE.md` that describes
what to generate there, plus a `rules/` directory with one `.md` per third-party
library acting as the **single source of truth** for current API and idioms.

A code-generation loop (Claude Code with `/loop`) walks the tree, reads the
`CLAUDE.md` at each level and the referenced `rules/*.md`, and emits the actual
TypeScript files.

## How the loop is expected to work

1. Read root `CLAUDE.md` (architecture overview + global conventions).
2. For every folder, read its `CLAUDE.md`. It declares:
   - what file(s) to generate,
   - which `rules/*.md` apply (library APIs to respect),
   - patterns (Template Method, CQRS, Composition, Chain of Responsibility, etc.),
   - error labels and log labels emitted.
3. The loop generates code that conforms to those rules.
4. When a library version changes, only the matching `rules/*.md` is updated;
   re-running the loop regenerates idiomatic code at the new version.

## Stack pinned by this scaffold (April 2026 baseline)

| Concern         | Library                | Version |
| --------------- | ---------------------- | ------- |
| HTTP            | express                | ^5.x    |
| Security        | helmet                 | ^8.x    |
| CORS            | cors                   | ^2.8.x  |
| Body parsing    | body-parser            | ^1.20.x |
| HTTP logging    | morgan                 | ^1.10.x |
| Rate limiting   | express-rate-limit     | ^7.x    |
| Database        | mongoose               | ^8.x    |
| Validation      | zod                    | ^4.x    |
| JWT             | jose                   | ^5.x    |
| Password hash   | argon2                 | ^0.41.x |
| Symmetric crypto| crypto-js              | ^4.2.x  |
| Logger          | winston + winston-loki | ^3.x / ^6.x |
| Env loader      | dotenv                 | ^16.x   |
| Env scripts     | cross-env              | ^7.x    |
| DI container    | tsyringe + reflect-metadata | ^4.x |
| Tests           | vitest                 | ^2.x    |
| Runtime         | tsx                    | ^4.x    |
| Compiler        | typescript             | ^5.7+   |

> Versions reflect the latest stable as of the date this scaffold was
> generated. Before the loop generates code, run `npm view <pkg> version`
> for each entry and update `rules/*.md` if a major has shipped.

## Repository layout

```
.
├── README.md              ← this file
├── CLAUDE.md              ← root rules: architecture, conventions, defaults
├── package.json           ← deps pinned, scripts (dev/build/test/lint)
├── tsconfig.json          ← strict + decorators ON + paths
├── .env.example
├── .gitignore
├── rules/                 ← per-library rules (loop reads these)
│   ├── README.md
│   └── <lib>.md
└── src/
    ├── CLAUDE.md          ← entry: main.ts spec
    ├── domain/            ← entities, DTOs, errors, shared abstractions
    ├── application/       ← ports + adapters (email, etc.)
    ├── infrastructure/    ← Mongo connection + Mongoose models
    ├── config/            ← envs, logger, helpers (hash/jwt/crypto)
    └── presentation/      ← features (auth, user, blog, projects) + bootstrap
```

## Getting started (after the loop generates code)

```bash
npm install
cp .env.example .env       # fill JWT_SECRET, MONGO_URL, LOKI_HOST...
npm run dev
```
