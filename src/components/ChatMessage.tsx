import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AlertTriangle, CheckCircle, Info } from "lucide-react";

interface ChatMessageProps {
  role: "user" | "assistant" | "system";
  content: string;
  confidenceLevel?: string;
  evidenceSources?: { source: string; snippet: string }[];
}

export const ChatMessage = ({ role, content, confidenceLevel, evidenceSources }: ChatMessageProps) => {
  if (role === "user") {
    return (
      <div className="flex justify-end mb-4">
        <Card className="max-w-[80%] p-4 bg-primary text-primary-foreground shadow-card">
          <p className="text-sm leading-relaxed">{content}</p>
        </Card>
      </div>
    );
  }

  const getConfidenceBadge = (level?: string) => {
    if (!level) return null;
    
    const variants = {
      high: { variant: "default" as const, icon: CheckCircle, label: "High Confidence" },
      medium: { variant: "secondary" as const, icon: Info, label: "Medium Confidence" },
      low: { variant: "outline" as const, icon: AlertTriangle, label: "Low Confidence" }
    };

    const config = variants[level as keyof typeof variants];
    if (!config) return null;

    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="flex justify-start mb-4">
      <Card className="max-w-[85%] p-5 bg-card shadow-card">
        <div className="prose prose-sm max-w-none">
          <p className="text-foreground leading-relaxed whitespace-pre-wrap">{content}</p>
        </div>
        
        {(confidenceLevel || (evidenceSources && evidenceSources.length > 0)) && (
          <div className="mt-4 pt-4 border-t border-border space-y-3">
            {confidenceLevel && (
              <div className="flex items-center gap-2">
                {getConfidenceBadge(confidenceLevel)}
              </div>
            )}
            
            {evidenceSources && evidenceSources.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Evidence References:</p>
                {evidenceSources.map((source, idx) => (
                  <div key={idx} className="text-xs bg-muted/50 p-2 rounded border border-border">
                    <p className="font-medium text-foreground">{source.source}</p>
                    {source.snippet && (
                      <p className="text-muted-foreground mt-1 italic">{source.snippet}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};
