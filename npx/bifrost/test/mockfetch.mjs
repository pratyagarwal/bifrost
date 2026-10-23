// Preload for bin.test.js: replaces fetch so bin.js talks to an in-memory download server.
// BIFROST_TEST_SCENARIO is JSON: { latest, checksum: "match" | "mismatch" | "missing" | "malformed" }.
import { createHash } from "crypto";

const scenario = JSON.parse(process.env.BIFROST_TEST_SCENARIO || "{}");
const binary = "#!/bin/sh\necho BIFROST_TEST_BINARY_RAN\n";
const binaryHash = createHash("sha256").update(binary).digest("hex");

globalThis.fetch = async (url, init = {}) => {
	const target = String(url);
	if (target.endsWith("/latest-release")) {
		return scenario.latest ? Response.json({ name: scenario.latest }) : new Response("unavailable", { status: 503 });
	}
	if (target.endsWith(".sha256")) {
		switch (scenario.checksum) {
			case "match":
				return new Response(`${binaryHash}  bifrost-http\n`);
			case "mismatch":
				return new Response(`${"0".repeat(64)}  bifrost-http\n`);
			case "malformed":
				return new Response("<html>not a checksum</html>");
			default:
				return new Response("not found", { status: 404 });
		}
	}
	if (target.endsWith("/bifrost-http")) {
		return init.method === "HEAD" ? new Response(null) : new Response(binary);
	}
	return new Response("not found", { status: 404 });
};
