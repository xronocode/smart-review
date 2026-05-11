# Anthropic Opus 4.7 Model Notes (Reference)

> Source: https://docs.anthropic.com/en/docs/about-claude/models
> Last fetched: 2026-05-10

## Model Overview

Claude Opus 4.7: most capable generally available model.
Strengths: long-horizon agentic work, knowledge work, vision, memory.

## Key Behavioral Changes from Opus 4.6

### Response Length
- Calibrates length to task complexity (not fixed verbosity).
- Shorter on simple lookups, longer on open-ended analysis.
- To decrease: "Provide concise, focused responses."

### Effort & Thinking
- Strictly respects effort levels, especially at low end.
- `low` and `medium`: scopes work to what was asked.
- If shallow reasoning on complex problems → raise effort, don't prompt around it.

### Tool Use Triggering
- Tends to use tools less, reasoning more.
- Increase effort to increase tool usage.
- Explicitly describe when/how to use tools for more usage.

### Literal Instruction Following
- Interprets prompts more literally and explicitly.
- Won't silently generalize instructions.
- If broad application needed, state scope explicitly.

### Tone & Writing
- More direct and opinionated.
- Less validation-forward phrasing, fewer emoji.
- For warmer tone: "Use a warm, collaborative tone."

### Subagent Spawning
- Fewer subagents by default.
- Steerable: give explicit guidance on when subagents are desirable.

### Design Defaults
- Stronger design instincts, consistent default house style.
- Override with concrete specs or propose-options-first approach.

## Computer Use
- Up to 2576px / 3.75MP resolution.
- 1080p = good balance of performance and cost.
- 720p or 1366x768 for cost-sensitive workloads.

## API Changes
- `effort` parameter for intelligence vs token spend.
- Adaptive thinking: `thinking: {type: "adaptive"}`.
- Prefilled responses on last assistant turn no longer supported on newer models.
- Use structured outputs instead of prefill for format control.

## Code Review Specific
- 11pp better recall in bug-finding evals vs prior models.
- If review prompt says "only report high-severity" — follows more faithfully.
- May investigate thoroughly but not report findings below stated bar.
- Recommended: "Report every issue you find, including uncertain ones."
