import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@dead-certain/ui/styles.css";
import { AppShell } from "@dead-certain/ui";
import {
	CLAIM_NAV,
	claimRail,
	QuestionScreen,
	StartScreen,
	VerdictScreen,
} from "./claimScreens";

/**
 * One static screen per page, so each owns its landmarks and has a deep link:
 * kit/screen.html?screen=<name>. Built from kit components and fixtures only.
 */
const SCREENS = {
	start: {
		title: "Claim Check start",
		render: () => <StartScreen />,
		rail: false,
	},
	question: {
		title: "Claim Check question",
		render: () => <QuestionScreen />,
		rail: true,
	},
	verdict: {
		title: "Claim Check verdict",
		render: () => <VerdictScreen />,
		rail: true,
	},
} as const;

type ScreenName = keyof typeof SCREENS;
const isScreen = (name: string | null): name is ScreenName =>
	name !== null && Object.hasOwn(SCREENS, name);

const params = new URLSearchParams(location.search);
// As a gallery preview the screen must not take focus: a focus() inside a
// frame pulls the whole gallery's focus into it. Only this frame's window is
// patched; the screen opened on its own focuses as it should.
if (params.get("preview") === "1")
	HTMLElement.prototype.focus = () => undefined;
const requested = params.get("screen");
const name: ScreenName = isScreen(requested) ? requested : "start";
const screen = SCREENS[name];
document.title = `${screen.title} · Dead Certain`;

const root = document.getElementById("root");
if (!root) throw new Error("kit/screen.html has no #root element");
createRoot(root).render(
	<StrictMode>
		<AppShell
			appName="Claim Check"
			nav={CLAIM_NAV}
			rail={screen.rail ? claimRail("room_rent_per_day") : undefined}
		>
			{screen.render()}
		</AppShell>
	</StrictMode>,
);
