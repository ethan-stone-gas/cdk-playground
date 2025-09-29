import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as path from "path";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as apigateway from "aws-cdk-lib/aws-apigateway";

export class CdkPlaygroundStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const secret = secretsmanager.Secret.fromSecretNameV2(
      this,
      "Secret",
      "cdk-playground-secrets"
    );

    const userPool = new cognito.UserPool(this, "UserPool", {
      selfSignUpEnabled: true,
      userVerification: {
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      signInAliases: {
        email: true,
      },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: false,
        otp: true,
      },
    });

    const defineAuthChallengeFunction = new lambdaNodejs.NodejsFunction(
      this,
      "DefineAuthChallengeFunction",
      {
        entry: path.join(
          __dirname,
          "../services/functions/src/cognito-hooks/define-auth-challenge.ts"
        ),
        handler: "main",
      }
    );

    // const createAuthChallengeFunction = new lambdaNodejs.NodejsFunction(
    //   this,
    //   "CreateAuthChallengeFunction",
    //   {
    //     entry: path.join(
    //       __dirname,
    //       "../services/functions/src/cognito-hooks/create-auth-challenge.ts"
    //     ),
    //     handler: "main",
    //   }
    // );

    // const verifyAuthChallengeFunction = new lambdaNodejs.NodejsFunction(
    //   this,
    //   "VerifyAuthChallengeFunction",
    //   {
    //     entry: path.join(
    //       __dirname,
    //       "../services/functions/src/cognito-hooks/verify-auth-challenge.ts"
    //     ),
    //     handler: "main",
    //   }
    // );

    userPool.addTrigger(
      cognito.UserPoolOperation.DEFINE_AUTH_CHALLENGE,
      defineAuthChallengeFunction
    );

    // userPool.addTrigger(
    //   cognito.UserPoolOperation.CREATE_AUTH_CHALLENGE,
    //   createAuthChallengeFunction
    // );

    // userPool.addTrigger(
    //   cognito.UserPoolOperation.VERIFY_AUTH_CHALLENGE_RESPONSE,
    //   verifyAuthChallengeFunction
    // );

    const apiFunction = new lambdaNodejs.NodejsFunction(this, "ApiFunction", {
      entry: path.join(__dirname, "../services/functions/src/api/hono.ts"),
      handler: "main",
      runtime: lambda.Runtime.NODEJS_22_X,
      bundling: {
        minify: true,
        sourceMap: true,
      },
      environment: {
        SECRET_ARN: secret.secretArn,
        COGNITO_USER_POOL_ID: userPool.userPoolId,
      },
      timeout: cdk.Duration.seconds(20),
    });

    userPool.grant(apiFunction, "cognito-idp:*");

    secret.grantRead(apiFunction);

    const restApi = new apigateway.LambdaRestApi(this, "RestApi", {
      proxy: true,
      handler: apiFunction,
      defaultMethodOptions: {
        authorizationType: apigateway.AuthorizationType.NONE,
      },
      defaultCorsPreflightOptions: {
        allowHeaders: ["*"],
        allowMethods: ["*"],
        allowCredentials: true,
        allowOrigins: ["*"],
      },
    });

    // Add a Cognito domain for OAuth
    const userPoolDomain = new cognito.UserPoolDomain(this, "UserPoolDomain", {
      userPool: userPool,
      cognitoDomain: {
        domainPrefix: `cdk-playground-${this.account}`,
      },
    });

    const userPoolClient = new cognito.UserPoolClient(
      this,
      "MyUserPoolClient",
      {
        userPool: userPool,
        generateSecret: false, // Set to true if you need a client secret for server-side apps
        authFlows: {
          custom: true,
          userSrp: true,
        },
      }
    );

    // Outputs for the web application
    new cdk.CfnOutput(this, "UserPoolId", {
      value: userPool.userPoolId,
      description: "User Pool ID for the web application",
    });

    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.userPoolClientId,
      description: "User Pool Client ID for the web application",
    });

    new cdk.CfnOutput(this, "CognitoDomain", {
      value: userPoolDomain.domainName,
      description: "Cognito Domain for OAuth",
    });

    new cdk.CfnOutput(this, "CognitoDomainUrl", {
      value: `https://${userPoolDomain.domainName}.auth.${this.region}.amazoncognito.com`,
      description: "Full Cognito Domain URL for OAuth",
    });

    new cdk.CfnOutput(this, "RestApiUrl", {
      value: restApi.url,
      description: "Rest API URL",
    });
  }
}
