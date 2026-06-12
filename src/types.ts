/**
 * Type declarations for The Tiebreaker decision-maker.
 */

export interface ProOrConItem {
  id: string; // convenient local tracking
  text: string;
  impact: 'High' | 'Medium' | 'Low';
  weight: number; // default suggested weight, e.g. 1-5
  category: string; // e.g., Financial, Growth, Comfort, Happiness
}

export interface OptionAnalysis {
  optionName: string;
  overallScore: number; // calculated by AI index (0 to 100)
  pros: ProOrConItem[];
  cons: ProOrConItem[];
  motto: string; // short playful summary of this path
}

export interface SWOTAnalysis {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

export interface ComparisonDimension {
  dimension: string; // e.g., "Effort involved"
  description: string;
  ratings: {
    optionName: string;
    score: number; // 1 to 10
    justification: string;
  }[];
}

export interface DecisionVerdict {
  chosenOption: string;
  confidenceScore: number; // 0 to 100
  mainArgument: string;
  whatToWatchOutFor: string;
  actionableNextSteps: string[];
}

export interface DecisionAnalysis {
  decision: string;
  archetype: string;
  options: string[];
  personalSituation?: string;
  verdict: DecisionVerdict;
  optionAnalyses: OptionAnalysis[];
  swot: SWOTAnalysis;
  comparisons: ComparisonDimension[];
}

export interface SavedDecision {
  id: string;
  title: string;
  createdAt: string;
  options: string[];
  archetype: string;
  personalSituation?: string;
  analysis: DecisionAnalysis;
  // User-customized sliders overrides
  customWeights: {
    [key: string]: number; // key: `${optionIndex}-${type}-${itemIndex}` (type is 'pro' or 'con')
  };
  notes?: string;
}

export type DecisionArchetype = 'rationalist' | 'intuitive' | 'bold_adventurer' | 'risk_minimizer';

export interface ArchetypeConfig {
  id: DecisionArchetype;
  name: string;
  emoji: string;
  description: string;
  systemInstruction: string;
}
