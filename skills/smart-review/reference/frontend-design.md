# Frontend Design Skill (Reference)

> Source: https://raw.githubusercontent.com/anthropics/claude-code/main/plugins/frontend-design/skills/frontend-design/SKILL.md
> Last fetched: 2026-05-10

## Design Thinking (Before Coding)

- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick an extreme — brutally minimal, maximalist, retro-futuristic,
  organic, luxury, playful, editorial, brutalist, art deco, etc.
- **Constraints**: Framework, performance, accessibility.
- **Differentiation**: What makes this UNFORGETTABLE?

## Frontend Aesthetics Guidelines

### Typography
- Choose beautiful, unique, interesting fonts.
- Avoid generic fonts: Arial, Inter, Roboto, system fonts.
- Pair distinctive display font with refined body font.

### Color & Theme
- Commit to a cohesive aesthetic. Use CSS variables.
- Dominant colors with sharp accents > timid evenly-distributed palettes.

### Motion
- Use animations for effects and micro-interactions.
- Prioritize CSS-only for HTML. Motion library for React.
- One well-orchestrated page load with staggered reveals > scattered micro-interactions.
- Scroll-triggering and hover states that surprise.

### Spatial Composition
- Unexpected layouts, asymmetry, overlap, diagonal flow.
- Grid-breaking elements. Generous negative space OR controlled density.

### Backgrounds & Visual Details
- Create atmosphere and depth, not solid color defaults.
- Gradient meshes, noise textures, geometric patterns.
- Layered transparencies, dramatic shadows, decorative borders.
- Custom cursors, grain overlays.

## Anti-Slop Rules

NEVER use:
- Overused font families (Inter, Roboto, Arial, system fonts)
- Cliched color schemes (purple gradients on white/dark)
- Predictable layouts and component patterns
- Cookie-cutter design lacking context-specific character

Vary between light/dark themes, different fonts, different aesthetics.
NEVER converge on common choices (Space Grotesk, etc.) across generations.

## Opus 4.7 Notes

- Stronger design instincts than prior models.
- Consistent default house style: warm cream (#F4F1EA), serif display,
  terracotta/amber accent.
- Override by: (1) specifying concrete alternative, or (2) proposing options first.
- Minimal prompting produces distinctive, creative frontends.
