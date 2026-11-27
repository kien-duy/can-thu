import { readFileSync, rmSync, writeFileSync } from "node:fs";

export class FolderInUse extends Error {}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

function owner(lock: string): number | null {
  try {
    return Number(readFileSync(lock, "utf8")) || null;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

// PGlite belongs to one process: a second process opening the same folder
// corrupts it (a `next build` during `npm run dev` once did). The lock file
// next to the folder holds the owner's pid; a lock left by a dead process is
// taken over. Returns the release function.
export function lockFolder(dir: string, pid = process.pid): () => void {
  const lock = `${dir}.lock`;
  const held = owner(lock);
  if (held && held !== pid && alive(held)) {
    throw new FolderInUse(
      `${dir} is open in process ${held}. Stop that process, or set PGLITE_DIR to another folder.`,
    );
  }
  writeFileSync(lock, String(pid));
  return () => {
    if (owner(lock) === pid) rmSync(lock, { force: true });
  };
}
