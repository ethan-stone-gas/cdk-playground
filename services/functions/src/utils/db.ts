import { MongoClient } from "mongodb";
import { retrieveSecret } from "../utils/retrieve-secret";

let mongoClient: MongoClient | null = null;

export async function initMongoClient() {
  if (mongoClient) return mongoClient;

  const secret = await retrieveSecret(process.env.SECRET_ARN!, ["MONGO_URL"]);

  mongoClient = new MongoClient(secret.MONGO_URL);

  return mongoClient;
}

type User = {
  _id: string;
  email: string;
  organizations: string[];
  cognitoId?: string | null;
  /**
   * AWAITING_COGNITO_LOGIN means the user was invited to the organization through Cognito. This means the users email domain does not map to an IdP in the organization that the user is invited to. In this scenario, when the user hasn't logged in yet, they SHOULD have a cognitoId associated with them.
   * AWAITING_IDP_LOGIN means the user was invited to the organization through an IdP. This means the users email domain maps to an IdP in the organization that the user is invited to. In this scenario, when the user hasn't logged in yet, they SHOULD NOT have a cognitoId associated with them.
   * CONFIRMED means the user has logged in to the organization through Cognito or an IdP.
   *
   * If a user signs up without an invitation, they should go straight to CONFIRMED.
   */
  status: "AWAITING_COGNITO_LOGIN" | "AWAITING_IDP_LOGIN" | "CONFIRMED";
  createdAt: Date;
  updatedAt: Date;
};

export async function createUser(user: User) {
  const client = await initMongoClient();

  const db = client.db("awsCognitoSSO");

  const userCollection = db.collection<User>("users");

  await userCollection.insertOne(user);
}

export async function getUserByEmail(email: string) {
  const client = await initMongoClient();

  const db = client.db("awsCognitoSSO");

  const userCollection = db.collection<User>("users");

  return userCollection.findOne({ email });
}

export async function updateUserById(
  id: string,
  user: Partial<Omit<User, "_id">>
) {
  const client = await initMongoClient();

  const db = client.db("awsCognitoSSO");

  const userCollection = db.collection<User>("users");

  await userCollection.updateOne({ _id: id }, { $set: user });
}

export async function getUserByCognitoId(cognitoId: string) {
  const client = await initMongoClient();

  const db = client.db("awsCognitoSSO");

  const userCollection = db.collection<User>("users");

  return userCollection.findOne({ cognitoId });
}

type Organization = {
  _id: string;
  name: string;
  ownerId: string;
  createdAt: Date;
};

export async function createOrganization(org: Organization) {
  const client = await initMongoClient();

  const db = client.db("awsCognitoSSO");

  const orgCollection = db.collection<Organization>("organizations");

  await orgCollection.insertOne(org);
}

export async function getOrganizationByOwnerId(ownerId: string) {
  const client = await initMongoClient();

  const db = client.db("awsCognitoSSO");

  const orgCollection = db.collection<Organization>("organizations");

  return orgCollection.findOne({ ownerId });
}

export type DomainVerificationRecords = {
  _id: string;
  organizationId: string;
  recordName: string;
  recordValue: string;
  createdAt: Date;
};

export async function createDomainVerificationRecord(
  record: DomainVerificationRecords
) {
  const client = await initMongoClient();

  const db = client.db("awsCognitoSSO");

  const domainVerificationRecordCollection =
    db.collection<DomainVerificationRecords>("domainVerificationRecords");

  await domainVerificationRecordCollection.insertOne(record);
}

export async function getDomainVerificationRecordByOrganizationId(
  organizationId: string
) {
  const client = await initMongoClient();

  const db = client.db("awsCognitoSSO");

  const domainVerificationRecordCollection =
    db.collection<DomainVerificationRecords>("domainVerificationRecords");

  return domainVerificationRecordCollection.findOne({ organizationId });
}
