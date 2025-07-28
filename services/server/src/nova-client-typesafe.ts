import {
  BedrockRuntimeClient,
  BedrockRuntimeClientConfig,
  InvokeModelWithBidirectionalStreamCommand,
  InvokeModelWithBidirectionalStreamInput,
} from "@aws-sdk/client-bedrock-runtime";
import {
  NodeHttp2Handler,
  NodeHttp2HandlerOptions,
} from "@smithy/node-http-handler";
import { Provider } from "@smithy/types";
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { InferenceConfig } from "./types";
import { Subject } from "rxjs";
import { take } from "rxjs/operators";
import { firstValueFrom } from "rxjs";
import {
  DefaultAudioInputConfiguration,
  DefaultAudioOutputConfiguration,
  DefaultSystemPrompt,
  DefaultTextConfiguration,
} from "./consts";
import { availableTools, toolProcessor } from "./mock-tools";
import {
  type InputEvents,
  type OutputEvents,
  OutputEventSchemas,
} from "./nova-events";
import z from "zod";

type EventHandlerTypes =
  | "usage"
  | "completionStart"
  | "contentStart"
  | "audioOutput"
  | "textOutput"
  | "toolUse"
  | "contentEnd"
  | "completionEnd"
  | "streamComplete"
  | "error";

type EventHandlerTypeToPayload = {
  usage: OutputEvents.UsageEvent;
  completionStart: OutputEvents.CompletionStartEvent;
  contentStart: OutputEvents.OutputContentStartEvent;
  audioOutput: OutputEvents.AudioOutputContentEvent;
  textOutput: OutputEvents.TextOutputContentEvent;
  toolUse: OutputEvents.ToolUseEvent;
  contentEnd: OutputEvents.OutputContentEndEvent;
  completionEnd: OutputEvents.CompletionEndEvent;
  streamComplete: {
    timestsamp: Date;
  };
  error: {
    source: string;
    error: unknown;
  };
};

export interface S2SBidirectionalStreamClientConfig {
  requestHandlerConfig?:
    | NodeHttp2HandlerOptions
    | Provider<NodeHttp2HandlerOptions | void>;
  clientConfig: Partial<BedrockRuntimeClientConfig>;
  inferenceConfig?: InferenceConfig;
}

export class StreamSession {
  private audioBufferQueue: Buffer[] = [];
  private maxQueueSize = 200; // Maximum number of audio chunks to queue
  private isProcessingAudio = false;
  private isActive = true;
  public twilioStreamSid = ""; //for twilio stream

  constructor(
    private sessionId: string,
    private client: S2SBidirectionalStreamClient
  ) {}

  // Register event handlers for this specific session
  public onEvent<T extends EventHandlerTypes>(
    eventType: T,
    handler: (data: EventHandlerTypeToPayload[T]) => void
  ): StreamSession {
    this.client.registerEventHandler(this.sessionId, eventType, handler);
    return this; // For chaining
  }

  public async setupPromptStart(): Promise<void> {
    this.client.setupPromptStartEvent(this.sessionId);
  }

  public async setupSystemPrompt(
    textConfig: typeof DefaultTextConfiguration = DefaultTextConfiguration,
    systemPromptContent: string = DefaultSystemPrompt
  ): Promise<void> {
    this.client.setupSystemPromptEvent(
      this.sessionId,
      textConfig,
      systemPromptContent
    );
  }

  public async setupStartAudioContent(
    audioConfig: typeof DefaultAudioInputConfiguration = DefaultAudioInputConfiguration
  ): Promise<void> {
    this.client.setupStartAudioEvent(this.sessionId, audioConfig);
  }

  // Stream audio for this session
  public async streamAudioContent(audioData: Buffer): Promise<void> {
    // Check queue size to avoid memory issues
    if (this.audioBufferQueue.length >= this.maxQueueSize) {
      // Queue is full, drop oldest chunk
      this.audioBufferQueue.shift();
      console.log("Audio queue full, dropping oldest chunk");
    }

    // Queue the audio chunk for streaming
    this.audioBufferQueue.push(audioData);
    this.processAudioContentQueue();
  }

  // Process audio queue for continuous streaming
  private async processAudioContentQueue() {
    if (
      this.isProcessingAudio ||
      this.audioBufferQueue.length === 0 ||
      !this.isActive
    )
      return;

    this.isProcessingAudio = true;
    try {
      // Process all chunks in the queue, up to a reasonable limit
      let processedChunks = 0;
      const maxChunksPerBatch = 5; // Process max 5 chunks at a time to avoid overload

      while (
        this.audioBufferQueue.length > 0 &&
        processedChunks < maxChunksPerBatch &&
        this.isActive
      ) {
        const audioChunk = this.audioBufferQueue.shift();
        if (audioChunk) {
          await this.client.streamAudioContentChunk(this.sessionId, audioChunk);
          processedChunks++;
        }
      }
    } finally {
      this.isProcessingAudio = false;

      // If there are still items in the queue, schedule the next processing using setTimeout
      if (this.audioBufferQueue.length > 0 && this.isActive) {
        setTimeout(() => this.processAudioContentQueue(), 0);
      }
    }
  }
  // Get session ID
  public getSessionId(): string {
    return this.sessionId;
  }

  public async endAudioContent(): Promise<void> {
    if (!this.isActive) return;
    await this.client.sendContentEnd(this.sessionId);
  }

  public async endPrompt(): Promise<void> {
    if (!this.isActive) return;
    await this.client.sendPromptEnd(this.sessionId);
  }

  public async close(): Promise<void> {
    if (!this.isActive) return;

    this.isActive = false;
    this.audioBufferQueue = []; // Clear any pending audio

    await this.client.sendSessionEnd(this.sessionId);
    console.log(`Session ${this.sessionId} close completed`);
  }
}

// Session data type
interface SessionData {
  inputEventQueue: Array<InputEvents.AllEvents>;
  inputEventQueueSignal: Subject<void>;
  closeSignal: Subject<void>;
  toolUseContent: string | null;
  toolUseId: string;
  toolName: string;
  responseHandlers: Map<string, (data: any) => void>;
  promptName: string;
  inferenceConfig: InferenceConfig;
  isActive: boolean;
  isPromptStartSent: boolean;
  isAudioContentStartSent: boolean;
  audioContentId: string;
}

export class S2SBidirectionalStreamClient {
  private bedrockRuntimeClient: BedrockRuntimeClient;
  private inferenceConfig: InferenceConfig;
  private activeSessions: Map<string, SessionData> = new Map();
  private sessionLastActivity: Map<string, number> = new Map();
  private sessionCleanupInProgress = new Set<string>();

  constructor(config: S2SBidirectionalStreamClientConfig) {
    const http2Client = new NodeHttp2Handler({
      requestTimeout: 300000,
      sessionTimeout: 300000,
      disableConcurrentStreams: false,
      maxConcurrentStreams: 20,
      ...config.requestHandlerConfig,
    });

    if (!config.clientConfig.credentials) {
      throw new Error("No credentials provided");
    }

    this.bedrockRuntimeClient = new BedrockRuntimeClient({
      ...config.clientConfig,
      credentials: config.clientConfig.credentials,
      region: config.clientConfig.region || "us-east-1",
      requestHandler: http2Client,
    });

    this.inferenceConfig = config.inferenceConfig ?? {
      maxTokens: 1024,
      topP: 0.9,
      temperature: 0.7,
    };
  }

  public isSessionActive(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    return !!session && session.isActive;
  }

  public getActiveSessions(): string[] {
    return Array.from(this.activeSessions.keys());
  }

  public getLastActivityTime(sessionId: string): number {
    return this.sessionLastActivity.get(sessionId) || 0;
  }

  private updateSessionActivity(sessionId: string): void {
    this.sessionLastActivity.set(sessionId, Date.now());
  }

  public isCleanupInProgress(sessionId: string): boolean {
    return this.sessionCleanupInProgress.has(sessionId);
  }

  // Create a new streaming session
  public createStreamSession(
    sessionId: string = randomUUID(),
    config?: S2SBidirectionalStreamClientConfig
  ): StreamSession {
    if (this.activeSessions.has(sessionId)) {
      throw new Error(`Stream session with ID ${sessionId} already exists`);
    }

    const session: SessionData = {
      inputEventQueue: [],
      inputEventQueueSignal: new Subject<void>(),
      closeSignal: new Subject<void>(),
      toolUseContent: null,
      toolUseId: "",
      toolName: "",
      responseHandlers: new Map(),
      promptName: randomUUID(),
      inferenceConfig: config?.inferenceConfig ?? this.inferenceConfig,
      isActive: true,
      isPromptStartSent: false,
      isAudioContentStartSent: false,
      audioContentId: randomUUID(),
    };

    this.activeSessions.set(sessionId, session);

    return new StreamSession(sessionId, this);
  }

  // Stream audio for a specific session
  public async initiateSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Stream session ${sessionId} not found`);
    }

    try {
      // Set up initial events for this session
      this.setupSessionStartEvent(sessionId);

      // Create the bidirectional stream with session-specific async iterator
      const asyncIterable = this.createSessionInputEventProcessor(sessionId);

      console.log(`Starting bidirectional stream for session ${sessionId}...`);

      const response = await this.bedrockRuntimeClient.send(
        new InvokeModelWithBidirectionalStreamCommand({
          modelId: "amazon.nova-sonic-v1:0",
          body: asyncIterable,
        })
      );

      console.log(
        `Stream established for session ${sessionId}, processing responses...`
      );

      // Process responses for this session
      await this.processResponseStream(sessionId, response);
    } catch (error) {
      console.error(`Error in session ${sessionId}:`, error);
      this.dispatchEventForSession(sessionId, "error", {
        source: "bidirectionalStream",
        error,
      });

      // Make sure to clean up if there's an error
      if (session.isActive) {
        this.closeSession(sessionId);
      }
    }
  }

  // Dispatch events to handlers for a specific session
  private dispatchEventForSession(
    sessionId: string,
    eventType: string,
    data: any
  ): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const handler = session.responseHandlers.get(eventType);
    if (handler) {
      try {
        handler(data);
      } catch (e) {
        console.error(
          `Error in ${eventType} handler for session ${sessionId}:`,
          e
        );
      }
    }

    // Also dispatch to "any" handlers
    const anyHandler = session.responseHandlers.get("any");
    if (anyHandler) {
      try {
        anyHandler({ type: eventType, data });
      } catch (e) {
        console.error(`Error in 'any' handler for session ${sessionId}:`, e);
      }
    }
  }

  /**
   * Creates an async iterable for sending input events to the session.
   * @param sessionId The session ID for which to create the async iterable.
   * @returns An async iterable for sending input events to the session.
   */
  private createSessionInputEventProcessor(
    sessionId: string
  ): AsyncIterable<InvokeModelWithBidirectionalStreamInput> {
    if (!this.isSessionActive(sessionId)) {
      console.log(
        `Cannot create async iterable: Session ${sessionId} not active`
      );
      return {
        [Symbol.asyncIterator]: () => ({
          next: async () => ({ value: undefined, done: true }),
        }),
      };
    }

    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(
        `Cannot create async iterable: Session ${sessionId} not found`
      );
    }

    let eventCount = 0;

    return {
      [Symbol.asyncIterator]: () => {
        console.log(
          `AsyncIterable iterator requested for session ${sessionId}`
        );

        return {
          next: async (): Promise<
            IteratorResult<InvokeModelWithBidirectionalStreamInput>
          > => {
            try {
              // Check if session is still active
              if (!session.isActive || !this.activeSessions.has(sessionId)) {
                console.log(
                  `Iterator closing for session ${sessionId}, done=true`
                );
                return { value: undefined, done: true };
              }
              // Wait for items in the queue or close signal
              if (session.inputEventQueue.length === 0) {
                try {
                  await Promise.race([
                    firstValueFrom(session.inputEventQueueSignal.pipe(take(1))),
                    firstValueFrom(session.closeSignal.pipe(take(1))).then(
                      () => {
                        throw new Error("Stream closed");
                      }
                    ),
                  ]);
                } catch (error) {
                  if (error instanceof Error) {
                    if (
                      error.message === "Stream closed" ||
                      !session.isActive
                    ) {
                      // This is an expected condition when closing the session
                      if (this.activeSessions.has(sessionId)) {
                        console.log(`Session \${sessionId} closed during wait`);
                      }
                      return { value: undefined, done: true };
                    }
                  } else {
                    console.error(`Error on event close`, error);
                  }
                }
              }

              // If queue is still empty or session is inactive, we're done
              if (session.inputEventQueue.length === 0 || !session.isActive) {
                console.log(`Queue empty or session inactive: ${sessionId}`);
                return { value: undefined, done: true };
              }

              // Get next item from the session's queue
              const nextEvent = session.inputEventQueue.shift();
              eventCount++;

              //console.log(`Sending event #${eventCount} for session ${sessionId}: ${JSON.stringify(nextEvent).substring(0, 100)}...`);

              return {
                value: {
                  chunk: {
                    bytes: new TextEncoder().encode(JSON.stringify(nextEvent)),
                  },
                },
                done: false,
              };
            } catch (error) {
              console.error(`Error in session ${sessionId} iterator:`, error);
              session.isActive = false;
              return { value: undefined, done: true };
            }
          },

          return: async (): Promise<
            IteratorResult<InvokeModelWithBidirectionalStreamInput>
          > => {
            console.log(`Iterator return() called for session ${sessionId}`);
            session.isActive = false;
            return { value: undefined, done: true };
          },

          throw: async (
            error: any
          ): Promise<
            IteratorResult<InvokeModelWithBidirectionalStreamInput>
          > => {
            console.log(
              `Iterator throw() called for session ${sessionId} with error:`,
              error
            );
            session.isActive = false;
            throw error;
          },
        };
      },
    };
  }

  // Process the response stream from AWS Bedrock
  private async processResponseStream(
    sessionId: string,
    response: any
  ): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    try {
      for await (const event of response.body) {
        if (!session.isActive) {
          console.log(
            `Session ${sessionId} is no longer active, stopping response processing`
          );
          break;
        }

        if (event.chunk?.bytes) {
          try {
            this.updateSessionActivity(sessionId);
            const textResponse = new TextDecoder().decode(event.chunk.bytes);

            try {
              const jsonResponse = JSON.parse(textResponse);

              const outputEventHandlers: {
                schema: z.ZodType<any>;
                handler: (data: any) => Promise<void>;
              }[] = [
                {
                  schema: OutputEventSchemas.UsageEvent,
                  handler: async (data: OutputEvents.UsageEvent) => {
                    this.dispatchEvent(sessionId, "usage", data);
                  },
                },
                {
                  schema: OutputEventSchemas.CompletionStartEvent,
                  handler: async (data: OutputEvents.CompletionStartEvent) => {
                    this.dispatchEvent(sessionId, "completionStart", data);
                  },
                },
                {
                  schema: OutputEventSchemas.OutputContentStartEvent,
                  handler: async (
                    data: OutputEvents.OutputContentStartEvent
                  ) => {
                    this.dispatchEvent(sessionId, "contentStart", data);
                  },
                },
                {
                  schema: OutputEventSchemas.AudioOutputContentEvent,
                  handler: async (
                    data: OutputEvents.AudioOutputContentEvent
                  ) => {
                    this.dispatchEvent(sessionId, "audioOutput", data);
                  },
                },
                {
                  schema: OutputEventSchemas.TextOutputContentEvent,
                  handler: async (
                    data: OutputEvents.TextOutputContentEvent
                  ) => {
                    this.dispatchEvent(sessionId, "textOutput", data);
                  },
                },
                {
                  schema: OutputEventSchemas.ToolUseEvent,
                  handler: async (data: OutputEvents.ToolUseEvent) => {
                    this.dispatchEvent(sessionId, "toolUse", data);

                    session.toolUseContent = data.event.toolUse.content;
                    session.toolUseId = data.event.toolUse.toolUseId;
                    session.toolName = data.event.toolUse.toolName;
                  },
                },
                {
                  schema: OutputEventSchemas.OutputContentEndEvent,
                  handler: async (data: OutputEvents.OutputContentEndEvent) => {
                    this.dispatchEvent(sessionId, "contentEnd", data);
                    if (data.event.contentEnd.type === "TOOL") {
                      console.log(
                        `processing tool use for session ${sessionId}`
                      );

                      const externalModelResult = await toolProcessor(
                        session.toolName.toLowerCase(),
                        session.toolUseContent ?? ""
                      );

                      this.sendToolResult(
                        sessionId,
                        session.toolUseId,
                        externalModelResult
                      );
                    }
                  },
                },
                {
                  schema: OutputEventSchemas.CompletionEndEvent,
                  handler: async (data: OutputEvents.CompletionEndEvent) => {
                    this.dispatchEvent(sessionId, "completionEnd", data);
                  },
                },
              ];

              for (const handler of outputEventHandlers) {
                const parsedData = await handler.schema.safeParseAsync(
                  jsonResponse
                );

                if (parsedData.success) {
                  await handler.handler(parsedData.data);
                } else {
                  console.error(
                    `Error parsing ${handler.schema.description} for session ${sessionId}:`,
                    parsedData.error
                  );
                }
              }
            } catch (e) {
              console.log(
                `Raw text response for session ${sessionId} (parse error):`,
                textResponse
              );
            }
          } catch (e) {
            console.error(
              `Error processing response chunk for session ${sessionId}:`,
              e
            );
          }
        } else if (event.modelStreamErrorException) {
          console.error(
            `Model stream error for session ${sessionId}:`,
            event.modelStreamErrorException
          );
          this.dispatchEvent(sessionId, "error", {
            source: "modelStreamErrorException",
            error: event.modelStreamErrorException,
          });
        } else if (event.internalServerException) {
          console.error(
            `Internal server error for session ${sessionId}:`,
            event.internalServerException
          );
          this.dispatchEvent(sessionId, "error", {
            source: "internalServerException",
            error: event.internalServerException,
          });
        }
      }

      console.log(
        `Response stream processing complete for session ${sessionId}`
      );
      this.dispatchEvent(sessionId, "streamComplete", {
        timestsamp: new Date(),
      });
    } catch (error) {
      console.error(
        `Error processing response stream for session ${sessionId}:`,
        error
      );
      this.dispatchEvent(sessionId, "error", {
        source: "responseStream",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Add an event to a session's queue
  private queueInputEvent(
    sessionId: string,
    event: InputEvents.AllEvents
  ): void {
    const session = this.activeSessions.get(sessionId);
    if (!session || !session.isActive) return;

    this.updateSessionActivity(sessionId);
    session.inputEventQueue.push(event);
    session.inputEventQueueSignal.next();
  }

  // Set up initial events for a session
  private setupSessionStartEvent(sessionId: string): void {
    console.log(`Setting up initial events for session ${sessionId}...`);
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    // Session start event
    this.queueInputEvent(sessionId, {
      event: {
        sessionStart: {
          inferenceConfiguration: session.inferenceConfig,
        },
      },
    });
  }
  public setupPromptStartEvent(sessionId: string): void {
    console.log(`Setting up prompt start event for session ${sessionId}...`);
    const session = this.activeSessions.get(sessionId);
    if (!session) return;
    // Prompt start event
    this.queueInputEvent(sessionId, {
      event: {
        promptStart: {
          promptName: session.promptName,
          textOutputConfiguration: {
            mediaType: "text/plain",
          },
          audioOutputConfiguration: DefaultAudioOutputConfiguration,
          toolUseOutputConfiguration: {
            mediaType: "application/json",
          },
          toolConfiguration: {
            tools: availableTools,
          },
        },
      },
    });
    session.isPromptStartSent = true;
  }

  public setupSystemPromptEvent(
    sessionId: string,
    textConfig: typeof DefaultTextConfiguration = DefaultTextConfiguration,
    systemPromptContent: string = DefaultSystemPrompt
  ): void {
    console.log(`Setting up systemPrompt events for session ${sessionId}...`);

    const session = this.activeSessions.get(sessionId);

    if (!session) return;

    // Text content start
    const textPromptID = randomUUID();

    this.queueInputEvent(sessionId, {
      event: {
        contentStart: {
          promptName: session.promptName,
          contentName: textPromptID,
          type: "TEXT",
          interactive: true,
          role: "SYSTEM",
          textInputConfiguration: textConfig,
        },
      },
    });

    // Text input content
    this.queueInputEvent(sessionId, {
      event: {
        textInput: {
          promptName: session.promptName,
          contentName: textPromptID,
          content: systemPromptContent,
        },
      },
    });

    // Text content end
    this.queueInputEvent(sessionId, {
      event: {
        contentEnd: {
          promptName: session.promptName,
          contentName: textPromptID,
        },
      },
    });
  }

  public setupStartAudioEvent(
    sessionId: string,
    audioConfig: typeof DefaultAudioInputConfiguration = DefaultAudioInputConfiguration
  ): void {
    console.log(
      `Setting up startAudioContent event for session ${sessionId}...`
    );
    const session = this.activeSessions.get(sessionId);

    if (!session) return;

    console.log(`Using audio content ID: ${session.audioContentId}`);
    // Audio content start
    this.queueInputEvent(sessionId, {
      event: {
        contentStart: {
          promptName: session.promptName,
          contentName: session.audioContentId,
          type: "AUDIO",
          role: "USER",
          interactive: true,
          audioInputConfiguration: audioConfig,
        },
      },
    });
    session.isAudioContentStartSent = true;
    console.log(`Initial events setup complete for session ${sessionId}`);
  }

  // Stream an audio chunk for a session
  public async streamAudioContentChunk(
    sessionId: string,
    audioData: Buffer
  ): Promise<void> {
    const session = this.activeSessions.get(sessionId);

    if (!session || !session.isActive || !session.audioContentId) {
      throw new Error(`Invalid session ${sessionId} for audio streaming`);
    }

    // Convert audio to base64
    const base64Data = audioData.toString("base64");

    this.queueInputEvent(sessionId, {
      event: {
        audioInput: {
          promptName: session.promptName,
          contentName: session.audioContentId,
          content: base64Data,
        },
      },
    });
  }

  // Send tool result back to the model
  private async sendToolResult(
    sessionId: string,
    toolUseId: string,
    result: Object
  ): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    console.log("inside tool result");
    if (!session || !session.isActive) return;

    console.log(
      `Sending tool result for session ${sessionId}, tool use ID: ${toolUseId}`
    );
    const contentId = randomUUID();

    // Tool content start
    this.queueInputEvent(sessionId, {
      event: {
        contentStart: {
          promptName: session.promptName,
          contentName: contentId,
          interactive: false,
          type: "TOOL",
          role: "TOOL",
          toolResultInputConfiguration: {
            toolUseId: toolUseId,
            type: "TEXT",
            textInputConfiguration: {
              mediaType: "text/plain",
            },
          },
        },
      },
    });

    // Tool content input
    const resultContent =
      typeof result === "string" ? result : JSON.stringify(result);
    this.queueInputEvent(sessionId, {
      event: {
        toolResult: {
          promptName: session.promptName,
          contentName: contentId,
          content: resultContent,
        },
      },
    });

    // Tool content end
    this.queueInputEvent(sessionId, {
      event: {
        contentEnd: {
          promptName: session.promptName,
          contentName: contentId,
        },
      },
    });

    console.log(`Tool result sent for session ${sessionId}`);
  }

  public async sendContentEnd(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session || !session.isAudioContentStartSent) return;

    this.queueInputEvent(sessionId, {
      event: {
        contentEnd: {
          promptName: session.promptName,
          contentName: session.audioContentId,
        },
      },
    });

    // Wait to ensure it's processed
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  public async sendPromptEnd(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session || !session.isPromptStartSent) return;

    this.queueInputEvent(sessionId, {
      event: {
        promptEnd: {
          promptName: session.promptName,
        },
      },
    });

    // Wait to ensure it's processed
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  public async sendSessionEnd(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    this.queueInputEvent(sessionId, {
      event: {
        sessionEnd: {},
      },
    });

    // Wait to ensure it's processed
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Now it's safe to clean up
    session.isActive = false;
    session.closeSignal.next();
    session.closeSignal.complete();
    this.activeSessions.delete(sessionId);
    this.sessionLastActivity.delete(sessionId);
    console.log(`Session ${sessionId} closed and removed from active sessions`);
  }

  // Register an event handler for a session
  public registerEventHandler<T extends EventHandlerTypes>(
    sessionId: string,
    eventType: T,
    handler: (data: EventHandlerTypeToPayload[T]) => void
  ): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    session.responseHandlers.set(eventType, handler);
  }

  // Dispatch an event to registered handlers
  private dispatchEvent<T extends EventHandlerTypes>(
    sessionId: string,
    eventType: T,
    data: EventHandlerTypeToPayload[T]
  ): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const handler = session.responseHandlers.get(eventType);
    if (handler) {
      try {
        handler(data);
      } catch (e) {
        console.error(
          `Error in ${eventType} handler for session ${sessionId}:`,
          e
        );
      }
    }

    // Also dispatch to "any" handlers
    const anyHandler = session.responseHandlers.get("any");
    if (anyHandler) {
      try {
        anyHandler({ type: eventType, data });
      } catch (e) {
        console.error(`Error in 'any' handler for session ${sessionId}:`, e);
      }
    }
  }

  public async closeSession(sessionId: string): Promise<void> {
    if (this.sessionCleanupInProgress.has(sessionId)) {
      console.log(
        `Cleanup already in progress for session ${sessionId}, skipping`
      );
      return;
    }
    this.sessionCleanupInProgress.add(sessionId);
    try {
      console.log(`Starting close process for session ${sessionId}`);
      await this.sendContentEnd(sessionId);
      await this.sendPromptEnd(sessionId);
      await this.sendSessionEnd(sessionId);
      console.log(`Session ${sessionId} cleanup complete`);
    } catch (error) {
      console.error(
        `Error during closing sequence for session ${sessionId}:`,
        error
      );

      // Ensure cleanup happens even if there's an error
      const session = this.activeSessions.get(sessionId);
      if (session) {
        session.isActive = false;
        this.activeSessions.delete(sessionId);
        this.sessionLastActivity.delete(sessionId);
      }
    } finally {
      // Always clean up the tracking set
      this.sessionCleanupInProgress.delete(sessionId);
    }
  }

  // Same for forceCloseSession:
  public forceCloseSession(sessionId: string): void {
    if (
      this.sessionCleanupInProgress.has(sessionId) ||
      !this.activeSessions.has(sessionId)
    ) {
      console.log(
        `Session ${sessionId} already being cleaned up or not active`
      );
      return;
    }

    this.sessionCleanupInProgress.add(sessionId);
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) return;

      console.log(`Force closing session ${sessionId}`);

      // Immediately mark as inactive and clean up resources
      session.isActive = false;
      session.closeSignal.next();
      session.closeSignal.complete();
      this.activeSessions.delete(sessionId);
      this.sessionLastActivity.delete(sessionId);

      console.log(`Session ${sessionId} force closed`);
    } finally {
      this.sessionCleanupInProgress.delete(sessionId);
    }
  }
}
