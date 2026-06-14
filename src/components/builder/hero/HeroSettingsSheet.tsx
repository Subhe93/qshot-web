"use client";

import { useState } from "react";
import {
  Heading,
  Image as ImageIcon,
  Layout,
  Palette,
  type LucideIcon,
  MousePointerClick,
  Type,
  UserRound,
} from "lucide-react";
import { useEditorStore } from "@/stores/editor-store";
import { heroStyleFlags } from "@/lib/builder/hero-defaults";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { cn } from "@/lib/utils";
import type { HeroTab, WebsiteSettings } from "@/lib/types/profile";
import { StyleTab } from "./StyleTab";
import { CoverTab } from "./CoverTab";
import { HeaderTab } from "./HeaderTab";
import { PictureTab } from "./PictureTab";
import { TitleTextTab } from "./TitleTextTab";
import { ButtonTab } from "./ButtonTab";

// Tab labels + icons. Only "design" + text/button tabs are handled here;
// "name"/"bio" open separate sheets (NameBioSheet).
const TAB_META: Record<
  Exclude<HeroTab, "name" | "bio">,
  { label: string; Icon: LucideIcon }
> = {
  style: { label: "Style", Icon: Palette },
  header: { label: "Header", Icon: Layout },
  picture: { label: "Picture", Icon: UserRound },
  cover: { label: "Cover", Icon: ImageIcon },
  title: { label: "Title", Icon: Heading },
  text: { label: "Text", Icon: Type },
  button1: { label: "Button 1", Icon: MousePointerClick },
  button2: { label: "Button 2", Icon: MousePointerClick },
};

type HandledTab = keyof typeof TAB_META;

export function HeroSettingsSheet({
  initialTab,
  onClose,
}: {
  initialTab: HeroTab;
  onClose: () => void;
}) {
  const settings = useEditorStore((s) => s.settings);
  const update = useEditorStore((s) => s.updateSettings);

  const flags = heroStyleFlags(settings.style ?? "style2");
  const available = (
    [
      "style",
      "header",
      flags.hasProfileImage && "picture",
      "cover",
      flags.hasTitle && "title",
      flags.hasText && "text",
      flags.hasButton1 && "button1",
      flags.hasButton2 && "button2",
    ] as (HandledTab | false)[]
  ).filter(Boolean) as HandledTab[];

  const [activeTab, setActiveTab] = useState<HandledTab>(
    available.includes(initialTab as HandledTab)
      ? (initialTab as HandledTab)
      : "style",
  );

  return (
    <BottomSheet title="Website" subtitle="Settings" onClose={onClose}>
      <div className="space-y-4">
        {/* Wrapping tab bar — every tab stays visible (no horizontal scrolling). */}
        <div className="flex flex-wrap gap-1.5">
          {available.map((value) => {
            const { label, Icon } = TAB_META[value];
            const active = value === activeTab;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setActiveTab(value)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors",
                  active
                    ? "bg-primary/10 text-foreground ring-1 ring-primary/40"
                    : "bg-foreground/[0.05] text-foreground/55",
                )}
              >
                <Icon
                  className="size-[15px]"
                  style={active ? { color: "var(--primary)" } : undefined}
                />
                {label}
              </button>
            );
          })}
        </div>

        <ActiveTab tab={activeTab} settings={settings} update={update} />
      </div>
    </BottomSheet>
  );
}

function ActiveTab({
  tab,
  settings,
  update,
}: {
  tab: HandledTab;
  settings: WebsiteSettings;
  update: (patch: Partial<WebsiteSettings>) => void;
}) {
  switch (tab) {
    case "style":
      return <StyleTab settings={settings} update={update} />;
    case "header":
      return <HeaderTab settings={settings} update={update} />;
    case "picture":
      return <PictureTab settings={settings} update={update} />;
    case "cover":
      return <CoverTab settings={settings} update={update} />;
    case "title":
      return <TitleTextTab settings={settings} update={update} which="title" />;
    case "text":
      return <TitleTextTab settings={settings} update={update} which="text" />;
    case "button1":
      return <ButtonTab settings={settings} update={update} which="button1" />;
    case "button2":
      return <ButtonTab settings={settings} update={update} which="button2" />;
  }
}
