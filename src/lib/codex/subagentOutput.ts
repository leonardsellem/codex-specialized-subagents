import { z } from "zod/v4";

export const SubagentDeliverableSchema = z.object({
  path: z.string(),
  description: z.string(),
});

export const SubagentOutputSchema = z.object({
  summary: z.string(),
  deliverables: z.array(SubagentDeliverableSchema),
  open_questions: z.array(z.string()),
  next_actions: z.array(z.string()),
});

export type SubagentOutput = z.infer<typeof SubagentOutputSchema>;

export function getSubagentOutputJsonSchema(): Record<string, unknown> {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    additionalProperties: false,
    required: ["summary", "deliverables", "open_questions", "next_actions"],
    properties: {
      summary: { type: "string" },
      deliverables: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["path", "description"],
          properties: {
            path: { type: "string" },
            description: { type: "string" },
          },
        },
      },
      open_questions: { type: "array", items: { type: "string" } },
      next_actions: { type: "array", items: { type: "string" } },
    },
  };
}

