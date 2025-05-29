let credentials:
  | {
      clientId: string;
      clientSecret: string;
      refreshToken: string;
      orgId: string;
    }
  | undefined = undefined;

let accessToken: string | undefined = undefined;
let expiresAt: Date | undefined = undefined;

export function setCredentials(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  orgId: string
) {
  credentials = { clientId, clientSecret, refreshToken, orgId };
}

type AccessTokenResponse = {
  access_token: string;
  scope: string;
  api_domain: string;
  token_type: string;
  expires_in: number;
};

export async function getAccessToken() {
  if (!credentials) {
    throw new Error("Credentials not set");
  }

  if (accessToken && expiresAt && expiresAt > new Date()) {
    return accessToken;
  }

  const response = await fetch("https://accounts.zoho.com/oauth/v2/token", {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: credentials.refreshToken,
    }),
  });

  const data = (await response.json()) as AccessTokenResponse;

  accessToken = data.access_token;
  // expires_in is in seconds. We subtract 5 seconds to compensate for network
  // latency and then convert to milliseconds
  const expiresInMilliseconds = (data.expires_in - 5) * 1000;
  expiresAt = new Date(Date.now() + expiresInMilliseconds);

  return accessToken;
}

type ListTicketParams = {
  from?: number;
  departmentIds: string[];
};

type ListTicketResponse = {
  data: Ticket[];
};

interface Ticket {
  ticketNumber: string;
  subCategory: string | null;
  subject: string;
  dueDate: string | null; // Using string for ISO 8601 date strings
  departmentId: string;
  channel: string;
  isRead: boolean;
  onholdTime: string | null; // Assuming onholdTime might also be a date string or null
  language: string;
  source: Source;
  closedTime: string | null; // Using string for ISO 8601 date strings
  sharedCount: string; // Assuming it's a string based on the example
  responseDueDate: string | null; // Using string for ISO 8601 date strings
  contact: string;
  createdTime: string; // Using string for ISO 8601 date strings
  id: string;
  department: string;
  email: string;
  channelCode: string | null;
  customerResponseTime: string | null; // Using string for ISO 8601 date strings
  productId: string | null;
  contactId: string;
  threadCount: string; // Assuming it's a string based on the example
  team: string;
  priority: string;
  assigneeId: string;
  commentCount: string; // Assuming it's a string based on the example
  accountId: string;
  phone: string | null;
  webUrl: string;
  teamId: string;
  assignee: string;
  isSpam: boolean;
  category: string | null;
  status: string;
}

interface Source {
  appName: string | null;
  extId: string | null;
  type: string;
  permalink: string | null;
  appPhotoURL: string | null;
}

export async function listTickets(
  params: ListTicketParams
): Promise<ListTicketResponse> {
  if (!credentials) {
    throw new Error("Credentials not set");
  }

  const accessToken = await getAccessToken();

  const url = new URL("https://desk.zoho.com/api/v1/tickets");

  url.searchParams.set("sortBy", "createdTime");
  url.searchParams.set("limit", "100");

  if (params.from) {
    url.searchParams.set("from", params.from.toString());
  }

  if (params.departmentIds) {
    url.searchParams.set("departmentIds", params.departmentIds.join(","));
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      ordId: credentials.orgId,
    },
  });

  const data = (await response.json()) as ListTicketResponse;

  return data;
}

type ListConversationParams = {
  from?: number;
  ticketId: string;
};

type ListConversationResponse = {
  data: Thread[];
};

interface Thread {
  summary?: string;
  isDescriptionThread: boolean;
  canReply: boolean;
  visibility: string;
  author: Author;
  channel: string;
  source: Source;
  type: string;
  lastRatingIconURL: string | null;
  isForward: boolean;
  hasAttach: boolean;
  responderId: string;
  channelRelatedInfo: ChannelRelatedInfo;
  respondedIn: string; // Assuming this is a string representing time duration
  createdTime: string; // Using string for ISO 8601 date strings
  attachmentCount: string; // Assuming it's a string based on the example
  id: string;
  fromEmailAddress: string;
  actions: any[]; // Use a more specific type if the structure of actions is known
  contentType?: string;
  content?: string;
  status: string;
  direction: string;
}

interface Author {
  firstName: string;
  lastName: string;
  photoURL: string | null;
  name: string;
  type: string;
  email: string | null;
}

interface Source {
  appName: string | null;
  extId: string | null;
  type: string;
  permalink: string | null;
  appPhotoURL: string | null;
}

interface ChannelRelatedInfo {
  isDeleted: string; // Assuming these are strings based on the example ("false", "true")
  isBestSolution: string;
  externalLink: string | null;
}

export async function listConversations(
  params: ListConversationParams
): Promise<ListConversationResponse> {
  if (!credentials) {
    throw new Error("Credentials not set");
  }

  const accessToken = await getAccessToken();

  const url = new URL(
    `https://desk.zoho.com/api/v1/tickets/${params.ticketId}/conversations`
  );

  if (params.from) {
    url.searchParams.set("from", params.from.toString());
  }

  url.searchParams.set("limit", "100");

  const response = await fetch(url, {
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      ordId: credentials.orgId,
    },
  });

  const data = (await response.json()) as ListConversationResponse;

  return data;
}
