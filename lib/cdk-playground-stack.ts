import * as cdk from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import { join } from "path";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";

export class CdkPlaygroundStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    const secret = Secret.fromSecretNameV2(
      this,
      "StripeSecret",
      "stripe-tax-research"
    );

    const queue = new Queue(this, "Queue", {
      fifo: true,
      visibilityTimeout: cdk.Duration.seconds(60),
    });

    const calculateTax = new NodejsFunction(this, "CalculateTax", {
      entry: join(__dirname, "../services/functions/src/calculate-tax.ts"),
      runtime: cdk.aws_lambda.Runtime.NODEJS_20_X,
      environment: {
        SECRET_ARN: secret.secretName,
      },
      timeout: cdk.Duration.seconds(30),
      handler: "main",
    });

    secret.grantRead(calculateTax);

    const webhook = new NodejsFunction(this, "Webhook", {
      entry: join(__dirname, "../services/functions/src/webhook.ts"),
      runtime: cdk.aws_lambda.Runtime.NODEJS_20_X,
      environment: {
        SECRET_ARN: secret.secretName,
        SQS_QUEUE_URL: queue.queueUrl,
      },
      timeout: cdk.Duration.seconds(10),
      handler: "main",
    });

    webhook.addFunctionUrl({
      authType: cdk.aws_lambda.FunctionUrlAuthType.NONE,
    });

    queue.grantSendMessages(webhook);
    secret.grantRead(webhook);

    const queueHandler = new NodejsFunction(this, "QueueHandler", {
      entry: join(__dirname, "../services/functions/src/queue-handler.ts"),
      runtime: cdk.aws_lambda.Runtime.NODEJS_20_X,
      environment: {
        SECRET_ARN: secret.secretName,
      },
      timeout: cdk.Duration.seconds(30),
      handler: "main",
    });

    queueHandler.addEventSource(new SqsEventSource(queue));

    queue.grantConsumeMessages(queueHandler);
    secret.grantRead(queueHandler);

    const stripeHelper = new NodejsFunction(this, "StripeHelper", {
      entry: join(__dirname, "../services/functions/src/stripe-helper.ts"),
      runtime: cdk.aws_lambda.Runtime.NODEJS_20_X,
      environment: {
        SECRET_ARN: secret.secretName,
      },
      handler: "main",
      timeout: cdk.Duration.seconds(30),
    });

    secret.grantRead(stripeHelper);
  }
}
