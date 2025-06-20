import { MongoClient } from "mongodb";
import { type Comment, type Ticket } from "./schemas";

const client = new MongoClient(process.env.MONGO_URL!);

const db = client.db("ticketing");

const ticketCollection = db.collection("tickets");
const commentCollection = db.collection("comments");

// Helper functions to convert between MongoDB _id and application id
const toMongoDoc = <T extends { id: string }>(
  doc: T
): Omit<T, "id"> & { _id: string } => {
  const { id, ...rest } = doc;
  return { ...rest, _id: id };
};

const fromMongoDoc = (doc: any): any => {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { ...rest, id: _id };
};

export const syncTicket = async (ticket: Ticket) => {
  const mongoDoc = toMongoDoc(ticket);
  await ticketCollection.updateOne(
    { _id: mongoDoc._id } as any,
    { $set: mongoDoc },
    { upsert: true }
  );
};

export const syncComment = async (comment: Comment) => {
  const mongoDoc = toMongoDoc(comment);
  await commentCollection.updateOne(
    { _id: mongoDoc._id } as any,
    { $set: mongoDoc },
    { upsert: true }
  );
};

// Helper functions to get documents by id
export const getTicketById = async (id: string): Promise<Ticket | null> => {
  const mongoDoc = await ticketCollection.findOne({ _id: id } as any);
  return fromMongoDoc(mongoDoc);
};

export const getCommentById = async (id: string): Promise<Comment | null> => {
  const mongoDoc = await commentCollection.findOne({ _id: id } as any);
  return fromMongoDoc(mongoDoc);
};

// Helper functions to get multiple documents
export const getTickets = async (
  filter: Partial<Ticket> = {}
): Promise<Ticket[]> => {
  const { id, ...restFilter } = filter;
  const mongoFilter: any = { ...restFilter };
  if (id) {
    mongoFilter._id = id;
  }

  const mongoDocs = await ticketCollection.find(mongoFilter).toArray();
  return mongoDocs.map(fromMongoDoc);
};

export const getComments = async (
  filter: Partial<Comment> = {}
): Promise<Comment[]> => {
  const { id, ...restFilter } = filter;
  const mongoFilter: any = { ...restFilter };
  if (id) {
    mongoFilter._id = id;
  }

  const mongoDocs = await commentCollection.find(mongoFilter).toArray();
  return mongoDocs.map(fromMongoDoc);
};
