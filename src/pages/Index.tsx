import { useState, useRef, useEffect } from "react";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Brain, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  confidence_level?: string;
  evidence_sources?: { source: string; snippet: string }[];
}

const Index = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const createConversation = async () => {
    const { data, error } = await supabase
      .from("chat_conversations")
      .insert({ title: "New Conversation" })
      .select()
      .single();

    if (error) {
      console.error("Error creating conversation:", error);
      return null;
    }

    return data.id;
  };

  const saveMessage = async (
    convId: string,
    role: string,
    content: string,
    confidenceLevel?: string,
    evidenceSources?: any
  ) => {
    await supabase.from("chat_messages").insert({
      conversation_id: convId,
      role,
      content,
      confidence_level: confidenceLevel,
      evidence_sources: evidenceSources,
    });
  };

  const handleSendMessage = async (content: string) => {
    let convId = conversationId;
    if (!convId) {
      convId = await createConversation();
      if (!convId) {
        toast({
          title: "Error",
          description: "Failed to create conversation",
          variant: "destructive",
        });
        return;
      }
      setConversationId(convId);
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
    };

    setMessages((prev) => [...prev, userMessage]);
    await saveMessage(convId, "user", content);

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("drug-advisor", {
        body: {
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        },
      });

      if (error) {
        if (error.message?.includes("429")) {
          throw new Error("Rate limit exceeded. Please try again in a moment.");
        }
        if (error.message?.includes("402")) {
          throw new Error("AI credits depleted. Please add credits to continue.");
        }
        throw error;
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response,
        confidence_level: data.confidence_level,
        evidence_sources: data.evidence_sources,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      await saveMessage(
        convId,
        "assistant",
        data.response,
        data.confidence_level,
        data.evidence_sources
      );
    } catch (error: any) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to get response from AI advisor",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10 shadow-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">MedMentor RAG</h1>
              <p className="text-sm text-muted-foreground">AI Drug Interaction & Safety Advisor</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 max-w-5xl">
        <MedicalDisclaimer />

        {messages.length === 0 ? (
          <div className="space-y-6">
            {/* Hero Section */}
            <Card className="p-8 text-center bg-gradient-hero shadow-glow border-0">
              <Brain className="h-16 w-16 mx-auto mb-4 text-white" />
              <h2 className="text-3xl font-bold text-white mb-2">
                Ask About Drug Interactions
              </h2>
              <p className="text-white/90 max-w-2xl mx-auto">
                Get evidence-based answers about medication safety, drug interactions, 
                and side effects in plain language.
              </p>
            </Card>

            {/* Features */}
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="p-6 shadow-card">
                <Shield className="h-8 w-8 text-accent mb-3" />
                <h3 className="font-semibold mb-2 text-foreground">Safety First</h3>
                <p className="text-sm text-muted-foreground">
                  Evidence-based insights with clear safety warnings and medical disclaimers
                </p>
              </Card>
              <Card className="p-6 shadow-card">
                <Activity className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-semibold mb-2 text-foreground">Mechanism Explained</h3>
                <p className="text-sm text-muted-foreground">
                  Understand why interactions happen at a molecular level
                </p>
              </Card>
              <Card className="p-6 shadow-card">
                <Brain className="h-8 w-8 text-warning mb-3" />
                <h3 className="font-semibold mb-2 text-foreground">RAG-Powered</h3>
                <p className="text-sm text-muted-foreground">
                  Retrieval-augmented generation with cited medical sources
                </p>
              </Card>
            </div>

            {/* Example Questions */}
            <Card className="p-6 shadow-card">
              <h3 className="font-semibold mb-4 text-foreground">Try asking:</h3>
              <div className="space-y-2">
                {[
                  "Can I take ibuprofen with amoxicillin?",
                  "What side effects should I watch for with metformin and atenolol?",
                  "Why can't I mix alcohol with acetaminophen?",
                  "Is it safe to combine warfarin and aspirin?",
                ].map((q, idx) => (
                  <Badge
                    key={idx}
                    variant="secondary"
                    className="mr-2 cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                    onClick={() => handleSendMessage(q)}
                  >
                    {q}
                  </Badge>
                ))}
              </div>
            </Card>
          </div>
        ) : (
          <Card className="p-6 shadow-card min-h-[500px] flex flex-col">
            <div className="flex-1 overflow-y-auto mb-4 space-y-4">
              {messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  role={msg.role}
                  content={msg.content}
                  confidenceLevel={msg.confidence_level}
                  evidenceSources={msg.evidence_sources}
                />
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <Card className="p-4 bg-card shadow-card">
                    <div className="flex gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-100" />
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-200" />
                    </div>
                  </Card>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            <ChatInput onSend={handleSendMessage} disabled={isLoading} />
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50 py-4 mt-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Powered by Retrieval-Augmented Generation (RAG) with verified medical databases</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
