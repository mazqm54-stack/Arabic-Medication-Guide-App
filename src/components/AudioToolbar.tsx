import React, { useEffect, useState } from 'react';
import { Volume2, Play, Pause, Square, VolumeX } from 'lucide-react';
import { speechController, SpeechControllerState } from '../services/speechController';

interface AudioToolbarProps {
  audioSummary?: string;
  medicineName?: string;
}

export const AudioToolbar: React.FC<AudioToolbarProps> = ({ audioSummary, medicineName }) => {
  const [speechState, setSpeechState] = useState<SpeechControllerState>(speechController.getState());

  useEffect(() => {
    const unsubscribe = speechController.subscribe((state) => {
      setSpeechState(state);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const textToRead = audioSummary || (medicineName ? `معلومات دواء ${medicineName}` : '');

  const handlePlayOrResume = () => {
    if (!textToRead) return;
    if (speechState.status === 'paused') {
      speechController.resume();
    } else {
      speechController.speak(textToRead);
    }
  };

  const handlePause = () => {
    speechController.pause();
  };

  const handleStop = () => {
    speechController.stop();
  };

  if (!speechState.supported) {
    return (
      <div className="bg-amber-50 dark:bg-[#3A2E12] border-2 border-amber-300 dark:border-amber-600 rounded-2xl p-4 text-amber-900 dark:text-[#F5D58A] flex items-center gap-3 my-4">
        <VolumeX className="w-8 h-8 text-amber-700 dark:text-[#F5D58A] flex-shrink-0" />
        <p className="text-senior-base">
          المتصفح الحالي لا يدعم القراءة الصوتية التلقائية.
        </p>
      </div>
    );
  }

  const isSpeaking = speechState.status === 'speaking';
  const isPaused = speechState.status === 'paused';
  const isActive = isSpeaking || isPaused;

  return (
    <section
      aria-label="شريط القراءة الصوتية"
      className="bg-white dark:bg-[#162124] border-2 border-teal-600 dark:border-[#3DB8C4] rounded-2xl p-4 sm:p-5 shadow-senior mb-6 transition-all"
    >
      <div className="flex items-center justify-between mb-3 border-b pb-2 border-slate-200 dark:border-[#1D2B2F]">
        <div className="flex items-center gap-2">
          <Volume2 className={`w-8 h-8 ${isActive ? 'text-teal-600 dark:text-[#3DB8C4] animate-pulse' : 'text-slate-600 dark:text-[#9FB3B8]'}`} />
          <h2 className="font-bold text-senior-xl text-teal-800 dark:text-[#E6EEF0]">
            القراءة الصوتية للمعلومات
          </h2>
        </div>
        {isActive && (
          <span className="px-3 py-1 bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-[#3DB8C4] rounded-full font-bold text-sm">
            {isSpeaking ? 'جاري القراءة الآن 🔊' : 'متوقف مؤقتاً ⏸️'}
          </span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        {!isActive ? (
          <button
            type="button"
            onClick={handlePlayOrResume}
            disabled={!textToRead}
            className="btn-primary flex-1 min-h-[64px] flex items-center justify-center gap-3 text-senior-lg font-bold shadow-md"
            aria-label="استمع لتفاصيل الدواء بصوت واضح"
          >
            <Play className="w-7 h-7" />
            <span>🔊 استمع للمعلومات بصوت واضح</span>
          </button>
        ) : (
          <>
            {isSpeaking ? (
              <button
                type="button"
                onClick={handlePause}
                className="btn-secondary flex-1 min-h-[64px] flex items-center justify-center gap-3 text-senior-lg font-bold border-amber-500 dark:border-amber-600 text-amber-900 dark:text-[#F5D58A] bg-amber-50 dark:bg-[#3A2E12] hover:bg-amber-100 dark:hover:bg-[#4A3B18]"
                aria-label="إيقاف القراءة مؤقتاً"
              >
                <Pause className="w-7 h-7 text-amber-700 dark:text-[#F5D58A]" />
                <span>إيقاف مؤقت</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePlayOrResume}
                className="btn-primary flex-1 min-h-[64px] flex items-center justify-center gap-3 text-senior-lg font-bold"
                aria-label="متابعة القراءة الصوتية"
              >
                <Play className="w-7 h-7" />
                <span>متابعة القراءة</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleStop}
              className="min-h-[64px] px-6 rounded-xl font-bold border-2 border-red-500 dark:border-red-700 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200 hover:bg-red-100 dark:hover:bg-red-900/50 flex items-center justify-center gap-2"
              aria-label="إيقاف القراءة الصوتية بالكامل"
            >
              <Square className="w-6 h-6 text-red-600" />
              <span>إنهاء</span>
            </button>
          </>
        )}
      </div>
    </section>
  );
};
