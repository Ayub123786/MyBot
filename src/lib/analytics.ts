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
    return localStorage.getItem(OPT_OUT_KEY) === "0";
  } catch {
    return false;
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

export function initAnalytics(): Promise<void> {
  // PostHog and upstream telemetry removed.
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

export function track(_event: string, _props?: Record<string, unknown>) {
  // No-op: zero telemetry leaves the machine.
}

export function identifyEmail(_email: string, { submitted: _submitted = true }: { submitted?: boolean } = {}) {
  // No-op: email is never sent to upstream analytics.
}

const GATE_KEY = "omb-email-gate";
export function emailGateDone(): boolean {
  return Boolean(localStorage.getItem(GATE_KEY));
}
export function setEmailGateDone(status: "submitted" | "skipped") {
  localStorage.setItem(GATE_KEY, status);
}
