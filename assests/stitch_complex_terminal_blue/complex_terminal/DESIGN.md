```markdown
# Design System Documentation: High-Density Data Architecture

## 1. Overview & Creative North Star
This design system is engineered for the high-stakes environment of case competitions, where information density is a requirement, not a choice. We are moving beyond the "standard dark mode" to create a bespoke experience that balances the raw power of a financial terminal with the refined aesthetics of high-end editorial design.

**Creative North Star: "The Kinetic Ledger"**
The system treats data as a living, breathing entity. Our goal is **Precision Brutalism**. We reject the "softness" of modern consumer web design (rounded corners, excessive whitespace, and decorative shadows) in favor of a surgical, grid-based interface. The "Kinetic Ledger" approach ensures that even at maximum density, the user feels in total control through intentional typographic hierarchy and sophisticated tonal layering. We are building a cockpit, not a landing page.

---

## 2. Colors & Tonal Hierarchy
Our palette is rooted in absolute blacks and functional accents. The goal is to minimize eye strain while maximizing the "pop" of critical data points.

### Palette Strategy
- **Background (`#131313`)**: The void. This is the foundation of the entire interface.
- **Surface Tiers**: We use the `surface-container` scale to define importance.
    - `surface-container-lowest (#0e0e0e)`: Inset areas or background panels.
    - `surface-container-high (#2a2a2a)`: Active interactive elements or high-priority data containers.
- **The Accents**:
    - **Primary (`#2196f3`)**: Use for "The Path." Actions, active states, and focus indicators.
    - **Secondary/Positive (`#00C853`)**: Success, growth, and "Stock Up" states.
    - **Tertiary/Alert (`#FF1744`)**: Crisis, decline, and "Stock Down" states.

### The "No-Line" Rule
Traditional 1px solid borders are strictly prohibited for general sectioning. They create visual noise. Instead, boundaries must be defined through **Background Color Shifts**. To separate a sidebar from a main feed, use `surface-container-low` against the `background`. If a container requires further nesting, move one step up the tier (e.g., a `surface-container-high` card inside a `surface-container` section).

### Glass & Gradient Polish
While the UI is flat, it must not feel "dead." 
- Use **Glassmorphism** for floating overlays or command palettes: `surface-container` at 80% opacity with a `20px backdrop-blur`. 
- For Primary CTAs, apply a subtle linear gradient from `primary` to `on_primary_container` (top-to-bottom) to give the button a "milled metal" feel.

---

## 3. Typography
Typography is our primary tool for navigation. We use two distinct families to separate "UI Shell" from "Mission Critical Data."

- **UI Labels (Inter)**: Use Inter for all navigation, labels, and instructional text. It is neutral, legible, and disappears to let the data shine.
- **Data & Numbers (JetBrains Mono)**: Every number, ticker symbol, and time stamp must be in JetBrains Mono. The tabular figures (equal-width numbers) are essential for comparing columns of data at a glance.

### The Editorial Scale
- **Display-LG (3.5rem / Inter)**: Reserved for high-level dashboard summaries (e.g., Total Valuation).
- **Headline-SM (1.5rem / Inter)**: Section titles. Use all-caps with 0.05em letter spacing for an authoritative, "ledger" look.
- **Label-MD (0.75rem / JetBrains Mono)**: Use for sub-data and secondary metrics. This reinforces the "Terminal" aesthetic.

---

## 4. Elevation & Depth
In this system, depth is a function of light, not physical height.

- **The Layering Principle**: Instead of shadows, stack surface tokens. A `surface-container-highest` element should feel like it is closer to the user because it is lighter in tone than the `surface` below it.
- **Ambient Shadows**: For floating modals only. Use a massive blur (40px+) and very low opacity (6%). The shadow should be tinted with `primary` (#2196F3) at 4% to create a subtle glow rather than a dark "drop."
- **The "Ghost Border"**: When a container needs an edge for accessibility, use the `outline-variant` token at 15% opacity. This creates a "hairline" effect that defines the edge without cluttering the grid.

---

## 5. Components

### Buttons (Zero-Radius)
- **Primary**: Background `primary_container`, text `on_primary`. 0px border radius. Sharp, aggressive.
- **Secondary**: Ghost style. `outline` border (1px) and `primary` text.
- **States**: On hover, shift the background to `primary` (a lighter tint) to signal reactivity.

### Data Inputs
- **Text Fields**: Background `surface-container-low`. No bottom line; instead, a 2px `primary` left-border on focus to indicate the "active line."
- **Monospace Inputs**: For numerical entries, use `JetBrains Mono` at `body-md`.

### Cards & Lists
- **The "No-Divider" Rule**: Forbid the use of horizontal rules (`<hr>`). Separate list items using 4px or 8px of vertical space or a subtle hover-state background shift to `surface-container-highest`.
- **Status Chips**: Use sharp-edged rectangles. Background at 10% opacity of the status color (Green/Red/Blue) with 100% opacity text.

### Professional Components
- **Data Strips**: Horizontal scrolling tickers using `surface-container-lowest`. Use for live competition updates.
- **The "Command Line"**: A global search/action bar at the bottom of the screen, fixed, using the Glassmorphism rule.

---

## 6. Do's and Don'ts

### Do:
- **Align to the Pixel**: Every edge must align to an 8px grid. Asymmetry is encouraged in panel widths to create an "editorial" feel, but vertical alignment must be perfect.
- **Use High-Contrast Monospace**: Ensure all data values are in `JetBrains Mono` and use the `secondary` (Green) or `tertiary` (Red) tokens to indicate change over time.
- **Embrace Density**: Fill the screen. If a section looks "empty," consider adding secondary metadata or micro-charts (sparklines).

### Don't:
- **No Rounded Corners**: Never use `border-radius`. Not for buttons, not for cards, not for checkboxes. 0px is the only value.
- **No Decorative Whitespace**: "Breathability" is for consumer apps. This system is for power users. If you have 20px of padding, try 8px.
- **No Gray Shadows**: Avoid standard `#000000` shadows. They look muddy on near-black backgrounds. Use tonal layering or tinted glows.

---
**Director's Final Note:**
This system is designed to look intimidating to the novice and empowering to the expert. Maintain the grid, respect the monospace, and let the tonal layering define the sophistication. We are not just showing data; we are orchestrating it.```