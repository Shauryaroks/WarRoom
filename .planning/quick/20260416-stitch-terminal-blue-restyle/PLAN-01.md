---
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - client/src/app/globals.css
  - client/src/app/layout.tsx
autonomous: true
---

<objective>
Replace the amber-primary Bloomberg theme with the Stitch "Complex Terminal Blue" design system tokens, and add the persistent bottom status bar to the root layout.

Purpose: All pages inherit from globals.css and layout.tsx -- updating these first ensures every subsequent page restyle uses the correct palette, radii, and layout shell.
Output: Updated globals.css with blue primary palette, updated layout.tsx with bottom status bar.
</objective>

<context>
@assests/stitch_complex_terminal_blue/complex_terminal/DESIGN.md
@assests/stitch_complex_terminal_blue/auth_register/code.html (footer pattern)
@client/src/app/globals.css
@client/src/app/layout.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace CSS custom properties with Stitch Terminal Blue palette</name>
  <files>client/src/app/globals.css</files>
  <action>
Read client/src/app/globals.css first.

Replace ALL `:root` CSS custom properties with the Stitch palette values. The exact mapping:

```
--background: #131313;          (was hsl(0 0% 4%))
--foreground: #e5e2e1;          (was hsl(0 0% 88%))
--card: #1c1b1b;                (surface-container-low)
--card-foreground: #e5e2e1;
--popover: #201f1f;             (surface-container)
--popover-foreground: #e5e2e1;
--primary: #2196f3;             (was amber hsl(36 100% 50%) -- NOW BLUE)
--primary-foreground: #ffffff;
--secondary: #201f1f;           (surface-container for input backgrounds)
--secondary-foreground: #e5e2e1;
--muted: #2a2a2a;               (surface-container-high)
--muted-foreground: #89919d;    (outline token)
--accent: #2196f3;              (was amber -- NOW BLUE)
--accent-foreground: #ffffff;
--destructive: #FF1744;         (error/tertiary-container)
--destructive-foreground: #ffffff;
--border: #404752;              (outline-variant)
--input: #201f1f;               (surface-container)
--ring: #2196f3;                (was amber -- NOW BLUE)
--radius: 0px;                  (was 0.375rem -- ZERO for Precision Brutalism)
--success: #40e56c;             (secondary green)
--info: #9ecaff;                (primary light)
--chart-1: #2196f3;             (blue primary)
--chart-2: #40e56c;             (green)
--chart-3: #FF1744;             (red)
--chart-4: #9ecaff;             (light blue)
--chart-5: #89919d;             (gray)
--sidebar: #0e0e0e;             (surface-container-lowest)
--sidebar-foreground: #e5e2e1;
--sidebar-primary: #2196f3;     (was amber -- NOW BLUE)
--sidebar-primary-foreground: #ffffff;
--sidebar-accent: #1c1b1b;
--sidebar-accent-foreground: #e5e2e1;
--sidebar-border: #404752;
--sidebar-ring: #2196f3;
```

IMPORTANT: Convert all values from HSL to hex format (raw hex values, not hsl()). Use this pattern:

```css
--background: #131313;
```

Also add these NEW custom properties inside `:root` for Stitch-specific surface tokens used across pages:

```css
--surface-lowest: #0e0e0e;
--surface-low: #1c1b1b;
--surface-container: #201f1f;
--surface-high: #2a2a2a;
--surface-highest: #353534;
--primary-container: #2196f3;
--on-primary: #003258;
--on-primary-container: #002c4f;
--secondary-green: #40e56c;
--outline: #89919d;
--outline-variant: #404752;
--on-surface: #e5e2e1;
--on-surface-variant: #bfc7d4;
```

Add these to the @theme inline block:

```
--color-surface-lowest: var(--surface-lowest);
--color-surface-low: var(--surface-low);
--color-surface-container: var(--surface-container);
--color-surface-high: var(--surface-high);
--color-surface-highest: var(--surface-highest);
--color-primary-container: var(--primary-container);
--color-on-primary: var(--on-primary);
--color-on-primary-container: var(--on-primary-container);
--color-secondary-green: var(--secondary-green);
--color-outline: var(--outline);
--color-outline-variant: var(--outline-variant);
--color-on-surface: var(--on-surface);
--color-on-surface-variant: var(--on-surface-variant);
```

In the @layer base section, add the Stitch input focus style:

```css
input:focus,
textarea:focus {
  outline: none !important;
  box-shadow: none !important;
  border-left: 2px solid #2196f3 !important;
}
```

Add a `.milled-metal-btn` utility class in @layer utilities:

```css
.milled-metal-btn {
  background: linear-gradient(to bottom, #2196f3, #002c4f);
}
```

Keep the existing `.font-data` utility class and the scrollbar styling.
</action>
<verify>Run `cd /home/shaurya/Projects/complex/client && npx next build 2>&1 | head -30` -- should compile without CSS errors. Grep globals.css for "#FF9500" or "hsl(36" to confirm no amber remnants: `grep -c "FF9500\|hsl(36" client/src/app/globals.css` should return 0.</verify>
<done>All CSS custom properties use Stitch hex values. --primary is #2196f3 (blue), --radius is 0px, all surface tier tokens are defined. No amber (#FF9500) values remain.</done>
</task>

<task type="auto">
  <name>Task 2: Add bottom status bar to root layout</name>
  <files>client/src/app/layout.tsx</files>
  <action>
Read client/src/app/layout.tsx first.

Add a fixed bottom status bar matching the Stitch design footer pattern. This bar appears on every page (h-6, fixed bottom-0, bg surface-container-lowest, border-t).

Update the layout body to include the status bar AFTER {children} and BEFORE the Toaster:

```tsx
<body
  className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
>
  {children}
  {/* Terminal Status Bar */}
  <footer className="fixed bottom-0 left-0 w-full h-6 flex justify-between items-center px-6 z-50 overflow-hidden bg-[#0e0e0e] border-t border-[#2a2a2a]">
    <div className="font-mono text-[9px] font-medium text-[#40e56c] uppercase">
      SYSTEM_STABLE // LATENCY: 14MS
    </div>
    <div className="flex gap-6">
      <span className="font-mono text-[9px] font-medium text-gray-600 hover:text-white cursor-pointer uppercase transition-colors">
        API_DOCS
      </span>
      <span className="font-mono text-[9px] font-medium text-gray-600 hover:text-white cursor-pointer uppercase transition-colors">
        RULES
      </span>
      <span className="font-mono text-[9px] font-medium text-gray-600 hover:text-white cursor-pointer uppercase transition-colors">
        HELP_DESK
      </span>
    </div>
  </footer>
  <Toaster
    position="top-right"
    toastOptions={{
      duration: 4000,
      style: {
        background: "#201f1f",
        border: "1px solid #404752",
        color: "#e5e2e1",
      },
    }}
  />
</body>
```

Also update the Toaster styling to match the new palette (background #201f1f = surface-container, border #404752 = outline-variant).

Add `pb-6` to the body className to ensure page content doesn't get hidden behind the fixed status bar:

```tsx
className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased pb-6`}
```

Keep ALL existing imports, metadata, and font configurations unchanged.
</action>
<verify>Run `cd /home/shaurya/Projects/complex/client && npx next build 2>&1 | head -30` -- should compile. Grep for "SYSTEM_STABLE" in layout.tsx to confirm status bar added.</verify>
<done>Root layout has a fixed h-6 status bar at the bottom with "SYSTEM_STABLE // LATENCY: 14MS" in green mono text, API_DOCS/RULES/HELP_DESK links in gray. Toaster styled with new palette. Body has pb-6 for clearance.</done>
</task>

</tasks>

<verification>
- `grep -c "FF9500\|hsl(36\|amber" client/src/app/globals.css` returns 0
- `grep "#2196f3" client/src/app/globals.css` returns multiple matches
- `grep "SYSTEM_STABLE" client/src/app/layout.tsx` returns 1 match
- `grep "0px" client/src/app/globals.css` confirms --radius: 0px
- `cd client && npx next build` completes without errors
</verification>

<success_criteria>

- Primary color throughout the app is blue (#2196f3), not amber
- All border-radius values are 0px (Precision Brutalism)
- Bottom status bar visible on every page
- Surface tier tokens available as CSS custom properties for page restyling
  </success_criteria>
