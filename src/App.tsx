import React, { useEffect, useState } from 'react';
import { useStore } from './store/useStore';
import { motion, AnimatePresence } from 'motion/react';
import { PanelLeft } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { SettingsModal } from './components/SettingsModal';
import { Toaster } from 'sonner';
import { formatModelName, sortModels } from './lib/utils';

export default function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { autoSync, models, setModels, theme, isSidebarOpen, setSidebarOpen } = useStore();


  useEffect(() => {
    // Re-format and re-sort cached models
    if (models && models.length > 0) {
      // Just re-save them sorted to catch any old cached models
      const formattedModels = models.map(m => ({
        ...m,
        displayName: formatModelName(m.name, m.displayName || m.name)
      }));
      const sorted = sortModels(formattedModels);
      // Only set if they changed order or names (simple check to avoid infinite loop)
      const isDifferent = sorted.some((m, i) => m.name !== models[i]?.name || m.displayName !== models[i]?.displayName);
      if (isDifferent) {
        setModels(sorted);
      }
    }
    
    if (autoSync) {
      // Auto-sync free models on load
      const syncModels = async () => {
        try {
          const res = await fetch('https://openrouter.ai/api/v1/models');
          if (res.ok) {
            const data = await res.json();
            const freeModels = data.data.filter((model: any) => 
              model.pricing.prompt === "0" && model.pricing.completion === "0"
            ).map((model: any) => {
              const displayName = formatModelName(model.id, model.name);
              return {
                name: model.id,
                displayName,
                available: true
              };
            });
            setModels(sortModels(freeModels));
          }
        } catch (e) {
          console.error("Auto-sync failed", e);
        }
      };
      syncModels();
    }
  }, [autoSync, setModels, models]);

  return (
    <div className={`flex h-screen w-full overflow-hidden font-sans ${theme === 'dark' ? 'bg-[#050505] text-[#e5e7eb]' : 'bg-white text-gray-900'}`}>
      
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 sm:hidden"
          />
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {isSidebarOpen && (
          <motion.div
            initial={{ x: -280, width: 0 }}
            animate={{ x: 0, width: 280 }}
            exit={{ x: -280, width: 0 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
            className="fixed sm:relative z-50 h-full flex-shrink-0"
          >
            <Sidebar onOpenSettings={() => setIsSettingsOpen(true)} />
          </motion.div>
        )}
      </AnimatePresence>

      <main className={`flex-1 flex flex-col h-full z-10 relative min-w-0 ${theme === 'dark' ? 'bg-[#050505]' : 'bg-white'}`}>
        <ChatArea onOpenSidebar={() => setSidebarOpen(true)} />
      </main>

      {isSettingsOpen && (
        <SettingsModal onClose={() => setIsSettingsOpen(false)} />
      )}
      <Toaster theme={theme === 'dark' ? 'dark' : 'light'} position="top-center" richColors />
    </div>
  );
}
