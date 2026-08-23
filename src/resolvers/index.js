import Resolver from "@forge/resolver";
import { registerIssuePanelResolvers } from "./issue-panel.js";
import { registerProjectReportResolvers } from "./project-report.js";
import { registerMappingResolvers } from "./mapping.js";
import { registerAdminHealthResolvers } from "./admin-health.js";

const resolver = new Resolver();

registerIssuePanelResolvers(resolver);
registerProjectReportResolvers(resolver);
registerMappingResolvers(resolver);
registerAdminHealthResolvers(resolver);

export const handler = resolver.getDefinitions();
