import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import path from "node:path";
import { promises as fs } from "node:fs";
import { z } from "zod/v4";

import { createRunDir, writeJsonFile, writeTextFile } from "./lib/runDirs.js";
import { runCodexExec, runCodexExecResume } from "./lib/codex/runCodexExec.js";
import { SubagentOutputSchema } from "./lib/codex/subagentOutput.js";
import { buildCodexConfigOverrides } from "./lib/codex/configOverrides.js";
import { runAutopilot } from "./lib/delegation/autopilot.js";
import { AutopilotInputSchema, AutopilotToolOutputSchema } from "./lib/delegation/types.js";
import { formatAutopilotToolContent, formatDelegateToolContent } from "./lib/mcp/formatToolContent.js";
import { createThrottledCodexExecProgressLogger, type LogFn } from "./lib/mcp/progressLogger.js";
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
  model: z.string().optional(),
  reasoning_effort: z.string().optional(),
  config_overrides: z.array(z.string()).optional(),
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

type DelegateToolOutput = z.infer<typeof DelegateToolOutputSchema>;

export async function startServer(): Promise<void> {
  const server = new McpServer({
    name: "codex-specialized-subagents",
    version: "0.1.0",
  }, { capabilities: { logging: {} } });

  server.registerTool(
    "delegate_autopilot",
    {
      title: "Delegate Autopilot",
      description:
        "Decide whether delegation is worthwhile, and if so orchestrate one or more specialist Codex sub-agent runs.",
      inputSchema: AutopilotInputSchema,
      outputSchema: AutopilotToolOutputSchema,
    },
    async (args, extra) => {
      const startedAt = new Date();
      try {
        const log: LogFn = async (level, message) => {
          try {
            await server.sendLoggingMessage({ level, data: message }, extra.sessionId);
          } catch {
            // ignore
          }
        };

        const output = await runAutopilot(args, { signal: extra.signal, log });
        return {
          content: [
            {
              type: "text",
              text: formatAutopilotToolContent(output),
            },
          ],
          structuredContent: output,
        };
      } catch (err) {
        const finishedAt = new Date();
        const message = err instanceof Error ? err.message : String(err);

        const structuredContent = {
          run_id: "unknown",
          run_dir: "unknown",
          decision: { should_delegate: false, reason: "Autopilot failed." },
          plan: { jobs: [] },
          jobs: [],
          aggregate: {
            summary: "Autopilot failed.",
            deliverables: [],
            open_questions: [],
            next_actions: [],
          },
          artifacts: [],
          timing: {
            started_at: startedAt.toISOString(),
            finished_at: finishedAt.toISOString(),
            duration_ms: finishedAt.getTime() - startedAt.getTime(),
          },
          status: "failed" as const,
          error: message,
        };

        return {
          content: [
            {
              type: "text",
              text: formatAutopilotToolContent(structuredContent),
            },
          ],
          structuredContent,
        };
      }
    },
  );

  server.registerTool(
    "delegate_run",
    {
      title: "Delegate Run",
      description:
        "Spawn a new specialist Codex sub-agent run via `codex exec`, writing a run directory with artifacts.",
      inputSchema: DelegateRunInputSchema,
      outputSchema: DelegateToolOutputSchema,
    },
    async (args, extra) => {
      const startedAt = new Date();
      try {
        const { runId, runDir } = await createRunDir();
        const requestPath = path.join(runDir, "request.json");
        const skillsIndexPath = path.join(runDir, "skills_index.json");
        const selectedSkillsPath = path.join(runDir, "selected_skills.json");
        const subagentPromptPath = path.join(runDir, "subagent_prompt.txt");

        await writeJsonFile(requestPath, {
          tool: "delegate_run",
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

        if (selection.errors.length > 0) {
          const finishedAt = new Date();

          const structuredContent: DelegateToolOutput = {
            run_id: runId,
            run_dir: runDir,
            subagent_thread_id: null,
            selected_skills: selection.selected,
            summary: "Failed to select skills; codex exec was not started.",
            deliverables: [],
            open_questions: [...selection.warnings],
            next_actions: ["Fix skill selection errors (skills_mode/skills names) and retry"],
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
            status: "failed" as const,
            error: selection.errors.join("; "),
          };

          return {
            content: [
              {
                type: "text",
                text: formatDelegateToolContent("delegate_run", structuredContent),
              },
            ],
            structuredContent,
          };
        }

        const skillsList =
          selection.selected.length > 0
            ? selection.selected
                .map((s) => `- ${s.name} (${s.origin}) — ${s.path}`)
                .join("\n")
            : "- (none)";

        const subagentPrompt = [
          `Role: ${args.role}`,
          "",
          `Working directory: ${args.cwd}`,
          "",
          "Task:",
          args.task,
          "",
          "Selected skills (read the SKILL.md at these paths; do not inline skill bodies):",
          skillsList,
          "",
          "Recursion guard: do not call any delegate_* MCP tools.",
          "",
          "Output requirements: return a single JSON object matching the provided output schema:",
          "- summary: string",
          "- deliverables: { path: string, description: string }[]",
          "- open_questions: string[]",
          "- next_actions: string[]",
          "",
        ].join("\n");

        await writeTextFile(subagentPromptPath, subagentPrompt);

        const configOverrides = buildCodexConfigOverrides(args);
        const log: LogFn = async (level, message) => {
          try {
            await server.sendLoggingMessage({ level, data: message }, extra.sessionId);
          } catch {
            // ignore
          }
        };

        const progress = createThrottledCodexExecProgressLogger({
          log,
          label: `delegate_run/${runId}`,
          heartbeatMs: 10_000,
          eventThrottleMs: 1_000,
        });

        progress.start();

        const codexResult = await runCodexExec({
          runDir,
          cwd: args.cwd,
          sandbox: args.sandbox,
          skipGitRepoCheck: args.skip_git_repo_check,
          prompt: subagentPrompt,
          abortSignal: extra.signal,
          configOverrides,
          onEvent: progress.onEvent,
        });

        progress.stop();

        const finishedAt = new Date();

        let parsedSubagentOutput:
          | {
              summary: string;
              deliverables: { path: string; description: string }[];
              open_questions: string[];
              next_actions: string[];
            }
          | null = null;

        try {
          const raw = await fs.readFile(path.join(runDir, "last_message.json"), "utf8");
          const parsed = JSON.parse(raw) as unknown;
          const validated = SubagentOutputSchema.safeParse(parsed);
          if (validated.success) {
            parsedSubagentOutput = validated.data;
          }
        } catch {
          // ignore
        }

        const status =
          codexResult.cancelled
            ? "cancelled"
            : codexResult.error || (codexResult.exit_code !== null && codexResult.exit_code !== 0)
              ? "failed"
              : parsedSubagentOutput
                ? "completed"
                : "failed";

        const error =
          status === "cancelled"
            ? "cancelled"
            : codexResult.error
              ? codexResult.error
              : codexResult.exit_code !== null && codexResult.exit_code !== 0
                ? `codex exec exited with code ${codexResult.exit_code}`
                : parsedSubagentOutput
                  ? null
                  : "codex exec did not produce a valid last_message.json";

        const openQuestions = parsedSubagentOutput
          ? [...parsedSubagentOutput.open_questions, ...selection.warnings]
          : [...selection.warnings];

        const nextActions = parsedSubagentOutput
          ? ["Inspect run_dir artifacts", ...parsedSubagentOutput.next_actions]
          : ["Inspect run_dir artifacts"];

        const structuredContent: DelegateToolOutput = {
          run_id: runId,
          run_dir: runDir,
          subagent_thread_id: codexResult.thread_id,
          selected_skills: selection.selected,
          summary: parsedSubagentOutput?.summary ?? "Delegated run finished.",
          deliverables: parsedSubagentOutput?.deliverables ?? [],
          open_questions: openQuestions,
          next_actions: nextActions,
          artifacts: [
            { name: "request.json", path: requestPath },
            { name: "skills_index.json", path: skillsIndexPath },
            { name: "selected_skills.json", path: selectedSkillsPath },
            { name: "subagent_prompt.txt", path: subagentPromptPath },
            { name: "codex_exec.json", path: codexResult.artifacts.codex_exec_path },
            { name: "events.jsonl", path: codexResult.artifacts.events_path },
            { name: "stderr.log", path: codexResult.artifacts.stderr_path },
            { name: "last_message.json", path: codexResult.artifacts.last_message_path },
            { name: "thread.json", path: codexResult.artifacts.thread_path },
            { name: "result.json", path: codexResult.artifacts.result_path },
            {
              name: "subagent_output.schema.json",
              path: codexResult.artifacts.subagent_output_schema_path,
            },
          ],
          timing: {
            started_at: startedAt.toISOString(),
            finished_at: finishedAt.toISOString(),
            duration_ms: finishedAt.getTime() - startedAt.getTime(),
          },
          status,
          error,
        };

        return {
          content: [
            {
              type: "text",
              text: formatDelegateToolContent("delegate_run", structuredContent),
            },
          ],
          structuredContent,
        };
      } catch (err) {
        const finishedAt = new Date();

        const structuredContent: DelegateToolOutput = {
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
          status: "failed" as const,
          error: err instanceof Error ? err.message : String(err),
        };

        return {
          content: [
            {
              type: "text",
              text: formatDelegateToolContent("delegate_run", structuredContent),
            },
          ],
          structuredContent,
        };
      }
    },
  );

  server.registerTool(
    "delegate_resume",
    {
      title: "Delegate Resume",
      description:
        "Resume an existing specialist Codex sub-agent thread via `codex exec resume`, writing a run directory with artifacts.",
      inputSchema: DelegateResumeInputSchema,
      outputSchema: DelegateToolOutputSchema,
    },
    async (args, extra) => {
      const startedAt = new Date();
      try {
        const { runId, runDir } = await createRunDir();
        const requestPath = path.join(runDir, "request.json");
        const skillsIndexPath = path.join(runDir, "skills_index.json");
        const selectedSkillsPath = path.join(runDir, "selected_skills.json");
        const subagentPromptPath = path.join(runDir, "subagent_prompt.txt");

        await writeJsonFile(requestPath, {
          tool: "delegate_resume",
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
                "skills_mode=auto ignored because delegate_resume task is empty; selected_skills is empty.",
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

        if (selection.errors.length > 0) {
          const finishedAt = new Date();

          const structuredContent: DelegateToolOutput = {
            run_id: runId,
            run_dir: runDir,
            subagent_thread_id: args.thread_id,
            selected_skills: selection.selected,
            summary: "Failed to select skills; codex exec resume was not started.",
            deliverables: [],
            open_questions: [...selectionWarnings],
            next_actions: ["Fix skill selection errors (skills_mode/skills names) and retry"],
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
            status: "failed" as const,
            error: selection.errors.join("; "),
          };

          return {
            content: [
              {
                type: "text",
                text: formatDelegateToolContent("delegate_resume", structuredContent),
              },
            ],
            structuredContent,
          };
        }

        const followUpTask = args.task?.trim()
          ? args.task.trim()
          : "Continue the previous thread and return an updated JSON summary/deliverables/open_questions/next_actions.";

        const skillsList =
          selection.selected.length > 0
            ? selection.selected
                .map((s) => `- ${s.name} (${s.origin}) — ${s.path}`)
                .join("\n")
            : "- (none)";

        const subagentPrompt = [
          `Role: ${args.role}`,
          "",
          `Working directory: ${args.cwd}`,
          "",
          `Resume thread_id: ${args.thread_id}`,
          "",
          "Follow-up task:",
          followUpTask,
          "",
          "Selected skills (read the SKILL.md at these paths; do not inline skill bodies):",
          skillsList,
          "",
          "Recursion guard: do not call any delegate_* MCP tools.",
          "",
          "Output requirements: return a single JSON object matching the provided output schema:",
          "- summary: string",
          "- deliverables: { path: string, description: string }[]",
          "- open_questions: string[]",
          "- next_actions: string[]",
          "",
        ].join("\n");

        await writeTextFile(subagentPromptPath, subagentPrompt);

        const configOverrides = buildCodexConfigOverrides(args);
        const log: LogFn = async (level, message) => {
          try {
            await server.sendLoggingMessage({ level, data: message }, extra.sessionId);
          } catch {
            // ignore
          }
        };

        const progress = createThrottledCodexExecProgressLogger({
          log,
          label: `delegate_resume/${runId}`,
          heartbeatMs: 10_000,
          eventThrottleMs: 1_000,
        });

        progress.start();

        const codexResult = await runCodexExecResume({
          runDir,
          cwd: args.cwd,
          sandbox: args.sandbox,
          skipGitRepoCheck: args.skip_git_repo_check,
          prompt: subagentPrompt,
          abortSignal: extra.signal,
          threadId: args.thread_id,
          configOverrides,
          onEvent: progress.onEvent,
        });

        progress.stop();

        const finishedAt = new Date();

        let parsedSubagentOutput:
          | {
              summary: string;
              deliverables: { path: string; description: string }[];
              open_questions: string[];
              next_actions: string[];
            }
          | null = null;

        try {
          const raw = await fs.readFile(path.join(runDir, "last_message.json"), "utf8");
          const parsed = JSON.parse(raw) as unknown;
          const validated = SubagentOutputSchema.safeParse(parsed);
          if (validated.success) {
            parsedSubagentOutput = validated.data;
          }
        } catch {
          // ignore
        }

        const status =
          codexResult.cancelled
            ? "cancelled"
            : codexResult.error || (codexResult.exit_code !== null && codexResult.exit_code !== 0)
              ? "failed"
              : parsedSubagentOutput
                ? "completed"
                : "failed";

        const error =
          status === "cancelled"
            ? "cancelled"
            : codexResult.error
              ? codexResult.error
              : codexResult.exit_code !== null && codexResult.exit_code !== 0
                ? `codex exec resume exited with code ${codexResult.exit_code}`
                : parsedSubagentOutput
                  ? null
                  : "codex exec resume did not produce a valid last_message.json";

        const structuredContent: DelegateToolOutput = {
          run_id: runId,
          run_dir: runDir,
          subagent_thread_id: codexResult.thread_id ?? args.thread_id,
          selected_skills: selection.selected,
          summary: parsedSubagentOutput?.summary ?? "Delegated resume finished.",
          deliverables: parsedSubagentOutput?.deliverables ?? [],
          open_questions: parsedSubagentOutput
            ? [...parsedSubagentOutput.open_questions, ...selectionWarnings]
            : [...selectionWarnings],
          next_actions: parsedSubagentOutput
            ? ["Inspect run_dir artifacts", ...parsedSubagentOutput.next_actions]
            : ["Inspect run_dir artifacts"],
          artifacts: [
            { name: "request.json", path: requestPath },
            { name: "skills_index.json", path: skillsIndexPath },
            { name: "selected_skills.json", path: selectedSkillsPath },
            { name: "subagent_prompt.txt", path: subagentPromptPath },
            { name: "codex_exec.json", path: codexResult.artifacts.codex_exec_path },
            { name: "events.jsonl", path: codexResult.artifacts.events_path },
            { name: "stderr.log", path: codexResult.artifacts.stderr_path },
            { name: "last_message.json", path: codexResult.artifacts.last_message_path },
            { name: "thread.json", path: codexResult.artifacts.thread_path },
            { name: "result.json", path: codexResult.artifacts.result_path },
            {
              name: "subagent_output.schema.json",
              path: codexResult.artifacts.subagent_output_schema_path,
            },
          ],
          timing: {
            started_at: startedAt.toISOString(),
            finished_at: finishedAt.toISOString(),
            duration_ms: finishedAt.getTime() - startedAt.getTime(),
          },
          status,
          error,
        };

        return {
          content: [
            {
              type: "text",
              text: formatDelegateToolContent("delegate_resume", structuredContent),
            },
          ],
          structuredContent,
        };
      } catch (err) {
        const finishedAt = new Date();

        const structuredContent: DelegateToolOutput = {
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
          status: "failed" as const,
          error: err instanceof Error ? err.message : String(err),
        };

        return {
          content: [
            {
              type: "text",
              text: formatDelegateToolContent("delegate_resume", structuredContent),
            },
          ],
          structuredContent,
        };
      }
    },
  );

  await server.connect(new StdioServerTransport());
}
