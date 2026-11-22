import type { KnowledgeBase } from "@dead-certain/engine";
import { AppShell } from "@dead-certain/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { loadedKb } from "./kb";
import { useRoute } from "./route";
import { Consult } from "./screens/Consult";
import { LoadFailure } from "./screens/LoadFailure";
import { NotFound } from "./screens/NotFound";
import { Stale } from "./screens/Stale";
import { Start } from "./screens/Start";
import { XrayVerdict } from "./screens/Xray";
import { fragmentFor } from "./session/replay";
import { step as stepOf, useSession } from "./session/store";

const APP = "__APP_TITLE__";

function App({ kb }: { kb: KnowledgeBase }) {
	const route = useRoute();
	const [view, dispatch] = useSession(kb, route.page === "check");
	const nav = [{ label: APP, href: fragmentFor(view.session), current: true }];
	const step = stepOf(view);
	const begin = () => dispatch({ type: "start" });

	let page: React.ReactNode;
	if (route.page === "notfound") page = <NotFound />;
	else if (step.kind === "start") page = <Start kb={kb} onStart={begin} />;
	else if (step.kind === "stale")
		page = <Stale failure={step.failure} onStart={begin} />;
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
	else
		page = (
			<XrayVerdict
				kb={kb}
				view={view}
				verdict={step.verdict}
				dispatch={dispatch}
			/>
		);

	return (
		<AppShell appName={APP} nav={nav}>
			{page}
		</AppShell>
	);
}

const root = document.getElementById("root");
if (!root) throw new Error("index.html has no #root element");
createRoot(root).render(
	<StrictMode>
		{loadedKb === null ? (
			<AppShell appName={APP} nav={[{ label: APP, href: "#/", current: true }]}>
				<LoadFailure />
			</AppShell>
		) : (
			<App kb={loadedKb} />
		)}
	</StrictMode>,
);
