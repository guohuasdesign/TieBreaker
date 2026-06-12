import React from 'react';
import { Brain, Heart, Sparkles, Shield } from 'lucide-react';
import { DecisionArchetype, ArchetypeConfig } from '../types';

export const ARCHETYPES: ArchetypeConfig[] = [
  {
    id: 'rationalist',
    name: 'The Rationalist',
    emoji: '🧠',
    description: 'Focuses on objective data, logic, costs vs. benefits, and quantifiable probabilities.',
    systemInstruction: 'Analytical, practical, mathematical.'
  },
  {
    id: 'intuitive',
    name: 'The Intuitive',
    emoji: '🔮',
    description: 'Prioritizes internal energy, alignment with core life values, emotional joy, and gut feelings.',
    systemInstruction: 'Holistic, empathetic, value-driven.'
  },
  {
    id: 'bold_adventurer',
    name: 'The Adventurer',
    emoji: '🦁',
    description: 'Drives you toward maximum personal growth, core learning, excitement, and preventing safe regret.',
    systemInstruction: 'Inspiring, courageous, expansive.'
  },
  {
    id: 'risk_minimizer',
    name: 'The Safe Steward',
    emoji: '🛡️',
    description: 'Prioritizes robust downside protection, stability, minimal anxiety, and secure back-up plans.',
    systemInstruction: 'Conserving, safe, preventative.'
  }
];

interface ArchetypeSelectorProps {
  selectedArchetype: DecisionArchetype;
  onChange: (id: DecisionArchetype) => void;
}

export default function ArchetypeSelector({ selectedArchetype, onChange }: ArchetypeSelectorProps) {
  const getIcon = (id: DecisionArchetype) => {
    switch (id) {
      case 'rationalist': return <Brain className="w-5 h-5 text-indigo-600" id="icon-rationalist" />;
      case 'intuitive': return <Heart className="w-5 h-5 text-rose-500" id="icon-intuitive" />;
      case 'bold_adventurer': return <Sparkles className="w-5 h-5 text-amber-500" id="icon-adventure" />;
      case 'risk_minimizer': return <Shield className="w-5 h-5 text-emerald-600" id="icon-shield" />;
    }
  };

  const getActiveBorder = (id: DecisionArchetype) => {
    switch (id) {
      case 'rationalist': return 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20';
      case 'intuitive': return 'border-rose-400 ring-2 ring-rose-400/20 bg-rose-50/20';
      case 'bold_adventurer': return 'border-amber-400 ring-2 ring-amber-400/20 bg-amber-50/20';
      case 'risk_minimizer': return 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20';
    }
  };

  return (
    <div className="space-y-3" id="archetype-selector-wrapper">
      <label className="block text-sm font-medium text-slate-700 font-display">
        AI Reasoning Profile
      </label>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3" id="archetypes-grid">
        {ARCHETYPES.map((arch) => {
          const isSelected = selectedArchetype === arch.id;
          return (
            <button
              key={arch.id}
              id={`archetype-btn-${arch.id}`}
              type="button"
              onClick={() => onChange(arch.id)}
              className={`flex items-start text-left p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                isSelected 
                  ? `${getActiveBorder(arch.id)} border-transparent` 
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
              }`}
            >
              <div className="mr-3 mt-0.5 rounded-lg bg-slate-50 p-2 border border-slate-100">
                {getIcon(arch.id)}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-800 font-display text-sm md:text-base">{arch.name}</span>
                  <span className="text-sm">{arch.emoji}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {arch.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
