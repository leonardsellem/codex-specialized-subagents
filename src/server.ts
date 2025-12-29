import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import path from "node:path";
import { z } from "zod/v4";

import { createRunDir, writeJsonFile } from "./lib/runDirs.js";
import { discoverSkills } from "./lib/skills/discover.js";
import { selectSkills } from "./lib/skills/select.js";

const SandboxSchema = z.enum(["read-only", "workspace-write", "danger-full-access"]);
const SkillsModeSchema = z.enum(["auto", "explicit", "none"]);

const DelegateBaseInputSchema = z.object({
  cwd: z.string().min(1),
  role: z.string().optional().default("specialist"),
  skills_mode: SkillsModeSchema.optional().default("auto"),
  skills: z.array(z.string()).optional(),
  max_skills: z.number().int().positive().optional().default(6),
  include_repo_skills: z.boolean().optional().default(true),
  include_global_skills: z.boolean().optional().default(true),
  sandbox: SandboxSchema.optional().default("read-only"),
  skip_git_repo_check: z.boolean().optional().default(false),
});

const DelegateRunInputSchema = DelegateBaseInputSchema.extend({
  task: z.string().min(1),
});

const DelegateResumeInputSchema = DelegateBaseInputSchema.extend({
  thread_id: z.string().min(1),
  task: z.string().optional(),
});

const SelectedSkillSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  origin: z.enum(["repo", "global"]),
  path: z.string(),
});

const DeliverableSchema = z.object({
  path: z.string(),
  description: z.string(),
});

const ArtifactSchema = z.object({
  name: z.string(),
  path: z.string(),
});

const DelegateToolOutputSchema = z.object({
  run_id: z.string(),
  run_dir: z.string(),
  subagent_thread_id: z.string().nullable(),
  selected_skills: z.array(SelectedSkillSchema),
  summary: z.string(),
  deliverables: z.array(DeliverableSchema),
  open_questions: z.array(z.string()),
  next_actions: z.array(z.string()),
  artifacts: z.array(ArtifactSchema),
  timing: z.object({
    started_at: z.string(),
    finished_at: z.string().nullable(),
    duration_ms: z.number().nullable(),
  }),
  status: z.enum(["completed", "failed", "cancelled"]),
  error: z.string().nullable(),
});

export async function startServer(): Promise<void> {
  const server = new McpServer({
    name: "codex-specialized-subagents",
    version: "0.1.0",
  });

  server.registerTool(
    "delegate.run",
    {
      title: "Delegate Run",
      description:
        "Spawn a new specialist Codex sub-agent run (v1 stub: creates a run dir and writes request.json).",
      inputSchema: DelegateRunInputSchema,
      outputSchema: DelegateToolOutputSchema,
    },
    async (args) => {
      const startedAt = new Date();
      try {
        const { runId, runDir } = await createRunDir();
        const requestPath = path.join(runDir, "request.json");
        const skillsIndexPath = path.join(runDir, "skills_index.json");
        const selectedSkillsPath = path.join(runDir, "selected_skills.json");

        await writeJsonFile(requestPath, {
          tool: "delegate.run",
          received_at: startedAt.toISOString(),
          request: args,
        });

        const skillsIndex = await discoverSkills({
          cwd: args.cwd,
          includeRepoSkills: args.include_repo_skills,
          includeGlobalSkills: args.include_global_skills,
        });
        await writeJsonFile(skillsIndexPath, skillsIndex);

        const selection = selectSkills({
          mode: args.skills_mode,
          skillsIndex: skillsIndex.skills,
          task: args.task,
          requested: args.skills,
          maxSkills: args.max_skills,
        });
        await writeJsonFile(selectedSkillsPath, {
          mode: args.skills_mode,
          max_skills: args.max_skills,
          requested: args.skills ?? [],
          selected: selection.selected,
          warnings: selection.warnings,
          errors: selection.errors,
        });

        const finishedAt = new Date();
        return {
          content: [
            {
              type: "text",
              text: `Stub: created run directory at ${runDir}`,
            },
          ],
          structuredContent: {
            run_id: runId,
            run_dir: runDir,
            subagent_thread_id: null,
            selected_skills: selection.selected,
            summary:
              "Stub: created run directory, indexed skills, and wrote request.json (delegation not implemented yet).",
            deliverables: [],
            open_questions: [...selection.warnings],
            next_actions: [
              "Inspect run_dir artifacts",
              ...(selection.errors.length > 0
                ? ["Fix skill selection errors (skills_mode/skills names) and retry"]
                : ["Implement codex exec integration"]),
            ],
            artifacts: [
              { name: "request.json", path: requestPath },
              { name: "skills_index.json", path: skillsIndexPath },
              { name: "selected_skills.json", path: selectedSkillsPath },
            ],
            timing: {
              started_at: startedAt.toISOString(),
              finished_at: finishedAt.toISOString(),
              duration_ms: finishedAt.getTime() - startedAt.getTime(),
            },
            status: selection.errors.length > 0 ? "failed" : "completed",
            error: selection.errors.length > 0 ? selection.errors.join("; ") : null,
          },
        };
      } catch (err) {
        const finishedAt = new Date();
        return {
          content: [
            {
              type: "text",
              text: `Failed to create run directory: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          structuredContent: {
            run_id: "unknown",
            run_dir: "unknown",
            subagent_thread_id: null,
            selected_skills: [],
            summary: "Failed to create run directory (stub).",
            deliverables: [],
            open_questions: [],
            next_actions: [],
            artifacts: [],
            timing: {
              started_at: startedAt.toISOString(),
              finished_at: finishedAt.toISOString(),
              duration_ms: finishedAt.getTime() - startedAt.getTime(),
            },
            status: "failed",
            error: err instanceof Error ? err.message : String(err),
          },
        };
      }
    },
  );

  server.registerTool(
    "delegate.resume",
    {
      title: "Delegate Resume",
      description:
        "Resume an existing specialist Codex sub-agent thread (v1 stub: creates a run dir and writes request.json).",
      inputSchema: DelegateResumeInputSchema,
      outputSchema: DelegateToolOutputSchema,
    },
    async (args) => {
      const startedAt = new Date();
      try {
        const { runId, runDir } = await createRunDir();
        const requestPath = path.join(runDir, "request.json");
        const skillsIndexPath = path.join(runDir, "skills_index.json");
        const selectedSkillsPath = path.join(runDir, "selected_skills.json");

        await writeJsonFile(requestPath, {
          tool: "delegate.resume",
          received_at: startedAt.toISOString(),
          request: args,
        });

        const skillsIndex = await discoverSkills({
          cwd: args.cwd,
          includeRepoSkills: args.include_repo_skills,
          includeGlobalSkills: args.include_global_skills,
        });
        await writeJsonFile(skillsIndexPath, skillsIndex);

        const selectionMode =
          args.skills_mode === "auto" && !args.task ? "none" : args.skills_mode;

        const selection = selectSkills({
          mode: selectionMode,
          skillsIndex: skillsIndex.skills,
          task: args.task,
          requested: args.skills,
          maxSkills: args.max_skills,
        });
        const selectionWarnings =
          args.skills_mode === "auto" && !args.task
            ? [
                "skills_mode=auto ignored because delegate.resume task is empty; selected_skills is empty.",
                ...selection.warnings,
              ]
            : [...selection.warnings];

        await writeJsonFile(selectedSkillsPath, {
          mode: selectionMode,
          max_skills: args.max_skills,
          requested: args.skills ?? [],
          selected: selection.selected,
          warnings: selectionWarnings,
          errors: selection.errors,
        });

        const finishedAt = new Date();
        return {
          content: [
            {
              type: "text",
              text: `Stub: created resume run directory at ${runDir}`,
            },
          ],
          structuredContent: {
            run_id: runId,
            run_dir: runDir,
            subagent_thread_id: args.thread_id,
            selected_skills: selection.selected,
            summary:
              "Stub: created run directory, indexed skills, and wrote request.json (resume not implemented yet).",
            deliverables: [],
            open_questions: [...selectionWarnings],
            next_actions: [
              "Inspect run_dir artifacts",
              ...(selection.errors.length > 0
                ? ["Fix skill selection errors (skills_mode/skills names) and retry"]
                : ["Implement resume via codex exec resume"]),
            ],
            artifacts: [
              { name: "request.json", path: requestPath },
              { name: "skills_index.json", path: skillsIndexPath },
              { name: "selected_skills.json", path: selectedSkillsPath },
            ],
            timing: {
              started_at: startedAt.toISOString(),
              finished_at: finishedAt.toISOString(),
              duration_ms: finishedAt.getTime() - startedAt.getTime(),
            },
            status: selection.errors.length > 0 ? "failed" : "completed",
            error: selection.errors.length > 0 ? selection.errors.join("; ") : null,
          },
        };
      } catch (err) {
        const finishedAt = new Date();
        return {
          content: [
            {
              type: "text",
              text: `Failed to create run directory: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          structuredContent: {
            run_id: "unknown",
            run_dir: "unknown",
            subagent_thread_id: null,
            selected_skills: [],
            summary: "Failed to create run directory (stub).",
            deliverables: [],
            open_questions: [],
            next_actions: [],
            artifacts: [],
            timing: {
              started_at: startedAt.toISOString(),
              finished_at: finishedAt.toISOString(),
              duration_ms: finishedAt.getTime() - startedAt.getTime(),
            },
            status: "failed",
            error: err instanceof Error ? err.message : String(err),
          },
        };
      }
    },
  );

  await server.connect(new StdioServerTransport());
}
