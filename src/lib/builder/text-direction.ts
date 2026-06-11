// Mirrors the Nuxt useTextDirection composable: detect RTL from the first
// strong character so user content aligns correctly inside blocks.
const RTL = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

export function dirOf(text?: string): "rtl" | "ltr" {
  if (!text) return "ltr";
  return RTL.test(text) ? "rtl" : "ltr";
}
