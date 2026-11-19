import { AppShell, Sheet } from "@dead-certain/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { validateChecklists } from "./checklists";
import { kb } from "./kb";
import { LoadFailure } from "./screens/LoadFailure";

const NAV = [{ label: "Pre-Flight", href: "#/", current: true }];

/** The rules load and agree with the checklist, or the page says they did not load (1.9, 1.10). */
function loads(): boolean {
	if (kb === null) return false;
	const check = validateChecklists(kb);
	if (!check.ok && import.meta.env.DEV)
		console.error(`Pre-Flight checklist: ${check.problem}`);
	return check.ok;
}

/** Every route shows the start screen until the run controller (task 10) adds the others. */
function App() {
	return (
		<AppShell appName="Pre-Flight" nav={NAV}>
			{loads() ? (
				<Sheet as="section" aria-labelledby="start-heading">
					<h1
						id="start-heading"
						className="font-doc text-verdict font-semibold"
					>
						Check a repository before you submit it
					</h1>
				</Sheet>
			) : (
				<LoadFailure />
			)}
		</AppShell>
	);
}

const root = document.getElementById("root");
if (!root) throw new Error("index.html has no #root element");
createRoot(root).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
