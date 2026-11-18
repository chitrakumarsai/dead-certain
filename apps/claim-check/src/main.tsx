import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { AppShell } from "@dead-certain/ui";

const NAV = [
	{ label: "Claim Check", href: "#/", current: true },
	{ label: "Rulebook", href: "#/rulebook" },
];

const root = document.getElementById("root");
if (!root) throw new Error("index.html has no #root element");
createRoot(root).render(
	<StrictMode>
		<AppShell appName="Claim Check" nav={NAV}>
			<h1>Claim Check</h1>
		</AppShell>
	</StrictMode>,
);
