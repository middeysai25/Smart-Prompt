import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Chat {
  id: string;
  title: string;
  created_at: string;
}

interface ChatSidebarProps {
  isOpen: boolean;
  currentChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  userId: string;
}

const ChatSidebar = ({ isOpen, currentChatId, onSelectChat, onNewChat, userId }: ChatSidebarProps) => {
  const [chats, setChats] = useState<Chat[]>([]);

  useEffect(() => {
    if (userId) {
      fetchChats();
    }
  }, [userId]);

  const fetchChats = async () => {
    try {
      const { data, error } = await supabase
        .from('chats')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setChats(data || []);
    } catch (error: any) {
      toast.error("Failed to load chats");
      console.error(error);
    }
  };

  return (
    <aside 
      className={`${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0 fixed md:relative z-40 h-full w-64 bg-card border-r border-border transition-transform duration-300`}
    >
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-border">
          <Button 
            onClick={onNewChat}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Chat
          </Button>
        </div>

        <ScrollArea className="flex-1 p-2">
          <div className="space-y-1">
            {chats.map((chat) => (
              <Button
                key={chat.id}
                variant={currentChatId === chat.id ? "secondary" : "ghost"}
                className="w-full justify-start text-left"
                onClick={() => onSelectChat(chat.id)}
              >
                <MessageSquare className="mr-2 h-4 w-4 flex-shrink-0" />
                <span className="truncate">{chat.title}</span>
              </Button>
            ))}
          </div>
        </ScrollArea>
      </div>
    </aside>
  );
};

export default ChatSidebar;