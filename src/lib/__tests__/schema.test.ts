import { users, accounts, transactions, budgets, netWorthSnapshots } from "../schema";

describe("schema", () => {
  it("exports all five tables", () => {
    expect(users).toBeDefined();
    expect(accounts).toBeDefined();
    expect(transactions).toBeDefined();
    expect(budgets).toBeDefined();
    expect(netWorthSnapshots).toBeDefined();
  });

  it("users table has required columns", () => {
    expect(users.id).toBeDefined();
    expect(users.email).toBeDefined();
    expect(users.name).toBeDefined();
  });

  it("transactions table has category enum column", () => {
    expect(transactions.category).toBeDefined();
  });

  it("accounts table has type enum column", () => {
    expect(accounts.type).toBeDefined();
  });
});
