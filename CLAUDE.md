# web-vitals-monitor

## Rules

- Run `pnpm check` from the root before saying a task is done.
- Do not add dependencies without asking. Versions used by more than one package go in the pnpm catalog as "catalog:".
- For changes across several files, propose a plan and wait for approval before writing code.
- Do not change event schema fields, limits or metric thresholds in @rum/shared without asking.
- Before changing apps/web, read apps/web/AGENTS.md.

## apps/api (NestJS)

- Validation uses Zod schemas from @rum/shared. Do not use class-validator or class-transformer.
- Register global guards, pipes, filters and interceptors as APP_* providers, not app.useGlobal*.
- Never use `import type` for a class injected through DI: it removes the runtime reference and breaks DI.
- Read configuration through ConfigService, never process.env.
- Abstractions: <abstract classes used as tokens | interfaces with Symbol tokens and @Inject>.
