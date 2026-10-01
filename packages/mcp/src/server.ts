/**
 * The MCP client of the tool (docs/tool-design.md, Clients): `Tool / MCP` (McpSystems), each
 * concept editor's operations (XTools), Views as resources (McpInspection) and `verify`
 * (McpVerification). Every editor operation is an MCP tool, generated from its descriptor, so
 * a new operation needs nothing here. The server edits through its own EditSession on each
 * system context, beside any other client's.
 */
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { HostApi, OperationInfo } from "@systemathic/host";
import { z } from "zod";

export const CLIENT = "mcp";

type Shape = Record<string, z.ZodType>;

function parameter(spec: OperationInfo["parameters"][number]): z.ZodType {
  const of = (spec.of ?? []).join(" or ");
  let schema: z.ZodType;
  switch (spec.kind) {
    case "element":
      schema = z.string().describe(`${spec.about}: the id of a ${of}`);
      break;
    case "elements":
      schema = z.array(z.string()).describe(`${spec.about}: ids of ${of}s`);
      break;
    case "text":
      schema = z.string().describe(spec.about);
      break;
    case "range":
      schema = z.string().regex(/^\d+\.\.(\d+|N)$/).describe(`${spec.about}, such as 0..1, 1..1 or 0..N`);
      break;
    case "index":
      schema = z.number().int().min(0).describe(`${spec.about}`);
      break;
    case "flag":
      schema = z.boolean().describe(spec.about);
      break;
  }
  return spec.optional ? schema.optional() : schema;
}

const CONTEXT = z.string().describe("the id of an open system context, from list_systems");

function text(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] };
}

/** Runs a tool body; a refusal becomes an error result the model can read and act on. */
async function guarded(body: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    return text(await body());
  } catch (error) {
    return { isError: true, content: [{ type: "text", text: (error as Error).message }] };
  }
}

export async function createServer(host: HostApi): Promise<McpServer> {
  const server = new McpServer(
    { name: "systemathic", version: "0.0.0" },
    {
      instructions:
        "Systemathic designs systems as precise models: Languages (closed vocabularies of Entities, Relationships, Interactions and axioms), " +
        "Domains that reference Languages and other Domains, Transformations between Languages, and Mediations (a 'what' carried out over a 'how'). " +
        "Open or create a System with open_system or new_system, read it with view (start with the outline perspective), edit it with the editor tools, " +
        "and check it with diagnostics and verify. Edits never fail for leaving the System ill-formed: read diagnostics after editing, and fix what they show. " +
        "Others may be editing the same System at the same time; undo undoes only your own edits.",
    },
  );
  const sessions = new Map<string, string>();
  const session = async (context: string) => {
    let id = sessions.get(context);
    if (id === undefined) {
      id = (await host.startSession(context, CLIENT)).session;
      sessions.set(context, id);
    }
    return id;
  };

  // McpSystems: new, open, save.
  server.registerTool("list_systems", { description: "Lists the open system contexts.", inputSchema: {} }, () => guarded(() => host.contexts()));
  server.registerTool("new_system", { description: "Creates an empty System, open as a new system context.", inputSchema: { name: z.string() } }, ({ name }) =>
    guarded(() => host.create(name)),
  );
  server.registerTool(
    "open_system",
    { description: "Opens a System file. A file already open is the same system context.", inputSchema: { path: z.string().describe("a .systemathic.json file") } },
    ({ path }) => guarded(() => host.open(path)),
  );
  server.registerTool(
    "save_system",
    { description: "Saves a system context to its file, or to a path.", inputSchema: { context: CONTEXT, path: z.string().optional() } },
    ({ context, path }) => guarded(() => host.save(context, path)),
  );
  server.registerTool("get_system", { description: "The whole System, as its file (JSON).", inputSchema: { context: CONTEXT } }, ({ context }) =>
    guarded(() => host.system(context)),
  );

  // XTools: every operation of every concept editor.
  for (const operation of await host.editors()) {
    const shape: Shape = { context: CONTEXT };
    for (const p of operation.parameters) shape[p.name] = parameter(p);
    server.registerTool(
      `${operation.editor}_${operation.name}`,
      { description: `${operation.editor}: ${operation.about} Returns the Edit; an addition's first element is the id of what it added.`, inputSchema: shape },
      (args: Record<string, unknown>) =>
        guarded(async () => {
          const { context, ...rest } = args as { context: string };
          return host.apply(context, await session(context), operation.editor, operation.name, rest);
        }),
    );
  }
  server.registerTool("undo", { description: "Undoes your own latest edit to a system context.", inputSchema: { context: CONTEXT } }, ({ context }) =>
    guarded(async () => (await host.undo(context, await session(context))) ?? "nothing to undo"),
  );
  server.registerTool("history", { description: "Every edit to a system context, by every client, in order.", inputSchema: { context: CONTEXT } }, ({ context }) =>
    guarded(() => host.history(context)),
  );

  // Diagnostics and points of view.
  server.registerTool(
    "diagnostics",
    { description: "What is wrong with a System: structural errors, with suggestions, and the violations of its last verification.", inputSchema: { context: CONTEXT } },
    ({ context }) => guarded(() => host.diagnostics(context)),
  );
  const perspectives = await host.perspectives();
  server.registerTool(
    "view",
    {
      description: `A point of view on a System, as Items and Links. Perspectives: ${perspectives.map((p) => `${p.perspective} (${p.about})`).join("; ")}`,
      inputSchema: {
        context: CONTEXT,
        perspective: z.enum(perspectives.map((p) => p.perspective) as [string, ...string[]]),
        language: z.string().optional().describe("for the language perspective: the id of the Language"),
      },
    },
    ({ context, perspective, language }) => guarded(() => host.view(context, perspective, language)),
  );

  // McpVerification.
  server.registerTool(
    "verify",
    {
      description:
        "Verifies a System against a profile of rules: by default its own profile setting, or the standard rules. Structural errors must be solved first.",
      inputSchema: { context: CONTEXT, script: z.string().optional().describe("a Python rule script, or 'std'"), profile: z.string().optional() },
    },
    ({ context, script, profile }) => guarded(() => host.verify(context, script, profile)),
  );
  server.registerTool(
    "export_specification",
    { description: "The System's specification, in Markdown: the contract an implementation must satisfy.", inputSchema: { context: CONTEXT } },
    ({ context }) => guarded(async () => (await host.specification(context)).markdown),
  );

  // The catalog.
  server.registerTool(
    "search_catalog",
    { description: "Searches the catalog of standard Languages, Domains and Mediations to import.", inputSchema: { text: z.string().optional(), tag: z.string().optional() } },
    ({ text: query, tag }) => guarded(() => host.catalog(query, tag)),
  );
  server.registerTool(
    "import_package",
    { description: "Imports a catalog package, by id, or a package file, into a System.", inputSchema: { context: CONTEXT, package: z.string().optional(), path: z.string().optional() } },
    ({ context, package: id, path }) =>
      guarded(async () => host.importPackage(context, await session(context), id !== undefined ? { package: id } : { path: path ?? "" })),
  );
  server.registerTool(
    "export_selection",
    {
      description: "Exports a selection, with everything it references, as a package; written to `path` if given.",
      inputSchema: { context: CONTEXT, ids: z.array(z.string()), name: z.string(), path: z.string().optional() },
    },
    ({ context, ids, name, path }) => guarded(() => host.exportSelection(context, ids, name, path)),
  );

  // McpInspection: Views as resources.
  server.registerResource(
    "view",
    new ResourceTemplate("systemathic://{context}/views/{perspective}", {
      list: async () => ({
        resources: (await host.contexts()).flatMap((c) =>
          perspectives
            .filter((p) => p.needs === undefined)
            .map((p) => ({ uri: `systemathic://${c.id}/views/${p.perspective}`, name: `${c.name}: ${p.title}`, mimeType: "application/json" })),
        ),
      }),
    }),
    { description: "A point of view on an open System, as structured data.", mimeType: "application/json" },
    async (uri, { context, perspective }) => ({
      contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(await host.view(String(context), String(perspective)), null, 2) }],
    }),
  );

  return server;
}
