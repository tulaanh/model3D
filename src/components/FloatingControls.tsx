import React from 'react';
import { RotateCcw, Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';

export type CameraViewPreset = 'Front' | 'Quarter' | 'Side' | 'Back';
export type BikiniVariant = 'Pearl' | 'Noir';

interface FloatingControlsProps {
  currentView: CameraViewPreset;
  onSelectView: (view: CameraViewPreset) => void;
  currentVariant: BikiniVariant;
  onSelectVariant: (variant: BikiniVariant) => void;
  isAutoRotating: boolean;
  onToggleAutoRotate: () => void;
  onResetView: () => void;
}

export const FloatingControls: React.FC<FloatingControlsProps> = ({
  currentView,
  onSelectView,
  currentVariant,
  onSelectVariant,
  isAutoRotating,
  onToggleAutoRotate,
  onResetView,
}) => {
  const [isMuted, setIsMuted] = React.useState(soundEngine.getIsMuted());

  const handleToggleMute = () => {
    const next = soundEngine.toggleMuted();
    setIsMuted(next);
    if (!next) {
      soundEngine.playImpact(0.4, 'boing');
    }
  };

  const views: CameraViewPreset[] = ['Front', 'Quarter', 'Side', 'Back'];

  return (
    <div className="absolute inset-x-0 bottom-8 flex flex-col items-center gap-3 pointer-events-none select-none z-20 font-sans">
      {/* 1. Camera View Presets Pill */}
      <div className="flex items-center p-1 rounded-full bg-stone-900/60 backdrop-blur-xl border border-white/15 shadow-2xl pointer-events-auto">
        {views.map((view) => {
          const isActive = currentView === view;
          return (
            <button
              key={view}
              onClick={() => onSelectView(view)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-[#f0d4bd] text-stone-900 shadow-sm font-semibold'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              {view}
            </button>
          );
        })}
      </div>

      {/* 2. Variant & Playback Controls Pill */}
      <div className="flex items-center px-3 py-1.5 rounded-full bg-stone-900/60 backdrop-blur-xl border border-white/15 shadow-2xl pointer-events-auto gap-3 text-xs">
        {/* Pearl Variant Button */}
        <button
          onClick={() => onSelectVariant('Pearl')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all duration-200 cursor-pointer ${
            currentVariant === 'Pearl'
              ? 'bg-[#f0d4bd] text-stone-900 font-semibold shadow-sm'
              : 'text-stone-300 hover:text-white'
          }`}
        >
          <span className="w-3.5 h-3.5 rounded-full bg-[#fdfcf8] border border-stone-300/60 inline-block shadow-inner" />
          <span>Pearl</span>
        </button>

        {/* Noir Variant Button */}
        <button
          onClick={() => onSelectVariant('Noir')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all duration-200 cursor-pointer ${
            currentVariant === 'Noir'
              ? 'bg-stone-800 text-stone-100 font-semibold border border-white/20 shadow-sm'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <span className="w-3.5 h-3.5 rounded-full bg-stone-950 border border-stone-600 inline-block" />
          <span>Noir</span>
        </button>

        {/* Divider */}
        <span className="w-px h-4 bg-white/20" />

        {/* Auto Rotate Toggle */}
        <button
          onClick={onToggleAutoRotate}
          title={isAutoRotating ? 'Dừng xoay' : 'Tự động xoay turntable'}
          className={`p-1.5 rounded-full transition-all cursor-pointer ${
            isAutoRotating
              ? 'text-[#f0d4bd] bg-white/10'
              : 'text-stone-300 hover:text-white hover:bg-white/10'
          }`}
        >
          {isAutoRotating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>

        {/* Reset Camera View */}
        <button
          onClick={onResetView}
          title="Đặt lại góc nhìn"
          className="p-1.5 rounded-full text-stone-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {/* Audio Mute Toggle */}
        <button
          onClick={handleToggleMute}
          title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          className={`p-1.5 rounded-full transition-all cursor-pointer ${
            isMuted ? 'text-red-400 hover:bg-red-500/20' : 'text-stone-300 hover:text-white hover:bg-white/10'
          }`}
        >
          {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Subtle Hint */}
      <div className="text-[11px] text-stone-400/80 bg-stone-900/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/5">
        🖐️ Click / Vuốt nhanh để vỗ đàn hồi • Kéo để nảy lò xo • Chuột phải xoay tự do
      </div>
    </div>
  );
};
