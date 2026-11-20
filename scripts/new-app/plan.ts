// The whole scaffold, worked out before anything is written (design: The Plan). Pure.
import { insertAtMarker, type MarkerName, nextPort } from "./markers.ts";
import { validateName } from "./name.ts";
import { substitute } from "./substitute.ts";

export interface Inputs {
	/** Paths relative to templates/app. */
	templateFiles: readonly { path: string; text: string }[];
	playwright: string;
	ci: string;
	/** Folder names under apps/. */
	existingApps: readonly string[];
	/** Workspace package names. */
	packageNames: readonly string[];
}

export type SharedPath = "playwright.config.ts" | ".github/workflows/ci.yml";

export interface Plan {
	name: string;
	title: string;
	slugConst: string;
	port: number;
	url: string;
	/** Repo-relative; the applier refuses to overwrite. */
	create: { path: string; text: string }[];
	edits: {
		path: SharedPath;
		before: string;
		after: string;
		inserted: string[];
	}[];
}

export type Refusal = {
	code: "BAD_NAME" | "RESERVED" | "EXISTS" | "MARKER" | "PATH";
	message: string;
};

/** templates/app/e2e/smoke.spec.ts goes to e2e/<name>-smoke.spec.ts; everything else to apps/<name>/ (3.2). */
function targetOf(path: string, name: string): string | null {
	if (
		path.startsWith("/") ||
		path.split("/").some((p) => p === ".." || p === "." || p === "")
	)
		return null;
	if (path === "e2e/smoke.spec.ts") return `e2e/${name}-smoke.spec.ts`;
	if (path.startsWith("e2e/")) return null;
	return `apps/${name}/${path}`;
}

/** Inserts each [marker, lines] in order, or names the marker that failed. */
function edit(
	text: string,
	inserts: readonly [MarkerName, string[]][],
): { text: string } | Refusal {
	let out = text;
	for (const [marker, lines] of inserts) {
		const r = insertAtMarker(out, marker, lines);
		if (!r.ok) return { code: "MARKER", message: r.message };
		out = r.text;
	}
	return { text: out };
}

export function planFor(inputs: Inputs, name: string): Plan | Refusal {
	const checked = validateName(name, inputs.existingApps);
	if (!checked.ok) return { code: checked.code, message: checked.message };
	const { title, slugConst } = checked;
	if (inputs.packageNames.includes(`@dead-certain/${name}`))
		return {
			code: "EXISTS",
			message: `A package named @dead-certain/${name} already exists.`,
		};
	const port = nextPort(inputs.playwright);
	const url = `http://localhost:${port}/dead-certain/${name}/`;
	for (const [path, text] of [
		["playwright.config.ts", inputs.playwright],
		[".github/workflows/ci.yml", inputs.ci],
	] as const)
		if (
			text.includes(`apps/${name}`) ||
			text.includes(`/dead-certain/${name}/`) ||
			text.includes(`${slugConst}_URL`)
		)
			return { code: "EXISTS", message: `${path} already mentions ${name}.` };

	const values = {
		NAME: name,
		TITLE: title,
		SLUG_CONST: slugConst,
		PORT: String(port),
	};
	const create: Plan["create"] = [];
	for (const file of inputs.templateFiles) {
		const target = targetOf(file.path, name);
		if (target === null)
			return {
				code: "PATH",
				message: `The template file ${file.path} would land outside apps/${name}/ and e2e/.`,
			};
		const r = substitute(file.text, values);
		if (!r.ok)
			return {
				code: "PATH",
				message: `The template file ${file.path} holds an unknown placeholder ${r.token}.`,
			};
		create.push({ path: target, text: r.text });
	}

	const urlLines = [
		`/** ${title} is served on its own port. */`,
		`export const ${slugConst}_URL = "${url}";`,
	];
	const serverLines = [
		"{",
		"\tcommand:",
		`\t\t"pnpm --filter @dead-certain/${name} build && pnpm --filter @dead-certain/${name} preview --port ${port} --strictPort",`,
		`\turl: ${slugConst}_URL,`,
		"\treuseExistingServer: true,",
		"},",
	];
	const pw = edit(inputs.playwright, [
		["urls", urlLines],
		["servers", serverLines],
	]);
	if ("code" in pw) return pw;
	const dcLine = [`- run: pnpm dc build apps/${name}`];
	const cpLine = [`- run: cp -R apps/${name}/dist apps/site/dist/${name}`];
	const ci = edit(inputs.ci, [
		["dc-build", dcLine],
		["copy", cpLine],
	]);
	if ("code" in ci) return ci;

	return {
		name,
		title,
		slugConst,
		port,
		url,
		create,
		edits: [
			{
				path: "playwright.config.ts",
				before: inputs.playwright,
				after: pw.text,
				inserted: [...urlLines, ...serverLines],
			},
			{
				path: ".github/workflows/ci.yml",
				before: inputs.ci,
				after: ci.text,
				inserted: [...dcLine, ...cpLine],
			},
		],
	};
}
