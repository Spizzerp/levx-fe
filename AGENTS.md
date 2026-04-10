# AGENTS

## Tailwind Classname Guideline

When a `className` has 8 or more Tailwind utility classes, use `cn(...)` and group classes in the following order.

```tsx
<div
  className={
    cn()
    // display
    // flex, grid
    // position, inset, left, top, bottom, right, z-index, overflow
    // width, height
    // margin, padding
    // border
    // background
    // color, font, text, letter-spacing, word-wrap, word-break, ...
    // others
    // hover:, focus:, ...
    // responsive media query areas (wideDesktop:, desktop:, tablet:)
  }
/>
```

## `cn` Utility

- Import from `@/lib/cn`.
- Use `cn` to merge conditional classes and resolve Tailwind conflicts.
