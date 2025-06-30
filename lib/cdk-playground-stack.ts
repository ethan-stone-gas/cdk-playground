import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";

export class CdkPlaygroundStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const userPool = new cognito.UserPool(this, "UserPool", {
      signInAliases: {
        email: true,
      },
    });

    // Add a Cognito domain for OAuth
    const userPoolDomain = new cognito.UserPoolDomain(this, "UserPoolDomain", {
      userPool: userPool,
      cognitoDomain: {
        domainPrefix: `cdk-playground-${this.account}`,
      },
    });

    const tenantId = "52f4b921-d2fd-49db-85c5-350f69f26f61";

    const issuerUrl = `https://sts.windows.net/${tenantId}/`;

    const entraIdProvider = new cognito.UserPoolIdentityProviderOidc(
      this,
      "EntraIDProvider",
      {
        userPool: userPool,
        clientId: "5d0c52a3-a721-4563-9940-64ab23356184",
        clientSecret: "~EZ8Q~jfH53Wu1CbIRDaWZvywqv32p4k6ZS2edmZ",
        issuerUrl,
        attributeMapping: {
          email: cognito.ProviderAttribute.other("email"),
        },
        scopes: ["openid", "profile", "email", "aws.cognito.signin.user.admin"],
      }
    );

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
          cognito.UserPoolClientIdentityProvider.custom(
            entraIdProvider.providerName
          ), // Allow Microsoft Entra ID
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

    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'CdkPlaygroundQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
  }
}
