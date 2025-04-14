import * as cdk from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import { join } from "path";
import * as sns from "aws-cdk-lib/aws-sns";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cloudwatch_actions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as sns_subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as ssm_incidents from "aws-cdk-lib/aws-ssmincidents";
import * as iam from "aws-cdk-lib/aws-iam";

export class CdkPlaygroundStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const secret = secretsmanager.Secret.fromSecretNameV2(
      this,
      "ZenDutySecret",
      "cdk-playground-secrets"
    );

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

    snsTopic.addSubscription(
      new sns_subscriptions.UrlSubscription(
        secret.secretValueFromJson("ZENDUTY_WEBHOOK").unsafeUnwrap(),
        {
          protocol: sns.SubscriptionProtocol.HTTPS,
        }
      )
    );

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
        ],
      })
    );
  }
}
