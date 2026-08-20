import Resolver from "@forge/resolver";

const resolver = new Resolver();

resolver.define("getText", () => "Hello World!");

export const handler = resolver.getDefinitions();