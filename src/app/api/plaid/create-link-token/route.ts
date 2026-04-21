import { auth } from "@/lib/auth";
import { plaidClient } from "@/lib/plaid";
import { CountryCode, Products } from "plaid";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: session.user.id },
      client_name: "MoneyPlan",
      products: [Products.Transactions, Products.Investments],
      country_codes: [CountryCode.Us],
      language: "en",
    });

    return Response.json({ linkToken: response.data.link_token });
  } catch (err) {
    console.error("Plaid create-link-token error:", err);
    return new Response(JSON.stringify({ error: "Could not create link token" }), { status: 500 });
  }
}
