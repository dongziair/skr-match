/**
 * BgMusic.tsx
 * 用 Web Audio API 程序化生成魔性洗脑 BGM（长版、变调循环）
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

const NOTE: Record<string, number> = {
  G2: 98.00, A2: 110.00, C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00,
};

const BPM = 145; // 洗脑速度
const TICK = (60 / BPM) / 4; // 十六分音符长度，约0.103s

const MELODY_STR = `
E4 . G4 . A4 . C5 - . . A4 . G4 . E4 - . .
D4 . E4 . G4 . A4 - . . G4 . E4 . C4 - . .
E4 . G4 . A4 . C5 - . . D5 . E5 . C5 - . .
A4 . G4 . A4 . C5 - . . A4 . G4 . E4 - . .
E5 E5 E5 E5 D5 . C5 . A4 A4 A4 A4 G4 . E4 .
D4 D4 E4 E4 G4 G4 A4 A4 C5 C5 D5 D5 E5 - . .
G5 . E5 . D5 . C5 . A4 . G4 . E4 . D4 .
C4 - - . D4 - - . E4 . G4 . C5 - - .
`;

const BASS_STR = `
C3 - - . . . . . G2 - - . . . . .
A2 - - . . . . . E3 - - . . . . .
F3 - - . . . . . C3 - - . . . . .
D3 - . . G2 - . . C3 - . . G2 - . .
C3 - . . C3 - . . G2 - . . G2 - . .
A2 - . . A2 - . . E3 - . . E3 - . .
F3 - - . . . . . G3 - - . . . . .
C3 - . . G2 - . . C3 - - - - - - -
`;

const KICK_STR = `
X . . . . . X . X . . . . . X .
X . . . . . X . X . . . . . X .
X . . . . . X . X . . . . . X .
X . X . X . X . X . X . . . X .
X . . X . . X . X . . X . . X .
X . . X . . X . X . . X . . X .
X . . . . . . . X . . . . . . .
X . X . X . X . X . . . . . . .
`;

const HIHAT_STR = `
. . X . . . X . . . X . . . X .
. . X . . . X . . . X . . . X .
. . X . . . X . . . X . . . X .
. . X . . . X . . . X . . . X .
. . X . . . X . . . X . . . X .
. . X . . . X . . . X . . . X .
X X X X X X X X X X X X X X X X
. . X . . . X . X . X . X . X .
`;

// 解析器，将字符串解析为音符事件
function parseTrack(trackStr: string, tickLength: number) {
  const steps = trackStr.trim().split(/\s+/);
  const events: { note: string; startTime: number; duration: number }[] = [];
  let currentNote: string | null = null;
  let currentStart = 0;
  let currentDur = 0;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (step === '-') {
      if (currentNote !== null) currentDur += tickLength;
    } else {
      if (currentNote !== null) {
        events.push({ note: currentNote, startTime: currentStart, duration: currentDur });
      }
      if (step !== '.') {
        currentNote = step;
        currentStart = i * tickLength;
        currentDur = tickLength;
      } else {
        currentNote = null;
      }
    }
  }
  if (currentNote !== null) {
    events.push({ note: currentNote, startTime: currentStart, duration: currentDur });
  }
  return { events, totalDuration: steps.length * tickLength };
}

const MELODY_TRACK = parseTrack(MELODY_STR, TICK);
const BASS_TRACK = parseTrack(BASS_STR, TICK);
const KICK_TRACK = parseTrack(KICK_STR, TICK);
const HIHAT_TRACK = parseTrack(HIHAT_STR, TICK);

function createSynth(ctx: AudioContext, dest: GainNode, volume: number, filterFreq: number = 2000) {
  const gain = ctx.createGain();
  gain.gain.value = volume;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq;
  gain.connect(filter);
  filter.connect(dest);
  return { gain };
}

function playTone(ctx: AudioContext, dest: GainNode, freq: number, startTime: number, duration: number, type: OscillatorType, vol: number) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;

  const attack = 0.02;
  const release = 0.05;
  env.gain.setValueAtTime(0, startTime);
  env.gain.linearRampToValueAtTime(vol, startTime + attack);
  env.gain.setValueAtTime(vol, startTime + duration - release);
  env.gain.linearRampToValueAtTime(0, startTime + duration);

  osc.connect(env);
  env.connect(dest);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

function playKick(ctx: AudioContext, dest: GainNode, time: number) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, time);
  osc.frequency.exponentialRampToValueAtTime(30, time + 0.1);
  env.gain.setValueAtTime(0.3, time);
  env.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
  osc.connect(env);
  env.connect(dest);
  osc.start(time);
  osc.stop(time + 0.2);
}

function playHihat(ctx: AudioContext, dest: GainNode, time: number) {
  const bufferSize = ctx.sampleRate * 0.05;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 7000;
  
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.06, time);
  env.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

  source.connect(filter);
  filter.connect(env);
  env.connect(dest);
  source.start(time);
  source.stop(time + 0.06);
}

function scheduleLoop(ctx: AudioContext, masterGain: GainNode, loopStartTime: number) {
  const melodySynth = createSynth(ctx, masterGain, 0.4, 3000);
  MELODY_TRACK.events.forEach(e => {
    playTone(ctx, melodySynth.gain, NOTE[e.note], loopStartTime + e.startTime, e.duration * 0.8, 'square', 0.12);
    // 增加一个高八度弱正弦波作泛音
    playTone(ctx, melodySynth.gain, NOTE[e.note] * 2, loopStartTime + e.startTime, e.duration * 0.5, 'sine', 0.04);
  });

  const bassSynth = createSynth(ctx, masterGain, 0.6, 800);
  BASS_TRACK.events.forEach(e => {
    playTone(ctx, bassSynth.gain, NOTE[e.note], loopStartTime + e.startTime, e.duration * 0.9, 'triangle', 0.15);
  });

  KICK_TRACK.events.forEach(e => playKick(ctx, masterGain, loopStartTime + e.startTime));
  HIHAT_TRACK.events.forEach(e => playHihat(ctx, masterGain, loopStartTime + e.startTime));

  return loopStartTime + MELODY_TRACK.totalDuration;
}

export default function BgMusic() {
  const [muted, setMuted] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const timerRef = useRef<number>(0);
  const isPlayingRef = useRef(false);

  const stopMusic = useCallback(() => {
    isPlayingRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (ctxRef.current && ctxRef.current.state !== 'closed') {
      ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
      masterGainRef.current = null;
    }
  }, []);

  const startMusic = useCallback(() => {
    stopMusic();
    const ctx = new AudioContext();
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(ctx.destination);

    ctxRef.current = ctx;
    masterGainRef.current = masterGain;
    isPlayingRef.current = true;

    const scheduleAhead = () => {
      if (!isPlayingRef.current || !ctxRef.current) return;
      const now = ctxRef.current.currentTime;
      const end = scheduleLoop(ctxRef.current, masterGain, now + 0.05);
      const loopMs = (end - now - 0.05) * 1000;
      timerRef.current = window.setTimeout(scheduleAhead, loopMs - 100);
    };

    scheduleAhead();
  }, [stopMusic]);

  useEffect(() => {
    if (muted) {
      stopMusic();
      return;
    }

    // 设置在开启时默认开始播放
    try {
      startMusic();
    } catch {
      // 忽略直接启动失败
    }

    // 浏览器通常会阻止无交互的自动播放
    // 于是我们监听用户的首次全局点击/按键，来触发解锁
    const unlockAudio = () => {
      // 如果 AudioContext 被挂起或者由于策略没能正常运作，则重置启动
      if (ctxRef.current?.state === 'suspended' || !isPlayingRef.current) {
        startMusic();
      }
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };

    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      stopMusic();
    };
  }, [muted, startMusic, stopMusic]);

  const toggle = () => {
    if (muted) {
      startMusic();
      setMuted(false);
    } else {
      stopMusic();
      setMuted(true);
    }
  };

  return (
    <button
      onClick={toggle}
      className="flex items-center justify-center text-[#475569] hover:text-[#00ffaa] transition-colors p-1"
      title={muted ? 'Play BGM' : 'Mute BGM'}
    >
      {muted ? <VolumeX size={16} /> : <Volume2 size={16} className="animate-pulse text-[#00ffaa]" />}
    </button>
  );
}
