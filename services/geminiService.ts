
import { GoogleGenAI, Modality, Type } from "@google/genai";

/**
 * Encodes Uint8Array to base64 string
 */
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decodes base64 string to Uint8Array
 */
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decodes PCM audio data from the API format (raw bytes) into an AudioBuffer
 */
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const generateStoryFromMedia = async (base64Data: string, mimeType: string, language: string = 'English'): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const mediaType = mimeType.startsWith('video') ? 'video' : 'image';
  
  const prompt = `Analyze the mood, lighting, characters, and environment of this ${mediaType}. 
  Ghostwrite a single, compelling opening paragraph for a literary story set in this world. 
  Write the story in ${language}. 
  If Hindi, use poetic and literary Hindi (Devanagari script). 
  Focus on sensory details and establishing a unique atmosphere. Do not provide commentary, just the paragraph.`;

  const mediaPart = {
    inlineData: {
      mimeType: mimeType,
      data: base64Data.split(',')[1],
    },
  };

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: { parts: [mediaPart, { text: prompt }] },
    config: {
      temperature: 1.0,
    }
  });

  return response.text || "Failed to generate story.";
};

export const generateStorySuggestions = async (base64Data: string | null, mimeType: string | null, paragraph: string, language: string = 'English') => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `Based on the provided ${mimeType?.startsWith('video') ? 'video' : 'image'} and the following opening paragraph: "${paragraph}", 
  generate 3 diverse creative suggestions to continue the story. 
  Each suggestion should be short (1-2 sentences) and labeled as either 'plot', 'character', or 'setting'.
  Write the suggestions in ${language}.
  Return the output as a valid JSON array of objects with "type" and "text" fields.`;

  const parts: any[] = [{ text: prompt }];
  if (base64Data && mimeType) {
    parts.unshift({
      inlineData: {
        mimeType: mimeType,
        data: base64Data.split(',')[1],
      },
    });
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, description: "Must be 'plot', 'character', or 'setting'" },
            text: { type: Type.STRING }
          },
          required: ["type", "text"]
        }
      }
    }
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    return [];
  }
};

export const chatWithStoryAssistant = async (
  history: { role: string; parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] }[],
  message: string,
  base64Data: string | null,
  mimeType: string | null
) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const contents: { role: string; parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] }[] = [...history];
  
  if (base64Data && mimeType) {
    const mediaPart = {
      inlineData: {
        mimeType: mimeType,
        data: base64Data.split(',')[1],
      },
    };
    contents.push({ role: 'user', parts: [mediaPart, { text: message }] });
  } else {
    contents.push({ role: 'user', parts: [{ text: message }] });
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: contents,
    config: {
      systemInstruction: "You are a creative writing assistant. Help the user expand, refine, or critique their story based on the image/video and opening paragraph. Be encouraging and evocative in your feedback.",
    }
  });

  return response.text || "I'm sorry, I couldn't process that.";
};

export const narrateText = async (text: string): Promise<Uint8Array> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Narrate the following story excerpt with deep emotion and atmospheric weight: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("No audio data received");
  
  return decode(base64Audio);
};
