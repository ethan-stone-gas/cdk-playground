import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as kinesis from "aws-cdk-lib/aws-kinesis";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as path from "path";

export class CdkPlaygroundStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const kinesisStream = new kinesis.Stream(this, "SampleValueStream", {
      streamMode: kinesis.StreamMode.PROVISIONED,
      shardCount: 12,
    });

    const producerFunction = new lambdaNodejs.NodejsFunction(
      this,
      "ProducerFunction",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: "main",
        entry: path.join(__dirname, "../services/functions/src/producer.ts"),
        environment: {
          SAMPLE_VALUE_STREAM_ARN: kinesisStream.streamArn,
        },
        timeout: cdk.Duration.minutes(15),
      }
    );

    kinesisStream.grantWrite(producerFunction);

    for (let i = 0; i < 20; i++) {
      const consumerFunction = new lambdaNodejs.NodejsFunction(
        this,
        `ConsumerFunction-${i}`,
        {
          runtime: lambda.Runtime.NODEJS_22_X,
          handler: "main",
          entry: path.join(__dirname, "../services/functions/src/consumer.ts"),
          timeout: cdk.Duration.seconds(30),
        }
      );

      consumerFunction.addEventSource(
        new lambdaEventSources.KinesisEventSource(kinesisStream, {
          batchSize: 100,
          startingPosition: lambda.StartingPosition.TRIM_HORIZON,
        })
      );
    }
  }
}
