import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { z } from "zod";

const here = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = join(here, "..", "..", "data", "json", "crm");

export function crmPath(file: "accounts.json" | "contacts.json" | "sequences.json"): string {
  return join(DATA_DIR, file);
}

/** One write queue per file path, so concurrent PATCH requests to the same
    file serialize instead of racing on a read-modify-write. */
const queues = new Map<string, Promise<unknown>>();

function enqueue<T>(path: string, task: () => Promise<T>): Promise<T> {
  const prior = queues.get(path) ?? Promise.resolve();
  const next = prior.then(task, task);
  queues.set(path, next.catch(() => undefined));
  return next;
}

export async function readJson<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const raw = await readFile(path, "utf-8");
  return schema.parse(JSON.parse(raw));
}

/** Atomic write: write to a sibling temp file, then rename over the target,
    so a crash mid-write never leaves the JSON file truncated or corrupt. */
export async function writeJsonAtomic(path: string, data: unknown): Promise<void> {
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmp, `${JSON.stringify(data, null, 1)}\n`, "utf-8");
  await rename(tmp, path);
}

export function withFileLock<T>(path: string, task: () => Promise<T>): Promise<T> {
  return enqueue(path, task);
}
