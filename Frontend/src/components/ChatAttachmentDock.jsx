import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Code2, Headphones, Video, Eye, Paperclip } from 'lucide-react';

/**
 * ChatAttachmentDock
 * 
 * Claude & ChatGPT style attachment tray displayed directly above the input bar.
 * Compactly displays pasted text snippets, uploaded images, audio clips, and video files
 * with preview and remove controls so the input area never becomes bloated or overloaded.
 */
export default function ChatAttachmentDock({
  attachments = [],
  onRemoveAttachment,
  onPreviewSnippet,
  onPreviewImage,
}) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="flex items-center gap-2.5 px-3 py-2 overflow-x-auto max-w-full pb-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-zinc-700">
      <AnimatePresence initial={false}>
        {attachments.map((att) => {
          const isImage = att.type === 'image' || (att.mime_type && att.mime_type.startsWith('image/'));
          const isTextSnippet = att.type === 'text' || att.type === 'snippet' || !!att.content;
          const isAudio = att.type === 'audio' || (att.mime_type && att.mime_type.startsWith('audio/'));
          const isVideo = att.type === 'video' || (att.mime_type && att.mime_type.startsWith('video/'));

          const sizeKb = att.size ? `${(att.size / 1024).toFixed(1)} KB` : '';

          return (
            <motion.div
              key={att.id}
              initial={{ opacity: 0, scale: 0.85, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
              className="relative group shrink-0 flex items-center bg-white/90 dark:bg-zinc-800/90 backdrop-blur-md border border-slate-200/90 dark:border-zinc-700/80 rounded-xl shadow-sm hover:shadow-md transition-all select-none overflow-hidden"
            >
              {/* Image Card Variant */}
              {isImage ? (
                <div className="relative w-16 h-16 rounded-xl overflow-hidden cursor-pointer" onClick={() => onPreviewImage?.(att)}>
                  <img
                    src={att.data_url || att.url}
                    alt={att.name || 'Attached image'}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                    <Eye size={16} />
                  </div>
                </div>
              ) : isTextSnippet ? (
                /* Text Snippet Card (Claude / ChatGPT style) */
                <div
                  className="flex items-center gap-2.5 px-3 py-2 cursor-pointer max-w-[240px] sm:max-w-[280px]"
                  onClick={() => onPreviewSnippet?.(att)}
                >
                  <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0">
                    {att.name?.endsWith('.py') || att.name?.endsWith('.js') || att.name?.endsWith('.cpp') ? (
                      <Code2 size={16} />
                    ) : (
                      <FileText size={16} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200 truncate">
                      {att.name || 'Pasted text'}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-zinc-500 truncate flex items-center gap-1.5">
                      {att.lines ? <span>{att.lines} lines</span> : null}
                      {att.lines && sizeKb ? <span>•</span> : null}
                      {sizeKb ? <span>{sizeKb}</span> : null}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPreviewSnippet?.(att);
                    }}
                    className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors"
                    title="View snippet"
                  >
                    <Eye size={13} />
                  </button>
                </div>
              ) : isAudio ? (
                /* Audio Card */
                <div className="flex items-center gap-2.5 px-3 py-2 max-w-[220px]">
                  <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 shrink-0">
                    <Headphones size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200 truncate">
                      {att.name || 'Audio clip'}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                      {sizeKb || 'Audio'}
                    </p>
                  </div>
                </div>
              ) : isVideo ? (
                /* Video Card */
                <div className="flex items-center gap-2.5 px-3 py-2 max-w-[220px]">
                  <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 shrink-0">
                    <Video size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200 truncate">
                      {att.name || 'Video clip'}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                      {sizeKb || 'Video'}
                    </p>
                  </div>
                </div>
              ) : (
                /* Generic File Card */
                <div className="flex items-center gap-2.5 px-3 py-2 max-w-[220px]">
                  <div className="p-2 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 shrink-0">
                    <Paperclip size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200 truncate">
                      {att.name || 'Attachment'}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                      {sizeKb || 'Document'}
                    </p>
                  </div>
                </div>
              )}

              {/* Remove Attachment Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveAttachment(att.id);
                }}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-900/70 hover:bg-red-600 text-white flex items-center justify-center transition-colors shadow-sm"
                title="Remove attachment"
              >
                <X size={11} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
