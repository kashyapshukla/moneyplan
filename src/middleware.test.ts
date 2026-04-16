jest.mock("@/lib/auth", () => ({
  auth: jest.fn((handler) => handler),
}));

jest.mock("next/server", () => ({
  NextResponse: {
    redirect: jest.fn(),
    next: jest.fn(),
  },
}));

import { config } from "./middleware";

describe("middleware config", () => {
  it("exports a matcher pattern", () => {
    expect(config.matcher).toBeDefined();
    expect(Array.isArray(config.matcher)).toBe(true);
    expect(config.matcher.length).toBeGreaterThan(0);
  });

  it("exports a middleware function", () => {
    const mod = require("./middleware");
    expect(typeof mod.middleware).toBe("function");
  });
});
