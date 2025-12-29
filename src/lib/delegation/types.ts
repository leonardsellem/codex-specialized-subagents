import { z } from "zod/v4";

export const CodexSandboxModeSchema = z.enum(["read-only", "workspace-write", "danger-full-access"]);
export type CodexSandboxMode = z.infer<typeof CodexSandboxModeSchema>;

export const SkillsModeSchema = z.enum(["auto", "explicit", "none"]);
export type SkillsMode = z.infer<typeof SkillsModeSchema>;

export const ThinkingLevelSchema = z.enum(["low", "medium", "high"]);
export type ThinkingLevel = z.infer<typeof ThinkingLevelSchema>;

export const SelectedSkillSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  origin: z.enum(["repo", "global"]),
  path: z.string(),
});
export type SelectedSkill = z.infer<typeof SelectedSkillSchema>;

export const DeliverableSchema = z.object({
  path: z.string(),
  description: z.string(),
});
export type Deliverable = z.infer<typeof DeliverableSchema>;

export const ArtifactSchema = z.object({
  name: z.string(),
  path: z.string(),
});
export type Artifact = z.infer<typeof ArtifactSchema>;

export const AutopilotInputSchema = z.object({
  task: z.string().min(1),
  cwd: z.string().min(1).optional(),
  sandbox: CodexSandboxModeSchema.optional().default("workspace-write"),

  role: z.string().optional().default("specialist"),
  skills_mode: SkillsModeSchema.optional().default("auto"),
  skills: z.array(z.string()).optional(),
  max_skills: z.number().int().positive().optional().default(6),
  include_repo_skills: z.boolean().optional().default(true),
  include_global_skills: z.boolean().optional().default(true),
  skip_git_repo_check: z.boolean().optional().default(false),

  max_agents: z.number().int().positive().optional().default(3),
  max_parallel: z.number().int().positive().optional().default(2),
});

export type AutopilotInput = z.infer<typeof AutopilotInputSchema>;

export const AutopilotDecisionSchema = z.object({
  should_delegate: z.boolean(),
  reason: z.string().min(1),
});
export type AutopilotDecision = z.infer<typeof AutopilotDecisionSchema>;

export const AutopilotJobSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[A-Za-z0-9_-]+$/, "job id must be safe for paths"),
  title: z.string().min(1),
  thinking_level: ThinkingLevelSchema,
  role: z.string().optional().default("specialist"),
  task: z.string().min(1),
  sandbox: CodexSandboxModeSchema,
  model: z.string().optional(),
  config_overrides: z.array(z.string()).optional(),
  skills_mode: SkillsModeSchema.optional().default("auto"),
  skills: z.array(z.string()).optional(),
  max_skills: z.number().int().positive().optional().default(6),
  include_repo_skills: z.boolean().optional().default(true),
  include_global_skills: z.boolean().optional().default(true),
  skip_git_repo_check: z.boolean().optional().default(false),
});

export type AutopilotJob = z.infer<typeof AutopilotJobSchema>;

export const AutopilotPlanSchema = z.object({
  jobs: z.array(AutopilotJobSchema),
});
export type AutopilotPlan = z.infer<typeof AutopilotPlanSchema>;

export const AutopilotTimingSchema = z.object({
  started_at: z.string(),
  finished_at: z.string().nullable(),
  duration_ms: z.number().nullable(),
});
export type AutopilotTiming = z.infer<typeof AutopilotTimingSchema>;

export const AutopilotAggregateSchema = z.object({
  summary: z.string(),
  deliverables: z.array(DeliverableSchema),
  open_questions: z.array(z.string()),
  next_actions: z.array(z.string()),
});
export type AutopilotAggregate = z.infer<typeof AutopilotAggregateSchema>;

export const AutopilotJobResultSchema = z.object({
  job_id: z.string(),
  title: z.string(),
  run_dir: z.string(),
  subagent_thread_id: z.string().nullable(),
  selected_skills: z.array(SelectedSkillSchema),
  summary: z.string(),
  deliverables: z.array(DeliverableSchema),
  open_questions: z.array(z.string()),
  next_actions: z.array(z.string()),
  artifacts: z.array(ArtifactSchema),
  timing: AutopilotTimingSchema,
  status: z.enum(["completed", "failed", "cancelled", "skipped"]),
  error: z.string().nullable(),
});
export type AutopilotJobResult = z.infer<typeof AutopilotJobResultSchema>;

export const AutopilotToolOutputSchema = z.object({
  run_id: z.string(),
  run_dir: z.string(),
  decision: AutopilotDecisionSchema,
  plan: AutopilotPlanSchema,
  jobs: z.array(AutopilotJobResultSchema),
  aggregate: AutopilotAggregateSchema,
  artifacts: z.array(ArtifactSchema),
  timing: AutopilotTimingSchema,
  status: z.enum(["completed", "failed", "cancelled"]),
  error: z.string().nullable(),
});

export type AutopilotToolOutput = z.infer<typeof AutopilotToolOutputSchema>;
