import {
	formatMoney,
	formatValue,
	humanize,
	ProofTree,
	type ProofTreeProps,
	type TreeState,
} from "@dead-certain/ui";
import {
	clauseFixtures,
	collectedProofFixture,
	deepProofFixture,
	factDefFixtures,
	hugeProofFixture,
	preFlightClauseFixtures,
	proofFixture,
	unknownValueProofFixture,
} from "@dead-certain/ui/fixtures";
import { OnFilm } from "./OnFilm";
import { Specimen } from "./Specimen";

type Root = ProofTreeProps["root"];

const format = { currency: "INR" } as const;
const labelFor = (fact: string) =>
	factDefFixtures[fact]?.label ?? humanize(fact);
/** Gallery only: a fact without a definition is money when it is a number, except age. */
const valueFor = (
	fact: string,
	value: Parameters<ProofTreeProps["formatValue"]>[1],
) => {
	const def = factDefFixtures[fact];
	if (def) return formatValue(def, value, format);
	if (typeof value === "number" && fact !== "age")
		return formatMoney(value, "INR");
	return formatValue(
		{ type: typeof value === "boolean" ? "boolean" : "number" },
		value,
		format,
	);
};
const clauseFor = (id: string) =>
	clauseFixtures[id] ?? preFlightClauseFixtures[id];

/** Every node with children open, the root active. */
function allOpen(root: Root): TreeState {
	const ids: string[] = [];
	const walk = (node: Root, id: string): void => {
		if (node.children.length === 0) return;
		ids.push(id);
		node.children.forEach((child, i) => {
			walk(child, `${id}.${i}`);
		});
	};
	walk(root, "0");
	return { active: "0", expanded: new Set(ids) };
}

const TREES: readonly {
	id: string;
	title: string;
	note: string;
	root: Root;
	initialState?: TreeState;
	decidingClause?: string;
}[] = [
	{
		id: "prooftree-collapsed",
		title: "Collapsed",
		note: "The root and its children start open; deeper rules start closed.",
		root: deepProofFixture,
	},
	{
		id: "prooftree-expanded",
		title: "Expanded",
		note: "Rules are joints with their sentence; answers are bone ends with their source.",
		root: proofFixture,
	},
	{
		id: "prooftree-deep",
		title: "Deep",
		note: "Four levels, opened down one branch.",
		root: deepProofFixture,
		initialState: { active: "0", expanded: new Set(["0", "0.0", "0.0.0"]) },
	},
	{
		id: "prooftree-shared",
		title: "Shared fact",
		note: "The sum insured is used by two rules, so it appears twice with two ids.",
		root: deepProofFixture,
		initialState: allOpen(deepProofFixture),
	},
	{
		id: "prooftree-collected",
		title: "Collected",
		note: "Pre-Flight facts read from GitHub carry the Collected source.",
		root: collectedProofFixture,
	},
	{
		id: "prooftree-unknown",
		title: "Unknown value",
		note: "A fact with no value yet prints Not known yet.",
		root: unknownValueProofFixture,
	},
	{
		id: "prooftree-deciding",
		title: "Deciding clause",
		note: "The rule citing the deciding clause quotes it under its sentence, marked in wax.",
		root: deepProofFixture,
		decidingClause: "1.2",
	},
	{
		id: "prooftree-huge",
		title: "200 nodes",
		note: "A large proof. Ids stay unique and rows render once each.",
		root: hugeProofFixture,
	},
];

export const PROOF_TREE_SPECIMENS = TREES.map(({ id, title }) => ({
	id,
	title,
}));

export function ProofTreeSection() {
	return (
		<section aria-labelledby="prooftree-heading" className="pt-16">
			<h2
				id="prooftree-heading"
				className="font-doc text-verdict font-semibold"
			>
				ProofTree
			</h2>
			<p className="max-w-column pt-2 text-text-soft">
				A verdict's bones, on film. Each rule that fired is a joint, each fact
				it used is a bone end, and the tree follows the ARIA tree pattern.
				Keyboard movement arrives with the next task.
			</p>

			{TREES.map(({ id, title, note, root, initialState, decidingClause }) => (
				<Specimen key={id} id={id} title={title} note={note}>
					<OnFilm>
						<ProofTree
							root={root}
							labelFor={labelFor}
							formatValue={valueFor}
							clauseFor={clauseFor}
							decidingClause={decidingClause}
							initialState={initialState}
							onEscape={() => undefined}
						/>
					</OnFilm>
				</Specimen>
			))}
		</section>
	);
}
