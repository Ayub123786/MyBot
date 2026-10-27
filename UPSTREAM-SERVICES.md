# Upstream Services Audit & Action Plan (UPSTREAM-SERVICES.md)

This audit catalogs every external and upstream-hosted URL, endpoint, or dependency found in the codebase, along with the action taken for each in MyBot.

| Upstream Service / URL | Found In | Purpose / Original Behavior | Action Taken in MyBot |
| :--- | :--- | :--- | :--- |
| `https://us.i.posthog.com` + Token `phc_m2hP39w8y2...` | `src/lib/analytics.ts`, `src/lib/analytics.test.ts` | Product analytics & usage event telemetry | **Removed token & endpoint.** Telemetry defaults to OFF (`analyticsEnabled() === false`); all calls are no-ops unless custom self-hosted endpoint is provided. |
| `https://accounts.openmausbot.com` | `electron/companion-account-service.mjs`, `server/highlevel/relay.ts` | Remote companion tunnel control plane and GoHighLevel OAuth relay | **Disabled default upstream contact.** Replaced with empty default/self-hosted configuration via env vars. Outbound requests disabled. |
| `https://cloud.openmausbot.com` & `https://omb-cloud-staging.fly.dev` | `electron/cloud-account.mjs`, `electron/cloud-home.mjs` | Upstream cloud account status, subscription tiers, trial grants, wake calls | **Disabled.** Set cloud origin check to reject upstream and return offline/local status. No automated background polling. |
| `https://checkout.dodopayments.com` | `electron/cloud-account.mjs` | Checkout URL for purchasing cloud subscriptions | **Disabled.** Checkout links disabled/hidden. |
| GitHub Releases (`milind-soni/OpenMausBot`) | `electron-builder.yml`, `electron/updater.mjs` | In-app auto-update checks and binary download | **Disabled.** Auto-updater turned off in `electron/updater.mjs`; GitHub publish provider removed from `electron-builder.yml`. |
| `https://docs.openmausbot.com`, `https://www.openmausbot.com` | `src/lib/app-links.ts`, `README.md` | Documentation, passkey troubleshooting, pricing | **Replaced.** Removed links to external commercial site; replaced with local anchors or project repository links. |
| `https://admin.openmausbot.com` | `src/lib/onboarding.ts` | Default hosted workspace admin origin | **Removed default.** Set to empty / self-hosted only. |
| `https://c-*.openmausbot.com` | `electron/desktop-companion-client.mjs`, `electron/environments.mjs` | Default hostnames for managed companion tunnels | **Generalized.** Removed hardcoded assumption of upstream suffix. |
| GitHub Sponsors & Sponsor Links | `src/components/`, `README.md` | Upstream donation and sponsor promotion | **Removed.** Deleted sponsor UI components and links. |
