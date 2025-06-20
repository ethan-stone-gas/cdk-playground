import { MongoClient } from "mongodb";
import { type Comment, type Ticket } from "./schemas";

type MongoTicket = Omit<Ticket, "id"> & { _id: string };
type MongoComment = Omit<Comment, "id"> & { _id: string };

const toMongo = {
  ticket: (ticket: Ticket) => {
    return {
      ...ticket,
      _id: ticket.id,
    };
  },
  comment: (comment: Comment) => {
    return {
      ...comment,
      _id: comment.id,
    };
  },
};

const fromMongo = {
  ticket: (ticket: MongoTicket) => {
    return {
      ...ticket,
      id: ticket._id,
    };
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
    const mongoTicket = toMongo.ticket(ticket);
    await ticketCollection.updateOne(
      { _id: mongoTicket._id },
      { $set: mongoTicket },
      { upsert: true }
    );
  }

  public async getTicket(id: string) {
    const mongoTicket = await ticketCollection.findOne({ _id: id });
    return mongoTicket ? fromMongo.ticket(mongoTicket) : null;
  }
}

export class CommentService {
  public async upsertComment(comment: Comment) {
    const mongoComment = toMongo.comment(comment);
    await commentCollection.updateOne(
      { _id: mongoComment._id },
      { $set: mongoComment },
      { upsert: true }
    );
  }

  public async getComment(id: string) {
    const mongoComment = await commentCollection.findOne({ _id: id });
    return mongoComment ? fromMongo.comment(mongoComment) : null;
  }
}
