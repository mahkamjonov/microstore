---
name: MicroStore Design System
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#3d4a42'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#6d7a72'
  outline-variant: '#bccac0'
  surface-tint: '#006c4a'
  primary: '#006948'
  on-primary: '#ffffff'
  primary-container: '#00855d'
  on-primary-container: '#f5fff7'
  inverse-primary: '#68dba9'
  secondary: '#0058be'
  on-secondary: '#ffffff'
  secondary-container: '#2170e4'
  on-secondary-container: '#fefcff'
  tertiary: '#006947'
  on-tertiary: '#ffffff'
  tertiary-container: '#00855b'
  on-tertiary-container: '#f5fff6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#85f8c4'
  primary-fixed-dim: '#68dba9'
  on-primary-fixed: '#002114'
  on-primary-fixed-variant: '#005137'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc6ff'
  on-secondary-fixed: '#001a42'
  on-secondary-fixed-variant: '#004395'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display-currency:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  display-currency-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  button-text:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  touch-target: 52px
  container-margin: 16px
---

## Brand & Style

The design system is engineered for micro-merchants who require speed, reliability, and clarity in high-pressure retail environments. The brand personality is **utilitarian, precise, and empowering**, focusing on "invisible" interface design that prioritizes financial data over decorative elements.

The visual style is **High-Utility Minimalism**. It draws inspiration from modern fintech leaders, utilizing heavy whitespace, a disciplined grid, and purposeful color application. The aesthetic is "Tool-First," ensuring that every pixel serves a functional purpose in tracking inventory, sales, and debt.

**Key Principles:**
- **Speed to Action:** Large touch targets and high-contrast typography reduce cognitive load during transactions.
- **Financial Confidence:** Use of familiar fintech color patterns to signal status (profit, debt, system health).
- **Reduced Friction:** Minimalist surfaces with clear boundaries to help users distinguish between different data modules instantly.

## Colors

The palette is rooted in a soft, non-reflective base to reduce eye strain during long shifts. Color is used sparingly but strictly as a functional signifier.

- **Primary (Emerald Green):** Reserved for the "Primary Action" (e.g., Complete Sale, Add Product).
- **Secondary (Bright Blue):** Used for hardware-related interactions, terminal connections, and digital payments.
- **Positive (Vibrant Green):** Indicates cash inflow, completed status, and profit.
- **Negative (Coral Red):** Flags debt, supplier payments due, and critical errors.
- **Surface & Background:** A layered approach using Soft Slate Gray for the app background and Pure White for actionable cards to create clear visual hierarchy.

## Typography

This design system uses a dual-font strategy. **Plus Jakarta Sans** provides a friendly yet professional geometric feel for headlines and large numeric displays. **Inter** is used for all functional body text and labels due to its exceptional legibility in small sizes and data-heavy tables.

**Numeric Treatment:**
As a merchant tool, currency figures are treated as primary visual anchors. They should always use the `display-currency` token with tight letter spacing to appear as a single, easily scannable unit.

**Accessibility:**
Weight is used to differentiate between "Label" (Secondary info) and "Value" (Primary info). Maintain a minimum contrast ratio of 4.5:1 for all text against card surfaces.

## Layout & Spacing

This design system employs a **8px linear scale** for consistent rhythm. As a mobile-first PWA, the layout relies on a **Fluid Grid** with fixed side margins.

- **Mobile (up to 599px):** 16px side margins, 12px vertical spacing between cards.
- **Tablet (600px - 1023px):** 24px side margins, 2-column grid for dashboard widgets.
- **Desktop (1024px+):** Fixed center container (max-width 1200px) with multi-column card layouts.

**Touch Considerations:**
Every actionable item (buttons, list rows, inputs) must maintain a minimum height of 52px to accommodate fast, often imprecise, tapping in a retail environment.

## Elevation & Depth

To maintain a clean and professional look, this design system avoids heavy shadows. Depth is communicated through **Tonal Layering** and **Subtle Outlines**.

- **Level 0 (Background):** Soft Slate Gray (#F8FAFC).
- **Level 1 (Cards/Surfaces):** Pure White (#FFFFFF) with a 1px Solid border (#E2E8F0).
- **Level 2 (Active/Modals):** Pure White with a very soft, diffused shadow (0px 4px 12px rgba(0,0,0,0.05)) to suggest it is floating above the main interface.

**Interaction States:**
When a card or list item is pressed, it should subtly shift to a slightly darker background (#F1F5F9) rather than using an elevation increase.

## Shapes

The shape language is modern and approachable. 
- **Standard Cards:** Use `rounded-lg` (16px) to create a soft, containerized look.
- **Buttons & Inputs:** Use `rounded-md` (8px-12px) to maintain a crisp, professional appearance.
- **Badges:** Use a full pill-shape (999px) to distinguish status indicators from clickable buttons.

Consistency in corner radii is critical to making the "Minimalist" style feel intentional rather than unfinished.

## Components

### Buttons
- **Primary:** 52px height, Emerald Green background, White text, Bold weight.
- **Secondary:** 52px height, White background, 1px border (#E2E8F0), Emerald Green text.
- **Icon Only:** 52px x 52px, centered icon, used for quick "Add" or "Subtract" actions.

### Input Fields
- **Numeric Inputs:** Large text (20px+), left-aligned icon (e.g., currency symbol), and a clear "X" to clear the value.
- **Focus State:** 2px solid border in Emerald Green.

### Cards & List Items
- **Supplier Cards:** White background with 16px padding. Title on the left, Balance on the right. 
- **Actionable Rows:** Include trailing + and - buttons for inventory adjustment, ensuring the buttons themselves are at least 44px wide.

### Badges (Status Indicators)
- **Offline Mode:** Gray background (#E2E8F0) with Slate text.
- **Syncing:** Blue background (#DBEAFE) with Bright Blue text.

### Navigation
- **Bottom Bar (PWA):** Fixed bottom navigation with 4-5 core destinations (Dashboard, Sales, Inventory, Suppliers). Use 24px stroke icons with clear text labels.