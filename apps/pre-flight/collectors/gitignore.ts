// A narrow reading of a root .gitignore: is one path ignored, and by which line?
// It handles comments, blank lines, trailing spaces, a trailing slash for
// directories, leading and middle slash anchoring, ! negation, *, ** and ?, and
// \# and \! escapes. Anything else is "unsupported", so the caller asks the user
// instead of guessing (requirement 3.16).

export type IgnoreResult =
	| { ignored: boolean; line?: number; text?: string }
	| { unsupported: true; line: number; text: string };

interface Rule {
	line: number;
	text: string;
	negate: boolean;
	dirOnly: boolean;
	regex: RegExp;
}

const escapeRe = (s: string) => s.replace(/[.+^${}()|[\]\\]/g, "\\$&");

/** A glob segment run to a regex body: ** spans folders, * and ? stay inside one. */
function globBody(glob: string): string {
	let out = "";
	for (let i = 0; i < glob.length; i++) {
		const c = glob[i] as string;
		if (glob.startsWith("**/", i) && (i === 0 || glob[i - 1] === "/")) {
			out += "(?:.*/)?";
			i += 2;
		} else if (glob.startsWith("/**", i) && i + 3 === glob.length) {
			out += "/.*";
			i += 2;
		} else if (c === "*") {
			while (glob[i + 1] === "*") i++;
			out += "[^/]*";
		} else if (c === "?") out += "[^/]";
		else out += escapeRe(c);
	}
	return out;
}

/** One line as a rule, null for a comment or blank, or "unsupported". */
function toRule(raw: string, line: number): Rule | null | "unsupported" {
	let text = raw.replace(/\r$/, "");
	// Trailing spaces go unless escaped; an escaped space is a construct this reader refuses.
	text = text.replace(/(?<!\\) +$/, "");
	if (text === "" || text.startsWith("#")) return null;
	let negate = false;
	if (text.startsWith("!")) {
		negate = true;
		text = text.slice(1);
	} else if (text.startsWith("\\#") || text.startsWith("\\!"))
		text = text.slice(1);
	if (/[[\]\\]/.test(text)) return "unsupported";
	const dirOnly = text.endsWith("/");
	if (dirOnly) text = text.slice(0, -1);
	if (text === "") return null;
	const anchored = text.includes("/");
	if (text.startsWith("/")) text = text.slice(1);
	const body = globBody(text);
	const regex = new RegExp(anchored ? `^${body}$` : `^(?:.*/)?${body}$`);
	return { line, text: raw.replace(/\r$/, ""), negate, dirOnly, regex };
}

/**
 * Whether `path` is ignored by `text`. A path ending in "/" is a directory.
 * The last matching line decides, and a file inside an ignored directory stays
 * ignored whatever later lines say, as in git.
 */
export function ignores(text: string, path: string): IgnoreResult {
	const rules: Rule[] = [];
	const raws = text.split("\n");
	for (let i = 0; i < raws.length; i++) {
		const rule = toRule(raws[i] as string, i + 1);
		if (rule === "unsupported")
			return {
				unsupported: true,
				line: i + 1,
				text: (raws[i] as string).replace(/\r$/, ""),
			};
		if (rule !== null) rules.push(rule);
	}
	const isDir = path.endsWith("/");
	const parts = path.replace(/\/$/, "").split("/");
	for (let depth = 1; depth <= parts.length; depth++) {
		const candidate = parts.slice(0, depth).join("/");
		const dir = depth < parts.length || isDir;
		let decided: Rule | undefined;
		for (const rule of rules)
			if ((!rule.dirOnly || dir) && rule.regex.test(candidate)) decided = rule;
		const last = depth === parts.length;
		if (decided !== undefined && (!decided.negate || last))
			return {
				ignored: !decided.negate,
				line: decided.line,
				text: decided.text,
			};
	}
	return { ignored: false };
}
