import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda_nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
export class CdkPlaygroundStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    const secret = secretsmanager.Secret.fromSecretNameV2(
      this,
      "Secret",
      "cdk-playground-secrets"
    );

    const fn = new lambda_nodejs.NodejsFunction(this, "Function", {
      entry: "services/functions/src/hono.ts",
      handler: "main",
      runtime: lambda.Runtime.NODEJS_22_X,
      environment: {
        SECRET_ARN: secret.secretArn,
      },
      timeout: cdk.Duration.seconds(60),
    });

    secret.grantRead(fn);

    const fnUrl = fn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
    });

    new cdk.CfnOutput(this, "FunctionUrl", {
      value: fnUrl.url,
    });
  }
}
