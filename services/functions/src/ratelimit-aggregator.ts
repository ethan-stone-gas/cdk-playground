import { KinesisStreamEvent } from "aws-lambda";
import { incrementRequestCountForWindow } from "./db";
import { RequestMessageSchema } from "./message-schemas";

// --- Lambda Handler ---
export const main = async (event: KinesisStreamEvent): Promise<void> => {
  console.log("Received Kinesis stream event:", JSON.stringify(event, null, 2));

  // Map to store aggregated request counts for the current batch, keyed by entityId::windowIdentifier
  const aggregatedRequestsByWindow = new Map<string, number>();

  // Process each record in the Kinesis event batch
  for (const record of event.Records) {
    try {
      // Kinesis data is base64 encoded
      const payload = Buffer.from(record.kinesis.data, "base64").toString();
      const batchData = JSON.parse(payload);

      const parsedData = RequestMessageSchema.parse(batchData);

      console.log("Processing Kinesis record payload:", parsedData);

      const key = `${parsedData.entityId}::${parsedData.windowIdentifier}`;

      aggregatedRequestsByWindow.set(
        key,
        (aggregatedRequestsByWindow.get(key) || 0) + parsedData.count
      );
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
    const [entityId, windowIdentifier] = key.split("::");

    if (entityId && windowIdentifier) {
      updatePromises.push(
        incrementRequestCountForWindow(
          entityId,
          windowIdentifier,
          totalRequests
        )
      );
    } else {
      console.warn(`Invalid key format in aggregatedRequestsByWindow: ${key}`);
    }
  }

  // Wait for all DynamoDB updates to complete for this batch
  try {
    await Promise.all(updatePromises);
    console.log(
      `Successfully updated DynamoDB for ${updatePromises.length} entityId/windowIdentifier combinations.`
    );
  } catch (dbError) {
    console.error("Error updating DynamoDB with aggregated requests:", dbError);
    // Handle errors. Throwing the error here might trigger a retry of the Kinesis batch.
    throw dbError;
  }
};
