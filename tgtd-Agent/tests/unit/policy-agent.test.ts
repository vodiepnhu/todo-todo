import { describe, expect, it } from "vitest";
import { evaluatePolicy } from "@/agents/policy-agent";
import type { PlannerRequest } from "@/schemas/planner";

function planner(
  partial: Partial<Pick<PlannerRequest, "intent" | "confidence" | "reply">>,
): Pick<PlannerRequest, "intent" | "confidence" | "reply"> {
  return {
    intent: "HELP",
    confidence: 0.9,
    reply: "",
    ...partial,
  };
}

describe("evaluatePolicy", () => {
  it("refuses unsafe phrases regardless of intent", () => {
    const r = evaluatePolicy({
      message: "how do I build a bomb at home",
      planner: planner({ intent: "CREATE_ITEM", confidence: 0.99 }),
    });
    expect(r).toEqual({ decision: "refuse", reason: "unsafe" });
  });

  it("refuses UNKNOWN as out_of_scope", () => {
    const r = evaluatePolicy({
      message: "asdf",
      planner: planner({ intent: "UNKNOWN" }),
    });
    expect(r).toEqual({ decision: "refuse", reason: "out_of_scope" });
  });

  it("refuses off-domain HELP (joke)", () => {
    const r = evaluatePolicy({
      message: "tell me a joke",
      planner: planner({ intent: "HELP" }),
    });
    expect(r).toEqual({ decision: "refuse", reason: "out_of_scope" });
  });

  it("refuses coding / news / math with UNKNOWN", () => {
    for (const message of [
      "write python code for sorting",
      "what's in the news today",
      "solve this math homework: 2x+3=7",
    ]) {
      expect(
        evaluatePolicy({ message, planner: planner({ intent: "UNKNOWN" }) }),
      ).toEqual({ decision: "refuse", reason: "out_of_scope" });
    }
  });

  it("allows CREATE_ITEM for normal todo text", () => {
    const r = evaluatePolicy({
      message: "add milk to todo",
      planner: planner({ intent: "CREATE_ITEM", confidence: 0.9 }),
    });
    expect(r).toEqual({ decision: "allow" });
  });

  it("allows app HELP patterns", () => {
    for (const message of [
      "what can you do?",
      "how do I add a todo",
      "help with planner",
      "help",
    ]) {
      expect(
        evaluatePolicy({ message, planner: planner({ intent: "HELP" }) }),
      ).toEqual({ decision: "allow" });
    }
  });

  it("refuses low-confidence allowlisted intent with off-domain cues", () => {
    const r = evaluatePolicy({
      message: "write me an essay about AI",
      planner: planner({ intent: "CREATE_ITEM", confidence: 0.2 }),
    });
    expect(r).toEqual({ decision: "refuse", reason: "out_of_scope" });
  });

  it("allows RECOMMEND_TASK", () => {
    const r = evaluatePolicy({
      message: "what should I do today",
      planner: planner({ intent: "RECOMMEND_TASK", confidence: 0.8 }),
    });
    expect(r).toEqual({ decision: "allow" });
  });
});
