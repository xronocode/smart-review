# CSS / Less / Sass Review Guide

## Variables & Theming
- Use CSS custom properties (`--var-name`) for runtime-themable values.
- Less/Sass variables for compile-time constants.
- Group variables by purpose: colors, spacing, typography, breakpoints.
- Avoid `!important` — fix specificity issues instead.
  Exception: utility overrides where specificity is intentionally overridden.

## Performance
- Prefer `transform` and `opacity` for animations (GPU-composited).
- Avoid animating `width`, `height`, `top`, `left` — use transforms.
- Use `will-change` sparingly and remove after animation.
- Prefer `contain: layout style paint` for isolated components.
- Avoid deep selector nesting (> 3 levels) — increases specificity and matching cost.

## Responsive Design
- Mobile-first: base styles for mobile, `@media (min-width)` for larger screens.
- Use relative units (`rem`, `em`, `%`) over `px` for typography and spacing.
- Test at breakpoints: 320px, 768px, 1024px, 1440px.
- Use `clamp()` for fluid typography: `font-size: clamp(1rem, 2.5vw, 2rem)`.

## Compatibility
- Use Autoprefixer — don't write vendor prefixes manually.
- Provide fallbacks for `gap` in flexbox (not supported in older Safari).
- Check `caniuse.com` for new properties before use.
- Use `@supports` for progressive enhancement.

## Code Style
- BEM or consistent naming convention — pick one and stick to it.
- No magic hex values — use semantic variable names.
- Keep specificity flat — avoid `#id` selectors in CSS.
- Prefer logical properties: `margin-inline-start` over `margin-left`.
- Use `color-mix()` (modern) for color variations instead of pre-computing.

## Common Pitfalls
- Z-index wars: use a documented z-index scale.
- Margin collapse: understand when it happens, use `overflow: hidden` or padding.
- `overflow: hidden` hiding content — test with dynamic content.
- `box-sizing`: always set `*, *::before, *::after { box-sizing: border-box; }`.
