import { APIGatewayProxyWithCognitoAuthorizerEvent } from "aws-lambda";
import { LambdaContext } from "hono/aws-lambda";

export type HonoEnv = {
  Bindings: {
    event: APIGatewayProxyWithCognitoAuthorizerEvent;
    lambdaContext: LambdaContext;
  };
};
