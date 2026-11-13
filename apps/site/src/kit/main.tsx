import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@dead-certain/ui/styles.css";

function Gallery() {
	return (
		<>
			<a href="#content">Skip to the content</a>
			<header>
				<h1>Component kit</h1>
			</header>
			<main id="content" tabIndex={-1} />
		</>
	);
}

const root = document.getElementById("root");
if (!root) throw new Error("kit/index.html has no #root element");
createRoot(root).render(
	<StrictMode>
		<Gallery />
	</StrictMode>,
);
