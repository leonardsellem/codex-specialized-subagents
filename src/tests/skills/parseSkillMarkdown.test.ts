import assert from "node:assert/strict";
import test from "node:test";

import { parseSkillMarkdown } from "../../lib/skills/parseSkillMarkdown.js";

test("parseSkillMarkdown returns empty for markdown without frontmatter", () => {
  const parsed = parseSkillMarkdown("# Hello\n\nNo frontmatter here.\n");
  assert.deepEqual(parsed, {});
});

test("parseSkillMarkdown parses name and description from frontmatter", () => {
  const parsed = parseSkillMarkdown(`---
name: my-skill
description: Does a thing
---

# Body
`);
  assert.equal(parsed.name, "my-skill");
  assert.equal(parsed.description, "Does a thing");
});

test("parseSkillMarkdown supports block scalar descriptions", () => {
  const parsed = parseSkillMarkdown(`---
name: block-skill
description: |
  Line one
  Line two
---

# Body
`);
  assert.equal(parsed.name, "block-skill");
  assert.equal(parsed.description, "Line one\nLine two");
});

