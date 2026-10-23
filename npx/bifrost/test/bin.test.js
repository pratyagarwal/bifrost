import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const binJs = join(here, "..", "bin.js");
const preload = join(here, "mockfetch.mjs");
const MARKER = /BIFROST_TEST_BINARY_RAN/;

// Runs bin.js against the mocked download server with a throwaway cache dir.
function run(t, scenario, args = []) {
	const cache = mkdtempSync(join(tmpdir(), "bifrost-npx-test-"));
	t.after(() => rmSync(cache, { recursive: true, force: true }));
	const result = spawnSync(process.execPath, ["--import", preload, binJs, ...args], {
		encoding: "utf8",
		env: { ...process.env, XDG_CACHE_HOME: cache, BIFROST_TEST_SCENARIO: JSON.stringify(scenario), BIFROST_TRANSPORT_VERSION: "" },
	});
	const cachedFiles = (version) => {
		const dir = join(cache, "bifrost", version, "bin");
		return existsSync(dir) ? readdirSync(dir) : [];
	};
	return { ...result, cachedFiles };
}

const skip = process.platform === "win32" ? "the stub binary is a shell script" : false;

test("runs the binary when the checksum matches", { skip }, (t) => {
	const r = run(t, { latest: "v2.4.0", checksum: "match" });
	assert.equal(r.status, 0, r.stderr);
	assert.match(r.stdout, MARKER);
	assert.deepEqual(r.cachedFiles("v2.4.0"), ["bifrost-http-0"]);
});

test("refuses a binary whose checksum does not match", { skip }, (t) => {
	const r = run(t, { latest: "v2.4.0", checksum: "mismatch" });
	assert.equal(r.status, 1, r.stdout + r.stderr);
	assert.doesNotMatch(r.stdout, MARKER);
	assert.match(r.stderr, /Checksum verification failed/);
	assert.deepEqual(r.cachedFiles("v2.4.0"), [], "rejected download must not stay in the cache");
});

test("refuses a malformed checksum file", { skip }, (t) => {
	const r = run(t, { latest: "v2.4.0", checksum: "malformed" });
	assert.equal(r.status, 1, r.stdout + r.stderr);
	assert.doesNotMatch(r.stdout, MARKER);
	assert.match(r.stderr, /Could not parse checksum file/);
});

test("refuses a missing checksum for a release that must have one", { skip }, (t) => {
	for (const version of ["v2.4.0", "v2.3.3", "v2.3.3-prerelease1"]) {
		const r = run(t, { checksum: "missing" }, ["--transport-version", version]);
		assert.equal(r.status, 1, `${version}: ${r.stdout}${r.stderr}`);
		assert.doesNotMatch(r.stdout, MARKER, version);
		assert.match(r.stderr, /Checksum file not available/, version);
		assert.deepEqual(r.cachedFiles(version), [], version);
	}
});

test("refuses a missing checksum when the latest version cannot be resolved", { skip }, (t) => {
	const r = run(t, { checksum: "missing" });
	assert.equal(r.status, 1, r.stdout + r.stderr);
	assert.doesNotMatch(r.stdout, MARKER);
	assert.match(r.stderr, /Checksum file not available/);
});

test("runs older releases published without a checksum, with a warning", { skip }, (t) => {
	const r = run(t, { checksum: "missing" }, ["--transport-version", "v2.3.2"]);
	assert.equal(r.status, 0, r.stderr);
	assert.match(r.stdout, MARKER);
	assert.match(r.stderr, /published without a checksum file/);
});
