/** A public GitHub repository, validated by parseTarget. */
export interface Target {
	readonly owner: string;
	readonly name: string;
}

/** What one collection read from GitHub (design: RepoSnapshot). */
export interface RepoSnapshot {
	readonly version: 1;
	readonly target: Target;
	/** ISO time from the injected clock. */
	readonly takenAt: string;
	readonly metadata: {
		readonly fullName: string;
		readonly defaultBranch: string;
		readonly private: boolean;
		readonly archived: boolean;
		readonly description: string | null;
		readonly license: { readonly spdxId: string | null } | null;
		readonly size: number;
		readonly pushedAt: string | null;
	};
	readonly tree: {
		readonly entries: readonly {
			readonly path: string;
			readonly type: "blob" | "tree";
		}[];
		readonly truncated: boolean;
		readonly empty: boolean;
	};
	/** null when the repository has no .gitignore at its root. */
	readonly gitignore: {
		readonly text: string;
		readonly clipped: boolean;
	} | null;
	readonly readme: {
		readonly text: string;
		readonly clipped: boolean;
		readonly name: string;
	} | null;
	/** From the last response's headers. */
	readonly rate?: { readonly remaining: number; readonly resetAt: number };
}
