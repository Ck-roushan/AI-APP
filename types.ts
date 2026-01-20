
export interface Message {
  role: 'user' | 'model';
  text: string;
}

export type AppLanguage = 'English' | 'Hindi';

export interface StorySuggestion {
  type: 'plot' | 'character' | 'setting';
  text: string;
}

export interface StoryState {
  image: string | null; // This will hold the base64 data/URL
  mediaMimeType: string | null;
  paragraph: string;
  title: string;
  isAnalyzing: boolean;
  isReading: boolean;
  language: AppLanguage;
  suggestions: StorySuggestion[];
  isGeneratingSuggestions: boolean;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
}
