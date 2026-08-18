/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#2f1f2c',
    tint: '#c75b7c',

    // Core surfaces
    background: '#fff9f7',
    foreground: '#2f1f2c',

    // Cards / elevated surfaces
    card: '#ffffff',
    cardForeground: '#2f1f2c',

    // Primary action color (buttons, links, active states)
    primary: '#c75b7c',
    primaryForeground: '#ffffff',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#f9e9ed',
    secondaryForeground: '#573342',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#f5e5e6',
    mutedForeground: '#8c6d79',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#eee6f6',
    accentForeground: '#57436b',

    // Destructive actions (delete, error states)
    destructive: '#c94f62',
    destructiveForeground: '#ffffff',

    // Borders and input outlines
    border: '#efdadd',
    input: '#ead2d8',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 22,
};

export default colors;
