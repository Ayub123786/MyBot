import { describe, expect, it } from "vitest";
import { APP_NAME, DATA_DIR_NAME, LEGACY_DATA_DIR_NAME, URL_SCHEME, ATTRIBUTION } from "./brand.ts";

describe("shared/brand", () => {
  it("exports expected MyBot brand tokens", () => {
    expect(APP_NAME).toBe("MyBot");
    expect(DATA_DIR_NAME).toBe(".mybot");
    expect(LEGACY_DATA_DIR_NAME).toBe(".openmausbot");
    expect(URL_SCHEME).toBe("mybot");
    expect(ATTRIBUTION).toBe("Based on OpenMausBot by Milind Soni (Apache-2.0)");
  });
});
