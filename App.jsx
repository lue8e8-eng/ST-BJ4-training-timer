import React, { useState, useEffect, useRef } from 'react';

// 音效控制模組 (Web Audio API & 語音播報)
class SoundController {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  initContext() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) this.ctx = new AudioContext();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playBeep(frequency = 600, duration = 0.12, type = 'sine') {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  playStageAlert() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, this.ctx.currentTime);
      osc.frequency.setValueAtTime(1174.66, this.ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.6);
    } catch (e) {
      console.warn('Audio alert error', e);
    }
  }

  playCompleteFanfare() {
    if (!this.enabled) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playBeep(freq, 0.35, 'triangle'), idx * 180);
    });
  }

  speak(text) {
    if (!this.enabled || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.pitch = 1.0;
    utterance.volume = 0.9;
    window.speechSynthesis.speak(utterance);
  }
}

export default function App() {
  // 設定參數
  const [prepareTime, setPrepareTime] = useState(5);
  const [workTime, setWorkTime] = useState(40);
  const [restTime, setRestTime] = useState(20);
  const [totalRounds, setTotalRounds] = useState(8);

  // 暫存設定 (Modal 開啟時調整)
  const [cfgPrepare, setCfgPrepare] = useState(5);
  const [cfgWork, setCfgWork] = useState(40);
  const [cfgRest, setCfgRest] = useState(20);
  const [cfgRounds, setCfgRounds] = useState(8);

  // 運行狀態
  const [isRunning, setIsRunning] = useState(false);
  const [phase, setPhase] = useState('PREPARE'); // 'PREPARE' | 'WORK' | 'REST' | 'COMPLETED'
  const [currentRound, setCurrentRound] = useState(1);
  const [timeLeft, setTimeLeft] = useState(5);
  const [currentDuration, setCurrentDuration] = useState(5);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  const soundRef = useRef(new SoundController());

  // 格式化秒數為 mm:ss
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // 重設計時器
  const resetTimer = () => {
    setIsRunning(false);
    const initialPhase = prepareTime > 0 ? 'PREPARE' : 'WORK';
    const initialDuration = initialPhase === 'PREPARE' ? prepareTime : workTime;
    setPhase(initialPhase);
    setCurrentRound(1);
    setTimeLeft(initialDuration);
    setCurrentDuration(initialDuration);
  };

  // 跳至下個階段
  const nextPhase = () => {
    if (phase === 'PREPARE') {
      setPhase('WORK');
      setTimeLeft(workTime);
      setCurrentDuration(workTime);
      soundRef.current.playStageAlert();
      soundRef.current.speak('運動開始，加油！');
    } else if (phase === 'WORK') {
      if (currentRound >= totalRounds) {
        setPhase('COMPLETED');
        setTimeLeft(0);
        setCurrentDuration(1);
        setIsRunning(false);
        soundRef.current.playCompleteFanfare();
        soundRef.current.speak('恭喜！訓練全部完成！');
      } else {
        setPhase('REST');
        setTimeLeft(restTime);
        setCurrentDuration(restTime);
        soundRef.current.playStageAlert();
        soundRef.current.speak('休息時間');
      }
    } else if (phase === 'REST') {
      const nextRound = currentRound + 1;
      setCurrentRound(nextRound);
      setPhase('WORK');
      setTimeLeft(workTime);
      setCurrentDuration(workTime);
      soundRef.current.playStageAlert();
      soundRef.current.speak(`第 ${nextRound} 組，開始！`);
    }
  };

  // 倒數核心 Effect
  useEffect(() => {
    let timer = null;
    if (isRunning && phase !== 'COMPLETED') {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 4 && prev >= 2) {
            soundRef.current.playBeep(800, 0.15, 'sine');
          }
          if (prev <= 1) {
            nextPhase();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isRunning, phase, currentRound, totalRounds, workTime, restTime]);

  // 計算總剩餘時間
  const calcTotalRemaining = () => {
    if (phase === 'COMPLETED') return 0;
    let remaining = timeLeft;
    const roundsLeft = totalRounds - currentRound;
    if (phase === 'PREPARE') {
      remaining += totalRounds * workTime + (totalRounds - 1) * restTime;
    } else if (phase === 'WORK') {
      remaining += restTime + (roundsLeft * (workTime + restTime) - restTime);
    } else if (phase === 'REST') {
      remaining += roundsLeft * (workTime + restTime);
    }
    return Math.max(0, remaining);
  };

  const totalPlanSecs = prepareTime + (totalRounds * workTime) + ((totalRounds - 1) * restTime);
  const remainingSecs = calcTotalRemaining();
  const progressPercent = totalPlanSecs > 0 ? Math.min(100, Math.max(0, ((totalPlanSecs - remainingSecs) / totalPlanSecs) * 100)) : 0;

  // 顏色與樣式設定
  const getPhaseStyles = () => {
    switch (phase) {
      case 'WORK':
        return {
          textColor: 'text-emerald-400',
          badgeBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
          title: '全力運動 (WORK)',
          stroke: '#10b981'
        };
      case 'REST':
        return {
          textColor: 'text-sky-400',
          badgeBg: 'bg-sky-500/20 text-sky-400 border-sky-500/40',
          title: '休息調息 (REST)',
          stroke: '#38bdf8'
        };
      case 'COMPLETED':
        return {
          textColor: 'text-yellow-400',
          badgeBg: 'bg-yellow-400 text-neutral-950 border-yellow-300 font-black',
          title: '訓練完成 (FINISHED)',
          stroke: '#eab308'
        };
      default:
        return {
          textColor: 'text-amber-400',
          badgeBg: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
          title: '準備倒數 (GET READY)',
          stroke: '#f59e0b'
        };
    }
  };

  const currentStyle = getPhaseStyles();

  return (
    <div className="bg-neutral-950 text-white min-h-screen flex flex-col justify-between p-4 sm:p-6">
      {/* 頂部列 */}
      <header className="flex items-center justify-between border-b border-neutral-800 pb-4 max-w-5xl w-full mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xl border border-amber-500/30">
            <i className="fa-solid fa-stopwatch-20"></i>
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-wider">Pro Training Timer</h1>
            <p className="text-xs text-neutral-400">間歇 / 間隔高強度訓練鐘</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              soundRef.current.enabled = next;
            }}
            className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-xs sm:text-sm font-medium flex items-center gap-1.5 transition"
          >
            <i className={`fa-solid ${soundEnabled ? 'fa-volume-high text-emerald-400' : 'fa-volume-xmark text-neutral-500'}`}></i>
            <span className="hidden sm:inline">{soundEnabled ? '音效開啟' : '靜音'}</span>
          </button>

          <button
            onClick={() => {
              setIsRunning(false);
              setCfgPrepare(prepareTime);
              setCfgWork(workTime);
              setCfgRest(restTime);
              setCfgRounds(totalRounds);
              setIsConfigOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs sm:text-sm font-semibold flex items-center gap-2 transition"
          >
            <i className="fa-solid fa-sliders"></i>
            <span>設定</span>
          </button>
        </div>
      </header>

      {/* 核心計時區 */}
      <main className="flex-1 flex flex-col items-center justify-center max-w-4xl w-full mx-auto py-6">
        <div className="flex items-center gap-3 mb-6">
          <span className={`text-base sm:text-xl font-extrabold uppercase px-6 py-2 rounded-full border shadow-lg ${currentStyle.badgeBg}`}>
            {currentStyle.title}
          </span>
          <span className="text-sm sm:text-lg font-bold px-5 py-2 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400">
            組數: <span className="text-white font-extrabold">{currentRound}</span> / {totalRounds}
          </span>
        </div>

        {/* 超大數字顯示 */}
        <div className={`timer-font font-black leading-none text-center text-[26vw] md:text-[20vw] lg:text-[180px] drop-shadow-2xl select-none ${currentStyle.textColor}`}>
          {formatTime(timeLeft)}
        </div>

        {/* 總進度條 */}
        <div className="w-full max-w-md mt-6 px-4">
          <div className="flex justify-between text-xs sm:text-sm text-neutral-400 mb-2">
            <span>進度</span>
            <span>總剩餘: {formatTime(remainingSecs)}</span>
          </div>
          <div className="w-full bg-neutral-900 rounded-full h-3 border border-neutral-800 overflow-hidden">
            <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </div>
      </main>

      {/* 控制按鈕 */}
      <footer className="w-full max-w-xl mx-auto flex items-center gap-4 pb-4">
        <button
          onClick={resetTimer}
          className="flex-1 py-4 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-lg border border-neutral-700 active:scale-95 transition"
        >
          重設
        </button>

        <button
          onClick={() => {
            soundRef.current.initContext();
            if (phase === 'COMPLETED') resetTimer();
            setIsRunning(!isRunning);
          }}
          className={`flex-[2] py-4 rounded-2xl font-black text-xl active:scale-95 transition shadow-lg ${
            isRunning ? 'bg-amber-600 text-white' : 'bg-amber-500 hover:bg-amber-400 text-neutral-950 shadow-amber-500/20'
          }`}
        >
          {isRunning ? '暫停' : phase === 'COMPLETED' ? '再次訓練' : '開始訓練'}
        </button>

        <button
          onClick={nextPhase}
          className="flex-1 py-4 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-lg border border-neutral-700 active:scale-95 transition"
        >
          跳過
        </button>
      </footer>

      {/* 彈出設定視窗 */}
      {isConfigOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-4">
              <h2 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
                <i className="fa-solid fa-gear text-amber-500"></i> 訓練參數設定
              </h2>
              <button onClick={() => setIsConfigOpen(false)} className="text-neutral-400 hover:text-white">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <div className="space-y-4">
              {/* 準備時間 */}
              <div className="flex justify-between items-center bg-neutral-950 p-3 rounded-2xl border border-neutral-800">
                <span className="text-sm font-semibold">準備時間 (秒)</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCfgPrepare(Math.max(0, cfgPrepare - 1))} className="w-8 h-8 rounded-lg bg-neutral-800 font-bold">-</button>
                  <span className="w-8 text-center text-amber-400 font-bold">{cfgPrepare}</span>
                  <button onClick={() => setCfgPrepare(cfgPrepare + 1)} className="w-8 h-8 rounded-lg bg-neutral-800 font-bold">+</button>
                </div>
              </div>

              {/* 運動時間 */}
              <div className="flex justify-between items-center bg-neutral-950 p-3 rounded-2xl border border-neutral-800">
                <span className="text-sm font-semibold text-emerald-400">運動時間 (秒)</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCfgWork(Math.max(5, cfgWork - 5))} className="w-8 h-8 rounded-lg bg-neutral-800 font-bold">-5</button>
                  <span className="w-8 text-center text-emerald-400 font-bold">{cfgWork}</span>
                  <button onClick={() => setCfgWork(cfgWork + 5)} className="w-8 h-8 rounded-lg bg-neutral-800 font-bold">+5</button>
                </div>
              </div>

              {/* 休息時間 */}
              <div className="flex justify-between items-center bg-neutral-950 p-3 rounded-2xl border border-neutral-800">
                <span className="text-sm font-semibold text-sky-400">休息時間 (秒)</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCfgRest(Math.max(0, cfgRest - 5))} className="w-8 h-8 rounded-lg bg-neutral-800 font-bold">-5</button>
                  <span className="w-8 text-center text-sky-400 font-bold">{cfgRest}</span>
                  <button onClick={() => setCfgRest(cfgRest + 5)} className="w-8 h-8 rounded-lg bg-neutral-800 font-bold">+5</button>
                </div>
              </div>

              {/* 組數 */}
              <div className="flex justify-between items-center bg-neutral-950 p-3 rounded-2xl border border-neutral-800">
                <span className="text-sm font-semibold text-purple-400">總組數</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCfgRounds(Math.max(1, cfgRounds - 1))} className="w-8 h-8 rounded-lg bg-neutral-800 font-bold">-1</button>
                  <span className="w-8 text-center text-purple-400 font-bold">{cfgRounds}</span>
                  <button onClick={() => setCfgRounds(cfgRounds + 1)} className="w-8 h-8 rounded-lg bg-neutral-800 font-bold">+1</button>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setPrepareTime(cfgPrepare);
                setWorkTime(cfgWork);
                setRestTime(cfgRest);
                setTotalRounds(cfgRounds);
                setIsConfigOpen(false);
                setIsRunning(false);
                setPhase(cfgPrepare > 0 ? 'PREPARE' : 'WORK');
                setCurrentRound(1);
                setTimeLeft(cfgPrepare > 0 ? cfgPrepare : cfgWork);
                setCurrentDuration(cfgPrepare > 0 ? cfgPrepare : cfgWork);
              }}
              className="w-full mt-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-base transition"
            >
              儲存並套用
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
