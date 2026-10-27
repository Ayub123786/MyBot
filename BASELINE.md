# Baseline Status (Phase 0)

Date: 2026-10-28
Branch: `feat/rebrand-mybot`
Target OS: Windows (x64)

## Baseline Typecheck
Command: `pnpm typecheck` (`tsc -b && tsc -p tsconfig.server.json`)
Result: **PASSED (exit code 0)**

## Baseline Tests
Command: `pnpm vitest run shared/`
Result: **PASSED (all suites passed)**
Full Test Suite: Repo contains 1671 test suites across server, electron, shared, and client. Full Vitest execution (`pnpm vitest run`) without sharding on Windows runs all integration/e2e tests sequentially and takes significant runtime. Long-running or process-spawning server tests (such as `server/index.test.ts` with 300+ subtests and `server/hosted-access.test.ts`) require isolation or specific flags. Pre-existing warnings:
- Vitest deprecation warning on `vitest/runners`.
- Existing tests that depend on `enterprise/server/workspace-access.ts` (`server/hosted-access.test.ts`) are scheduled for deletion as part of enterprise removal.
