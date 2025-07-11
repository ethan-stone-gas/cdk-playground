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
      },
    });

    const restApi = new apigateway.LambdaRestApi(this, "RestApi", {
      proxy: true,
      handler: apiFunction,
    });

    const preSignUpFunction = new lambdaNodejs.NodejsFunction(
      this,
      "PreSignUpFunction",
      {
        entry: path.join(
          __dirname,
          "../services/functions/src/cognito-hooks/pre-sign-up.ts"
        ),
        handler: "main",
        runtime: lambda.Runtime.NODEJS_22_X,
        bundling: {
          minify: true,
          sourceMap: true,
        },
        environment: {
          SECRET_ARN: secret.secretArn,
        },
      }
    );

    const userPool = new cognito.UserPool(this, "UserPool", {
      signInAliases: {
        email: true,
      },
      lambdaTriggers: {
        preSignUp: preSignUpFunction,
      },
    });

    // Add a Cognito domain for OAuth
    const userPoolDomain = new cognito.UserPoolDomain(this, "UserPoolDomain", {
      userPool: userPool,
      cognitoDomain: {
        domainPrefix: `cdk-playground-${this.account}`,
      },
    });

    const CALLBACK_URLS = ["http://localhost:5173/callback"];
    const LOGOUT_URLS = ["http://localhost:5173/logout"];

    const userPoolClient = new cognito.UserPoolClient(
      this,
      "MyUserPoolClient",
      {
        userPool: userPool,
        generateSecret: false, // Set to true if you need a client secret for server-side apps
        authFlows: {
          userSrp: true, // Recommended for secure user authentication
          custom: true,
        },
        oAuth: {
          flows: {
            authorizationCodeGrant: true,
          },
          scopes: [
            cognito.OAuthScope.EMAIL,
            cognito.OAuthScope.OPENID,
            cognito.OAuthScope.PROFILE,
            cognito.OAuthScope.COGNITO_ADMIN,
          ],
          callbackUrls: CALLBACK_URLS,
          logoutUrls: LOGOUT_URLS,
        },
        supportedIdentityProviders: [
          cognito.UserPoolClientIdentityProvider.COGNITO, // Allow Cognito's own user management
        ],
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
