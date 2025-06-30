import { Amplify } from "aws-amplify";

// These values will need to be updated after CDK deployment
// You can get these from the AWS Console or CDK outputs
const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: "us-east-1_OLY1j1yPk", // Replace with actual User Pool ID
      userPoolClientId: "5uov588h5k1vi04ong9r7qem2", // Replace with actual Client ID
      loginWith: {
        oauth: {
          domain:
            "cdk-playground-914165346309.auth.us-east-1.amazoncognito.com", // Replace with actual Cognito domain
          scopes: [
            "openid",
            "profile",
            "email",
            "aws.cognito.signin.user.admin",
          ],
          responseType: "code" as const,
          redirectSignIn: ["http://localhost:5173/callback"],
          redirectSignOut: ["http://localhost:5173/logout"],
        },
      },
    },
  },
};

export const configureAmplify = () => {
  Amplify.configure(amplifyConfig);
};
