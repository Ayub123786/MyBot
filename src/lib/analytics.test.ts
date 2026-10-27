import { beforeEach, describe, expect, it } from "vitest";
import { analyticsEnabled, initAnalytics, optAction, setAnalyticsEnabled, track, identifyEmail } from "./analytics";

describe("analytics in MyBot", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("is disabled by default", () => {
    expect(analyticsEnabled()).toBe(false);
  });

  it("initAnalytics resolves cleanly as a no-op", async () => {
    await expect(initAnalytics()).resolves.toBeUndefined();
  });

  it("handles optAction transitions", () => {
    expect(optAction(false, false)).toBe("none");
    expect(optAction(false, true)).toBe("opt-out");
    expect(optAction(true, false)).toBe("init");
    expect(optAction(true, true)).toBe("opt-in");
  });

  it("track and identifyEmail execute safely without network errors", () => {
    expect(() => track("test_event", { foo: "bar" })).not.toThrow();
    expect(() => identifyEmail("test@example.com")).not.toThrow();
  });

  it("allows setting analytics state if user configures it", () => {
    setAnalyticsEnabled(true);
    expect(analyticsEnabled()).toBe(true);
    setAnalyticsEnabled(false);
    expect(analyticsEnabled()).toBe(false);
  });
});
