// Writes a Plan, and undoes every write if one fails (requirements 2.6, 2.7).
import type { Plan } from "./plan.ts";

/** The file system, injected so the rollback can be tested at every write. Paths are repo-relative. */
export interface Fs {
	exists(path: string): boolean;
	/** Creates one directory; its parent exists. */
	mkdir(path: string): void;
	/** Writes a new file; fails if it exists. */
	writeNew(path: string, text: string): void;
	/** Replaces a shared file's text. */
	overwrite(path: string, text: string): void;
	removeFile(path: string): void;
	removeDir(path: string): void;
}

export type Applied = { ok: true } | { ok: false; message: string };

/** Creates each file (and any missing folder), then makes the shared-file edits. */
export function apply(plan: Plan, fs: Fs): Applied {
	const created: { kind: "dir" | "file"; path: string }[] = [];
	const edited: { path: string; before: string }[] = [];
	try {
		for (const f of plan.create) {
			if (fs.exists(f.path)) throw new Error(`${f.path} already exists.`);
			const parts = f.path.split("/");
			for (let i = 1; i < parts.length; i++) {
				const dir = parts.slice(0, i).join("/");
				if (!fs.exists(dir)) {
					fs.mkdir(dir);
					created.push({ kind: "dir", path: dir });
				}
			}
			fs.writeNew(f.path, f.text);
			created.push({ kind: "file", path: f.path });
		}
		for (const e of plan.edits) {
			// Recorded before the write, so a failed write is restored too.
			edited.push({ path: e.path, before: e.before });
			fs.overwrite(e.path, e.after);
		}
		return { ok: true };
	} catch (error) {
		for (const e of edited.reverse()) {
			try {
				fs.overwrite(e.path, e.before);
			} catch {
				// Reported below; the other restorations still run.
			}
		}
		for (const c of created.reverse()) {
			try {
				if (c.kind === "file") fs.removeFile(c.path);
				else fs.removeDir(c.path);
			} catch {
				// As above.
			}
		}
		return {
			ok: false,
			message: `Nothing was kept: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}
