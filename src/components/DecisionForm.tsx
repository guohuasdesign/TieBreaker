import React, { useState } from 'react';
import { HelpCircle, Plus, Trash2, Sliders, ChevronRight, Zap, RefreshCw } from 'lucide-react';
import { DecisionArchetype } from '../types';
import ArchetypeSelector from './ArchetypeSelector';

interface DecisionFormProps {
  onSubmit: (decision: string, options: string[], archetype: DecisionArchetype, personalSituation: string) => void;
  isLoading: boolean;
}

const POPULAR_TEMPLATES = [
  {
    title: "Buy a house vs. Continue renting",
    options: ["Buy a house in the suburbs", "Continue renting closer to the city"],
    archetype: "rationalist" as DecisionArchetype,
    personalSituation: "I have a family of four, need good public school districts, but also have active remote work flexibility."
  },
  {
    title: "Accept new job offer vs. Stay at current company",
    options: ["Join innovative but risky tech startup", "Stay at stable corporate job with promotion path"],
    archetype: "bold_adventurer" as DecisionArchetype,
    personalSituation: "I am a solo dev with 10 months of runway, strong interest in AI and networking, but minimal tolerance for absolute chaotic hours."
  },
  {
    title: "How to spend my summer vacation",
    options: ["Solo hiking trip in Europe", "All-inclusive beach resort rest"],
    archetype: "intuitive" as DecisionArchetype,
    personalSituation: "I am extremely burned out from a 60-hour/week launch cycle, and need real mental decompression."
  }
];

export default function DecisionForm({ onSubmit, isLoading }: DecisionFormProps) {
  const [decision, setDecision] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [archetype, setArchetype] = useState<DecisionArchetype>('rationalist');
  const [personalSituation, setPersonalSituation] = useState('');

  const handleAddOption = () => {
    setOptions([...options, '']);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) return; // Must have at least two options to break a tie
    const updated = options.filter((_, idx) => idx !== index);
    setOptions(updated);
  };

  const handleOptionChange = (index: number, val: string) => {
    const updated = [...options];
    updated[index] = val;
    setOptions(updated);
  };

  const loadTemplate = (tpl: typeof POPULAR_TEMPLATES[0]) => {
    setDecision(tpl.title);
    setOptions(tpl.options);
    setArchetype(tpl.archetype);
    setPersonalSituation(tpl.personalSituation || '');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!decision.trim()) return;
    
    // Filter blank options
    const filteredOptions = options.map(o => o.trim()).filter(Boolean);
    
    // Hand over
    onSubmit(decision.trim(), filteredOptions, archetype, personalSituation.trim());
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 md:p-7 shadow-xs space-y-6" id="decision-form-panel">
      {/* Title block */}
      <div className="space-y-1">
        <h2 className="text-xl font-bold font-display text-slate-800 flex items-center gap-2">
          <Zap className="w-5 h-5 text-indigo-600 fill-indigo-100" />
          Create New Decision
        </h2>
        <p className="text-xs text-slate-500">
          State your challenge, detail your alternatives, and select a reasoning archetype to break the tie.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6" id="creation-form">
        {/* Step 1: Decision Input */}
        <div className="space-y-2">
          <label htmlFor="decision-query" className="block text-sm font-medium text-slate-700 font-display">
            What is the decision you need to make?
          </label>
          <div className="relative">
            <input
              id="decision-query"
              type="text"
              required
              placeholder="e.g. Should I accept the remote job offer or stay at my head office role?"
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
              className="w-full text-slate-800 text-sm md:text-base border border-slate-200 rounded-xl px-4 py-3 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-hidden"
            />
          </div>
        </div>

        {/* Templates suggestions */}
        <div className="space-y-1.5" id="presets-section">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 font-mono">Or try a preset template:</span>
          <div className="flex flex-wrap gap-2" id="presets-container">
            {POPULAR_TEMPLATES.map((tpl, i) => (
              <button
                key={i}
                id={`template-btn-${i}`}
                type="button"
                onClick={() => loadTemplate(tpl)}
                className="text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 hover:border-slate-300 transition-all cursor-pointer"
              >
                {tpl.title}
              </button>
            ))}
          </div>
        </div>

        {/* Step 1.5: Personal Context Field */}
        <div className="space-y-2" id="personal-situation-group">
          <div className="flex items-center justify-between">
            <label htmlFor="personal-situation" className="block text-sm font-medium text-slate-700 font-display">
              Describe your personal situation / context <span className="text-slate-400 font-sans text-xs">(Recommended)</span>
            </label>
            <span className="text-[10px] text-slate-400 font-mono">Highly personalized analyzer</span>
          </div>
          <div className="relative">
            <textarea
              id="personal-situation"
              rows={3}
              placeholder="e.g. I am a solo developer with 0 marketing budget. I have low savings right now, but a high-risk appetite. I really want to optimize for maximum long-term community trust."
              value={personalSituation}
              onChange={(e) => setPersonalSituation(e.target.value)}
              className="w-full text-slate-800 text-xs md:text-sm border border-slate-200 rounded-xl px-4 py-3 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-hidden resize-none"
            />
          </div>
        </div>

        {/* Step 2: Options comparing */}
        <div className="space-y-3" id="options-comp-group">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700 font-display">
              Add the options you are weighing:
            </label>
            <span className="text-[10px] text-slate-400 font-mono">At least 2 required</span>
          </div>

          <div className="space-y-2.5" id="inputs-container">
            {options.map((opt, index) => (
              <div key={index} className="flex items-center gap-2 group" id={`option-input-row-${index}`}>
                <span className="font-mono text-xs font-semibold text-slate-400 w-6">
                  #{index + 1}
                </span>
                <input
                  type="text"
                  required
                  placeholder={index === 0 ? "First option to compare..." : index === 1 ? "Second option to compare..." : `Additional option #${index + 1}`}
                  value={opt}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  className="flex-1 text-slate-800 text-xs md:text-sm border border-slate-200 rounded-lg px-3.5 py-2.5 bg-slate-55/5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-hidden"
                />
                {options.length > 2 && (
                  <button
                    id={`remove-opt-btn-${index}`}
                    type="button"
                    onClick={() => handleRemoveOption(index)}
                    title="Remove option"
                    className="p-2 border border-rose-100 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            id="add-option-btn"
            type="button"
            onClick={handleAddOption}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Another Option
          </button>
        </div>

        {/* Step 3: Archetype choosing */}
        <div className="border-t border-slate-100 pt-5">
          <ArchetypeSelector selectedArchetype={archetype} onChange={setArchetype} />
        </div>

        {/* Trigger */}
        <button
          id="tiebreaker-submit"
          type="submit"
          disabled={isLoading || !decision.trim()}
          className="w-full mt-2 cursor-pointer inline-flex items-center justify-center gap-2 bg-slate-900 text-white rounded-xl py-3.5 px-4 font-semibold font-display shadow-lg hover:bg-slate-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              AI Analyzing Options...
            </>
          ) : (
            <>
              Break the Tie
              <ChevronRight className="w-4 h-4 ml-1" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
