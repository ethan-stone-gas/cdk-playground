import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

const smClient = new SecretsManagerClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

type Secret = {
  value: Record<string, unknown>;
};

// arn -> secret
const cachedSecrets = new Map<string, Secret>();

/**
 * Retrieve a secretValue from secret manager and convert it to an object.
 *
 * This function will return the cached secret if it is called with the same ARN multiple times.
 *
 * @param secretARN The arn of the secretvalue in secret manager
 * @param secretKeys The keys expected to be in the secret. If this is supplied and the secret
 * does not contain all of these keys, this function will throw an error.
 */
export const retrieveSecret = async <
  T extends Record<string, string>,
  K extends keyof T = keyof T
>(
  secretARN: string,
  secretKeys?: K[]
): Promise<Record<K, string>> => {
  const cachedSecret = cachedSecrets.get(secretARN);

  if (cachedSecret) return cachedSecret.value as T;

  const { SecretString } = await smClient.send(
    new GetSecretValueCommand({
      SecretId: secretARN,
    })
  );

  if (!SecretString)
    throw Error(`SecretString was not found with ARN: ${secretARN}`);

  const secret = JSON.parse(SecretString);

  if (
    secretKeys !== undefined &&
    !secretKeys.every((key) => secret.hasOwnProperty(key))
  )
    throw Error(
      `Secret did not contain all expected key-value pairs: got ${Object.keys(
        secret
      )}, expected ${secretKeys}`
    );

  cachedSecrets.set(secretARN, {
    value: secret,
  });

  return secret;
};
