import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

export const MedicalDisclaimer = () => {
  return (
    <Alert variant="destructive" className="mb-6">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="text-sm">
        <strong>Medical Disclaimer:</strong> This is NOT medical advice. MedMentor RAG provides educational information only. 
        Always consult a licensed healthcare professional before making decisions about medications, dosages, or drug interactions. 
        Never self-medicate or change prescribed treatments without medical supervision.
      </AlertDescription>
    </Alert>
  );
};
