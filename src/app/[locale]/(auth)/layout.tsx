import { LanguageSwitcher } from "@/components/language-switcher";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="flex items-center justify-between p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo.svg" alt="QShot" width={30} height={30} />
        <LanguageSwitcher />
      </header>
      <main className="flex flex-1 justify-center px-4">
        <div className="w-full max-w-[400px] pb-8 pt-2">{children}</div>
      </main>
    </div>
  );
}
