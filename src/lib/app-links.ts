import { APP_NAME as BRAND_APP_NAME, ATTRIBUTION as BRAND_ATTRIBUTION } from "../../shared/brand.ts";

export const APP_NAME = BRAND_APP_NAME;
export const ATTRIBUTION = BRAND_ATTRIBUTION;
export const APP_REPOSITORY = "https://github.com/Ayub123786/MyBot";
export const DOCS_URL = `${APP_REPOSITORY}/tree/main/docs`;
export const HELP_CENTER_URL = DOCS_URL;
export const APPROVAL_LEVELS_URL = `${APP_REPOSITORY}/blob/main/docs/approval-levels.md`;
export const PASSKEY_HELP_URL = DOCS_URL;
export const FEEDBACK_URL = `${APP_REPOSITORY}/issues`;
export const RELEASES_URL = `${APP_REPOSITORY}/releases`;
export const PRICING_URL = `${APP_REPOSITORY}`;
export function withSource(url: string, source: string): string {
  const target = new URL(url);
  target.searchParams.set("src", source);
  return target.href;
}
export const LICENSE_URL = `${APP_REPOSITORY}/blob/main/LICENSE`;
export const IOS_APP_STORE_URL = "https://apps.apple.com/in/app/mausbot/id6803387923";
export const ANDROID_APK_URL = `${APP_REPOSITORY}/releases/download/android-v1.5.0/OpenMausBot.apk`;

export function appVersion(): string {
  return typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";
}

const PLATFORM_NAMES: Record<string, string> = {
  darwin: "macOS",
  win32: "Windows",
  linux: "Linux",
};

export function platformLabel(platform?: string): string | null {
  return (platform && PLATFORM_NAMES[platform]) ?? null;
}

export async function openExternalLink(url: string): Promise<void> {
  if (window.ogb?.openExternal) {
    await window.ogb.openExternal(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
