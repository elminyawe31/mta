import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { X, RefreshCw, Settings, ShieldAlert, ChevronDown, Check, Shield } from 'lucide-react';
import { cn, formatModelName, sortModels } from '../lib/utils';
import { toast } from 'sonner';

interface SettingsModalProps {
  onClose: () => void;
}

function CustomSelect({ value, onChange, options, theme, placeholder, className }: { value: string | null, onChange: (val: string) => void, options: {value: string, label: string}[], theme: string, placeholder?: string, className?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div ref={dropdownRef} className={cn("relative z-20", className)}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)} 
        className={cn(
          "w-full flex items-center justify-between gap-2 font-medium text-[13px] px-3 py-2 rounded-lg transition-all border",
          theme === 'dark' ? "text-[#e5e7eb] border-[#333333]" : "text-gray-800 border-gray-300",
          isOpen ? (theme === 'dark' ? "bg-[#27272a]" : "bg-gray-200") : (theme === 'dark' ? "bg-[#181818] hover:bg-[#27272a]" : "bg-gray-50 hover:bg-gray-100")
        )}
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown size={14} className={cn("transition-transform duration-200 shrink-0", theme === 'dark' ? "text-[#a1a1aa]" : "text-gray-500", isOpen && "rotate-180")} />
      </button>
      
      {isOpen && (
        <div className={cn(
          "absolute left-0 top-[calc(100%+8px)] w-full sm:w-max sm:min-w-[100%] max-w-[320px] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[300px] animate-in fade-in zoom-in-95 duration-150 origin-top border z-50",
          theme === 'dark' ? "bg-[#1e1e1e] border-[#3f3f46]/80" : "bg-white border-gray-200"
        )}>
          <div className="overflow-y-auto overflow-x-hidden p-2 space-y-1 custom-scrollbar">
            {options.length > 0 ? options.map(o => (
              <button 
                key={o.value} 
                onClick={() => { onChange(o.value); setIsOpen(false); }}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-xl flex items-center justify-between transition-all duration-200",
                  value === o.value 
                    ? (theme === 'dark' ? "bg-[#27272a] shadow-sm text-white" : "bg-gray-100 shadow-sm text-gray-900")
                    : (theme === 'dark' ? "hover:bg-[#27272a]/60 active:scale-[0.98] text-gray-300" : "hover:bg-gray-50 active:scale-[0.98] text-gray-700")
                )}
              >
                <div className="truncate pr-4 text-[13px] flex-1 min-w-0 font-medium">{o.label}</div>
                {value === o.value && <Check size={16} className={theme === 'dark' ? "text-white shrink-0" : "text-gray-900 shrink-0"} />}
              </button>
            )) : (
              <div className={cn("px-3 py-2 text-[13px] text-center", theme === 'dark' ? "text-gray-400" : "text-gray-500")}>
                No options
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { autoSync, setAutoSync, models, setModels, theme, setTheme, selectedModel, setSelectedModel, geminiApiKeys, addGeminiApiKey, removeGeminiApiKey, openRouterApiKey, setOpenRouterApiKey, modelLimits, setModelLimit, isAdminVisible } = useStore();
  const [activeTab, setActiveTab] = useState('general');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');
  const [limitModel, setLimitModel] = useState('');
  const [limitValue, setLimitValue] = useState('');
  
  const [newGeminiKey, setNewGeminiKey] = useState('');
  const [newGeminiKeyName, setNewGeminiKeyName] = useState('');
  const [newGeminiKeyLimit, setNewGeminiKeyLimit] = useState('1500');

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncStatus('idle');
    setSyncProgress(0);

    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress > 90) progress = 90;
      setSyncProgress(progress);
    }, 150);

    try {
      const res = await fetch('https://openrouter.ai/api/v1/models');
      if (!res.ok) throw new Error('Failed to fetch models');
      
      const data = await res.json();
      
      clearInterval(progressInterval);
      setSyncProgress(90);

      const freeModels = data.data
        .filter((model: any) => model.pricing.prompt === "0" && model.pricing.completion === "0")
        .map((model: any) => {
          const displayName = formatModelName(model.id, model.name);
          
          return {
            name: model.id,
            displayName,
            available: true
          };
        });
      
      setModels(sortModels(freeModels));
      setSyncStatus('success');
      setSyncMessage(`Synced ${freeModels.length} free models`);
      setSyncProgress(100);
    } catch (error) {
      clearInterval(progressInterval);
      console.error(error);
      setSyncStatus('error');
      setSyncMessage('Failed to sync. Please try again.');
    } finally {
      setTimeout(() => {
        setIsSyncing(false);
        setSyncProgress(0);
      }, 1000);
    }
  };

  const baseTabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'sync', label: 'Models', icon: RefreshCw },
  ];

  const tabs = isAdminVisible 
    ? [...baseTabs, { id: 'admin', label: 'Admin Panel', icon: Shield }]
    : baseTabs;

  const themeOptions = [
    { value: 'dark', label: 'Dark Mode' },
    { value: 'light', label: 'Light Mode' }
  ];

  const modelOptions = models.map(m => ({ value: m.name, label: m.displayName }));

  const handleAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === 'admin') {
      setIsAdminAuthenticated(true);
      setAdminPassword('');
    } else {
      toast.error('Incorrect password.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={cn(
        "flex flex-col sm:flex-row w-full max-w-[800px] h-full max-h-[85vh] sm:h-[600px] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border relative bg-white dark:bg-[#181818]",
        theme === 'dark' ? "bg-[#212121] border-[#333333] text-white" : "bg-[#f9f9f9] border-gray-200 text-gray-900"
      )}>
        <button onClick={onClose} className={cn(
          "absolute right-4 top-4 z-20 p-1.5 rounded-lg transition-colors pointer-events-auto",
          theme === 'dark' ? "hover:bg-[#333333] text-gray-400" : "hover:bg-gray-200 text-gray-500"
        )}>
          <X size={18} />
        </button>

        <div className="flex flex-col sm:flex-row flex-1 overflow-hidden relative w-full">
          
          <div className="absolute top-0 left-0 w-full hidden sm:flex justify-between items-center p-5 z-10 pointer-events-none">
            <h2 className="text-[16px] font-semibold tracking-wide pointer-events-auto">System settings</h2>
          </div>

          <div className="absolute top-0 left-0 w-full flex sm:hidden items-center p-5 pl-4 z-10 pointer-events-none">
            <h2 className="text-[16px] font-semibold tracking-wide pointer-events-auto">System settings</h2>
          </div>

          <div className={cn(
            "w-full sm:w-[220px] flex sm:flex-col pt-14 pb-2 sm:pb-4 px-3 border-b sm:border-y-0 sm:border-r overflow-x-auto sm:overflow-x-visible items-center sm:items-stretch [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shrink-0 z-10",
            theme === 'dark' ? "bg-[#212121] border-[#333333]" : "bg-[#f3f3f3] border-gray-200"
          )}>
            <div className="flex sm:flex-col gap-2 sm:gap-1 min-w-max">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-2 sm:gap-3 px-3 py-2 sm:py-2.5 rounded-lg text-[13px] font-medium transition-colors shrink-0",
                      isActive 
                        ? (theme === 'dark' ? "bg-[#333333] text-white" : "bg-[#e5e5e5] text-gray-900")
                        : (theme === 'dark' ? "text-gray-400 hover:text-gray-200 hover:bg-[#2a2a2a]" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100")
                    )}
                  >
                    <Icon size={16} className={isActive ? "" : "opacity-80"} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={cn(
            "flex-1 flex flex-col pt-4 sm:pt-16 pb-4 sm:pb-0 px-4 sm:px-8 relative",
            theme === 'dark' ? "bg-[#282828]" : "bg-white"
          )}>
            
            <div className="flex-1 overflow-y-auto">
              {activeTab === 'general' && (
                <div className="space-y-6">
                  <h3 className="text-[14px] font-semibold mb-4">General Settings</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between z-20">
                      <span className="text-[13px] font-medium">Appearance</span>
                      <CustomSelect 
                        value={theme}
                        onChange={(val) => setTheme(val as 'dark' | 'light')}
                        options={themeOptions}
                        theme={theme}
                        className="w-[200px]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'sync' && (
                <div className="space-y-6">
                  <h3 className="text-[14px] font-semibold mb-4">Models Configuration</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-medium">Auto-sync models on load</span>
                      <button 
                        onClick={() => setAutoSync(!autoSync)}
                        className="relative inline-block w-[40px] h-[20px] align-middle select-none transition duration-200 ease-in"
                       >
                        <div className={cn("absolute inset-0 rounded-[10px] transition-colors duration-200", autoSync ? "bg-[#3b82f6]" : "bg-gray-400 dark:bg-gray-600")}></div>
                        <div className={cn("absolute top-[2px] w-[16px] h-[16px] rounded-full bg-white transition-all duration-200", autoSync ? "right-[2px]" : "left-[2px]")}></div>
                      </button>
                    </div>

                    <div className="pt-4 border-t border-gray-200 dark:border-[#333333]">
                      <h4 className="text-[13px] font-semibold mb-3">Fetch New Models</h4>
                      {isSyncing && (
                         <div className="w-full bg-gray-200 rounded-full h-1.5 mb-4 dark:bg-gray-700 overflow-hidden">
                           <div 
                             className="bg-blue-600 h-1.5 rounded-full transition-all duration-150 ease-out"
                             style={{ width: `${syncProgress}%` }}
                           ></div>
                         </div>
                      )}
                      <button
                        onClick={handleSync}
                        disabled={isSyncing}
                        className={cn(
                          "w-full p-2.5 rounded-lg text-[13px] font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-70 border",
                          theme === 'dark' 
                            ? "bg-[#333333] border-[#444444] text-white hover:bg-[#444444]" 
                            : "bg-white border-gray-300 text-gray-900 hover:bg-gray-50"
                        )}
                      >
                        <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
                        <span>{isSyncing ? "Syncing..." : "Sync Models"}</span>
                      </button>
                      
                      {syncStatus !== 'idle' && (
                        <div className={cn(
                          "text-[12px] mt-3",
                          syncStatus === 'success' ? "text-green-500" : "text-red-500"
                        )}>
                          {syncStatus === 'success' ? `✓ ${syncMessage}` : `✗ ${syncMessage}`}
                        </div>
                      )}
                      
                      {syncStatus === 'idle' && (
                        <div className={cn(
                          "text-[12px] mt-3 mb-4",
                          theme === 'dark' ? "text-[#71717a]" : "text-gray-500"
                        )}>
                          Current Models: {models.length}
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-[#333333]">
                        <span className="text-[13px] font-medium">Default Model</span>
                        <CustomSelect 
                           value={selectedModel}
                           onChange={(val) => setSelectedModel(val)}
                           options={modelOptions}
                           theme={theme}
                           placeholder="Select default model"
                           className="w-[200px]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'admin' && (
                <div className="space-y-6">
                  <h3 className="text-[14px] font-semibold mb-4">Admin Dashboard</h3>
                  
                  {!isAdminAuthenticated ? (
                    <div className="flex justify-center items-center h-full">
                      <form onSubmit={handleAdminAuth} className="w-full max-w-sm">
                        <div className="mb-4">
                           <p className={cn("text-[13px] mb-4 text-center", theme === 'dark' ? "text-[#a1a1aa]" : "text-gray-500")}>
                             Developer Access Required
                           </p>
                           <input 
                              type="password"
                              placeholder="Enter admin password"
                              value={adminPassword}
                              onChange={(e) => setAdminPassword(e.target.value)}
                              autoFocus
                              className={cn(
                                "w-full text-[13px] rounded-lg px-3 py-2.5 outline-none border focus:ring-2 focus:ring-blue-500",
                                theme === 'dark' ? "bg-[#181818] border-[#333333] text-white" : "bg-gray-50 border-gray-300 text-gray-900"
                              )}
                           />
                        </div>
                        <button
                          type="submit"
                          className={cn(
                            "w-full px-4 py-2.5 rounded-lg text-[13px] font-medium transition-colors",
                            theme === 'dark' ? "bg-[#e5e5e5] text-black hover:bg-white" : "bg-black text-white hover:bg-gray-800"
                          )}
                        >
                          Unlock Panel
                        </button>
                      </form>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <h4 className="text-[13px] font-semibold mb-3">API Keys</h4>
                        
                        <div className="space-y-4">
                          <div>
                            <label className="block text-[13px] font-semibold mb-3">Gemini API Keys</label>
                            
                            <div className="flex flex-col gap-2 mb-4">
                              {geminiApiKeys.map((k) => {
                                 const today = new Date().toISOString().split('T')[0];
                                 const currentUsage = k.date === today ? k.usageCount : 0;
                                 const progressPercent = Math.min((currentUsage / k.limit) * 100, 100);
                                 const isWarning = progressPercent >= 80;
                                 const isDanger = progressPercent >= 100;
                                 
                                 return (
                                  <div key={k.key} className={cn("p-3 rounded-xl border flex flex-col gap-2", theme === 'dark' ? "bg-[#1f1f1f] border-[#333333]" : "bg-white border-gray-200")}>
                                     <div className="flex justify-between items-center">
                                       <div className="flex flex-col">
                                         <span className="text-[13px] font-medium">{k.name}</span>
                                         <span className={cn("text-[11px]", theme === 'dark' ? "text-gray-400" : "text-gray-500")}>
                                           {k.key.substring(0, 12)}...
                                         </span>
                                       </div>
                                       <button 
                                         onClick={() => removeGeminiApiKey(k.key)}
                                         className="p-1.5 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                       >
                                         <X size={14} />
                                       </button>
                                     </div>
                                     <div className="w-full">
                                       <div className="flex justify-between text-[10px] mb-1">
                                          <span className={isDanger ? "text-red-500 font-medium" : (isWarning ? "text-yellow-500 font-medium" : "")}>
                                            {currentUsage} requests today
                                          </span>
                                          <span className={theme === 'dark' ? "text-gray-400" : "text-gray-500"}>Limit: {k.limit}</span>
                                       </div>
                                       <div className={cn("h-1.5 w-full rounded-full overflow-hidden", theme === 'dark' ? "bg-[#333333]" : "bg-gray-200")}>
                                          <div 
                                            className={cn("h-full transition-all duration-300", isDanger ? "bg-red-500" : (isWarning ? "bg-yellow-500" : "bg-blue-500"))}
                                            style={{ width: `${progressPercent}%` }}
                                          />
                                       </div>
                                     </div>
                                  </div>
                                 );
                              })}
                            </div>
                            
                            <div className="flex flex-wrap sm:flex-nowrap gap-2 relative z-30">
                              <input 
                                type="text"
                                placeholder="Key name (e.g. Account 1)"
                                value={newGeminiKeyName}
                                onChange={(e) => setNewGeminiKeyName(e.target.value)}
                                className={cn(
                                  "flex-1 sm:w-auto text-[13px] rounded-lg px-3 py-2 outline-none border focus:ring-2 focus:ring-blue-500",
                                  theme === 'dark' ? "bg-[#181818] border-[#333333] text-white" : "bg-gray-50 border-gray-300 text-gray-900"
                                )}
                              />
                              <input 
                                type="password"
                                placeholder="AIzaSy..."
                                value={newGeminiKey}
                                onChange={(e) => setNewGeminiKey(e.target.value)}
                                className={cn(
                                  "flex-[2_2_0%] sm:w-auto text-[13px] rounded-lg px-3 py-2 outline-none border focus:ring-2 focus:ring-blue-500",
                                  theme === 'dark' ? "bg-[#181818] border-[#333333] text-white" : "bg-gray-50 border-gray-300 text-gray-900"
                                )}
                              />
                              <input 
                                type="number"
                                placeholder="Limit (e.g. 1500)"
                                value={newGeminiKeyLimit}
                                onChange={(e) => setNewGeminiKeyLimit(e.target.value)}
                                className={cn(
                                  "w-[80px] text-[13px] rounded-lg px-2 py-2 outline-none border focus:ring-2 focus:ring-blue-500",
                                  theme === 'dark' ? "bg-[#181818] border-[#333333] text-white" : "bg-gray-50 border-gray-300 text-gray-900"
                                )}
                              />
                              <button
                                disabled={!newGeminiKey || !newGeminiKeyName || !newGeminiKeyLimit}
                                onClick={() => {
                                  addGeminiApiKey({
                                    key: newGeminiKey,
                                    name: newGeminiKeyName,
                                    limit: parseInt(newGeminiKeyLimit, 10),
                                    usageCount: 0,
                                    date: new Date().toISOString().split('T')[0]
                                  });
                                  setNewGeminiKey('');
                                  setNewGeminiKeyName('');
                                }}
                                className={cn(
                                  "px-3 py-2 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50 shrink-0",
                                  theme === 'dark' ? "bg-[#333333] hover:bg-[#444444] text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-900"
                                )}
                              >
                                Add
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[12px] font-medium mb-1">OpenRouter API Key (Fallback)</label>
                            <input 
                              type="password"
                              placeholder="sk-or-v1-..."
                              value={openRouterApiKey}
                              onChange={(e) => setOpenRouterApiKey(e.target.value)}
                              className={cn(
                                "w-full text-[13px] rounded-lg px-3 py-2 outline-none border focus:ring-2 focus:ring-blue-500",
                                theme === 'dark' ? "bg-[#181818] border-[#333333] text-white" : "bg-gray-50 border-gray-300 text-gray-900"
                              )}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="pt-6 border-t border-gray-200 dark:border-[#333333] z-10 relative">
                        <h4 className="text-[13px] font-semibold mb-3">Img OCR Models</h4>
                        <p className={cn("text-[12px] mb-4", theme === 'dark' ? "text-[#a1a1aa]" : "text-gray-500")}>
                          Set the default model to handle image uploads when the user has not specified one.
                        </p>
                        <CustomSelect 
                          value={useStore.getState().defaultVisionModel}
                          onChange={(val) => useStore.getState().setDefaultVisionModel(val)}
                          options={[
                            { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
                            ...models.filter(m => m.name.includes('vision') || m.name.includes('ocr') || m.name.includes('gemini') || m.name.includes('gpt-4o') || m.name.includes('claude-3')).map(m => ({ value: m.name, label: m.displayName }))
                          ]}
                          theme={theme}
                          placeholder="Select default vision model"
                        />
                      </div>

                      <div className="pt-6 border-t border-gray-200 dark:border-[#333333] relative z-0">
                        <h4 className="text-[13px] font-semibold mb-3 flex items-center gap-2"><ShieldAlert size={16} /> Daily Model Limits</h4>
                        <p className={cn("text-[12px] mb-4", theme === 'dark' ? "text-[#a1a1aa]" : "text-gray-500")}>
                          Restrict user access to models on a daily basis.
                        </p>
                        
                        <div className="space-y-4">
                          <div className="flex flex-wrap sm:flex-nowrap gap-3 relative z-30">
                            <CustomSelect 
                              value={limitModel}
                              onChange={(val) => setLimitModel(val)}
                              options={modelOptions}
                              theme={theme}
                              placeholder="Select a model"
                              className="w-full sm:flex-1 min-w-[150px]"
                            />
                            
                            <input 
                              type="number"
                              placeholder="Limit (e.g. 50)"
                              value={limitValue}
                              onChange={(e) => setLimitValue(e.target.value)}
                              className={cn(
                                "flex-1 sm:flex-none sm:w-[120px] text-[13px] rounded-lg px-3 py-2 outline-none border focus:ring-2 focus:ring-blue-500 h-[38px]",
                                theme === 'dark' ? "bg-[#181818] border-[#333333] text-white" : "bg-gray-50 border-gray-300 text-gray-900"
                              )}
                              min="1"
                            />
                            
                            <button
                              disabled={!limitModel || !limitValue}
                              onClick={() => {
                                setModelLimit(limitModel, parseInt(limitValue, 10));
                                setLimitModel('');
                                setLimitValue('');
                              }}
                              className={cn(
                                "px-4 py-2 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50 shrink-0 w-full sm:w-auto h-[38px]",
                                theme === 'dark' ? "bg-[#333333] hover:bg-[#444444] text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-900"
                              )}
                            >
                              Add Rule
                            </button>
                          </div>

                          <div className="pt-4 mt-2">
                            <h5 className="text-[13px] font-medium mb-3">Active Limitations</h5>
                            
                            {Object.keys(modelLimits).length === 0 || Object.values(modelLimits).every(v => v === null) ? (
                              <p className={cn("text-[12px]", theme === 'dark' ? "text-[#71717a]" : "text-gray-500")}>No limits configured.</p>
                            ) : (
                              <div className="space-y-2">
                                {Object.entries(modelLimits).filter(([_, limit]) => limit !== null).map(([modelId, limit]) => {
                                  const modelName = models.find(m => m.name === modelId)?.displayName || modelId;
                                  return (
                                    <div key={modelId} className={cn(
                                      "flex items-center justify-between p-3 rounded-lg border",
                                      theme === 'dark' ? "bg-[#1f1f1f] border-[#333333]" : "bg-white border-gray-200"
                                    )}>
                                      <div className="flex flex-col">
                                        <span className="text-[13px] font-medium">{modelName}</span>
                                        <span className={cn("text-[11px]", theme === 'dark' ? "text-[#a1a1aa]" : "text-gray-500")}>
                                          Limit: {limit} messages per day
                                        </span>
                                      </div>
                                      <button 
                                        onClick={() => setModelLimit(modelId, null)}
                                        className="p-1.5 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-transparent flex justify-end shrink-0 pointer-events-none">
                <button 
                  onClick={onClose}
                  className={cn(
                    "px-6 py-2 rounded-lg text-[13px] font-medium pointer-events-auto transition-colors",
                    theme === 'dark' ? "bg-[#444444] text-white hover:bg-[#555555]" : "bg-[#181818] text-white hover:bg-[#333333]" 
                  )}
                >
                  Save
                </button>
            </div>
            
          </div>

        </div>
      </div>
    </div>
  );
}
