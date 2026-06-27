import React, { useMemo, useState } from 'react';
import {
  BriefcaseBusiness,
  Check,
  ChevronRight,
  Plus,
  RefreshCw,
  Rocket,
  Sparkles,
  Trash2,
  WandSparkles,
} from 'lucide-react';
import { DecisionArchetype } from '../types';
import ArchetypeSelector from './ArchetypeSelector';

interface DecisionFormProps {
  onSubmit: (decision: string, options: string[], archetype: DecisionArchetype, personalSituation: string) => void;
  isLoading: boolean;
}

const TEMPLATE_POOL = [
  {
    title: "Should I move to a new city or stay where I am?",
    options: ["Move to a new city", "Stay where I am"],
    archetype: "rationalist" as DecisionArchetype,
    personalSituation: "I care about cost, daily energy, access to people I care about, and long-term stability."
  },
  {
    title: "Should I start now with imperfect information or wait until I have more certainty?",
    options: ["Start now with imperfect information", "Wait until I have more certainty"],
    archetype: "bold_adventurer" as DecisionArchetype,
    personalSituation: "I want growth, but I do not want to ignore financial risk or burnout."
  },
  {
    title: "Should I choose a restorative path or take on a growth challenge right now?",
    options: ["Choose the restorative path", "Choose the growth challenge"],
    archetype: "intuitive" as DecisionArchetype,
    personalSituation: "My energy is limited, and I want the choice to feel aligned rather than impressive."
  },
  {
    title: "Should I protect my cash or spend resources to accelerate progress?",
    options: ["Keep resources protected", "Spend resources to accelerate progress"],
    archetype: "risk_minimizer" as DecisionArchetype,
    personalSituation: "I need to balance downside protection with meaningful progress."
  },
  {
    title: "Should I accept this opportunity or decline it to protect my focus?",
    options: ["Accept the opportunity", "Decline and protect focus"],
    archetype: "rationalist" as DecisionArchetype,
    personalSituation: "I want to understand the opportunity cost and what I would need to give up."
  },
  {
    title: "Should I choose the familiar option or the higher-upside option?",
    options: ["Choose the familiar option", "Choose the higher-upside option"],
    archetype: "bold_adventurer" as DecisionArchetype,
    personalSituation: "I am open to change, but only if the upside is worth the disruption."
  }
];

const DEFAULT_PRIORITY_FACTORS = ["Time", "Money", "Energy", "Stability", "Growth", "Low stress"];

const FACTOR_RULES = [
  { factor: "Money", pattern: /budget|cost|price|salary|pay|income|cash|rent|mortgage|financial|afford|saving|compensation/i },
  { factor: "Time", pattern: /time|deadline|schedule|commute|hours|soon|urgent|wait|timing/i },
  { factor: "Energy", pattern: /energy|tired|burnout|burned|capacity|exhausted|motivation/i },
  { factor: "Health", pattern: /health|mental|stress|sleep|wellbeing|well-being|therapy|rest|recover/i },
  { factor: "Low stress", pattern: /stress|anxiety|pressure|chaos|overwhelm|risk|uncertain|uncertainty/i },
  { factor: "Growth", pattern: /growth|career|promotion|challenge|upside|ambition|future|progress/i },
  { factor: "Learning", pattern: /learn|skill|study|education|mentor|training|knowledge/i },
  { factor: "Relationships", pattern: /family|partner|friend|team|community|relationship|kids|children|parent/i },
  { factor: "Location", pattern: /move|city|home|remote|office|relocate|location|travel|country/i },
  { factor: "Freedom", pattern: /freedom|flexible|flexibility|independent|autonomy|control|choice/i },
  { factor: "Stability", pattern: /stable|stability|secure|security|safe|predictable|backup|fallback/i },
  { factor: "Impact", pattern: /impact|meaning|purpose|mission|help|contribution|values|alignment/i },
];

const inferPriorityFactors = (decision: string, personalSituation: string) => {
  const text = `${decision} ${personalSituation}`.trim();
  const matches = FACTOR_RULES
    .filter((rule) => rule.pattern.test(text))
    .map((rule) => rule.factor);
  const unique = [...new Set(matches)];
  const merged = [...unique, ...DEFAULT_PRIORITY_FACTORS.filter((factor) => !unique.includes(factor))];
  return merged.slice(0, 8);
};

export default function DecisionForm({ onSubmit, isLoading }: DecisionFormProps) {
  const [decision, setDecision] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [archetype, setArchetype] = useState<DecisionArchetype>('rationalist');
  const [personalSituation, setPersonalSituation] = useState('');
  const [priorityFactors, setPriorityFactors] = useState<string[]>([]);
  const suggestedFactors = useMemo(
    () => inferPriorityFactors(decision, personalSituation),
    [decision, personalSituation],
  );
  const pickExampleQuestions = () => [...TEMPLATE_POOL].sort(() => Math.random() - 0.5).slice(0, 3);
  const [visibleTemplates, setVisibleTemplates] = useState(() => pickExampleQuestions());

  const handleAddOption = () => {
    setOptions([...options, '']);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) return;
    const updated = options.filter((_, idx) => idx !== index);
    setOptions(updated);
  };

  const handleOptionChange = (index: number, val: string) => {
    const updated = [...options];
    updated[index] = val;
    setOptions(updated);
  };

  const loadTemplate = (tpl: typeof TEMPLATE_POOL[0]) => {
    setDecision(tpl.title);
    setOptions(tpl.options);
    setArchetype(tpl.archetype);
    setPersonalSituation(tpl.personalSituation || '');
  };

  const togglePriorityFactor = (factor: string) => {
    setPriorityFactors((current) =>
      current.includes(factor)
        ? current.filter((item) => item !== factor)
        : [...current, factor],
    );
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!decision.trim()) return;
    const filteredOptions = options.map(o => o.trim()).filter(Boolean);
    const weightedFactors = priorityFactors.length ? priorityFactors : suggestedFactors.slice(0, 4);
    const factorContext = weightedFactors.length
      ? `What matters most to me: ${weightedFactors.join(", ")}.`
      : "";
    const combinedContext = [personalSituation.trim(), factorContext].filter(Boolean).join("\n\n");
    onSubmit(decision.trim(), filteredOptions, archetype, combinedContext);
  };

  return (
    <div className="min-h-[calc(100vh-150px)] bg-white" id="decision-form-panel">
      <form onSubmit={handleSubmit} className="min-h-[calc(100vh-150px)]" id="creation-form">
        <div className="space-y-7 p-6 md:p-8 xl:p-10">

          {/* Header + examples */}
          <div id="new-decision-section" className="flex flex-col gap-4 border-b border-[#0a0908]/8 pb-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#0a0908]/40 font-mono mb-1">New decision</p>
              <h2 className="text-xl font-black font-display text-[#0a0908] leading-tight">What are you deciding?</h2>
              <p className="mt-1 text-sm text-[#0a0908]/45">Compare options side by side and get a clear recommendation.</p>
            </div>
          </div>

          <div className="space-y-2" id="presets-container">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#0a0908]/38">Example questions</p>
              <button
                type="button"
                onClick={() => setVisibleTemplates(pickExampleQuestions())}
                className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-[#0a0908]/12 bg-[#ede9e0] px-3 py-1.5 text-xs font-black text-[#0a0908]/55 transition-colors hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
              >
                <WandSparkles className="h-3.5 w-3.5" />
                Generate examples
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {visibleTemplates.map((tpl, i) => (
                <button
                  key={i}
                  id={`template-btn-${i}`}
                  type="button"
                  onClick={() => loadTemplate(tpl)}
                  className="min-h-16 cursor-pointer rounded-lg border border-[#0a0908]/12 bg-[#ede9e0] px-3 py-2 text-left text-xs font-semibold leading-relaxed text-[#0a0908]/60 transition-colors hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
                >
                  {tpl.title}
                </button>
            ))}
            </div>
          </div>

          {/* Decision question */}
          <div className="space-y-2">
            <label htmlFor="decision-query" className="block text-xs font-black text-[#0a0908] font-display uppercase tracking-[0.1em]">
              Decision question
            </label>
            <input
              id="decision-query"
              type="text"
              required
              placeholder="What choice are you trying to make?"
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
              className="w-full rounded-xl border border-[#0a0908]/12 bg-[#ede9e0] px-4 py-3 text-sm text-[#0a0908] outline-hidden transition-all placeholder:text-[#0a0908]/30 hover:border-[#0a0908]/25 focus:border-orange-400 focus:ring-4 focus:ring-orange-400/10 md:text-base"
            />
          </div>

          {/* Personal context */}
          <div className="space-y-2" id="personal-situation-group">
            <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
              <label htmlFor="personal-situation" className="block text-xs font-black text-[#0a0908] font-display uppercase tracking-[0.1em]">
                Personal context
              </label>
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0a0908]/30">Optional, recommended</span>
            </div>
            <textarea
              id="personal-situation"
              rows={3}
              placeholder="Add your situation, constraints, trade-offs, risk tolerance, timing, or what makes this choice hard."
              value={personalSituation}
              onChange={(e) => setPersonalSituation(e.target.value)}
              className="w-full resize-none rounded-xl border border-[#0a0908]/12 bg-[#ede9e0] px-4 py-3 text-sm text-[#0a0908] outline-hidden transition-all placeholder:text-[#0a0908]/30 hover:border-[#0a0908]/25 focus:border-orange-400 focus:bg-white/60 focus:ring-4 focus:ring-orange-400/10"
            />
          </div>

          <div className="space-y-3" id="priority-factors-group">
            <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-black text-[#0a0908] font-display uppercase tracking-[0.1em]">What matters more to me?</p>
                <p className="mt-1 text-xs text-[#0a0908]/38">Generated from your question and context. Select any that should matter most.</p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0a0908]/30">
                {priorityFactors.length ? `${priorityFactors.length} selected` : 'Auto weighted'}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestedFactors.map((factor) => {
                const selected = priorityFactors.includes(factor);
                return (
                  <button
                    key={factor}
                    type="button"
                    onClick={() => togglePriorityFactor(factor)}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-black transition-colors ${
                      selected
                        ? 'border-orange-300 bg-orange-50 text-orange-700'
                        : 'border-[#0a0908]/12 bg-[#ede9e0] text-[#0a0908]/50 hover:border-[#0a0908]/22 hover:text-[#0a0908]/70'
                    }`}
                  >
                    {selected && <Check className="h-3.5 w-3.5" />}
                    {factor}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Options */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" id="inputs-container">
            {options.map((opt, index) => {
              const isFirst = index === 0;
              return (
                <div key={index} className="relative rounded-xl border border-[#0a0908]/10 bg-[#ede9e0] p-4" id={`option-input-row-${index}`}>
                  {index === 1 && (
                    <div className="absolute -left-5 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-[#0a0908]/12 bg-[#ede9e0] text-xs font-black text-[#0a0908]/50 lg:grid">
                      VS
                    </div>
                  )}
                  <div className="mb-4 flex items-start justify-between gap-3 border-b border-[#0a0908]/8 pb-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${isFirst ? 'bg-orange-100 text-orange-600' : 'bg-[#0a0908]/8 text-[#0a0908]/55'}`}>
                        {isFirst ? <BriefcaseBusiness className="h-4.5 w-4.5" /> : <Rocket className="h-4.5 w-4.5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-[#0a0908]/40 uppercase tracking-widest font-mono">Option {String.fromCharCode(65 + index)}</p>
                        <input
                          type="text"
                          required
                          placeholder={index === 0 ? "First possible choice" : index === 1 ? "Second possible choice" : `Option ${String.fromCharCode(65 + index)}`}
                          value={opt}
                          onChange={(e) => handleOptionChange(index, e.target.value)}
                          className="mt-1 w-full rounded-lg border border-transparent bg-white/60 px-3 py-2 text-sm font-semibold text-[#0a0908] outline-hidden transition-colors placeholder:text-[#0a0908]/25 focus:border-orange-300 focus:bg-white"
                        />
                      </div>
                    </div>
                    {options.length > 2 && (
                      <button
                        id={`remove-opt-btn-${index}`}
                        type="button"
                        onClick={() => handleRemoveOption(index)}
                        title="Remove option"
                        className="cursor-pointer rounded-lg border border-[#0a0908]/10 p-2 text-[#0a0908]/35 transition-colors hover:bg-[#0a0908]/5 hover:text-[#0a0908]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className={`mb-1.5 text-[10px] font-black uppercase tracking-wider ${isFirst ? 'text-orange-600' : 'text-[#0a0908]/45'}`}>Pros</p>
                      <div className="space-y-1 text-xs text-[#0a0908]/50">
                        {['Strong upside', 'Fits stated priorities', 'Worth testing'].map((label) => (
                          <div key={label} className="flex items-center gap-2">
                            <span className={`w-1 h-1 rounded-full shrink-0 ${isFirst ? 'bg-orange-400' : 'bg-[#0a0908]/25'}`}></span>
                            <span>{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-1.5 text-[10px] font-black text-[#0a0908]/35 uppercase tracking-wider">Cons</p>
                      <div className="space-y-1 text-xs text-[#0a0908]/40">
                        {['Unknown tradeoffs', 'Needs validation'].map((label) => (
                          <div key={label} className="flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-[#0a0908]/20 shrink-0"></span>
                            <span>{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            id="add-option-btn"
            type="button"
            onClick={handleAddOption}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#0a0908]/12 bg-[#ede9e0] px-3 py-2 text-xs font-bold text-[#0a0908]/55 transition-colors hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Add option
          </button>

          {/* Archetype */}
          <div id="ai-lens-section" className="border-t border-[#0a0908]/8 pt-5">
            <ArchetypeSelector selectedArchetype={archetype} onChange={setArchetype} />
          </div>

          <div id="analyze-section" className="flex flex-col items-center gap-2 border-t border-[#0a0908]/8 pt-5">
            <button
              id="tiebreaker-submit"
              type="submit"
              disabled={isLoading || !decision.trim()}
              className="inline-flex min-h-12 w-full max-w-sm cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#0a0908] px-5 py-3 text-sm font-black text-[#ede9e0] shadow-lg shadow-[#0a0908]/10 transition-all hover:bg-[#0a0908]/85 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-orange-400" />
                  Analyze Decision
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
            <p className="text-center text-xs text-[#0a0908]/30">AI will surface trade-offs, risks, and next steps.</p>
          </div>

        </div>
      </form>
    </div>
  );
}
