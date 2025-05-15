import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda_node from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as kinesis from "aws-cdk-lib/aws-kinesis";
import * as lambda_event_sources from "aws-cdk-lib/aws-lambda-event-sources";
import * as apigateway from "aws-cdk-lib/aws-apigateway";

export class CdkPlaygroundStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    const table = new dynamodb.Table(this, "RateLimitTable", {
      partitionKey: {
        name: "entityId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "windowIdentifier",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    const stream = new kinesis.Stream(this, "RateLimitStream", {});

    new lambda.LayerVersion(this, "RateLimitExtension", {
      code: lambda.Code.fromAsset("services/extension/dist"),
      compatibleRuntimes: [lambda.Runtime.NODEJS_22_X],
    });

    const apiFn = new lambda_node.NodejsFunction(this, "RateLimitFunction", {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "main",
      entry: "services/functions/src/api.ts",
      timeout: cdk.Duration.seconds(30),
      environment: {
        DYNAMODB_TABLE_NAME: table.tableName,
        KINESIS_STREAM_NAME: stream.streamName,
        LAMBDA_EXTENSION_PATH: "index.js",
      },
    });

    table.grantReadWriteData(apiFn);
    stream.grantWrite(apiFn);

    const restApi = new apigateway.LambdaRestApi(this, "RateLimitApi", {
      handler: apiFn,
      proxy: true,
      deployOptions: {
        stageName: "v1",
        throttlingBurstLimit: 100,
        throttlingRateLimit: 500,
      },
      deploy: true,
    });

    const aggregator = new lambda_node.NodejsFunction(
      this,
      "RateLimitAggregator",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: "main",
        entry: "services/functions/src/ratelimit-aggregator.ts",
        timeout: cdk.Duration.seconds(30),
        environment: {
          DYNAMODB_TABLE_NAME: table.tableName,
          KINESIS_STREAM_NAME: stream.streamName,
        },
      }
    );

    aggregator.addEventSource(
      new lambda_event_sources.KinesisEventSource(stream, {
        batchSize: 100,
        maxBatchingWindow: cdk.Duration.seconds(10),
        startingPosition: lambda.StartingPosition.TRIM_HORIZON,
      })
    );

    table.grantReadWriteData(aggregator);
    stream.grantWrite(aggregator);

    new cdk.CfnOutput(this, "ApiUrl", {
      value: restApi.url,
    });
  }
}
