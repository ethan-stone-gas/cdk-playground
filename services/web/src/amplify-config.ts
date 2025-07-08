import { Amplify } from "aws-amplify";

// These values will need to be updated after CDK deployment
// You can get these from the AWS Console or CDK outputs
const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: "us-east-1_L4xCOGB0X", // Replace with actual User Pool ID
      userPoolClientId: "7h67b48i1gsnd03ntd9jdp8v1", // Replace with actual Client ID
      loginWith: {
        oauth: {
          domain: "us-east-1l4xcogb0x.auth.us-east-1.amazoncognito.com", // Replace with actual Cognito domain
          scopes: ["openid", "email"],
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
