/**
 * Writes the standard catalog, catalog/*.systemathic.json, from the descriptions below.
 *
 * Each Package is an ordinary System file: library content is stored exactly like any other
 * System. What the catalog says about it — its name, what it is, its tags — is a `catalog`
 * attachment. Ids are stable across Packages (the HTTP Language is `lib.http` wherever it
 * appears), which is what lets "HTTP over TCP" stack on an HTTP that was imported before.
 *
 *   npx tsx scripts/build-catalog.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

type Rel = [a: string, aEnd: string, aRange: string, b: string, bEnd: string, bRange: string];
type Op = [name: string, params: [string, string][], output: string];
interface LanguageSpec {
  key: string;
  name: string;
  entities: string[];
  relationships?: Rel[];
  interactions?: Op[];
  formulas?: string[];
}

const slug = (text: string) => text.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase();

function language(spec: LanguageSpec) {
  const id = `lib.${spec.key}`;
  const entity = (name: string) => {
    if (!spec.entities.includes(name)) throw new Error(`${spec.name} has no Entity ${name}`);
    return `${id}.${slug(name)}`;
  };
  return {
    id,
    name: spec.name,
    entities: spec.entities.map((name) => ({ id: entity(name), name })),
    relationships: (spec.relationships ?? []).map(([a, aEnd, aRange, b, bEnd, bRange]) => {
      const rel = `${id}.${slug(aEnd)}-${slug(bEnd)}`;
      const end = (name: string, at: string, range: string) => {
        const [min, max] = range.split("..");
        return { id: `${rel}.${name}`, name, entity: entity(at), min: Number(min), max: max === "N" ? "N" : Number(max) };
      };
      return { id: rel, ends: [end(aEnd, a, aRange), end(bEnd, b, bRange)] };
    }),
    formulas: (spec.formulas ?? []).map((text, index) => ({ id: `${id}.axiom${index}`, text })),
    interactions: (spec.interactions ?? []).map(([name, params, output]) => ({
      id: `${id}.${slug(name)}`,
      name,
      parameters: params.map(([p, type]) => ({ id: `${id}.${slug(name)}.${slug(p)}`, name: p, type: entity(type) })),
      output: entity(output),
      primary: null,
      compares: [],
    })),
  };
}

const domain = (l: ReturnType<typeof language>, transformations: unknown[] = []) => ({
  id: `${l.id}.domain`,
  name: l.name,
  languages: [l.id],
  references: [],
  transformations,
});

const L = {
  bytes: language({
    key: "bytes",
    name: "Bytes",
    entities: ["Byte", "ByteString"],
    relationships: [
      ["ByteString", "string", "0..N", "Byte", "bytes", "0..N"],
      ["Byte", "previous", "0..1", "Byte", "next", "0..1"],
    ],
    interactions: [["concat", [["first", "ByteString"], ["second", "ByteString"]], "ByteString"]],
  }),
  json: language({
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
  }),
  ethernet: language({
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
  }),
  ip: language({
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
  }),
  tcp: language({
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
      ["send", [["connection", "Connection"], ["data", "Stream"]], "Connection"],
      ["receive", [["connection", "Connection"]], "Stream"],
      ["close", [["connection", "Connection"]], "Connection"],
    ],
  }),
  http: language({
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
  }),
  rest: language({
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
    ],
  }),
  websocket: language({
    key: "websocket",
    name: "WebSocket",
    entities: ["Connection", "Message", "Data"],
    relationships: [
      ["Connection", "connection", "1..1", "Message", "messages", "0..N"],
      ["Message", "message", "1..1", "Data", "data", "1..1"],
    ],
    interactions: [
      ["open", [["peer", "Connection"]], "Connection"],
      ["send", [["connection", "Connection"], ["message", "Message"]], "Connection"],
      ["close", [["connection", "Connection"]], "Connection"],
    ],
  }),
  sql: language({
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
  }),
};

// HTTP over TCP: the mediation, with a Domain for each side, its mediator and its Transformation.
const httpOverTcp = {
  id: "lib.http-over-tcp",
  name: "HttpOverTcp",
  languages: [L.http.id, L.tcp.id],
  references: [],
  transformations: [
    {
      id: "lib.http-over-tcp.messages",
      name: "HTTP messages as TCP streams",
      source: L.http.id,
      target: L.tcp.id,
      reverse: { context: [] },
      entityMappings: [
        { source: "lib.http.request", targets: ["lib.tcp.stream"] },
        { source: "lib.http.response", targets: ["lib.tcp.stream"] },
        { source: "lib.http.method", targets: ["lib.tcp.segment"] },
        { source: "lib.http.target", targets: ["lib.tcp.segment"] },
        { source: "lib.http.header", targets: ["lib.tcp.segment"] },
        { source: "lib.http.body", targets: ["lib.tcp.segment"] },
        { source: "lib.http.status", targets: ["lib.tcp.segment"] },
      ],
      relationshipMappings: [],
      interactionMappings: [{ source: "lib.http.exchange", targets: ["lib.tcp.send", "lib.tcp.receive"] }],
      // How a message's parts are laid out in its stream is the mediator's business.
      deferred: L.http.relationships.map((relationship) => ({ relationship: relationship.id })),
    },
  ],
};

interface PackageSpec {
  key: string;
  name: string;
  about: string;
  tags: string[];
  languages: ReturnType<typeof language>[];
  domains?: unknown[];
  mediations?: unknown[];
}

const single = (key: keyof typeof L, about: string, tags: string[]): PackageSpec => ({
  key,
  name: L[key].name,
  about,
  tags,
  languages: [L[key]],
  domains: [domain(L[key])],
});

const packages: PackageSpec[] = [
  single("bytes", "Bytes and byte strings: the lowest representation of data.", ["encoding", "data"]),
  single("json", "JSON values: objects, arrays, strings, numbers, booleans and null.", ["encoding", "data"]),
  single("ethernet", "Ethernet frames between MAC addresses.", ["network", "link"]),
  single("ip", "IP packets between addresses.", ["network", "internet"]),
  single("tcp", "TCP connections between endpoints, carrying ordered streams.", ["network", "transport"]),
  single("http", "HTTP requests and responses.", ["web", "application"]),
  single("rest", "REST resources, identified and transferred as representations.", ["web", "api"]),
  single("websocket", "WebSocket connections carrying messages both ways.", ["web", "realtime"]),
  single("sql", "SQL tables, rows and queries.", ["data", "storage"]),
  {
    key: "http-over-tcp",
    name: "HTTP over TCP",
    about: "HTTP carried out over TCP: a Domain for each, the mediator and its Transformation, and the Mediation. Stack it under a design that uses HTTP.",
    tags: ["web", "network", "mediation"],
    languages: [L.http, L.tcp],
    domains: [domain(L.http), domain(L.tcp), httpOverTcp],
    mediations: [{ id: "lib.http-over-tcp.mediation", what: `${L.http.id}.domain`, how: `${L.tcp.id}.domain`, mediator: httpOverTcp.id }],
  },
];

export function files(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of packages) {
    const file = {
      format: "systemathic/1",
      design: { id: `lib.${p.key}.system`, name: p.name, languages: p.languages, domains: p.domains ?? [], mediations: p.mediations ?? [] },
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
