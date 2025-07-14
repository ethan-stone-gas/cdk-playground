import { PreTokenGenerationV2TriggerHandler } from "aws-lambda";

export const main: PreTokenGenerationV2TriggerHandler = async (event) => {
  event.response.claimsAndScopeOverrideDetails = {
    accessTokenGeneration: {
      scopesToAdd: ["api.access"],
    },
  };

  return event;
};
