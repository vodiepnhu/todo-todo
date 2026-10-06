import { describe, expect, it } from "vitest";
import { paths } from "@/lib/paths";

describe("project dashboard paths", () => {
  it("points today/history at hash anchors and dashboard at root", () => {
    expect(paths.project("abc")).toBe("/projects/abc");
    expect(paths.projectDashboard("abc")).toBe("/projects/abc");
    expect(paths.projectToday("abc")).toBe("/projects/abc#today");
    expect(paths.projectHistory("abc")).toBe("/projects/abc#history");
  });
});
