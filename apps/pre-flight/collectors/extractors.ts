// The one table that turns a snapshot into the knowledge base's collected facts.
// With src/checklists.ts, the only place in the app that names a fact.
// Meanings follow apps/pre-flight/kb (the fact's ask text and open-questions.md).
import type { FactValue } from "@dead-certain/engine";
import { ignores } from "./gitignore";
import type { RepoSnapshot } from "./types";

export interface Extractor {
	/** "tree": the value depends on the whole file tree, so a truncated tree makes it unseen. */
	readonly reads: "metadata" | "tree" | "gitignore" | "readme";
	/** The value and one evidence line, or undefined when the snapshot cannot say. */
	readonly read: (
		s: RepoSnapshot,
	) => { value: FactValue; evidence: string } | undefined;
}

const LICENSE_FILES = [
	"LICENSE",
	"LICENSE.md",
	"LICENSE.txt",
	"COPYING",
	"COPYING.md",
];
/** The six ignoring lines of clause 2.2 (open question 4). */
const KIRO_LINES = [
	".kiro",
	".kiro/",
	"/.kiro",
	"/.kiro/",
	".kiro/*",
	".kiro/**",
];
const RUN_HEADINGS = [
	"getting started",
	"install",
	"installation",
	"run",
	"running",
	"usage",
	"quick start",
];

const blobs = (s: RepoSnapshot) =>
	s.tree.entries.filter((e) => e.type === "blob").map((e) => e.path);
const appDirs = (s: RepoSnapshot) =>
	s.tree.entries
		.filter((e) => e.type === "tree" && /^apps\/[^/]+$/.test(e.path))
		.map((e) => e.path);
const list = (items: readonly string[]) => items.join(", ");

/** Heading texts of a Markdown or reStructuredText README: ATX lines and underlined lines. */
function headings(text: string): string[] {
	const lines = text.split(/\r?\n/);
	const out: string[] = [];
	lines.forEach((line, i) => {
		const atx = /^ {0,3}#{1,6}[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/.exec(line);
		if (atx?.[1] !== undefined) out.push(atx[1]);
		const next = lines[i + 1];
		if (
			line.trim() !== "" &&
			!/^ {4}/.test(line) &&
			next !== undefined &&
			/^ {0,3}([=\-~^*])\1*[ \t]*$/.test(next)
		)
			out.push(line.trim());
	});
	return out;
}

export const EXTRACTORS: Readonly<Record<string, Extractor>> = {
	repo_private: {
		reads: "metadata",
		read: (s) => ({
			value: s.metadata.private,
			evidence: `GitHub reports the repository as ${s.metadata.private ? "private" : "public"}`,
		}),
	},
	// Open question 1, answered app-side: detected unless GitHub reports none or NOASSERTION.
	license_detected: {
		reads: "metadata",
		read: (s) => {
			const id = s.metadata.license?.spdxId ?? null;
			if (id === null)
				return { value: false, evidence: "GitHub detects no licence" };
			if (id === "NOASSERTION")
				return {
					value: false,
					evidence:
						"GitHub finds a licence file but cannot name the licence (NOASSERTION)",
				};
			return { value: true, evidence: `GitHub detects the ${id} licence` };
		},
	},
	repo_archived: {
		reads: "metadata",
		read: (s) => ({
			value: s.metadata.archived,
			evidence: s.metadata.archived
				? "GitHub reports the repository as archived"
				: "GitHub reports the repository as not archived",
		}),
	},
	license_file_at_root: {
		reads: "tree",
		read: (s) => {
			const found = blobs(s).find((p) => LICENSE_FILES.includes(p));
			return found === undefined
				? {
						value: false,
						evidence: `None of ${list(LICENSE_FILES)} is at the root`,
					}
				: { value: true, evidence: `${found} is at the root` };
		},
	},
	// Open question 3, answered app-side: a file anywhere under .kiro counts.
	kiro_dir_has_file: {
		reads: "tree",
		read: (s) => {
			const n = blobs(s).filter((p) => p.startsWith(".kiro/")).length;
			const isDir = s.tree.entries.some(
				(e) => e.path === ".kiro" && e.type === "tree",
			);
			if (n > 0)
				return {
					value: true,
					evidence: `.kiro holds ${n} ${n === 1 ? "file" : "files"}`,
				};
			return {
				value: false,
				evidence: isDir
					? ".kiro holds no file"
					: "There is no .kiro directory at the root",
			};
		},
	},
	kiro_spec_with_tasks: {
		reads: "tree",
		read: (s) => {
			const found = blobs(s).find((p) =>
				/^\.kiro\/specs\/[^/]+\/tasks\.md$/.test(p),
			);
			return found === undefined
				? {
						value: false,
						evidence: "No .kiro/specs/<spec>/tasks.md in the repository",
					}
				: { value: true, evidence: `${found} is in the repository` };
		},
	},
	apps_dir_count: {
		reads: "tree",
		read: (s) => {
			const dirs = appDirs(s);
			return {
				value: dirs.length,
				evidence:
					dirs.length === 0
						? "There is no apps directory with folders in it"
						: `apps holds ${dirs.length}: ${list(dirs)}`,
			};
		},
	},
	apps_with_package_json: {
		reads: "tree",
		read: (s) => {
			const files = new Set(blobs(s));
			const dirs = appDirs(s);
			const missing = dirs.filter((d) => !files.has(`${d}/package.json`));
			const n = dirs.length - missing.length;
			return {
				value: n,
				evidence:
					missing.length === 0
						? `${n} of ${dirs.length} app directories have a package.json`
						: `${n} of ${dirs.length} app directories have a package.json; missing in ${list(missing)}`,
			};
		},
	},
	// Clause 2.2 counts only the six lines and does not handle negation (open
	// question 4). Where git's own reading disagrees, the fact is asked.
	gitignore_ignores_kiro: {
		reads: "gitignore",
		read: (s) => {
			if (s.gitignore === null)
				return { value: false, evidence: "There is no .gitignore at the root" };
			const lines = s.gitignore.text
				.split("\n")
				.map((l) => l.replace(/\r$/, "").replace(/ +$/, ""));
			let at = -1;
			lines.forEach((l, i) => {
				if (KIRO_LINES.includes(l)) at = i;
			});
			const dir = ignores(s.gitignore.text, ".kiro/");
			const inside = ignores(s.gitignore.text, ".kiro/x");
			if ("unsupported" in dir || "unsupported" in inside) return undefined;
			const gitSays = dir.ignored || inside.ignored;
			if (gitSays !== at >= 0) return undefined;
			if (at < 0) {
				if (s.gitignore.clipped) return undefined;
				return {
					value: false,
					evidence: ".gitignore has no line that ignores .kiro",
				};
			}
			return {
				value: true,
				evidence: `.gitignore line ${at + 1}: ${lines[at]}`,
			};
		},
	},
	// Open questions 6 and 7: a whole-heading match in whatever file GitHub calls the README.
	readme_has_run_heading: {
		reads: "readme",
		read: (s) => {
			if (s.readme === null)
				return { value: false, evidence: "There is no README at the root" };
			const found = headings(s.readme.text).find((h) =>
				RUN_HEADINGS.includes(h.trim().toLowerCase()),
			);
			if (found !== undefined)
				return {
					value: true,
					evidence: `${s.readme.name} has the heading "${found}"`,
				};
			if (s.readme.clipped) return undefined;
			return {
				value: false,
				evidence: `${s.readme.name} has no heading called Getting started, Install, Installation, Run, Running, Usage or Quick start`,
			};
		},
	},
};
