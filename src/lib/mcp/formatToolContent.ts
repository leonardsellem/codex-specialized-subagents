import type { AutopilotToolOutput } from "../delegation/types.js";

type DelegateToolName = "delegate_run" | "delegate_resume";

type DelegateToolOutput = {
  run_dir: string;
  subagent_thread_id: string | null;
  summary: string;
  deliverables: { path: string; description: string }[];
  open_questions: string[];
  next_actions: string[];
  artifacts: { name: string; path: string }[];
  timing: { duration_ms: number | null };
  status: "completed" | "failed" | "cancelled";
  error: string | null;
};

const MAX_ITEMS_PER_SECTION = 5;
const MAX_INLINE_CHARS = 200;

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function truncateInline(text: string, maxChars = MAX_INLINE_CHARS): string {
  const normalized = normalizeWhitespace(text);
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars - 1)}…`;
}

function formatDurationSuffix(durationMs: number | null | undefined): string {
  if (durationMs === null || durationMs === undefined) return "";
  return ` (${durationMs}ms)`;
}

function findArtifactPath(
  artifacts: { name: string; path: string }[],
  name: string,
): string | null {
  const match = artifacts.find((a) => a.name === name);
  return match?.path ?? null;
}

function formatListSection(options: {
  title: string;
  items: string[];
  maxItems?: number;
}): string[] {
  const maxItems = options.maxItems ?? MAX_ITEMS_PER_SECTION;
  const total = options.items.length;
  const lines: string[] = [];

  lines.push(`${options.title} (${total}):`);

  if (total === 0) {
    lines.push("- (none)");
    return lines;
  }

  const slice = options.items.slice(0, maxItems);
  for (const item of slice) lines.push(`- ${item}`);

  if (total > maxItems) lines.push(`... (+${total - maxItems} more)`);
  return lines;
}

function formatDebugPointers(options: {
  artifacts: { name: string; path: string }[];
  includeFailurePointers: boolean;
}): string[] {
  const lines: string[] = [];

  const lastMessage = findArtifactPath(options.artifacts, "last_message.json");
  const stderr = findArtifactPath(options.artifacts, "stderr.log");
  const resultJson = findArtifactPath(options.artifacts, "result.json");

  lines.push("Debug pointers:");
  lines.push(`- last_message.json: ${lastMessage ?? "(none)"}`);
  if (options.includeFailurePointers) {
    if (stderr) lines.push(`- stderr.log: ${stderr}`);
    if (resultJson) lines.push(`- result.json: ${resultJson}`);
  }

  return lines;
}

export function formatDelegateToolContent(toolName: DelegateToolName, out: DelegateToolOutput): string {
  const lines: string[] = [];

  lines.push(toolName);
  lines.push(`status: ${out.status}${formatDurationSuffix(out.timing.duration_ms)}`);
  lines.push(`run_dir: ${out.run_dir}`);
  lines.push(`subagent_thread_id: ${out.subagent_thread_id ?? "(none)"}`);
  if (out.error) lines.push(`error: ${truncateInline(out.error)}`);

  lines.push("");
  lines.push(`summary: ${truncateInline(out.summary)}`);

  lines.push("");
  lines.push(
    ...formatListSection({
      title: "deliverables",
      items: out.deliverables.map((d) => `${d.path} — ${truncateInline(d.description)}`),
    }),
  );

  lines.push("");
  lines.push(
    ...formatListSection({
      title: "open_questions",
      items: out.open_questions.map((q) => truncateInline(q)),
    }),
  );

  lines.push("");
  lines.push(
    ...formatListSection({
      title: "next_actions",
      items: out.next_actions.map((a) => truncateInline(a)),
    }),
  );

  lines.push("");
  lines.push(
    ...formatDebugPointers({
      artifacts: out.artifacts,
      includeFailurePointers: out.status !== "completed",
    }),
  );

  return lines.join("\n");
}

export function formatAutopilotToolContent(out: AutopilotToolOutput): string {
  const lines: string[] = [];

  lines.push("delegate_autopilot");
  lines.push(`status: ${out.status}${formatDurationSuffix(out.timing.duration_ms)}`);
  lines.push(`run_dir: ${out.run_dir}`);
  lines.push(`should_delegate: ${out.decision.should_delegate}`);
  lines.push(`reason: ${truncateInline(out.decision.reason)}`);
  if (out.error) lines.push(`error: ${truncateInline(out.error)}`);

  lines.push("");
  lines.push("Autopilot plan:");
  if (out.plan.jobs.length === 0) {
    lines.push("- (none)");
  } else {
    for (const job of out.plan.jobs) {
      lines.push(
        `- ${job.id}: ${truncateInline(job.title)} (thinking_level=${job.thinking_level} sandbox=${job.sandbox} skills_mode=${job.skills_mode} max_skills=${job.max_skills})`,
      );
    }
  }

  lines.push("");
  lines.push("Subruns:");
  if (out.jobs.length === 0) {
    lines.push("- (none)");
  } else {
    for (const jobResult of out.jobs) {
      lines.push(
        `- ${jobResult.job_id}: ${jobResult.status}${formatDurationSuffix(jobResult.timing.duration_ms)} subagent_thread_id=${jobResult.subagent_thread_id ?? "(none)"}`,
      );
      lines.push(`  summary: ${truncateInline(jobResult.summary)}`);
      lines.push(`  run_dir: ${jobResult.run_dir}`);

      const lastMessage = findArtifactPath(jobResult.artifacts, "last_message.json");
      lines.push(`  last_message.json: ${lastMessage ?? "(none)"}`);

      if (jobResult.status !== "completed") {
        if (jobResult.error) lines.push(`  error: ${truncateInline(jobResult.error)}`);

        const stderr = findArtifactPath(jobResult.artifacts, "stderr.log");
        if (stderr) lines.push(`  stderr.log: ${stderr}`);

        const resultJson = findArtifactPath(jobResult.artifacts, "result.json");
        if (resultJson) lines.push(`  result.json: ${resultJson}`);
      }
    }
  }

  lines.push("");
  lines.push("Aggregate:");
  lines.push(`summary: ${truncateInline(out.aggregate.summary, 400)}`);

  lines.push("");
  lines.push(
    ...formatListSection({
      title: "deliverables",
      items: out.aggregate.deliverables.map((d) => `${d.path} — ${truncateInline(d.description)}`),
    }),
  );

  lines.push("");
  lines.push(
    ...formatListSection({
      title: "open_questions",
      items: out.aggregate.open_questions.map((q) => truncateInline(q)),
    }),
  );

  lines.push("");
  lines.push(
    ...formatListSection({
      title: "next_actions",
      items: out.aggregate.next_actions.map((a) => truncateInline(a)),
    }),
  );

  return lines.join("\n");
}
