import {
  DynamoDBClient,
  GetItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const dynamodbClient = new DynamoDBClient({});

const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME;

export async function getRequestCountForWindow(
  entityId: string,
  windowIdentifier: string
): Promise<number> {
  try {
    const command = new GetItemCommand({
      TableName: DYNAMODB_TABLE_NAME,
      Key: marshall({ entityId, windowIdentifier }),
      ProjectionExpression: "requestCount", // Only fetch the requestCount attribute
    });
    const { Item } = await dynamodbClient.send(command);
    if (Item && Item.requestCount && Item.requestCount.N) {
      return Number(Item.requestCount.N);
    }
    return 0; // Return 0 if the item or requestCount doesn't exist
  } catch (error) {
    console.error(
      `Error fetching aggregated request count from DynamoDB for ${entityId}::${windowIdentifier}:`,
      error
    );
    // Depending on your strategy, you might return 0 (allow potentially)
    // or throw an error (prevent request on DB failure). Let's return 0
    // to favor availability over strict rate limiting on DB read errors.
    return 0;
  }
}

export async function incrementRequestCountForWindow(
  entityId: string,
  windowIdentifier: string,
  increment: number = 1
) {
  const command = new UpdateItemCommand({
    TableName: DYNAMODB_TABLE_NAME,
    Key: marshall({ entityId, windowIdentifier }),
    UpdateExpression: "SET #rc = if_not_exists(#rc, :start) + :increment",
    ExpressionAttributeNames: {
      "#rc": "requestCount",
    },
    ExpressionAttributeValues: marshall({
      ":increment": increment,
      ":start": 0, // Initialize requestCount to 0 if it doesn't exist
    }),
    ReturnValues: "NONE", // No need to return values for this operation
  });

  await dynamodbClient.send(command);
}
