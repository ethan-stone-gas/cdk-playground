import { Stripe } from "stripe";
import { randomUUID } from "crypto";
import { retrieveSecret } from "./retrieve-secret";

// 1. For each session, create a tax calculation and an invoice item.
// 2. Create an invoice.
// 3. When invoice is paid, then create the tax transaction.

type Event = {
  shouldCreateInvoice?: boolean;
};

export async function main(event: Event) {
  console.log("Starting tax calculation process...");
  const secret = await retrieveSecret(process.env.SECRET_ARN!, [
    "STRIPE_API_KEY",
  ]);
  console.log("Successfully retrieved Stripe API key");

  const stripe = new Stripe(secret.STRIPE_API_KEY);

  const customer = await stripe.customers.create({
    name: getRandomName(),
    address: {
      city: "Schenectady",
      country: "US",
      line1: "2345 Maxon Rd. Ext.",
      postal_code: "12309",
    },
  });
  console.log(`Created customer with ID: ${customer.id}`);

  const pm = await stripe.paymentMethods.attach("pm_card_visa", {
    customer: customer.id,
  });
  console.log(`Attached payment method with ID: ${pm.id}`);

  await stripe.customers.update(customer.id, {
    invoice_settings: {
      default_payment_method: pm.id,
    },
  });
  console.log(`Set default payment method for customer ${customer.id}`);

  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [
      {
        price: "price_1REWQPQvisdaxt9GjVkPjn7R",
      },
    ],
    automatic_tax: {
      enabled: false,
    },
  });
  console.log(`Created subscription with ID: ${subscription.id}`);

  const sessionTotalMin = 100;
  const sessionTotalMax = 1000;

  for (let i = 0; i < 5; i++) {
    const sessionId = randomUUID().slice(0, 8) + "_" + leftPad(i.toString(), 2);
    console.log(`Processing session ${sessionId}`);

    const sessionTotal = getRandomInt(sessionTotalMin, sessionTotalMax);
    console.log(`Session total: $${sessionTotal}`);

    const taxCalculation = await stripe.tax.calculations.create({
      currency: "usd",
      line_items: [
        {
          amount: sessionTotal,
          reference: sessionId,
        },
      ],
      customer_details: {
        address: {
          city: "Schenectady",
          country: "US",
          line1: "2345 Maxon Rd. Ext.",
          postal_code: "12309",
        },
        address_source: "shipping",
      },
    });
    console.log(`Created tax calculation with ID: ${taxCalculation.id}`);

    const invoiceItem = await stripe.invoiceItems.create({
      customer: customer.id,
      subscription: subscription.id,
      amount: sessionTotal,
      currency: "usd",
      description: `Test invoice item for session ${sessionId}`,
      metadata: {
        tax_calculation_id: taxCalculation.id,
        has_collected_tax: "false",
        session_id: sessionId,
      },
    });
    console.log(
      `Created invoice item with ID: ${invoiceItem.id} for session ${sessionId}`
    );
  }

  if (event.shouldCreateInvoice) {
    const invoice = await stripe.invoices.create({
      customer: customer.id,
      subscription: subscription.id,
      auto_advance: true,
      automatic_tax: {
        enabled: false,
      },
    });
    console.log(`Created invoice with ID: ${invoice.id}`);
  }

  console.log("Tax calculation process completed successfully");
}

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function leftPad(str: string, length: number) {
  return str.padStart(length, "0");
}

const colors = ["red", "blue", "green", "yellow", "purple", "orange"];
const animals = ["dog", "cat", "bird", "fish", "snake", "lizard"];

function getRandomName() {
  return `${colors[getRandomInt(0, colors.length - 1)]} ${
    animals[getRandomInt(0, animals.length - 1)]
  }`;
}
