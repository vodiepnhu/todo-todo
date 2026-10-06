import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AccountShell } from "@/components/account/account-shell";
import { paths } from "@/lib/paths";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe("paths account", () => {
  it("uses nested routes not hashes", () => {
    expect(paths.account()).toBe("/account");
    expect(paths.accountLlm()).toBe("/account/llm");
    expect(paths.accountAgentops()).toBe("/account/agentops");
  });
});

describe("AccountShell", () => {
  it("renders sidebar links", () => {
    render(
      <AccountShell active="agentops">
        <p>body</p>
      </AccountShell>,
    );
    const accountLinks = screen.getAllByRole("link", { name: /^account$/i });
    expect(accountLinks.length).toBeGreaterThanOrEqual(1);
    for (const link of accountLinks) {
      expect(link.getAttribute("href")).toBe("/account");
    }
    const llmLinks = screen.getAllByRole("link", { name: /ai provider/i });
    for (const link of llmLinks) {
      expect(link.getAttribute("href")).toBe("/account/llm");
    }
    const opsLinks = screen.getAllByRole("link", { name: /agent ops/i });
    for (const link of opsLinks) {
      expect(link.getAttribute("href")).toBe("/account/agentops");
    }
    expect(screen.getByText("body")).toBeTruthy();
  });
});
