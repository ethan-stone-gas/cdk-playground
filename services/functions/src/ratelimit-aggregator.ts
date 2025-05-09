import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { KinesisStreamEvent, KinesisStreamRecord } from "aws-lambda";

// --- Configuration ---
const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME; // Your DynamoDB table name

// --- DynamoDB Client ---
const dynamodbClient = new DynamoDBClient({});

// --- Lambda Handler ---
export const main = async (event: KinesisStreamEvent): Promise<void> => {
  console.log("Received Kinesis stream event:", JSON.stringify(event, null, 2));

  // Map to store aggregated request counts for the current batch, keyed by apiKeyId::windowIdentifier
  const aggregatedRequestsByWindow = new Map<string, number>();

  // Process each record in the Kinesis event batch
  for (const record of event.Records) {
    try {
      // Kinesis data is base64 encoded
      const payload = Buffer.from(record.kinesis.data, "base64").toString();
      const batchData = JSON.parse(payload);

      console.log("Processing Kinesis record payload:", batchData);

      // Assuming the payload structure is { timestamp: number, requests: [{ apiKeyId: string, windowIdentifier: string, count: number }] }
      if (batchData && Array.isArray(batchData.requests)) {
        for (const request of batchData.requests) {
          if (
            request.apiKeyId &&
            request.windowIdentifier &&
            typeof request.count === "number"
          ) {
            const key = `${request.apiKeyId}::${request.windowIdentifier}`;
            // Aggregate request counts for each apiKeyId::windowIdentifier
            aggregatedRequestsByWindow.set(
              key,
              (aggregatedRequestsByWindow.get(key) || 0) + request.count
            );
          } else {
            console.warn("Invalid request data in batch:", request);
          }
        }
      } else {
        console.warn(
          "Invalid batch data structure in Kinesis record:",
          batchData
        );
      }
    } catch (error) {
      console.error(
        "Error processing Kinesis record:",
        record.kinesis.sequenceNumber,
        error
      );
      // Depending on your error handling strategy, you might throw the error
      // to trigger a retry of the batch or use a dead-letter queue.
      // For this example, we'll log and continue processing other records.
    }
  }

  console.log(
    "Aggregated requests for this batch (by window):",
    Object.fromEntries(aggregatedRequestsByWindow)
  );

  // Update DynamoDB with aggregated counts
  const updatePromises: Promise<any>[] = [];

  for (const [key, totalRequests] of aggregatedRequestsByWindow.entries()) {
    const [apiKeyId, windowIdentifier] = key.split("::");

    if (apiKeyId && windowIdentifier) {
      // Use UpdateItem with ADD to atomically increment the requestCount
      const updateCommand = new UpdateItemCommand({
        TableName: DYNAMODB_TABLE_NAME,
        Key: marshall({ apiKeyId, windowIdentifier }),
        UpdateExpression: "SET #rc = if_not_exists(#rc, :start) + :increment",
        ExpressionAttributeNames: {
          "#rc": "requestCount",
        },
        ExpressionAttributeValues: marshall({
          ":increment": totalRequests,
          ":start": 0, // Initialize requestCount to 0 if it doesn't exist
        }),
        ReturnValues: "NONE", // No need to return values for this operation
      });

      updatePromises.push(dynamodbClient.send(updateCommand));
    } else {
      console.warn(`Invalid key format in aggregatedRequestsByWindow: ${key}`);
    }
  }

  // Wait for all DynamoDB updates to complete for this batch
  try {
    await Promise.all(updatePromises);
    console.log(
      `Successfully updated DynamoDB for ${updatePromises.length} API key/window combinations.`
    );
  } catch (dbError) {
    console.error("Error updating DynamoDB with aggregated requests:", dbError);
    // Handle errors. Throwing the error here might trigger a retry of the Kinesis batch.
    throw dbError;
  }
};
