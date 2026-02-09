// 볼륨 설정 (localStorage에 저장)
const CLICK_VOLUME_KEY = 'clickVolume';
const BG_VOLUME_KEY = 'bgVolume';

export const getClickVolume = (): number => {
  const saved = localStorage.getItem(CLICK_VOLUME_KEY);
  return saved ? parseFloat(saved) : 0.3;
};

export const setClickVolume = (volume: number) => {
  localStorage.setItem(CLICK_VOLUME_KEY, volume.toString());
};

export const getBgVolume = (): number => {
  const saved = localStorage.getItem(BG_VOLUME_KEY);
  return saved ? parseFloat(saved) : 0.3;
};

export const setBgVolume = (volume: number) => {
  localStorage.setItem(BG_VOLUME_KEY, volume.toString());
};

// Web Audio API 컨텍스트 (싱글톤)
let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext => {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
};

// 모바일 브라우저를 위한 AudioContext 초기화 및 resume
// 첫 번째 사용자 인터랙션 시 호출되어야 함
export const initAudioContext = async (): Promise<void> => {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      // 오디오 초기화 실패 무시
    }
  }
};

// 음계 주파수
const NOTES = {
  C3: 130.81,
  D3: 146.83,
  E3: 164.81,
  F3: 174.61,
  G3: 196.00,
  A3: 220.00,
  B3: 246.94,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.00,
  A4: 440.00,
  B4: 493.88,
  C5: 523.25,
  E5: 659.25,
  G5: 783.99,
};

// 네비게이션별 음계 (펜타토닉 스케일 - 더 조화로움)
const NAV_NOTES: { [key: string]: number } = {
  HOME: NOTES.C4,
  ABOUT: NOTES.D4,
  LOCATION: NOTES.E4,
  WORK: NOTES.G4,
  FILED: NOTES.A4,
  CV: NOTES.C5,
  CONTACT: NOTES.E5,
};

// 호버 아르페지오 패턴
let hoverIndex = 0;
const HOVER_ARPEGGIO = [NOTES.E4, NOTES.G4, NOTES.C5, NOTES.E5, NOTES.C5, NOTES.G4];

// ============================================
// FM Synthesizer Core
// ============================================

interface FMParams {
  carrierFreq: number;      // 캐리어 주파수
  modRatio: number;         // 모듈레이터 비율 (carrier * ratio)
  modIndex: number;         // 모듈레이션 인덱스 (깊이)
  duration: number;         // 지속 시간
  volume: number;           // 볼륨
  attack: number;           // 어택 시간
  decay: number;            // 디케이 시간
  sustain: number;          // 서스테인 레벨
  release: number;          // 릴리즈 시간
  modAttack?: number;       // 모듈레이션 어택
  modDecay?: number;        // 모듈레이션 디케이
  filterFreq?: number;      // 필터 주파수
  filterQ?: number;         // 필터 Q
  detune?: number;          // 디튠 (센트)
  pan?: number;             // 패닝 (-1 ~ 1)
}

const playFMSynth = (params: FMParams) => {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    const {
      carrierFreq,
      modRatio,
      modIndex,
      duration,
      volume,
      attack,
      decay,
      sustain,
      release,
      modAttack = attack,
      modDecay = decay * 2,
      filterFreq = 4000,
      filterQ = 1,
      detune = 0,
      pan = 0,
    } = params;

    // === 모듈레이터 오실레이터 ===
    const modulator = ctx.createOscillator();
    const modGain = ctx.createGain();
    modulator.type = 'sine';
    modulator.frequency.setValueAtTime(carrierFreq * modRatio, now);

    // 모듈레이션 깊이 (인덱스 * 캐리어 주파수)
    const maxModDepth = modIndex * carrierFreq;
    modGain.gain.setValueAtTime(0, now);
    modGain.gain.linearRampToValueAtTime(maxModDepth, now + modAttack);
    modGain.gain.linearRampToValueAtTime(maxModDepth * 0.6, now + modAttack + modDecay);
    modGain.gain.linearRampToValueAtTime(0, now + duration);

    modulator.connect(modGain);

    // === 캐리어 오실레이터 ===
    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(carrierFreq, now);
    carrier.detune.setValueAtTime(detune, now);

    // FM 연결: 모듈레이터 → 캐리어 주파수
    modGain.connect(carrier.frequency);

    // === 앰프 엔벨로프 (ADSR) ===
    const ampEnv = ctx.createGain();
    ampEnv.gain.setValueAtTime(0, now);
    ampEnv.gain.linearRampToValueAtTime(volume, now + attack);
    ampEnv.gain.linearRampToValueAtTime(volume * sustain, now + attack + decay);
    ampEnv.gain.setValueAtTime(volume * sustain, now + duration - release);
    ampEnv.gain.exponentialRampToValueAtTime(0.001, now + duration);

    // === 필터 ===
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, now);
    filter.frequency.linearRampToValueAtTime(filterFreq * 0.5, now + duration);
    filter.Q.setValueAtTime(filterQ, now);

    // === 패너 ===
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(pan, now);

    // === 리버브 시뮬레이션 (딜레이) ===
    const delayNode = ctx.createDelay();
    const delayGain = ctx.createGain();
    delayNode.delayTime.setValueAtTime(0.03, now);
    delayGain.gain.setValueAtTime(0.2, now);

    // === 연결 ===
    carrier.connect(filter);
    filter.connect(ampEnv);
    ampEnv.connect(panner);
    panner.connect(ctx.destination);

    // 딜레이 (공간감)
    ampEnv.connect(delayNode);
    delayNode.connect(delayGain);
    delayGain.connect(panner);

    // === 재생 ===
    modulator.start(now);
    carrier.start(now);
    modulator.stop(now + duration + 0.1);
    carrier.stop(now + duration + 0.1);

  } catch (error) {
    // 오디오 에러 무시
  }
};

// ============================================
// 벨 / 글로켄 사운드 (FM)
// ============================================
const playBellFM = (freq: number, vol: number, duration: number = 0.4) => {
  playFMSynth({
    carrierFreq: freq,
    modRatio: 3.5,           // 비정수 비율 = 벨 같은 음색
    modIndex: 2.5,
    duration,
    volume: vol,
    attack: 0.002,
    decay: 0.1,
    sustain: 0.3,
    release: 0.2,
    modDecay: 0.15,
    filterFreq: 6000,
    filterQ: 0.5,
  });
};

// ============================================
// 글래시 / 크리스탈 사운드 (FM)
// ============================================
const playGlassFM = (freq: number, vol: number) => {
  playFMSynth({
    carrierFreq: freq,
    modRatio: 7,            // 높은 비율 = 유리 같은 밝은 음색
    modIndex: 1.5,
    duration: 0.25,
    volume: vol * 0.8,
    attack: 0.001,
    decay: 0.05,
    sustain: 0.2,
    release: 0.15,
    filterFreq: 8000,
    filterQ: 2,
    detune: 5,
  });
};

// ============================================
// 소프트 패드 사운드 (FM)
// ============================================
const playPadFM = (freq: number, vol: number) => {
  playFMSynth({
    carrierFreq: freq,
    modRatio: 2,            // 정수 비율 = 부드러운 음색
    modIndex: 0.8,
    duration: 0.5,
    volume: vol * 0.6,
    attack: 0.05,
    decay: 0.1,
    sustain: 0.5,
    release: 0.3,
    filterFreq: 2000,
    filterQ: 0.7,
  });
};

// ============================================
// 플럭 / 퍼커시브 사운드 (FM)
// ============================================
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const playPluckFM = (freq: number, vol: number) => {
  playFMSynth({
    carrierFreq: freq,
    modRatio: 1,
    modIndex: 8,            // 높은 인덱스 + 빠른 디케이 = 플럭
    duration: 0.2,
    volume: vol,
    attack: 0.001,
    decay: 0.08,
    sustain: 0.1,
    release: 0.1,
    modDecay: 0.03,         // 매우 빠른 모듈레이션 디케이
    filterFreq: 5000,
  });
};

// ============================================
// 호버 사운드 - 글래시 아르페지오
// ============================================
export const playHoverSound = () => {
  const vol = getClickVolume() * 0.25;
  const note = HOVER_ARPEGGIO[hoverIndex % HOVER_ARPEGGIO.length];
  hoverIndex++;

  // 글래시한 FM 사운드
  playGlassFM(note, vol);
};

// ============================================
// 클릭 사운드 - 벨 + 하모닉 (긴 릴리즈)
// ============================================
export const playClickSound = () => {
  const vol = getClickVolume() * 0.35;

  // 메인 벨 톤 (긴 지속시간으로 자연스러운 페이드아웃)
  playFMSynth({
    carrierFreq: NOTES.C5,
    modRatio: 3.5,
    modIndex: 2.5,
    duration: 0.8,           // 더 긴 지속시간
    volume: vol,
    attack: 0.002,
    decay: 0.1,
    sustain: 0.3,
    release: 0.5,            // 긴 릴리즈
    modDecay: 0.15,
    filterFreq: 6000,
    filterQ: 0.5,
  });

  // 옥타브 하모닉 (살짝 지연)
  setTimeout(() => {
    playFMSynth({
      carrierFreq: NOTES.G4,
      modRatio: 7,
      modIndex: 1.5,
      duration: 0.6,         // 더 긴 지속시간
      volume: vol * 0.4,
      attack: 0.001,
      decay: 0.05,
      sustain: 0.2,
      release: 0.4,          // 긴 릴리즈
      filterFreq: 8000,
      filterQ: 2,
      detune: 5,
    });
  }, 20);
};

// ============================================
// 네비게이션 사운드 - 페이지별 음계
// ============================================
export const playNavSound = (page: string) => {
  const vol = getClickVolume() * 0.4;
  const freq = NAV_NOTES[page] || NOTES.C4;

  // 메인 벨 톤
  playBellFM(freq, vol, 0.5);

  // 5도 위 하모닉 (풍부한 사운드)
  setTimeout(() => {
    playFMSynth({
      carrierFreq: freq * 1.5,  // 5도 위
      modRatio: 2,
      modIndex: 1.2,
      duration: 0.35,
      volume: vol * 0.3,
      attack: 0.01,
      decay: 0.08,
      sustain: 0.3,
      release: 0.2,
      filterFreq: 3000,
      pan: 0.3,
    });
  }, 40);

  // 옥타브 아래 레이어 (깊이감)
  setTimeout(() => {
    playPadFM(freq * 0.5, vol * 0.2);
  }, 30);
};

// ============================================
// 성공 사운드 - 상승 아르페지오
// ============================================
export const playSuccessSound = () => {
  const vol = getClickVolume() * 0.3;
  const notes = [NOTES.C4, NOTES.E4, NOTES.G4, NOTES.C5];

  notes.forEach((note, i) => {
    setTimeout(() => {
      playBellFM(note, vol * (0.8 + i * 0.1), 0.3);
    }, i * 60);
  });
};

// ============================================
// 에러 사운드 - 하강 디스코드
// ============================================
export const playErrorSound = () => {
  const vol = getClickVolume() * 0.35;

  // 불협화음 FM
  playFMSynth({
    carrierFreq: NOTES.E4,
    modRatio: 1.414,          // 비정수 = 불협화음
    modIndex: 4,
    duration: 0.15,
    volume: vol,
    attack: 0.002,
    decay: 0.05,
    sustain: 0.2,
    release: 0.08,
    filterFreq: 2000,
  });

  setTimeout(() => {
    playFMSynth({
      carrierFreq: NOTES.C4,
      modRatio: 1.414,
      modIndex: 3,
      duration: 0.25,
      volume: vol,
      attack: 0.002,
      decay: 0.1,
      sustain: 0.2,
      release: 0.1,
      filterFreq: 1500,
    });
  }, 80);
};

// ============================================
// 알림 사운드 - 부드러운 차임
// ============================================
export const playNotificationSound = () => {
  const vol = getClickVolume() * 0.35;

  playBellFM(NOTES.E5, vol, 0.4);

  setTimeout(() => {
    playBellFM(NOTES.C5, vol * 0.7, 0.5);
  }, 150);
};

// ============================================
// 앰비언트 드론 (백그라운드용)
// ============================================
export const playAmbientDrone = (freq: number = NOTES.C3, duration: number = 2) => {
  const vol = getBgVolume() * 0.15;

  playFMSynth({
    carrierFreq: freq,
    modRatio: 1.01,           // 아주 약간의 비트
    modIndex: 0.3,
    duration,
    volume: vol,
    attack: 0.5,
    decay: 0.3,
    sustain: 0.7,
    release: 0.8,
    filterFreq: 800,
    filterQ: 2,
  });

  // 5도 위 레이어
  playFMSynth({
    carrierFreq: freq * 1.5,
    modRatio: 2,
    modIndex: 0.2,
    duration: duration * 0.8,
    volume: vol * 0.5,
    attack: 0.8,
    decay: 0.2,
    sustain: 0.6,
    release: 0.6,
    filterFreq: 600,
    pan: 0.3,
  });
};
