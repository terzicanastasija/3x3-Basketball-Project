import { computeClipWindow } from "./clip-window";

describe("computeClipWindow", () => {
  it("uses the full 5s-before/3s-after window for a tag with enough lead-in", () => {
    expect(computeClipWindow(20)).toEqual({ start: 15, duration: 8 });
  });

  it("clamps start to 0 instead of requesting a negative -ss, shrinking the window", () => {
    // timestamp 2s: 2 - 5 = -3, clamped to 0; end stays at 2 + 3 = 5, so duration is 5, not 8.
    expect(computeClipWindow(2)).toEqual({ start: 0, duration: 5 });
  });

  it("clamps to 0 exactly at timestamp 0", () => {
    expect(computeClipWindow(0)).toEqual({ start: 0, duration: 3 });
  });

  it("handles fractional timestamps", () => {
    expect(computeClipWindow(10.5)).toEqual({ start: 5.5, duration: 8 });
  });

  it("uses an explicit manual in/out mark verbatim instead of the auto window", () => {
    // Well outside the auto 5s/3s window around timestamp 20 — proves the mark wins, not a
    // coincidence of the fallback math.
    expect(computeClipWindow(20, 40, 55)).toEqual({ start: 40, duration: 15 });
  });

  it("clamps a manual in-point to 0 just like the auto window does", () => {
    expect(computeClipWindow(20, -3, 4)).toEqual({ start: 0, duration: 4 });
  });

  it("falls back to the auto window when only one of clipIn/clipOut is set", () => {
    // The DTO layer should reject this combination before it ever reaches here, but this
    // function must still degrade safely rather than produce a nonsensical negative duration.
    expect(computeClipWindow(20, 40, null)).toEqual({ start: 15, duration: 8 });
    expect(computeClipWindow(20, null, 55)).toEqual({ start: 15, duration: 8 });
  });
});
