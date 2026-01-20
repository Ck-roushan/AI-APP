
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { generateStoryFromMedia, narrateText, decodeAudioData, generateStorySuggestions } from './services/geminiService';
import { StoryState, AppLanguage, StorySuggestion } from './types';
import ChatBot from './components/ChatBot';

const App: React.FC = () => {
  const [state, setState] = useState<StoryState>({
    image: null,
    mediaMimeType: null,
    paragraph: '',
    title: '',
    isAnalyzing: false,
    isReading: false,
    language: 'English',
    suggestions: [],
    isGeneratingSuggestions: false,
  });
  
  const [activeTab, setActiveTab] = useState<'chat' | 'sparks'>('chat');
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle media pasting
  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1 || items[i].type.indexOf('video') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          const mimeType = items[i].type;
          reader.onload = (event) => {
            setState(prev => ({ 
              ...prev, 
              image: event.target?.result as string,
              mediaMimeType: mimeType,
              paragraph: '',
              title: '',
              suggestions: [],
            }));
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      const mimeType = file.type;
      reader.onloadend = () => {
        setState(prev => ({ 
          ...prev, 
          image: reader.result as string,
          mediaMimeType: mimeType,
          paragraph: '',
          title: '',
          suggestions: [],
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!state.image || !state.mediaMimeType) return;
    
    setState(prev => ({ ...prev, isAnalyzing: true, paragraph: '', suggestions: [] }));
    try {
      const paragraph = await generateStoryFromMedia(state.image, state.mediaMimeType, state.language);
      setState(prev => ({ ...prev, paragraph, isAnalyzing: false }));
    } catch (error) {
      console.error(error);
      setState(prev => ({ ...prev, isAnalyzing: false, paragraph: "The ink has run dry... Please try again." }));
    }
  };

  const handleGetSuggestions = async () => {
    if (!state.paragraph || state.isGeneratingSuggestions) return;
    
    setState(prev => ({ ...prev, isGeneratingSuggestions: true }));
    try {
      const suggestions = await generateStorySuggestions(state.image, state.mediaMimeType, state.paragraph, state.language);
      setState(prev => ({ ...prev, suggestions, isGeneratingSuggestions: false }));
      setActiveTab('sparks');
    } catch (error) {
      console.error(error);
      setState(prev => ({ ...prev, isGeneratingSuggestions: false }));
    }
  };

  const handleLanguageChange = (lang: AppLanguage) => {
    setState(prev => ({ ...prev, language: lang }));
  };

  const handleSave = () => {
    if (!state.paragraph) return;
    const element = document.createElement("a");
    const content = `${state.title || 'Untitled Story'}\n\n${state.paragraph}`;
    const file = new Blob([content], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = state.title 
      ? `${state.title.toLowerCase().replace(/\s+/g, '-')}-${state.language}.txt`
      : `story-ai-${state.language}-${timestamp}.txt`;
    element.download = fileName;
    document.body.appendChild(element); 
    element.click();
    document.body.removeChild(element);
  };

  const handleReadAloud = async () => {
    if (!state.paragraph || state.isReading) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }

    setState(prev => ({ ...prev, isReading: true }));
    try {
      const textToRead = state.title ? `${state.title}. ${state.paragraph}` : state.paragraph;
      const audioBytes = await narrateText(textToRead);
      const audioBuffer = await decodeAudioData(audioBytes, audioContextRef.current, 24000, 1);
      
      if (audioSourceRef.current) {
        audioSourceRef.current.stop();
      }

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => setState(prev => ({ ...prev, isReading: false }));
      source.start();
      audioSourceRef.current = source;
    } catch (error) {
      console.error(error);
      setState(prev => ({ ...prev, isReading: false }));
    }
  };

  const isVideo = state.mediaMimeType?.startsWith('video');

  return (
    <div className="min-h-screen text-slate-200 p-4 md:p-8 flex flex-col items-center">
      {/* Header */}
      <header className="max-w-6xl w-full mb-12 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-serif font-light text-white tracking-tight uppercase">Story AI</h1>
          <p className="text-slate-400 mt-2 font-light tracking-wide">Where pixels bleed into prose.</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-sm rounded-lg border border-slate-700 transition-all flex items-center gap-2 group"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 group-hover:translate-y-[-1px] transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload Muse
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleMediaUpload} 
            accept="image/*,video/*" 
            className="hidden" 
          />
        </div>
      </header>

      <main className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-20">
        
        {/* Left Column: Image Area & Controls */}
        <div className="lg:col-span-4 space-y-6">
          <div className="relative group aspect-[4/5] bg-slate-800/30 rounded-2xl border-2 border-dashed border-slate-700 overflow-hidden flex items-center justify-center transition-all hover:border-indigo-500/50 cursor-pointer"
               onClick={() => !state.image && fileInputRef.current?.click()}>
            {state.image ? (
              <>
                {isVideo ? (
                  <video 
                    src={state.image} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                    autoPlay 
                    loop 
                    muted 
                    playsInline
                  />
                ) : (
                  <img src={state.image} alt="Story Prompt" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                   <p className="text-white text-xs font-medium bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">Paste to Replace</p>
                </div>
              </>
            ) : (
              <div className="text-center p-8 space-y-4">
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-slate-400 text-sm font-medium">Upload or Paste Image/Video</p>
                  <p className="text-slate-500 text-[10px] mt-1 uppercase tracking-widest">Ctrl+V anywhere to start</p>
                </div>
              </div>
            )}
          </div>

          {/* Language Selector */}
          <div className="bg-slate-800/50 p-1.5 rounded-xl border border-slate-700 flex">
            <button 
              onClick={() => handleLanguageChange('English')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${state.language === 'English' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
            >
              ENGLISH
            </button>
            <button 
              onClick={() => handleLanguageChange('Hindi')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${state.language === 'Hindi' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
            >
              HINDI (हिंदी)
            </button>
          </div>
          
          <div className="space-y-3">
            <button
              onClick={handleAnalyze}
              disabled={!state.image || state.isAnalyzing}
              className={`w-full py-4 rounded-xl font-medium tracking-widest text-sm uppercase transition-all shadow-xl
                ${!state.image || state.isAnalyzing 
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' 
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white hover:scale-[1.02] active:scale-95 border border-indigo-400/30'
                }`}
            >
              {state.isAnalyzing ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Analyzing Soul...
                </span>
              ) : state.paragraph ? "Regenerate Opening" : "Ghostwrite Opening"}
            </button>

            {state.paragraph && (
              <button
                onClick={handleGetSuggestions}
                disabled={state.isGeneratingSuggestions}
                className="w-full py-3 rounded-xl font-medium tracking-widest text-xs uppercase transition-all border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 flex items-center justify-center gap-2"
              >
                {state.isGeneratingSuggestions ? (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                )}
                Creative Sparks
              </button>
            )}
          </div>
        </div>

        {/* Center Column: Story Output */}
        <div className="lg:col-span-5 flex flex-col h-full min-h-[500px]">
          <div className="flex-1 bg-slate-900/40 rounded-3xl p-8 md:p-12 shadow-inner border border-white/5 relative flex flex-col">
            <div className="absolute top-0 right-0 p-6 flex gap-3 z-10">
              {/* Save Story Button */}
              {state.paragraph && (
                <button 
                  onClick={handleSave}
                  className="p-3 rounded-full transition-all border bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:border-slate-500"
                  title="Save Story"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                </button>
              )}

              {/* Regenerate Icon Button */}
              {state.paragraph && (
                <button 
                  onClick={handleAnalyze}
                  disabled={state.isAnalyzing}
                  className={`p-3 rounded-full transition-all border bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:border-slate-500 ${state.isAnalyzing ? 'animate-spin opacity-50' : ''}`}
                  title="Regenerate"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357-2H15" />
                  </svg>
                </button>
              )}
              
              <button 
                onClick={handleReadAloud}
                disabled={!state.paragraph || state.isReading}
                className={`p-3 rounded-full transition-all border ${
                  state.isReading 
                    ? 'bg-indigo-500 text-white animate-pulse border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.5)]' 
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:border-slate-500'
                }`}
                title="Read Aloud"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col flex-1">
              {/* Title Input */}
              <input
                type="text"
                placeholder={state.language === 'English' ? 'Enter a title...' : 'एक शीर्षक दर्ज करें...'}
                value={state.title}
                onChange={(e) => setState(prev => ({ ...prev, title: e.target.value }))}
                className="bg-transparent border-none text-3xl md:text-4xl font-serif text-white focus:ring-0 placeholder-slate-700 mb-2 p-0 w-full"
              />
              
              <div className="font-serif italic text-slate-500 mb-8 select-none">
                {state.language === 'English' ? 'Chapter I' : 'प्रथम अध्याय'}
              </div>
              
              {state.paragraph ? (
                <p className={`text-xl md:text-2xl font-serif text-slate-100 leading-relaxed first-letter:text-5xl first-letter:font-bold first-letter:mr-3 first-letter:float-left first-letter:text-indigo-400 first-letter:mt-1 animate-in fade-in slide-in-from-bottom-4 duration-1000 ${state.language === 'Hindi' ? 'text-justify' : ''}`}>
                  {state.paragraph}
                </p>
              ) : state.isAnalyzing ? (
                <div className="flex-1 flex flex-col items-center justify-center space-y-4 opacity-50">
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce"></div>
                    <div className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                    <div className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                  </div>
                  <p className="font-serif italic text-lg">
                    {state.language === 'English' ? 'Drawing ink from shadows...' : 'छायाओं से स्याही खींच रहे हैं...'}
                  </p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center space-y-6 text-center">
                  <p className="text-slate-500 font-serif italic text-lg max-w-xs">
                    {state.language === 'English' 
                      ? '"The scariest moment is always just before you start."' 
                      : '"सबसे डरावना क्षण हमेशा शुरू करने से ठीक पहले का होता है।"'}
                  </p>
                  <div className="w-16 h-[1px] bg-slate-800"></div>
                  <p className="text-slate-600 text-sm tracking-widest uppercase text-center">
                     {state.language === 'English' 
                      ? 'Select a muse to breathe life into the void.' 
                      : 'शून्य में प्राण फूंकने के लिए एक चित्र या वीडियो चुनें।'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Interaction Hub */}
        <div className="lg:col-span-3 h-full flex flex-col gap-4">
          <div className="bg-slate-800/40 p-1 rounded-xl border border-slate-700 flex text-[10px] font-bold tracking-widest uppercase">
            <button 
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-2 rounded-lg transition-all ${activeTab === 'chat' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Assistant
            </button>
            <button 
              onClick={() => setActiveTab('sparks')}
              className={`flex-1 py-2 rounded-lg transition-all ${activeTab === 'sparks' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Sparks
            </button>
          </div>

          <div className="flex-1 min-h-[450px]">
            {activeTab === 'chat' ? (
              <ChatBot media={state.image} mimeType={state.mediaMimeType} storyContext={state.paragraph} />
            ) : (
              <div className="h-full bg-slate-900/50 rounded-xl border border-slate-700/50 backdrop-blur-sm shadow-2xl overflow-hidden flex flex-col p-4">
                <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Creative Sparks
                </h3>
                
                <div className="space-y-4 overflow-y-auto">
                  {state.suggestions.length > 0 ? (
                    state.suggestions.map((suggestion, idx) => (
                      <div 
                        key={idx} 
                        className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/50 hover:border-emerald-500/30 transition-all group cursor-default shadow-lg"
                      >
                        <span className={`text-[10px] font-bold uppercase tracking-tighter px-2 py-0.5 rounded-full mb-2 inline-block ${
                          suggestion.type === 'plot' ? 'bg-indigo-500/20 text-indigo-400' :
                          suggestion.type === 'character' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          {suggestion.type}
                        </span>
                        <p className="text-sm text-slate-300 leading-relaxed font-light italic">
                          "{suggestion.text}"
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-40">
                      <div className="w-12 h-12 rounded-full border border-dashed border-slate-600 flex items-center justify-center mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <p className="text-xs uppercase tracking-widest">No sparks yet.</p>
                      <p className="text-[10px] mt-2">Generate a story first, then click "Creative Sparks".</p>
                    </div>
                  )}
                </div>

                {state.suggestions.length > 0 && (
                  <button 
                    onClick={handleGetSuggestions}
                    disabled={state.isGeneratingSuggestions}
                    className="mt-4 w-full py-2 text-[10px] uppercase font-bold tracking-widest text-slate-500 hover:text-emerald-400 transition-colors"
                  >
                    {state.isGeneratingSuggestions ? 'Igniting...' : 'Get New Sparks'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="w-full max-w-6xl border-t border-slate-800 pt-8 pb-12 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-500 text-xs tracking-widest uppercase">
        <p>&copy; 2024 Story AI Studio &bull; Powered by Gemini</p>
        <div className="flex gap-8">
          <a href="#" className="hover:text-indigo-400 transition-colors">Documentation</a>
          <a href="#" className="hover:text-indigo-400 transition-colors">Privacy</a>
          <a href="#" className="hover:text-indigo-400 transition-colors">Manifesto</a>
        </div>
      </footer>
    </div>
  );
};

export default App;
