import { Context } from "hono";
import { HonoEnv } from "src/api/honoEnv";
import { getUserByCognitoId } from "./db";
import { HTTPException } from "src/api/errors";

export async function checkAuth(c: Context<HonoEnv>) {
  const userId = c.env.event.requestContext.authorizer.claims.sub;

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
