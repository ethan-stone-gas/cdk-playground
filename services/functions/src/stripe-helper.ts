import { Stripe } from "stripe";
import { retrieveSecret } from "./retrieve-secret";

export const main = async () => {
  const secret = await retrieveSecret(process.env.SECRET_ARN!, [
    "STRIPE_API_KEY",
  ]);

  const stripe = new Stripe(secret.STRIPE_API_KEY);

  const taxRate = await stripe.taxRates.create({
    display_name: "NY EV Charging Tax",
    inclusive: false,
    country: "US",
    jurisdiction: "US - NY",
    description: "NY EV Charging Tax",
    percentage: 5,
  });

  console.log(JSON.stringify(taxRate, null, 2));
};
