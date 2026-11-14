import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "@dead-certain/ui/styles.css";
import { AnswersRail, AppShell, Button, Sheet } from "@dead-certain/ui";
import { answersFixture } from "@dead-certain/ui/fixtures";

// The shell owns the page's landmarks, so the gallery shows it in iframes.
// ?menu=open opens the phone menu on load; ?rail=no leaves the rail out.
const params = new URLSearchParams(location.search);
const NAV = [
	{ label: "Claim check", href: "#/", current: true },
	{ label: "Rulebook", href: "#/rulebook" },
	{ label: "About", href: "#/about" },
];

function Demo() {
	useEffect(() => {
		if (params.get("menu") !== "open") return;
		document.querySelector<HTMLButtonElement>("[data-menu-trigger]")?.click();
	}, []);

	return (
		<AppShell
			appName="Claim Check"
			nav={NAV}
			rail={
				params.get("rail") === "no" ? undefined : (
					<AnswersRail answers={answersFixture} onChange={() => undefined} />
				)
			}
		>
			<Sheet as="section" aria-labelledby="start-heading">
				<h1 id="start-heading" className="font-doc text-verdict font-semibold">
					Check a hospital claim before you file it
				</h1>
				<p className="max-w-column pt-4 text-sys-body">
					Answer a few questions. You get the amount the policy pays, each
					deduction, and the clause behind it.
				</p>
				<div className="pt-6">
					<Button variant="primary">Start the check</Button>
				</div>
				<p className="pt-6 text-sys-small text-text-soft">
					Uses a sample policy written for this demo. Your answers stay in your
					browser.
				</p>
			</Sheet>
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
