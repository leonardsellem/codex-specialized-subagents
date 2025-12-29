# Codex Execution Plans (ExecPlans)

An **ExecPlan** is a self-contained, living design document that an agent (or a human) can follow to deliver a working feature or system change.

If you're reading this as an agent: treat yourself as a complete beginner to this repo. You only have the current working tree and the ExecPlan you’re executing — no memory of prior plans, no external context.

## How to use ExecPlans and PLANS.md

When authoring an executable specification (ExecPlan), follow PLANS.md _to the letter_. If it is not in your context, refresh your memory by reading the entire PLANS.md file. Be thorough in reading (and re-reading) source material to produce an accurate specification. When creating a spec, start from the skeleton and flesh it out as you do your research.

When implementing an executable specification (ExecPlan), do not prompt the user for "next steps"; simply proceed to the next milestone. Keep all sections up to date, add or split entries in the list at every stopping point to affirmatively state the progress made and next steps. Resolve ambiguities autonomously, and commit frequently.

When discussing an executable specification (ExecPlan), record decisions in a log in the spec for posterity; it should be unambiguously clear why any change to the specification was made. ExecPlans are living documents, and it should always be possible to restart from _only_ the ExecPlan and no other work.

When researching a design with challenging requirements or significant unknowns, use milestones to implement proof of concepts, "toy implementations", etc., that allow validating whether the user's proposal is feasible. Read the source code of libraries by finding or acquiring them, research deeply, and include prototypes to guide a fuller implementation.

## When to use an ExecPlan

Use an ExecPlan when the work is any of:
- multi-hour (or likely to sprawl)
- cross-cutting (touches multiple subsystems / >3 files)
- risky (migrations, refactors, security-sensitive)
- ambiguous (unknowns / tradeoffs that need to be resolved)
- hard to validate (needs a crisp acceptance story)

## Where ExecPlans live

- Active ExecPlans: `.agent/execplans/`
- Artifacts (logs, screenshots, transcripts): `.agent/execplans/artifacts/<plan-id>/`
- Completed ExecPlans: `.agent/execplans/archive/`
- Archived artifacts: `.agent/execplans/archive/artifacts/<plan-id>/`

> Tip: use `scripts/new_execplan.py "short description"` to create a new ExecPlan stub + artifacts folder.

## Non‑negotiable requirements

Every ExecPlan must:

1) **Be fully self-contained**  
   All terms are defined plainly, all paths are repository-relative, and every command is spelled out.

2) **Be a living document**  
   Keep these sections updated as you go: **Progress**, **Surprises & Discoveries**, **Decision Log**, **Outcomes & Retrospective**.

3) **Produce observable behavior**  
   Not just code changes. Define how to *prove* it works (tests, a CLI run, an HTTP call, a UI flow).

4) **Be safe + repeatable**  
   Steps should be idempotent when possible. If a step is risky, include rollback / recovery.

## Style guidance

- Prefer **milestones** for big work: each milestone ends with a verifiable outcome.
- Prefer **small commits**. If you change course mid-way, record why in **Decision Log**.
- If you’re stuck, create a “toy implementation” or spike milestone to de-risk the unknown.

## ExecPlan skeleton (copy into a new file)

Create a new file in `.agent/execplans/` named like: `YYYY-MM-DD_short-description.md`.

```md
# <Short, action-oriented description>

This ExecPlan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` up to date.

## Purpose / Big Picture

Explain (briefly) what someone gains after this change and how they can see it working.

## Progress

Use checkboxes + timestamps. Split partially-done items into “done” and “remaining”.

- [ ] (YYYY-MM-DD HH:MM) First concrete step.

## Surprises & Discoveries

Document unexpected behaviors, bugs, perf tradeoffs, or “oh wow” findings.

- Observation: …
  Evidence: …

## Decision Log

Record every decision:

- Decision: …
  Rationale: …
  Date/Author: …

## Outcomes & Retrospective

At completion (or major milestones), summarize what shipped, what didn’t, and lessons learned.

## Context and Orientation

Assume the reader knows nothing. Name key files by full repo-relative paths. Define terms.

## Plan of Work

In prose: the sequence of edits/additions. For each edit, name the file + what changes.

## Concrete Steps

Exact commands to run (and where). Include short expected outputs when helpful.

## Validation and Acceptance

How to prove it works: tests to run, scenarios to exercise, expected results.

## Idempotence and Recovery

Explain what can be safely re-run and what needs cleanup / rollback.

## Artifacts and Notes

Short transcripts, snippets, diffs — evidence that proves progress.

## Interfaces and Dependencies

Be prescriptive: libraries, APIs, module boundaries, names, function signatures.