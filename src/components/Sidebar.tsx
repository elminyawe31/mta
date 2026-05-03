import React from 'react';
import { useStore } from '../store/useStore';
import { MessageSquare, Settings, Plus, Trash2, Bot, PanelLeftClose } from 'lucide-react';
import { cn } from '../lib/utils';

interface SidebarProps {
  onOpenSettings: () => void;
}

export function Sidebar({ onOpenSettings }: SidebarProps) {
  const { sessions, currentSessionId, setCurrentSession, addSession, deleteSession, theme, setSidebarOpen } = useStore();

  return (
    <div className={cn(
      "w-[280px] h-full flex flex-col border-r flex-shrink-0 p-5",
      theme === 'dark' ? "bg-[#0c0c0c] border-[#27272a]" : "bg-[#f8f9fa] border-gray-200"
    )}>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <div className="bg-[#3b82f6] w-6 h-6 rounded-[4px] flex items-center justify-center text-white">
            <Bot size={16} />
          </div>
          <h1 className={cn(
            "font-serif italic text-[20px] tracking-[1px] m-0",
            theme === 'dark' ? "text-white" : "text-gray-900"
          )}>ElMINYAWE Chat</h1>
        </div>
        <button 
          onClick={() => setSidebarOpen(false)}
          className={cn(
            "p-1.5 rounded-lg transition-colors hidden sm:block",
            theme === 'dark' ? "text-[#a1a1aa] hover:bg-[#18181b] hover:text-white" : "text-gray-500 hover:bg-gray-200 hover:text-gray-900"
          )}
        >
          <PanelLeftClose size={20} />
        </button>
      </div>

      <div className="mb-6">
        <button
          onClick={addSession}
          className={cn(
            "w-full border py-3 text-center rounded-lg text-[14px] transition-colors cursor-default",
            theme === 'dark' 
              ? "bg-[#18181b] border-[#3f3f46] text-[#d4d4d8] hover:border-[#52525b]" 
              : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 shadow-sm"
          )}
        >
          + New Conversation
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1">
        {sessions.map((session) => (
          <div
            key={session.id}
            onClick={() => setCurrentSession(session.id)}
            className={cn(
              "group flex items-center justify-between px-3 py-2.5 rounded-md cursor-pointer transition-colors text-[14px]",
              currentSessionId === session.id 
                ? (theme === 'dark' ? "bg-[#18181b] text-white" : "bg-gray-200 text-gray-900")
                : (theme === 'dark' ? "hover:bg-[#18181b]/50 text-[#a1a1aa]" : "hover:bg-gray-100 text-gray-600")
            )}
          >
            <div className="flex items-center space-x-2 overflow-hidden">
              <span className="truncate">{session.topic}</span>
            </div>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteSession(session.id);
              }}
              className={cn(
                "opacity-0 group-hover:opacity-100 p-1 rounded transition-all",
                theme === 'dark' 
                  ? "hover:bg-[#27272a] text-[#71717a] hover:text-red-400" 
                  : "hover:bg-gray-300 text-gray-400 hover:text-red-500"
              )}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className={cn(
        "mt-auto pt-4 border-t",
        theme === 'dark' ? "border-[#27272a]" : "border-gray-200"
      )}>
        <button
          onClick={onOpenSettings}
          className={cn(
             "w-full flex items-center space-x-3 py-2 rounded-lg transition-colors",
             theme === 'dark' 
              ? "hover:bg-[#18181b] text-[#71717a] hover:text-[#d4d4d8]"
              : "hover:bg-gray-200 text-gray-600 hover:text-gray-900"
          )}
        >
          <Settings size={16} />
          <span className="font-medium text-[13px]">Settings</span>
        </button>
        <div className="text-[10px] text-[#52525b] mt-4 ml-1">V 1.0.2 • Powered by ELMINYAWE Ai models</div>
      </div>
    </div>
  );
}
