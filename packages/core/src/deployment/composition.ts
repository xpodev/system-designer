/**
 * What Deployment owns: a Component the Deployments it keeps; a Deployment its Instances,
 * Connections, Imports (its needs) and the Exports by which it exposes placements; an identity
 * its Steps. A Deployment exists only while its box and its keeper do; an Instance only while
 * its Component does; an Import only while the Component it is from does, or, for an identity,
 * while it has Steps; a Step only while its placement does; a Connection only while it goes
 * from something, to something, with some What.
 */
import { composition } from "../kernel/removal.js";

export const deploymentComposition = composition(
  {
    Component: ["kept"],
    Deployment: ["instances", "connections", "imports", "exposes"],
    Import: ["steps"],
  },
  [],
  {
    Deployment: [["component"], ["keeper"]],
    Instance: [["of"]],
    Import: [["from", "steps"]],
    Step: [["instance"]],
    Connection: [["from"], ["to", "toComponent", "toIdentity"], ["what"]],
  },
);
