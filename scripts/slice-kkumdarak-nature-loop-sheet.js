const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = '/Users/kanghyunjung/Desktop/2026/꿈다락/이미지/메인자연풍경';
const source = path.join(root, '01_loop-sheets/hero-nature-loop-sheet-01.png');
const rasterDir = path.join(root, '02_cropped-raster-frames');
const vectorDir = path.join(root, '03_vectorized-frames');
const mapDir = path.join(root, '04_motion-map');

const layers = [
  { id: 'river-flow', row: 0, fps: 10, motion: 'water-flow-left-to-right' },
  { id: 'hill-trees-sway', row: 1, fps: 8, motion: 'trees-sway-in-wind' },
  { id: 'distant-mountain-breath', row: 2, fps: 6, motion: 'mountain-breath-tree-sway' },
  { id: 'fireflies-fly', row: 3, fps: 12, motion: 'fireflies-looping-arcs' },
  { id: 'leaves-seeds-drift', row: 4, fps: 8, motion: 'leaves-seeds-circular-drift' },
];

const width = 1536;
const height = 1024;
const cols = 6;

const resetDir = (dir) => {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
};

resetDir(rasterDir);
resetDir(vectorDir);
resetDir(mapDir);

const manifest = {
  workflow: 'hero-nature-loop-raster-first',
  sourceSheet: '../01_loop-sheets/hero-nature-loop-sheet-01.png',
  frameCount: 6,
  rasterFrames: '../02_cropped-raster-frames',
  vectorFrames: '../03_vectorized-frames',
  layers: [],
};

layers.forEach((layer) => {
  const layerRasterDir = path.join(rasterDir, layer.id);
  const layerVectorDir = path.join(vectorDir, layer.id);
  fs.mkdirSync(layerRasterDir, { recursive: true });
  fs.mkdirSync(layerVectorDir, { recursive: true });

  const frames = [];
  for (let col = 0; col < cols; col += 1) {
    const x = Math.round((col * width) / cols);
    const y = Math.round((layer.row * height) / layers.length);
    const nextX = Math.round(((col + 1) * width) / cols);
    const nextY = Math.round(((layer.row + 1) * height) / layers.length);
    const w = nextX - x;
    const h = nextY - y;
    const frameName = `${layer.id}-frame-${String(col + 1).padStart(2, '0')}.png`;
    const out = path.join(layerRasterDir, frameName);
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
    id: layer.id,
    motion: layer.motion,
    fps: layer.fps,
    loop: true,
    rasterFrames: frames,
    vectorFramesTarget: `../03_vectorized-frames/${layer.id}`,
  };
  fs.writeFileSync(path.join(layerRasterDir, 'motion.json'), JSON.stringify(info, null, 2));
  manifest.layers.push(info);
});

fs.writeFileSync(path.join(mapDir, 'hero-nature-motion-map.json'), JSON.stringify(manifest, null, 2));
console.log(`Sliced ${layers.length} nature layers into ${layers.length * cols} raster frames.`);
