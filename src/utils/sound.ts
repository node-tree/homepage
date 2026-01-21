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

// 호버 사운드 재생 함수
export const playHoverSound = () => {
  const audio = new Audio('/click.wav');
  audio.volume = getClickVolume() * 0.6;
  audio.play().catch(() => {});
};

// 클릭 사운드 재생 함수
export const playClickSound = () => {
  const audio = new Audio('/click02.wav');
  audio.volume = getClickVolume();
  audio.play().catch(() => {});
};
