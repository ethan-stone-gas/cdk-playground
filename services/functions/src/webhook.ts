import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { retrieveSecret } from "./retrieve-secret";
import Stripe from "stripe";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

const sqsClient = new SQSClient({});

export const main: APIGatewayProxyHandlerV2 = async (event) => {
  const secret = await retrieveSecret(process.env.SECRET_ARN!, [
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_API_KEY",
  ]);

  const stripe = new Stripe(secret.STRIPE_API_KEY);

  if (!event.body) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "No body" }),
    };
  }

  const signature = event.headers["stripe-signature"];

  if (!signature) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "No signature" }),
    };
  }

  const evt = stripe.webhooks.constructEvent(
    event.body,
    signature,
    secret.STRIPE_WEBHOOK_SECRET
  );

  if (evt.type === "invoice.created" || evt.type === "invoice.paid") {
    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: process.env.SQS_QUEUE_URL!,
        MessageBody: JSON.stringify(evt),
        MessageGroupId: evt.data.object.id,
        MessageDeduplicationId: evt.id,
      })
    );
  }

  return {
    statusCode: 201,
  };
};
