# AWS Cognito + EntraID Authentication Web App

This is a simple React SPA that demonstrates authentication using AWS Cognito with Microsoft EntraID integration.

## Features

- OAuth 2.0 authentication flow with AWS Cognito
- Integration with Microsoft EntraID (Azure AD)
- Simple login/logout functionality
- Callback handling for OAuth redirects

## Setup Instructions

### 1. Deploy the CDK Stack

First, deploy the CDK stack to create the Cognito User Pool and configure EntraID integration:

```bash
cd ../../  # Go to the root directory
npm install
npx cdk deploy
```

### 2. Update Configuration

After deployment, you'll get output values. You can update the configuration in two ways:

#### Option A: Using the update script (Recommended)

```bash
npm run update-config YOUR_USER_POOL_ID YOUR_USER_POOL_CLIENT_ID YOUR_COGNITO_DOMAIN
```

#### Option B: Manual update

Update the `src/amplify-config.ts` file with the actual values from the CDK outputs:

```typescript
const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: "YOUR_USER_POOL_ID", // From CDK output
      userPoolClientId: "YOUR_USER_POOL_CLIENT_ID", // From CDK output
      loginWith: {
        oauth: {
          domain: "YOUR_COGNITO_DOMAIN", // From CDK output
          scopes: ["openid", "profile", "email"],
          responseType: "code",
          redirectSignIn: ["http://localhost:3000/callback"],
          redirectSignOut: ["http://localhost:3000/logout"],
        },
      },
    },
  },
};
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Start the Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

## Usage

1. Click "Sign In with EntraID" to start the authentication flow
2. You'll be redirected to Microsoft EntraID for authentication
3. After successful authentication, you'll be redirected back to the app
4. Click "Sign Out" to log out

## Routes

- `/` - Main authentication page
- `/callback` - OAuth callback handler
- `/logout` - Logout handler

## Configuration

The app is configured to work with:

- Login callback: `http://localhost:3000/callback`
- Logout callback: `http://localhost:3000/logout`

These URLs are configured in the CDK stack and must match exactly.

## Troubleshooting

If you encounter authentication issues:

1. Make sure the CDK stack is deployed successfully
2. Verify that the configuration values in `src/amplify-config.ts` match the CDK outputs
3. Check that the callback URLs in the CDK stack match your local development URLs
4. Ensure your EntraID app registration has the correct redirect URIs configured
