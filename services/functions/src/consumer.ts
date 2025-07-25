import { createKinesisStreamHandler } from "./stream-handlers";

export const main = createKinesisStreamHandler({
  eachBatch: async ({ batch }) => {
    console.log(`received batch of ${batch.messages.length} messages`);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log(`processed batch of ${batch.messages.length} messages`);
  },
});
