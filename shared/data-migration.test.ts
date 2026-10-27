import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { migrateDataDir } from "./data-migration.ts";

describe("shared/data-migration", () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = join(tmpdir(), `mybot-migration-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tempHome, { recursive: true });
  });

  afterEach(() => {
    try {
      rmSync(tempHome, { recursive: true, force: true });
    } catch {
    }
  });

  it("migrates from legacy ~/.openmausbot to ~/.mybot without deleting the old directory", () => {
    const legacyDir = join(tempHome, ".openmausbot");
    const targetDir = join(tempHome, ".mybot");

    mkdirSync(join(legacyDir, "events"), { recursive: true });
    writeFileSync(join(legacyDir, "config.json"), JSON.stringify({ version: "1.0", test: true }));
    writeFileSync(join(legacyDir, "events", "sample.json"), "{\"event\":1}");

    const result = migrateDataDir(tempHome, ".mybot", ".openmausbot");

    expect(result.migrated).toBe(true);
    expect(result.from).toBe(legacyDir);
    expect(result.to).toBe(targetDir);

    // Verify files copied to target
    expect(existsSync(join(targetDir, "config.json"))).toBe(true);
    expect(JSON.parse(readFileSync(join(targetDir, "config.json"), "utf8"))).toEqual({ version: "1.0", test: true });
    expect(existsSync(join(targetDir, "events", "sample.json"))).toBe(true);

    // Verify source directory STILL EXISTS (never deleted)
    expect(existsSync(legacyDir)).toBe(true);
    expect(existsSync(join(legacyDir, "config.json"))).toBe(true);
  });

  it("does not migrate if target directory already exists", () => {
    const legacyDir = join(tempHome, ".openmausbot");
    const targetDir = join(tempHome, ".mybot");

    mkdirSync(legacyDir, { recursive: true });
    mkdirSync(targetDir, { recursive: true });
    writeFileSync(join(legacyDir, "config.json"), "legacy");
    writeFileSync(join(targetDir, "config.json"), "existing");

    const result = migrateDataDir(tempHome, ".mybot", ".openmausbot");

    expect(result.migrated).toBe(false);
    expect(readFileSync(join(targetDir, "config.json"), "utf8")).toBe("existing");
  });

  it("does not migrate if legacy directory does not exist", () => {
    const result = migrateDataDir(tempHome, ".mybot", ".openmausbot");
    expect(result.migrated).toBe(false);
  });
});
