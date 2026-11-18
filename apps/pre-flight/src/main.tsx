import { AppShell, Sheet } from "@dead-certain/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

/** Every route shows the start screen until the run controller (task 10) adds the others. */
function App() {
	return (
		<AppShell
			appName="Pre-Flight"
			nav={[{ label: "Pre-Flight", href: "#/", current: true }]}
		>
			<Sheet as="section" aria-labelledby="start-heading">
				<h1 id="start-heading" className="font-doc text-verdict font-semibold">
					Check a repository before you submit it
				</h1>
			</Sheet>
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
