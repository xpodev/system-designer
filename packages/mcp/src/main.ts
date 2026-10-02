#!/usr/bin/env node
/**
 * systemathic-mcp: the MCP server, over stdio. It connects to the host already running at
 * SYSTEMATHIC_HOST (or 127.0.0.1:4747), so it edits the same Systems as the UI; if none is
 * running, it hosts them itself and serves them there for the UI to join. Every file named on
 * the command line is opened.
 */
import { fileURLToPath } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { HostClient, type HostApi } from "@systemathic/host";
import { DEFAULT_HOST, nodeHost, serve } from "@systemathic/host-node";
import { createServer } from "./server.js";

export async function connect(): Promise<HostApi> {
  if (await HostClient.reachable(DEFAULT_HOST)) {
    console.error(`systemathic-mcp: using the host at ${DEFAULT_HOST}`);
    return new HostClient(DEFAULT_HOST);
  }
  const host = nodeHost();
  const port = Number(new URL(DEFAULT_HOST).port || 4747);
  try {
    const { url } = await serve(host, { port, ui: fileURLToPath(new URL("../../ui/dist/", import.meta.url)) });
    console.error(`systemathic-mcp: hosting on ${url}`);
  } catch (error) {
    console.error(`systemathic-mcp: hosting in this process only (${(error as Error).message})`);
  }
  return host;
}

async function main(): Promise<void> {
  const host = await connect();
  for (const file of process.argv.slice(2)) {
    const opened = await host.open(file);
    console.error(`systemathic-mcp: opened ${file} as ${opened.id}`);
  }
  await (await createServer(host)).connect(new StdioServerTransport());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
