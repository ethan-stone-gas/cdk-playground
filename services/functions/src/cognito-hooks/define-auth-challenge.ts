import { DefineAuthChallengeTriggerHandler } from "aws-lambda";

type ExtendedChallengeName =
  | "SMS_MFA"
  | "SOFTWARE_TOKEN_MFA"
  | "MFA_SETUP"
  | "CUSTOM_CHALLENGE"
  | "PASSWORD_VERIFIER"
  | "SRP_A";

interface ExtendedChallengeResult {
  challengeName: ExtendedChallengeName;
  challengeResult: boolean;
  challengeMetadata?: string | null;
}

export const main: DefineAuthChallengeTriggerHandler = async (event) => {
  const session = event.request.session as unknown as ExtendedChallengeResult[];

  const lastChallenge = session.length > 0 ? session[session.length - 1] : null;

  // 1. First stage: Password SRP auth
  if (
    lastChallenge?.challengeName === "SRP_A" &&
    lastChallenge.challengeResult
  ) {
    // ✅ password verified
    const orgRequiresMfa = true; // look up org from DB
    const userHasMfaConfigured = false; // e.g. inspect Cognito user attrs

    if (orgRequiresMfa) {
      event.response.issueTokens = false;
      event.response.failAuthentication = false;

      if (userHasMfaConfigured) {
        event.response.challengeName = "SOFTWARE_TOKEN_MFA";
      } else {
        event.response.challengeName = "MFA_SETUP";
      }
    } else {
      // no MFA required
      event.response.issueTokens = true;
      event.response.failAuthentication = false;
    }
  }
  // 2. User has just successfully completed the MFA step
  else if (
    (lastChallenge?.challengeName === "SOFTWARE_TOKEN_MFA" &&
      lastChallenge.challengeResult) ||
    (lastChallenge?.challengeName === "MFA_SETUP" &&
      lastChallenge.challengeResult)
  ) {
    event.response.issueTokens = true;
    event.response.failAuthentication = false;
  }
  // 3. If last challenge failed → fail auth
  else {
    event.response.issueTokens = false;
    event.response.failAuthentication = true;
  }

  console.log("DefineAuthChallenge output:", JSON.stringify(event, null, 2));
  return event;
};
