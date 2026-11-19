import type { FactValue, LineItem } from "@dead-certain/engine";
import { AnswersRail, AppShell, Sheet } from "@dead-certain/ui";
import { StrictMode, useMemo, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import type { KnowledgeBase } from "@dead-certain/engine";
import { deriveFacts } from "../collectors/derive";
import { CHECKLIST, validateChecklists } from "./checklists";
import { labelFor, kb as loadedKb } from "./kb";
import { buildReport } from "./report/audit";
import { useRun } from "./run/useRun";
import { ErrorScreen } from "./screens/ErrorScreen";
import { LoadFailure } from "./screens/LoadFailure";
import { Report } from "./screens/Report";
import { Start } from "./screens/Start";
import { Steps } from "./screens/Steps";
import { XrayReport } from "./screens/Xray";

const NAV = [{ label: "Pre-Flight", href: "#/", current: true }];

const subscribe = (onChange: () => void) => {
	window.addEventListener("hashchange", onChange);
	return () => window.removeEventListener("hashchange", onChange);
};
const useHash = () => useSyncExternalStore(subscribe, () => location.hash);

const display = (value: FactValue) =>
	value === true ? "Yes" : value === false ? "No" : String(value);

function App({ kb }: { kb: KnowledgeBase }) {
	const hash = useHash();
	const [attempt, setAttempt] = useState(0);
	const [run, dispatch] = useRun(hash, attempt);
	// The check whose proof is open on film; a new run closes it.
	const [open, setOpen] = useState<{ runId: number; fact: string } | null>(
		null,
	);
	const onOpen = (item: LineItem) => {
		if (run.phase === "report") setOpen({ runId: run.runId, fact: item.fact });
	};

	const derived = useMemo(
		() => (run.phase === "report" ? deriveFacts(run.snapshot, kb) : null),
		[run, kb],
	);
	const report = useMemo(() => {
		if (run.phase !== "report" || derived === null) return null;
		return buildReport({
			kb,
			checklist: CHECKLIST,
			snapshot: run.snapshot,
			derived,
			answers: run.answers,
		});
	}, [run, derived, kb]);

	let page: React.ReactNode;
	let rail: React.ReactNode;
	if (run.phase === "idle")
		page = hash.startsWith("#/report") ? <Sheet>{null}</Sheet> : <Start />;
	else if (run.phase === "collecting" || run.phase === "error")
		page = (
			<Sheet as="section" aria-labelledby="run-heading">
				<h1
					id="run-heading"
					className="pb-4 font-doc text-summary font-semibold"
				>
					{`Checking ${run.target.owner}/${run.target.name}`}
				</h1>
				<Steps steps={run.steps} />
				{run.phase === "error" && (
					<ErrorScreen
						error={run.error}
						target={run.target}
						onRetry={() => setAttempt((n) => n + 1)}
					/>
				)}
			</Sheet>
		);
	else if (report !== null) {
		const entries = Object.entries(run.answers).map(([fact, value]) => ({
			fact,
			label: labelFor(kb, fact),
			display: display(value),
			value,
		}));
		// On the report the stage hosts the rail, so it folds up beside the film.
		const railNode =
			entries.length > 0 ? (
				<AnswersRail
					answers={entries}
					onChange={(fact) => dispatch({ type: "reopen", fact })}
				/>
			) : undefined;
		page = (
			<XrayReport
				kb={kb}
				view={report}
				evidence={derived?.evidence ?? {}}
				open={open !== null && open.runId === run.runId ? open.fact : null}
				onClose={() => setOpen(null)}
				onChangeAnswer={(fact) => {
					setOpen(null);
					dispatch({ type: "reopen", fact });
				}}
				rail={railNode}
			>
				<Report
					key={run.runId}
					kb={kb}
					view={report}
					answers={run.answers}
					origin={run.origin}
					takenAt={run.snapshot.takenAt}
					{...(run.reopened === undefined ? {} : { reopened: run.reopened })}
					onAnswer={(fact, value) => dispatch({ type: "answer", fact, value })}
					onOpen={onOpen}
				/>
			</XrayReport>
		);
	}

	// A run's page is at least one screen tall from its first step, so the
	// footer starts below the fold and does not jump when the report replaces
	// the steps (11.8).
	const onRun = run.phase !== "idle" || hash.startsWith("#/report");
	return (
		<AppShell appName="Pre-Flight" nav={NAV} rail={rail}>
			{onRun ? (
				<div data-run-page className="min-h-svh">
					{page}
				</div>
			) : (
				page
			)}
		</AppShell>
	);
}

/** The rules load and agree with the checklist, or the page says they did not load (1.9, 1.10). */
function loads(kb: KnowledgeBase | null): kb is KnowledgeBase {
	if (kb === null) return false;
	const check = validateChecklists(kb);
	if (!check.ok && import.meta.env.DEV)
		console.error(`Pre-Flight checklist: ${check.problem}`);
	return check.ok;
}

const root = document.getElementById("root");
if (!root) throw new Error("index.html has no #root element");
createRoot(root).render(
	<StrictMode>
		{loads(loadedKb) ? (
			<App kb={loadedKb} />
		) : (
			<AppShell appName="Pre-Flight" nav={NAV}>
				<LoadFailure />
			</AppShell>
		)}
	</StrictMode>,
);
