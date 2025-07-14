import { PreSignUpTriggerHandler } from "aws-lambda";
import { randomUUID } from "crypto";
import {
  createOrganization,
  createUser,
  getUserByEmail,
  updateUserById,
} from "src/utils/db";

export const main: PreSignUpTriggerHandler = async (event) => {
  const now = new Date();

  console.log(JSON.stringify(event, null, 2));

  // Technically the unique ID for the user is the userName.
  const cognitoId = event.userName;

  // This is a user that was invited to an organization and does not have an email domain that maps to an IdP in the organization.
  if (event.triggerSource === "PreSignUp_AdminCreateUser") {
    const email = event.request.userAttributes["email"];

    if (!email) {
      throw new Error("Email is required");
    }

    const user = await getUserByEmail(email);

    if (!user) {
      const userId = randomUUID();

      const orgId = randomUUID();

      await createOrganization({
        _id: orgId,
        name: "Default Organization",
        ownerId: userId,
        createdAt: now,
      });

      await createUser({
        _id: userId,
        email,
        organizations: [orgId],
        cognitoId,
        status: "CONFIRMED",
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // This is a user that signed up with a new account normally.
  if (event.triggerSource === "PreSignUp_SignUp") {
    const email = event.request.userAttributes["email"];

    if (!email) {
      throw new Error("Email is required");
    }

    const user = await getUserByEmail(email);

    if (!user) {
      const userId = randomUUID();

      const orgId = randomUUID();

      await createOrganization({
        _id: orgId,
        name: "Default Organization",
        ownerId: userId,
        createdAt: now,
      });

      await createUser({
        _id: userId,
        email,
        organizations: [orgId],
        status: "CONFIRMED",
        cognitoId,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // This is a user that was invited to an organization through an IdP.
  // A user in the DB should already exist, but it shouldn't have a cognitoId associated with it.
  // We want to update the user to have a cognitoId associated with it.
  if (event.triggerSource === "PreSignUp_ExternalProvider") {
    const email = event.request.userAttributes["email"];

    if (!email) {
      throw new Error("Email is required");
    }

    const user = await getUserByEmail(email);

    if (!user) {
      throw new Error("User not found");
    }

    if (user.status === "AWAITING_IDP_LOGIN") {
      await updateUserById(user._id, {
        cognitoId,
        status: "CONFIRMED",
      });
    }
  }

  return event;
};
