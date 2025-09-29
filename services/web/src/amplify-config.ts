import { Amplify } from "aws-amplify";

// These values will need to be updated after CDK deployment
// You can get these from the AWS Console or CDK outputs
const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: "us-east-1_talsDHuLC", // Replace with actual User Pool ID
      userPoolClientId: "5h6cuevkom8kjm3lgm38qjcd2p", // Replace with actual Client ID
    },
  },
};

export const configureAmplify = () => {
  Amplify.configure(amplifyConfig);
};
