import { AppShell } from "@dead-certain/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { NAV } from "./config";

function Landing() {
	return (
		<AppShell appName="Dead Certain" nav={NAV}>
			<h1 className="font-doc text-verdict font-semibold">
				LLMs guess. The dead are certain.
			</h1>
		</AppShell>
	);
}

const root = document.getElementById("root");
if (!root) throw new Error("index.html has no #root element");
createRoot(root).render(
	<StrictMode>
		<Landing />
	</StrictMode>,
);
