import type { Clause, FactValue, ProofNode } from "@dead-certain/engine/types";
import { memo, useCallback, useState } from "react";
import { Chevron } from "../icons";
import { ClauseQuote } from "./ClauseQuote";
import {
	initialTreeState,
	normalizeTreeState,
	type TreeState,
	toggleNode,
} from "./proofTreeState";
import { SourceBadge } from "./SourceBadge";

export interface ProofTreeProps {
	root: ProofNode;
	labelFor: (fact: string) => string;
	formatValue: (fact: string, value: FactValue | undefined) => string;
	/** Built by the app with the engine's print(). */
	ruleExpression?: (ruleId: string) => string | undefined;
	clauseFor?: (clauseId: string) => Clause | undefined;
	/** The clause id to mark with wax. */
	decidingClause?: string;
	/** Offered on answered facts. */
	onChangeAnswer?: (fact: string) => void;
	/** XrayStage restores focus. */
	onEscape: () => void;
	/**
	 * Where the tree starts, read on mount only (like defaultOpen). Unknown ids
	 * are dropped and ancestors of open or active nodes open. To show another
	 * proof, remount the tree, for example with key={target}.
	 */
	initialState?: TreeState;
}

type RowProps = Pick<
	ProofTreeProps,
	"labelFor" | "formatValue" | "clauseFor" | "decidingClause"
> & {
	node: ProofNode;
	id: string;
	isOpen: boolean;
	onToggle: (id: string) => void;
};

const isJoint = (node: ProofNode): boolean =>
	node.source === "derived" && node.rule !== undefined;

/** A joint: a circle on the trunk. A bone end: a short stub with a square end. */
function Marker({ joint }: { joint: boolean }) {
	return (
		<svg
			viewBox="0 0 16 16"
			width="16"
			height="16"
			aria-hidden="true"
			focusable="false"
			className="mt-1 shrink-0 text-text-soft"
		>
			{joint ? (
				<circle
					cx="8"
					cy="8"
					r="5"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
				/>
			) : (
				<path
					d="M1 8h9M10 5h4v6h-4z"
					fill="currentColor"
					stroke="currentColor"
					strokeWidth="2"
				/>
			)}
		</svg>
	);
}

/** One node's own content, without its children. Memoised by id upstream. */
const Row = memo(function Row({
	node,
	id,
	isOpen,
	onToggle,
	labelFor,
	formatValue,
}: RowProps) {
	const isParent = node.children.length > 0;
	const value =
		node.value === undefined
			? "Not known yet"
			: formatValue(node.fact, node.value);
	return (
		<div data-row className="flex items-start gap-1 py-1">
			{isParent ? (
				// The pointer route only: keyboard users open branches with the tree
				// keys, and aria-expanded tells screen readers.
				<span
					aria-hidden="true"
					data-toggle={isOpen ? "open" : "closed"}
					onClick={() => onToggle(id)}
					className="-my-2 flex size-touch shrink-0 cursor-pointer items-center justify-center rounded-control text-text-soft hover:bg-text/10"
				>
					<Chevron direction={isOpen ? "down" : "right"} />
				</span>
			) : (
				<span className="w-touch shrink-0" />
			)}
			<Marker joint={isJoint(node)} />
			{isJoint(node) ? (
				<span className="flex min-w-0 flex-wrap items-baseline gap-x-3">
					<span data-rule className="font-mono text-mono text-text">
						{node.rule}
					</span>
					<span className="text-sys-body text-text">{node.because}</span>
					{isParent && !isOpen && (
						// Sighted users see the hidden branch; aria-expanded already says it.
						<span
							aria-hidden="true"
							data-hidden-count
							className="font-mono text-mono text-text-soft"
						>
							{node.children.length} hidden
						</span>
					)}
				</span>
			) : (
				<span className="flex min-w-0 flex-wrap items-baseline gap-x-3">
					<span className="text-sys-body text-text">{labelFor(node.fact)}</span>
					<span className="figures text-sys-body font-semibold text-text">
						{value}
					</span>
					<SourceBadge source={node.source} />
				</span>
			)}
		</div>
	);
});

interface NodeProps extends Omit<RowProps, "id" | "isOpen"> {
	id: string;
	level: number;
	posinset: number;
	setsize: number;
	state: TreeState;
}

function TreeNode({ id, level, posinset, setsize, state, ...row }: NodeProps) {
	const { node, clauseFor, decidingClause } = row;
	const isParent = node.children.length > 0;
	const isOpen = isParent && state.expanded.has(id);
	const clause =
		node.clause !== undefined && node.clause === decidingClause
			? clauseFor?.(node.clause)
			: undefined;

	return (
		<div
			role="treeitem"
			data-node-id={id}
			data-fact={node.fact}
			aria-level={level}
			aria-setsize={setsize}
			aria-posinset={posinset}
			aria-expanded={isParent ? isOpen : undefined}
			tabIndex={state.active === id ? 0 : -1}
			// The ring goes round the node's own row, not its whole subtree.
			data-focus-ring="frame"
			className="[&:focus-visible>[data-row]]:outline-2 [&:focus-visible>[data-row]]:outline-offset-2 [&:focus-visible>[data-row]]:outline-focus [&:focus-visible>[data-row]]:outline-solid"
		>
			<Row {...row} id={id} isOpen={isOpen} />
			{clause && (
				<div data-deciding className="pb-2 pl-16">
					<ClauseQuote clause={clause} variant="deciding" />
				</div>
			)}
			{isOpen && (
				// biome-ignore lint/a11y/useSemanticElements: a tree's child list is role="group"; a fieldset is for form controls.
				<div role="group" className="ml-2 border-l-2 border-text-soft pl-4">
					{node.children.map((child, i) => (
						<TreeNode
							// biome-ignore lint/suspicious/noArrayIndexKey: the index path is the node's identity.
							key={i}
							{...row}
							node={child}
							id={`${id}.${i}`}
							level={level + 1}
							posinset={i + 1}
							setsize={node.children.length}
							state={state}
						/>
					))}
				</div>
			)}
		</div>
	);
}

/**
 * A verdict's proof as an ARIA tree: rules are joints, facts are bone ends.
 * Ids are index paths, so a fact under two rules gets two ids. One item is in
 * the tab order at a time. Keys and node actions arrive with task 8.2.
 */
export function ProofTree({
	root,
	labelFor,
	formatValue,
	clauseFor,
	decidingClause,
	initialState,
}: ProofTreeProps) {
	const [state, setState] = useState(() =>
		normalizeTreeState(root, initialState ?? initialTreeState(root)),
	);
	const onToggle = useCallback(
		(id: string) => setState((prev) => toggleNode(root, prev, id)),
		[root],
	);

	return (
		<div role="tree" aria-label="Proof" className="max-w-column">
			<TreeNode
				node={root}
				id="0"
				level={1}
				posinset={1}
				setsize={1}
				state={state}
				onToggle={onToggle}
				labelFor={labelFor}
				formatValue={formatValue}
				clauseFor={clauseFor}
				decidingClause={decidingClause}
			/>
		</div>
	);
}
