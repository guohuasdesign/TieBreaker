import React from 'react';
import { History, Trash2, ArrowRight, Calendar, BookmarkCheck } from 'lucide-react';
import { SavedDecision } from '../types';

interface SavedDecisionsProps {
  savedDecisions: SavedDecision[];
  activeDecisionId: string | null;
  onSelectDecision: (decision: SavedDecision) => void;
  onDeleteDecision: (id: string, e: React.MouseEvent) => void;
}

export default function SavedDecisions({
  savedDecisions,
  activeDecisionId,
  onSelectDecision,
  onDeleteDecision
}: SavedDecisionsProps) {
  
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Recent';
    }
  };

  const getArchetypeLabel = (arch: string) => {
    switch (arch) {
      case 'rationalist': return '🧠 Rationalist';
      case 'intuitive': return '🔮 Intuitive';
      case 'bold_adventurer': return '🦁 Adventurer';
      case 'risk_minimizer': return '🛡️ Safe Steward';
      default: return '🧠 Rationalist';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs h-full flex flex-col" id="saved-decisions-panel">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center gap-2.5 bg-slate-50/50 rounded-t-2xl">
        <History className="w-4 h-4 text-slate-500" />
        <h2 className="text-sm font-semibold text-slate-700 font-display">Decision Archive ({savedDecisions.length})</h2>
      </div>

      {savedDecisions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-2 opacity-80" id="empty-archive">
          <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 text-slate-400">
            <BookmarkCheck className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-slate-500 font-display">No Decisions Archived</p>
          <p className="text-[11px] text-slate-400 leading-normal max-w-44">
            Completed analyses are saved here for weights tuning & review.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[80vh] md:max-h-[calc(100vh-220px)]" id="archive-list">
          {savedDecisions.map((saved) => {
            const isActive = activeDecisionId === saved.id;
            return (
              <div
                key={saved.id}
                id={`saved-item-${saved.id}`}
                onClick={() => onSelectDecision(saved)}
                className={`group relative p-3 rounded-xl border text-left cursor-pointer transition-all duration-200 ${
                  isActive
                    ? 'border-slate-800 bg-slate-55/10 bg-slate-100 shadow-xs ring-1 ring-slate-800/10'
                    : 'border-slate-100 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-200'
                }`}
              >
                {/* Delete button (displays on hover) */}
                <button
                  id={`delete-btn-${saved.id}`}
                  onClick={(e) => onDeleteDecision(saved.id, e)}
                  title="Remove from history"
                  className="absolute right-2 top-2 p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                <div className="pr-6 space-y-1.5">
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-100 font-mono">
                    {getArchetypeLabel(saved.archetype)}
                  </span>
                  
                  <h3 className="text-xs font-semibold text-slate-800 font-display line-clamp-2 leading-relaxed">
                    {saved.title}
                  </h3>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" />
                      {formatDate(saved.createdAt)}
                    </span>

                    <span className="text-[10px] text-indigo-600 font-medium flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform font-display">
                      View
                      <ArrowRight className="w-2.5 h-2.5" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
