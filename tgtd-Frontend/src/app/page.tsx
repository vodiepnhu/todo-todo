"use client";

import Link from "next/link";
import { paths } from "@/shared/navigation/paths";
import { LanguageSwitcher, useLocale } from "@/lib/i18n";

export default function LandingPage() {
  const { locale } = useLocale();
  const vi = locale === "vi";
  return (
    <div className="relative min-h-dvh overflow-hidden bg-[radial-gradient(ellipse_at_top_left,_#b8d4cc_0%,_#f2f7f5_40%,_#fff_75%)]">
      <div className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-6 py-16">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Planner</p>
          <LanguageSwitcher />
        </div>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground md:text-5xl">
          {vi ? "Kế hoạch chung cho cặp đôi và gia đình" : "Shared plans for couples & families"}
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted">
          {vi ? "Hoạt động, trò chuyện realtime và AI planner — nhẹ, nhanh và riêng tư." : "Activities, realtime chat, and an AI planner — light, fast, and private."}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={paths.signup()}
            className="inline-flex h-11 items-center rounded-full bg-cta px-6 text-sm font-medium text-white transition-colors duration-150 hover:bg-cta-hover active:scale-[0.98]"
          >
            {vi ? "Bắt đầu" : "Get started"}
          </Link>
          <Link
            href={paths.login()}
            className="inline-flex h-11 items-center rounded-xl border border-border bg-surface px-6 text-sm font-medium text-foreground hover:bg-primary-soft/60"
          >
            {vi ? "Đăng nhập" : "Sign in"}
          </Link>
        </div>
      </div>
    </div>
  );
}
