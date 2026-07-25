/**
 * Builder feature flags.
 *
 * TEMPLATES_ENABLED — the whole-site Templates/Theme feature (ThemeSheet,
 * Style-panel "Templates" row, new-site auto-open gate). Temporarily DISABLED
 * (2026-07-22, product decision: hidden from users until the release that
 * ships it). Flip back to `true` to restore — the implementation is complete
 * and verified; only these UI entry points are gated. Serialization is NOT
 * affected: a mobile-saved `settings.template` still round-trips untouched.
 */
export const TEMPLATES_ENABLED = false;
