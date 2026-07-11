const nullableString = {
  anyOf: [{ type: "string" }, { type: "null" }],
};

const nullableNumber = {
  anyOf: [{ type: "number" }, { type: "null" }],
};

export function openApiDocument(origin: string): Record<string, unknown> {
  return {
    openapi: "3.1.0",
    info: {
      title: "KnowledgeBase Gateway",
      version: "0.1.1",
      description: "Read-only access to the owner's private, source-traceable knowledge base.",
    },
    servers: [{ url: origin }],
    paths: {
      "/v1/query": {
        post: {
          operationId: "queryKnowledgeBase",
          summary: "Search the private knowledge base",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  additionalProperties: false,
                  required: ["query"],
                  properties: {
                    query: { type: "string", minLength: 1, maxLength: 1000 },
                    include_context: {
                      type: "boolean",
                      default: false,
                      description: "Include private persona and project context when relevant.",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Ranked knowledge, verified evidence, optional context, and warnings.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/QueryResponse" },
                },
              },
            },
            "400": {
              description: "Invalid query request.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "401": {
              description: "Invalid bearer token.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/v1/sources/{slug}": {
        get: {
          operationId: "getVerifiedSource",
          summary: "Read one full source page after raw-file integrity verification",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "slug",
              in: "path",
              required: true,
              schema: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
            },
          ],
          responses: {
            "200": {
              description: "Verified source page and the exact Git commit used.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/VerifiedSource" },
                },
              },
            },
            "401": {
              description: "Invalid bearer token.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "404": {
              description: "No verified source was found.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer" },
      },
      schemas: {
        BaseResult: {
          type: "object",
          additionalProperties: false,
          required: ["path", "title", "excerpt", "score", "kind", "commit"],
          properties: {
            path: { type: "string" },
            title: { type: "string" },
            excerpt: { type: "string" },
            score: { type: "number" },
            kind: { type: "string" },
            commit: nullableString,
          },
        },
        EvidenceResult: {
          type: "object",
          additionalProperties: false,
          required: [
            "path",
            "title",
            "excerpt",
            "score",
            "kind",
            "commit",
            "integrityStatus",
            "rawFile",
            "rawSha256",
            "lastVerified",
            "confidence",
            "sourceCount",
          ],
          properties: {
            path: { type: "string" },
            title: { type: "string" },
            excerpt: { type: "string" },
            score: { type: "number" },
            kind: { type: "string" },
            commit: nullableString,
            integrityStatus: { type: "string", enum: ["verified"] },
            rawFile: { type: "string" },
            rawSha256: { type: "string" },
            lastVerified: nullableString,
            confidence: { type: "string" },
            sourceCount: nullableNumber,
          },
        },
        QueryResponse: {
          type: "object",
          additionalProperties: false,
          required: ["knowledge", "evidence", "context", "warnings", "syncedCommit"],
          properties: {
            knowledge: {
              type: "array",
              items: { $ref: "#/components/schemas/BaseResult" },
            },
            evidence: {
              type: "array",
              items: { $ref: "#/components/schemas/EvidenceResult" },
            },
            context: {
              type: "array",
              items: { $ref: "#/components/schemas/BaseResult" },
            },
            warnings: {
              type: "array",
              items: { type: "string" },
            },
            syncedCommit: nullableString,
          },
        },
        VerifiedSource: {
          type: "object",
          additionalProperties: false,
          required: [
            "slug",
            "path",
            "title",
            "content",
            "rawFile",
            "rawSha256",
            "lastVerified",
            "commit",
          ],
          properties: {
            slug: { type: "string" },
            path: { type: "string" },
            title: { type: "string" },
            content: { type: "string" },
            rawFile: { type: "string" },
            rawSha256: { type: "string" },
            lastVerified: nullableString,
            commit: { type: "string" },
          },
        },
        ErrorResponse: {
          type: "object",
          additionalProperties: false,
          required: ["error"],
          properties: {
            error: { type: "string" },
          },
        },
      },
    },
  };
}
