// The 7 hero templates (mobile HeroStyle.style1..7). Preview images are the
// real mobile assets (assets/image/st1..st7 → public/templates/styleN.*).

export type HeroStyleId =
  | "style1"
  | "style2"
  | "style3"
  | "style4"
  | "style5"
  | "style6"
  | "style7";

export interface TemplateConfig {
  style: HeroStyleId;
  image: string;
}

export const TEMPLATES: TemplateConfig[] = [
  { style: "style1", image: "/templates/style1.png" },
  { style: "style2", image: "/templates/style2.jpg" },
  { style: "style3", image: "/templates/style3.png" },
  { style: "style4", image: "/templates/style4.png" },
  { style: "style5", image: "/templates/style5.png" },
  { style: "style6", image: "/templates/style6.png" },
  { style: "style7", image: "/templates/style7.png" },
];

export const DEFAULT_STYLE: HeroStyleId = "style2";
