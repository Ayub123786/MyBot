# Architecture & Implementation Decisions (DECISIONS.md)

This log records non-trivial decisions made during the MyBot transformation, rationale, and alternatives considered.

---

### Decision 1: Windows-Only Focus for Initial Phases
- **Decision**: Focus development and testing strictly on Windows. Skip macOS speech helper compilation (`build:speech`), notarization, and macOS code signing.
- **Why**: Windows is the target runtime environment for this deployment. macOS build steps require Swift/Xcode toolchains not present on Windows.
- **Alternatives**: Attempt cross-compilation or mock Darwin tools; rejected as fragile and unnecessary.

---

### Decision 2: Brand Constants Centralization (`shared/brand.ts`)
- **Decision**: Create `shared/brand.ts` exporting:
  - `APP_NAME = "MyBot"`
  - `DATA_DIR_NAME = ".mybot"`
  - `LEGACY_DATA_DIR_NAME = ".openmausbot"`
  - `URL_SCHEME = "mybot"`
  - `ATTRIBUTION = "Based on OpenMausBot by Milind Soni (Apache-2.0)"`
- **Why**: Eliminates hardcoded strings across electron, server, and client; provides single point of control.
- **Alternatives**: Multiple configs across packages; rejected to maintain DRY code.

---

### Decision 3: Deferred Environment Variable and Wire Format Changes
- **Decision**: Keep `OMB_` environment variable prefixes and `openmaus.package` wire format unchanged for now.
- **Why**: Changing internal protocol wire headers and dozens of runtime environment flags immediately increases risk of subtle integration breakage.
- **Alternatives**: Mass find-and-replace to `MYBOT_`; deferred to a later dedicated release phase.

---

### Decision 4: Total Removal of PostHog Telemetry
- **Decision**: Remove PostHog public key and `https://us.i.posthog.com` endpoint. Set default telemetry status to opted-out/disabled (`analyticsEnabled() === false`). Make analytics functions safe no-ops unless a custom self-hosted endpoint is explicitly configured.
- **Why**: Investment and due diligence workflows require strict confidentiality; zero telemetry may leave the machine without user consent.
- **Alternatives**: Leave token but disable flag; rejected because hardcoded keys could be triggered accidentally.

---

### Decision 5: Auto-Update Turned Off
- **Decision**: Make `startUpdater()` in `electron/updater.mjs` a safe no-op that leaves status at `"idle"` without scheduling polling timers. Remove the upstream `milind-soni/OpenMausBot` GitHub publish target from `electron-builder.yml`.
- **Why**: Prevents desktop instances from fetching or prompting updates from the upstream open-source project.
- **Alternatives**: Point to non-existent server; rejected as it generates error logs.

---

### Decision 6: Complete Deletion of `enterprise/` Folder
- **Decision**: Permanently delete the `enterprise/` folder and clean up any imports or tests that exclusively target enterprise licensing or enterprise-hosted relays (`server/hosted-access.test.ts`).
- **Why**: User explicitly requested deletion of enterprise licensing code and strict Apache-2.0 open-source purity.
- **Alternatives**: Stubbing enterprise mocks; rejected per global rule: "Delete tests that only test enterprise or hosted features; do not fake them with mocks."

---

### Decision 7: Data Directory Migration Shim
- **Decision**: Implement a one-time copy migration on startup in `electron/main.mjs` and server initialization: if `~/.mybot` does not exist and `~/.openmausbot` exists, copy contents recursively without deleting the legacy directory.
- **Why**: Ensures backward compatibility for existing users while guaranteeing zero data loss.
- **Alternatives**: Renaming/moving the directory; rejected because moving could break previous installations or rollback scenarios.
