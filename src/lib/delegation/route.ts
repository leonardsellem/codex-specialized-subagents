import type {
  AutopilotDecision,
  AutopilotInput,
  AutopilotJob,
  AutopilotPlan,
  ThinkingLevel,
} from "./types.js";

type RouteResult = {
  decision: AutopilotDecision;
  plan: AutopilotPlan;
};

function isQuestionLike(task: string): boolean {
  const trimmed = task.trim();
  if (!trimmed) return true;

  const lower = trimmed.toLowerCase();
  const startsQuestionWord = /^(what|why|how|explain|describe|summarize)\b/.test(lower);
  if (!startsQuestionWord) return false;

  const hasDoWorkVerb = /\b(add|implement|refactor|fix|update|create|build|ship|deploy|migrate)\b/.test(
    lower,
  );
  return !hasDoWorkVerb;
}

function countWorkCategories(task: string): { categories: Set<string>; evidence: string[] } {
  const lower = task.toLowerCase();
  const categories = new Set<string>();
  const evidence: string[] = [];

  const checks: Array<{ key: string; re: RegExp; label: string }> = [
    { key: "code", re: /\b(add|implement|refactor|fix|update|create|build|rewrite|migrate)\b/, label: "code" },
    { key: "tests", re: /\b(test|tests|coverage|jest|vitest|node:test)\b/, label: "tests" },
    { key: "docs", re: /\b(readme|docs?|documentation|agents\.md|contributing|runbook)\b/, label: "docs" },
    { key: "research", re: /\b(research|investigate|explore|compare|evaluate|best practices?)\b/, label: "research" },
    { key: "ops", re: /\b(deploy|release|publish|version|ci|github actions|pipeline)\b/, label: "ops" },
    { key: "security", re: /\b(security|vuln|vulnerability|audit|permissions)\b/, label: "security" },
  ];

  for (const check of checks) {
    if (check.re.test(lower)) {
      categories.add(check.key);
      evidence.push(check.label);
    }
  }

  return { categories, evidence };
}

function countClauses(task: string): number {
  const lower = task.toLowerCase();
  const matches = lower.match(/\b(and|then|also|plus|as well as)\b|,/g);
  return matches ? matches.length : 0;
}

function decideImplementThinkingLevel(task: string): ThinkingLevel {
  const clauseCount = countClauses(task);
  const { categories } = countWorkCategories(task);

  if (
    task.trim().length >= 400 ||
    clauseCount >= 4 ||
    categories.size >= 3 ||
    categories.has("security") ||
    categories.has("research")
  ) {
    return "high";
  }

  return "medium";
}

function buildJobs(input: AutopilotInput): AutopilotJob[] {
  const maxAgents = Math.max(1, input.max_agents);
  const jobs: AutopilotJob[] = [];

  if (maxAgents >= 2) {
    jobs.push({
      id: "scan",
      title: "Repo scan + approach",
      thinking_level: "low",
      role: "specialist",
      sandbox: "read-only",
      skills_mode: "auto",
      max_skills: input.max_skills,
      include_repo_skills: input.include_repo_skills,
      include_global_skills: input.include_global_skills,
      skip_git_repo_check: input.skip_git_repo_check,
      task: [
        "Scan the repo quickly to identify the most relevant files and constraints.",
        "Return a short plan with file pointers and risks.",
        "Do not make code changes in this step.",
      ].join(" "),
    });
  }

  jobs.push({
    id: "implement",
    title: "Implement requested change",
    thinking_level: decideImplementThinkingLevel(input.task),
    role: input.role,
    sandbox: input.sandbox,
    skills_mode: input.skills_mode,
    skills: input.skills,
    max_skills: input.max_skills,
    include_repo_skills: input.include_repo_skills,
    include_global_skills: input.include_global_skills,
    skip_git_repo_check: input.skip_git_repo_check,
    task: input.task,
  });

  if (maxAgents >= 3) {
    jobs.push({
      id: "verify",
      title: "Verify via tests/lint/build",
      thinking_level: "low",
      role: "specialist",
      sandbox: "read-only",
      skills_mode: "none",
      max_skills: input.max_skills,
      include_repo_skills: input.include_repo_skills,
      include_global_skills: input.include_global_skills,
      skip_git_repo_check: input.skip_git_repo_check,
      task: [
        "Run relevant verification commands (tests, typecheck/lint, build) and report results.",
        "Do not make code changes; only report failures and their likely causes.",
      ].join(" "),
    });
  }

  return jobs;
}

export function routeAutopilotTask(input: AutopilotInput): RouteResult {
  const task = input.task.trim();
  if (!task) {
    return {
      decision: { should_delegate: false, reason: "Empty task." },
      plan: { jobs: [] },
    };
  }

  if (isQuestionLike(task)) {
    return {
      decision: { should_delegate: false, reason: "Looks like an informational question." },
      plan: { jobs: [] },
    };
  }

  const clauseCount = countClauses(task);
  const { categories, evidence } = countWorkCategories(task);

  const shouldDelegate = task.length >= 160 || categories.size >= 2 || clauseCount >= 2;

  if (!shouldDelegate) {
    return {
      decision: {
        should_delegate: false,
        reason: "Single-scope task; delegation overhead likely not worth it.",
      },
      plan: { jobs: [] },
    };
  }

  const reasonParts: string[] = [];
  if (task.length >= 160) reasonParts.push("long task");
  if (categories.size >= 2) reasonParts.push(`cross-cutting (${[...new Set(evidence)].join(", ")})`);
  if (clauseCount >= 2) reasonParts.push("multiple clauses");

  return {
    decision: { should_delegate: true, reason: reasonParts.join("; ") || "multi-step request" },
    plan: { jobs: buildJobs(input) },
  };
}
