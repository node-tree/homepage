/**
 * TimeStackInfographic — 부산 수직 부식층 (1678~현재)
 *
 * 작품 《공생직조》 리서치 §2 축A.
 * 7개 시간 층이 위에서 아래로 쌓이며, 각 층은 윗 층을 떠받치고 동시에 침식된다.
 * 호버 시 거주자·현장단서 노출.
 */
import React, { useState } from 'react';

interface Layer {
  level: number;
  era: string;
  years: string;
  residents: string;
  fieldClues?: string[];
  /** 부식 색조 — rust(7) → oxide(1) 그라디언트 */
  color: string;
}

const LAYERS: Layer[] = [
  {
    level: 7,
    era: '현재',
    years: '1990~',
    residents: '재개발 잔여민, 외국인 노동자, 관광지로 전시되는 가난',
    fieldClues: ['감천문화마을', '산복도로'],
    color: '#b8540f',
  },
  {
    level: 6,
    era: '산업화',
    years: '1960–1980',
    residents: '깡깡이 아지매, 영도 조선소 노동자, 자갈치 여성 상인',
    fieldClues: ['깡깡이예술마을', '영도'],
    color: '#a05010',
  },
  {
    level: 5,
    era: '한국전쟁',
    years: '1950–1953',
    residents: '피난민, 미군, 양공주, 텍사스촌',
    fieldClues: ['아미동 비석마을', '하야리아 부지'],
    color: '#7a4f1f',
  },
  {
    level: 4,
    era: '해방 후',
    years: '1945–1950',
    residents: '만주·일본 귀환동포, 적산가옥의 새 주인들',
    fieldClues: ['우암동 소막마을(등록문화재 715호)'],
    color: '#5a523a',
  },
  {
    level: 3,
    era: '일제강점기',
    years: '1910–1945',
    residents: '매축지 노동자, 부관연락선의 만주 이주민, 우역검역소 소(牛)',
    fieldClues: ['매축지마을', '소막마을'],
    color: '#4a5946',
  },
  {
    level: 2,
    era: '개항기',
    years: '1876~',
    residents: '일본 거류민, 산둥 화교, 매축 노동자',
    color: '#3a5d52',
  },
  {
    level: 1,
    era: '초량왜관',
    years: '1678~',
    residents: '일본 사신·상인, 수문 안의 통제된 타자',
    color: '#2a5560',
  },
];

const TimeStackInfographic: React.FC = () => {
  const [hoveredLevel, setHoveredLevel] = useState<number | null>(null);

  // 각 층 위로 갈수록 약간 좁아지며(쌓이는 무게감), 색은 점차 부식이 진행됨
  const W = 640;
  const layerH = 38;
  const gap = 2;
  const totalH = (layerH + gap) * LAYERS.length + 60;

  return (
    <figure className="time-stack-figure">
      <figcaption className="time-stack-caption">
        <span className="time-stack-label">RESEARCH §2 축 A</span>
        <span className="time-stack-title">부산의 수직적 부식 — 시간의 층</span>
        <span className="time-stack-subtitle">
          각 층은 윗 층을 떠받치는 동시에 침식되어 사라진다. 마우스를 올리면 거주자가 드러난다.
        </span>
      </figcaption>

      <div className="time-stack-canvas-wrap">
        <svg
          viewBox={`0 0 ${W} ${totalH}`}
          className="time-stack-svg"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="erosion-fade" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#0a0a0a" stopOpacity="0" />
              <stop offset="1" stopColor="#0a0a0a" stopOpacity="0.4" />
            </linearGradient>
            <pattern id="corrosion-dots" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
              <circle cx="3" cy="3" r="0.5" fill="#fafaf7" opacity="0.18" />
            </pattern>
          </defs>

          {/* 표면 라인 (현재) */}
          <line x1="20" y1="40" x2={W - 20} y2="40" stroke="#888" strokeWidth="1" strokeDasharray="2 4" />
          <text x="20" y="32" className="time-stack-axis">표면 (관찰자 시점)</text>

          {LAYERS.map((layer, i) => {
            const y = 50 + i * (layerH + gap);
            // 위로 갈수록 살짝 좁아져서 쌓이는 느낌
            const inset = i * 4;
            const x = 20 + inset;
            const w = W - 40 - inset * 2;
            const isHovered = hoveredLevel === layer.level;
            const opacity = hoveredLevel === null ? 1 : isHovered ? 1 : 0.35;

            return (
              <g
                key={layer.level}
                style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                opacity={opacity}
                onMouseEnter={() => setHoveredLevel(layer.level)}
                onMouseLeave={() => setHoveredLevel(null)}
              >
                {/* 층 본체 */}
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={layerH}
                  fill={layer.color}
                />
                {/* 부식 텍스처 (위 4개 층) */}
                {i < 4 && (
                  <rect x={x} y={y} width={w} height={layerH} fill="url(#corrosion-dots)" />
                )}
                {/* 우측 fade (사라지는 시간) */}
                <rect x={x} y={y} width={w} height={layerH} fill="url(#erosion-fade)" />

                {/* 좌측 라벨 */}
                <text x={x + 12} y={y + 17} className="time-stack-era">
                  L{layer.level} · {layer.era}
                </text>
                <text x={x + 12} y={y + 30} className="time-stack-years">
                  {layer.years}
                </text>

                {/* 우측 거주자 키워드 */}
                <text
                  x={x + w - 12}
                  y={y + 24}
                  className="time-stack-residents"
                  textAnchor="end"
                >
                  {layer.residents.split(',')[0].trim()}
                </text>
              </g>
            );
          })}
        </svg>

        {/* 호버 패널 */}
        {hoveredLevel !== null && (() => {
          const layer = LAYERS.find(l => l.level === hoveredLevel)!;
          return (
            <div className="time-stack-detail">
              <div className="time-stack-detail-head">
                <span className="time-stack-detail-level">L{layer.level}</span>
                <span className="time-stack-detail-era">{layer.era}</span>
                <span className="time-stack-detail-years">{layer.years}</span>
              </div>
              <div className="time-stack-detail-residents">
                <strong>거주자</strong>
                <p>{layer.residents}</p>
              </div>
              {layer.fieldClues && (
                <div className="time-stack-detail-clues">
                  <strong>현장 단서</strong>
                  <p>{layer.fieldClues.join(' · ')}</p>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      <div className="time-stack-footnote">
        ↓ 1층 (1678) 갯벌 위에 7층 (현재) 유리탑까지. 각 층은 윗 층을 떠받치고 동시에 침식된다.
      </div>
    </figure>
  );
};

export default TimeStackInfographic;
