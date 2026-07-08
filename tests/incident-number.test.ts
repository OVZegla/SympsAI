import { describe, it, expect } from "vitest";
import { computeNextIncidentNumber } from "@/lib/incident-number";

describe("computeNextIncidentNumber", () => {
  it("starts at INC-0001 when there is no previous incident", () => {
    expect(computeNextIncidentNumber(null)).toBe("INC-0001");
  });

  it("increments the last number", () => {
    expect(computeNextIncidentNumber("INC-0041")).toBe("INC-0042");
  });

  it("pads to four digits and keeps growing past 9999", () => {
    expect(computeNextIncidentNumber("INC-0009")).toBe("INC-0010");
    expect(computeNextIncidentNumber("INC-9999")).toBe("INC-10000");
  });

  it("is defensive against malformed input", () => {
    expect(computeNextIncidentNumber("garbage")).toBe("INC-0001");
    expect(computeNextIncidentNumber("")).toBe("INC-0001");
  });
});
