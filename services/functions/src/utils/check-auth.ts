import { Context } from "hono";
import { HonoEnv } from "src/api/honoEnv";
import { getUserByCognitoId } from "./db";
import { HTTPException } from "src/api/errors";
import { JwksClient } from "jwks-rsa";
import { Algorithm, decode, verify } from "jsonwebtoken";

const REGION = process.env.AWS_REGION || "us-east-1"; // Get from env or config
const USER_POOL_ID =
  process.env.COGNITO_USER_POOL_ID || "us-east-1_YOUR_USER_POOL_ID"; // Get from env or config

// JWKS URL for your Cognito User Pool
const jwksUri = `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`;

const client = new JwksClient({
  jwksUri: jwksUri,
  cache: true, // Cache the keys to avoid repeated HTTP requests
  rateLimit: true,
  jwksRequestsPerMinute: 10, // Max 10 requests per minute
});

interface DecodedToken {
  header: {
    kid: string;
    alg: string;
  };
  payload: {
    iss: string; // Issuer
    aud: string; // Audience (usually client ID)
    exp: number; // Expiration time
    iat: number; // Issued at time
    auth_time: number; // Authentication time
    jti: string; // JWT ID
    token_use: "access" | "id"; // Token type
    scope?: string; // Scopes granted
    sub: string; // Subject (user's unique ID)
    client_id: string; // Client ID
    username: string; // Cognito username
    email?: string; // User's email
    // ... any other custom claims like 'custom:aad_tenant_id'
    [key: string]: any; // Allow arbitrary claims
  };
  signature: string;
}

export async function checkAuth(c: Context<HonoEnv>) {
  const token = c.req.header("Authorization");

  if (!token) {
    throw new HTTPException({
      message: "Unauthorized",
      reason: "UNAUTHORIZED",
    });
  }

  const decodedToken = decode(token, { complete: true }) as DecodedToken;

  if (!decodedToken) {
    throw new HTTPException({
      message: "Unauthorized",
      reason: "UNAUTHORIZED",
    });
  }

  const signingKey = await client.getSigningKey(decodedToken.header.kid);

  const publicKey = signingKey.getPublicKey();

  const verified = verify(token, publicKey, {
    algorithms: [decodedToken.header.alg as Algorithm],
  });

  const { sub: userId } = decodedToken.payload;

  if (!userId) {
    throw new HTTPException({
      message: "Unauthorized",
      reason: "UNAUTHORIZED",
    });
  }

  const user = await getUserByCognitoId(userId);

  if (!user) {
    throw new HTTPException({
      message: "Unauthorized",
      reason: "UNAUTHORIZED",
    });
  }

  return user;
}
