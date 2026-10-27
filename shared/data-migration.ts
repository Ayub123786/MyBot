import { cpSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DATA_DIR_NAME, LEGACY_DATA_DIR_NAME } from "./brand.ts";

export interface MigrationResult {
  migrated: boolean;
  from?: string;
  to?: string;
  error?: string;
}

/**
 * Performs a one-time copy migration from the legacy data directory (~/.openmausbot)
 * to the new data directory (~/.mybot). The old directory is preserved and never deleted.
 */
export function migrateDataDir(
  home: string = homedir(),
  targetName: string = DATA_DIR_NAME,
  sourceName: string = LEGACY_DATA_DIR_NAME
): MigrationResult {
  const targetDir = join(home, targetName);
  const sourceDir = join(home, sourceName);

  if (!existsSync(targetDir) && existsSync(sourceDir)) {
    try {
      cpSync(sourceDir, targetDir, { recursive: true });
      return { migrated: true, from: sourceDir, to: targetDir };
    } catch (err) {
      return {
        migrated: false,
        from: sourceDir,
        to: targetDir,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return { migrated: false };
}
