/**
 * Writes the standard catalog, catalog/*.systemathic.json, from the descriptions below.
 *
 * Each Package is an ordinary System file: library content is stored exactly like any other
 * System. Its content is Components, brought in beside the root of the System that imports
 * it. Each vocabulary is a Component that owns its Language, offers its Interactions, and
 * defines a Medium over it, whose call is one of them. What the catalog says about a Package —
 * its name, what it is, its tags — is a `catalog` attachment. Ids are stable across Packages
 * (the HTTP Component is `pkg.http`, its Language `lib.http`, wherever they appear), which is
 * what lets "HTTP over TCP" stack on an HTTP that was imported before.
 *
 *   npx tsx scripts/build-catalog.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

type Rel = [a: string, aEnd: string, aRange: string, b: string, bEnd: string, bRange: string];
type Op = [name: string, params: [string, string][], output: string];
interface VocabularySpec {
  key: string;
  name: string;
  entities: string[];
  relationships?: Rel[];
  interactions: Op[];
  formulas?: string[];
  /** The Medium it defines: its name, and which Interaction is its call. */
  medium: [name: string, call: string];
}

const slug = (text: string) => text.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase();
const noImports = { components: [] as string[], interactions: [] as string[], transformations: [] as string[], mediums: [] as string[] };

/** A vocabulary, as the Component that owns its Language, offers its Interactions and defines its Medium. */
function vocabulary(spec: VocabularySpec) {
  const language = `lib.${spec.key}`;
  const component = `pkg.${spec.key}`;
  const entity = (name: string) => {
    if (!spec.entities.includes(name)) throw new Error(`${spec.name} has no Entity ${name}`);
    return `${language}.${slug(name)}`;
  };
  const interaction = (name: string) => {
    if (!spec.interactions.some(([op]) => op === name)) throw new Error(`${spec.name} has no Interaction ${name}`);
    return `${component}.${slug(name)}`;
  };
  return {
    id: component,
    name: spec.name,
    uses: [language],
    imports: noImports,
    implements: [] as string[],
    languages: [
      {
        id: language,
        name: spec.name,
        extends: [],
        entities: spec.entities.map((name) => ({ id: entity(name), name, extends: [] })),
        relationships: (spec.relationships ?? []).map(([a, aEnd, aRange, b, bEnd, bRange]) => {
          const rel = `${language}.${slug(aEnd)}-${slug(bEnd)}`;
          const end = (name: string, at: string, range: string) => {
            const [min, max] = range.split("..");
            return { id: `${rel}.${name}`, name, entity: entity(at), min: Number(min), max: max === "N" ? "N" : Number(max) };
          };
          return { id: rel, ends: [end(aEnd, a, aRange), end(bEnd, b, bRange)] };
        }),
        formulas: (spec.formulas ?? []).map((text, index) => ({ id: `${language}.axiom${index}`, text })),
      },
    ],
    interactions: spec.interactions.map(([name, params, output]) => ({
      id: interaction(name),
      name,
      language,
      parameters: params.map(([p, type]) => ({ id: `${interaction(name)}.${slug(p)}`, name: p, type: entity(type) })),
      output: entity(output),
    })),
    transformations: [] as unknown[],
    mediums: [{ id: `${component}.medium`, name: spec.medium[0], language, call: interaction(spec.medium[1]) }],
    deployments: [],
    components: [],
  };
}

const V = {
  bytes: vocabulary({
    key: "bytes",
    name: "Bytes",
    entities: ["Byte", "ByteString"],
    relationships: [
      ["ByteString", "string", "0..N", "Byte", "bytes", "0..N"],
      ["Byte", "previous", "0..1", "Byte", "next", "0..1"],
    ],
    interactions: [
      ["concat", [["first", "ByteString"], ["second", "ByteString"]], "ByteString"],
      ["transfer", [["data", "ByteString"]], "ByteString"],
    ],
    medium: ["Bytes", "transfer"],
  }),
  json: vocabulary({
    key: "json",
    name: "JSON",
    entities: ["Value", "Object", "Member", "Array", "String", "Number", "Boolean", "Null"],
    relationships: [
      ["Value", "value", "0..1", "Object", "object", "0..1"],
      ["Value", "value", "0..1", "Array", "array", "0..1"],
      ["Value", "value", "0..1", "String", "string", "0..1"],
      ["Value", "value", "0..1", "Number", "number", "0..1"],
      ["Value", "value", "0..1", "Boolean", "boolean", "0..1"],
      ["Value", "value", "0..1", "Null", "null", "0..1"],
      ["Object", "object", "1..1", "Member", "members", "0..N"],
      ["Member", "member", "0..N", "String", "key", "1..1"],
      ["Member", "holder", "0..1", "Value", "content", "1..1"],
      ["Array", "container", "0..N", "Value", "items", "0..N"],
    ],
    formulas: [
      "all v in Value. (some v.object and no v.array and no v.string and no v.number and no v.boolean and no v.null) or (some v.array and no v.object and no v.string and no v.number and no v.boolean and no v.null) or (some v.string and no v.object and no v.array and no v.number and no v.boolean and no v.null) or (some v.number and no v.object and no v.array and no v.string and no v.boolean and no v.null) or (some v.boolean and no v.object and no v.array and no v.string and no v.number and no v.null) or (some v.null and no v.object and no v.array and no v.string and no v.number and no v.boolean)",
    ],
    interactions: [["transfer", [["value", "Value"]], "Value"]],
    medium: ["JSON", "transfer"],
  }),
  ethernet: vocabulary({
    key: "ethernet",
    name: "Ethernet",
    entities: ["Frame", "MacAddress", "EtherType", "Payload"],
    relationships: [
      ["Frame", "sent", "0..N", "MacAddress", "source", "1..1"],
      ["Frame", "received", "0..N", "MacAddress", "destination", "1..1"],
      ["Frame", "frames", "0..N", "EtherType", "type", "1..1"],
      ["Frame", "frame", "1..1", "Payload", "payload", "1..1"],
    ],
    interactions: [["transmit", [["frame", "Frame"]], "Frame"]],
    medium: ["Ethernet", "transmit"],
  }),
  ip: vocabulary({
    key: "ip",
    name: "IP",
    entities: ["Packet", "Address", "Protocol", "Payload"],
    relationships: [
      ["Packet", "sent", "0..N", "Address", "source", "1..1"],
      ["Packet", "received", "0..N", "Address", "destination", "1..1"],
      ["Packet", "packets", "0..N", "Protocol", "protocol", "1..1"],
      ["Packet", "packet", "1..1", "Payload", "payload", "1..1"],
    ],
    interactions: [["route", [["packet", "Packet"]], "Packet"]],
    medium: ["IP", "route"],
  }),
  tcp: vocabulary({
    key: "tcp",
    name: "TCP",
    entities: ["Connection", "Endpoint", "Port", "Stream", "Segment"],
    relationships: [
      ["Connection", "outgoing", "0..N", "Endpoint", "local", "1..1"],
      ["Connection", "incoming", "0..N", "Endpoint", "remote", "1..1"],
      ["Endpoint", "endpoints", "0..N", "Port", "port", "1..1"],
      ["Connection", "connection", "1..1", "Stream", "stream", "1..1"],
      ["Stream", "stream", "1..1", "Segment", "segments", "0..N"],
    ],
    interactions: [
      ["connect", [["local", "Endpoint"], ["remote", "Endpoint"]], "Connection"],
      ["exchange", [["stream", "Stream"]], "Stream"],
      ["close", [["connection", "Connection"]], "Connection"],
    ],
    medium: ["TCP", "exchange"],
  }),
  http: vocabulary({
    key: "http",
    name: "HTTP",
    entities: ["Request", "Response", "Method", "Target", "Header", "Body", "Status"],
    relationships: [
      ["Request", "requests", "0..N", "Method", "method", "1..1"],
      ["Request", "requests", "0..N", "Target", "target", "1..1"],
      ["Request", "request", "0..1", "Header", "headers", "0..N"],
      ["Request", "request", "0..1", "Body", "body", "0..1"],
      ["Response", "responses", "0..N", "Status", "status", "1..1"],
      ["Response", "response", "0..1", "Header", "headers", "0..N"],
      ["Response", "response", "0..1", "Body", "body", "0..1"],
    ],
    interactions: [["exchange", [["request", "Request"]], "Response"]],
    medium: ["HTTP", "exchange"],
  }),
  rest: vocabulary({
    key: "rest",
    name: "REST",
    entities: ["Resource", "Collection", "Identifier", "Representation"],
    relationships: [
      ["Collection", "collection", "0..1", "Resource", "members", "0..N"],
      ["Resource", "resource", "1..1", "Identifier", "identifier", "1..1"],
      ["Resource", "resource", "1..1", "Representation", "representations", "0..N"],
    ],
    interactions: [
      ["get", [["resource", "Identifier"]], "Representation"],
      ["put", [["resource", "Identifier"], ["state", "Representation"]], "Representation"],
      ["create", [["collection", "Collection"], ["state", "Representation"]], "Identifier"],
      ["delete", [["resource", "Identifier"]], "Identifier"],
      ["transfer", [["representation", "Representation"]], "Representation"],
    ],
    medium: ["REST", "transfer"],
  }),
  websocket: vocabulary({
    key: "websocket",
    name: "WebSocket",
    entities: ["Connection", "Message", "Data"],
    relationships: [
      ["Connection", "connection", "1..1", "Message", "messages", "0..N"],
      ["Message", "message", "1..1", "Data", "data", "1..1"],
    ],
    interactions: [
      ["open", [["peer", "Connection"]], "Connection"],
      ["send", [["message", "Message"]], "Message"],
      ["close", [["connection", "Connection"]], "Connection"],
    ],
    medium: ["WebSocket", "send"],
  }),
  sql: vocabulary({
    key: "sql",
    name: "SQL",
    entities: ["Table", "Column", "Row", "Value", "Query", "Result"],
    relationships: [
      ["Table", "table", "1..1", "Column", "columns", "1..N"],
      ["Table", "table", "1..1", "Row", "rows", "0..N"],
      ["Row", "row", "1..1", "Value", "values", "0..N"],
      ["Column", "column", "1..1", "Value", "values", "0..N"],
      ["Result", "result", "1..1", "Row", "rows", "0..N"],
    ],
    formulas: ["all v in Value. v.row.table == v.column.table"],
    interactions: [["execute", [["query", "Query"]], "Result"]],
    medium: ["SQL", "execute"],
  }),
  "in-process": vocabulary({
    key: "in-process",
    name: "In-process",
    entities: ["Reference"],
    interactions: [["pass", [["reference", "Reference"]], "Reference"]],
    medium: ["In-process", "pass"],
  }),
};

/** HTTP over TCP: a realization of the HTTP Medium's call over TCP's, imported by whoever mediates HTTP over TCP. */
const httpOverTcp = {
  id: "pkg.http-over-tcp",
  name: "HttpOverTcp",
  uses: ["lib.http", "lib.tcp"],
  imports: { ...noImports, components: ["pkg.http", "pkg.tcp"] },
  implements: [],
  languages: [],
  interactions: [],
  // A request goes down as a stream; a stream comes back up as the response. How a message's
  // parts are laid out in its stream is the realization's business.
  transformations: [
    {
      id: "pkg.http-over-tcp.down",
      name: "HTTP messages as TCP streams",
      parameters: [{ id: "pkg.http-over-tcp.down.request", name: "request", type: "lib.http.request" }],
      output: "lib.tcp.stream",
    },
    {
      id: "pkg.http-over-tcp.up",
      name: "TCP streams as HTTP messages",
      parameters: [{ id: "pkg.http-over-tcp.up.stream", name: "stream", type: "lib.tcp.stream" }],
      output: "lib.http.response",
    },
  ],
  mediums: [],
  deployments: [],
  components: [],
};

interface PackageSpec {
  key: string;
  name: string;
  about: string;
  tags: string[];
  components: unknown[];
}

const single = (key: keyof typeof V, about: string, tags: string[]): PackageSpec => ({ key, name: V[key].name, about, tags, components: [V[key]] });

const packages: PackageSpec[] = [
  single("bytes", "Bytes and byte strings: the lowest representation of data.", ["encoding", "data"]),
  single("json", "JSON values: objects, arrays, strings, numbers, booleans and null.", ["encoding", "data"]),
  single("ethernet", "Ethernet frames between MAC addresses.", ["network", "link"]),
  single("ip", "IP packets between addresses.", ["network", "internet"]),
  single("tcp", "TCP connections between endpoints, carrying ordered streams.", ["network", "transport"]),
  single("http", "HTTP requests and responses.", ["web", "application"]),
  single("rest", "REST resources, identified and transferred as representations.", ["web", "api"]),
  single("websocket", "WebSocket connections carrying messages.", ["web", "realtime"]),
  single("sql", "SQL tables, rows and queries.", ["data", "storage"]),
  single("in-process", "The process itself: a use passed within one process, over a reference.", ["process", "primitive"]),
  {
    key: "http-over-tcp",
    name: "HTTP over TCP",
    about: "HTTP's call carried over TCP's: the HTTP and TCP Components, and a realization between them. Import it, and mediate a Connection over HTTP, then TCP.",
    tags: ["web", "network", "mediation"],
    components: [V.http, V.tcp, httpOverTcp],
  },
];

export function files(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of packages) {
    const file = {
      format: "systemathic/3",
      design: { id: `lib.${p.key}.system`, name: p.name, root: p.components[0], packages: p.components.slice(1) },
      attachments: [{ owner: "catalog", data: { package: p.key, about: p.about, tags: p.tags } }],
    };
    out[`${p.key}.systemathic.json`] = JSON.stringify(file, null, 2) + "\n";
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dir = fileURLToPath(new URL("../catalog/", import.meta.url));
  mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files())) writeFileSync(dir + name, content);
  console.log(`wrote ${Object.keys(files()).length} packages to ${dir}`);
}
