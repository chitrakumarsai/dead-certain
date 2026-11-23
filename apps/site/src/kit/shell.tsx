import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "@dead-certain/ui/styles.css";
import { AppShell } from "@dead-certain/ui";
import { CLAIM_NAV, claimRail, StartScreen } from "./claimScreens";

// The shell owns the page's landmarks, so the gallery shows it in iframes.
// ?menu=open opens the phone menu on load; ?rail=no leaves the rail out.
const params = new URLSearchParams(location.search);

// The navigation, plus one action, so the gallery shows an onSelect item.
const COMMANDS = [
	...CLAIM_NAV.map((item) => ({
		id: item.href,
		label: item.label,
		group: "Pages",
		href: item.href,
	})),
	{
		id: "mark",
		label: "Mark this page",
		group: "Actions",
		onSelect: () => {
			document.body.dataset.marked = "yes";
		},
	},
];

function Demo() {
	useEffect(() => {
		if (params.get("menu") !== "open") return;
		document.querySelector<HTMLButtonElement>("[data-menu-trigger]")?.click();
	}, []);

	return (
		<AppShell
			appName="Claim Check"
			nav={CLAIM_NAV}
			commands={COMMANDS}
			rail={params.get("rail") === "no" ? undefined : claimRail()}
		>
			<StartScreen />
		</AppShell>
	);
}

const root = document.getElementById("root");
if (!root) throw new Error("kit/shell.html has no #root element");
createRoot(root).render(
	<StrictMode>
		<Demo />
	</StrictMode>,
);
