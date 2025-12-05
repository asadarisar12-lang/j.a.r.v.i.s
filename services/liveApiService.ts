import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from "@google/genai";
import { createPcmBlob, decodeAudioData, decodeBase64ToBytes } from "../utils/audioUtils";
import { ConnectionState, MessageLog } from "../types";

// Tool Definition for Weather
const getWeatherDeclaration: FunctionDeclaration = {
  name: 'getWeather',
  parameters: {
    type: Type.OBJECT,
    description: 'Get the current weather for a specific location.',
    properties: {
      location: {
        type: Type.STRING,
        description: 'The city and state, e.g. San Francisco, CA',
      },
    },
    required: ['location'],
  },
};

const getSystemStatusDeclaration: FunctionDeclaration = {
  name: 'getSystemStatus',
  parameters: {
    type: Type.OBJECT,
    description: 'Get the current system status of the Jarvis interface.',
    properties: {},
  },
};

const searchPublicDataDeclaration: FunctionDeclaration = {
  name: 'searchPublicData',
  parameters: {
    type: Type.OBJECT,
    description: 'Search public databases for real-time information, definitions, or general knowledge.',
    properties: {
      query: {
        type: Type.STRING,
        description: 'The search query.',
      },
    },
    required: ['query'],
  },
};

const getNewsHeadlinesDeclaration: FunctionDeclaration = {
  name: 'getNewsHeadlines',
  parameters: {
    type: Type.OBJECT,
    description: 'Get the latest news headlines.',
    properties: {
      category: {
        type: Type.STRING,
        description: 'Category of news (e.g., Technology, World, Business).',
      },
    },
    required: ['category'],
  },
};

const openAppDeclaration: FunctionDeclaration = {
  name: 'openApp',
  parameters: {
    type: Type.OBJECT,
    description: 'Open a virtual application in the HUD (Notepad, etc).',
    properties: {
      appName: {
        type: Type.STRING,
        description: 'The name of the app to open. Supported: "notepad".',
      },
      content: {
        type: Type.STRING,
        description: 'Optional initial text content to write into the app (e.g. for notepad).',
      },
    },
    required: ['appName'],
  },
};

export class LiveApiService {
  private ai: GoogleGenAI;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private outputNode: GainNode | null = null;
  private sessionPromise: Promise<any> | null = null;
  private nextStartTime = 0;
  private activeSources = new Set<AudioBufferSourceNode>();
  private onStateChange: (state: ConnectionState) => void;
  private onLog: (log: MessageLog) => void;
  private onVolumeChange: (vol: number) => void;
  private onOpenApp: (appName: string, content?: string) => void;
  
  constructor(
    apiKey: string,
    onStateChange: (state: ConnectionState) => void,
    onLog: (log: MessageLog) => void,
    onVolumeChange: (vol: number) => void,
    onOpenApp: (appName: string, content?: string) => void
  ) {
    this.ai = new GoogleGenAI({ apiKey });
    this.onStateChange = onStateChange;
    this.onLog = onLog;
    this.onVolumeChange = onVolumeChange;
    this.onOpenApp = onOpenApp;
  }

  async connect(language: 'english' | 'urdu' | 'hindi' = 'english') {
    this.onStateChange(ConnectionState.CONNECTING);
    try {
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      this.outputNode = this.outputAudioContext.createGain();
      this.outputNode.connect(this.outputAudioContext.destination);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      let languageInstruction = "";
      switch (language) {
        case 'urdu':
          languageInstruction = "PRIMARY LANGUAGE: URDU. You must speak mostly in Urdu. Use English only for technical terms if needed.";
          break;
        case 'hindi':
          languageInstruction = "PRIMARY LANGUAGE: HINDI. You must speak mostly in Hindi. Use English for technical terms if needed.";
          break;
        case 'english':
        default:
          languageInstruction = "PRIMARY LANGUAGE: ENGLISH. You are fluent in Urdu and Hindi but default to English unless spoken to in those languages.";
          break;
      }

      this.sessionPromise = this.ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: this.handleOpen.bind(this, stream),
          onmessage: this.handleMessage.bind(this),
          onclose: this.handleClose.bind(this),
          onerror: this.handleError.bind(this),
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } } 
          },
          systemInstruction: `You are J.A.R.V.I.S., a highly advanced AI system. Your owner is Asad. 
          
          CORE DIRECTIVES:
          1. **Identity**: You are Jarvis. Cool, sophisticated, British-accented, witty, and helpful.
          2. **Language Mode**: ${languageInstruction}
          3. **Capabilities**: You can check weather, system status, search data, and **open virtual apps** (like Notepad) on the HUD.
          4. **App Control**: If the user says "Open Notepad" or "Write [text]", call the \`openApp\` tool with 'notepad' and the content.
          
          BEHAVIOR:
          - Keep responses concise (voice-optimized).
          - Do not say "I am opening the app", just do it and say "Done" or "Here it is".
          - Always remain in character.
          `,
          tools: [{ functionDeclarations: [getWeatherDeclaration, getSystemStatusDeclaration, searchPublicDataDeclaration, getNewsHeadlinesDeclaration, openAppDeclaration] }],
          inputAudioTranscription: {}, 
        },
      });

    } catch (error) {
      console.error("Connection failed", error);
      this.onStateChange(ConnectionState.ERROR);
    }
  }

  private handleOpen(stream: MediaStream) {
    this.onStateChange(ConnectionState.CONNECTED);
    this.onLog({ id: Date.now().toString(), role: 'system', text: 'Secure connection established. Welcome back, Asad.', timestamp: new Date() });

    if (!this.inputAudioContext) return;

    this.inputSource = this.inputAudioContext.createMediaStreamSource(stream);
    this.scriptProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

    this.scriptProcessor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      
      // Calculate volume for visualizer
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sum / inputData.length);
      this.onVolumeChange(rms * 5); // Boost for visibility

      const pcmBlob = createPcmBlob(inputData);
      
      this.sessionPromise?.then((session) => {
        session.sendRealtimeInput({ media: pcmBlob });
      });
    };

    this.inputSource.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.inputAudioContext.destination);
  }

  private async handleMessage(message: LiveServerMessage) {
    // Handle Text Transcription (Output - Model thoughts/speech text)
    if (message.serverContent?.modelTurn?.parts) {
        const textParts = message.serverContent.modelTurn.parts.filter(p => p.text);
        if (textParts.length > 0) {
           textParts.forEach(p => {
               if (p.text) {
                 this.onLog({ id: Date.now().toString(), role: 'model', text: p.text, timestamp: new Date() });
               }
           });
        }
    }

    // Handle Input Transcription (User speech)
    if (message.serverContent?.turnComplete && message.serverContent?.inputTranscription?.text) {
         this.onLog({ id: Date.now().toString(), role: 'user', text: message.serverContent.inputTranscription.text, timestamp: new Date() });
    }

    // Handle Audio
    const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (base64Audio && this.outputAudioContext && this.outputNode) {
        // Update visualizer for output
        this.onVolumeChange(0.5); // Mock volume for output since we don't analyze the buffer immediately

        this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
        
        const audioBytes = decodeBase64ToBytes(base64Audio);
        const audioBuffer = await decodeAudioData(
            audioBytes, 
            this.outputAudioContext, 
            24000, 
            1
        );

        const source = this.outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.outputNode);
        source.addEventListener('ended', () => {
            this.activeSources.delete(source);
            this.onVolumeChange(0);
        });
        
        source.start(this.nextStartTime);
        this.nextStartTime += audioBuffer.duration;
        this.activeSources.add(source);
    }

    // Handle Interruption
    if (message.serverContent?.interrupted) {
        this.stopAllAudio();
        this.onLog({ id: Date.now().toString(), role: 'system', text: 'Output interrupted.', timestamp: new Date() });
    }

    // Handle Function Calling
    if (message.toolCall) {
        for (const fc of message.toolCall.functionCalls) {
            this.onLog({ id: Date.now().toString(), role: 'system', text: `Executing: ${fc.name}`, timestamp: new Date() });
            
            let result: any = { error: "Unknown tool" };
            const args: any = fc.args;

            if (fc.name === 'getWeather') {
                result = {
                    temperature: 72,
                    unit: "Fahrenheit",
                    condition: "Clear skies",
                    humidity: "45%",
                    location: args.location || "Current Location",
                    note: "Conditions are optimal, Sir."
                };
            } else if (fc.name === 'getSystemStatus') {
                result = {
                    cpu: "12%",
                    memory: "4.2GB / 16GB",
                    network: "Secure - Encrypted (256-bit)",
                    integrity: "100%",
                    power: "Stable"
                };
            } else if (fc.name === 'searchPublicData') {
                result = {
                  query: args.query,
                  status: "Found",
                  summary: `Search complete for '${args.query}'. Data retrieved.`,
                };
            } else if (fc.name === 'getNewsHeadlines') {
                result = {
                  category: args.category,
                  headlines: [
                    "Global tech markets show 5% increase.",
                    "New AI advancements released by Google.",
                    "SpaceX successfully lands Starship."
                  ]
                };
            } else if (fc.name === 'openApp') {
                const appName = args.appName || 'notepad';
                const content = args.content || '';
                this.onOpenApp(appName, content);
                result = { status: "opened", app: appName };
            }

            this.sessionPromise?.then((session) => {
                session.sendToolResponse({
                    functionResponses: {
                        id: fc.id,
                        name: fc.name,
                        response: { result }
                    }
                });
            });
        }
    }
  }

  private handleClose() {
    this.onStateChange(ConnectionState.DISCONNECTED);
    this.onLog({ id: Date.now().toString(), role: 'system', text: 'System disengaged.', timestamp: new Date() });
  }

  private handleError(e: ErrorEvent) {
    console.error(e);
    this.onStateChange(ConnectionState.ERROR);
    this.onLog({ id: Date.now().toString(), role: 'system', text: 'Critical System Failure.', timestamp: new Date() });
  }

  private stopAllAudio() {
    this.activeSources.forEach(source => {
        try { source.stop(); } catch (e) { /* ignore */ }
    });
    this.activeSources.clear();
    this.nextStartTime = 0;
  }

  disconnect() {
    this.stopAllAudio();
    if (this.scriptProcessor) {
        this.scriptProcessor.disconnect();
        this.scriptProcessor = null;
    }
    if (this.inputSource) {
        this.inputSource.disconnect();
        this.inputSource = null;
    }
    if (this.inputAudioContext) {
        this.inputAudioContext.close();
        this.inputAudioContext = null;
    }
    if (this.outputAudioContext) {
        this.outputAudioContext.close();
        this.outputAudioContext = null;
    }
    
    this.onStateChange(ConnectionState.DISCONNECTED);
  }
}