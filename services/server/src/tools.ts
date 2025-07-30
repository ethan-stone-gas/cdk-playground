import { ToolSpec } from "./nova-events";

const getCallContextToolSpec: ToolSpec = {
  toolSpec: {
    name: "getCallContext",
    description: "Get the context of the call",
    inputSchema: {
      json: JSON.stringify({
        type: "object",
        properties: {
          phoneNumber: {
            type: "string",
            description: "The phone number of the caller",
          },
        },
        required: ["phoneNumber"],
      }),
    },
  },
};

type GetCallContextToolResult = {
  phoneNumber?: string;
  locationId?: string;
  locationName?: string;
  stationId?: string;
  stationName?: string;
  stationShortCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

function getCallContextTool(args: {
  phoneNumber: string;
}): GetCallContextToolResult | null {
  return {
    phoneNumber: args.phoneNumber,
    locationId: "123",
    locationName: "Location 1",
    stationId: "456",
    stationName: "Station 1",
    stationShortCode: "S1",
    latitude: 37.7749,
    longitude: -122.4194,
  };
}

const getNearbyLocationsWithStreetNameCityStateToolSpec: ToolSpec = {
  toolSpec: {
    name: "getNearbyLocationWithStreetNameCityState",
    description:
      "Get the nearby location with street name, city, and state. This can be used to find the location of the caller. Each location will have a list of stations and their connection and connector statuses at the time of calling this tool. The locations are ordered by increasing distance from the street name, city, and state. This tool can be used for two purposes. 1. Finding the location and station the driver is currently at, and 2. Finding an alternative location if no stations are available at the current location.",
    inputSchema: {
      json: JSON.stringify({
        type: "object",
        properties: {
          streetName: { type: "string", description: "The street name" },
          city: { type: "string", description: "The city" },
          state: { type: "string", description: "The state" },
        },
        required: ["streetName", "city", "state"],
      }),
    },
  },
};

type GetNearbyLocationsWithStreetNameCityStateToolResult = {
  locations: {
    locationId: string;
    locationName: string;
    distanceAwayInMeters: number;
    stations: {
      stationId: string;
      stationName: string;
      stationShortCode?: string | null;
      connectionStatus: "CONNECTED" | "DISCONNECTED";
      connectors: {
        connectorId: number;
        connectorStatus: "Available" | "Occupied" | "Faulted" | "Charging";
      }[];
    }[];
  }[];
};

function getNearbyLocationsWithStreetNameCityStateTool(args: {
  streetName: string;
  city: string;
  state: string;
}): GetNearbyLocationsWithStreetNameCityStateToolResult {
  return {
    locations: [
      {
        locationId: "123",
        locationName: "Location 1",
        distanceAwayInMeters: 100,
        stations: [
          {
            stationId: "456",
            stationName: "Station 1",
            stationShortCode: "S1",
            connectionStatus: "CONNECTED",
            connectors: [
              {
                connectorId: 1,
                connectorStatus: "Available",
              },
            ],
          },
        ],
      },
    ],
  };
}

const getStationsRealtimeStatusToolSpec: ToolSpec = {
  toolSpec: {
    name: "getStationsRealtimeStatus",
    description:
      "Get the realtime status of multiple stations. This includes connection status and connector statuses.",
    inputSchema: {
      json: JSON.stringify({
        type: "object",
        properties: {
          stationId: {
            type: "string",
            description: "The id of the station",
          },
        },
        required: ["stationIds"],
      }),
    },
  },
};

type GetStationsRealtimeStatusToolResult = {
  stations: {
    stationId: string;
    stationName: string;
    stationShortCode: string;
    connectionStatus: "CONNECTED" | "DISCONNECTED";
    connectors: {
      connectorId: number;
      connectorStatus: "Available" | "Occupied" | "Faulted" | "Charging";
    }[];
  }[];
};

export function getStationsRealtimeStatusTool(args: {
  stationIds: string[];
}): GetStationsRealtimeStatusToolResult {
  return {
    stations: [
      {
        stationId: "123",
        stationName: "Station 1",
        stationShortCode: "S1",
        connectionStatus: "CONNECTED",
        connectors: [
          {
            connectorId: 1,
            connectorStatus: "Available",
          },
        ],
      },
    ],
  };
}

const toolHandlers = {
  getcallcontext: getCallContextTool,
  getnearbylocationwithstreetnamecitystate:
    getNearbyLocationsWithStreetNameCityStateTool,
  getstationsrealtimestatus: getStationsRealtimeStatusTool,
};

const availableTools = [
  getCallContextToolSpec,
  getNearbyLocationsWithStreetNameCityStateToolSpec,
  getStationsRealtimeStatusToolSpec,
];

async function toolProcessor(
  toolName: string,
  toolArgs: string
): Promise<Object | null> {
  const args = JSON.parse(toolArgs);
  const tool: Function = toolHandlers[toolName as keyof typeof toolHandlers];
  if (tool.constructor.name === "AsyncFunction") {
    return await tool(args);
  } else {
    return tool(args);
  }
}

export { toolHandlers, availableTools, toolProcessor };
