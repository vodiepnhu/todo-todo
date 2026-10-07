"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { paths } from "@/lib/paths";
import { LanguageSwitcher, useLocale } from "@/lib/i18n";

export function AccountShell({
  active,
  children,
}: {
  active: "account" | "llm" | "agentops";
  children: React.ReactNode;
}) {
  const { dictionary } = useLocale();
  const nav = [
    { id: "account" as const, label: dictionary.account.personal, href: paths.account() },
    { id: "llm" as const, label: dictionary.account.aiProvider, href: paths.accountLlm() },
    { id: "agentops" as const, label: dictionary.account.agentOps, href: paths.accountAgentops() },
  ];
  return (
    <div className="min-h-dvh bg-[radial-gradient(ellipse_at_top,_#ddeee9_0%,_#f2f7f5_45%,_#fff_100%)]">
      <div className="mx-auto flex min-h-dvh max-w-6xl">
        <aside className="hidden w-52 shrink-0 border-r border-border/70 bg-surface/80 p-4 backdrop-blur md:block">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-wide text-muted">Shared Planner</p>
            <LanguageSwitcher />
          </div>
          <p className="mt-1 text-sm font-semibold text-foreground">{dictionary.account.personal}</p>
          <nav className="mt-6 flex flex-col gap-1">
            {nav.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm transition-colors duration-150",
                  active === item.id
                    ? "bg-primary-soft font-medium text-foreground"
                    : "text-muted hover:bg-primary-soft/70",
                )}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href={paths.projects()}
              className="mt-4 rounded-lg px-3 py-2 text-sm text-muted hover:bg-primary-soft/70"
            >
              {dictionary.account.home}
            </Link>
          </nav>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-border/70 bg-surface/80 px-4 py-3 backdrop-blur md:hidden">
            <nav className="flex flex-wrap items-center gap-1 text-sm">
              {nav.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn(
                    "rounded-lg px-3 py-1.5",
                    active === item.id
                      ? "bg-primary-soft font-medium text-foreground"
                      : "text-muted hover:bg-primary-soft/70",
                  )}
                >
                  {item.label}
                </Link>
              ))}
              <LanguageSwitcher />
            </nav>
          </header>
          <main className="flex-1 px-4 py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
