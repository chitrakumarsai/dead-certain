import type { KnowledgeBase } from "@dead-certain/engine";
import { AnswersRail, AppShell, useAnnounce } from "@dead-certain/ui";
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { loadedKb } from "./kb";
import { useRoute } from "./route";
import { Consult } from "./screens/Consult";
import { LoadFailure } from "./screens/LoadFailure";
import { NotFound } from "./screens/NotFound";
import { Rulebook } from "./screens/Rulebook";
import { Stale } from "./screens/Stale";
import { Start } from "./screens/Start";
import { XrayVerdict } from "./screens/Xray";
import { changeSentence, railEntries } from "./session/rail";
import { fragmentFor } from "./session/replay";
import { step as stepOf, useSession, type ViewState } from "./session/store";

/** Says in one sentence what an edited answer changed (requirement 4.9). */
function ChangeAnnouncer({ view }: { view: ViewState }) {
	const announce = useAnnounce();
	useEffect(() => {
		if (view.changed === null) return;
		const decided = stepOf(view).kind === "verdict";
		announce(changeSentence(view.session, view.changed, decided));
	}, [view, announce]);
	return null;
}

function App({ kb }: { kb: KnowledgeBase }) {
	const route = useRoute();
	const [view, dispatch] = useSession(kb, route.page === "check");
	// The nav keeps the replay token, so a visit to the rulebook keeps the answers.
	const nav = [
		{
			label: "Claim Check",
			href: fragmentFor(view.session),
			current: route.page === "check",
		},
		{
			label: "Rulebook",
			href: "#/rulebook",
			current: route.page === "rulebook",
		},
	];
	const step = stepOf(view);

	const showRail =
		route.page === "check" &&
		(step.kind === "question" || step.kind === "verdict");
	const rail = showRail ? (
		<AnswersRail
			answers={railEntries(view.session)}
			onChange={(fact) => dispatch({ type: "edit", fact })}
			skipped={view.skipped}
			{...(step.kind === "question" ? { current: step.question.fact } : {})}
		/>
	) : undefined;

	let page: React.ReactNode;
	if (route.page === "notfound") page = <NotFound />;
	else if (route.page === "rulebook")
		page = (
			<Rulebook kb={kb} clause={route.clause} view={view} dispatch={dispatch} />
		);
	else if (step.kind === "start")
		page = <Start onStart={() => dispatch({ type: "start" })} />;
	else if (step.kind === "question")
		page = (
			<Consult
				key={`${step.question.fact}:${step.editing}`}
				kb={kb}
				view={view}
				step={step}
				dispatch={dispatch}
			/>
		);
	else if (step.kind === "stale")
		page = (
			<Stale
				failure={step.failure}
				onStart={() => dispatch({ type: "start" })}
			/>
		);
	else
		page = (
			<XrayVerdict
				kb={kb}
				view={view}
				verdict={step.verdict}
				dispatch={dispatch}
				rail={rail}
			/>
		);

	return (
		<AppShell
			appName="Claim Check"
			nav={nav}
			// On the verdict the stage hosts the rail, so it folds up beside the film.
			rail={step.kind === "verdict" ? undefined : rail}
		>
			{page}
			{/* Last, so its sentence follows the headline's own announcement. */}
			<ChangeAnnouncer view={view} />
		</AppShell>
	);
}

const root = document.getElementById("root");
if (!root) throw new Error("index.html has no #root element");
createRoot(root).render(
	<StrictMode>
		{loadedKb === null ? (
			<AppShell
				appName="Claim Check"
				nav={[{ label: "Claim Check", href: "#/", current: true }]}
			>
				<LoadFailure />
			</AppShell>
		) : (
			<App kb={loadedKb} />
		)}
	</StrictMode>,
);
