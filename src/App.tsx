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
  Award,
  BookOpen
} from 'lucide-react';
import {
  DecisionAnalysis,
  SavedDecision,
  DecisionArchetype,
  ProOrConItem
} from './types';
import DecisionForm from './components/DecisionForm';
import SavedDecisions from './components/SavedDecisions';
import { ARCHETYPES } from './components/ArchetypeSelector';

export default function App() {
  const [savedDecisions, setSavedDecisions] = useState<SavedDecision[]>([]);
  const [activeDecisionId, setActiveDecisionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Creation state
  const [showCreationForm, setShowCreationForm] = useState(true);

  // Active view option index for the pros & cons widget
  const [selectedOptionTab, setSelectedOptionTab] = useState<number>(0);

  // Load from LocalStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('the_tiebreaker_decisions');
      if (stored) {
        const parsed = JSON.parse(stored) as SavedDecision[];
        setSavedDecisions(parsed);
        if (parsed.length > 0) {
          setActiveDecisionId(parsed[0].id);
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

      const analysisResult = (await response.json()) as DecisionAnalysis;

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
        err.message || "An unexpected error occurred. Please make sure your GEMINI_API_KEY is configured in Secrets."
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

      const analysisResult = (await response.json()) as DecisionAnalysis;

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
        err.message || "An unexpected error occurred during role transition. Ensure your GEMINI_API_KEY is configured."
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

    return activeDecision.analysis.optionAnalyses.map((opt, optIdx) => {
      let totalProPower = 0;
      let totalConPower = 0;

      opt.pros.forEach((pro, proIdx) => {
        const customWeight = activeDecision.customWeights[`${optIdx}-pro-${proIdx}`];
        const multiplier = customWeight !== undefined ? customWeight : pro.weight;
        const impactValue = pro.impact === 'High' ? 1.5 : pro.impact === 'Medium' ? 1.0 : 0.6;
        totalProPower += multiplier * impactValue;
      });

      opt.cons.forEach((con, conIdx) => {
        const customWeight = activeDecision.customWeights[`${optIdx}-con-${conIdx}`];
        const multiplier = customWeight !== undefined ? customWeight : con.weight;
        const impactValue = con.impact === 'High' ? 1.5 : con.impact === 'Medium' ? 1.0 : 0.6;
        totalConPower += multiplier * impactValue;
      });

      // Calculate health/appeal score
      const totalRatio = totalProPower + totalConPower;
      const baseScore = totalRatio > 0 ? (totalProPower / totalRatio) * 100 : 50;
      
      return {
        optionName: opt.optionName,
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
                Tip: Ensure you have added your <code className="font-mono bg-rose-100/50 px-1 py-0.5 rounded text-rose-800">GEMINI_API_KEY</code> in the Secrets menu.
              </p>
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

              {/* Bento Grid Core Structure */}
              <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5" id="bento-main-grid">
                
                {/* 1. ARCHIVE & TUNER SELECTOR: col-span-4 row-span-4 */}
                <div className="lg:col-span-4 space-y-5 flex flex-col">
                  {/* Saved History Mini-Sider */}
                  <div className="border border-zinc-200 rounded-3xl bg-white p-4" id="bento-item-history">
                    <SavedDecisions
                      savedDecisions={savedDecisions}
                      activeDecisionId={activeDecisionId}
                      onSelectDecision={handleSelectDecision}
                      onDeleteDecision={handleDeleteDecision}
                    />
                  </div>

                  {/* Options Tuner Selector: Pro & Con slider weight setup */}
                  <div className="border border-zinc-200 rounded-3xl bg-white p-5 flex-grow space-y-4 shadow-xs" id="bento-item-tuner">
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-5 bg-indigo-500 rounded-full"></div>
                        <h3 className="font-bold text-zinc-800 font-display text-sm">Weights Tuner</h3>
                      </div>
                      <span className="text-[10px] bg-amber-50 border border-amber-100 text-amber-700 font-mono px-2 py-0.5 rounded-full select-none">
                        Interactive
                      </span>
                    </div>

                    <p className="text-xs text-zinc-500 leading-normal">
                      Adjust the individual priority weights (1-5) below. Watch internal AI scores shift dynamically!
                    </p>

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

                    {/* Tuning Container */}
                    <div className="space-y-4 mt-2 max-h-[350px] overflow-y-auto pr-1" id="sliders-scroller">
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-widest font-display">Pros Weight Factor</span>
                          <span className="text-[10px] text-zinc-400 font-mono">Set priority</span>
                        </div>
                        {activeDecision.analysis.optionAnalyses[selectedOptionTab]?.pros.map((pro, proIdx) => {
                          const key = `${selectedOptionTab}-pro-${proIdx}`;
                          const currentVal = activeDecision.customWeights[key] !== undefined 
                            ? activeDecision.customWeights[key] 
                            : pro.weight;
                          return (
                            <div key={pro.id || proIdx} className="bg-emerald-50/50 hover:bg-emerald-50 border border-emerald-100/50 rounded-xl p-2.5 space-y-1.5 transition-all">
                              <div className="flex items-start justify-between gap-1">
                                <span className="text-xs text-emerald-950 font-medium leading-relaxed leading-snug">{pro.text}</span>
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
                      </div>

                      <div className="space-y-2.5 pt-2 border-t border-zinc-100">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-rose-700 uppercase tracking-widest font-display">Cons Weight Factor</span>
                        </div>
                        {activeDecision.analysis.optionAnalyses[selectedOptionTab]?.cons.map((con, conIdx) => {
                          const key = `${selectedOptionTab}-con-${conIdx}`;
                          const currentVal = activeDecision.customWeights[key] !== undefined 
                            ? activeDecision.customWeights[key] 
                            : con.weight;
                          return (
                            <div key={con.id || conIdx} className="bg-rose-50/50 hover:bg-rose-50 border border-rose-100/50 rounded-xl p-2.5 space-y-1.5 transition-all">
                              <div className="flex items-start justify-between gap-1">
                                <span className="text-xs text-rose-950 font-medium leading-snug">{con.text}</span>
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
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. VERDICT / AI RECOMMENDATION: col-span-5 row-span-3 */}
                <div className="lg:col-span-5 bg-zinc-900 rounded-3xl shadow-md p-6 text-white flex flex-col justify-between relative overflow-hidden space-y-5" id="bento-item-verdict">
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
                      <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Chosen Recommendation</p>
                      <h3 className="text-xl font-black font-display text-white leading-normal">
                        {activeDecision.analysis.verdict.chosenOption}
                      </h3>
                      <p className="text-zinc-300 text-xs leading-relaxed font-sans">
                        {activeDecision.analysis.verdict.mainArgument}
                      </p>
                    </div>

                    {/* Alert bullet: Watch out for */}
                    <div className="bg-amber-500/10 border border-amber-400/20 rounded-xl p-3 space-y-1 relative z-10">
                      <div className="flex items-center gap-1.5 text-amber-300">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[10px] font-bold uppercase tracking-wider font-display">Watch out for</span>
                      </div>
                      <p className="text-[11px] text-amber-200/90 leading-relaxed font-mono">
                        {activeDecision.analysis.verdict.whatToWatchOutFor}
                      </p>
                    </div>

                    {/* Actionable items */}
                    <div className="space-y-2 relative z-10">
                      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest font-mono">Actionable next steps:</p>
                      <div className="space-y-1.5 text-xs text-zinc-200">
                        {activeDecision.analysis.verdict.actionableNextSteps.map((step, sIdx) => (
                          <div key={sIdx} className="flex items-start gap-2 bg-zinc-800/40 border border-zinc-85/10 px-2.5 py-2 rounded-lg">
                            <span className="w-4 h-4 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-emerald-400 shrink-0 font-mono">
                              {sIdx + 1}
                            </span>
                            <span className="leading-snug">{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-zinc-800 relative z-10">
                    <div className="flex justify-between text-[11px] font-bold uppercase text-zinc-400 font-display mb-1.5">
                      <span>Tiebreak confidence</span>
                      <span className="text-emerald-400">{activeDecision.analysis.verdict.confidenceScore}% Recommend</span>
                    </div>
                    <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 transition-all duration-550 rounded-full"
                        style={{ width: `${activeDecision.analysis.verdict.confidenceScore}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* 3. SWOT MATRIX: col-span-3 row-span-3 */}
                <div className="lg:col-span-3 border border-zinc-200 bg-white rounded-3xl p-5 shadow-xs flex flex-col justify-between" id="bento-item-swot">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-5 bg-emerald-500 rounded-full"></div>
                      <h3 className="font-bold text-zinc-800 font-display text-sm">SWOT Matrix</h3>
                    </div>
                    
                    <p className="text-[11px] text-zinc-400 leading-normal font-sans">
                      Overall strategic alignment matrix compiled for this decision query.
                    </p>

                    <div className="grid grid-cols-2 gap-2 mt-2 h-[280px]">
                      {/* Strengths Grid Cell */}
                      <div className="bg-teal-50/40 border border-teal-100 rounded-xl p-2.5 flex flex-col">
                        <span className="text-[9px] font-bold text-teal-800 uppercase tracking-wider font-mono">Strengths</span>
                        <div className="flex-1 overflow-y-auto mt-1 space-y-1">
                          {activeDecision.analysis.swot.strengths.slice(0, 3).map((item, i) => (
                            <p key={i} className="text-[10px] text-teal-950 font-medium leading-normal leading-tight">• {item}</p>
                          ))}
                        </div>
                      </div>

                      {/* Weaknesses */}
                      <div className="bg-rose-50/40 border border-rose-100 rounded-xl p-2.5 flex flex-col">
                        <span className="text-[9px] font-bold text-rose-800 uppercase tracking-wider font-mono">Weaknesses</span>
                        <div className="flex-1 overflow-y-auto mt-1 space-y-1 w-full">
                          {activeDecision.analysis.swot.weaknesses.slice(0, 3).map((item, i) => (
                            <p key={i} className="text-[10px] text-rose-950 font-medium leading-normal leading-tight">• {item}</p>
                          ))}
                        </div>
                      </div>

                      {/* Opportunities */}
                      <div className="bg-sky-50/40 border border-sky-100 rounded-xl p-2.5 flex flex-col">
                        <span className="text-[9px] font-bold text-sky-800 uppercase tracking-wider font-mono">Opportunities</span>
                        <div className="flex-1 overflow-y-auto mt-1 space-y-1">
                          {activeDecision.analysis.swot.opportunities.slice(0, 3).map((item, i) => (
                            <p key={i} className="text-[10px] text-sky-950 font-medium leading-normal leading-tight">• {item}</p>
                          ))}
                        </div>
                      </div>

                      {/* Threats */}
                      <div className="bg-amber-50/40 border border-amber-100 rounded-xl p-2.5 flex flex-col">
                        <span className="text-[9px] font-bold text-amber-800 uppercase tracking-wider font-mono">Threats</span>
                        <div className="flex-1 overflow-y-auto mt-1 space-y-1">
                          {activeDecision.analysis.swot.threats.slice(0, 3).map((item, i) => (
                            <p key={i} className="text-[10px] text-amber-950 font-medium leading-normal leading-tight">• {item}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. COMPARISON DIMENSIONS TABLE: col-span-5 row-span-3 */}
                <div className="lg:col-span-5 border border-zinc-200 bg-white rounded-3xl p-5 shadow-xs overflow-hidden flex flex-col justify-between" id="bento-item-table">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-5 bg-sky-500 rounded-full"></div>
                      <h3 className="font-bold text-zinc-800 font-display text-sm">Direct Comparison</h3>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse">
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
                          {activeDecision.analysis.comparisons.map((comp, idx) => {
                            // Find option of max score
                            const sortedRatings = [...comp.ratings].sort((a,b) => b.score - a.score);
                            const topRatedName = sortedRatings[0].score > sortedRatings[1]?.score ? sortedRatings[0].optionName : 'Tie';
                            
                            return (
                              <tr key={idx} className="hover:bg-zinc-50/50">
                                <td className="py-2.5 pr-2">
                                  <div className="font-semibold text-zinc-800 truncate" title={comp.dimension}>{comp.dimension}</div>
                                  <div className="text-[10px] text-zinc-400 line-clamp-1 truncate max-w-[120px]" title={comp.description}>{comp.description}</div>
                                </td>
                                {comp.ratings.map((rt, rIdx) => (
                                  <td key={rIdx} className="py-2.5 text-center px-1">
                                    <span className="inline-block px-1.5 py-0.5 rounded-md font-bold font-mono text-[10px] bg-zinc-100 text-zinc-800">
                                      {rt.score}/10
                                    </span>
                                  </td>
                                ))}
                                <td className="py-2.5 text-right pl-2 shrink-0">
                                  {topRatedName === 'Tie' ? (
                                    <span className="bg-zinc-100 text-zinc-500 border border-zinc-200 px-1.5 py-0.5 rounded-full text-[9px] font-bold font-mono">
                                      Tie
                                    </span>
                                  ) : (
                                    <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded-full text-[9px] font-black tracking-tight truncate max-w-[70px] inline-block">
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
                    <span>Scores generated based on chosen &ldquo;{currentArchetypeConfig?.name}&rdquo; mindset settings.</span>
                  </div>
                </div>

                {/* 5. LIVE RECALCULATED STATS PANEL: col-span-3 row-span-3 */}
                <div className="lg:col-span-3 bg-zinc-900 border border-zinc-800 rounded-3xl p-5 text-white flex flex-col justify-between shadow-md" id="bento-item-stats">
                  <div className="space-y-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-5 bg-indigo-400 rounded-full"></div>
                      <h3 className="font-bold font-display text-sm">Weights Appeal Bar</h3>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-normal">
                      Adjusting any weight slider recalculates appeal stats relative to the other.
                    </p>

                    <div className="space-y-3">
                      {recalculatedScores.map((calc, idx) => {
                        const isLeader = leadingOptionObj?.optionName === calc.optionName;
                        return (
                          <div key={idx} className="space-y-1">
                            <div className="flex items-center justify-between text-[11px] font-mono">
                              <span className="text-zinc-300 font-bold truncate max-w-[155px]" title={calc.optionName}>{calc.optionName}</span>
                              <span className={`font-black ${isLeader ? 'text-emerald-400' : 'text-zinc-400'}`}>{calc.score}%</span>
                            </div>
                            <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-350 ${isLeader ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-zinc-600'}`}
                                style={{ width: `${calc.score}%` }}
                              ></div>
                            </div>
                            <div className="flex justify-between text-[9px] text-zinc-500">
                              <span>Pro impact: {calc.proPower}</span>
                              <span>Con impact: {calc.conPower}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-zinc-800">
                    <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Calculated Winner</div>
                    {leadingOptionObj ? (
                      <div className="flex items-center gap-2 bg-zinc-800/80 px-2.5 py-2 rounded-xl border border-zinc-70/10">
                        <Award className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold text-emerald-400 truncate max-w-[160px]" title={leadingOptionObj.optionName}>
                          {leadingOptionObj.optionName} ({leadingOptionObj.score}%)
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-500">Tuning...</span>
                    )}
                  </div>
                </div>

              </main>

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
