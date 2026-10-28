import { DESKTOP_PORTS } from "../../electron/desktop-ports.mjs";

// Telemetry is disabled by default in MyBot. No requests leave the machine unless a custom endpoint is configured.
const OPT_OUT_KEY = "omb-analytics-opt-out";
const desktopSwitch = () => globalThis.window?.ogb?.desktopAnalytics;

export function analyticsChoiceKnown(): boolean {
  const desktop = desktopSwitch();
  return !desktop?.set || desktop.enabled() !== null || globalThis.location?.port === String(DESKTOP_PORTS[0]);
}

let choice: boolean | undefined;

export function analyticsEnabled(): boolean {
  if (choice !== undefined) return choice;
  const desktop = desktopSwitch()?.enabled();
  if (typeof desktop === "boolean") return desktop;
  try {
    return localStorage.getItem(OPT_OUT_KEY) !== "1";
  } catch {
    return true;
  }
}

export type OptAction = "init" | "opt-in" | "opt-out" | "none";
export function optAction(enabled: boolean, running: boolean): OptAction {
  if (!enabled) return running ? "opt-out" : "none";
  return running ? "opt-in" : "init";
}

export function setAnalyticsEnabled(enabled: boolean) {
  choice = enabled;
  void desktopSwitch()?.set?.(enabled).catch(() => {});
  try {
    localStorage.setItem(OPT_OUT_KEY, enabled ? "0" : "1");
  } catch {
  }
}

function keepStoredOptOut() {
  const desktop = desktopSwitch();
  if (!desktop?.set || desktop.enabled() !== null) return;
  try {
    if (localStorage.getItem(OPT_OUT_KEY) !== "1") return;
  } catch {
    return;
  }
  void desktop.set(false).catch(() => {});
}

export function initAnalytics(): Promise<void> {
  keepStoredOptOut();
  // Upstream telemetry removed.
  // Analytics remains inert unless a custom private endpoint is configured.
  return Promise.resolve();
}

export function locationProperty(_key: string): boolean {
  return false;
}

export function withoutLocation<T>(event: T): T {
  return event;
}

export function analyticsSurface(): "local" | "server" {
  return globalThis.window?.ogb?.environments ? "local" : "server";
}

type AnalyticsListener = (kind: "capture" | "identify", ...args: unknown[]) => void;
let testListener: AnalyticsListener | undefined;
export function setAnalyticsListenerForTest(fn?: AnalyticsListener) {
  testListener = fn;
}

export function track(event: string, props?: Record<string, unknown>) {
  if (!analyticsEnabled()) return;
  testListener?.("capture", event, props);
}

export function identifyEmail(email: string, { submitted = true }: { submitted?: boolean } = {}) {
  if (!analyticsEnabled()) return;
  testListener?.("identify", email, { email });
  if (submitted) testListener?.("capture", "email_submitted");
}

const GATE_KEY = "omb-email-gate";
export function emailGateDone(): boolean {
  return Boolean(localStorage.getItem(GATE_KEY));
}
export function setEmailGateDone(status: "submitted" | "skipped") {
  localStorage.setItem(GATE_KEY, status);
}
