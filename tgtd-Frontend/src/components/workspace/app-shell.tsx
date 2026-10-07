"use client";

import { useEffect } from "react";
import {
  MessageCircle,
  ListTodo,
  LayoutDashboard,
  Settings,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { paths } from "@/lib/paths";
import { LanguageSwitcher, useLocale } from "@/lib/i18n";
import { FunnyLogo } from "@/components/ui/funny-logo";

const nav = [
  { href: "", key: "dashboard" as const, icon: LayoutDashboard },
  { href: "chat", key: "chat" as const, icon: MessageCircle },
  { href: "lists", key: "lists" as const, icon: ListTodo },
  { href: "settings", key: "settings" as const, icon: Settings },
];

const mobileNav = [
  { href: "", key: "dashboard" as const, icon: LayoutDashboard },
  { href: "chat", key: "chat" as const, icon: MessageCircle },
  { href: "lists", key: "lists" as const, icon: ListTodo },
  { href: "settings", key: "settings" as const, icon: Settings },
];

export function AppShell({
  workspaceId,
  workspaceName,
  canAdd,
  children,
  onQuickAdd,
}: {
  workspaceId: string;
  workspaceName: string;
  canAdd: boolean;
  children: React.ReactNode;
  onQuickAdd?: () => void;
}) {
  const pathname = usePathname();
  const { dictionary } = useLocale();
  const base = paths.project(workspaceId);

  function hrefFor(segment: string) {
    return segment ? `${base}/${segment}` : base;
  }

  function isActive(segment: string) {
    const target = hrefFor(segment);
    if (!segment) return pathname === base || pathname === `${base}/`;
    return pathname === target || pathname.startsWith(`${target}/`);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        onQuickAdd?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onQuickAdd]);

  return (
    <div className="min-h-dvh bg-[radial-gradient(ellipse_at_top,_#e0f2fe_0%,_#f5f9fd_45%,_#ffffff_100%)]">
      <div className="mx-auto flex min-h-dvh max-w-6xl">
        <aside className="hidden w-60 shrink-0 flex-col gap-1.5 border-r border-white/80 bg-white/75 p-4.5 backdrop-blur-md md:flex shadow-xs">
          <div className="mb-4 px-2">
            <Link href={paths.projects()} className="mb-3 block">
              <FunnyLogo size="sm" />
            </Link>
            <Link
              href={paths.projects()}
              className="text-xs uppercase tracking-wide text-primary font-bold hover:underline"
            >
              ← {dictionary.nav.allProjects}
            </Link>
            <p className="mt-1 text-xs uppercase tracking-wide text-muted font-medium">
              {dictionary.nav.project}
            </p>
            <p className="truncate text-base font-bold text-foreground">
              {workspaceName}
            </p>
          </div>
          {nav.map((item) => {
            const href = hrefFor(item.href);
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={href}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted font-medium transition-all duration-150 hover:bg-primary-soft/50 hover:text-foreground",
                  active && "bg-primary-soft/90 font-bold text-primary shadow-xs",
                )}
              >
                <Icon className="h-4 w-4" />
                {dictionary.nav[item.key]}
              </Link>
            );
          })}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/80 bg-white/80 px-5 py-3.5 backdrop-blur-md shadow-xs">
            <h1 className="text-base font-bold text-foreground md:hidden">
              {workspaceName}
            </h1>
            <div className="ml-auto flex items-center gap-2.5">
              <LanguageSwitcher />
              {canAdd ? (
                <Button size="sm" className="rounded-full shadow-xs" onClick={onQuickAdd}>
                  <Plus className="h-4 w-4" /> {dictionary.nav.add}
                </Button>
              ) : null}
            </div>
          </header>
          <main className="flex-1 px-4 py-5 pb-24 md:pb-8">{children}</main>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/80 bg-white/90 backdrop-blur-md shadow-[-4px_-2px_12px_rgba(147,175,212,0.18)] md:hidden">
        <div className="mx-auto flex max-w-lg justify-around px-2 py-2">
          {mobileNav.map((item) => {
            const href = hrefFor(item.href);
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={href}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-1 text-[11px] font-semibold text-muted transition-colors",
                  active && "text-primary bg-primary-soft/70 shadow-xs",
                )}
              >
                <Icon className="h-5 w-5" />
                {dictionary.nav[item.key]}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export function useWorkspaceRouter(workspaceId: string) {
  const router = useRouter();
  return {
    go: (segment: string) =>
      router.push(
        segment
          ? `${paths.project(workspaceId)}/${segment}`
          : paths.project(workspaceId),
      ),
  };
}
