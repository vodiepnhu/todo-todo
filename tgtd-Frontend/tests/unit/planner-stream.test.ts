import { describe, expect, it } from "vitest";
import {
  consumePlannerStream,
  encodePlannerEvent,
} from "@/lib/chat/planner-stream";

describe("planner stream", () => {
  it("reads progress events and final result", async () => {
    const progress: string[] = [];
    const body =
      encodePlannerEvent({ type: "progress", step: "understand", status: "active" }) +
      encodePlannerEvent({ type: "progress", step: "understand", status: "done" }) +
      encodePlannerEvent({ type: "result", payload: { pendingId: "pending-1" } });

    const result = await consumePlannerStream(
      new Response(body, {
        headers: { "Content-Type": "text/event-stream" },
      }),
      (event) => progress.push(`${event.step}:${event.status}`),
    );

    expect(progress).toEqual(["understand:active", "understand:done"]);
    expect(result).toEqual({ pendingId: "pending-1" });
  });
});
