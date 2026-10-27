// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { analyticsEnabled, initAnalytics, track } from "./analytics";

describe("analytics wire safety in MyBot", () => {
  it("never sends requests over the network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(analyticsEnabled()).toBe(false);
    await initAnalytics();
    track("test_event");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
