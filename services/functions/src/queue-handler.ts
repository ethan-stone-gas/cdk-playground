import { SQSHandler } from "aws-lambda";
import { retrieveSecret } from "./retrieve-secret";
import Stripe from "stripe";

type Metadata = {
  tax_calculation_id: string;
  has_collected_tax: "true" | "false";
  session_id?: string;
};

export const main: SQSHandler = async (event) => {
  console.log(`Received ${event.Records.length} SQS records to process`);

  const secret = await retrieveSecret(process.env.SECRET_ARN!, [
    "STRIPE_API_KEY",
  ]);
  console.log("Successfully retrieved Stripe API key");

  const stripe = new Stripe(secret.STRIPE_API_KEY);

  for (const record of event.Records) {
    console.log(`Processing record with message ID: ${record.messageId}`);
    const evt = JSON.parse(record.body) as Stripe.Event;
    console.log(`Processing Stripe event type: ${evt.type}`);

    if (evt.type === "invoice.created" || evt.type === "invoice.paid") {
      const invoiceEventData = evt.data.object as Stripe.Invoice;
      console.log(`Processing invoice with ID: ${invoiceEventData.id}`);

      const invoice = await stripe.invoices.retrieve(invoiceEventData.id!);
      console.log(`Retrieved invoice with status: ${invoice.status}`);

      for (const lineItem of invoice.lines.data) {
        console.log(`Processing line item with ID: ${lineItem.id}`);
        const parent = lineItem.parent;

        if (parent?.subscription_item_details?.subscription_item) {
          const subscriptionItemId =
            parent.subscription_item_details.subscription_item;
          console.log(`Found subscription item with ID: ${subscriptionItemId}`);

          const subscriptionItem = await stripe.subscriptionItems.retrieve(
            subscriptionItemId
          );
          console.log(
            `Retrieved subscription item with price ID: ${subscriptionItem.price.id}`
          );

          const metadata = subscriptionItem.metadata as Metadata;

          if (!metadata.tax_calculation_id) {
            console.log(
              `No tax calculation found for subscription item ${subscriptionItem.id}, creating one`
            );
            const taxCalculation = await stripe.tax.calculations.create({
              currency: "usd",
              customer: invoice.customer as string,
              line_items: [
                {
                  amount: subscriptionItem.price.unit_amount as number,
                  reference: subscriptionItem.id + "_" + invoice.id,
                },
              ],
            });
            console.log(
              `Created tax calculation with ID: ${taxCalculation.id}`
            );

            await stripe.subscriptionItems.update(subscriptionItem.id, {
              metadata: {
                tax_calculation_id: taxCalculation.id,
                has_collected_tax: "false",
              },
            });
            console.log(
              `Updated subscription item metadata with tax calculation ID`
            );
          } else {
            console.log(
              `Subscription item ${subscriptionItem.id} already has tax calculation ID: ${metadata.tax_calculation_id}`
            );
          }
        }
      }

      if (invoice.status === "paid") {
        console.log(`Processing paid invoice ${invoice.id}`);
        for (const lineItem of invoice.lines.data) {
          console.log(`Processing paid line item with ID: ${lineItem.id}`);
          const parent = lineItem.parent;

          if (parent?.invoice_item_details?.invoice_item) {
            const invoiceItemId = parent.invoice_item_details.invoice_item;
            console.log(`Found invoice item with ID: ${invoiceItemId}`);

            const invoiceItem = await stripe.invoiceItems.retrieve(
              invoiceItemId
            );
            console.log(
              `Retrieved invoice item with amount: ${invoiceItem.amount}`
            );

            const metadata = invoiceItem.metadata as Metadata;
            console.log(
              `Creating tax transaction from calculation ID: ${metadata.tax_calculation_id}`
            );

            if (metadata.has_collected_tax === "true") {
              console.log(
                `Invoice item ${invoiceItem.id} already has tax collected`
              );
            } else {
              await stripe.tax.transactions.createFromCalculation({
                calculation: metadata.tax_calculation_id,
                reference: metadata.session_id as string,
              });
              console.log(
                `Created tax transaction for invoice item ${invoiceItem.id}`
              );

              await stripe.invoiceItems.update(invoiceItem.id, {
                metadata: {
                  has_collected_tax: "true",
                },
              });
              console.log(
                `Updated invoice item metadata with has_collected_tax: true`
              );
            }
          }

          if (parent?.subscription_item_details?.subscription_item) {
            const subscriptionItemId =
              parent.subscription_item_details.subscription_item;
            console.log(
              `Found subscription item with ID: ${subscriptionItemId}`
            );

            const subscriptionItem = await stripe.subscriptionItems.retrieve(
              subscriptionItemId
            );
            console.log(
              `Retrieved subscription item with price ID: ${subscriptionItem.price.id}`
            );

            const metadata = subscriptionItem.metadata as Metadata;
            console.log(
              `Creating tax transaction from calculation ID: ${metadata.tax_calculation_id}`
            );

            if (metadata.has_collected_tax === "true") {
              console.log(
                `Subscription item ${subscriptionItem.id} already has tax collected`
              );
            } else {
              await stripe.tax.transactions.createFromCalculation({
                calculation: metadata.tax_calculation_id,
                reference: subscriptionItem.id + "_" + invoice.id,
              });
              console.log(
                `Created tax transaction for subscription item ${subscriptionItem.id}`
              );

              await stripe.subscriptionItems.update(subscriptionItem.id, {
                metadata: {
                  has_collected_tax: "true",
                },
              });
              console.log(
                `Updated subscription item metadata with has_collected_tax: true`
              );
            }
          }
        }
      }
    } else {
      console.log(`Skipping non-invoice event type: ${evt.type}`);
    }
  }
  console.log("Finished processing all SQS records");
};
