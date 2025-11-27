import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Heart, Share2, AlertTriangle } from 'lucide-react';
import { NewsItem, PollData } from '../types';
import { Button } from './UI';

interface NewsModalProps {
  item: NewsItem;
  isOpen: boolean;
  onClose: () => void;
  children?: React.ReactNode; // To render the Poll component passed from Feed
}

export const NewsModal: React.FC<NewsModalProps> = ({ item, isOpen, onClose, children }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; }
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div className="relative bg-white dark:bg-[#121212] w-full h-full sm:h-auto sm:max-w-2xl sm:max-h-[90vh] rounded-none sm:rounded-[32px] border-0 sm:border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col">

        {/* Header / Image */}
        <div className="relative h-64 shrink-0">
          <img
            src={item.image}
            alt={item.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
          >
            <X size={20} />
          </button>

          <div className="absolute bottom-4 left-6 right-6">
            <div className="flex flex-wrap gap-2 mb-2">
              {item.tags.map((tag, i) => (
                <span key={i} className="px-3 py-1 bg-black/50 rounded-full text-xs font-medium text-white border border-white/20">
                  {tag}
                </span>
              ))}
            </div>
            <h2 className="text-2xl font-bold text-white leading-tight">{item.title}</h2>
          </div>
        </div>

        {/* Content Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
          <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed text-base lg:text-lg mb-8">
            {item.description}
          </p>

          {/* Poll Section */}
          {children}

          {/* Meta info */}
          <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-sm text-zinc-500">
            <span>{new Date(item.date).toLocaleDateString()}</span>
            <div className="flex gap-4">
              {/* We could move like buttons here or keep them in feed */}
            </div>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
};
