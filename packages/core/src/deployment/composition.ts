/**
 * What Deployment owns: a Component its Deployments, a Deployment its Instances and
 * Connections. An Instance exists only while its Component does; a Connection only while it
 * goes from something, to something, with some What.
 */
import { composition } from "../kernel/removal.js";

export const deploymentComposition = composition(
  {
    Component: ["deployments"],
    Deployment: ["instances", "connections"],
  },
  [],
  {
    Instance: [["of"]],
    Connection: [["from"], ["to", "toComponent"], ["what"]],
  },
);
