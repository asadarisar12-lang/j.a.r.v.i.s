export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

export interface MessageLog {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  timestamp: Date;
}

export interface WeatherData {
  temperature: number;
  condition: string;
  location: string;
}

// Minimal definition for the visualizer
export interface VisualizerState {
  volume: number; // 0 to 1
  isSpeaking: boolean;
}

export interface VirtualApp {
  id: string;
  name: 'notepad' | 'weather' | 'system';
  title: string;
  content?: string;
  isOpen: boolean;
}