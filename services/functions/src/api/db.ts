import { Filter, MongoClient, WithId } from "mongodb";
import {
  BaseTicket,
  Ticket,
  ZenDeskTicket,
  ZohoTicket,
  type Comment,
} from "./schemas";

type MongoTicket = WithId<Ticket>;
type MongoComment = WithId<Comment>;

const fromMongo = {
  ticket: (ticket: MongoTicket): Ticket => {
    return Ticket.parse(ticket);
  },
  comment: (comment: MongoComment) => {
    return {
      ...comment,
      id: comment._id,
    };
  },
};

const client = new MongoClient(process.env.MONGO_URL!);

const db = client.db("ticketing");

const ticketCollection = db.collection<MongoTicket>("tickets");
const commentCollection = db.collection<MongoComment>("comments");

export class TicketService {
  public async upsertTicket(ticket: Ticket) {
    await ticketCollection.updateOne(
      { id: ticket.id },
      { $set: ticket },
      { upsert: true }
    );
  }

  public async getTicketById(id: string): Promise<Ticket | null> {
    const mongoTicket = await ticketCollection.findOne({ id });
    return mongoTicket ? fromMongo.ticket(mongoTicket) : null;
  }

  public async getTicketByProviderId(
    provider: "zoho" | "zendesk",
    providerId: string
  ): Promise<Ticket | null> {
    let filter: Filter<MongoTicket> = {
      providerId,
      provider,
    };

    const mongoTicket = await ticketCollection.findOne(filter);

    return mongoTicket ? fromMongo.ticket(mongoTicket) : null;
  }
}

export class CommentService {
  public async upsertComment(comment: Comment) {
    await commentCollection.updateOne(
      { id: comment.id },
      { $set: comment },
      { upsert: true }
    );
  }

  public async getComment(id: string) {
    const mongoComment = await commentCollection.findOne({ id });
    return mongoComment ? fromMongo.comment(mongoComment) : null;
  }
}

export const ticketService = new TicketService();
export const commentService = new CommentService();
