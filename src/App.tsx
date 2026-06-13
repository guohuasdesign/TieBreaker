import React, { useState, useEffect } from 'react';
import {
  Brain,
  Scale,
  Sparkles,
  Shield,
  Trash2,
  Plus,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  RotateCcw,
  Info,
  Sliders,
  ChevronRight,
  RefreshCw,
  FolderOpen,
  Check,
  BookOpen
} from 'lucide-react';
import {
  DecisionAnalysis,
  SavedDecision,
  DecisionArchetype
} from './types';
import DecisionForm from './components/DecisionForm';
import SavedDecisions from './components/SavedDecisions';
import { ARCHETYPES } from './components/ArchetypeSelector';

const safeArray = <T,>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];

const toDisplayText = (value: unknown, fallback = '') => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const candidate = record.text || record.title || record.name || record.summary || record.description || record.optionName;
    if (candidate) return toDisplayText(candidate, fallback);
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }
  return fallback;
};

const toTextArray = (value: unknown) => safeArray<unknown>(value)
  .map((item) => toDisplayText(item))
  .filter(Boolean);

const clampNumber = (value: unknown, min: number, max: number, fallback: number) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(min, Math.min(max, numeric)) : fallback;
};

const getImpactWeight = (impact: unknown) => {
  if (impact === 'High') return 1.5;
  if (impact === 'Low') return 0.6;
  return 1;
};

const deriveItemWeight = (item: any, index: number, type: 'pro' | 'con') => {
  const impact = item?.impact;
  const category = toDisplayText(item?.category).toLowerCase();
  let weight = impact === 'High' ? 5 : impact === 'Low' ? 2 : 3;

  if (index >= 2) weight -= 1;
  if (type === 'con' && /(financial|health|security|legal|time|stress|risk)/.test(category)) weight += 1;
  if (type === 'pro' && /(financial|growth|health|joy|career|long-term|value)/.test(category)) weight += 1;

  return Math.max(1, Math.min(5, weight));
};

const shouldDeriveWeights = (items: any[]) => {
  const weights = items
    .map((item) => Number(item?.weight))
    .filter((weight) => Number.isFinite(weight));
  return weights.length === 0 || new Set(weights).size === 1;
};

const deriveFallbackRating = (option: any, dimensionIndex: number) => {
  const base = Number.isFinite(Number(option?.overallScore))
    ? Math.round(Number(option.overallScore) / 10)
    : 6;
  const proPower = safeArray<any>(option?.pros).reduce((total, pro) => total + getImpactWeight(pro?.impact), 0);
  const conPower = safeArray<any>(option?.cons).reduce((total, con) => total + getImpactWeight(con?.impact), 0);
  const netSignal = proPower - conPower;
  const dimensionBias = dimensionIndex === 0
    ? netSignal * 0.45
    : dimensionIndex === 1
      ? -conPower * 0.35
      : proPower * 0.25;

  return Math.max(1, Math.min(10, Math.round(base + dimensionBias)));
};

const normalizeDecisionAnalysisForClient = (
  analysis: Partial<DecisionAnalysis> | any,
  fallbackTitle: string,
  fallbackOptions: string[],
  fallbackArchetype: string
): DecisionAnalysis => {
  const options = toTextArray(analysis?.options).length
    ? toTextArray(analysis.options)
    : fallbackOptions.map((option) => toDisplayText(option)).filter(Boolean);
  const safeOptions = options.length ? options : ['Option A', 'Option B'];
  const fallbackOption = safeOptions[0];
  const optionAnalyses = safeArray<any>(analysis?.optionAnalyses);

  const normalizedOptionAnalyses = safeOptions.map((optionName, optionIndex) => {
    const existing = optionAnalyses.find((option) => {
      const label = toDisplayText(option?.optionName || option?.title || option?.name || option?.id);
      return label === optionName;
    }) || optionAnalyses[optionIndex] || {};
    const rawPros = safeArray<any>(existing.pros).length
      ? safeArray<any>(existing.pros)
      : safeArray<any>(existing.swot?.strengths);
    const rawCons = safeArray<any>(existing.cons).length
      ? safeArray<any>(existing.cons)
      : safeArray<any>(existing.swot?.weaknesses);
    const fallbackPros = rawPros.length ? rawPros : [`${optionName} has enough upside to keep in consideration.`];
    const fallbackCons = rawCons.length ? rawCons : [`${optionName} still has uncertainty that should be managed.`];
    const deriveProWeights = shouldDeriveWeights(fallbackPros);
    const deriveConWeights = shouldDeriveWeights(fallbackCons);
    const pros = fallbackPros.map((pro, proIndex) => ({
      id: toDisplayText(pro?.id, `pro${proIndex + 1}`),
      text: toDisplayText(pro?.text ?? pro, 'Potential upside to consider.'),
      impact: ['High', 'Medium', 'Low'].includes(pro?.impact) ? pro.impact : 'Medium',
      weight: deriveProWeights ? deriveItemWeight(pro, proIndex, 'pro') : clampNumber(pro?.weight, 1, 5, 3),
      category: toDisplayText(pro?.category, 'General'),
    }));
    const cons = fallbackCons.map((con, conIndex) => ({
      id: toDisplayText(con?.id, `con${conIndex + 1}`),
      text: toDisplayText(con?.text ?? con, 'Potential downside to manage.'),
      impact: ['High', 'Medium', 'Low'].includes(con?.impact) ? con.impact : 'Medium',
      weight: deriveConWeights ? deriveItemWeight(con, conIndex, 'con') : clampNumber(con?.weight, 1, 5, 3),
      category: toDisplayText(con?.category, 'General'),
    }));

    return {
      optionName: toDisplayText(existing.optionName || existing.title || existing.name || existing.id, optionName),
      overallScore: clampNumber(existing.overallScore, 0, 100, 50),
      motto: toDisplayText(existing.motto, 'Worth a grounded look'),
      pros,
      cons,
    };
  });

  const verdict = analysis?.verdict || {};
  const comparisons = safeArray<any>(analysis?.comparisons).slice(0, 3).map((comparison, index) => {
    const comparisonRatings = safeArray<any>(comparison?.ratings);
    const numericScores = comparisonRatings
      .map((rating) => Number(rating?.score))
      .filter((score) => Number.isFinite(score));
    const isNeutralPlaceholder = numericScores.length >= safeOptions.length && numericScores.every((score) => score === 5);

    return {
      dimension: toDisplayText(comparison?.dimension, ['Short-term fit', 'Effort', 'Long-term value'][index] || 'Decision fit'),
      description: toDisplayText(comparison?.description, 'How this factor changes the decision.'),
      ratings: safeOptions.map((optionName) => {
        const optionAnalysis = normalizedOptionAnalyses.find((option) => option.optionName === optionName);
        const existing = comparisonRatings.find((rating) => rating?.optionName === optionName);
        return {
          optionName,
          score: !isNeutralPlaceholder && Number.isFinite(Number(existing?.score)) ? clampNumber(existing?.score, 1, 10, 5) : deriveFallbackRating(optionAnalysis, index),
          justification: toDisplayText(
            existing?.justification,
            optionAnalysis
              ? `${optionName} scores this way based on its weighted upside/downside profile.`
              : 'Needs more evidence before scoring strongly.'
          ),
        };
      }),
    };
  });

  while (comparisons.length < 3) {
    const index = comparisons.length;
    comparisons.push({
      dimension: ['Short-term fit', 'Effort', 'Long-term value'][index] || 'Decision fit',
      description: 'Fallback comparison dimension generated for UI stability.',
      ratings: safeOptions.map((optionName) => ({
        optionName,
        score: deriveFallbackRating(
          normalizedOptionAnalyses.find((option) => option.optionName === optionName),
          index
        ),
        justification: `${optionName} is scored from its overall signal plus the balance of high-impact pros and cons.`,
      })),
    });
  }

  return {
    decision: toDisplayText(analysis?.decision, fallbackTitle || 'Untitled decision'),
    archetype: toDisplayText(analysis?.archetype, fallbackArchetype || 'rationalist'),
    analysisProvider: analysis?.analysisProvider ? String(analysis.analysisProvider) : undefined,
    options: safeOptions,
    personalSituation: analysis?.personalSituation ? toDisplayText(analysis.personalSituation) : undefined,
    verdict: {
      chosenOption: safeOptions.includes(verdict?.chosenOption) ? verdict.chosenOption : fallbackOption,
      confidenceScore: clampNumber(verdict?.confidenceScore, 0, 100, 60),
      mainArgument: toDisplayText(verdict?.mainArgument, `${fallbackOption} currently has the clearest fit based on the available information.`),
      whatToWatchOutFor: toDisplayText(verdict?.whatToWatchOutFor, 'Watch for missing evidence before making the final commitment.'),
      actionableNextSteps: toTextArray(verdict?.actionableNextSteps).length
        ? toTextArray(verdict.actionableNextSteps).slice(0, 3)
        : ['Clarify your top constraint.', 'Run a small reality check.', 'Revisit the weights after new evidence.'],
    },
    optionAnalyses: normalizedOptionAnalyses,
    swot: {
      strengths: toTextArray(analysis?.swot?.strengths),
      weaknesses: toTextArray(analysis?.swot?.weaknesses),
      opportunities: toTextArray(analysis?.swot?.opportunities),
      threats: toTextArray(analysis?.swot?.threats),
    },
    comparisons,
  };
};

const normalizeSavedDecisionForClient = (decision: Partial<SavedDecision> | any): SavedDecision => {
  const title = toDisplayText(decision?.title || decision?.analysis?.decision, 'Untitled decision');
  const options = toTextArray(decision?.options).length
    ? toTextArray(decision.options)
    : toTextArray(decision?.analysis?.options);
  const archetype = toDisplayText(decision?.archetype || decision?.analysis?.archetype, 'rationalist');

  return {
    id: String(decision?.id || `dec_${Date.now()}`),
    title,
    createdAt: String(decision?.createdAt || new Date().toISOString()),
    options: options.length ? options : ['Option A', 'Option B'],
    archetype,
    personalSituation: decision?.personalSituation ? toDisplayText(decision.personalSituation) : undefined,
    analysis: normalizeDecisionAnalysisForClient(decision?.analysis || {}, title, options, archetype),
    customWeights: decision?.customWeights && typeof decision.customWeights === 'object' ? decision.customWeights : {},
    notes: decision?.notes,
  };
};

export default function App() {
  const [savedDecisions, setSavedDecisions] = useState<SavedDecision[]>([]);
  const [activeDecisionId, setActiveDecisionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decisionIllustration, setDecisionIllustration] = useState<{
    key: string;
    dataUrl: string | null;
    mediaUrl: string | null;
    mimeType: string | null;
    isLoading: boolean;
    error: string | null;
    source?: string | null;
    model?: string | null;
    warning?: string | null;
    providerErrors?: string[];
  }>({
    key: '',
    dataUrl: null,
    mediaUrl: null,
    mimeType: null,
    isLoading: false,
    error: null,
    source: null,
    model: null,
    warning: null,
    providerErrors: [],
  });
  
  // Creation state
  const [showCreationForm, setShowCreationForm] = useState(true);

  // Active view option index for the pros & cons widget
  const [selectedOptionTab, setSelectedOptionTab] = useState<number>(0);

  // Load from LocalStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('the_tiebreaker_decisions');
      if (stored) {
        const parsed = JSON.parse(stored);
        const normalized = safeArray<SavedDecision>(parsed).map(normalizeSavedDecisionForClient);
        setSavedDecisions(normalized);
        localStorage.setItem('the_tiebreaker_decisions', JSON.stringify(normalized));
        if (normalized.length > 0) {
          setActiveDecisionId(normalized[0].id);
          setShowCreationForm(false);
        }
      }
    } catch (e) {
      console.error("Failed to load archived decisions:", e);
    }
  }, []);

  // Save to LocalStorage whenever savedDecisions change
  const saveDecisionsToStorage = (updated: SavedDecision[]) => {
    setSavedDecisions(updated);
    try {
      localStorage.setItem('the_tiebreaker_decisions', JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to persist decisions:", e);
    }
  };

  // A newly analyzed decision that is pending user confirmation to "Keep" or "Discard"
  const [draftDecision, setDraftDecision] = useState<SavedDecision | null>(null);

  const activeDecision = draftDecision || savedDecisions.find(d => d.id === activeDecisionId);

  const handleSaveDraft = () => {
    if (!draftDecision) return;
    const updatedHistory = [draftDecision, ...savedDecisions];
    saveDecisionsToStorage(updatedHistory);
    setActiveDecisionId(draftDecision.id);
    setDraftDecision(null);
  };

  const handleDiscardDraft = () => {
    setDraftDecision(null);
    if (savedDecisions.length > 0) {
      setActiveDecisionId(savedDecisions[0].id);
    } else {
      setActiveDecisionId(null);
      setShowCreationForm(true);
    }
  };

  // Trigger analysis
  const handleAnalyzeDecision = async (
    decisionText: string,
    options: string[],
    archetype: DecisionArchetype,
    personalSituation: string
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/analyze-decision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          decision: decisionText,
          options,
          archetype,
          personalSituation
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status ${response.status}`);
      }

      const analysisResult = normalizeDecisionAnalysisForClient(
        await response.json(),
        decisionText,
        options,
        archetype
      );

      const newSaved: SavedDecision = {
        id: `dec_${Date.now()}`,
        title: decisionText,
        createdAt: new Date().toISOString(),
        options: analysisResult.options,
        archetype,
        personalSituation,
        analysis: analysisResult,
        customWeights: {},
      };

      setDraftDecision(newSaved);
      setActiveDecisionId(newSaved.id);
      setSelectedOptionTab(0);
      setShowCreationForm(false);

    } catch (err: any) {
      console.error(err);
      setError(
        err.message || "An unexpected error occurred. Please make sure your ANTHROPIC_API_KEY is configured."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Switch archetype of the active decision and regenerate the analysis
  const handleSwitchArchetype = async (newArchetype: DecisionArchetype) => {
    if (!activeDecision) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/analyze-decision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          decision: activeDecision.title,
          options: activeDecision.options,
          archetype: newArchetype,
          personalSituation: activeDecision.personalSituation || ''
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status ${response.status}`);
      }

      const analysisResult = normalizeDecisionAnalysisForClient(
        await response.json(),
        activeDecision.title,
        activeDecision.options,
        newArchetype
      );

      if (draftDecision && activeDecision.id === draftDecision.id) {
        setDraftDecision({
          ...draftDecision,
          archetype: newArchetype,
          analysis: analysisResult,
          customWeights: {}
        });
        setSelectedOptionTab(0);
        return;
      }

      const updatedDecisions = savedDecisions.map(d => {
        if (d.id === activeDecision.id) {
          return {
            ...d,
            archetype: newArchetype,
            analysis: analysisResult,
            customWeights: {}, // Reset custom weights on archetype shift to allow fresh perspective defaults
          };
        }
        return d;
      });

      saveDecisionsToStorage(updatedDecisions);
      setSelectedOptionTab(0);
    } catch (err: any) {
      console.error(err);
      setError(
        err.message || "An unexpected error occurred during role transition. Ensure your ANTHROPIC_API_KEY is configured."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDecision = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedDecisions.filter(d => d.id !== id);
    saveDecisionsToStorage(updated);
    
    // Adjust active decision index if we deleted the current one
    if (activeDecisionId === id) {
      if (updated.length > 0) {
        setActiveDecisionId(updated[0].id);
      } else {
        setActiveDecisionId(null);
        setShowCreationForm(true);
      }
    }
  };

  const handleSelectDecision = (decision: SavedDecision) => {
    // Auto-save the current draft if the user manually switches to another case file
    if (draftDecision) {
      const updatedHistory = [draftDecision, ...savedDecisions];
      saveDecisionsToStorage(updatedHistory);
      setDraftDecision(null);
    }
    setActiveDecisionId(decision.id);
    setSelectedOptionTab(0);
    setShowCreationForm(false);
    setError(null);
  };

  // Adjust custom slider weights
  const handleWeightChange = (optionIdx: number, type: 'pro' | 'con', itemIdx: number, val: number) => {
    if (!activeDecision) return;

    const key = `${optionIdx}-${type}-${itemIdx}`;
    if (draftDecision && activeDecision.id === draftDecision.id) {
      setDraftDecision({
        ...draftDecision,
        customWeights: {
          ...draftDecision.customWeights,
          [key]: val
        }
      });
      return;
    }

    const updatedDecisions = savedDecisions.map(d => {
      if (d.id === activeDecision.id) {
        return {
          ...d,
          customWeights: {
            ...d.customWeights,
            [key]: val
          }
        };
      }
      return d;
    });

    saveDecisionsToStorage(updatedDecisions);
  };

  const resetWeights = () => {
    if (!activeDecision) return;
    if (draftDecision && activeDecision.id === draftDecision.id) {
      setDraftDecision({
        ...draftDecision,
        customWeights: {}
      });
      return;
    }

    const updatedDecisions = savedDecisions.map(d => {
      if (d.id === activeDecision.id) {
        return {
          ...d,
          customWeights: {}
        };
      }
      return d;
    });
    saveDecisionsToStorage(updatedDecisions);
  };

  // Compute calculated metrics with custom weight overrides
  const getRecalculatedScores = () => {
    if (!activeDecision) return [];

    return activeDecision.options.map((optionName, optIdx) => {
      const opt = activeDecision.analysis.optionAnalyses?.[optIdx] || {
        optionName,
        pros: [],
        cons: [],
      };
      let totalProPower = 0;
      let totalConPower = 0;

      (opt.pros || []).forEach((pro, proIdx) => {
        const customWeight = activeDecision.customWeights[`${optIdx}-pro-${proIdx}`];
        const multiplier = customWeight !== undefined ? customWeight : pro.weight;
        const impactValue = pro.impact === 'High' ? 1.5 : pro.impact === 'Medium' ? 1.0 : 0.6;
        totalProPower += multiplier * impactValue;
      });

      (opt.cons || []).forEach((con, conIdx) => {
        const customWeight = activeDecision.customWeights[`${optIdx}-con-${conIdx}`];
        const multiplier = customWeight !== undefined ? customWeight : con.weight;
        const impactValue = con.impact === 'High' ? 1.5 : con.impact === 'Medium' ? 1.0 : 0.6;
        totalConPower += multiplier * impactValue;
      });

      // Calculate health/appeal score
      const totalRatio = totalProPower + totalConPower;
      const baseScore = totalRatio > 0 ? (totalProPower / totalRatio) * 100 : 50;
      
      return {
        optionName,
        score: Math.round(baseScore),
        proPower: totalProPower.toFixed(1),
        conPower: totalConPower.toFixed(1)
      };
    });
  };

  const recalculatedScores = getRecalculatedScores();
  const leadingOptionObj = recalculatedScores.length > 0 
    ? [...recalculatedScores].sort((a,b) => b.score - a.score)[0]
    : null;

  const currentArchetypeConfig = activeDecision 
    ? ARCHETYPES.find(a => a.id === activeDecision.archetype)
    : null;
  const selectedOptionScore = recalculatedScores[selectedOptionTab];
  const selectedOptionName = activeDecision?.options[selectedOptionTab] || selectedOptionScore?.optionName || '';

  const weightedRecommendedOption = leadingOptionObj?.optionName || activeDecision?.analysis.verdict.chosenOption || '';
  const weightedConfidence = leadingOptionObj?.score || activeDecision?.analysis.verdict.confidenceScore || 0;
  const isWeightedOverride = !!activeDecision && weightedRecommendedOption !== activeDecision.analysis.verdict.chosenOption;
  const weightedOptionAnalysis = activeDecision?.analysis.optionAnalyses?.find(
    (option) => option.optionName === weightedRecommendedOption
  );
  const weightedArgument = isWeightedOverride
    ? `Your adjusted weights now favor ${weightedRecommendedOption}. ${weightedOptionAnalysis?.motto ? `${weightedOptionAnalysis.motto}. ` : ''}The original AI verdict remains available below as context, but this recommendation reflects your current priorities.`
    : activeDecision?.analysis.verdict.mainArgument || '';
  const weightedPrimaryRisk = isWeightedOverride
    ? weightedOptionAnalysis?.cons[0]?.text || activeDecision?.analysis.verdict.whatToWatchOutFor || ''
    : activeDecision?.analysis.verdict.whatToWatchOutFor || '';
  const weightedNextSteps = isWeightedOverride
    ? [
        weightedOptionAnalysis?.pros[0]?.text ? `Protect the biggest upside: ${weightedOptionAnalysis.pros[0].text}` : `Pressure-test ${weightedRecommendedOption} against your real constraints.`,
        weightedOptionAnalysis?.cons[0]?.text ? `Reduce the biggest downside: ${weightedOptionAnalysis.cons[0].text}` : `Name the main risk before committing.`,
        `Keep tuning the weights if this recommendation does not match your lived priorities.`,
      ]
    : activeDecision?.analysis.verdict.actionableNextSteps || [];

  const confidence = weightedConfidence;
  const verdictTone = confidence >= 75 ? 'Strong signal' : confidence >= 55 ? 'Leaning signal' : 'Close call';
  const topComparisonWins = activeDecision
    ? (activeDecision.analysis.comparisons || []).reduce<Record<string, number>>((acc, comp) => {
        const sorted = [...(comp.ratings || [])].sort((a, b) => b.score - a.score);
        if (sorted[0] && sorted[1] && sorted[0].score > sorted[1].score) {
          acc[sorted[0].optionName] = (acc[sorted[0].optionName] || 0) + 1;
        }
        return acc;
      }, {})
    : {};

  const scoreSignature = recalculatedScores
    .map((score) => `${score.optionName}:${score.score}:${score.proPower}:${score.conPower}`)
    .join('|');

  const illustrationKey = activeDecision
    ? `${activeDecision.id}:${leadingOptionObj?.optionName || activeDecision.analysis.verdict.chosenOption}:${scoreSignature}`
    : '';

  const handleGenerateDecisionIllustration = async () => {
    if (!activeDecision || showCreationForm || !illustrationKey) return;

    setDecisionIllustration((current) => ({
      key: illustrationKey,
      dataUrl: current.dataUrl,
      mediaUrl: current.mediaUrl,
      mimeType: current.mimeType,
      isLoading: true,
      error: null,
      source: current.source,
      model: current.model,
      warning: null,
      providerErrors: [],
    }));

    try {
      const response = await fetch('/api/generate-decision-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          decision: activeDecision.title,
          chosenOption: activeDecision.analysis.verdict.chosenOption,
          leadingOption: leadingOptionObj?.optionName || activeDecision.analysis.verdict.chosenOption,
          confidenceScore: leadingOptionObj?.score || activeDecision.analysis.verdict.confidenceScore,
          mainArgument: weightedArgument,
          whatToWatchOutFor: weightedPrimaryRisk,
          personalSituation: activeDecision.personalSituation || '',
          scores: recalculatedScores,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status ${response.status}`);
      }

      const data = (await response.json()) as {
        dataUrl?: string;
        mediaUrl?: string;
        mimeType?: string;
        source?: string;
        model?: string;
        warning?: string;
        providerErrors?: string[];
      };
      setDecisionIllustration({
        key: illustrationKey,
        dataUrl: data.dataUrl || null,
        mediaUrl: data.mediaUrl || null,
        mimeType: data.mimeType || null,
        isLoading: false,
        error: null,
        source: data.source || null,
        model: data.model || null,
        warning: data.warning || null,
        providerErrors: data.providerErrors || [],
      });
    } catch (err: any) {
      setDecisionIllustration({
        key: illustrationKey,
        dataUrl: null,
        mediaUrl: null,
        mimeType: null,
        isLoading: false,
        error: err.message || "Unable to generate the decision illustration.",
        source: null,
        model: null,
        warning: null,
        providerErrors: [],
      });
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col" id="app-root-container">
      {/* Visual background grid texture */}
      <div className="absolute inset-0 bg-dots pointer-events-none opacity-60 z-0"></div>

      {/* Main Container */}
      <div className="z-10 flex-grow max-w-7xl w-full mx-auto px-4 py-6 md:px-8 md:py-8 flex flex-col">
        {/* Top Header Row */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-5 border-b border-zinc-200">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-zinc-900 rounded-xl flex items-center justify-center shadow-md">
                <Scale className="w-5 h-5 text-emerald-400" />
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight font-display text-zinc-900">
                The Tiebreaker
              </h1>
            </div>
            
            {activeDecision && !showCreationForm ? (
              <p className="text-xs text-zinc-500 font-medium">
                Decision Profile:{' '}
                <span className="text-indigo-600 font-bold underline decoration-indigo-200 underline-offset-4">
                  {currentArchetypeConfig?.emoji} {currentArchetypeConfig?.name}
                </span>
              </p>
            ) : (
              <p className="text-xs text-zinc-500 font-medium font-sans">
                A gorgeous Bento-styled, AI-assisted workspace for breaking complex ties and tuning options.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {(savedDecisions.length > 0 || draftDecision) && (
              <button
                id="toggle-archive-view-btn"
                type="button"
                onClick={() => {
                  if (!showCreationForm && draftDecision) {
                    const updatedHistory = [draftDecision, ...savedDecisions];
                    saveDecisionsToStorage(updatedHistory);
                    setDraftDecision(null);
                  }
                  setShowCreationForm(!showCreationForm);
                }}
                className={`cursor-pointer px-4 py-2 border rounded-xl text-xs font-semibold shadow-2xs transition-all ${
                  showCreationForm 
                    ? 'bg-zinc-900 text-white border-transparent hover:bg-zinc-800' 
                    : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                }`}
              >
                {showCreationForm ? "Back to Analysis Dashboard" : "Create New Decision"}
              </button>
            )}
          </div>
        </header>

        {/* Global Error Notice */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 mb-6 flex items-start gap-3" id="error-notice">
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-rose-800 font-display">Analysis Engine Interrupted</h4>
              <p className="text-xs text-rose-700 font-sans leading-relaxed">{error}</p>
              <p className="text-[11px] text-zinc-500 mt-2">
                Tip: Ensure you have added your <code className="font-mono bg-rose-100/50 px-1 py-0.5 rounded text-rose-800">ANTHROPIC_API_KEY</code> in <code className="font-mono bg-rose-100/50 px-1 py-0.5 rounded text-rose-800">.env.local</code>.
              </p>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center px-4" id="ai-analysis-visual-loader">
            <div className="w-full max-w-3xl bg-white rounded-3xl border border-zinc-200 shadow-2xl overflow-hidden">
              <div className="relative bg-zinc-950 text-white p-6 md:p-8 overflow-hidden">
                <div className="absolute inset-0 opacity-20 bg-dots"></div>
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-sky-400 to-indigo-400 decision-scan-line"></div>
                <div className="relative grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 items-center">
                  <div className="relative mx-auto w-44 h-44">
                    <div className="absolute inset-0 rounded-full border border-emerald-400/30"></div>
                    <div className="absolute inset-5 rounded-full border border-sky-400/25 decision-orbit"></div>
                    <div className="absolute inset-10 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center">
                      <Brain className="w-16 h-16 text-emerald-300" />
                    </div>
                    <div className="absolute left-1/2 top-1/2 w-2 h-2 -ml-1 -mt-1 rounded-full bg-emerald-300 shadow-[0_0_30px_rgba(52,211,153,0.9)]"></div>
                    {[0, 1, 2, 3].map((idx) => (
                      <span
                        key={idx}
                        className="absolute w-3 h-3 rounded-full bg-sky-300"
                        style={{
                          left: `${50 + Math.cos((idx * Math.PI) / 2) * 42}%`,
                          top: `${50 + Math.sin((idx * Math.PI) / 2) * 42}%`,
                        }}
                      ></span>
                    ))}
                  </div>
                  <div className="space-y-5">
                    <div>
                      <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-300">AI decision engine</p>
                      <h3 className="mt-2 text-3xl md:text-4xl font-black font-display leading-tight">Mapping tradeoffs visually</h3>
                      <p className="mt-3 text-base text-zinc-300 leading-relaxed">
                        Scoring options, weighing risks, and building a readable verdict.
                      </p>
                    </div>
                    <div className="grid grid-cols-4 gap-3 h-24 items-end">
                      {[72, 46, 88, 60].map((height, idx) => (
                        <div key={idx} className="bg-zinc-800 rounded-xl p-2 flex items-end">
                          <div
                            className="w-full rounded-lg bg-gradient-to-t from-emerald-500 to-sky-300 decision-rise"
                            style={{ height: `${height}%`, animationDelay: `${idx * 0.16}s` }}
                          ></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-5 md:p-6 bg-white">
                <div className="flex items-center justify-between text-sm font-semibold text-zinc-700 mb-3">
                  <span>Generating recommendation</span>
                  <span className="text-indigo-600">Please wait...</span>
                </div>
                <div className="h-3 w-full rounded-full bg-zinc-100 overflow-hidden">
                  <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-emerald-500 via-sky-500 to-indigo-500 decision-scan-line"></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic workspace layout */}
        {showCreationForm ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" id="creation-layout">
            <div className="lg:col-span-8">
              <DecisionForm onSubmit={handleAnalyzeDecision} isLoading={isLoading} />
            </div>
            <div className="lg:col-span-4 lg:sticky lg:top-6">
              <SavedDecisions
                savedDecisions={savedDecisions}
                activeDecisionId={activeDecisionId}
                onSelectDecision={handleSelectDecision}
                onDeleteDecision={handleDeleteDecision}
              />
            </div>
          </div>
        ) : (
          /* Bento Dashboard Stage */
          activeDecision && (
            <div className="space-y-6" id="bento-dashboard-stage">
              {/* Draft banner, if this is a draft analysis */}
              {draftDecision && (
                <div className="p-4 md:p-5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-3xl shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden" id="draft-decision-banner">
                  <div className="flex gap-3 items-start">
                    <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center shadow-md shrink-0 text-white mt-0.5">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[9px] bg-amber-100/80 text-amber-800 border border-amber-200 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                          DRAFT PREVIEW
                        </span>
                        <h4 className="text-xs font-bold text-amber-900 font-display">New AI Analysis Generated!</h4>
                      </div>
                      <p className="text-xs text-amber-800 font-sans leading-relaxed max-w-2xl">
                        This analysis is currently unsaved. You can interactively tune weights or change lenses. Save it to keep it in your permanent Archive, or discard it to start fresh.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0 justify-end">
                    <button
                      id="discard-draft-btn"
                      type="button"
                      onClick={handleDiscardDraft}
                      className="cursor-pointer text-xs font-semibold px-4 py-2 border border-rose-200 text-rose-700 bg-white hover:bg-rose-50 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Discard Draft
                    </button>
                    <button
                      id="save-draft-btn"
                      type="button"
                      onClick={handleSaveDraft}
                      className="cursor-pointer text-xs font-semibold px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Save & Archive
                    </button>
                  </div>
                </div>
              )}

              {/* Header Info Bento Block */}
              <div className="p-5 md:p-6 bg-white border border-zinc-200 rounded-3xl shadow-xs space-y-3 relative overflow-hidden">
                {/* Accent decoration bar */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-emerald-500 to-sky-500"></div>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="space-y-1">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 border border-indigo-100 text-indigo-700 font-mono">
                      Active Tiebreaker Case File
                    </span>
                    <h2 className="text-lg md:text-xl font-bold font-display text-zinc-900 leading-normal">
                      &ldquo;{activeDecision.title}&rdquo;
                    </h2>
                    {activeDecision.personalSituation && (
                      <p className="text-xs bg-zinc-50 border border-zinc-200/60 p-3 rounded-xl text-zinc-600 font-sans mt-2 italic flex items-start gap-1.5 max-w-4xl leading-relaxed">
                        <span className="text-indigo-500 font-serif font-black text-sm shrink-0">&ldquo;</span>
                        <span className="flex-1">{activeDecision.personalSituation}</span>
                        <span className="text-indigo-500 font-serif font-black text-sm shrink-0">&rdquo;</span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      id="reset-weights-btn"
                      onClick={resetWeights}
                      title="Reset weights default"
                      className="cursor-pointer text-xs font-semibold px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 flex items-center gap-1 text-zinc-600 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset Weights
                    </button>
                    <button
                      id="restart-decision-btn"
                      onClick={() => {
                        if (draftDecision) {
                          const updatedHistory = [draftDecision, ...savedDecisions];
                          saveDecisionsToStorage(updatedHistory);
                          setDraftDecision(null);
                        }
                        setShowCreationForm(true);
                      }}
                      className="cursor-pointer text-xs font-semibold px-3 py-1.5 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 flex items-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      New Analysis
                    </button>
                  </div>
                </div>

                {/* Perspective Switching Bar */}
                <div className="border-t border-zinc-100 pt-4 mt-4" id="ai-persona-toggles-bar">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <h4 className="text-xs font-bold font-display text-zinc-800 flex items-center gap-1.5">
                          <Brain className="w-3.5 h-3.5 text-indigo-500" />
                          Compare AI Persona Lenses
                        </h4>
                      </div>
                      <p className="text-[11px] text-zinc-500 font-sans">
                        Toggle to instantly view how another decision profile scores this split under your situation.
                      </p>
                    </div>
                    
                    <div className="flex flex-wrap gap-1.5" id="perspectives-list-actions">
                      {ARCHETYPES.map((arch) => {
                        const isCurrentActive = activeDecision.archetype === arch.id;
                        return (
                          <button
                            key={arch.id}
                            id={`perspective-btn-${arch.id}`}
                            type="button"
                            disabled={isLoading}
                            onClick={() => handleSwitchArchetype(arch.id)}
                            className={`cursor-pointer px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 select-none ${
                              isCurrentActive
                                ? 'bg-indigo-600 text-white border-transparent shadow-xs ring-2 ring-indigo-600/10'
                                : 'bg-zinc-50 text-zinc-700 border-zinc-200/80 hover:bg-zinc-100 hover:text-zinc-900 focus:outline-hidden disabled:opacity-50'
                            }`}
                          >
                            <span>{arch.emoji}</span>
                            <span>{arch.name}</span>
                            {isCurrentActive && isLoading && (
                              <RefreshCw className="w-3 h-3 animate-spin duration-700" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <section className="grid grid-cols-1 lg:grid-cols-12 gap-5" id="decision-visual-summary">
                <div className="lg:col-span-12 bg-zinc-950 text-white rounded-3xl p-6 md:p-8 shadow-lg relative overflow-hidden">
                  <div className="absolute inset-0 opacity-15 bg-dots"></div>
                  <div className="relative z-10 space-y-6">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/10 border border-emerald-300/20 px-3 py-1.5 text-sm font-bold text-emerald-300">
                        <CheckCircle2 className="w-4 h-4" />
                        {verdictTone}
                      </span>
                      <span className="text-sm text-zinc-400">
                        {isWeightedOverride ? 'Updated by your weight tuning' : `Recommended by ${currentArchetypeConfig?.name}`}
                      </span>
                      {activeDecision.analysis.analysisProvider && (
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-zinc-300">
                          Engine: {activeDecision.analysis.analysisProvider}
                        </span>
                      )}
                    </div>

                    <div className="space-y-3">
                      <p className="text-sm font-bold uppercase tracking-[0.18em] text-zinc-400">Best option</p>
                      <h2 className="text-4xl md:text-6xl font-black font-display leading-none text-white">
                        {weightedRecommendedOption}
                      </h2>
                      <p className="text-lg md:text-xl text-zinc-300 leading-relaxed max-w-3xl">
                        {weightedArgument}
                      </p>
                      {isWeightedOverride && (
                        <p className="text-sm text-amber-200/90">
                          Original AI verdict: {activeDecision.analysis.verdict.chosenOption}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                      <div className="rounded-2xl bg-white/8 border border-white/10 p-4">
                        <p className="text-xs uppercase tracking-widest text-zinc-500 font-bold">Confidence</p>
                        <p className="mt-1 text-3xl font-black text-emerald-300">{confidence}%</p>
                      </div>
                      <div className="rounded-2xl bg-white/8 border border-white/10 p-4">
                        <p className="text-xs uppercase tracking-widest text-zinc-500 font-bold">Criteria won</p>
                        <p className="mt-1 text-3xl font-black text-sky-300">
                          {topComparisonWins[weightedRecommendedOption] || 0}
                          <span className="text-base text-zinc-500">/{activeDecision.analysis.comparisons?.length || 0}</span>
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white/8 border border-white/10 p-4">
                        <p className="text-xs uppercase tracking-widest text-zinc-500 font-bold">Options</p>
                        <p className="mt-1 text-3xl font-black text-indigo-300">{activeDecision.options.length}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Bento Grid Core Structure */}
              <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5" id="bento-main-grid">
                
                {/* 1. OPTIONS TUNER */}
                <div className="lg:col-span-4 border border-zinc-200 rounded-3xl bg-gradient-to-b from-white to-zinc-50/80 p-5 shadow-xs h-full flex flex-col gap-4 overflow-hidden" id="bento-item-tuner">
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-5 bg-indigo-500 rounded-full"></div>
                        <h3 className="font-bold text-zinc-800 font-display text-sm">Weights Tuner</h3>
                      </div>
                      <span className="text-[10px] bg-amber-50 border border-amber-100 text-amber-700 font-mono px-2 py-0.5 rounded-full select-none">
                        Interactive
                      </span>
                    </div>

                    <p className="text-sm text-zinc-500 leading-relaxed">
                      Adjust the individual priority weights (1-5) below. Watch internal AI scores shift dynamically!
                    </p>

                    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-emerald-50 p-4 space-y-4 shadow-inner" id="tuner-option-strength">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-base font-black font-display text-zinc-900">Option strength</h4>
                          <p className="text-xs text-zinc-500 mt-0.5">Live result after your weight changes.</p>
                        </div>
                        {leadingOptionObj && (
                          <span className="shrink-0 rounded-full bg-white border border-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-700">
                            Leader {leadingOptionObj.score}%
                          </span>
                        )}
                      </div>

                      <div className="space-y-3">
                        {recalculatedScores.map((calc, idx) => {
                          const isLeader = leadingOptionObj?.optionName === calc.optionName;
                          return (
                            <div key={idx} className="space-y-1.5">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-black text-zinc-900 leading-snug truncate" title={calc.optionName}>
                                    {calc.optionName}
                                  </p>
                                  <p className="text-[11px] text-zinc-500">
                                    Pros {calc.proPower} / Cons {calc.conPower}
                                  </p>
                                </div>
                                <span className={`text-lg font-black ${isLeader ? 'text-emerald-600' : 'text-zinc-500'}`}>
                                  {calc.score}%
                                </span>
                              </div>
                              <div className="h-3.5 w-full bg-white rounded-full overflow-hidden border border-zinc-100 shadow-inner">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${isLeader ? 'bg-gradient-to-r from-emerald-500 to-sky-400' : 'bg-zinc-400'}`}
                                  style={{ width: `${calc.score}%` }}
                                ></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Selector of Option to configure */}
                    <div className="flex bg-zinc-100 p-1 rounded-xl gap-1" id="option-tabs">
                      {activeDecision.options.map((opt, optIdx) => (
                        <button
                          key={optIdx}
                          id={`tab-opt-${optIdx}`}
                          type="button"
                          onClick={() => setSelectedOptionTab(optIdx)}
                          className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all truncate px-1 cursor-pointer ${
                            selectedOptionTab === optIdx
                              ? 'bg-white text-zinc-900 shadow-2xs'
                              : 'text-zinc-500 hover:text-zinc-800'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>

                    {selectedOptionScore && (
                      <div className="grid grid-cols-[76px_1fr] gap-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-xs">
                        <div
                          className="relative h-16 w-16 rounded-full grid place-items-center"
                          style={{
                            background: `conic-gradient(#10b981 ${selectedOptionScore.score * 3.6}deg, #e4e4e7 0deg)`
                          }}
                        >
                          <div className="h-11 w-11 rounded-full bg-white border border-zinc-100 grid place-items-center">
                            <span className="text-sm font-black text-zinc-900">{selectedOptionScore.score}</span>
                          </div>
                        </div>
                        <div className="min-w-0 self-center">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 font-mono">Selected lens</p>
                          <p className="text-sm font-black text-zinc-900 truncate" title={selectedOptionName}>
                            {selectedOptionName}
                          </p>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-2 py-1">
                              <p className="text-[9px] font-bold uppercase text-emerald-700">Pros</p>
                              <p className="text-xs font-black text-emerald-900">{selectedOptionScore.proPower}</p>
                            </div>
                            <div className="rounded-lg bg-rose-50 border border-rose-100 px-2 py-1">
                              <p className="text-[9px] font-bold uppercase text-rose-700">Cons</p>
                              <p className="text-xs font-black text-rose-900">{selectedOptionScore.conPower}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tuning Container */}
                    <div className="space-y-4 mt-1 flex-1 min-h-[300px] overflow-y-auto pr-1 pb-1" id="sliders-scroller">
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-widest font-display">Pros Weight Factor</span>
                          <span className="text-[10px] text-zinc-400 font-mono">Set priority</span>
                        </div>
                        {(activeDecision.analysis.optionAnalyses[selectedOptionTab]?.pros || []).map((pro, proIdx) => {
                          const key = `${selectedOptionTab}-pro-${proIdx}`;
                          const currentVal = activeDecision.customWeights[key] !== undefined 
                            ? activeDecision.customWeights[key] 
                            : pro.weight;
                          return (
                            <div key={pro.id || proIdx} className="bg-emerald-50/70 hover:bg-emerald-50 border border-emerald-100/70 rounded-xl p-2.5 space-y-1.5 transition-all shadow-xs">
                              <div className="flex items-start justify-between gap-1">
                                <span className="text-sm text-emerald-950 font-medium leading-relaxed">{pro.text}</span>
                                <span className="text-[10px] font-bold bg-white text-emerald-800 px-1.5 py-0.5 rounded-md border border-emerald-100 font-mono shrink-0 select-none">{pro.impact}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <input
                                  type="range"
                                  min="1"
                                  max="5"
                                  step="1"
                                  value={currentVal}
                                  onChange={(e) => handleWeightChange(selectedOptionTab, 'pro', proIdx, parseInt(e.target.value))}
                                  className="flex-grow h-1.5 bg-emerald-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                                />
                                <span className="text-[10px] font-mono font-bold text-emerald-800 w-3 text-right">{currentVal}</span>
                              </div>
                            </div>
                          );
                        })}
                        {(activeDecision.analysis.optionAnalyses[selectedOptionTab]?.pros || []).length === 0 && (
                          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-xs font-medium text-emerald-900">
                            No pros returned for this option yet. Regenerate the analysis to create tunable factors.
                          </div>
                        )}
                      </div>

                      <div className="space-y-2.5 pt-2 border-t border-zinc-100">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-rose-700 uppercase tracking-widest font-display">Cons Weight Factor</span>
                        </div>
                        {(activeDecision.analysis.optionAnalyses[selectedOptionTab]?.cons || []).map((con, conIdx) => {
                          const key = `${selectedOptionTab}-con-${conIdx}`;
                          const currentVal = activeDecision.customWeights[key] !== undefined 
                            ? activeDecision.customWeights[key] 
                            : con.weight;
                          return (
                            <div key={con.id || conIdx} className="bg-rose-50/70 hover:bg-rose-50 border border-rose-100/70 rounded-xl p-2.5 space-y-1.5 transition-all shadow-xs">
                              <div className="flex items-start justify-between gap-1">
                                <span className="text-sm text-rose-950 font-medium leading-relaxed">{con.text}</span>
                                <span className="text-[10px] font-bold bg-white text-rose-800 px-1.5 py-0.5 rounded-md border border-rose-100 font-mono shrink-0 select-none">{con.impact}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <input
                                  type="range"
                                  min="1"
                                  max="5"
                                  step="1"
                                  value={currentVal}
                                  onChange={(e) => handleWeightChange(selectedOptionTab, 'con', conIdx, parseInt(e.target.value))}
                                  className="flex-grow h-1.5 bg-rose-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
                                />
                                <span className="text-[10px] font-mono font-bold text-rose-800 w-3 text-right">{currentVal}</span>
                              </div>
                            </div>
                          );
                        })}
                        {(activeDecision.analysis.optionAnalyses[selectedOptionTab]?.cons || []).length === 0 && (
                          <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-3 text-xs font-medium text-rose-900">
                            No cons returned for this option yet. Regenerate the analysis to create tunable factors.
                          </div>
                        )}
                      </div>
                    </div>
                </div>

                {/* 2. VERDICT / AI RECOMMENDATION */}
                <div className="lg:col-span-8 bg-zinc-900 rounded-3xl shadow-md p-6 md:p-8 text-white flex flex-col justify-between relative overflow-hidden space-y-6" id="bento-item-verdict">
                  {/* Decorative faint grid lines */}
                  <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-zinc-800/100 to-transparent pointer-events-none opacity-20"></div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between relative z-10">
                      <div className="inline-flex items-center gap-1 bg-zinc-800 px-2.5 py-1 rounded-lg text-[9px] font-bold tracking-widest uppercase text-emerald-400 border border-zinc-75/10">
                        <Brain className="w-3.5 h-3.5 fill-emerald-500/20" />
                        AI Tiebreaker Decision
                      </div>
                      <span className="text-zinc-500 text-[10px] font-mono">CONF-MTR v1.0</span>
                    </div>

                    <div className="space-y-1.5 relative z-10">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                        {isWeightedOverride ? 'Weighted Recommendation' : 'Chosen Recommendation'}
                      </p>
                      <h3 className="text-3xl md:text-4xl font-black font-display text-white leading-tight">
                        {weightedRecommendedOption}
                      </h3>
                      <p className="text-zinc-300 text-base leading-relaxed font-sans">
                        {weightedArgument}
                      </p>
                      {isWeightedOverride && (
                        <div className="inline-flex rounded-full bg-amber-400/10 border border-amber-300/20 px-3 py-1 text-xs font-bold text-amber-200">
                          Original AI verdict: {activeDecision.analysis.verdict.chosenOption}
                        </div>
                      )}
                    </div>

                    {/* Alert bullet: Watch out for */}
                    <div className="bg-amber-500/10 border border-amber-400/20 rounded-xl p-3 space-y-1 relative z-10">
                      <div className="flex items-center gap-1.5 text-amber-300">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[10px] font-bold uppercase tracking-wider font-display">Watch out for</span>
                      </div>
                      <p className="text-sm text-amber-100 leading-relaxed">
                        {weightedPrimaryRisk}
                      </p>
                    </div>

                    {/* Actionable items */}
                    <div className="space-y-2 relative z-10">
                      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest font-mono">Actionable next steps:</p>
                      <div className="space-y-2 text-sm text-zinc-200">
                        {weightedNextSteps.map((step, sIdx) => (
                          <div key={sIdx} className="flex items-start gap-3 bg-zinc-800/50 border border-white/10 px-3 py-3 rounded-xl">
                            <span className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0 font-mono">
                              {sIdx + 1}
                            </span>
                            <span className="leading-relaxed">{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-zinc-800 relative z-10">
                    <div className="flex justify-between text-[11px] font-bold uppercase text-zinc-400 font-display mb-1.5">
                      <span>{isWeightedOverride ? 'Weighted confidence' : 'Tiebreak confidence'}</span>
                      <span className="text-emerald-400">{weightedConfidence}% Recommend</span>
                    </div>
                    <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 transition-all duration-550 rounded-full"
                        style={{ width: `${weightedConfidence}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="relative z-10 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/70">
                    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Decision visual</p>
                        <p className="mt-1 text-sm font-semibold text-zinc-200">
                          Generate from the current recommendation
                        </p>
                        {decisionIllustration.source && (
                          <p className="mt-1 text-[11px] text-zinc-500">
                            Source: {decisionIllustration.source}
                            {decisionIllustration.model ? ` / ${decisionIllustration.model}` : ''}
                            {decisionIllustration.warning ? ` / fallback: ${decisionIllustration.warning}` : ''}
                          </p>
                        )}
                        {decisionIllustration.providerErrors && decisionIllustration.providerErrors.length > 0 && (
                          <p className="mt-1 text-[11px] text-amber-300/80">
                            {decisionIllustration.providerErrors.join(' | ')}
                          </p>
                        )}
                      </div>
                      {decisionIllustration.isLoading ? (
                        <RefreshCw className="w-4 h-4 text-emerald-300 animate-spin shrink-0" />
                      ) : (
                        <button
                          type="button"
                          onClick={handleGenerateDecisionIllustration}
                          disabled={!activeDecision || decisionIllustration.isLoading}
                          className="shrink-0 cursor-pointer rounded-xl bg-emerald-400 px-3 py-2 text-xs font-black text-zinc-950 hover:bg-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Generate visual
                        </button>
                      )}
                    </div>

                    <div className="relative aspect-[16/9] bg-zinc-900">
                      {(decisionIllustration.mediaUrl || decisionIllustration.dataUrl) && decisionIllustration.key === illustrationKey ? (
                        decisionIllustration.mimeType?.startsWith('video/') || decisionIllustration.mediaUrl ? (
                          <video
                            src={decisionIllustration.mediaUrl || decisionIllustration.dataUrl || ''}
                            className="h-full w-full object-cover"
                            autoPlay
                            loop
                            muted
                            playsInline
                            controls
                          />
                        ) : (
                          <img
                            src={decisionIllustration.dataUrl || ''}
                            alt={`Decision visual for ${leadingOptionObj?.optionName || activeDecision.analysis.verdict.chosenOption}`}
                            className="h-full w-full object-cover"
                          />
                        )
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                          <div className="w-16 h-16 rounded-2xl bg-zinc-800 border border-white/10 grid place-items-center">
                            {decisionIllustration.error ? (
                              <AlertTriangle className="w-7 h-7 text-amber-300" />
                            ) : (
                              <Sparkles className="w-7 h-7 text-emerald-300" />
                            )}
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-bold text-zinc-200">
                              {decisionIllustration.error ? "Visual unavailable" : "No visual yet"}
                            </p>
                            <p className="text-xs text-zinc-500 max-w-md">
                              {decisionIllustration.error || "Adjust weights until the decision feels right, then generate one visual interpretation. This may use image or video quota."}
                            </p>
                          </div>
                        </div>
                      )}

                      {decisionIllustration.isLoading && (
                        <div className="absolute inset-0 bg-zinc-950/45 backdrop-blur-[1px] flex items-center justify-center">
                          <div className="rounded-full bg-zinc-950/80 border border-white/10 px-4 py-2 text-xs font-bold text-emerald-200 flex items-center gap-2">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Generating visual
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. DECISION ARCHIVE */}
                <div className="lg:col-span-4 border border-zinc-200 rounded-3xl bg-white p-4" id="bento-item-history">
                  <SavedDecisions
                    savedDecisions={savedDecisions}
                    activeDecisionId={activeDecisionId}
                    onSelectDecision={handleSelectDecision}
                    onDeleteDecision={handleDeleteDecision}
                  />
                </div>

                {/* 3. COMPARISON DIMENSIONS TABLE */}
                <div className="lg:col-start-5 lg:col-span-8 border border-zinc-200 bg-white rounded-3xl p-5 shadow-xs overflow-hidden flex flex-col justify-between" id="bento-item-table">
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-5 bg-sky-500 rounded-full"></div>
                        <h3 className="font-bold text-zinc-800 font-display text-sm">Direct Comparison</h3>
                      </div>
                      <span className="inline-flex w-fit rounded-full bg-emerald-50 border border-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
                        Weighted leader: {weightedRecommendedOption} ({weightedConfidence}%)
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left border-collapse">
                        <thead>
                          <tr className="border-b border-zinc-100 text-zinc-400 font-medium">
                            <th className="pb-3 text-left font-display">Criterion Dimension</th>
                            {activeDecision.options.map((opt, i) => (
                              <th key={i} className="pb-3 text-center px-1 font-mono truncate max-w-[85px]" title={opt}>
                                {opt}
                              </th>
                            ))}
                            <th className="pb-3 text-right font-display pl-2">Advantage</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50">
                          {(activeDecision.analysis.comparisons || []).map((comp, idx) => {
                            // Find option of max score
                            const sortedRatings = [...comp.ratings].sort((a,b) => b.score - a.score);
                            const topRatedName = sortedRatings[0].score > sortedRatings[1]?.score ? sortedRatings[0].optionName : 'Tie';
                            
                            return (
                              <tr key={idx} className="hover:bg-zinc-50/50">
                                <td className="py-2.5 pr-2">
                                  <div className="font-bold text-zinc-800" title={comp.dimension}>{comp.dimension}</div>
                                  <div className="text-xs text-zinc-500 line-clamp-2 max-w-[220px]" title={comp.description}>{comp.description}</div>
                                </td>
                                {(comp.ratings || []).map((rt, rIdx) => (
                                  <td key={rIdx} className="py-2.5 text-center px-1">
                                    <span className="inline-block px-2 py-1 rounded-lg font-bold font-mono text-xs bg-zinc-100 text-zinc-800">
                                      {rt.score}/10
                                    </span>
                                  </td>
                                ))}
                                <td className="py-2.5 text-right pl-2 shrink-0">
                                  {topRatedName === weightedRecommendedOption ? (
                                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 rounded-full text-xs font-black tracking-tight truncate max-w-[110px] inline-block">
                                      {topRatedName}
                                    </span>
                                  ) : topRatedName === 'Tie' ? (
                                    <span className="bg-zinc-100 text-zinc-500 border border-zinc-200 px-2 py-1 rounded-full text-xs font-bold font-mono">
                                      Tie
                                    </span>
                                  ) : (
                                    <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-1 rounded-full text-xs font-black tracking-tight truncate max-w-[110px] inline-block">
                                      {topRatedName}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Visual Footer hint inside comparison table */}
                  <div className="pt-3 border-t border-zinc-100 text-[10px] text-zinc-400 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-zinc-300" />
                    <span>Table scores are the original AI comparison. The green leader badge reflects your current weight tuning.</span>
                  </div>
                </div>

              </main>

              <section className="border border-zinc-200 bg-white rounded-3xl p-5 md:p-6 shadow-xs space-y-4" id="bento-item-swot">
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-5 bg-emerald-500 rounded-full"></div>
                      <h3 className="font-bold text-zinc-800 font-display text-base">SWOT Matrix</h3>
                    </div>
                    <p className="text-sm text-zinc-500 leading-relaxed">
                      Supplemental strategy notes, moved below the core decision so it does not crowd the main reading path.
                    </p>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 font-mono">
                    Strategic appendix
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                  <div className="bg-teal-50/60 border border-teal-100 rounded-2xl p-4">
                    <span className="text-xs font-bold text-teal-800 uppercase tracking-wider font-mono">Strengths</span>
                    <div className="mt-2 space-y-2">
                      {(activeDecision.analysis.swot?.strengths || []).slice(0, 2).map((item, i) => (
                        <p key={i} className="text-sm text-teal-950 font-medium leading-relaxed">• {item}</p>
                      ))}
                    </div>
                  </div>

                  <div className="bg-rose-50/60 border border-rose-100 rounded-2xl p-4">
                    <span className="text-xs font-bold text-rose-800 uppercase tracking-wider font-mono">Weaknesses</span>
                    <div className="mt-2 space-y-2">
                      {(activeDecision.analysis.swot?.weaknesses || []).slice(0, 2).map((item, i) => (
                        <p key={i} className="text-sm text-rose-950 font-medium leading-relaxed">• {item}</p>
                      ))}
                    </div>
                  </div>

                  <div className="bg-sky-50/60 border border-sky-100 rounded-2xl p-4">
                    <span className="text-xs font-bold text-sky-800 uppercase tracking-wider font-mono">Opportunities</span>
                    <div className="mt-2 space-y-2">
                      {(activeDecision.analysis.swot?.opportunities || []).slice(0, 2).map((item, i) => (
                        <p key={i} className="text-sm text-sky-950 font-medium leading-relaxed">• {item}</p>
                      ))}
                    </div>
                  </div>

                  <div className="bg-amber-50/60 border border-amber-100 rounded-2xl p-4">
                    <span className="text-xs font-bold text-amber-800 uppercase tracking-wider font-mono">Threats</span>
                    <div className="mt-2 space-y-2">
                      {(activeDecision.analysis.swot?.threats || []).slice(0, 2).map((item, i) => (
                        <p key={i} className="text-sm text-amber-950 font-medium leading-relaxed">• {item}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {/* Bottom Footer Info Bar */}
              <footer className="pt-4 border-t border-zinc-200 flex flex-col md:flex-row items-center justify-between text-xs text-zinc-400 gap-3">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Interactive Tuning Available
                  </span>
                  <span className="hidden md:inline text-zinc-300">|</span>
                  <span className="font-mono text-[10px]">Session Key: TIE-{activeDecision.id.substring(4, 9).toUpperCase()}</span>
                </div>
                <div className="flex flex-wrap gap-4 uppercase tracking-widest font-bold text-[10px]">
                  <button onClick={resetWeights} className="hover:text-indigo-600 transition-colors select-none">
                    Restore Defaults
                  </button>
                  <button onClick={() => window.print()} className="hover:text-indigo-600 transition-colors select-none">
                    Print / Export PDF
                  </button>
                  <button onClick={() => setShowCreationForm(true)} className="hover:text-indigo-600 transition-colors select-none">
                    New Decision
                  </button>
                </div>
              </footer>
            </div>
          )
        )}
      </div>
    </div>
  );
}
