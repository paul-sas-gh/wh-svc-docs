# Full-Width Layout Configuration

## Overview

Updated Docusaurus CSS configuration to make the page container use all available horizontal space instead of being constrained to a fixed maximum width.

## Changes Made

### File: `src/css/custom.css`

Added the following CSS customizations:

#### 1. CSS Variables (Root Level)
```css
:root {
  /* Override default container max-width */
  --ifm-container-width: 100%;
  --ifm-container-width-xl: 100%;
}
```

#### 2. Container Styles
```css
/* Make page container use full available width */
.container {
  max-width: 100% !important;
  padding-left: 2rem;
  padding-right: 2rem;
}

/* Adjust main wrapper for full width */
.main-wrapper {
  max-width: 100%;
}

/* Make doc content use full width */
.theme-doc-markdown,
.markdown {
  max-width: 100%;
}
```

## Benefits

1. **Better Diagram Visibility**: Mermaid diagrams and wide content can use more screen space
2. **Modern Layout**: Utilizes full viewport width on large screens
3. **Responsive**: Still maintains proper padding for readability
4. **Flexible**: Content naturally expands to available space

## Impact on Content

- **Wide diagrams** (like architecture and sequence diagrams) will have more room
- **Tables** can display more columns without horizontal scrolling
- **Code blocks** can show longer lines without wrapping
- **Text content** still has padding (2rem) on sides for readability

## Testing

After these changes, verify the layout by:

```bash
npm run start
```

Visit pages with:
- Wide Mermaid diagrams (e.g., `/docs/PlanDeProiect/arhitectura`)
- Tables
- Code blocks
- Long text content

## Reverting (If Needed)

To revert to the default constrained width, remove or comment out the added CSS rules in `src/css/custom.css`.

Default Docusaurus container width is typically `1140px` or `--ifm-container-width-xl`.

## Date Applied

January 4, 2026

## Related Changes

- Complements the Mermaid native support migration
- Improves viewing experience for technical documentation with wide diagrams

