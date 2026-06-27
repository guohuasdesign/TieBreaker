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
  const [isDeepeningAnalysis, setIsDeepeningAnalysis] = useState(false);
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
  const [showLanding, setShowLanding] = useState(true);
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

  const resetDecisionIllustration = () => {
    setDecisionIllustration({
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
  };

  const startNewDecision = () => {
    setDraftDecision(null);
    setActiveDecisionId(null);
    setSelectedOptionTab(0);
    setIsDeepeningAnalysis(false);
    resetDecisionIllustration();
    setError(null);
    setShowLanding(false);
    setShowCreationForm(true);
  };

  const applyAnalysisUpdate = (decisionId: string, analysisResult: DecisionAnalysis) => {
    setDraftDecision((current) => {
      if (!current || current.id !== decisionId) return current;
      return {
        ...current,
        options: analysisResult.options,
        analysis: analysisResult,
        customWeights: {},
      };
    });

    setSavedDecisions((current) => {
      const updated = current.map((decision) => {
        if (decision.id !== decisionId) return decision;
        return {
          ...decision,
          options: analysisResult.options,
          analysis: analysisResult,
          customWeights: {},
        };
      });
      try {
        localStorage.setItem('the_tiebreaker_decisions', JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to persist updated analysis:", e);
      }
      return updated;
    });
  };

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
      setShowLanding(false);
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
    setIsDeepeningAnalysis(false);
    setError(null);

    try {
      const payload = {
        decision: decisionText,
        options,
        archetype,
        personalSituation
      };
      const quickResponse = await fetch('/api/analyze-decision-quick', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!quickResponse.ok) {
        const errorData = await quickResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status ${quickResponse.status}`);
      }

      const quickAnalysisResult = normalizeDecisionAnalysisForClient(
        await quickResponse.json(),
        decisionText,
        options,
        archetype
      );

      const newSaved: SavedDecision = {
        id: `dec_${Date.now()}`,
        title: decisionText,
        createdAt: new Date().toISOString(),
        options: quickAnalysisResult.options,
        archetype,
        personalSituation,
        analysis: quickAnalysisResult,
        customWeights: {},
      };

      setDraftDecision(newSaved);
      setActiveDecisionId(newSaved.id);
      setSelectedOptionTab(0);
      setShowLanding(false);
      setShowCreationForm(false);
      setIsLoading(false);

      setIsDeepeningAnalysis(true);
      fetch('/api/analyze-decision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
        .then(async (response) => {
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Server responded with status ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          const deepAnalysisResult = normalizeDecisionAnalysisForClient(
            data,
            decisionText,
            options,
            archetype
          );
          applyAnalysisUpdate(newSaved.id, deepAnalysisResult);
        })
        .catch((err: any) => {
          console.warn("Deep analysis update failed:", err?.message || err);
        })
        .finally(() => {
          setIsDeepeningAnalysis(false);
        });

    } catch (err: any) {
      console.error(err);
      setError(
        err.message || "An unexpected error occurred. Please make sure your ANTHROPIC_API_KEY is configured."
      );
      setIsLoading(false);
      setIsDeepeningAnalysis(false);
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
    setIsDeepeningAnalysis(false);
    setShowLanding(false);
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
    <div className="min-h-screen bg-[#ede9e0] text-[#0a0908] flex flex-col" id="app-root-container">

      {/* ── TOP NAV ── */}
      <header className="flex items-center justify-between px-6 md:px-10 py-4 border-b border-[#0a0908]/10 sticky top-0 bg-[#ede9e0]/92 backdrop-blur-sm z-40">
        <button
          type="button"
          onClick={() => {
            setShowLanding(true);
            setShowCreationForm(true);
            setError(null);
          }}
          className="flex cursor-pointer items-center gap-2.5 text-left"
        >
          <div className="w-6 h-6 bg-[#0a0908] rounded-sm flex items-center justify-center shrink-0">
            <Scale className="w-3.5 h-3.5 text-[#ede9e0]" />
          </div>
          <span className="font-display font-black text-sm tracking-tight uppercase">TIE BREAKER.</span>
        </button>
        <nav className="flex items-center gap-6">
          {activeDecision && !showCreationForm && (
            <span className="hidden md:block text-xs font-medium uppercase tracking-[0.18em] text-[#0a0908]/35 max-w-[260px] truncate">
              {activeDecision.title}
            </span>
          )}
          {!showLanding && !showCreationForm && (
            <button
              id="toggle-archive-view-btn"
              type="button"
              onClick={startNewDecision}
              className="cursor-pointer rounded-full bg-[#0a0908] px-4 py-2 text-xs font-black uppercase tracking-[0.15em] text-[#ede9e0] shadow-lg shadow-[#0a0908]/10 transition-all hover:bg-[#0a0908]/85"
            >
              Restart Decision
            </button>
          )}
        </nav>
      </header>

        {/* ── Global Error Notice ── */}
        {error && (
          <div className="mx-6 md:mx-10 mt-4 border border-[#0a0908]/15 rounded-xl p-4 flex items-start gap-3 bg-[#0a0908]/4" id="error-notice">
            <AlertTriangle className="w-4 h-4 text-[#0a0908]/50 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-black uppercase tracking-[0.15em]">Analysis Interrupted</h4>
              <p className="text-xs text-[#0a0908]/65 leading-relaxed">{error}</p>
              <p className="text-[11px] text-[#0a0908]/35 mt-1">
                Ensure <code className="font-mono bg-[#0a0908]/6 px-1 rounded">ANTHROPIC_API_KEY</code> is set in <code className="font-mono bg-[#0a0908]/6 px-1 rounded">.env.local</code>.
              </p>
            </div>
          </div>
        )}

        {/* ── Loading Overlay ── */}
        {isLoading && (
          <div className="fixed inset-0 z-50 bg-[#0a0908]/55 backdrop-blur-sm flex items-center justify-center px-4" id="ai-analysis-visual-loader">
            <div className="w-full max-w-2xl bg-[#ede9e0] rounded-2xl border border-[#0a0908]/10 overflow-hidden">
              <div className="relative bg-[#0a0908] text-[#ede9e0] p-6 md:p-8 overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-orange-400 via-pink-400 to-violet-400 decision-scan-line"></div>
                <div className="relative grid grid-cols-1 md:grid-cols-[180px_1fr] gap-6 items-center">
                  <div className="relative mx-auto w-36 h-36 shrink-0">
                    <div className="absolute inset-0 rounded-full border border-orange-400/25"></div>
                    <div className="absolute inset-4 rounded-full border border-pink-400/20 decision-orbit"></div>
                    <div className="absolute inset-8 rounded-full bg-[#0a0908] border border-[#ede9e0]/10 flex items-center justify-center">
                      <Brain className="w-12 h-12 text-orange-300" />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-orange-300">AI decision engine</p>
                      <h3 className="mt-2 text-2xl md:text-3xl font-display font-black leading-tight">Mapping tradeoffs</h3>
                      <p className="mt-2 text-sm text-[#ede9e0]/55 leading-relaxed">Building a quick verdict first. Deeper scoring will refine it after.</p>
                    </div>
                    <div className="grid grid-cols-4 gap-2 h-16 items-end">
                      {[72, 46, 88, 60].map((height, idx) => (
                        <div key={idx} className="bg-[#ede9e0]/6 rounded-lg p-1.5 flex items-end">
                          <div className="w-full rounded bg-gradient-to-t from-orange-400 to-pink-300 decision-rise"
                            style={{ height: `${height}%`, animationDelay: `${idx * 0.16}s` }} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-5 bg-[#ede9e0]">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.18em] text-[#0a0908]/40 mb-2">
                  <span>Generating quick recommendation</span>
                  <span>First pass</span>
                </div>
                <div className="h-1 w-full rounded-full bg-[#0a0908]/10 overflow-hidden">
                  <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-orange-400 via-pink-400 to-violet-400 decision-scan-line"></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Content ── */}
        {showLanding ? (
          <section className="hero-story-scene relative flex min-h-[calc(100vh-65px)] items-center overflow-hidden border-t border-[#0a0908]/10 bg-[#ede9e0] px-6 py-12 md:px-10 md:py-16" id="landing-hero">
              <div className="hero-horizon pointer-events-none absolute inset-0" />
              <div className="hero-path hero-path-left pointer-events-none absolute" />
              <div className="hero-path hero-path-right pointer-events-none absolute" />
              <div className="hero-choice-card hero-choice-card-left pointer-events-none absolute">
                <span>Option A</span>
                <strong>Stay steady</strong>
              </div>
              <div className="hero-choice-card hero-choice-card-right pointer-events-none absolute">
                <span>Option B</span>
                <strong>Step forward</strong>
              </div>
              <div className="gradient-orb orb-morph absolute left-1/2 top-[48%] h-[270px] w-[270px] -translate-x-1/2 -translate-y-1/2 opacity-82 pointer-events-none md:left-[61%] md:h-[440px] md:w-[440px]" />
              <div className="orb-ring hero-orb-ring absolute left-1/2 top-[48%] h-[410px] w-[410px] -translate-x-1/2 -translate-y-1/2 pointer-events-none md:left-[61%] md:h-[640px] md:w-[640px]" />
              <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col justify-center">
                <div className="mb-7 flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#0a0908] shadow-lg shadow-[#0a0908]/10">
                    <Scale className="h-6 w-6 text-[#ede9e0]" />
                  </div>
                  <div>
                    <p className="font-display text-3xl font-black tracking-tight text-[#0a0908] md:text-5xl">Tie Breaker</p>
                    <p className="mt-1 text-sm font-black uppercase tracking-[0.18em] text-orange-500 md:text-base">AI-powered decision support</p>
                  </div>
                </div>
                <h1 className="max-w-3xl font-display text-5xl font-black uppercase leading-[0.92] tracking-tight text-[#0a0908] sm:text-7xl md:text-8xl">
                  Break the <span className="text-orange-400">tie.</span>
                </h1>
                <p className="mt-6 max-w-xl text-base font-medium leading-relaxed text-[#0a0908]/48 md:text-lg">
                  Compare options, see trade-offs, and decide with clarity.
                </p>
                <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={startNewDecision}
                    className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#0a0908] px-6 py-3 text-sm font-black uppercase tracking-[0.12em] text-[#ede9e0] shadow-lg shadow-[#0a0908]/10 transition-all hover:bg-[#0a0908]/85 sm:w-auto"
                  >
                    Start a decision
                    <ChevronRight className="h-4 w-4 text-orange-400" />
                  </button>
                </div>
              </div>
            </section>
        ) : showCreationForm ? (
          <>
            <div id="creation-layout" className="grid min-h-[calc(100vh-72px)] grid-cols-1 border-t border-[#0a0908]/10 lg:grid-cols-[150px_1fr]">
              <aside className="hidden min-h-[calc(100vh-72px)] border-r border-[#0a0908]/8 bg-[#ede9e0]/55 px-4 lg:block">
                <nav className="sticky top-1/2 -translate-y-1/2 space-y-0.5">
                  <p className="mb-5 px-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#0a0908]/28">Sections</p>
                  {[
                    ['New Decision', Plus, 'new-decision-section'],
                    ['Examples', BookOpen, 'presets-container'],
                    ['Context', Calendar, 'personal-situation-group'],
                    ['Key Factors', TrendingUp, 'priority-factors-group'],
                    ['Options', FolderOpen, 'inputs-container'],
                    ['AI Lens', Sliders, 'ai-lens-section'],
                    ...(savedDecisions.length > 0 ? [['Archive', FolderOpen, 'creation-archive-section']] : []),
                  ].map(([label, Icon, target], index) => {
                    const NavIcon = Icon as typeof Plus;
                    return (
                      <button
                        key={label as string}
                        type="button"
                        onClick={() => {
                          document.getElementById(target as string)?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                          });
                        }}
                        className={`group flex w-full cursor-pointer items-center gap-2.5 px-1 py-2 text-left text-[10px] font-black uppercase tracking-[0.12em] transition-colors ${
                          index === 0
                            ? 'text-[#0a0908]'
                            : 'text-[#0a0908]/34 hover:text-[#0a0908]/65'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors ${index === 0 ? 'bg-orange-400' : 'bg-[#0a0908]/18 group-hover:bg-[#0a0908]/35'}`}></span>
                        <NavIcon className="h-3.5 w-3.5 shrink-0 opacity-45" />
                        <span className="truncate">{label as string}</span>
                      </button>
                    );
                  })}
                </nav>
              </aside>

              <main className="min-w-0 bg-white">
                <div className="px-0">
                  <DecisionForm onSubmit={handleAnalyzeDecision} isLoading={isLoading} />
                </div>

                {savedDecisions.length > 0 && (
                  <section id="creation-archive-section" className="border-t border-[#0a0908]/10 p-6 md:p-10">
                    <SavedDecisions
                      savedDecisions={savedDecisions}
                      activeDecisionId={activeDecisionId}
                      onSelectDecision={handleSelectDecision}
                      onDeleteDecision={handleDeleteDecision}
                    />
                  </section>
                )}
              </main>
            </div>
          </>
        ) : (
          /* ── Results Dashboard ── */
          activeDecision && (
            <div className="grid min-h-[calc(100vh-72px)] grid-cols-1 lg:grid-cols-[150px_1fr]" id="bento-dashboard-stage">
              <aside className="hidden min-h-[calc(100vh-72px)] border-r border-[#0a0908]/8 bg-[#ede9e0]/55 px-4 lg:block">
                <nav className="sticky top-1/2 -translate-y-1/2 space-y-0.5">
                  <p className="mb-5 px-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#0a0908]/28">Sections</p>
                  {[
                    ['Verdict', CheckCircle2, 'analysis-recommendation-section'],
                    ['SWOT', Shield, 'bento-item-swot'],
                    ['Comparison', Scale, 'analysis-comparison-section'],
                    ['Weights', Sliders, 'analysis-tuning-section'],
                    ['Archive', FolderOpen, 'bento-item-history'],
                  ].map(([label, Icon, target], index) => {
                    const NavIcon = Icon as typeof Plus;
                    return (
                      <button
                        key={label as string}
                        type="button"
                        onClick={() => {
                          document.getElementById(target as string)?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                          });
                        }}
                        className={`group flex w-full cursor-pointer items-center gap-2.5 px-1 py-2 text-left text-[10px] font-black uppercase tracking-[0.12em] transition-colors ${
                          index === 0
                            ? 'text-[#0a0908]'
                            : 'text-[#0a0908]/34 hover:text-[#0a0908]/65'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors ${index === 0 ? 'bg-orange-400' : 'bg-[#0a0908]/18 group-hover:bg-[#0a0908]/35'}`}></span>
                        <NavIcon className="h-3.5 w-3.5 shrink-0 opacity-45" />
                        <span className="truncate">{label as string}</span>
                      </button>
                    );
                  })}
                </nav>
              </aside>

              <div className="min-w-0">
              {/* Draft Banner */}
              {draftDecision && (
                <div className="mx-6 md:mx-10 mt-6 p-4 bg-[#0a0908]/4 border border-[#0a0908]/12 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4" id="draft-decision-banner">
                  <div className="flex gap-3 items-start">
                    <div className="w-7 h-7 bg-orange-400 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#0a0908]" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0a0908]/40">DRAFT PREVIEW</p>
                      <p className="text-xs text-[#0a0908]/58 leading-relaxed mt-0.5 max-w-xl">New analysis ready. Tune weights or save to archive.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <button id="discard-draft-btn" type="button" onClick={handleDiscardDraft}
                      className="cursor-pointer text-xs font-black uppercase tracking-[0.12em] px-3 py-1.5 border border-[#0a0908]/15 hover:bg-[#0a0908]/5 rounded-lg transition-colors flex items-center gap-1.5">
                      <Trash2 className="w-3 h-3" />Discard
                    </button>
                    <button id="save-draft-btn" type="button" onClick={handleSaveDraft}
                      className="cursor-pointer text-xs font-black uppercase tracking-[0.12em] px-3 py-1.5 bg-[#0a0908] text-[#ede9e0] hover:bg-[#0a0908]/80 rounded-lg transition-colors flex items-center gap-1.5">
                      <Check className="w-3 h-3" />Save
                    </button>
                  </div>
                </div>
              )}

              {/* ── Editorial Verdict Hero ── */}
              <section className="relative px-6 md:px-10 py-12 md:py-16 overflow-hidden border-b border-[#0a0908]/10">
                <div className="gradient-orb orb-breathe absolute -right-20 -top-20 w-72 h-72 md:w-[420px] md:h-[420px] opacity-38 pointer-events-none" />
                <div className="orb-ring absolute -right-28 -top-28 w-[420px] h-[420px] md:w-[580px] md:h-[580px] pointer-events-none" />
                <div className="relative z-10 max-w-7xl mx-auto">
                  {/* Archetype switcher + actions */}
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-10" id="ai-persona-toggles-bar">
                    <div className="flex flex-wrap gap-1.5">
                      {ARCHETYPES.map((arch) => {
                        const isCurrentActive = activeDecision.archetype === arch.id;
                        return (
                          <button key={arch.id} id={`perspective-btn-${arch.id}`} type="button"
                            disabled={isLoading} onClick={() => handleSwitchArchetype(arch.id)}
                            className={`cursor-pointer px-3 py-1.5 rounded-full border text-xs font-bold uppercase tracking-[0.1em] transition-all select-none ${
                              isCurrentActive
                                ? 'bg-[#0a0908] text-[#ede9e0] border-transparent'
                                : 'border-[#0a0908]/18 text-[#0a0908]/55 hover:border-[#0a0908]/35 hover:text-[#0a0908] disabled:opacity-40'
                            }`}>
                            {arch.emoji} {arch.name}
                            {isCurrentActive && isLoading && <RefreshCw className="inline w-3 h-3 ml-1.5 animate-spin" />}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-5">
                      <button type="button" id="reset-weights-btn" onClick={resetWeights}
                        className="cursor-pointer text-[11px] font-bold uppercase tracking-[0.15em] text-[#0a0908]/38 hover:text-[#0a0908] transition-colors flex items-center gap-1.5">
                        <RotateCcw className="w-3 h-3" />Reset
                      </button>
                      <button type="button" id="restart-decision-btn"
                        onClick={startNewDecision}
                        className="cursor-pointer rounded-full bg-[#0a0908] px-4 py-2 text-[11px] font-black uppercase tracking-[0.15em] text-[#ede9e0] shadow-lg shadow-[#0a0908]/10 transition-colors hover:bg-[#0a0908]/85 flex items-center gap-1.5">
                        <Plus className="w-3 h-3 text-orange-300" />Start over
                      </button>
                    </div>
                  </div>
                  {/* Verdict */}
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-end">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#0a0908]/38 mb-4 flex items-center gap-3">
                        <span className="inline-block w-8 h-px bg-[#0a0908]/20"></span>
                        {verdictTone} · {isWeightedOverride ? 'Weighted Recommendation' : `${currentArchetypeConfig?.name} Lens`}
                      </p>
                      <h2 className="text-[48px] md:text-[68px] lg:text-[84px] font-display font-black uppercase leading-none tracking-tight">
                        {weightedRecommendedOption}
                      </h2>
                      {isWeightedOverride && (
                        <p className="text-xs text-[#0a0908]/38 mt-2 uppercase tracking-[0.15em]">
                          Original AI verdict: {activeDecision.analysis.verdict.chosenOption}
                        </p>
                      )}
                      <p className="mt-5 text-base md:text-lg text-[#0a0908]/62 max-w-2xl leading-relaxed">{weightedArgument}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#0a0908]/28 mb-1">Confidence</p>
                      <p className="text-[76px] md:text-[96px] font-display font-black leading-none text-orange-400">
                        {confidence}<span className="text-2xl font-display font-black">%</span>
                      </p>
                      <div className="flex justify-end gap-4 mt-2 text-xs text-[#0a0908]/35 font-bold uppercase tracking-[0.12em]">
                        <span>{topComparisonWins[weightedRecommendedOption] || 0}/{activeDecision.analysis.comparisons?.length || 0} criteria</span>
                        <span>{activeDecision.options.length} options</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* ── Full Page Analysis Workspace ── */}
              <main className="w-full" id="analysis-workspace">
              <div className="flex flex-col" id="analysis-sections">

                {/* 1. WEIGHTS TUNER */}
                <section className="order-4 border-t border-[#0a0908]/10 bg-[#ede9e0] px-6 py-10 md:px-10 md:py-12" id="analysis-tuning-section">
                  <div className="mx-auto flex w-full max-w-7xl flex-col gap-7" id="bento-item-tuner">
                    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                      <div className="max-w-2xl">
                        <div className="mb-3 flex items-center gap-2">
                          <div className="h-5 w-1 rounded-full bg-orange-400"></div>
                          <h3 className="font-display text-xs font-black uppercase tracking-[0.14em] text-[#0a0908]">Weights Tuner</h3>
                        </div>
                        <p className="text-sm leading-relaxed text-[#0a0908]/52">
                          Adjust the importance of each pro and con. Scores update across every option, so the tuner works as a full-page comparison tool on desktop and mobile.
                        </p>
                      </div>
                      {leadingOptionObj && (
                        <div className="w-full border border-orange-200 bg-orange-50 px-4 py-3 md:w-auto">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-700">Current leader</p>
                          <p className="mt-1 text-lg font-black text-[#0a0908]">{leadingOptionObj.optionName} · {leadingOptionObj.score}%</p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4" id="tuner-option-strength">
                      {recalculatedScores.map((calc, idx) => {
                        const isLeader = leadingOptionObj?.optionName === calc.optionName;
                        return (
                          <div key={idx} className={`border p-4 ${isLeader ? 'border-orange-300 bg-orange-50' : 'border-[#0a0908]/10 bg-white/55'}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-black text-[#0a0908]" title={calc.optionName}>{calc.optionName}</p>
                                <p className="mt-1 text-[11px] font-semibold text-[#0a0908]/42">Pros {calc.proPower} / Cons {calc.conPower}</p>
                              </div>
                              <span className={`text-2xl font-black ${isLeader ? 'text-orange-500' : 'text-[#0a0908]/35'}`}>{calc.score}%</span>
                            </div>
                            <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-[#0a0908]/8">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${isLeader ? 'bg-orange-400' : 'bg-[#0a0908]/25'}`}
                                style={{ width: `${calc.score}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2" id="sliders-scroller">
                      {activeDecision.analysis.optionAnalyses.map((option, optIdx) => {
                        const score = recalculatedScores[optIdx];
                        const isLeader = leadingOptionObj?.optionName === option.optionName;
                        return (
                          <section key={option.optionName || optIdx} className="border border-[#0a0908]/10 bg-white/55 p-4 md:p-5">
                            <div className="mb-5 flex flex-col gap-3 border-b border-[#0a0908]/8 pb-4 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0a0908]/35">Option {String.fromCharCode(65 + optIdx)}</p>
                                <h4 className="mt-1 truncate font-display text-xl font-black text-[#0a0908]" title={option.optionName}>{option.optionName}</h4>
                                {option.motto && <p className="mt-1 text-xs font-semibold text-[#0a0908]/45">{option.motto}</p>}
                              </div>
                              <div className={`shrink-0 px-3 py-2 text-right ${isLeader ? 'bg-orange-50 text-orange-700' : 'bg-[#0a0908]/5 text-[#0a0908]/50'}`}>
                                <p className="text-[10px] font-black uppercase tracking-[0.14em]">Score</p>
                                <p className="text-xl font-black">{score?.score ?? 0}%</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              <div className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-black uppercase tracking-[0.14em] text-orange-600">Pros Weight</span>
                                  <span className="text-[10px] font-mono text-[#0a0908]/35">1-5</span>
                                </div>
                                {(option.pros || []).map((pro, proIdx) => {
                                  const key = `${optIdx}-pro-${proIdx}`;
                                  const currentVal = activeDecision.customWeights[key] !== undefined
                                    ? activeDecision.customWeights[key]
                                    : pro.weight;
                                  return (
                                    <div key={pro.id || proIdx} className="border border-orange-100 bg-orange-50/65 p-3">
                                      <div className="flex items-start justify-between gap-2">
                                        <span className="text-sm font-medium leading-relaxed text-[#0a0908]">{pro.text}</span>
                                        <span className="shrink-0 border border-orange-100 bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold text-orange-700">{pro.impact}</span>
                                      </div>
                                      <div className="mt-3 flex items-center gap-3">
                                        <input
                                          type="range"
                                          min="1"
                                          max="5"
                                          step="1"
                                          value={currentVal}
                                          onChange={(e) => handleWeightChange(optIdx, 'pro', proIdx, parseInt(e.target.value))}
                                          className="h-1.5 flex-grow cursor-pointer appearance-none rounded-lg bg-orange-200 accent-orange-500"
                                        />
                                        <span className="w-4 text-right font-mono text-xs font-black text-orange-700">{currentVal}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              <div className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[#0a0908]/55">Cons Weight</span>
                                  <span className="text-[10px] font-mono text-[#0a0908]/35">1-5</span>
                                </div>
                                {(option.cons || []).map((con, conIdx) => {
                                  const key = `${optIdx}-con-${conIdx}`;
                                  const currentVal = activeDecision.customWeights[key] !== undefined
                                    ? activeDecision.customWeights[key]
                                    : con.weight;
                                  return (
                                    <div key={con.id || conIdx} className="border border-[#0a0908]/8 bg-[#0a0908]/4 p-3">
                                      <div className="flex items-start justify-between gap-2">
                                        <span className="text-sm font-medium leading-relaxed text-[#0a0908]">{con.text}</span>
                                        <span className="shrink-0 border border-[#0a0908]/10 bg-[#ede9e0] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#0a0908]/60">{con.impact}</span>
                                      </div>
                                      <div className="mt-3 flex items-center gap-3">
                                        <input
                                          type="range"
                                          min="1"
                                          max="5"
                                          step="1"
                                          value={currentVal}
                                          onChange={(e) => handleWeightChange(optIdx, 'con', conIdx, parseInt(e.target.value))}
                                          className="h-1.5 flex-grow cursor-pointer appearance-none rounded-lg bg-[#0a0908]/15 accent-[#0a0908]"
                                        />
                                        <span className="w-4 text-right font-mono text-xs font-black text-[#0a0908]/55">{currentVal}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  </div>
                </section>

                {/* 2. VERDICT / AI RECOMMENDATION */}
                <section className="order-1 bg-[#0a0908] px-6 py-10 text-[#ede9e0] md:px-10 md:py-12" id="analysis-recommendation-section">
                <div className="mx-auto flex w-full max-w-7xl flex-col justify-between gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3 relative z-10">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center gap-1.5 bg-[#ede9e0]/8 px-2.5 py-1 rounded-lg text-[9px] font-bold tracking-widest uppercase text-orange-300 border border-[#ede9e0]/10">
                          <Brain className="w-3.5 h-3.5" />
                          AI Tiebreaker Decision
                        </div>
                        {isDeepeningAnalysis && (
                          <div className="inline-flex items-center gap-1.5 bg-orange-300/12 px-2.5 py-1 rounded-lg text-[9px] font-bold tracking-widest uppercase text-orange-200 border border-orange-200/15">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            Refining full analysis
                          </div>
                        )}
                        {!isDeepeningAnalysis && activeDecision.analysis.analysisProvider?.includes('quick') && (
                          <div className="inline-flex items-center gap-1.5 bg-[#ede9e0]/8 px-2.5 py-1 rounded-lg text-[9px] font-bold tracking-widest uppercase text-[#ede9e0]/45 border border-[#ede9e0]/10">
                            Quick draft
                          </div>
                        )}
                      </div>
                      <span className="text-[#ede9e0]/30 text-[10px] font-mono">CONF-MTR v1.0</span>
                    </div>

                    <div className="space-y-1.5 relative z-10">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-orange-400">
                        {isWeightedOverride ? 'Weighted Recommendation' : 'Chosen Recommendation'}
                      </p>
                      <h3 className="text-3xl md:text-4xl font-black font-display text-[#ede9e0] leading-tight">
                        {weightedRecommendedOption}
                      </h3>
                      <p className="text-[#ede9e0]/65 text-base leading-relaxed font-sans">
                        {weightedArgument}
                      </p>
                      {isWeightedOverride && (
                        <div className="inline-flex rounded-full bg-orange-400/10 border border-orange-300/20 px-3 py-1 text-xs font-bold text-orange-200">
                          Original AI verdict: {activeDecision.analysis.verdict.chosenOption}
                        </div>
                      )}
                    </div>

                    {/* Alert: Watch out for */}
                    <div className="bg-[#ede9e0]/5 border border-[#ede9e0]/10 rounded-xl p-3 space-y-1 relative z-10">
                      <div className="flex items-center gap-1.5 text-orange-300">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[10px] font-bold uppercase tracking-wider font-display">Watch out for</span>
                      </div>
                      <p className="text-sm text-[#ede9e0]/70 leading-relaxed">
                        {weightedPrimaryRisk}
                      </p>
                    </div>

                    {/* Actionable items */}
                    <div className="space-y-2 relative z-10">
                      <p className="text-xs font-semibold text-[#ede9e0]/35 uppercase tracking-widest font-mono">Actionable next steps:</p>
                      <div className="space-y-2 text-sm text-[#ede9e0]/80">
                        {weightedNextSteps.map((step, sIdx) => (
                          <div key={sIdx} className="flex items-start gap-3 bg-[#ede9e0]/5 border border-[#ede9e0]/8 px-3 py-3 rounded-xl">
                            <span className="w-6 h-6 rounded-full bg-orange-400 flex items-center justify-center text-xs font-bold text-[#0a0908] shrink-0 font-mono">
                              {sIdx + 1}
                            </span>
                            <span className="leading-relaxed">{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#ede9e0]/10 relative z-10">
                    <div className="flex justify-between text-[11px] font-bold uppercase text-[#ede9e0]/35 font-display mb-1.5">
                      <span>{isWeightedOverride ? 'Weighted confidence' : 'Tiebreak confidence'}</span>
                      <span className="text-orange-400">{weightedConfidence}% Recommend</span>
                    </div>
                    <div className="h-2 w-full bg-[#ede9e0]/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-400 transition-all duration-550 rounded-full"
                        style={{ width: `${weightedConfidence}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="relative z-10 overflow-hidden rounded-2xl border border-[#ede9e0]/10 bg-[#ede9e0]/5">
                    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#ede9e0]/8">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#ede9e0]/35">Decision visual</p>
                        <p className="mt-1 text-sm font-semibold text-[#ede9e0]/80">
                          Generate from the current recommendation
                        </p>
                        {decisionIllustration.source && (
                          <p className="mt-1 text-[11px] text-[#ede9e0]/35">
                            Source: {decisionIllustration.source}
                            {decisionIllustration.model ? ` / ${decisionIllustration.model}` : ''}
                            {decisionIllustration.warning ? ` / fallback: ${decisionIllustration.warning}` : ''}
                          </p>
                        )}
                        {decisionIllustration.providerErrors && decisionIllustration.providerErrors.length > 0 && (
                          <p className="mt-1 text-[11px] text-orange-300/80">
                            {decisionIllustration.providerErrors.join(' | ')}
                          </p>
                        )}
                      </div>
                      {decisionIllustration.isLoading ? (
                        <RefreshCw className="w-4 h-4 text-orange-300 animate-spin shrink-0" />
                      ) : (
                        <button
                          type="button"
                          onClick={handleGenerateDecisionIllustration}
                          disabled={!activeDecision || decisionIllustration.isLoading}
                          className="shrink-0 cursor-pointer rounded-xl bg-orange-400 px-3 py-2 text-xs font-black text-[#0a0908] hover:bg-orange-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Generate visual
                        </button>
                      )}
                    </div>

                    <div className="relative aspect-[16/9] bg-[#0a0908]/40">
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
                          <div className="w-16 h-16 rounded-2xl bg-[#ede9e0]/8 border border-[#ede9e0]/10 grid place-items-center">
                            {decisionIllustration.error ? (
                              <AlertTriangle className="w-7 h-7 text-orange-300" />
                            ) : (
                              <Sparkles className="w-7 h-7 text-orange-300" />
                            )}
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-bold text-[#ede9e0]/70">
                              {decisionIllustration.error ? "Visual unavailable" : "No visual yet"}
                            </p>
                            <p className="text-xs text-[#ede9e0]/35 max-w-md">
                              {decisionIllustration.error || "Adjust weights until the decision feels right, then generate one visual interpretation. This may use image or video quota."}
                            </p>
                          </div>
                        </div>
                      )}

                      {decisionIllustration.isLoading && (
                        <div className="absolute inset-0 bg-[#0a0908]/50 backdrop-blur-[1px] flex items-center justify-center">
                          <div className="rounded-full bg-[#0a0908]/80 border border-[#ede9e0]/10 px-4 py-2 text-xs font-bold text-orange-200 flex items-center gap-2">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Generating visual
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                </section>

                <section className="order-2 border-t border-[#ede9e0]/10 bg-[#0a0908] px-6 pb-10 text-[#ede9e0] md:px-10" id="bento-item-swot">
                  <div className="mx-auto w-full max-w-7xl">
                    <div className="mb-5 flex items-center gap-2">
                      <div className="h-4 w-1 rounded-full bg-orange-400"></div>
                      <h3 className="text-xs font-black uppercase tracking-[0.12em] text-[#ede9e0]">SWOT Overview</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {[
                        ['Strengths', activeDecision.analysis.swot?.strengths || [], 'text-green-300'],
                        ['Weaknesses', activeDecision.analysis.swot?.weaknesses || [], 'text-rose-300'],
                        ['Opportunities', activeDecision.analysis.swot?.opportunities || [], 'text-sky-300'],
                        ['Threats', activeDecision.analysis.swot?.threats || [], 'text-amber-300'],
                      ].map(([label, items, color]) => (
                        <div key={label as string} className="border border-[#ede9e0]/10 bg-[#ede9e0]/5 p-4">
                          <span className={`text-[10px] font-bold uppercase tracking-[0.15em] ${color as string}`}>{label as string}</span>
                          <div className="mt-2 space-y-1.5">
                            {(items as string[]).slice(0, 2).map((item, i) => (
                              <p key={i} className="text-xs leading-relaxed text-[#ede9e0]/62">• {item}</p>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* 3. DECISION ARCHIVE */}
                <div className="order-5 border-t border-[#0a0908]/10 bg-[#ede9e0] p-6 md:p-10" id="bento-item-history">
                  <SavedDecisions
                    savedDecisions={savedDecisions}
                    activeDecisionId={activeDecisionId}
                    onSelectDecision={handleSelectDecision}
                    onDeleteDecision={handleDeleteDecision}
                  />
                </div>

                {/* 4. COMPARISON DIMENSIONS TABLE */}
                <section className="order-3 border-t border-[#0a0908]/10 bg-white px-6 py-8 md:px-10" id="analysis-comparison-section">
                <div className="mx-auto w-full max-w-7xl overflow-hidden p-0" id="bento-item-table">
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-4 bg-[#0a0908]/25 rounded-full"></div>
                        <h3 className="font-black text-[#0a0908] font-display text-xs uppercase tracking-[0.1em]">Direct Comparison</h3>
                      </div>
                      <span className="inline-flex w-fit rounded-full bg-orange-50 border border-orange-200 px-3 py-1 text-xs font-black text-orange-700">
                        Weighted leader: {weightedRecommendedOption} ({weightedConfidence}%)
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left border-collapse">
                        <thead>
                          <tr className="border-b border-[#0a0908]/8 text-[#0a0908]/40 font-medium">
                            <th className="pb-3 text-left font-display text-xs uppercase tracking-wider">Criterion</th>
                            {activeDecision.options.map((opt, i) => (
                              <th key={i} className="pb-3 text-center px-1 font-mono text-xs truncate max-w-[85px]" title={opt}>
                                {opt}
                              </th>
                            ))}
                            <th className="pb-3 text-right font-display text-xs uppercase tracking-wider pl-2">Advantage</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#0a0908]/5">
                          {(activeDecision.analysis.comparisons || []).map((comp, idx) => {
                            const sortedRatings = [...comp.ratings].sort((a,b) => b.score - a.score);
                            const topRatedName = sortedRatings[0].score > sortedRatings[1]?.score ? sortedRatings[0].optionName : 'Tie';

                            return (
                              <tr key={idx} className="hover:bg-[#0a0908]/3">
                                <td className="py-2.5 pr-2">
                                  <div className="font-bold text-[#0a0908]" title={comp.dimension}>{comp.dimension}</div>
                                  <div className="text-xs text-[#0a0908]/45 line-clamp-2 max-w-[220px]" title={comp.description}>{comp.description}</div>
                                </td>
                                {(comp.ratings || []).map((rt, rIdx) => (
                                  <td key={rIdx} className="py-2.5 text-center px-1">
                                    <span className="inline-block px-2 py-1 rounded-lg font-bold font-mono text-xs bg-[#0a0908]/6 text-[#0a0908]">
                                      {rt.score}/10
                                    </span>
                                  </td>
                                ))}
                                <td className="py-2.5 text-right pl-2 shrink-0">
                                  {topRatedName === weightedRecommendedOption ? (
                                    <span className="bg-orange-50 text-orange-700 border border-orange-200 px-2 py-1 rounded-full text-xs font-black tracking-tight truncate max-w-[110px] inline-block">
                                      {topRatedName}
                                    </span>
                                  ) : topRatedName === 'Tie' ? (
                                    <span className="bg-[#0a0908]/5 text-[#0a0908]/45 border border-[#0a0908]/10 px-2 py-1 rounded-full text-xs font-bold font-mono">
                                      Tie
                                    </span>
                                  ) : (
                                    <span className="bg-[#0a0908]/8 text-[#0a0908]/70 border border-[#0a0908]/12 px-2 py-1 rounded-full text-xs font-black tracking-tight truncate max-w-[110px] inline-block">
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

                  <div className="pt-3 border-t border-[#0a0908]/8 text-[10px] text-[#0a0908]/35 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-[#0a0908]/25" />
                    <span>Table scores are the original AI comparison. The orange leader badge reflects your current weight tuning.</span>
                  </div>
                </div>
                </section>

              </div>
              </main>

              {/* ── Footer ── */}
              <footer className="px-6 md:px-10 py-5 border-t border-[#0a0908]/10 flex flex-col md:flex-row items-center justify-between text-[11px] text-[#0a0908]/32 gap-3">
                <div className="flex items-center gap-4 uppercase tracking-[0.15em] font-bold">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse"></span>
                    Live Tuning
                  </span>
                  <span className="hidden md:inline text-[#0a0908]/15">|</span>
                  <span className="font-mono text-[10px]">TIE-{activeDecision.id.substring(4, 9).toUpperCase()}</span>
                </div>
                <div className="flex flex-wrap gap-5 uppercase tracking-[0.15em] font-bold text-[10px]">
                  <button type="button" onClick={resetWeights} className="hover:text-[#0a0908] transition-colors cursor-pointer">Restore Defaults</button>
                  <button type="button" onClick={() => window.print()} className="hover:text-[#0a0908] transition-colors cursor-pointer">Print / Export</button>
                  <button type="button" onClick={startNewDecision} className="hover:text-[#0a0908] transition-colors cursor-pointer">New Decision</button>
                </div>
              </footer>
              </div>
            </div>
          )
        )}
    </div>
  );
}
