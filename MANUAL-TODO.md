# Manual To-Do & Future Asset Checklist (MANUAL-TODO.md)

This document tracks items that require external resources, credentials, or custom binary design assets.

## 1. Binary Icon & Logo Replacements
The vector icons (`build/icon.svg` and `public/app-icon.svg`) have been updated with the neutral, professional MyBot geometric monogram. To produce official binary icon files, render and replace:

- [ ] `build/icon-1024.png` (1024x1024 master icon)
- [ ] `build/icon.ico` (multi-resolution Windows icon for NSIS installer and executable)
- [ ] `build/icon.icns` (macOS icon bundle, deferred/optional for Windows target)
- [ ] `build/icon.iconset/*` (individual macOS icon sizes)
- [ ] `public/app-icon-192.png` (192x192 web/PWA icon)
- [ ] `public/app-icon-512.png` (512x512 web/PWA icon)
- [ ] `public/apple-touch-icon.png` (180x180 iOS/Safari touch icon)

## 2. Code-Signing & Packaging (Windows)
- [ ] Obtain a Windows Code-Signing Certificate (EV or Standard) if distributing outside internal team.
- [ ] Configure `win.signtoolOptions` or `win.azureSignOptions` in `electron-builder.yml`.

## 3. Custom Domain & Self-Hosting
- [ ] Register your firm's domain (e.g. `mybot.yourfirm.internal`).
- [ ] Configure TLS / Reverse Proxy if exposing remote companion access over private network.

## 4. Third-Party API Keys to Obtain
- [ ] **AI Models**: Anthropic Claude API key, OpenAI API key, or Google Gemini API key.
- [ ] **Composio** (Optional): If enabling CRM / Google Drive / Slack connectors in Phase 4.
- [ ] **Web Search & Market Data** (Phase 4): Tavily API key or Exa API key; SEC EDGAR credentials.

## 5. In-App Update Server (Optional)
- [ ] Auto-update is currently turned OFF. If hosting your own private update releases later, configure an S3 / GitHub Releases / generic HTTPS update server and set `AUTO_UPDATE_ENABLED = true` in `electron/updater.mjs`.
