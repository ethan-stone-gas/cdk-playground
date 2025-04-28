import * as cdk from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import { join } from "path";
import * as sns from "aws-cdk-lib/aws-sns";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cloudwatch_actions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";

export class CdkPlaygroundStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a VPC
    const vpc = new ec2.Vpc(this, "RdsVpc", {
      maxAzs: 2,
      natGateways: 0, // No NAT gateways needed for public access
    });

    // Create a security group for the RDS instance
    const dbSecurityGroup = new ec2.SecurityGroup(this, "DbSecurityGroup", {
      vpc,
      description: "Security group for RDS instance",
      allowAllOutbound: true,
    });

    // Allow inbound PostgreSQL access from anywhere
    dbSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(5432),
      "Allow PostgreSQL access from anywhere"
    );

    // Create the RDS instance
    const dbInstance = new rds.DatabaseInstance(this, "DbInstance", {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_17_4,
      }),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      securityGroups: [dbSecurityGroup],
      publiclyAccessible: true,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO
      ),
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      databaseName: "mydb",
      credentials: rds.Credentials.fromGeneratedSecret("postgres"),
    });

    // Output the database endpoint
    new cdk.CfnOutput(this, "DbEndpoint", {
      value: dbInstance.dbInstanceEndpointAddress,
      description: "Database endpoint",
    });

    // Output the database port
    new cdk.CfnOutput(this, "DbPort", {
      value: dbInstance.dbInstanceEndpointPort,
      description: "Database port",
    });

    const snsTopic = new sns.Topic(this, "Error");

    const lambdaFunction1 = new NodejsFunction(this, "Test1", {
      entry: join(__dirname, "../services/functions/src/test.ts"),
      handler: "main",
    });

    const lambdaFunction2 = new NodejsFunction(this, "Test2", {
      entry: join(__dirname, "../services/functions/src/test.ts"),
      handler: "main",
    });

    const errorMetrics = [
      lambdaFunction1.metricErrors(),
      lambdaFunction2.metricErrors(),
    ];

    // Sum the metrics
    let sumExpression = "";
    for (let i = 0; i < errorMetrics.length; i++) {
      sumExpression += `m${i} + `;
    }
    sumExpression = sumExpression.slice(0, -3); // Remove the trailing ' + '    for ()

    const mathExpression = new cloudwatch.MathExpression({
      expression: sumExpression,
      usingMetrics: errorMetrics.reduce(
        (acc: { [string: string]: cloudwatch.Metric }, metric, index) => {
          acc[`m${index}`] = metric;
          return acc;
        },
        {}
      ),
      period: cdk.Duration.minutes(1),
      label: "Total Lambda Errors",
    });

    // Warning Alarm (10-20 errors)
    const warningAlarm = new cloudwatch.Alarm(
      this,
      "TotalLambdaErrCount-Warning",
      {
        metric: mathExpression,
        evaluationPeriods: 1,
        threshold: 10,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        alarmName: "TotalLambdaErrCount-Warning",
        alarmDescription: "Warning: Lambda error count is between 10 and 20",
      }
    );

    // Error Alarm (20-30 errors)
    const errorAlarm = new cloudwatch.Alarm(this, "TotalLambdaErrCount-Error", {
      metric: mathExpression,
      evaluationPeriods: 1,
      threshold: 20,
      comparisonOperator:
        cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmName: "TotalLambdaErrCount-Error",
      alarmDescription: "Error: Lambda error count is between 20 and 30",
    });

    // Critical Alarm (30+ errors)
    const criticalAlarm = new cloudwatch.Alarm(
      this,
      "TotalLambdaErrCount-Critical",
      {
        metric: mathExpression,
        evaluationPeriods: 1,
        threshold: 30,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        alarmName: "TotalLambdaErrCount-Critical",
        alarmDescription: "Critical: Lambda error count is 30 or more",
      }
    );

    // Add actions for all alarms
    [warningAlarm, errorAlarm, criticalAlarm].forEach((alarm) => {
      alarm.addAlarmAction(
        new cloudwatch_actions.SsmIncidentAction("ResponsePlan1")
      );
      alarm.addAlarmAction(new cloudwatch_actions.SnsAction(snsTopic));
      alarm.addOkAction(new cloudwatch_actions.SnsAction(snsTopic));
    });

    // snsTopic.addSubscription(
    //   new sns_subscriptions.UrlSubscription(
    //     secret.secretValueFromJson("ZENDUTY_WEBHOOK").unsafeUnwrap(),
    //     {
    //       protocol: sns.SubscriptionProtocol.HTTPS,
    //     }
    //   )
    // );

    //  Grant IncidentManagerIncidentAccessServiceRole permission to start automation executions
    const incidentManagerRole = iam.Role.fromRoleName(
      this,
      "IncidentManagerRole",
      "IncidentManagerIncidentAccessServiceRole"
    );

    incidentManagerRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ["ssm:StartAutomationExecution"],
        resources: [
          "arn:aws:ssm:us-east-1::document/AWSIncidents-CriticalIncidentRunbookTemplate",
          "arn:aws:ssm:us-east-1:914165346309:automation-execution/*",
          "arn:aws:ssm:us-east-1:*:automation-definition/AWSIncidents-CriticalIncidentRunbookTemplate:$LATEST",
        ],
      })
    );

    const syncIncidentsCron = new NodejsFunction(
      this,
      "SyncIncidentManagerCron",
      {
        entry: join(
          __dirname,
          "../services/functions/src/sync-incident-manager-cron.ts"
        ),
        handler: "main",
        runtime: lambda.Runtime.NODEJS_22_X,
        environment: {
          DB_SECRET_ARN: dbInstance.secret?.secretArn!,
        },
        timeout: cdk.Duration.minutes(5),
        memorySize: 512,
      }
    );

    // add read-only permissions to call ssm incident manager API
    // and read-only permissions to call ssm contacts API
    syncIncidentsCron.role?.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: [
          "ssm-incidents:ListIncidentRecords",
          "ssm-incidents:GetIncidentRecord",
          "ssm-incidents:ListTimelineEvents",
          "ssm-incidents:GetTimelineEvent",
          "ssm-incidents:ListTagsForResource",
          "ssm-contacts:ListContacts",
          "ssm-contacts:GetContact",
          "ssm-contacts:ListTagsForResource",
        ],
        resources: [
          "*",
          `arn:aws:ssm-incidents::${this.account}:incident-record/ResponsePlan1/*`, // for some reason * isn't good enough for ssm-incidents:ListTagsForResource so we need to specify a more precise arn matcher.
        ],
      })
    );

    const hourlyRule = new events.Rule(this, "HourlyRule", {
      schedule: events.Schedule.rate(cdk.Duration.hours(1)),
    });

    hourlyRule.addTarget(new targets.LambdaFunction(syncIncidentsCron));

    dbInstance.secret?.grantRead(syncIncidentsCron);
  }
}
