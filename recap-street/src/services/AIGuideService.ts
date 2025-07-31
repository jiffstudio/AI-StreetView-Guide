export interface StreetViewAnalysis {
  nextDirection: {
    panoId: string;
    heading: number;
    reason: string;
  };
  sceneDescription: string;
  detectedText: string[];
  landmarks: string[];
  voiceResponse: string;
}

export interface AIGuideConfig {
  agoraAppId?: string;
  tenAgentUrl?: string;
  voiceEnabled?: boolean;
  autoExplore?: boolean;
  personality?: 'friendly' | 'professional' | 'enthusiastic';
}

export class AIGuideService {
  private config: AIGuideConfig;


  constructor(config: AIGuideConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      console.log('AI Guide Service initialized successfully (simple mode)');
    } catch (error) {
      console.error('Failed to initialize AI Guide Service:', error);
      throw error;
    }
  }

  async analyzeStreetView(
    currentImage: string,
    availableOptions: Array<{
      panoId: string;
      heading: number;
      description: string;
      previewImage: string;
    }>,
    visitedHistory: string[] = []
  ): Promise<StreetViewAnalysis> {
    try {
      console.log('Sending request to simple server...');
      
      const response = await fetch('http://localhost:8080/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: currentImage,
          options: availableOptions,
          visitedHistory: visitedHistory,
          personality: this.config.personality || 'friendly'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('AI analysis result:', result);
      
      return result;
    } catch (error) {
      console.error('AI analysis failed:', error);
      throw error;
    }
  }

  async sendVoiceMessage(_audioBlob: Blob): Promise<void> {
    console.log('Voice message received (simple mode)');
  }

  async destroy(): Promise<void> {
    console.log('AI Guide Service destroyed');
  }
}