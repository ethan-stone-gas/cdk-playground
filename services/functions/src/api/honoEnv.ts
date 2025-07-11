import { LambdaContext, LambdaEvent } from "hono/aws-lambda";

export type HonoEnv = {
  Bindings: {
    event: LambdaEvent;
    lambdaContext: LambdaContext;
  };
};
