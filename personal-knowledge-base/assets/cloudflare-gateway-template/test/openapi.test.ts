import { describe, expect, it } from "vitest";

import { openApiDocument } from "../src/openapi";

type SchemaObject = {
  type?: string;
  properties?: Record<string, unknown>;
  required?: string[];
};

type OperationObject = {
  "x-openai-isConsequential"?: boolean;
  responses?: Record<
    string,
    {
      content?: Record<string, { schema?: { $ref?: string } }>;
    }
  >;
};

type OpenApiDocument = {
  components?: {
    schemas?: Record<string, SchemaObject>;
  };
  paths?: Record<string, Record<string, OperationObject>>;
};

describe("OpenAPI document", () => {
  it("publishes concrete component schemas for GPT Actions", () => {
    const document = openApiDocument("https://gateway.example") as OpenApiDocument;
    const schemas = document.components?.schemas;

    expect(schemas).toBeDefined();
    expect(schemas?.BaseResult?.type).toBe("object");
    expect(schemas?.BaseResult?.properties).toBeDefined();
    expect(schemas?.EvidenceResult?.properties).toBeDefined();
    expect(schemas?.QueryResponse?.properties).toBeDefined();
    expect(schemas?.VerifiedSource?.properties).toBeDefined();
    expect(schemas?.VerifiedSourceText?.properties).toBeDefined();
    expect(schemas?.ErrorResponse?.properties).toBeDefined();
  });

  it("references named schemas from successful responses", () => {
    const document = openApiDocument("https://gateway.example") as OpenApiDocument;

    const querySchema =
      document.paths?.["/v1/query"]?.post?.responses?.["200"]?.content?.["application/json"]
        ?.schema;
    const sourceSchema =
      document.paths?.["/v1/sources/{slug}"]?.get?.responses?.["200"]?.content?.[
        "application/json"
      ]?.schema;
    const sourceTextSchema =
      document.paths?.["/v1/sources/{slug}/text"]?.get?.responses?.["200"]?.content?.[
        "application/json"
      ]?.schema;

    expect(querySchema?.$ref).toBe("#/components/schemas/QueryResponse");
    expect(sourceSchema?.$ref).toBe("#/components/schemas/VerifiedSource");
    expect(sourceTextSchema?.$ref).toBe("#/components/schemas/VerifiedSourceText");
  });

  it("marks the read-only query POST as non-consequential", () => {
    const document = openApiDocument("https://gateway.example") as OpenApiDocument;

    expect(document.paths?.["/v1/query"]?.post?.["x-openai-isConsequential"]).toBe(false);
  });
});
