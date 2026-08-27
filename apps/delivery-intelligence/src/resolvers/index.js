import Resolver from "@forge/resolver";
import { registerDeliveryResolvers } from "./delivery-dashboard.js";

const resolver = new Resolver();
registerDeliveryResolvers(resolver);

export const handler = resolver.getDefinitions();
