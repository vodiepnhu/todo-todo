"use client";

import Link from "next/link";
import { Bot, Sparkles, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { paths } from "@/lib/paths";
import { LanguageSwitcher, useLocale } from "@/lib/i18n";
import { FunnyLogo } from "@/components/ui/funny-logo";

export function AccountShell({
  active,
  children,
}: {
  active: "account" | "llm" | "agentops";
  children: React.ReactNode;
}) {
  const { dictionary } = useLocale();
  const nav = [
    { id: "account" as const, label: dictionary.account.personal, href: paths.account(), icon: UserRound },
    { id: "llm" as const, label: dictionary.account.aiProvider, href: paths.accountLlm(), icon: Sparkles },
    { id: "agentops" as const, label: dictionary.account.agentOps, href: paths.accountAgentops(), icon: Bot },
  ];
  return (
    <div className="min-h-dvh bg-[radial-gradient(ellipse_at_top,_#ddeee9_0%,_#f2f7f5_45%,_#fff_100%)]">
      <div className="mx-auto flex min-h-dvh max-w-6xl">
        <aside className="hidden w-60 shrink-0 flex-col gap-1.5 border-r border-white/80 bg-white/75 p-4.5 shadow-xs backdrop-blur-md md:flex">
          <div className="mb-4 px-2">
            <Link href={paths.projects()} className="mb-3 block">
              <FunnyLogo size="sm" />
            </Link>
            <Link
              href={paths.projects()}
              className="text-xs font-bold uppercase tracking-wide text-primary hover:underline"
            >
              {dictionary.nav.allProjects}
            </Link>
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted">
              {dictionary.account.personal}
            </p>
          </div>
          <nav className="flex flex-col gap-1.5">
            {nav.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-muted transition-all duration-150 hover:bg-primary-soft/50 hover:text-foreground",
                    active === item.id
                      ? "bg-primary-soft/90 font-bold text-primary shadow-xs"
                      : undefined,
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
            <Link
              href={paths.projects()}
              className="mt-3 rounded-xl px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-primary-soft/50 hover:text-foreground"
            >
              {dictionary.account.home}
            </Link>
          </nav>
          <div className="mt-auto flex justify-end px-2 pt-4">
            <LanguageSwitcher />
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-white/80 bg-white/80 px-4 py-3.5 shadow-xs backdrop-blur-md md:hidden">
            <div className="mb-3 flex items-center justify-between">
              <Link href={paths.projects()}>
                <FunnyLogo size="sm" showText={false} />
              </Link>
              <LanguageSwitcher />
            </div>
            <nav className="flex flex-wrap items-center gap-1.5 text-sm">
              {nav.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-medium text-muted",
                      active === item.id
                        ? "bg-primary-soft font-bold text-primary shadow-xs"
                        : "hover:bg-primary-soft/70 hover:text-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </header>
          <main className="flex-1 px-4 py-5 pb-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
