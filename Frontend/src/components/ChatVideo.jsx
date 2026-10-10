import React, { useState, useRef } from 'react';
import {
  Play,
  Pause,
  Maximize2,
  Volume2,
  VolumeX,
  Download,
  Film,
  Sparkles,
  RotateCcw
} from 'lucide-react';

const ChatVideo = ({ src, alt, ...props }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoRef = useRef(null);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = () => {
    if (!videoRef.current) return;
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    }
  };

  const cleanTitle = (alt || 'High-Definition Video')
    .replace(/^video:\s*/i, '')
    .trim();

  return (
    <div className="my-4 max-w-2xl rounded-2xl overflow-hidden border border-slate-200/90 dark:border-zinc-800/90 bg-white/70 dark:bg-zinc-950/90 shadow-lg backdrop-blur-md transition-all hover:shadow-xl">
      <div className="relative group overflow-hidden bg-slate-950 aspect-video flex items-center justify-center">
        <video
          ref={videoRef}
          src={src}
          className="w-full h-full object-cover"
          loop
          muted={isMuted}
          playsInline
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onClick={togglePlay}
          {...props}
        />

        {/* Central Play Button Overlay (when paused) */}
        {!isPlaying && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-indigo-600/90 text-white flex items-center justify-center shadow-2xl backdrop-blur-md hover:scale-110 hover:bg-indigo-500 transition-all cursor-pointer z-10"
            title="Play Video"
          >
            <Play size={26} className="ml-1 fill-white" />
          </button>
        )}

        {/* Video Controls Bar */}
        <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-center justify-between text-white opacity-0 group-hover:opacity-100 transition-opacity z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button
              onClick={toggleMute}
              className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={src}
              download={`${cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.mp4`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
              title="Download Video"
            >
              <Download size={16} />
            </a>
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
              title="Fullscreen"
            >
              <Maximize2 size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Info Header Bar */}
      <div className="px-4 py-2.5 bg-slate-50/90 dark:bg-zinc-900/90 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between text-xs text-slate-700 dark:text-zinc-300">
        <div className="flex items-center gap-2 truncate max-w-[70%]">
          <Film size={14} className="text-indigo-400 shrink-0" />
          <span className="font-medium truncate">{cleanTitle}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-zinc-500 font-mono hidden sm:inline">1080p Full HD</span>
          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider bg-indigo-950/70 px-2 py-0.5 rounded-md border border-indigo-800/50 flex items-center gap-1">
            <Sparkles size={10} className="text-indigo-400" />
            AI Video Stream
          </span>
        </div>
      </div>
    </div>
  );
};

export default ChatVideo;
