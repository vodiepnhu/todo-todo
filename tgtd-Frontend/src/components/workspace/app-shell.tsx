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

const nav = [
  { href: "", label: "Dashboard", icon: LayoutDashboard },
  { href: "chat", label: "Chat", icon: MessageCircle },
  { href: "lists", label: "Lists", icon: ListTodo },
  { href: "settings", label: "Settings", icon: Settings },
];

const mobileNav = [
  { href: "", label: "Dash", icon: LayoutDashboard },
  { href: "chat", label: "Chat", icon: MessageCircle },
  { href: "lists", label: "Lists", icon: ListTodo },
  { href: "settings", label: "Settings", icon: Settings },
];

export function AppShell({
  workspaceId,
  workspaceName,
  children,
  onQuickAdd,
}: {
  workspaceId: string;
  workspaceName: string;
  children: React.ReactNode;
  onQuickAdd?: () => void;
}) {
  const pathname = usePathname();
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
    <div className="min-h-dvh bg-[radial-gradient(ellipse_at_top,_#ddeee9_0%,_#f2f7f5_45%,_#fff_100%)]">
      <div className="mx-auto flex min-h-dvh max-w-6xl">
        <aside className="hidden w-56 shrink-0 flex-col gap-1 border-r border-border/70 bg-surface/60 p-4 backdrop-blur md:flex">
          <div className="mb-4 px-2">
            <Link
              href={paths.projects()}
              className="text-xs uppercase tracking-wide text-primary hover:underline"
            >
              ← All projects
            </Link>
            <p className="mt-1 text-xs uppercase tracking-wide text-muted">
              Project
            </p>
            <p className="truncate text-sm font-semibold text-foreground">
              {workspaceName}
            </p>
          </div>
          {nav.map((item) => {
            const href = hrefFor(item.href);
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted transition-colors duration-150 hover:bg-primary-soft",
                  active && "bg-primary-soft font-medium text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border/70 bg-surface/80 px-4 py-3 backdrop-blur">
            <h1 className="text-base font-semibold text-foreground md:hidden">
              {workspaceName}
            </h1>
            <div className="ml-auto">
              <Button size="sm" className="rounded-full" onClick={onQuickAdd}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          </header>
          <main className="flex-1 px-4 py-4 pb-24 md:pb-6">{children}</main>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-lg justify-around px-2 py-2">
          {mobileNav.map((item) => {
            const href = hrefFor(item.href);
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={href}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[10px] text-muted",
                  active && "text-primary",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
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
