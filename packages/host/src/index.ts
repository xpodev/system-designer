export { HostError, type ContextInfo, type EditInfo, type HostApi, type HostEvent, type OperationInfo, type PackageSummary, type RunInfo } from "./api.js";
export { Host, type HostOptions } from "./host.js";
export { serve, type ServeOptions } from "./server.js";
export { HostClient } from "./client.js";

/** Where a host listens, unless told otherwise: `SYSTEMATHIC_HOST`, or port 4747 on this machine. */
export const DEFAULT_HOST = process.env.SYSTEMATHIC_HOST ?? "http://127.0.0.1:4747";
