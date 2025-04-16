import { Stripe } from "stripe";
import { retrieveSecret } from "./retrieve-secret";

export const main = async () => {
  const secret = await retrieveSecret(process.env.SECRET_ARN!, [
    "STRIPE_API_KEY",
  ]);

  const stripe = new Stripe(secret.STRIPE_API_KEY);

  const taxRate = await stripe.taxRates.create({
    display_name: "NY Sales Tax",
    inclusive: false,
    country: "US",
    jurisdiction: "US - NY",
    description: "NY Sales Tax",
    percentage: 8.875,
  });

  console.log(JSON.stringify(taxRate, null, 2));
};
