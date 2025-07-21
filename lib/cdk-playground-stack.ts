import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecs_patterns from "aws-cdk-lib/aws-ecs-patterns";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as ecrAssets from "aws-cdk-lib/aws-ecr-assets";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import path = require("path");

export class CdkPlaygroundStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const secret = secretsmanager.Secret.fromSecretNameV2(
      this,
      "Secret",
      "cdk-playground-secrets"
    );

    const bedrockUser = new iam.User(this, "BedrockAPIUser", {
      userName: "BedrockAPICallUser", // A friendly name for the IAM user
    });

    // 2. Define the policy statement for Bedrock API access
    const bedrockPolicyStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "bedrock:InvokeModel",
        "bedrock:ListFoundationModels",
        "bedrock-runtime:InvokeModel",
        "bedrock-runtime:InvokeModelWithResponseStream",
        // Add more specific Bedrock actions as needed based on your application's requirements.
        // For full Bedrock API access (including administrative actions), you can use "bedrock:*", "bedrock-runtime:*".
        // However, it's always best practice to grant least privilege.
      ],
      resources: ["*"], // Apply to all Bedrock resources. Consider narrowing this down if possible.
    });

    // 3. Attach the policy statement to the IAM User
    // You can attach directly via addToPolicy, or create a managed policy and attach it.
    bedrockUser.addToPolicy(bedrockPolicyStatement);

    secret.grantRead(bedrockUser);

    // Optional: Output the IAM User's ARN for reference
    new cdk.CfnOutput(this, "BedrockUserArn", {
      value: bedrockUser.userArn,
      description: "ARN of the IAM User created for Bedrock API access.",
    });

    new cdk.CfnOutput(this, "BedrockUserName", {
      value: bedrockUser.userName,
      description: "Name of the IAM User created for Bedrock API access.",
    });

    // // Create VPC for the ECS cluster
    // const vpc = new ec2.Vpc(this, "VPC", {
    //   maxAzs: 2,
    //   natGateways: 1,
    //   subnetConfiguration: [
    //     {
    //       cidrMask: 24,
    //       name: "public",
    //       subnetType: ec2.SubnetType.PUBLIC,
    //     },
    //     {
    //       cidrMask: 24,
    //       name: "private",
    //       subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    //     },
    //   ],
    // });

    // // Create ECS Cluster
    // const cluster = new ecs.Cluster(this, "Cluster", {
    //   vpc,
    //   containerInsights: true,
    // });

    // const alb = new elbv2.ApplicationLoadBalancer(this, "LoadBalancer", {
    //   vpc,
    //   internetFacing: true,
    // });

    // const taskDefinition = new ecs.FargateTaskDefinition(
    //   this,
    //   "TaskDefinition",
    //   {
    //     memoryLimitMiB: 512,
    //     cpu: 256,
    //     runtimePlatform: {
    //       cpuArchitecture: ecs.CpuArchitecture.X86_64,
    //       operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
    //     },
    //   }
    // );

    // taskDefinition
    //   .addContainer("Container", {
    //     image: ecs.ContainerImage.fromAsset(
    //       path.join(__dirname, "../services/server"),
    //       {
    //         platform: ecrAssets.Platform.LINUX_AMD64,
    //       }
    //     ),
    //     environment: {
    //       SECRET_ARN: secret.secretArn,
    //     },
    //     logging: ecs.LogDriver.awsLogs({
    //       streamPrefix: "nova-server",
    //     }),
    //   })
    //   .addPortMappings({
    //     containerPort: 3000,
    //     hostPort: 3000,
    //   });

    // secret.grantRead(taskDefinition.taskRole);

    // taskDefinition.taskRole.attachInlinePolicy(
    //   new cdk.aws_iam.Policy(this, "Policy", {
    //     statements: [
    //       new cdk.aws_iam.PolicyStatement({
    //         effect: cdk.aws_iam.Effect.ALLOW,
    //         actions: ["bedrock:*"],
    //         resources: ["*"],
    //       }),
    //     ],
    //   })
    // );

    // // Create ECS Fargate Service with Application Load Balancer
    // const fargateService =
    //   new ecs_patterns.ApplicationLoadBalancedFargateService(
    //     this,
    //     "FastifyService",
    //     {
    //       certificate: acm.Certificate.fromCertificateArn(
    //         this,
    //         "Certificate",
    //         "arn:aws:acm:us-east-1:914165346309:certificate/1501fdd3-58ba-4d4b-ae6e-02eee3ff60e3"
    //       ),
    //       cluster,
    //       cpu: 256,
    //       desiredCount: 1,
    //       taskDefinition,
    //       memoryLimitMiB: 512,
    //       publicLoadBalancer: true,
    //       loadBalancer: alb,
    //     }
    //   );

    // // Add auto scaling
    // const scaling = fargateService.service.autoScaleTaskCount({
    //   maxCapacity: 2,
    //   minCapacity: 1,
    // });

    // scaling.scaleOnCpuUtilization("CpuScaling", {
    //   targetUtilizationPercent: 70,
    //   scaleInCooldown: cdk.Duration.seconds(60),
    //   scaleOutCooldown: cdk.Duration.seconds(60),
    // });

    // scaling.scaleOnMemoryUtilization("MemoryScaling", {
    //   targetUtilizationPercent: 70,
    //   scaleInCooldown: cdk.Duration.seconds(60),
    //   scaleOutCooldown: cdk.Duration.seconds(60),
    // });

    // // Add health check grace period
    // fargateService.targetGroup.configureHealthCheck({
    //   path: "/health",
    //   port: "3000",
    //   healthyHttpCodes: "200",
    //   interval: cdk.Duration.seconds(10),
    //   timeout: cdk.Duration.seconds(5),
    //   healthyThresholdCount: 2,
    //   unhealthyThresholdCount: 3,
    // });

    // // Output the load balancer URL
    // new cdk.CfnOutput(this, "LoadBalancerDNS", {
    //   value: fargateService.loadBalancer.loadBalancerDnsName,
    //   description: "Load Balancer DNS Name",
    //   exportName: "FastifyLoadBalancerDNS",
    // });

    // // Output the cluster name
    // new cdk.CfnOutput(this, "ClusterName", {
    //   value: cluster.clusterName,
    //   description: "ECS Cluster Name",
    //   exportName: "FastifyClusterName",
    // });
  }
}
