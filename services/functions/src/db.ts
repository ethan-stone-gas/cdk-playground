import { Binary, Db, MongoClient } from "mongodb";

let client: MongoClient | undefined = undefined;

export async function getDb(url: string) {
  if (client) {
    return client;
  }

  client = new MongoClient(url);

  await client.connect();

  return client;
}

type DbContent = {
  text: string;
  embedding: Binary;
  createdAt: Date;
};

type Content = {
  text: string;
  embedding: number[];
  createdAt: Date;
};

export async function insertContent(db: Db, content: Content) {
  const binaryEmbedding = Binary.fromFloat32Array(
    new Float32Array(content.embedding)
  );

  await db.collection<DbContent>("content").insertOne({
    ...content,
    embedding: binaryEmbedding,
  });
}

export async function searchContent(db: Db, queryVector: number[]) {
  const binaryEmbedding = Binary.fromFloat32Array(
    new Float32Array(queryVector)
  );

  const result = db.collection<DbContent>("content").aggregate([
    {
      $vectorSearch: {
        queryVector: binaryEmbedding,
        path: "embedding",
        numCandidates: 100,
        limit: 10,
        index: "vectorSearch",
      },
    },
    {
      $project: {
        embedding: 0,
      },
    },
  ]);

  return result.toArray();
}
