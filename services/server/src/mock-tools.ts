//GET rental policy details
const getPolicyDetailsSchema = JSON.stringify({
  type: "object",
  properties: {
    question: {
      type: "string",
      description: "The question the users asks about the car rental policy",
    },
  },
  required: ["question"],
});

function getPolicyDetails({ question }: { question: string }) {
  return {
    answer:
      "You are well within the policy limits and you should be able to do that without any issues",
  };
}

const getPolicyDetailsToolSpec = {
  toolSpec: {
    name: "getPolicyDetails",
    description: "get car rental policies",
    inputSchema: {
      json: getPolicyDetailsSchema,
    },
  },
};

//GET booking status
const getReservationStatusSchema = JSON.stringify({
  type: "object",
  properties: {
    bookingNumber: {
      type: "string",
      description: "The reservation  number for the rental car booked",
    },
  },
  required: [],
});

function getReservationStatus({ bookingNumber }: { bookingNumber: string }) {
  if (!bookingNumber) bookingNumber = "98786843";
  return {
    bookingNumber,
    status: "confirmed",
  };
}

const getReservationStatusToolSpec = {
  toolSpec: {
    name: "getReservationStatus",
    description: "get the status of the rental car booked by the customer.",
    inputSchema: {
      json: getReservationStatusSchema,
    },
  },
};

//CANCEL booking
const cancelReservationSchema = JSON.stringify({
  type: "object",
  properties: {
    bookingNumber: {
      type: "string",
      description: "The reservation number for the cancellation",
    },
  },
  required: [],
});

function cancelReservation({ bookingNumber }: { bookingNumber: string }) {
  if (!bookingNumber) bookingNumber = "98786843";
  return {
    bookingNumber,
    canceled: true,
  };
}

const cancelReservationToolSpec = {
  toolSpec: {
    name: "cancelReservation",
    description: "request to cancel the booking of a customer",
    inputSchema: {
      json: cancelReservationSchema,
    },
  },
};

//SUPPORT - call to an agent

const DefaultToolSchema = JSON.stringify({
  type: "object",
  properties: {},
  required: [],
});

const supportToolSpec = {
  toolSpec: {
    name: "support",
    description:
      "Help with billing issues, charges and refunds. Connects to a human support agent",
    inputSchema: {
      json: DefaultToolSchema,
    },
  },
};

function callSupport() {
  console.log(`SMK: billing tool`);
  return {
    answer: "Let me get you an agent to help you ...",
  };
}

//GET date tool
const getDateToolSpec = {
  toolSpec: {
    name: "getDateTool",
    description: "get information about the current date",
    inputSchema: {
      json: DefaultToolSchema,
    },
  },
};
function getDate() {
  const date = new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
  });
  const pstDate = new Date(date);
  return {
    date: pstDate.toISOString().split("T")[0],
    year: pstDate.getFullYear(),
    month: pstDate.getMonth() + 1,
    day: pstDate.getDate(),
    dayOfWeek: pstDate
      .toLocaleString("en-US", { weekday: "long" })
      .toUpperCase(),
    timezone: "PST",
  };
}

//GET date tool
const getTimeToolSpec = {
  toolSpec: {
    name: "getTimeTool",
    description: "get information about the current time",
    inputSchema: {
      json: DefaultToolSchema,
    },
  },
};
function getTime() {
  const pstTime = new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
  });
  return {
    timezone: "PST",
    formattedTime: new Date(pstTime).toLocaleTimeString("en-US", {
      hour12: true,
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

const availableTools = [
  getDateToolSpec,
  getTimeToolSpec,
  getPolicyDetailsToolSpec,
  getReservationStatusToolSpec,
  cancelReservationToolSpec,
  supportToolSpec,
];

//all names are converted to lowercase
const toolHandlers = {
  getpolicydetails: getPolicyDetails,
  getreservationstatus: getReservationStatus,
  cancelreservation: cancelReservation,
  support: callSupport,
  getdatetool: getDate,
  gettimetool: getTime,
};

async function toolProcessor(
  toolName: string,
  toolArgs: string
): Promise<Object> {
  console.log(toolArgs);
  const args = JSON.parse(toolArgs);
  console.log(`Tool ${toolName} invoked with args ${args}`);

  if (toolName in toolHandlers) {
    const tool: Function = toolHandlers[toolName as keyof typeof toolHandlers];
    if (tool.constructor.name === "AsyncFunction") {
      return await toolHandlers[toolName as keyof typeof toolHandlers](args);
    } else {
      return toolHandlers[toolName as keyof typeof toolHandlers](args);
    }
  } else {
    console.log(`Tool ${toolName} not supported`);
    return {
      message: "I cannot help you with that request",
      success: false,
    };
  }
}

export { availableTools, toolProcessor };
