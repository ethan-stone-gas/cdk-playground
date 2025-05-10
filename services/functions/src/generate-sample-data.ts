import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";

// Configure the DynamoDB client
const client = new DynamoDBClient({ region: "your-aws-region" }); // Replace with your AWS region
const ddbDocClient = DynamoDBDocumentClient.from(client);

interface Measurement {
  locationId: string;
  timestamp: number; // Using Unix timestamp in milliseconds
  stationId: string;
  measurementType: string;
  unit: string;
  value: number;
}

export const writeSampleMeasurement = async (
  tableName: string,
  measurement: Measurement
) => {
  const params = {
    TableName: tableName,
    Item: measurement,
  };

  try {
    await ddbDocClient.send(new PutCommand(params));
    console.log(
      `Successfully wrote measurement for location ${measurement.locationId} and timestamp ${measurement.timestamp}`
    );
  } catch (err) {
    console.error("Error writing measurement to DynamoDB:", err);
    throw err; // Rethrow the error for handling in the caller
  }
};

// Example Usage (you would call this from another script or function)
/*
const sampleMeasurement: Measurement = {
  locationId: "loc-123",
  timestamp: Date.now(), // Current time in milliseconds
  stationId: uuidv4(), // Generate a unique station ID
  measurementType: "powerActiveImport",
  unit: "kW",
  value: Math.random() * 50, // Random power value
};

// Replace 'your-measurements-table-name' with your actual table name
writeSampleMeasurement('your-measurements-table-name', sampleMeasurement)
  .catch(err => console.error('Failed to write sample data:', err));
*/
