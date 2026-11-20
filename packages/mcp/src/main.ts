import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createNodeHost } from "./host";
import { createServer } from "./server";
import { makeWorkspace } from "./workspace";

// No @types/node in the repo: declare only what this entry uses.
declare const process: { stderr: { write(text: string): unknown } };

// Standard output belongs to the MCP transport. The one line below goes to
// standard error, after the connection is made.
const server = createServer(makeWorkspace(createNodeHost()));
await server.connect(new StdioServerTransport());
process.stderr.write("dead-certain mcp: ready\n");
