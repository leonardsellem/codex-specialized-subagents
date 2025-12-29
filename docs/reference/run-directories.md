# Run directories (artifacts)

Every tool call writes an artifact directory under:

```bash
${CODEX_HOME:-~/.codex}/delegator/runs/<run_id>/
```

These directories can contain sensitive prompts/output; treat them like logs.

## `delegate_run` / `delegate_resume` layout

Typical layout:

```text
<run_dir>/
  request.json
  skills_index.json
  selected_skills.json
  subagent_prompt.txt
  subagent_output.schema.json
  events.jsonl
  stderr.log
  last_message.json
  result.json
  thread.json
```

## `delegate_autopilot` layout

The parent run directory contains routing artifacts plus `subruns/` for each job:

```text
<run_dir>/
  request.json
  skills_index.json
  autopilot_decision.json
  autopilot_plan.json
  autopilot_aggregate.json
  subruns/
    <job_id>/
      request.json
      selected_skills.json
      subagent_prompt.txt
      subagent_output.schema.json
      events.jsonl
      stderr.log
      last_message.json
      result.json
      thread.json
```

## Debugging tips

- Start with `stderr.log` and `result.json` to see why `codex exec` failed.
- `events.jsonl` is the full event stream.
- `last_message.json` is the final structured output (must match the schema in `reference/tools.md`).

