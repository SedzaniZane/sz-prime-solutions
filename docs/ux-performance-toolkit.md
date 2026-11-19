# SZ Prime Website — UX, Design Skills & Performance Plan

Reviewed: 19 November 2026. Screenshot discoveries; upstream repository metadata checked through GitHub. This is an evaluation index, **not a claim that the tools are installed, forked or benchmarked**.

## Verified external resources

| Resource | Upstream | Licence metadata | Candidate role |
|---|---|---|---|
| UI UX Pro Max | https://github.com/nextlevelbuilder/ui-ux-pro-max-skill | MIT | Brand, palette and layout guidance |
| Awesome DESIGN.md | https://github.com/VoltAgent/awesome-design-md | MIT | Design-system reference examples |
| Designer Skills | https://github.com/Owl-Listener/designer-skills | MIT | UX research and prototyping |
| Stitch Skills | https://github.com/google-labs-code/stitch-skills | Apache-2.0 | Screen design and handoff |
| Figma MCP Guide | https://github.com/figma/mcp-server-guide | No repository-level licence identified | Figma design-to-code guidance; verify terms |
| Astryx | https://github.com/meta/astryx | MIT | Candidate React components; evaluate compatibility |
| Taste Skill | https://github.com/Leonxlnx/taste-skill | MIT | Visual design critique |
| Modern Web Guidance | https://github.com/GoogleChrome/modern-web-guidance-src | Apache-2.0 | Modern web patterns |
| Vercel Agent Skills | https://github.com/vercel-labs/agent-skills | No repository-level licence identified | React, accessibility, performance reviews; verify terms |
| Impeccable | https://github.com/pbakaus/impeccable | Apache-2.0 | UI polish and audit |

Prior discoveries tracked in earlier PR #11: ecommerce-intelligence-apis, 500-AI-Agents-Projects, Animate (exact URL pending), NotebookLM prompt toolkit; plus Claude Squad, Adobe MCP and LoadView. Avoid blindly copying dependencies or adding all ten tools to production.

## Current website baseline (repository inspection)

- Next.js 15, React 19, TypeScript, Supabase SSR and pdf-lib; Vercel deployment described in README.
- Landing page in `app/page.tsx` presents seven business units, ecosystem, platform journey and operations portal.
- Styling in `app/globals.css` uses system fonts, CSS grid and a responsive breakpoint at 850px.
- Layout uses a mobile viewport with `maximumScale: 1`; revisit this for pinch-zoom accessibility.
- No performance measurements, Lighthouse reports, production bundle analysis or Core Web Vitals captured in this review. Do not describe speed as proven.

## UX design direction

Keep SZ Prime's brand architecture and navy/teal with restrained gold accents. Start with a lightweight design token system: color, spacing, type scale, border radii, focus rings, motion and component states. Prioritise mobile-first navigation, clear business-unit discovery, obvious WhatsApp/enquiry CTA, accessible forms and quotation/payment journeys. Do not surface internal operations tools as the primary customer CTA.

Proposed workflow: UI UX Pro Max + DESIGN.md for direction → Stitch/Figma for layouts → reusable native components or evaluated Astryx subset → Taste/Impeccable review → Chrome/Vercel performance and accessibility audit. Do not introduce a component library until bundle-size and accessibility checks justify it.

## Speed and interaction work packages

1. **Baseline**: run production Lighthouse on mobile and desktop for landing page, enquiry, quotation, payment and ops routes. Record LCP, INP, CLS, TTFB and JS transfer sizes. Use field RUM when traffic allows. Targets: LCP <=2.5s, INP <=200ms, CLS <=0.1 at 75th percentile where measurable; not current measurements.
2. **Reduce JavaScript**: prefer server components for static content; dynamically import large client-only modules; avoid loading CRM, PDF and QR libraries on public pages unless needed; inspect Next bundle analysis before changes.
3. **Optimise media**: use Next image optimisation with correct dimensions, responsive srcset, modern formats and lazy loading below the fold. Avoid heavy autoplay video or animation on mobile.
4. **Fonts and CSS**: retain fast system fonts or self-host a small font subset; trim unused CSS; avoid blocking third-party scripts.
5. **Data fetching**: cache only public and non-sensitive content appropriately; keep authenticated customer/quote/payment responses private and non-cacheable; reduce Supabase round trips, index measured slow queries and prevent sequential waterfalls.
6. **Interaction quality**: immediate input feedback, loading/success/error states, keyboard support, accessible contrast and touch targets; prevent duplicate payments or quote submissions with idempotency and server-side validation.
7. **Validation**: use repeatable throttled mobile runs, regression budgets and CI checks. Test on real South African mobile networks where possible. Verify payments and ops security independently.

## Recommended implementation sequence

- Phase 1: capture screenshots and Lighthouse baselines; inventory routes and assets.
- Phase 2: design tokens, navigation and homepage UX wireframe; approve brand and content.
- Phase 3: implement one mobile-first page on a separate branch with no production change.
- Phase 4: measure before/after LCP/INP/CLS, test accessibility and secure customer flows.
- Phase 5: roll out approved patterns to quote, invoice, customer support and business-unit pages.

## Job lead from screenshot (unverified)

A social video advertises a 'Junior AI Agent Engineer', remote South Africa, YES Youth Programme 2027, from R5,200/month, closing 22 November 2026, apply via Indeed. Employer, actual vacancy URL, eligibility and deadline are **not verified**. Do not apply or share personal information based solely on the screenshot. Verify the employer's official posting and YES requirements first.

## Forking status

The available GitHub connector supports repository reads and ordinary commits but exposes no repository fork operation. These are upstream links only; **none of these external repositories has been forked or vendored**. Preserve upstream attribution and verify licences before adoption.
