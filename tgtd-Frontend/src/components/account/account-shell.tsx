"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { paths } from "@/lib/paths";

const NAV = [
  { id: "account" as const, label: "Account", href: paths.account() },
  { id: "llm" as const, label: "AI Provider", href: paths.accountLlm() },
  { id: "agentops" as const, label: "Agent Ops", href: paths.accountAgentops() },
];

export function AccountShell({
  active,
  children,
}: {
  active: "account" | "llm" | "agentops";
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-[radial-gradient(ellipse_at_top,_#ddeee9_0%,_#f2f7f5_45%,_#fff_100%)]">
      <div className="mx-auto flex min-h-dvh max-w-6xl">
        <aside className="hidden w-52 shrink-0 border-r border-border/70 bg-surface/80 p-4 backdrop-blur md:block">
          <p className="text-xs uppercase tracking-wide text-muted">
            Shared Planner
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">Personal</p>
          <nav className="mt-6 flex flex-col gap-1">
            {NAV.map((item) => (
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
              ← Home
            </Link>
          </nav>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-border/70 bg-surface/80 px-4 py-3 backdrop-blur md:hidden">
            <nav className="flex flex-wrap gap-1 text-sm">
              {NAV.map((item) => (
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
            </nav>
          </header>
          <main className="flex-1 px-4 py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
