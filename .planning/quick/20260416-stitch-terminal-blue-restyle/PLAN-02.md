---
plan: 02
type: execute
wave: 2
depends_on: [01]
files_modified:
  - client/src/app/auth/register/page.tsx
  - client/src/app/auth/login/page.tsx
  - client/src/app/admin/login/page.tsx
autonomous: true
---

<objective>
Restyle the three auth pages (team register, team login, admin login) to match their Stitch HTML reference designs while preserving all existing form validation, API calls, error handling, and Zustand store integration.

Purpose: Auth pages are the first touchpoint -- they must set the Precision Brutalism tone immediately.
Output: Three restyled auth pages matching Stitch terminal aesthetic.
</objective>

<context>
@assests/stitch_complex_terminal_blue/auth_register/code.html (register reference)
@assests/stitch_complex_terminal_blue/auth_login/code.html (login reference)
@client/src/app/auth/register/page.tsx (current register)
@client/src/app/auth/login/page.tsx (current login)
@client/src/app/admin/login/page.tsx (current admin login)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Restyle register page to Stitch terminal design</name>
  <files>client/src/app/auth/register/page.tsx</files>
  <action>
Read client/src/app/auth/register/page.tsx first.

Rewrite the JSX layout to match the Stitch register HTML reference. Keep ALL existing state management, validation logic (validateField, handleChange, handleBlur, handleSubmit, getFieldError), imports, and the FieldErrors interface EXACTLY as they are. Only change the return() JSX.

The new layout structure (matching Stitch auth_register/code.html):

1. **Outer wrapper**: `min-h-screen flex flex-col items-center justify-center p-4 bg-[#131313]`

2. **Top header bar** (fixed): `fixed top-0 left-0 w-full px-6 h-12 flex justify-between items-center bg-[#0e0e0e] z-50`
   - Left: `<span className="text-xl font-black tracking-tighter text-[#2196f3]">COMPLEX</span>`
   - Right: `<span className="font-mono text-[9px] font-medium text-[#40e56c] uppercase tracking-widest">SYSTEM_STABLE // NO_ACTIVE_SESSION</span>`

3. **Main card**: `w-full max-w-[420px] bg-[#1c1b1b] relative shadow-2xl` (NO border-radius, NO Card component -- use plain div)
   - Blue top strip: `<div className="h-1 bg-[#2196f3] w-full" />`
   - Inner padding: `p-8`

4. **Card heading**:
   - `<h1 className="font-sans font-extrabold text-2xl tracking-tight text-[#e5e2e1] mb-1">NEW_ENTITY_REGISTRATION</h1>`
   - `<p className="font-mono text-[10px] text-[#89919d] uppercase tracking-widest">SECURE_NODE_ENTRY // GATE_ALPHA</p>`

5. **Form fields** (space-y-6) -- each field follows this pattern:
   ```tsx
   <div className="space-y-1">
     <label className="font-mono text-[10px] text-[#2196f3] uppercase font-bold tracking-tighter">
       Field_01 // TEAM_NAME
     </label>
     <input
       id="team_name"
       name="team_name"
       placeholder="Enter organizational name..."
       value={formData.team_name}
       onChange={handleChange}
       onBlur={handleBlur}
       className="w-full bg-[#201f1f] h-11 px-4 border-0 text-sm text-[#e5e2e1] placeholder:text-[#404752] font-sans focus:outline-none focus:border-l-2 focus:border-l-[#2196f3]"
       aria-invalid={!!getFieldError("team_name")}
     />
     {getFieldError("team_name") && (
       <p className="text-xs text-[#FF1744]">{getFieldError("team_name")}</p>
     )}
   </div>
   ```

   Field labels (in order):
   - `Field_01 // TEAM_NAME` -- input: standard text
   - `Field_02 // TICKER_SYMBOL` -- input: add `font-mono uppercase tracking-[0.2em] text-[#40e56c]` and the `[3-5_CHARS]` hint absolutely positioned right side. Keep maxLength={5} and the ticker onChange filter.
   - `Field_03 // AUTH_EMAIL` -- input: type="email"
   - `Field_04 // ACCESS_KEY` -- input: type="password"

6. **Submit button**: Use the milled-metal gradient style:
   ```tsx
   <button
     type="submit"
     disabled={isSubmitting}
     className="milled-metal-btn w-full h-12 text-white font-sans font-black text-xs uppercase tracking-[0.15em] transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
   >
     {isSubmitting ? "REGISTERING..." : "Register Team"}
   </button>
   ```

7. **Login link section** (below button, pt-2 border-t border-[#404752]/20):
   ```tsx
   <div className="flex items-center justify-between pt-2 border-t border-[#404752]/20">
     <span className="font-mono text-[10px] text-[#89919d] uppercase">Existing entry?</span>
     <Link href="/auth/login" className="font-mono text-[10px] text-[#2196f3] hover:text-[#9ecaff] uppercase font-bold tracking-tight">
       Execute_Login
     </Link>
   </div>
   ```

8. **Footer decoration** at bottom of card:
   ```tsx
   <div className="flex justify-between items-center px-8 py-4 bg-[#0e0e0e] border-t border-[#404752]/10">
     <div className="flex gap-2">
       <div className="w-2 h-2 bg-[#40e56c]/20" />
       <div className="w-2 h-2 bg-[#40e56c]/40" />
       <div className="w-2 h-2 bg-[#40e56c]/80" />
     </div>
     <span className="font-mono text-[8px] text-[#404752] uppercase tracking-[0.3em]">ENCRYPTION_LAYER_AES256</span>
   </div>
   ```

Remove the shadcn Card, CardContent, Button, Input, Label component imports -- use native HTML elements styled directly with Tailwind. Keep all other imports (useState, Link, useRouter, toast, api, registerSchema).

Do NOT use the `rounded-md` or `rounded-*` classes anywhere. All elements have sharp corners (0px radius from globals.css).
  </action>
  <verify>Run `cd /home/shaurya/Projects/complex/client && npx next build 2>&1 | tail -5` -- no build errors. Grep for "registerSchema" and "handleSubmit" to confirm validation logic preserved.</verify>
  <done>Register page matches Stitch terminal design: blue top strip, FIELD_01-04 labels in mono, milled-metal CTA, encryption indicator footer. All form validation, API calls, error handling, and router navigation preserved exactly.</done>
</task>

<task type="auto">
  <name>Task 2: Restyle login page to Stitch split-layout terminal design</name>
  <files>client/src/app/auth/login/page.tsx</files>
  <action>
Read client/src/app/auth/login/page.tsx first.

Rewrite the JSX layout to match the Stitch login HTML reference (split layout: left branding panel, right form). Keep ALL existing state, validation, useEffect redirect, role toggle, handleSubmit, Zustand store integration EXACTLY as they are. Only change the return() JSX.

The new layout structure (matching Stitch auth_login/code.html):

1. **Outer**: `bg-[#131313] min-h-screen flex flex-col`

2. **Top nav** (fixed): Same pattern as register page header but with nav links:
   ```tsx
   <nav className="flex justify-between items-center w-full px-4 h-12 bg-[#0e0e0e] fixed top-0 z-50">
     <div className="text-xl font-black tracking-tighter text-[#2196f3] uppercase">COMPLEX</div>
     <div className="flex items-center gap-4">
       <span className="font-mono text-[9px] font-medium text-[#40e56c] uppercase tracking-widest">SYSTEM_STABLE</span>
     </div>
   </nav>
   ```

3. **Main content**: `flex-grow flex items-center justify-center pt-12 pb-6 px-4`

4. **Split grid**: `grid grid-cols-1 lg:grid-cols-12 gap-0 w-full max-w-6xl border border-[#404752]/20`

5. **Left panel** (lg:col-span-5, bg-[#0e0e0e], p-8, flex flex-col justify-between, border-r border-[#404752]/20):
   - Top section:
     - `<div className="font-mono text-[#2196f3] text-xs mb-4 tracking-tighter">ESTABLISHING SECURE_LINK...</div>`
     - `<h1 className="text-4xl font-black uppercase tracking-tighter leading-none mb-6">COMPLEX<br/><span className="text-[#2196f3]">ARCHITECTURE</span></h1>`
     - `<p className="text-[#bfc7d4] text-sm max-w-xs mb-8 leading-relaxed">Precision Brutalism for high-frequency strategy execution. Access the kinetic ledger.</p>`
   - Bottom section (system status):
     - OPERATIONAL card: `bg-[#2a2a2a] p-4` with "SYSTEM_STATUS" label in mono text-[10px] text-[#40e56c], "OPERATIONAL" in mono text-xl, "99.98% UPTIME" faded
     - Two metric cards in grid-cols-2 gap-4: Latency (14MS) and Nodes (1,204) in bg-[#201f1f] p-4

6. **Right panel** (lg:col-span-7, bg-[#131313], p-8 lg:p-16, flex flex-col justify-center):
   - Heading: `<h2 className="text-2xl font-bold uppercase tracking-tight mb-2">Initialize Session</h2>`
   - Subtitle: `<p className="text-[#bfc7d4] text-xs font-mono uppercase">Enter credentials to bypass terminal firewall</p>`

   - **Role toggle** (Strategist/Trader):
     ```tsx
     <div className="bg-[#0e0e0e] p-1 flex border border-[#404752]/30">
       <button
         type="button"
         onClick={() => setRole("strategist")}
         className={`flex-1 py-2 text-[10px] font-mono uppercase tracking-widest font-bold transition-colors ${
           role === "strategist"
             ? "bg-[#2196f3] text-white"
             : "text-[#bfc7d4] hover:bg-[#2a2a2a]"
         }`}
       >
         Strategist
       </button>
       <button
         type="button"
         onClick={() => setRole("trader")}
         className={`flex-1 py-2 text-[10px] font-mono uppercase tracking-widest font-bold transition-colors ${
           role === "trader"
             ? "bg-[#2196f3] text-white"
             : "text-[#bfc7d4] hover:bg-[#2a2a2a]"
         }`}
       >
         Trader
       </button>
     </div>
     ```

   - **Email field**: label "Email Address" in text-[10px] mono uppercase text-[#bfc7d4]. Input: `w-full bg-[#1c1b1b] border-0 border-l-2 border-transparent py-4 pl-4 font-mono text-sm placeholder:opacity-30 focus:border-l-[#2196f3] focus:bg-[#2a2a2a] transition-all`

   - **Password field**: label "Access Token" with "Forgot?" link on right side. Same input styling.

   - **Submit button**: `w-full bg-[#2196f3] text-white py-4 font-black uppercase tracking-[0.2em] text-sm hover:brightness-110 transition-colors flex items-center justify-center gap-2`
     - Text: isSubmitting ? "INITIALIZING..." : "Login"

   - **Register link**: `<p className="text-[10px] font-mono uppercase text-[#bfc7d4] text-center pt-4">Unauthorized access is logged. <Link href="/auth/register" className="text-[#2196f3] font-bold hover:underline ml-2">Register New Agent</Link></p>`

Remove shadcn Card, CardContent, Button, Input, Label imports. Use native HTML elements. Keep all other imports and logic.
  </action>
  <verify>Run `cd /home/shaurya/Projects/complex/client && npx next build 2>&1 | tail -5` -- no build errors. Grep for "loginSchema" and "storeLogin" to confirm auth logic preserved.</verify>
  <done>Login page has Stitch split layout: left panel with COMPLEX branding + system status metrics, right panel with Initialize Session heading, Strategist/Trader segmented toggle in blue, terminal-styled inputs. All auth logic, role state, redirect, and Zustand integration preserved.</done>
</task>

<task type="auto">
  <name>Task 3: Restyle admin login page to Stitch terminal design</name>
  <files>client/src/app/admin/login/page.tsx</files>
  <action>
Read client/src/app/admin/login/page.tsx first.

Restyle to match the terminal aesthetic but with admin-specific branding. Keep ALL existing state, validation, handleSubmit, Zustand adminLogin integration, toast error handling EXACTLY as they are. Only change the return() JSX.

Use the same card pattern as the register page but simpler (admin-specific):

1. **Outer**: `bg-[#131313] min-h-screen flex flex-col items-center justify-center p-4`

2. **Top header** (fixed): Same as register pattern:
   ```tsx
   <header className="fixed top-0 left-0 w-full px-6 h-12 flex justify-between items-center bg-[#0e0e0e] z-50">
     <span className="text-xl font-black tracking-tighter text-[#2196f3]">COMPLEX</span>
     <span className="font-mono text-[9px] font-medium text-[#89919d] uppercase tracking-widest">ADMIN_ACCESS_PORTAL</span>
   </header>
   ```

3. **Main card**: `w-full max-w-[380px] bg-[#1c1b1b] relative shadow-2xl`
   - Red top strip (admin = different accent): `<div className="h-1 bg-[#FF1744] w-full" />`
   - Inner padding: `p-8`

4. **Card heading**:
   - `<h1 className="font-sans font-extrabold text-2xl tracking-tight text-[#e5e2e1] mb-1">ADMIN_ACCESS</h1>`
   - `<p className="font-mono text-[10px] text-[#89919d] uppercase tracking-widest">ELEVATED_PRIVILEGES // ROOT_GATE</p>`

5. **Form fields** (space-y-6):
   - Email: label `AUTH_EMAIL` in `font-mono text-[10px] text-[#FF1744] uppercase font-bold tracking-tighter` (red for admin). Input same styling as register fields.
   - Password: label `ACCESS_KEY` same red label. Same input styling.

6. **Submit button**: `w-full h-12 bg-[#FF1744] text-white font-sans font-black text-xs uppercase tracking-[0.15em] transition-all active:scale-[0.98] hover:brightness-110 disabled:opacity-50`
   - Text: isSubmitting ? "AUTHENTICATING..." : "Access Control Panel"

7. **Footer decoration**: Same encryption bar pattern as register but with red accent dots.

Remove shadcn Card, CardContent, Button, Input, Label imports. Use native HTML elements. Keep all other imports and logic.
  </action>
  <verify>Run `cd /home/shaurya/Projects/complex/client && npx next build 2>&1 | tail -5` -- no build errors. Grep for "adminLoginSchema" and "adminLogin" to confirm auth logic preserved.</verify>
  <done>Admin login page has terminal aesthetic with red accent (admin differentiation), ADMIN_ACCESS heading, ELEVATED_PRIVILEGES subtitle, red-accented field labels and submit button. All validation, API calls, error handling, and Zustand adminLogin preserved.</done>
</task>

</tasks>

<verification>
- `cd client && npx next build` completes without errors
- All three auth pages render with terminal mono labels, sharp corners, blue/red accents
- Form validation still works (blur validation, submit validation, field error display)
- API calls preserved (api.register, api.login, api.adminLogin)
- Role toggle on login page toggles between strategist/trader
- Router navigation preserved (register -> login redirect, login -> lobby redirect, admin login -> admin redirect)
</verification>

<success_criteria>
- Register page: FIELD_01-04 labels, milled-metal button, encryption footer, blue top strip
- Login page: Split layout with left branding panel, right form, Strategist/Trader toggle in blue
- Admin login: Red accent differentiation, ADMIN_ACCESS heading, same terminal field styling
- Zero functional regressions -- all form logic, API integration, error handling unchanged
</success_criteria>
