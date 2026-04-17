// Mock DB dependencies so neon doesn't require DATABASE_URL at import time
jest.mock("@neondatabase/serverless", () => ({
  neon: jest.fn(() => jest.fn()),
}));

jest.mock("drizzle-orm/neon-http", () => ({
  drizzle: jest.fn(() => ({
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
  })),
}));

import {
  encryptToken,
  decryptToken,
  mapPlaidCategory,
  mapPlaidAccountType,
} from "../plaid";

describe("encryptToken / decryptToken", () => {
  beforeAll(() => {
    process.env.PLAID_ENCRYPTION_KEY = "a".repeat(64); // 32 bytes as hex
  });

  it("roundtrips a token correctly", () => {
    const token = "access-sandbox-abc123";
    expect(decryptToken(encryptToken(token))).toBe(token);
  });

  it("produces different ciphertexts each call (random IV)", () => {
    const token = "access-sandbox-abc123";
    expect(encryptToken(token)).not.toBe(encryptToken(token));
  });
});

describe("mapPlaidCategory", () => {
  it("maps Food and Drink to Food", () => {
    expect(mapPlaidCategory(["Food and Drink", "Restaurants"])).toBe("Food");
  });

  it("maps Travel to Transport", () => {
    expect(mapPlaidCategory(["Travel", "Airlines and Aviation Services"])).toBe("Transport");
  });

  it("maps Healthcare to Health", () => {
    expect(mapPlaidCategory(["Healthcare", "Pharmacies"])).toBe("Health");
  });

  it("maps Recreation to Entertainment", () => {
    expect(mapPlaidCategory(["Recreation", "Gyms and Fitness Centers"])).toBe("Entertainment");
  });

  it("maps Shops to Shopping", () => {
    expect(mapPlaidCategory(["Shops", "Department Stores"])).toBe("Shopping");
  });

  it("maps Transfer/Deposit to Income", () => {
    expect(mapPlaidCategory(["Transfer", "Payroll"])).toBe("Income");
  });

  it("falls back to Other for unknown", () => {
    expect(mapPlaidCategory(["Service", "Financial"])).toBe("Other");
  });

  it("handles null category", () => {
    expect(mapPlaidCategory(null)).toBe("Other");
  });
});

describe("mapPlaidAccountType", () => {
  it("maps depository/checking to checking", () => {
    expect(mapPlaidAccountType("depository", "checking")).toBe("checking");
  });

  it("maps depository/savings to savings", () => {
    expect(mapPlaidAccountType("depository", "savings")).toBe("savings");
  });

  it("maps credit to credit", () => {
    expect(mapPlaidAccountType("credit", "credit card")).toBe("credit");
  });

  it("maps investment to investment", () => {
    expect(mapPlaidAccountType("investment", null)).toBe("investment");
  });

  it("maps loan to loan", () => {
    expect(mapPlaidAccountType("loan", "mortgage")).toBe("loan");
  });

  it("defaults unknown types to checking", () => {
    expect(mapPlaidAccountType("other", null)).toBe("checking");
  });
});
