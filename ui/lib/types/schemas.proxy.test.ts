import { describe, expect, it } from "vitest";

import { globalProxyConfigSchema } from "./schemas";

const base = {
	enabled: true,
	type: "socks5" as const,
	url: "",
	enable_for_scim: false,
	enable_for_inference: true,
	enable_for_api: true,
};

const urlIssues = (url: string, type: "http" | "socks5" = "socks5") => {
	const result = globalProxyConfigSchema.safeParse({ ...base, type, url });
	return result.success ? [] : result.error.issues.filter((issue) => issue.path.join(".") === "url").map((issue) => issue.message);
};

describe("globalProxyConfigSchema SOCKS5 url", () => {
	// The server, the client factory and config.schema.json give a bare host:port the type's
	// scheme, so a stored bare SOCKS5 address must not leave Save disabled.
	it("accepts a bare host:port, which takes its scheme from the type", () => {
		expect(urlIssues("proxy.corp:1080")).toEqual([]);
	});

	it("accepts socks5:// and socks5h:// urls", () => {
		expect(urlIssues("socks5://proxy.corp:1080")).toEqual([]);
		expect(urlIssues("SOCKS5H://proxy.corp:1080")).toEqual([]);
	});

	it("rejects a SOCKS5 proxy named by an http url", () => {
		expect(urlIssues("http://proxy.corp:1080")).toContain("A SOCKS5 proxy URL must start with socks5:// or socks5h://");
	});
});