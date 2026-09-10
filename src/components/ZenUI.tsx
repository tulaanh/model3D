import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, RotateCcw, HelpCircle, Sparkles } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';

interface ZenUIProps {
  loadingProgress: number;
  isLoading: boolean;
  onResetCamera: () => void;
  fps: number;
}

export const ZenUI: React.FC<ZenUIProps> = ({
  loadingProgress,
  isLoading,
  onResetCamera,
  fps,
}) => {
  const [isMuted, setIsMuted] = useState(soundEngine.getIsMuted());
  const [showHelp, setShowHelp] = useState(true);

  // Auto-hide help badge after 7 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowHelp(false);
    }, 7000);
    return () => clearTimeout(timer);
  }, []);

  const handleToggleSound = () => {
    const nextMuted = soundEngine.toggleMuted();
    setIsMuted(nextMuted);
    if (!nextMuted) {
      soundEngine.playImpact(0.4, 'boing');
    }
  };

  if (isLoading) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-stone-900 via-zinc-900 to-black text-white z-50 transition-opacity duration-700">
        <div className="relative flex flex-col items-center p-8 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl max-w-sm w-full mx-4">
          <div className="w-16 h-16 mb-6 relative flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-pink-500/20 animate-ping" />
            <div className="w-12 h-12 rounded-full border-2 border-t-pink-400 border-r-pink-400/50 border-b-transparent border-l-transparent animate-spin" />
            <Sparkles className="w-5 h-5 text-pink-300 absolute" />
          </div>

          <h2 className="text-xl font-medium tracking-wide mb-2 text-stone-100">
            Khởi tạo Model 3D
          </h2>
          <p className="text-xs text-stone-400 mb-6 text-center">
            Đang nạp hệ thống xương lò xo & vật lý đàn hồi...
          </p>

          {/* Progress Bar */}
          <div className="w-full bg-stone-800/80 rounded-full h-2 overflow-hidden p-0.5 border border-white/5">
            <div
              className="bg-gradient-to-r from-pink-500 to-rose-400 h-full rounded-full transition-all duration-300 shadow-[0_0_12px_rgba(244,63,94,0.5)]"
              style={{ width: `${Math.min(100, Math.max(5, loadingProgress))}%` }}
            />
          </div>
          <span className="text-xs text-stone-400 font-mono mt-2">
            {Math.round(loadingProgress)}%
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-10 select-none overflow-hidden font-sans">
      {/* Top Left: Clean Title & FPS indicator */}
      <div className="absolute top-6 left-6 flex items-center space-x-3">
        <div className="px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-stone-200 text-xs flex items-center space-x-2 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold tracking-wider text-[11px] uppercase text-stone-100">
            Zen Physics 3D
          </span>
          <span className="text-stone-400 text-[10px]">|</span>
          <span className="font-mono text-stone-300 text-[11px]">{fps} FPS</span>
        </div>
      </div>

      {/* Top Right: Micro Controls (Reset Camera, Audio Toggle) */}
      <div className="absolute top-6 right-6 flex items-center space-x-2.5 pointer-events-auto">
        <button
          onClick={onResetCamera}
          title="Đặt lại góc nhìn Camera"
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 backdrop-blur-md border border-white/15 text-stone-200 hover:text-white transition-all duration-200 shadow-lg cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          onClick={handleToggleSound}
          title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          className={`p-2.5 rounded-full backdrop-blur-md border active:scale-95 transition-all duration-200 shadow-lg cursor-pointer ${
            isMuted
              ? 'bg-red-500/20 border-red-400/30 text-red-300 hover:bg-red-500/30'
              : 'bg-white/10 border-white/15 text-stone-200 hover:text-white hover:bg-white/20'
          }`}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Bottom Center: Interaction Hint Bar */}
      <div className="absolute bottom-8 inset-x-0 flex justify-center pointer-events-auto px-4">
        {showHelp ? (
          <div className="relative group px-5 py-2.5 rounded-2xl bg-stone-900/60 hover:bg-stone-900/80 backdrop-blur-xl border border-white/10 text-stone-200 text-xs shadow-2xl flex items-center space-x-4 transition-all duration-300">
            <div className="flex items-center space-x-1.5 text-stone-300">
              <span className="text-pink-400 text-base">🖐️</span>
              <span><strong>Click / Vuốt nhanh:</strong> Vỗ & Đàn hồi</span>
            </div>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <div className="flex items-center space-x-1.5 text-stone-300">
              <span className="text-amber-400 text-base">🧲</span>
              <span><strong>Kéo & Thả:</strong> Nảy lò xo</span>
            </div>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <div className="flex items-center space-x-1.5 text-stone-300">
              <span className="text-blue-400 text-base">🖱️</span>
              <span><strong>Chuột phải / Kéo nền:</strong> Xoay 360°</span>
            </div>
            <button
              onClick={() => setShowHelp(false)}
              className="ml-2 text-stone-400 hover:text-stone-200 text-xs px-1"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowHelp(true)}
            title="Xem hướng dẫn tương tác"
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/15 text-stone-300 hover:text-white transition-all shadow-md cursor-pointer"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
