import {
  KinesisClient,
  PutRecordsCommand,
  PutRecordsRequestEntry,
} from "@aws-sdk/client-kinesis";
import { randomUUID } from "crypto";

const kinesisClient = new KinesisClient({});

export async function main() {
  let records: PutRecordsRequestEntry[] = [];

  let deviceIds: string[] = [];

  for (let i = 0; i < 100000; i++) {
    deviceIds.push(randomUUID());
  }

  let totalRecords = 0;

  for (let i = 0; i < 1000000; i++) {
    const randomDeviceId =
      deviceIds[Math.floor(Math.random() * deviceIds.length)];

    const sampleValue: SampleValue = {
      deviceId: randomDeviceId,
      unit: "kW",
      value: Math.random() * 100,
      timestamp: Date.now(),
    };

    records.push({
      PartitionKey: randomDeviceId,
      Data: Buffer.from(JSON.stringify(sampleValue)),
    });

    if (records.length === 100) {
      const command = new PutRecordsCommand({
        Records: records,
        StreamARN: process.env.SAMPLE_VALUE_STREAM_ARN!,
      });

      await kinesisClient.send(command);

      totalRecords += records.length;

      console.log(`Sent ${totalRecords} records`);

      records = [];

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}
