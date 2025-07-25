import { KinesisStreamRecord } from "aws-lambda";

type Message = {
  sequenceNumber: string;
  value: string;
  timestamp: Date;
};

type Batch = {
  firstOffset: string;
  lastOffset: string;
  messages: Message[];
  shard: number;
  streamARN: string;
};

type KinesisStreamHandlerConfig = {
  eachBatch: (args: { batch: Batch }) => Promise<void>;
};

export function createKinesisStreamHandler(
  config: KinesisStreamHandlerConfig
): AWSLambda.KinesisStreamHandler {
  return async (event) => {
    const recordsByEventSourceAndShard = event.Records.reduce((acc, record) => {
      const eventSource = record.eventSourceARN;
      // Example eventID: shardId-000000000003:1234567890
      const shardId = record.eventID.split(":")[0];

      const shard = Number(shardId.split("-")[1]);

      const key = `${eventSource}+${shard}`;

      if (!acc[key]) {
        acc[key] = [];
      }

      acc[key].push(record);
      return acc;
    }, {} as Record<string, KinesisStreamRecord[]>);

    for (const [streamAndShard, records] of Object.entries(
      recordsByEventSourceAndShard
    )) {
      await config.eachBatch({
        batch: {
          firstOffset: records[0].kinesis.sequenceNumber,
          lastOffset: records[records.length - 1].kinesis.sequenceNumber,
          messages: records.map((record) => ({
            sequenceNumber: record.kinesis.sequenceNumber,
            value: record.kinesis.data,
            timestamp: new Date(record.kinesis.approximateArrivalTimestamp),
          })),
          shard: Number(streamAndShard.split("+")[1]),
          streamARN: streamAndShard.split("+")[0],
        },
      });
    }
  };
}
