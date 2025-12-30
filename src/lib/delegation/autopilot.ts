import path from "node:path";
import { promises as fs } from "node:fs";

import { runCodexExec, type RunCodexExecResult } from "../codex/runCodexExec.js";
import { SubagentOutputSchema } from "../codex/subagentOutput.js";
import { createRunDir, writeJsonFile, writeTextFile } from "../runDirs.js";
import { discoverSkills } from "../skills/discover.js";
import type { SkillIndex } from "../skills/types.js";
import { selectSkills } from "../skills/select.js";
import { routeAutopilotTask } from "./route.js";
import { runJobs } from "./runJobs.js";
import {
  type AutopilotJob,
  type AutopilotJobResult,
  type AutopilotToolOutput,
  AutopilotInputSchema,
} from "./types.js";

type AutopilotDeps = {
  createRunDir: typeof createRunDir;
  writeJsonFile: typeof writeJsonFile;
  writeTextFile: typeof writeTextFile;
  discoverSkills: typeof discoverSkills;
  selectSkills: typeof selectSkills;
  runCodexExec: typeof runCodexExec;
};

type RunAutopilotOptions = {
  signal?: AbortSignal;
  env?: NodeJS.ProcessEnv;
  deps?: Partial<AutopilotDeps>;
};

function aggregateJobResults(jobResults: AutopilotJobResult[]): {
  summary: string;
  deliverables: { path: string; description: string }[];
  open_questions: string[];
  next_actions: string[];
} {
  const deliverables = jobResults.flatMap((r) => r.deliverables);
  const openQuestions = new Set<string>();
  const nextActions = new Set<string>();

  const summaryLines: string[] = [];

  for (const result of jobResults) {
    summaryLines.push(`${result.title} (${result.status}): ${result.summary}`);
    for (const q of result.open_questions) openQuestions.add(q);
    for (const a of result.next_actions) nextActions.add(a);
  }

  return {
    summary: summaryLines.length > 0 ? summaryLines.join("\n") : "No delegation needed.",
    deliverables,
    open_questions: [...openQuestions],
    next_actions: [...nextActions],
  };
}

function buildSelectedSkillsList(selected: { name: string; origin: string; path: string }[]): string {
  if (selected.length === 0) return "- (none)";
  return selected.map((s) => `- ${s.name} (${s.origin}) — ${s.path}`).join("\n");
}

function tomlString(value: string): string {
  return JSON.stringify(value);
}

function buildSubagentPrompt(options: {
  role: string;
  cwd: string;
  job: AutopilotJob;
  selectedSkills: { name: string; origin: string; path: string }[];
}): string {
  return [
    `Role: ${options.role}`,
    "",
    `Working directory: ${options.cwd}`,
    "",
    `Autopilot job: ${options.job.title} (${options.job.id})`,
    "",
    "Task:",
    options.job.task,
    "",
    "Selected skills (read the SKILL.md at these paths; do not inline skill bodies):",
    buildSelectedSkillsList(options.selectedSkills),
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
}

async function parseSubagentOutput(runDir: string): Promise<{
  summary: string;
  deliverables: { path: string; description: string }[];
  open_questions: string[];
  next_actions: string[];
} | null> {
  try {
    const raw = await fs.readFile(path.join(runDir, "last_message.json"), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const validated = SubagentOutputSchema.safeParse(parsed);
    if (!validated.success) return null;
    return validated.data;
  } catch {
    return null;
  }
}

function runResultStatus(
  codexResult: RunCodexExecResult,
  parsedSubagentOutput: unknown | null,
): { status: "completed" | "failed" | "cancelled"; error: string | null } {
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

  return { status, error };
}

function makeSkippedJobResult(job: AutopilotJob, runDir: string): AutopilotJobResult {
  const now = new Date();
  return {
    job_id: job.id,
    title: job.title,
    run_dir: runDir,
    subagent_thread_id: null,
    selected_skills: [],
    summary: "Skipped due to cancellation.",
    deliverables: [],
    open_questions: [],
    next_actions: [],
    artifacts: [],
    timing: {
      started_at: now.toISOString(),
      finished_at: now.toISOString(),
      duration_ms: 0,
    },
    status: "skipped",
    error: "cancelled",
  };
}

async function runAutopilotJob(options: {
  parentRunDir: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  skillsIndex: SkillIndex;
  job: AutopilotJob;
  abortSignal?: AbortSignal;
  deps: AutopilotDeps;
}): Promise<AutopilotJobResult> {
  const startedAt = new Date();
  const jobRunDir = path.join(options.parentRunDir, "subruns", options.job.id);

  const requestPath = path.join(jobRunDir, "request.json");
  const selectedSkillsPath = path.join(jobRunDir, "selected_skills.json");
  const subagentPromptPath = path.join(jobRunDir, "subagent_prompt.txt");

  await options.deps.writeJsonFile(requestPath, {
    tool: "delegate_autopilot",
    received_at: startedAt.toISOString(),
    job: options.job,
  });

  const selection = options.deps.selectSkills({
    mode: options.job.skills_mode,
    skillsIndex: options.skillsIndex.skills,
    task: options.job.task,
    requested: options.job.skills,
    maxSkills: options.job.max_skills,
  });

  await options.deps.writeJsonFile(selectedSkillsPath, {
    mode: options.job.skills_mode,
    max_skills: options.job.max_skills,
    requested: options.job.skills ?? [],
    selected: selection.selected,
    warnings: selection.warnings,
    errors: selection.errors,
  });

  if (selection.errors.length > 0) {
    const finishedAt = new Date();
    return {
      job_id: options.job.id,
      title: options.job.title,
      run_dir: jobRunDir,
      subagent_thread_id: null,
      selected_skills: selection.selected,
      summary: "Failed to select skills; codex exec was not started.",
      deliverables: [],
      open_questions: [...selection.warnings],
      next_actions: ["Fix skill selection errors (skills_mode/skills names) and retry"],
      artifacts: [
        { name: "request.json", path: requestPath },
        { name: "selected_skills.json", path: selectedSkillsPath },
      ],
      timing: {
        started_at: startedAt.toISOString(),
        finished_at: finishedAt.toISOString(),
        duration_ms: finishedAt.getTime() - startedAt.getTime(),
      },
      status: "failed",
      error: selection.errors.join("; "),
    };
  }

  const subagentPrompt = buildSubagentPrompt({
    role: options.job.role,
    cwd: options.cwd,
    job: options.job,
    selectedSkills: selection.selected,
  });

  await options.deps.writeTextFile(subagentPromptPath, subagentPrompt);

  const codexResult = await options.deps.runCodexExec({
    runDir: jobRunDir,
    cwd: options.cwd,
    sandbox: options.job.sandbox,
    skipGitRepoCheck: options.job.skip_git_repo_check,
    prompt: subagentPrompt,
    abortSignal: options.abortSignal,
    env: options.env,
    configOverrides: options.job.config_overrides,
  });

  const finishedAt = new Date();

  const parsedSubagentOutput = await parseSubagentOutput(jobRunDir);
  const { status, error } = runResultStatus(codexResult, parsedSubagentOutput);

  const openQuestions = parsedSubagentOutput
    ? [...parsedSubagentOutput.open_questions, ...selection.warnings]
    : [...selection.warnings];

  const nextActions = parsedSubagentOutput
    ? ["Inspect run_dir artifacts", ...parsedSubagentOutput.next_actions]
    : ["Inspect run_dir artifacts"];

  return {
    job_id: options.job.id,
    title: options.job.title,
    run_dir: jobRunDir,
    subagent_thread_id: codexResult.thread_id,
    selected_skills: selection.selected,
    summary: parsedSubagentOutput?.summary ?? `${options.job.title} finished.`,
    deliverables: parsedSubagentOutput?.deliverables ?? [],
    open_questions: openQuestions,
    next_actions: nextActions,
    artifacts: [
      { name: "request.json", path: requestPath },
      { name: "selected_skills.json", path: selectedSkillsPath },
      { name: "subagent_prompt.txt", path: subagentPromptPath },
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
}

export async function runAutopilot(args: unknown, options: RunAutopilotOptions = {}): Promise<AutopilotToolOutput> {
  const startedAt = new Date();
  const env = options.env ?? process.env;

  const deps: AutopilotDeps = {
    createRunDir,
    writeJsonFile,
    writeTextFile,
    discoverSkills,
    selectSkills,
    runCodexExec,
    ...options.deps,
  };

  const parsed = AutopilotInputSchema.parse(args);
  const cwd = parsed.cwd?.trim() ? parsed.cwd.trim() : process.cwd();

  const { runId, runDir } = await deps.createRunDir({ env });

  const requestPath = path.join(runDir, "request.json");
  const skillsIndexPath = path.join(runDir, "skills_index.json");
  const decisionPath = path.join(runDir, "autopilot_decision.json");
  const planPath = path.join(runDir, "autopilot_plan.json");
  const aggregatePath = path.join(runDir, "autopilot_aggregate.json");

  await deps.writeJsonFile(requestPath, {
    tool: "delegate_autopilot",
    received_at: startedAt.toISOString(),
    request: parsed,
  });

  const skillsIndex = await deps.discoverSkills({
    cwd,
    includeRepoSkills: parsed.include_repo_skills,
    includeGlobalSkills: parsed.include_global_skills,
    env,
  });
  await deps.writeJsonFile(skillsIndexPath, skillsIndex);

  const routed = routeAutopilotTask({ ...parsed, cwd });

  const plan = {
    jobs: routed.plan.jobs.map((job) => {
      const modelKey =
        job.thinking_level === "low"
          ? "CODEX_AUTOPILOT_MODEL_LOW"
          : job.thinking_level === "medium"
            ? "CODEX_AUTOPILOT_MODEL_MEDIUM"
            : "CODEX_AUTOPILOT_MODEL_HIGH";

      const reasoningEffortKey =
        job.thinking_level === "low"
          ? "CODEX_AUTOPILOT_REASONING_EFFORT_LOW"
          : job.thinking_level === "medium"
            ? "CODEX_AUTOPILOT_REASONING_EFFORT_MEDIUM"
            : "CODEX_AUTOPILOT_REASONING_EFFORT_HIGH";

      const model = env[modelKey]?.trim() ? env[modelKey]!.trim() : undefined;
      const reasoningEffort = env[reasoningEffortKey]?.trim() ? env[reasoningEffortKey]!.trim() : undefined;

      const config_overrides: string[] = [];
      if (model) config_overrides.push(`model=${tomlString(model)}`);
      if (reasoningEffort) config_overrides.push(`model_reasoning_effort=${tomlString(reasoningEffort)}`);

      return {
        ...job,
        ...(model ? { model } : {}),
        ...(config_overrides.length > 0 ? { config_overrides } : {}),
      };
    }),
  };

  await deps.writeJsonFile(decisionPath, routed.decision);
  await deps.writeJsonFile(planPath, plan);

  const jobsById = new Map<string, AutopilotJobResult>();

  if (routed.decision.should_delegate) {
    const preJobs = plan.jobs.filter((j) => j.id === "scan");
    const workJobs = plan.jobs.filter((j) => j.id === "implement");
    const postJobs = plan.jobs.filter((j) => j.id === "verify");

    const runPhase = async (phaseJobs: AutopilotJob[], maxParallel: number): Promise<void> => {
      const phaseResult = await runJobs(phaseJobs, {
        maxParallel,
        signal: options.signal,
        runJob: async (job): Promise<AutopilotJobResult> => {
          try {
            return await runAutopilotJob({
              parentRunDir: runDir,
              cwd,
              skillsIndex,
              job,
              abortSignal: options.signal,
              env,
              deps,
            });
          } catch (err) {
            const finishedAt = new Date();
            return {
              job_id: job.id,
              title: job.title,
              run_dir: path.join(runDir, "subruns", job.id),
              subagent_thread_id: null,
              selected_skills: [],
              summary: "Autopilot job crashed.",
              deliverables: [],
              open_questions: [],
              next_actions: ["Inspect stderr/logs for details."],
              artifacts: [],
              timing: {
                started_at: startedAt.toISOString(),
                finished_at: finishedAt.toISOString(),
                duration_ms: finishedAt.getTime() - startedAt.getTime(),
              },
              status: "failed",
              error: err instanceof Error ? err.message : String(err),
            };
          }
        },
      });

      for (let i = 0; i < phaseJobs.length; i++) {
        const job = phaseJobs[i]!;
        const outcome = phaseResult.results[i];
        if (!outcome || outcome.status === "skipped") {
          jobsById.set(job.id, makeSkippedJobResult(job, path.join(runDir, "subruns", job.id)));
          continue;
        }
        if (outcome.status === "failed") {
          jobsById.set(job.id, {
            job_id: job.id,
            title: job.title,
            run_dir: path.join(runDir, "subruns", job.id),
            subagent_thread_id: null,
            selected_skills: [],
            summary: "Autopilot job failed.",
            deliverables: [],
            open_questions: [],
            next_actions: [],
            artifacts: [],
            timing: {
              started_at: startedAt.toISOString(),
              finished_at: startedAt.toISOString(),
              duration_ms: 0,
            },
            status: "failed",
            error: outcome.error,
          });
          continue;
        }
        jobsById.set(job.id, outcome.value);
      }
    };

    await runPhase(preJobs, parsed.max_parallel);
    await runPhase(workJobs, 1);
    await runPhase(postJobs, parsed.max_parallel);
  }

  const orderedJobResults = plan.jobs.map(
    (job) => jobsById.get(job.id) ?? makeSkippedJobResult(job, path.join(runDir, "subruns", job.id)),
  );

  const aggregate = aggregateJobResults(orderedJobResults);
  await deps.writeJsonFile(aggregatePath, aggregate);

  const finishedAt = new Date();

  const cancelled = options.signal?.aborted === true;
  const anyFailed = orderedJobResults.some((r) => r.status === "failed");

  const status: "completed" | "failed" | "cancelled" = cancelled
    ? "cancelled"
    : anyFailed
      ? "failed"
      : "completed";

  const error =
    status === "cancelled"
      ? "cancelled"
      : status === "failed"
        ? orderedJobResults
            .filter((r) => r.status === "failed" && r.error)
            .map((r) => `${r.job_id}: ${r.error}`)
            .join("; ") || "One or more jobs failed."
        : null;

  return {
    run_id: runId,
    run_dir: runDir,
    decision: routed.decision,
    plan,
    jobs: orderedJobResults,
    aggregate,
    artifacts: [
      { name: "request.json", path: requestPath },
      { name: "skills_index.json", path: skillsIndexPath },
      { name: "autopilot_decision.json", path: decisionPath },
      { name: "autopilot_plan.json", path: planPath },
      { name: "autopilot_aggregate.json", path: aggregatePath },
      { name: "subruns", path: path.join(runDir, "subruns") },
    ],
    timing: {
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      duration_ms: finishedAt.getTime() - startedAt.getTime(),
    },
    status,
    error,
  };
}
