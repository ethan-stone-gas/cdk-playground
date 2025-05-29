import { GoogleGenAI } from "@google/genai";

let apiKey: string | undefined = undefined;

export function setApiKey(key: string) {
  apiKey = key;
}

async function getGenAI() {
  if (!apiKey) {
    throw new Error("API key not set");
  }

  return new GoogleGenAI({
    apiKey,
  });
}

type GetEmbeddingsParams = {
  input: string;
};

type Embedding = number[];

type GetEmbeddingsResponse = {
  embedding: Embedding;
};

export async function getEmbeddings(
  getEmbeddingsParams: GetEmbeddingsParams
): Promise<GetEmbeddingsResponse> {
  const genai = await getGenAI();

  const response = await genai.models.embedContent({
    model: "models/text-embedding-004",
    contents: [getEmbeddingsParams.input],
    config: {
      taskType: "QUESTION_ANSWERING",
      outputDimensionality: 768,
    },
  });

  return {
    embedding: response.embeddings?.[0].values ?? [],
  };
}
