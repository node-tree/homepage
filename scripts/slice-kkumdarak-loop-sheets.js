const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = '/Users/kanghyunjung/Desktop/2026/꿈다락/이미지/캐릭터';
const sheetDir = path.join(root, '01_loop-sheets');
const rasterDir = path.join(root, '02_cropped-raster-frames');
const vectorDir = path.join(root, '03_vectorized-frames');
const mapDir = path.join(root, '04_motion-map');

const sheets = [
  {
    file: 'loop-sheet-01-characters-01-06.png',
    rows: ['01', '02', '03', '04', '05', '06'],
    width: 1536,
    height: 1024,
  },
  {
    file: 'loop-sheet-02-characters-07-12.png',
    rows: ['07', '08', '09', '10', '11', '12'],
    width: 1536,
    height: 1024,
  },
  {
    file: 'loop-sheet-03-characters-13-18.png',
    rows: ['13', '14', '15', '16', '17', '18'],
    width: 1402,
    height: 1122,
  },
  {
    file: 'loop-sheet-04-characters-19-21.png',
    rows: ['19', '20', '21'],
    width: 1774,
    height: 887,
  },
];

const motions = {
  '01': 'leaf-sway-breath',
  '02': 'small-bounce',
  '03': 'blink-body-bob',
  '04': 'sleepy-blink-star-twinkle',
  '05': 'antenna-arm-wave',
  '06': 'flower-wind-sway',
  '07': 'arms-wave-water-ripple',
  '08': 'sit-stand-bounce',
  '09': 'blink-glow-pulse',
  '10': 'wand-arm-wave',
  '11': 'flower-bob-water-ripple',
  '12': 'walking-bow',
  '13': 'blink-ear-wiggle',
  '14': 'wave-breath',
  '15': 'puff-breathing',
  '16': 'sprout-bounce-box-bob',
  '17': 'celebration-arm-wave',
  '18': 'root-wiggle-leaf-sway',
  '19': 'walk-in-place',
  '20': 'squat-bounce-blink',
  '21': 'tiny-walk-breath-blink',
};

const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });
const rmDir = (dir) => fs.rmSync(dir, { recursive: true, force: true });

rmDir(rasterDir);
rmDir(vectorDir);
rmDir(mapDir);
ensureDir(rasterDir);
ensureDir(vectorDir);
ensureDir(mapDir);

const manifest = {
  workflow: 'loop-raster-first',
  frameCount: 6,
  rasterFrames: '../02_cropped-raster-frames',
  vectorFrames: '../03_vectorized-frames',
  characters: [],
};

sheets.forEach((sheet) => {
  const source = path.join(sheetDir, sheet.file);
  const cols = 6;
  const cellW = Math.floor(sheet.width / cols);
  const cellH = Math.floor(sheet.height / sheet.rows.length);

  sheet.rows.forEach((characterId, rowIndex) => {
    const charDir = path.join(rasterDir, `character-${characterId}`);
    ensureDir(charDir);

    const frames = [];
    for (let col = 0; col < cols; col += 1) {
      const frameName = `character-${characterId}-frame-${String(col + 1).padStart(2, '0')}.png`;
      const out = path.join(charDir, frameName);
      const x = Math.round(col * sheet.width / cols);
      const y = Math.round(rowIndex * sheet.height / sheet.rows.length);
      const nextX = Math.round((col + 1) * sheet.width / cols);
      const nextY = Math.round((rowIndex + 1) * sheet.height / sheet.rows.length);
      const w = nextX - x;
      const h = nextY - y;
      execFileSync('sips', [
        '--cropToHeightWidth',
        String(h),
        String(w),
        '--cropOffset',
        String(y),
        String(x),
        source,
        '--out',
        out,
      ], { stdio: 'ignore' });
      frames.push(frameName);
    }

    const info = {
      id: characterId,
      motion: motions[characterId],
      fps: ['03', '04', '09', '13', '20', '21'].includes(characterId) ? 8 : 10,
      loop: true,
      sourceSheet: `../01_loop-sheets/${sheet.file}`,
      rasterFrames: frames,
      vectorFramesTarget: `../03_vectorized-frames/character-${characterId}`,
    };
    fs.writeFileSync(path.join(charDir, 'motion.json'), JSON.stringify(info, null, 2));
    manifest.characters.push(info);

    ensureDir(path.join(vectorDir, `character-${characterId}`));
  });
});

fs.writeFileSync(path.join(mapDir, 'loop-motion-map.json'), JSON.stringify(manifest, null, 2));
console.log(`Sliced ${manifest.characters.length} characters into ${manifest.characters.length * 6} raster frames.`);
