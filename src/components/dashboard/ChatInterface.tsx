import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BookOpen,
  Code,
  Copy,
  FileText,
  Image as ImageIcon,
  ListChecks,
  Loader2,
  Mic,
  Send,
  Share2,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  image_url?: string;
}

interface ChatInterfaceProps {
  userName: string;
  currentChatId: string | null;
  onChatCreated: (chatId: string) => void;
  userId: string;
}

const ChatInterface = (
  { userName, currentChatId, onChatCreated, userId }: ChatInterfaceProps,
) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (currentChatId) {
      fetchMessages(currentChatId);
    } else {
      setMessages([]);
    }
  }, [currentChatId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchMessages = async (chatId: string) => {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages((data || []) as Message[]);
    } catch (error: any) {
      toast.error("Failed to load messages");
      console.error(error);
    }
  };

  const createNewChat = async (firstMessage: string) => {
    try {
      const { data, error } = await supabase
        .from("chats")
        .insert({
          user_id: userId,
          title: firstMessage.slice(0, 50) +
            (firstMessage.length > 50 ? "..." : ""),
        })
        .select()
        .single();

      if (error) throw error;
      return data.id;
    } catch (error: any) {
      toast.error("Failed to create chat");
      throw error;
    }
  };

  const saveMessage = async (
    chatId: string,
    role: "user" | "assistant",
    content: string,
    imageUrl?: string,
  ) => {
    try {
      const { data, error } = await supabase
        .from("messages")
        .insert({
          chat_id: chatId,
          role,
          content,
        })
        .select()
        .single();

      if (error) throw error;
      // Attach image for UI only; DB doesn't have image_url column
      return { ...(data as any), image_url: imageUrl } as Message;
    } catch (error: any) {
      toast.error("Failed to save message");
      throw error;
    }
  };

  const startVoiceRecording = async () => {
    if (
      !("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)
    ) {
      toast.error("Voice input not supported in this browser");
      return;
    }

    try {
      const SpeechRecognition = (window as any).webkitSpeechRecognition ||
        (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsRecording(true);
        toast.success("Listening... Speak now");
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput((prev) => prev + (prev ? " " : "") + transcript);
        toast.success("Voice input captured");
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        if (
          event.error === "not-allowed" || event.error === "service-not-allowed"
        ) {
          toast.error("Please allow microphone access in browser settings");
        } else if (event.error === "no-speech") {
          toast.error("No speech detected. Try again.");
        } else if (event.error === "audio-capture") {
          toast.error("No microphone found.");
        } else {
          toast.error(`Voice error: ${event.error}`);
        }
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (error: any) {
      console.error("Voice recognition failed:", error);
      toast.error("Failed to start voice recognition");
      setIsRecording(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image too large. Max 5MB allowed");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result as string);
      toast.success("Image selected successfully");
    };
    reader.onerror = () => {
      toast.error("Failed to read image");
    };
    reader.readAsDataURL(file);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const shareMessage = (text: string) => {
    if (navigator.share) {
      navigator.share({ text });
    } else {
      copyToClipboard(text);
    }
  };

  const regenerateWithFormat = async (
    messageContent: string,
    format: string,
  ) => {
    if (!currentChatId || loading) return;

    setLoading(true);
    try {
      const conversationHistory = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const formatPrompt =
        `Format the following content as ${format}:\n\n${messageContent}`;

      const { data: aiResponse, error: aiError } = await supabase.functions
        .invoke("optimize-prompt", {
          body: {
            userPrompt: formatPrompt,
            conversationHistory,
          },
        });

      if (aiError) throw aiError;

      const aiMsg = await saveMessage(
        currentChatId,
        "assistant",
        aiResponse.optimizedPrompt,
      );
      setMessages((prev) => [...prev, aiMsg as Message]);
    } catch (error: any) {
      toast.error(error.message || "Failed to regenerate");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !selectedImage) || loading) return;

    const userMessage = input.trim();
    setInput("");
    setLoading(true);

    try {
      // Create chat if doesn't exist
      let chatId = currentChatId;
      if (!chatId) {
        chatId = await createNewChat(userMessage || "Image analysis");
        onChatCreated(chatId);
      }

      // Save current image reference before clearing
      const imageToAnalyze = selectedImage;

      // Save user message with optional image
      const userMsg = await saveMessage(
        chatId,
        "user",
        userMessage,
        imageToAnalyze || undefined,
      );
      setMessages((prev) => [...prev, userMsg as Message]);
      setSelectedImage(null);

      // Get conversation history
      const conversationHistory = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Call AI to optimize prompt
      const { data: aiResponse, error: aiError } = await supabase.functions
        .invoke("optimize-prompt", {
          body: {
            userPrompt: userMessage,
            conversationHistory,
            imageData: imageToAnalyze,
          },
        });

      if (aiError) throw aiError;

      // Save AI response
      const aiMsg = await saveMessage(
        chatId,
        "assistant",
        aiResponse.optimizedPrompt,
      );
      setMessages((prev) => [...prev, aiMsg as Message]);
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.message || "Failed to process message");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Welcome Message */}
      {!currentChatId && messages.length === 0 && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-2xl">
            <div className="mb-6">
              <Sparkles className="w-16 h-16 mx-auto text-primary animate-pulse" />
            </div>
            <h2 className="text-3xl font-bold mb-4">
              Welcome to Smart Prompt, {userName}!
            </h2>
            <p className="text-muted-foreground text-lg">
              I'm here to help you optimize your prompts for maximum
              effectiveness. Share your ideas, and I'll transform them into
              clear, actionable prompts.
            </p>
          </div>
        </div>
      )}

      {/* Messages */}
      {messages.length > 0 && (
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="max-w-4xl mx-auto space-y-4">
            {messages.map((message) => (
              <div key={message.id} className="space-y-2">
                <div
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-card border border-border"
                    }`}
                  >
                    {message.image_url && (
                      <img
                        src={message.image_url}
                        alt="Uploaded"
                        className="max-w-full rounded-lg mb-2"
                      />
                    )}
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>

                {message.role === "assistant" && (
                  <div className="flex gap-2 justify-start">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(message.content)}
                      className="h-8"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        shareMessage(message.content)}
                      className="h-8"
                    >
                      <Share2 className="h-3 w-3 mr-1" />
                      Share
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        regenerateWithFormat(message.content, "notes")}
                      className="h-8"
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      Notes
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        regenerateWithFormat(message.content, "MCQs")}
                      className="h-8"
                    >
                      <ListChecks className="h-3 w-3 mr-1" />
                      MCQs
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        regenerateWithFormat(message.content, "summary")}
                      className="h-8"
                    >
                      <BookOpen className="h-3 w-3 mr-1" />
                      Summary
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        regenerateWithFormat(message.content, "code examples")}
                      className="h-8"
                    >
                      <Code className="h-3 w-3 mr-1" />
                      Code
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Input Area */}
      <div className="border-t border-border bg-card/50 backdrop-blur-lg p-4">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          {selectedImage && (
            <div className="mb-3 relative inline-block">
              <img
                src={selectedImage}
                alt="Selected"
                className="max-h-32 rounded-lg"
              />
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="absolute top-1 right-1"
                onClick={() => setSelectedImage(null)}
              >
                ×
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              title="Upload Image"
            >
              <ImageIcon className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={startVoiceRecording}
              disabled={loading || isRecording}
              className={isRecording
                ? "bg-red-500 hover:bg-red-600 text-white"
                : ""}
              title="Voice Input"
            >
              <Mic className="h-5 w-5" />
            </Button>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter your prompt here..."
              className="min-h-[60px] max-h-[200px] resize-none bg-input/50 border-border focus:border-primary"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <Button
              type="submit"
              disabled={loading || (!input.trim() && !selectedImage)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              size="icon"
            >
              {loading
                ? <Loader2 className="h-5 w-5 animate-spin" />
                : <Send className="h-5 w-5" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Press Enter to send, Shift+Enter for new line
          </p>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;
