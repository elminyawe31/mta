import React, { useState, useRef, useEffect } from 'react';
import { useStore, Message } from '../store/useStore';
import { Send, Bot, User, AlertCircle, ChevronDown, Check, ImageIcon, X, PanelLeft, Shield, FileText } from 'lucide-react';
import { cn } from '../lib/utils';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { toast } from 'sonner';

export function ChatArea({ onOpenSidebar }: { onOpenSidebar?: () => void }) {
  const { models, selectedModel, setSelectedModel, sessions, currentSessionId, addMessage, updateLastMessage, theme, isSidebarOpen } = useStore();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFileText, setSelectedFileText] = useState<{name: string, text: string} | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentSession = sessions.find(s => s.id === currentSessionId);
  const messages = currentSession?.messages || [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
        setIsVisionDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFileSelect = (file: File) => {
    if (file.type.startsWith('image/')) {
      setIsUploading(true);
      setUploadProgress(0);
      const reader = new FileReader();
      reader.onprogress = (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
        setSelectedFileText(null); // Clear text file if an image is selected
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      setIsUploading(true);
      setUploadProgress(0);
      const reader = new FileReader();
      reader.onprogress = (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      reader.onloadend = () => {
        setSelectedFileText({ name: file.name, text: reader.result as string });
        setSelectedImage(null); // Clear image if a text file is selected
        setIsUploading(false);
      };
      reader.readAsText(file);
    } else {
      toast.error("Unsupported file type. Please upload images or .txt files.");
    }
  };

  const handleInputFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
      e.target.value = '';
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile();
        if (file) {
          handleFileSelect(file);
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !selectedImage && !selectedFileText) || !selectedModel || !currentSessionId || isLoading) return;

    if (input.trim() === 'Add-yaso') {
      useStore.getState().setAdminVisible(true);
      setInput('');
      toast("Admin panel access granted.", {
        icon: <Shield className="text-yellow-500 w-5 h-5 mr-1" />,
        style: {
          backgroundColor: '#3f3f46', // elegant dark grey
          color: '#eab308', // gold/yellow text
          border: '1px solid #eab308',
          fontSize: '15px',
          fontWeight: 500,
        }
      });
      return;
    }

    const limit = useStore.getState().modelLimits[selectedModel!];
    const usage = useStore.getState().modelUsage[selectedModel!];
    const today = new Date().toISOString().split('T')[0];

    if (limit !== null && limit !== undefined && usage?.date === today && usage.count >= limit) {
      toast.error(`Limit reached for ${selectedModel}. You have sent ${usage.count} of ${limit} allowed messages today.`);
      return;
    }

    let finalPrompt: any = input.trim();
    if (selectedFileText) {
       finalPrompt += finalPrompt ? `\n\n` : ``;
       finalPrompt += `--- [File Attachment: ${selectedFileText.name}] ---\n${selectedFileText.text}`;
    }

    // Pass image directly in the message
    let messageContent: any = finalPrompt;
    if (selectedImage) {
      messageContent = [
        { type: 'text', text: finalPrompt || 'Analyze this image.' },
        { type: 'image_url', image_url: { url: selectedImage } }
      ];
    }

    let displayContent = input;
    if (selectedFileText && !input) {
      displayContent = `(Sent file: ${selectedFileText.name})`;
    } else if (selectedImage && !input) {
      displayContent = "(Sent an image)";
    }

    const userMsg: Message = { role: 'user', content: displayContent, apiContent: messageContent };
    
    addMessage(currentSessionId, userMsg);
    setInput('');
    setSelectedImage(null);
    setSelectedFileText(null);
    setIsLoading(true);

    const botMsg: Message = { role: 'assistant', content: '' };
    addMessage(currentSessionId, botMsg);
    
    useStore.getState().incrementModelUsage(selectedModel!);

    try {
      const state = useStore.getState();
      const { geminiApiKey, geminiApiKeys, openRouterApiKey, selectedVisionModel, defaultVisionModel } = state;
      let activeGeminiKey = geminiApiKey || '';
      
      if (selectedModel?.includes('gemini') || selectedVisionModel?.includes('gemini') || defaultVisionModel.includes('gemini')) {
         const today = new Date().toISOString().split('T')[0];
         let availableKeys = geminiApiKeys.map(k => k.date !== today ? { ...k, usageCount: 0, date: today } : k);
         availableKeys = availableKeys.filter(k => k.usageCount < k.limit);
         if (availableKeys.length > 0) {
           availableKeys.sort((a, b) => a.usageCount - b.usageCount);
           activeGeminiKey = availableKeys[0].key;
           state.updateGeminiApiKeyUsage(activeGeminiKey);
         }
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-gemini-api-key': activeGeminiKey,
          'x-openrouter-api-key': openRouterApiKey || ''
        },
        body: JSON.stringify({
          model: selectedModel,
          visionModel: selectedVisionModel || defaultVisionModel || 'google/gemini-2.5-flash',
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.apiContent || m.content })),
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error('API Request Failed');
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;
      let streamedResponse = '';

      let buffer = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('data: ') && trimmedLine !== 'data: [DONE]') {
              try {
                const data = JSON.parse(trimmedLine.slice(6));
                if (data.choices[0].delta.content) {
                  streamedResponse += data.choices[0].delta.content;
                  updateLastMessage(currentSessionId, streamedResponse);
                }
              } catch (e) {
                console.error("Error parsing stream chunk", e, "Line:", trimmedLine);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
      updateLastMessage(currentSessionId, "Error: Failed to get response from server.");
    } finally {
      setIsLoading(false);
    }
  };

  const hasModels = models.length > 0;

  const visionModelsList = [
      { name: 'google/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' },
      ...models.filter(m => m.name.includes('vision') || m.name.includes('ocr') || m.name.includes('gemini') || m.name.includes('gpt-4o') || m.name.includes('claude-3'))
  ];
  const uniqueVisionModels = Array.from(new Map(visionModelsList.map(item => [item.name, item])).values());
  const { selectedVisionModel, setSelectedVisionModel, defaultVisionModel } = useStore();
  const [isVisionDropdownOpen, setIsVisionDropdownOpen] = useState(false);

  const currentLimit = selectedModel ? useStore.getState().modelLimits[selectedModel] : null;
  const currentUsage = selectedModel ? useStore.getState().modelUsage[selectedModel] : null;
  const todayStr = new Date().toISOString().split('T')[0];
  const isLimitReached = Boolean(selectedModel && currentLimit !== null && currentLimit !== undefined && currentUsage?.date === todayStr && currentUsage.count >= currentLimit);

  return (
    <div className="flex flex-col h-full relative">
      <header className="h-[72px] flex items-center px-4 sm:px-6 justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          {!isSidebarOpen && (
            <button 
              onClick={onOpenSidebar}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                theme === 'dark' ? "text-[#a1a1aa] hover:bg-[#18181b] hover:text-white" : "text-gray-500 hover:bg-gray-200 hover:text-gray-900"
              )}
            >
              <PanelLeft size={20} />
            </button>
          )}
          <div>
            <h1 className={cn("text-[16px] font-medium m-0 tracking-tight", theme === 'dark' ? "text-white" : "text-gray-900")}>{currentSession?.topic || 'New Chat'}</h1>
            <p className={cn("text-[12px] m-0 mt-0.5", theme === 'dark' ? "text-[#71717a]" : "text-gray-500")}>this was made by ELMINYAWE enjoy</p>
          </div>
        </div>
        
        {hasModels ? (
          <div ref={dropdownRef} className="flex items-center gap-2">
            
            {/* Vision Model Dropdown */}
            <div className="relative z-50">
              <button 
                onClick={() => {
                  setIsVisionDropdownOpen(!isVisionDropdownOpen);
                  setIsModelDropdownOpen(false);
                }} 
                className={cn(
                  "flex items-center gap-2 font-medium text-[13px] px-3 py-1.5 rounded-lg border transition-all max-w-[200px] overflow-hidden",
                  theme === 'dark' ? "text-[#e5e7eb] border-[#3f3f46]" : "text-gray-700 border-gray-300",
                  isVisionDropdownOpen ? (theme === 'dark' ? "bg-[#27272a]" : "bg-gray-200") : (theme === 'dark' ? "hover:bg-[#18181b]" : "hover:bg-gray-100")
                )}
                title="Select Vision Model"
              >
                <ImageIcon size={14} className={cn("shrink-0", theme === 'dark' ? "text-[#a1a1aa]" : "text-gray-500")} />
                <span className="truncate">
                  {uniqueVisionModels.find(m => m.name === (selectedVisionModel || defaultVisionModel))?.displayName || (selectedVisionModel || defaultVisionModel)}
                </span>
                <ChevronDown size={14} className={cn("shrink-0 transition-transform duration-200", theme === 'dark' ? "text-[#a1a1aa]" : "text-gray-500", isVisionDropdownOpen && "rotate-180")} />
              </button>
              
              {isVisionDropdownOpen && (
                <div className={cn(
                  "absolute right-0 top-[calc(100%+8px)] w-[280px] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[60vh] animate-in fade-in zoom-in-95 duration-150 origin-top-right border",
                  theme === 'dark' ? "bg-[#1e1e1e] border-[#3f3f46]/80" : "bg-white border-gray-200"
                )}>
                  <div className={cn("px-4 py-3 border-b shrink-0 backdrop-blur-sm", theme === 'dark' ? "border-[#3f3f46]/50 bg-[#1e1e1e]/95" : "border-gray-100 bg-white/95")}>
                    <h3 className={cn("text-[13px] font-semibold tracking-wide flex items-center gap-2", theme === 'dark' ? "text-white" : "text-gray-900")}>
                      <ImageIcon size={14} /> Image Model
                    </h3>
                  </div>
                  <div className="overflow-y-auto p-2 space-y-1 custom-scrollbar">
                    {uniqueVisionModels.map(m => (
                      <button 
                        key={m.name} 
                        onClick={() => { setSelectedVisionModel(m.name); setIsVisionDropdownOpen(false); }}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition-all duration-200",
                          (selectedVisionModel || defaultVisionModel) === m.name 
                            ? (theme === 'dark' ? "bg-[#27272a] shadow-sm" : "bg-gray-100 shadow-sm")
                            : (theme === 'dark' ? "hover:bg-[#27272a]/60 active:scale-[0.98]" : "hover:bg-gray-50 active:scale-[0.98]")
                        )}
                      >
                        <span className={cn("text-[13px] font-medium", theme === 'dark' ? "text-white" : "text-gray-900")}>{m.displayName}</span>
                        {(selectedVisionModel || defaultVisionModel) === m.name && <Check size={14} className={theme === 'dark' ? "text-white flex-shrink-0" : "text-black flex-shrink-0"} />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Main Model Dropdown */}
            <div className="relative z-50">
              <button 
                onClick={() => {
                  setIsModelDropdownOpen(!isModelDropdownOpen);
                  setIsVisionDropdownOpen(false);
                }} 
                className={cn(
                  "flex items-center gap-2 font-medium text-[15px] px-4 py-2 rounded-xl transition-all max-w-[250px] overflow-hidden",
                  theme === 'dark' ? "text-[#e5e7eb]" : "text-gray-800",
                  isModelDropdownOpen ? (theme === 'dark' ? "bg-[#27272a]" : "bg-gray-200") : (theme === 'dark' ? "hover:bg-[#18181b]" : "hover:bg-gray-100")
                )}
              >
                <span className="truncate">
                  {models.find(m => m.name === selectedModel)?.displayName || selectedModel}
                </span>
                <ChevronDown size={14} className={cn("shrink-0 transition-transform duration-200", theme === 'dark' ? "text-[#a1a1aa]" : "text-gray-500", isModelDropdownOpen && "rotate-180")} />
              </button>
              
              {isModelDropdownOpen && (
                <div className={cn(
                  "absolute right-0 top-[calc(100%+8px)] w-[320px] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[60vh] animate-in fade-in zoom-in-95 duration-150 origin-top-right border",
                theme === 'dark' ? "bg-[#1e1e1e] border-[#3f3f46]/80" : "bg-white border-gray-200"
              )}>
                <div className={cn("px-5 py-4 border-b shrink-0 backdrop-blur-sm", theme === 'dark' ? "border-[#3f3f46]/50 bg-[#1e1e1e]/95" : "border-gray-100 bg-white/95")}>
                  <h3 className={cn("text-[13px] font-semibold tracking-wide", theme === 'dark' ? "text-white" : "text-gray-900")}>Model</h3>
                </div>
                <div className="overflow-y-auto p-2 space-y-1 custom-scrollbar">
                  {models.map(m => (
                    <button 
                      key={m.name} 
                      onClick={() => { setSelectedModel(m.name); setIsModelDropdownOpen(false); }}
                      className={cn(
                        "w-full text-left px-4 py-3 rounded-xl flex items-center justify-between transition-all duration-200",
                        selectedModel === m.name 
                          ? (theme === 'dark' ? "bg-[#27272a] shadow-sm" : "bg-gray-100 shadow-sm")
                          : (theme === 'dark' ? "hover:bg-[#27272a]/60 active:scale-[0.98]" : "hover:bg-gray-50 active:scale-[0.98]")
                      )}
                    >
                      <div className="flex flex-col pr-4">
                        <span className={cn("text-[14px] font-medium", theme === 'dark' ? "text-white" : "text-gray-900")}>{m.displayName}</span>
                      </div>
                      {selectedModel === m.name && <Check size={16} className={theme === 'dark' ? "text-white flex-shrink-0" : "text-black flex-shrink-0"} />}
                    </button>
                  ))}
                </div>
              </div>
            )}
            </div>
          </div>
        ) : (
          <div className="flex items-center space-x-1 text-[11px] text-red-500 font-medium px-2 py-1 uppercase tracking-[0.5px]">
            <AlertCircle size={12} />
            <span>No models synced</span>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 sm:px-8 custom-scrollbar">
        <div className="max-w-[800px] mx-auto space-y-8 pb-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <div className={cn("p-4 rounded-xl mb-4", theme === 'dark' ? "bg-[#18181b] text-[#3b82f6]" : "bg-blue-50 text-blue-500")}>
                <Bot size={32} />
              </div>
              <h2 className={cn("text-xl font-medium mb-2", theme === 'dark' ? "text-white" : "text-gray-900")}>How can I help you today?</h2>
              <p className={cn("max-w-sm text-sm", theme === 'dark' ? "text-[#a1a1aa]" : "text-gray-500")}>Sync free ELMINYAWE models in the settings to start chatting.</p>
            </div>
          ) : (
            <div className="space-y-8 pb-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className="flex flex-row items-start space-x-4 max-w-[800px] mx-auto"
                >
                  <div className={cn(
                    "flex-shrink-0 w-8 h-8 rounded shrink-0 flex items-center justify-center mt-0.5",
                    msg.role === 'user' 
                      ? (theme === 'dark' ? "bg-[#3f3f46] text-[#a1a1aa]" : "bg-gray-200 text-gray-500")
                      : "bg-[#1d4ed8] text-white"
                  )}>
                    {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                  </div>
                  <div className={cn("flex-1 text-[15px] leading-[1.6]", theme === 'dark' ? "text-[#d1d5db]" : "text-gray-800")}>
                    <div className={cn("prose prose-sm sm:prose-base max-w-none", theme === 'dark' ? "prose-invert" : "prose-gray")}>
                      {msg.role === 'assistant' ? (
                        <Markdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            code({ className, children, ...props }) {
                              const match = /language-(\w+)/.exec(className || '');
                              const isBlock = match || String(children).includes('\n');
                              const language = match ? match[1] : 'text';
                              const codeString = String(children).replace(/\n$/, '');

                              return isBlock ? (
                                <div className="relative group my-4">
                                  <div className="flex items-center justify-between bg-zinc-800 text-zinc-300 text-xs px-4 py-1.5 rounded-t-md border border-zinc-700 border-b-0">
                                    <span>{language}</span>
                                    <button
                                      onClick={() => navigator.clipboard.writeText(codeString)}
                                      className="hover:opacity-100 opacity-70 transition-opacity"
                                      title="Copy code"
                                    >
                                      Copy
                                    </button>
                                  </div>
                                  <SyntaxHighlighter
                                    className="!m-0 !rounded-t-none rounded-b-md !bg-[#1e1e1e] text-sm border border-zinc-700"
                                    style={vscDarkPlus}
                                    language={language}
                                    PreTag="div"
                                    {...(props as any)}
                                  >
                                    {codeString}
                                  </SyntaxHighlighter>
                                </div>
                              ) : (
                                <code {...props} className={cn(theme === 'dark' ? "bg-zinc-800 text-zinc-200" : "bg-gray-200 text-gray-800", "rounded px-1.5 py-0.5 font-mono text-sm", className)}>
                                  {children}
                                </code>
                              );
                            },
                            table({ children, ...props }) {
                              return (
                                <div className="overflow-x-auto my-4 rounded-lg border border-gray-300 dark:border-zinc-700">
                                  <table {...props} className="min-w-full divide-y divide-gray-300 dark:divide-zinc-700 m-0">
                                    {children}
                                  </table>
                                </div>
                              );
                            },
                            th({ children, ...props }) {
                              return <th {...props} className="px-4 py-2 bg-gray-100 dark:bg-zinc-800 font-semibold text-left">{children}</th>;
                            },
                            td({ children, ...props }) {
                              return <td {...props} className="px-4 py-2 border-t border-gray-200 dark:border-zinc-700">{children}</td>;
                            }
                          }}
                        >
                          {msg.content || (isLoading && i === messages.length - 1 ? "..." : "")}
                        </Markdown>
                      ) : (
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div ref={messagesEndRef} className="h-4" />
        </div>
      </div>

      <div className="px-4 sm:px-6 pb-6 pt-4 flex-shrink-0 relative">
        <div className="max-w-[800px] mx-auto relative">
          
          {selectedImage && (
            <div className="mb-2 relative inline-block">
              <img src={selectedImage} alt="Selected" className={cn("h-16 w-16 object-cover rounded-xl border", theme === 'dark' ? "border-[#3f3f46]" : "border-gray-300")} />
              <button 
                onClick={() => setSelectedImage(null)}
                className="absolute -top-2 -right-2 bg-gray-800 hover:bg-gray-700 text-white p-1 rounded-full text-xs shadow"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {selectedFileText && (
            <div className="mb-2 relative inline-flex flex-col gap-2 p-3 rounded-xl border bg-[#f4f4f5] dark:bg-[#27272a] dark:border-[#3f3f46] text-sm max-w-[300px]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 overflow-hidden">
                  <FileText size={16} className="text-blue-500 shrink-0" />
                  <span className="truncate font-medium text-[13px]" title={selectedFileText.name}>{selectedFileText.name}</span>
                </div>
                <button 
                  onClick={() => setSelectedFileText(null)}
                  className="hover:bg-black/10 dark:hover:bg-white/10 p-1.5 rounded-full text-xs transition-colors shrink-0"
                  type="button"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-3 break-words bg-white dark:bg-[#1e1e1e] p-2 rounded-lg border border-gray-200 dark:border-[#3f3f46] shadow-inner">
                {selectedFileText.text.length > 150 ? selectedFileText.text.substring(0, 150) + '...' : selectedFileText.text || "Empty file"}
              </div>
            </div>
          )}

          {isUploading && (
            <div className="mb-2 max-w-[200px]">
              <div className="h-1.5 w-full bg-gray-200 dark:bg-[#3f3f46] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-200" 
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <div className="text-[10px] text-gray-500 dark:text-[#a1a1aa] mt-1 pr-1 text-right">
                Uploading... {uploadProgress}%
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className={cn(
            "backdrop-blur-xl border rounded-[24px] p-2 flex items-center gap-2 transition-all duration-300 group",
            theme === 'dark'
             ? "bg-[#18181b]/95 border-[#27272a] shadow-[0_0_40px_rgba(0,0,0,0.5)] hover:border-[#3f3f46] focus-within:border-[#52525b] focus-within:bg-[#18181b] focus-within:shadow-[0_0_40px_rgba(0,0,0,0.7)]"
             : "bg-white/95 border-gray-200 shadow-md hover:border-gray-300 focus-within:border-gray-400 focus-within:bg-white focus-within:shadow-lg"
          )}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || isLimitReached || isUploading}
              className={cn(
                "w-[42px] h-[42px] flex items-center justify-center rounded-[18px] transition-colors ml-1 shrink-0",
                theme === 'dark' 
                  ? "text-[#a1a1aa] hover:text-white hover:bg-[#27272a]" 
                  : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              )}
            >
              <ImageIcon size={20} />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleInputFileChange} 
              accept="image/*,.txt" 
              className="hidden" 
            />

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={handlePaste}
              placeholder={isLimitReached ? "Daily limit reached for this model." : (isUploading ? "Uploading file..." : "Type a message or paste a file (Ctrl+V)...")}
              disabled={!hasModels || isLoading || isLimitReached || isUploading}
              className={cn(
                "flex-1 bg-transparent border-none pl-2 pr-2 py-3.5 text-[15px] focus:outline-none focus:ring-0 disabled:opacity-50",
                theme === 'dark' ? "text-[#e5e7eb] placeholder-[#71717a]" : "text-gray-900 placeholder-gray-400"
              )}
            />
            <button
              type="submit"
              disabled={(!input.trim() && !selectedImage && !selectedFileText) || !hasModels || isLoading || isLimitReached || isUploading}
              className={cn(
                "w-[42px] h-[42px] flex items-center justify-center rounded-[18px] transition-all duration-200 shrink-0 mr-1 shadow-sm",
                theme === 'dark'
                  ? "bg-white text-black hover:bg-[#e5e7eb] disabled:bg-[#1e1e1e] disabled:text-[#52525b] group-focus-within:disabled:bg-[#27272a]"
                  : "bg-gray-900 text-white hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 group-focus-within:disabled:bg-gray-100"
              )}
            >
              <Send size={18} className={cn((input.trim() || selectedImage || selectedFileText) && !isLoading ? "ml-0.5" : "")} />
            </button>
          </form>
          <div className={cn("text-center mt-3 text-[11px]", theme === 'dark' ? "text-[#52525b]" : "text-gray-400")}>
            Powered by ELMINYAWE Ai models. AI can make mistakes. {currentLimit !== null && currentLimit !== undefined ? `| Daily text limit usage: ${currentUsage?.date === todayStr ? currentUsage.count : 0}/${currentLimit}` : ''}
          </div>
        </div>
      </div>
    </div>
  );
}
