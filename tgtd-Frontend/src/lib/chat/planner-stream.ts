export type PlannerProgressStep =
  | "understand"
  | "context"
  | "places"
  | "draft"
  | "check"
  | "save"
  | "complete";

export type PlannerProgressEvent = {
  step: PlannerProgressStep;
  status: "active" | "done";
};

export type PlannerStreamEvent<T = unknown> =
  | ({ type: "progress" } & PlannerProgressEvent)
  | { type: "result"; payload: T }
  | { type: "error"; error: string };

export function mergePlannerProgress(
  current: PlannerProgressEvent[],
  event: PlannerProgressEvent,
): PlannerProgressEvent[] {
  return [...current.filter((item) => item.step !== event.step), event];
}

export function encodePlannerEvent(event: PlannerStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function createPlannerStream(
  run: (emit: (event: PlannerStreamEvent) => void) => Promise<unknown>,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (event: PlannerStreamEvent) => {
        controller.enqueue(encoder.encode(encodePlannerEvent(event)));
      };

      void run(emit)
        .then((payload) => {
          emit({ type: "result", payload });
          controller.close();
        })
        .catch((error: unknown) => {
          emit({
            type: "error",
            error: error instanceof Error ? error.message : "Planner failed",
          });
          controller.close();
        });
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
    },
  });
}

export async function consumePlannerStream<T>(
  response: Response,
  onProgress: (event: PlannerProgressEvent) => void,
): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    return (await response.json()) as T;
  }

  if (!response.body) throw new Error("Planner stream is empty");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: T | undefined;

  const consumeBlock = (block: string) => {
    const data = block
      .split("\n")
      .find((line) => line.startsWith("data: "))
      ?.slice(6);
    if (!data) return;

    const event = JSON.parse(data) as PlannerStreamEvent<T>;
    if (event.type === "progress") onProgress(event);
    if (event.type === "result") result = event.payload;
    if (event.type === "error") throw new Error(event.error);
  };

  while (true) {
    const chunk = await reader.read();
    buffer += decoder.decode(chunk.value ?? new Uint8Array(), {
      stream: !chunk.done,
    });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) consumeBlock(block);
    if (chunk.done) break;
  }
  if (buffer.trim()) consumeBlock(buffer);

  if (result === undefined) throw new Error("Planner returned no result");
  return result;
}
