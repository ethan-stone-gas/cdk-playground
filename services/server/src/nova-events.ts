import { z } from "zod";

/**
 * The sessionStart start event is how the entire nova session is started.
 * It configures the model parameters such as maxTokens, topP, and temperature.
 */
export const SessionStartEvent = z.object({
  event: z.object({
    sessionStart: z.object({
      inferenceConfiguration: z.object({
        maxTokens: z.number(),
        topP: z.number(),
        temperature: z.number(),
      }),
    }),
  }),
});

/**
 * The promptStart event is used to set the audio output configuration and tool configuration.
 * You assign a unique promptName, which is used to identify this prompt in future events.
 */
export const PromptStartEvent = z.object({
  event: z.object({
    promptStart: z.object({
      promptName: z.string(),
      textOutputConfiguration: z.object({
        mediaType: z.literal("text/plain"),
      }),
      audioOutputConfiguration: z.object({
        mediaType: z.literal("audio/lpcm"),
        sampleRateHertz: z.union([
          z.literal(8000),
          z.literal(16000),
          z.literal(24000),
        ]),
        sampleSizeBits: z.literal(16),
        channelCount: z.literal(1),
        voiceId: z.union([
          z.literal("matthew"),
          z.literal("tiffany"),
          z.literal("amy"),
          z.literal("lupe"),
          z.literal("carlos"),
          z.literal("ambre"),
          z.literal("florian"),
          z.literal("greta"),
          z.literal("lennart"),
          z.literal("beatrice"),
          z.literal("lorenzo"),
        ]),
        encoding: z.literal("base64"),
        audioType: z.literal("SPEECH"),
      }),
      toolUseOutputConfiguration: z.object({
        mediaType: z.literal("text/json"),
      }),
      toolConfiguration: z.object({
        tools: z.array(
          z.object({
            toolSpec: z.object({
              name: z.string(),
              description: z.string(),
              inputSchema: z.object({
                json: z.string(),
              }),
            }),
          })
        ),
      }),
    }),
  }),
});

const AudioInputContentStart = z.object({
  promptName: z.string(),
  contentName: z.string(),
  type: z.literal("AUDIO"),
  interactive: z.literal(true),
  role: z.literal("USER"),
  audioInputConfiguration: z.object({
    mediaType: z.literal("audio/lpcm"),
    sampleRateHertz: z.union([
      z.literal(8000),
      z.literal(16000),
      z.literal(24000),
    ]),
    sampleSizeBits: z.literal(16),
    channelCount: z.literal(1),
    audioType: z.literal("SPEECH"),
    encoding: z.literal("base64"),
  }),
});

const TextInputContentStart = z.object({
  promptName: z.string(),
  contentName: z.string(),
  type: z.literal("TEXT"),
  interactive: z.literal(false),
  role: z.enum(["USER", "SYSTEM", "ASSISTANT"]),
  textInputConfiguration: z.object({
    mediaType: z.literal("text/plain"),
  }),
});

const ToolResultContentStart = z.object({
  promptName: z.string(),
  contentName: z.string(),
  interactive: z.literal(false),
  type: z.literal("TOOL"),
  role: z.literal("TOOL"),
  toolResultInputConfiguration: z.object({
    toolUseId: z.string(),
    type: z.literal("TEXT"),
    textInputConfiguration: z.object({
      mediaType: z.literal("text/plain"),
    }),
  }),
});

/**
 * The input contentStart event is used to send the input content to the model.
 * You provide the promptName and a unique contentName.
 * The contentName is used to identify the content in future events as you stream data.
 */
export const InputContentStartEvent = z.object({
  event: z.object({
    contentStart: z.discriminatedUnion("type", [
      AudioInputContentStart,
      TextInputContentStart,
      ToolResultContentStart,
    ]),
  }),
});

/**
 * The audioInput event is used to send audio content. Make sure
 * a contentStart event is sent before this event and you use the same contentName.
 */
export const AudioInputContentEvent = z.object({
  event: z.object({
    audioInput: z.object({
      promptName: z.string(),
      contentName: z.string(),
      content: z.string(), // base64 encoded audio
    }),
  }),
});

/**
 * The textInput event is used to send text content. Make sure
 * a contentStart event is sent before this event and you use the same contentName.
 */
export const TextInputContentEvent = z.object({
  event: z.object({
    textInput: z.object({
      promptName: z.string(),
      contentName: z.string(),
      content: z.string(),
    }),
  }),
});

/**
 * The toolResult event is used to send tool result content. Make sure
 * a contentStart event is sent before this event and you use the same contentName.
 */
export const ToolResultEvent = z.object({
  event: z.object({
    toolResult: z.object({
      promptName: z.string(),
      contentName: z.string(),
      content: z.string(), // json string
    }),
  }),
});

/** Mark the end of the input content. */
export const InputContentEndEvent = z.object({
  event: z.object({
    contentEnd: z.object({
      promptName: z.string(),
      contentName: z.string(),
    }),
  }),
});

/** Mark the end of the prompt. */
export const PromptEndEvent = z.object({
  event: z.object({
    promptEnd: z.object({
      promptName: z.string(),
    }),
  }),
});

/** Mark the end of the session. */
export const SessionEndEvent = z.object({
  event: z.object({
    sessionEnd: z.object({}),
  }),
});

/**
 * Reports usage of the model. Can be used to estimate cost and other metrics.
 */
export const UsageEvent = z.object({
  event: z.object({
    usageEvent: z.object({
      completionId: z.string(),
      details: z.object({
        delta: z.object({
          input: z.object({
            speechTokens: z.number(),
            textTokens: z.number(),
          }),
          output: z.object({
            speechTokens: z.number(),
            textTokens: z.number(),
          }),
        }),
        total: z.object({
          input: z.object({
            speechTokens: z.number(),
            textTokens: z.number(),
          }),
          output: z.object({
            speechTokens: z.number(),
            textTokens: z.number(),
          }),
        }),
      }),
      promptName: z.string(),
      sessionId: z.string(),
      totalInputTokens: z.number(),
      totalOutputTokens: z.number(),
      totalTokens: z.number(),
    }),
  }),
});

/**
 * The completionStart event is used to start a completion.
 * It is used to track the completion of a prompt.
 */
export const CompletionStartEvent = z.object({
  event: z.object({
    completionStart: z.object({
      sessionId: z.string(),
      promptName: z.string(),
      completionId: z.string(),
    }),
  }),
});

const AudioOutputContentStartEvent = z.object({
  sessionId: z.string(),
  promptName: z.string(),
  completionId: z.string(),
  contentId: z.string(),
  type: z.literal("AUDIO"),
  role: z.literal("ASSISTANT"),
  audioOutputConfiguration: z.object({
    mediaType: z.literal("audio/lpcm"),
    sampleRateHertz: z.union([
      z.literal(8000),
      z.literal(16000),
      z.literal(24000),
    ]),
    sampleSizeBits: z.literal(16),
    encoding: z.literal("base64"),
    channelCount: z.literal(1),
  }),
});

const TextOutputContentStartEvent = z.object({
  additionalModelFields: z.string(), // json string
  sessionId: z.string(),
  promptName: z.string(),
  completionId: z.string(),
  contentId: z.string(),
  type: z.literal("TEXT"),
  role: z.literal("ASSISTANT"),
  textOutputConfiguration: z.object({
    mediaType: z.literal("text/plain"),
  }),
});

const ToolUseContentStartEvent = z.object({
  sessionId: z.string(),
  promptName: z.string(),
  completionId: z.string(),
  contentId: z.string(),
  type: z.literal("TOOL"),
  role: z.literal("TOOL"),
  toolUseOutputConfiguration: z.object({
    mediaType: z.literal("application/json"),
  }),
});

export const OutputContentStartEvent = z.object({
  event: z.object({
    contentStart: z.discriminatedUnion("type", [
      AudioOutputContentStartEvent,
      TextOutputContentStartEvent,
      ToolUseContentStartEvent,
    ]),
  }),
});

export const AudioOutputContentEvent = z.object({
  event: z.object({
    audioOutput: z.object({
      sessionId: z.string(), // unique identifier
      promptName: z.string(), // same unique identifier from promptStart event
      completionId: z.string(), // unique identifier
      contentId: z.string(), // same unique identifier from its contentStart
      content: z.string(), // base64EncodedAudioData
    }),
  }),
});

export const TextOutputContentEvent = z.object({
  event: z.object({
    textOutput: z.object({
      sessionId: z.string(), // unique identifier
      promptName: z.string(), // same unique identifier from promptStart event
      completionId: z.string(), // unique identifier
      contentId: z.string(), // same unique identifier from its contentStart
      content: z.string(), // User transcribe or Text Response
    }),
  }),
});

export const ToolUseEvent = z.object({
  event: z.object({
    toolUse: z.object({
      sessionId: z.string(), // unique identifier
      promptName: z.string(), // same unique identifier from promptStart event
      completionId: z.string(), // unique identifier
      contentId: z.string(), // same unique identifier from its contentStart
      content: z.string(), // json string
      toolName: z.string(),
      toolUseId: z.string(),
    }),
  }),
});

const AudioOutputContentEndEvent = z.object({
  sessionId: z.string(), // unique identifier
  promptName: z.string(), // same unique identifier from promptStart event
  completionId: z.string(), // unique identifier
  contentId: z.string(), // same unique identifier from its contentStart
  stopReason: z.enum(["PARTIAL_TURN", "END_TURN"]),
  type: z.literal("AUDIO"),
});

const TextOutputContentEndEvent = z.object({
  sessionId: z.string(), // unique identifier
  promptName: z.string(), // same unique identifier from promptStart event
  completionId: z.string(), // unique identifier
  contentId: z.string(), // same unique identifier from its contentStart
  stopReason: z.enum(["PARTIAL_TURN", "END_TURN", "INTERRUPTED"]),
  type: z.literal("TEXT"),
});

const ToolUseContentEndEvent = z.object({
  sessionId: z.string(), // unique identifier
  promptName: z.string(), // same unique identifier from promptStart event
  completionId: z.string(), // unique identifier
  contentId: z.string(), // same unique identifier from its contentStart
  stopReason: z.enum(["TOOL_USE"]),
  type: z.literal("TOOL"),
});

export const OutputContentEndEvent = z.object({
  event: z.object({
    contentEnd: z.discriminatedUnion("type", [
      AudioOutputContentEndEvent,
      TextOutputContentEndEvent,
      ToolUseContentEndEvent,
    ]),
  }),
});

export const CompletionEndEvent = z.object({
  event: z.object({
    completionEnd: z.object({
      sessionId: z.string(),
      promptName: z.string(),
      completionId: z.string(),
    }),
  }),
});

export const InputEvents = {
  SessionStartEvent,
  PromptStartEvent,
  InputContentStartEvent,
  AudioInputContentEvent,
  TextInputContentEvent,
  ToolResultEvent,
  InputContentEndEvent,
  PromptEndEvent,
  SessionEndEvent,
};

export const OutputEvents = {
  UsageEvent,
  CompletionStartEvent,
  OutputContentStartEvent,
  AudioOutputContentEvent,
  TextOutputContentEvent,
  ToolUseEvent,
  OutputContentEndEvent,
  CompletionEndEvent,
};

export namespace OutputEvents {
  export type UsageEvent = z.infer<typeof UsageEvent>;
  export type CompletionStartEvent = z.infer<typeof CompletionStartEvent>;
  export type OutputContentStartEvent = z.infer<typeof OutputContentStartEvent>;
  export type AudioOutputContentEvent = z.infer<typeof AudioOutputContentEvent>;
  export type TextOutputContentEvent = z.infer<typeof TextOutputContentEvent>;
  export type ToolUseEvent = z.infer<typeof ToolUseEvent>;
  export type OutputContentEndEvent = z.infer<typeof OutputContentEndEvent>;
  export type CompletionEndEvent = z.infer<typeof CompletionEndEvent>;
  export type AllEvents =
    | UsageEvent
    | CompletionStartEvent
    | OutputContentStartEvent
    | AudioOutputContentEvent
    | TextOutputContentEvent
    | ToolUseEvent
    | OutputContentEndEvent
    | CompletionEndEvent;
}

export namespace InputEvents {
  export type SessionStartEvent = z.infer<typeof SessionStartEvent>;
  export type PromptStartEvent = z.infer<typeof PromptStartEvent>;
  export type InputContentStartEvent = z.infer<typeof InputContentStartEvent>;
  export type AudioInputContentEvent = z.infer<typeof AudioInputContentEvent>;
  export type TextInputContentEvent = z.infer<typeof TextInputContentEvent>;
  export type ToolResultEvent = z.infer<typeof ToolResultEvent>;
  export type InputContentEndEvent = z.infer<typeof InputContentEndEvent>;
  export type PromptEndEvent = z.infer<typeof PromptEndEvent>;
  export type SessionEndEvent = z.infer<typeof SessionEndEvent>;
}
