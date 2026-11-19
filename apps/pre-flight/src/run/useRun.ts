import { useEffect, useReducer, useRef } from "react";
import { collect } from "../../collectors/collect";
import {
	type Action,
	initialRun,
	type Run,
	reducer,
	runFor,
} from "./controller";
import { loadSample } from "./samples";

/**
 * Starts the run the fragment asks for, and aborts it when the route changes.
 * The collector gets the platform fetch with the run's own abort signal.
 */
export function useRun(hash: string, attempt = 0): [Run, (a: Action) => void] {
	const [run, dispatch] = useReducer(reducer, initialRun);
	const nextId = useRef(0);
	// biome-ignore lint/correctness/useExhaustiveDependencies: attempt is the trigger for "Try again", not a value the effect reads.
	useEffect(() => {
		const request = runFor(hash);
		const runId = ++nextId.current;
		const controller = new AbortController();
		if (request.kind === "none") dispatch({ type: "reset" });
		else if (request.kind === "sample")
			void loadSample(request.id).then((snapshot) => {
				if (snapshot !== undefined && !controller.signal.aborted)
					dispatch({ type: "sample", runId, snapshot });
			});
		else {
			dispatch({ type: "start", runId, target: request.target });
			const runFetch: typeof fetch = (input, init) =>
				fetch(input, {
					...init,
					signal: init?.signal
						? AbortSignal.any([init.signal, controller.signal])
						: controller.signal,
				});
			void collect(request.target, {
				fetch: runFetch,
				now: () => new Date(),
				onStep: (event) => dispatch({ type: "step", runId, event }),
			}).then((result) => {
				// An abort by navigation is not an error: the newer run owns the screen.
				if (!controller.signal.aborted)
					dispatch({ type: "done", runId, result });
			});
		}
		return () => controller.abort();
	}, [hash, attempt]);
	return [run, dispatch];
}
