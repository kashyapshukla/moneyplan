jest.mock("@neondatabase/serverless", () => ({
  neon: jest.fn(() => jest.fn()),
}));

jest.mock("drizzle-orm/neon-http", () => ({
  drizzle: jest.fn(() => ({
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  })),
}));

import { db } from "../db";

describe("db", () => {
  it("exports a db instance", () => {
    expect(db).toBeDefined();
    expect(typeof db.select).toBe("function");
    expect(typeof db.insert).toBe("function");
  });
});
