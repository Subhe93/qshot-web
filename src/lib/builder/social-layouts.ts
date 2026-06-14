import type { SocialLinksLayoutType } from "@/lib/types/blocks";

/** The 8 social layouts with their mobile preview SVGs (public/layouts). */
export interface SocialLayout {
  type: SocialLinksLayoutType;
  label: string;
  preview: string;
}

export const SOCIAL_LAYOUTS: SocialLayout[] = [
  { type: "list", label: "List", preview: "/layouts/layout_list.svg" },
  { type: "listAlignCenter", label: "List centered", preview: "/layouts/layout_list_align_center.svg" },
  { type: "listAlignEnd", label: "List end", preview: "/layouts/layout_list_align_end.svg" },
  { type: "grid", label: "Grid", preview: "/layouts/layout_grid.svg" },
  { type: "gridAlignStart", label: "Grid start", preview: "/layouts/layout_grid_align_start.svg" },
  { type: "gridAlignCenter", label: "Grid centered", preview: "/layouts/layout_grid_align_center.svg" },
  { type: "gridAlignEnd", label: "Grid end", preview: "/layouts/layout_grid_align_end.svg" },
  { type: "layoutSlider", label: "Slider", preview: "/layouts/layout_slider.svg" },
];
