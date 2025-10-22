-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Drug interactions table
CREATE TABLE public.drug_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  drug_a TEXT NOT NULL,
  drug_b TEXT NOT NULL,
  interaction_type TEXT NOT NULL, -- 'major', 'moderate', 'minor'
  summary TEXT NOT NULL,
  mechanism TEXT NOT NULL,
  safety_advice TEXT NOT NULL,
  evidence_source TEXT NOT NULL,
  confidence_level TEXT NOT NULL, -- 'low', 'medium', 'high'
  embedding vector(768), -- For semantic search
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for vector similarity search
CREATE INDEX drug_interactions_embedding_idx ON public.drug_interactions 
USING ivfflat (embedding vector_cosine_ops);

-- Create text search index for drug names
CREATE INDEX drug_interactions_drug_a_idx ON public.drug_interactions(drug_a);
CREATE INDEX drug_interactions_drug_b_idx ON public.drug_interactions(drug_b);

-- Chat conversations table
CREATE TABLE public.chat_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Chat messages table
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  confidence_level TEXT,
  evidence_sources JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.drug_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Public read access for drug interactions (medical knowledge should be accessible)
CREATE POLICY "Drug interactions are viewable by everyone"
ON public.drug_interactions FOR SELECT
USING (true);

-- Public access for conversations (for demo - can be restricted to users later)
CREATE POLICY "Conversations are viewable by everyone"
ON public.chat_conversations FOR SELECT
USING (true);

CREATE POLICY "Anyone can create conversations"
ON public.chat_conversations FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update conversations"
ON public.chat_conversations FOR UPDATE
USING (true);

-- Public access for messages
CREATE POLICY "Messages are viewable by everyone"
ON public.chat_messages FOR SELECT
USING (true);

CREATE POLICY "Anyone can create messages"
ON public.chat_messages FOR INSERT
WITH CHECK (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_drug_interactions_updated_at
BEFORE UPDATE ON public.drug_interactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chat_conversations_updated_at
BEFORE UPDATE ON public.chat_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample drug interaction data
INSERT INTO public.drug_interactions (drug_a, drug_b, interaction_type, summary, mechanism, safety_advice, evidence_source, confidence_level) VALUES
('ibuprofen', 'amoxicillin', 'minor', 'Generally safe to take together with minimal interaction risk.', 'Different mechanisms of action - NSAIDs affect inflammation pathways while antibiotics target bacteria.', 'Take ibuprofen with food to reduce stomach irritation. Monitor for any unusual symptoms.', 'DrugBank: DB00141, DB01050', 'high'),
('metformin', 'atenolol', 'moderate', 'May mask symptoms of low blood sugar and slightly increase risk of hypoglycemia.', 'Beta-blockers like atenolol can mask hypoglycemic symptoms (tremor, rapid heartbeat) caused by metformin.', 'Monitor blood glucose levels regularly. Be aware of alternative hypoglycemia symptoms like confusion or sweating. Consult your doctor if symptoms occur.', 'FDA Drug Safety Communication 2016', 'high'),
('alcohol', 'acetaminophen', 'major', 'Dangerous combination - significantly increases liver toxicity risk.', 'Both substances are metabolized by the liver. Alcohol increases production of toxic acetaminophen metabolites.', 'AVOID this combination. Do not consume alcohol while taking acetaminophen. Risk of severe liver damage. Seek immediate medical attention for signs of liver injury.', 'OpenFDA Adverse Events Database', 'high'),
('warfarin', 'aspirin', 'major', 'Significant bleeding risk when combined.', 'Both drugs inhibit different clotting pathways, leading to cumulative anticoagulant effects.', 'DO NOT combine without medical supervision. Requires careful monitoring of INR levels. High risk of serious bleeding. Consult your doctor immediately.', 'PubMed PMID: 12345678', 'high'),
('lisinopril', 'potassium', 'moderate', 'Can cause dangerously high potassium levels (hyperkalemia).', 'ACE inhibitors like lisinopril reduce potassium excretion. Supplementation can lead to accumulation.', 'Avoid potassium supplements and salt substitutes unless prescribed. Monitor potassium levels regularly. Watch for symptoms like irregular heartbeat or muscle weakness.', 'WHO Essential Medicines List', 'high');