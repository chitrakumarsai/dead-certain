// Test-only: an in-memory file system that can fail its nth write.
import type { Fs } from "./apply.ts";

export class MemoryFs implements Fs {
	files = new Map<string, string>();
	dirs = new Set<string>([""]);
	writes = 0;
	constructor(
		seed: Record<string, string> = {},
		private failAt = Number.POSITIVE_INFINITY,
	) {
		for (const [p, t] of Object.entries(seed)) {
			this.files.set(p, t);
			const parts = p.split("/");
			for (let i = 1; i < parts.length; i++)
				this.dirs.add(parts.slice(0, i).join("/"));
		}
	}
	private tick() {
		if (++this.writes === this.failAt)
			throw new Error(`write ${this.writes} failed`);
	}
	exists(p: string) {
		return this.files.has(p) || this.dirs.has(p);
	}
	mkdir(p: string) {
		this.tick();
		this.dirs.add(p);
	}
	writeNew(p: string, text: string) {
		if (this.exists(p)) throw new Error(`${p} exists`);
		this.tick();
		this.files.set(p, text);
	}
	overwrite(p: string, text: string) {
		this.tick();
		this.files.set(p, text);
	}
	removeFile(p: string) {
		this.files.delete(p);
	}
	removeDir(p: string) {
		this.dirs.delete(p);
	}
	snapshot() {
		return { files: new Map(this.files), dirs: new Set(this.dirs) };
	}
}
