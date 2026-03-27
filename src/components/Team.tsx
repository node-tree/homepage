import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import p5 from 'p5';
import './Team.css';

interface TeamMember {
  name: string;
  nameEn: string;
  role: string;
  bio: string[];
  links?: { label: string; url: string }[];
}

const TEAM_MEMBERS: TeamMember[] = [
  {
    name: '이화영',
    nameEn: 'Hwayoung Lee',
    role: 'Team Leader / 설치미술',
    bio: [
      '한국예술종합학교 미술원 조형예술과 전문사',
      '도시기록 프로젝트팀 NODE TREE 대표(2016~)',
      '(주)생산소 대표(2021~)',
      '충남창작스튜디오 2기 입주작가(2025-2026)',
      '설치 총괄 — 충남 서해안 간척지에서 폐어망·부식 금속·해양 폐기물을 수집하여 그물 기둥(Net Pillar) 구조체 제작',
    ],
    links: [
      { label: '포트폴리오 다운로드', url: 'https://drive.google.com/drive/folders/16XdWrLsjS90HWzNUpySrcKmKmvRWsOmA?usp=sharing' },
      { label: 'nodetree.kr', url: 'https://www.nodetree.kr' },
    ],
  },
  {
    name: '정강현',
    nameEn: 'Kanghyun Jung',
    role: '사운드·인터랙티브 시스템',
    bio: [
      '한양대학교 뉴미디어 음악 작곡',
      '모듈러 신스·필드 레코딩 기반 사운드 아티스트',
      'NODE TREE 공동 창립(2017~)',
      '열화 등급을 빛·소리 파라미터로 변환하는 모듈러 신스 패치 설계',
      'CV 신호를 통해 부식 데이터를 사운드스케이프로 실시간 변조',
    ],
    links: [
      { label: '포트폴리오 다운로드', url: 'https://drive.google.com/drive/folders/16XdWrLsjS90HWzNUpySrcKmKmvRWsOmA?usp=sharing' },
      { label: 'nodetree.kr', url: 'https://www.nodetree.kr' },
    ],
  },
  {
    name: '강정아',
    nameEn: 'Jeonga Kang',
    role: '기획·아카이브',
    bio: [
      '동국대 불교학 전공 / 동국대학교 불교미술유산학과 석사 재학',
      '히스테리안 출판사 운영(2018.4~)',
      '전시 텍스트와 도록 서문으로 담론적 맥락 구축',
      '비평 프레이밍 및 전시 방향 설정 담당',
    ],
    links: [
      { label: 'hysterianpublic.com', url: 'https://www.hysterianpublic.com/work' },
      { label: 'Instagram', url: 'https://www.instagram.com/hysterian.public/' },
    ],
  },
  {
    name: '남궁예은',
    nameEn: 'Yeeun Namgung',
    role: '사운드 아트·라이브 코딩',
    bio: [
      '비엔나 응용예술대학교 Cross-Disciplinary Strategies BA',
      '라이브 코딩 기반 사운드 아티스트',
      '라이브 코딩 커뮤니티 TOPLAP Seoul 설립 및 활동(2025.02~)',
      '보존과학 데이터를 시각 패턴 변환 알고리즘으로 처리하여 기둥별 LED 제어',
      'TidalCycles·Hydra 라이브 코딩으로 실연',
    ],
    links: [
      { label: '포트폴리오 다운로드', url: 'https://drive.google.com/drive/folders/1ueLJ7oq7Cc3gnRDTK-Ojgmk5t7n7vjW_?usp=sharing' },
      { label: 'Instagram', url: 'https://www.instagram.com/sophiologin/' },
    ],
  },
  {
    name: '이상옥',
    nameEn: 'Sangok Lee',
    role: '보존과학',
    bio: [
      '한국전통문화대학교 조교수·학과장',
      '수집 금속 시편의 XRF·Raman 분광 분석 담당',
      '부식생성물의 광물 조성과 열화 등급 데이터화',
      '「출토 청동유물의 납 함량에 따른 부식층 및 부식생성물 특성 분석」(2022, 보존과학회지)',
      '「목조 건축문화재에 사용된 구조·보강용 전통 철물의 재사용 방안 연구」(2022, 보존과학회지)',
    ],
    links: [
      { label: '한국전통문화대학교 교수 소개', url: 'https://www.knuh.ac.kr/mep/ots/proIntro/view.do?tplBaseId=TPL0000001&mnuBaseId=MNU0000350&topBaseId=MNU0000349&major=MAJCSM' },
    ],
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.3,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 100,
      damping: 20,
    },
  },
};

// ═══════════════════════════════════════════════════════════════
// Corrosive Weaving — p5 background sketch (perpetual, fluid)
// ═══════════════════════════════════════════════════════════════
function corrosiveSketch(p: p5) {
  const MINERAL_PALETTE = [
    [61, 139, 110],   // malachite
    [139, 58, 42],    // hematite
    [196, 149, 58],   // goethite
    [42, 74, 123],    // azurite
    [212, 207, 192],  // calcite
  ];

  const SEED = 2026;
  const PILLAR_COUNT = 5;
  const FILAMENT_COUNT = 1800;

  let filaments: any[] = [];
  let pillars: any[] = [];
  let frameAge = 0;
  let _seed = SEED;
  let scrollY = 0;

  function seededRandom() {
    _seed = (_seed * 9301 + 49297) % 233280;
    return _seed / 233280;
  }

  p.setup = () => {
    const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
    canvas.style('display', 'block');
    canvas.style('position', 'fixed');
    canvas.style('top', '0');
    canvas.style('left', '0');
    canvas.style('z-index', '0');
    canvas.style('pointer-events', 'none');

    p.randomSeed(SEED);
    p.noiseSeed(SEED);
    _seed = SEED;

    initPillars();
    initFilaments();
    p.background(11, 11, 13);
  };

  function initPillars() {
    pillars = [];
    const margin = p.width * 0.08;
    const spacing = (p.width - margin * 2) / Math.max(PILLAR_COUNT - 1, 1);
    for (let i = 0; i < PILLAR_COUNT; i++) {
      pillars.push({
        x: margin + i * spacing,
        mineralIdx: i % MINERAL_PALETTE.length,
        width: p.width / PILLAR_COUNT * 0.65,
        noiseOff: i * 1000 + SEED * 0.1,
        grade: 0.3 + seededRandom() * 0.7,
        // Each pillar breathes at its own frequency
        breathFreq: 0.008 + seededRandom() * 0.012,
        breathAmp: 15 + seededRandom() * 25,
      });
    }
  }

  function initFilaments() {
    filaments = [];
    const perPillar = Math.floor(FILAMENT_COUNT / PILLAR_COUNT);
    for (const pil of pillars) {
      for (let i = 0; i < perPillar; i++) {
        filaments.push(createFilament(pil, true));
      }
    }
  }

  function createFilament(pil: any, scatter: boolean) {
    const baseColor = MINERAL_PALETTE[pil.mineralIdx];
    const secIdx = (pil.mineralIdx + 1 + Math.floor(seededRandom() * 3)) % MINERAL_PALETTE.length;
    const secondary = MINERAL_PALETTE[secIdx];
    const mix = seededRandom() * 0.4;

    return {
      pillar: pil,
      x: pil.x + (seededRandom() - 0.5) * pil.width,
      y: scatter ? seededRandom() * p.height : p.height + seededRandom() * 30,
      life: scatter ? Math.floor(seededRandom() * 200) : 0,
      maxLife: 180 + seededRandom() * 400,
      vy: -(0.3 + seededRandom() * 0.8),
      r: p.lerp(baseColor[0], secondary[0], mix) + (seededRandom() - 0.5) * 25,
      g: p.lerp(baseColor[1], secondary[1], mix) + (seededRandom() - 0.5) * 25,
      b: p.lerp(baseColor[2], secondary[2], mix) + (seededRandom() - 0.5) * 25,
      sw: 0.5 + seededRandom() * 1.5 * pil.grade,
      prevX: 0,
      prevY: 0,
      // Individual noise phase for fluid variation
      phase: seededRandom() * 1000,
    };
  }

  p.draw = () => {
    // Track scroll for parallax offset
    scrollY = window.scrollY || 0;

    // Slow fade — trails accumulate into patina
    p.noStroke();
    p.fill(11, 11, 13, 8);
    p.rect(0, 0, p.width, p.height);

    frameAge++;

    // Time-based evolution: the whole field slowly morphs
    const timeShift = frameAge * 0.0008;
    const scrollFactor = scrollY * 0.0003;

    for (let i = filaments.length - 1; i >= 0; i--) {
      const f = filaments[i];
      f.prevX = f.x;
      f.prevY = f.y;

      // Pillar breathing — center oscillates
      const breathOffset = Math.sin(frameAge * f.pillar.breathFreq) * f.pillar.breathAmp;

      // Multi-octave noise for fluid, organic motion
      const n1 = p.noise(
        f.x * 0.006 + f.pillar.noiseOff,
        f.y * 0.003 + timeShift,
        f.phase * 0.01
      );
      const n2 = p.noise(
        f.x * 0.015 + f.phase,
        f.y * 0.008,
        timeShift * 2
      );

      // Combine: large drift + fine jitter
      const angle = (n1 - 0.5) * p.TWO_PI * 0.7 + (n2 - 0.5) * 0.8;
      f.x += Math.cos(angle) * 1.1;
      f.y += f.vy - scrollFactor * 0.3;

      // Attract back to breathing pillar center
      const pillarCenter = f.pillar.x + breathOffset;
      f.x += (pillarCenter - f.x) * 0.0025;

      f.life++;

      // Draw with layered opacity
      const ageFactor = Math.min(f.life / 40, 1.0);
      const fadeFactor = f.life > f.maxLife * 0.75
        ? 1.0 - (f.life - f.maxLife * 0.75) / (f.maxLife * 0.25)
        : 1.0;
      const alpha = 50 * ageFactor * fadeFactor;

      p.stroke(f.r, f.g, f.b, alpha);
      p.strokeWeight(f.sw);
      p.line(f.prevX, f.prevY, f.x, f.y);

      // Reset dead filaments
      if (f.life > f.maxLife || f.y < -30) {
        filaments[i] = createFilament(f.pillar, false);
      }
    }

    // Horizontal weave — fishing net threads connecting pillars
    if (frameAge % 7 === 0) {
      const ny = seededRandom() * p.height;
      const mineralIdx = Math.floor(seededRandom() * MINERAL_PALETTE.length);
      const c = MINERAL_PALETTE[mineralIdx];
      p.stroke(c[0], c[1], c[2], 15 + seededRandom() * 20);
      p.strokeWeight(0.4 + seededRandom() * 0.6);
      p.noFill();
      p.beginShape();
      for (let x = 0; x < p.width; x += 8) {
        const yn = ny +
          p.noise(x * 0.004 + timeShift, frameAge * 0.005, SEED * 0.01) * 50 - 25 +
          Math.sin(x * 0.01 + frameAge * 0.02) * 8;
        p.vertex(x, yn);
      }
      p.endShape();
    }

    // Occasional bright mineral flare — simulates XRF spectral flash
    if (frameAge % 120 === 0) {
      const flarePillar = pillars[Math.floor(seededRandom() * pillars.length)];
      const flareC = MINERAL_PALETTE[flarePillar.mineralIdx];
      const fy = seededRandom() * p.height;
      p.noStroke();
      for (let r = 80; r > 0; r -= 5) {
        p.fill(flareC[0], flareC[1], flareC[2], (80 - r) * 0.5);
        p.ellipse(flarePillar.x, fy, r, r * 0.6);
      }
    }
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    initPillars();
    // Reassign pillar references for existing filaments
    filaments.forEach((f, i) => {
      f.pillar = pillars[i % pillars.length];
    });
  };
}

// ═══════════════════════════════════════════════════════════════
// TEAM COMPONENT
// ═══════════════════════════════════════════════════════════════
const Team: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const p5Ref = useRef<p5 | null>(null);

  useEffect(() => {
    if (canvasRef.current && !p5Ref.current) {
      p5Ref.current = new p5(corrosiveSketch, canvasRef.current);
    }
    return () => {
      if (p5Ref.current) {
        p5Ref.current.remove();
        p5Ref.current = null;
      }
    };
  }, []);

  return (
    <div className="team-page">
      <div ref={canvasRef} className="team-bg-canvas" />

      <div className="team-container">
        {/* Header — left-aligned, asymmetric */}
        <motion.div
          className="team-header"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 80, damping: 20, delay: 0.1 }}
        >
          <h1 className="team-title">NODE TREE Corpus</h1>
          <p className="team-subtitle">
            Corrosiphonia textilis — 부식이 직조한 종(種)의 발견
          </p>
        </motion.div>

        {/* Intro — border-left accent */}
        <motion.div
          className="team-intro"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 80, damping: 20, delay: 0.25 }}
        >
          <p>
            하나의 물질이 하나의 언어로 충분했던 적은 없다.
          </p>
          <p>
            부식은 동시에 여러 겹의 실재를 품는다. 수십 년의 해수와 산소가 협업해 만든 화학적 기록이자, 해양 자본주의의 잔해이자, 감각이 아직 도달하지 못한 소리의 악보다. 어느 하나의 언어가 이 물질을 전유하는 순간, 나머지 겹들은 사라진다. NODE TREE Corpus는 그 소멸에 저항하기 위해 구성된 협업체다 — 과학, 조형, 사운드, 라이브 코딩, 비평이 각자의 언어를 유지한 채 하나의 물질 앞에 동시에 선다.
          </p>
          <p>
            이화영(설치미술), 이상옥(보존과학), 정강현(사운드·인터랙티브 시스템), 남궁예은(사운드 아트·라이브 코딩), 강정아(기획·아카이브)로 구성된 다섯 사람의 실천은 서로를 번역하되 서로로 환원되지 않는다.
          </p>
          <p>
            Corrosiphonia textilis는 그 비환원성 위에서만 존재한다.
          </p>
        </motion.div>

        {/* Members — asymmetric 2-col grid */}
        <motion.div
          className="team-members"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {TEAM_MEMBERS.map((member, index) => (
            <motion.div
              key={index}
              className="member-card"
              variants={itemVariants}
              whileHover={{
                y: -3,
                transition: { type: 'spring', stiffness: 300, damping: 25 },
              }}
            >
              <div className="member-info">
                <div className="member-name-group">
                  <h2 className="member-name">{member.name}</h2>
                  <span className="member-name-en">{member.nameEn}</span>
                </div>
                <span className="member-role">{member.role}</span>
                <ul className="member-bio">
                  {member.bio.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
                <div className="member-links">
                  <span className="member-portfolio-label">Portfolio</span>
                  {member.links && member.links.length > 0 ? (
                    member.links.map((link, i) => (
                      <a
                        key={i}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="member-link"
                      >
                        {link.label}
                      </a>
                    ))
                  ) : (
                    <span className="member-link-placeholder">--</span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

      </div>
    </div>
  );
};

export default Team;
