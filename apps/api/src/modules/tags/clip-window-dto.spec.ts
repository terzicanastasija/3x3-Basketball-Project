import { createTagSchema } from "@3x3/shared";

// Validates the DTO-layer guard for manual in/out marks — the pure clip-window math in
// clips/clip-window.spec.ts trusts these constraints already hold, so this is what actually
// enforces them before a tag ever reaches the service layer.
describe("createTagSchema clip window validation", () => {
  const base = {
    timestampSec: 12,
    actionType: "STEAL" as const,
    teamId: "team-1",
  };

  it("accepts a valid clipInSec/clipOutSec pair", () => {
    const result = createTagSchema.safeParse({ ...base, clipInSec: 5, clipOutSec: 9 });
    expect(result.success).toBe(true);
  });

  it("accepts omitting both", () => {
    expect(createTagSchema.safeParse(base).success).toBe(true);
  });

  it("rejects clipInSec set without clipOutSec", () => {
    expect(createTagSchema.safeParse({ ...base, clipInSec: 5 }).success).toBe(false);
  });

  it("rejects clipOutSec set without clipInSec", () => {
    expect(createTagSchema.safeParse({ ...base, clipOutSec: 9 }).success).toBe(false);
  });

  it("rejects clipOutSec at or before clipInSec", () => {
    expect(createTagSchema.safeParse({ ...base, clipInSec: 9, clipOutSec: 9 }).success).toBe(false);
    expect(createTagSchema.safeParse({ ...base, clipInSec: 9, clipOutSec: 5 }).success).toBe(false);
  });
});
