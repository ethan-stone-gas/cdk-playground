import { KinesisClient, PutRecordsCommand } from "@aws-sdk/client-kinesis";

const kinesisClient = new KinesisClient({});

type Message = {
  data: string;
  partitionKey: string;
};

export async function publishMessages(messages: Message[]) {
  const command = new PutRecordsCommand({
    StreamName: process.env.KINESIS_STREAM_NAME,
    Records: messages.map((message) => ({
      Data: Buffer.from(message.data),
      PartitionKey: message.partitionKey,
    })),
  });

  await kinesisClient.send(command);
}
