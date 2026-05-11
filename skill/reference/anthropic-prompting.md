# Anthropic Prompting Best Practices (Reference)

> Source: https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/be-clear-and-direct
> Last fetched: 2026-05-10

## General Principles

### Be Clear and Direct
- Be specific about desired output format and constraints.
- Provide instructions as sequential steps when order matters.
- Golden rule: show your prompt to a colleague with minimal context — if confused, Claude will be too.

### Add Context
- Explain *why* an instruction matters — Claude generalizes from explanations.
- "NEVER use ellipses" → "Your response will be read aloud by TTS, so never use ellipses since TTS can't pronounce them."

### Use Examples
- 3–5 examples for best results (few-shot / multishot).
- Wrap in `<example>` / `<examples>` tags.
- Make examples relevant, diverse, and structured.

### Structure with XML Tags
- Use `<instructions>`, `<context>`, `<input>` to disambiguate mixed prompts.
- Nest tags for hierarchical content: `<document index="1">` inside `<documents>`.

### Give Claude a Role
- Even a single sentence in the system prompt focuses behavior.
- "You are a helpful coding assistant specializing in Python."

## Output Control

### Communication Style
- Claude Opus 4.7: more concise, direct, opinionated. Less validation-forward phrasing.
- If your product needs warmer tone, add: "Use a warm, collaborative tone."

### Format Control
1. Tell what to do, not what not to do.
2. Use XML format indicators.
3. Match prompt style to desired output style.

### Code Review Harness Tips
- "Report every issue you find, including uncertain or low-severity ones."
- "Your goal here is coverage — better to surface and filter than silently drop."
- Use separate finding + verification stages for best recall.

## Thinking & Effort

### Effort Levels (Opus 4.7)
- `xhigh`: best for coding and agentic use cases
- `high`: minimum for intelligence-sensitive use cases
- `medium`: cost-sensitive, trades off intelligence
- `low`: short scoped tasks, latency-sensitive
- `max`: diminishing returns, may overthink

### Adaptive Thinking
- `thinking: {type: "adaptive"}` — Claude decides when and how much to think.
- Higher effort → more thinking. More complex queries → more thinking.

### Steering Thinking
- "This task involves multi-step reasoning. Think carefully before responding."
- "Thinking adds latency. Only use when it meaningfully improves quality."

## Agentic Patterns

### Subagent Orchestration
- Claude spawns fewer subagents by default but is steerable.
- "Spawn multiple subagents in the same turn when fanning out across items."
- "Do not spawn a subagent for work you can complete directly."

### Long-Horizon State Tracking
- Use structured formats (JSON) for state data.
- Use unstructured text for progress notes.
- Use git for state tracking.
- Encourage complete usage of context window.

### Reduce Overengineering
- "Avoid over-engineering. Only make changes directly requested or clearly necessary."
- "Don't add docstrings, comments, or type annotations to code you didn't change."
- "Don't create helpers or abstractions for one-time operations."

## Design & Frontend (Opus 4.7)

### Default Aesthetic
- Warm cream/off-white backgrounds (~#F4F1EA), serif display type, terracotta/amber accent.
- Persistent default — generic instructions won't break it.

### How to Override
1. Specify a concrete alternative (color palette, typeface, layout rules).
2. Have Claude propose 4 directions before building — user picks one.

### Minimal Anti-Slop Prompt
```
<frontend_aesthetics>
NEVER use generic AI-generated aesthetics like overused font families
(Inter, Roboto, Arial), cliched color schemes (purple gradients),
predictable layouts, and cookie-cutter design.
Use unique fonts, cohesive colors, animations for effects.
</frontend_aesthetics>
```
