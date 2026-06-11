import type { WebsiteSettings, TextField } from "@/lib/types/profile";
import { argbToCss } from "@/lib/builder/color";
import { dirOf } from "@/lib/builder/text-direction";

function textValue(v?: TextField | string): string {
  if (!v) return "";
  return typeof v === "string" ? v : (v.text ?? "");
}

export function Hero({ settings }: { settings: WebsiteSettings }) {
  const name = textValue(settings.name);
  const bio = textValue(settings.bio);
  const avatar = settings.profile_picture?.image_url;
  const cover = settings.cover_photo?.image_url;
  const coverColor = argbToCss(settings.cover_photo?.color);
  const shape = settings.profile_picture?.shape ?? "circle";

  return (
    <div className="relative">
      <div
        className="h-28 w-full bg-muted"
        style={{
          background:
            cover && !coverColor
              ? `center/cover no-repeat url(${cover})`
              : (coverColor ?? "linear-gradient(135deg,#C389FF,#4488FF)"),
        }}
      />
      <div className="flex flex-col items-center px-4 pb-3">
        <div
          className="-mt-10 size-20 overflow-hidden border-4 border-white bg-muted"
          style={{ borderRadius: shape === "circle" ? "9999px" : "12px" }}
        >
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt={name}
              className="size-full object-cover"
            />
          ) : null}
        </div>
        {name && (
          <h2
            dir={dirOf(name)}
            className="mt-2 text-lg font-bold text-foreground"
            style={{ color: argbToCss((settings.name as TextField)?.color) }}
          >
            {name}
          </h2>
        )}
        {bio && (
          <p
            dir={dirOf(bio)}
            className="mt-1 text-center text-sm text-muted-foreground"
          >
            {bio}
          </p>
        )}
      </div>
    </div>
  );
}
