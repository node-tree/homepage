import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import NtPage from '../components/NtPage';
import PlateImage from '../components/PlateImage';
import RichHtml, { imagesIn } from '../components/RichHtml';
import { useAbout } from '../db';

// ════════════════════════════════════════════════════════════════════════
// About(/about · 내비 NODE TREE) — 내용은 DB(/api/about), 판식만 v5.
//   목업 정본: _workspace/03_mock/v5/about.html
//     좌 6정간 = 소개 문단(DB htmlContent 의 문단 전부)
//     우 10정간 = DB 에 실린 도판(대표 이미지). DB 에 없는 항목(구성원·매개 표)은
//     **만들지 않는다** — 자리만 남기고 값을 비운다(설계 §2.2 결측 규칙).
// ════════════════════════════════════════════════════════════════════════

/** 'ABOUT'/'노드 트리(NODE TREE)' 처럼 한글(영문) 꼴이면 영문을 <em> 으로 분리한다. */
function splitTitle(raw: string): { ko: string; en?: string } {
  const m = raw.match(/^\s*(.+?)\s*[(（]\s*([^)）]+)\s*[)）]\s*$/);
  if (m) return { ko: m[1], en: m[2] };
  return { ko: raw };
}

const About: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { data, error, loading, reload } = useAbout();

  const heading = splitTitle(data?.content || data?.title || 'NODE TREE');
  const plates = data ? imagesIn(data.htmlContent) : [];

  return (
    <NtPage
      path="/about"
      title="NODE TREE | About — 소개"
      description="NODE TREE(이화영+정강현)는 도시기록을 주제로 사운드, 영상, 설치 작업을 하는 아티스트 듀오입니다."
      keywords="NODE TREE 소개, 이화영, 정강현, 아티스트 듀오"
    >
      <section className="pagehead">
        <div className="lab">{data?.title || 'ABOUT'}</div>
        <h1>
          {heading.ko}
          {heading.en ? <em>{heading.en}</em> : null}
        </h1>
      </section>
      <div className="hair dae" />

      {loading && (
        <section className="state">
          <div>LOADING · 소개글을 불러오는 중…</div>
        </section>
      )}
      {error && (
        <section className="state">
          <div>
            ERROR · {error}
            <button onClick={reload}>다시 시도</button>
          </div>
        </section>
      )}

      {data && (
        <section className="about" style={{ paddingTop: 56 }}>
          <div className="lft">
            {data.htmlContent ? (
              <RichHtml html={data.htmlContent} className="rich" textOnlyMode />
            ) : (
              <div className="src">ABSENT · 아직 소개글이 없습니다.</div>
            )}
            {isAuthenticated && (
              <div className="adminline">
                편집 · <a href="/legacy/about">레거시 편집기</a>에서 수정한다
              </div>
            )}
          </div>

          <div className="rgt">
            <div className="blk">
              <b>도판 PLATES</b>
              {plates.length ? (
                plates.map((src, i) => (
                  <div className="fw" key={src} style={{ marginTop: i === 0 ? 0 : 34 }}>
                    <PlateImage src={src} alt={`${heading.ko} 도판 ${i + 1}`} ratio="3/2" w={1200} />
                    <div className="fcap">
                      도판 {i + 1} · 봉인 상태. 호버 시 개봉.
                    </div>
                  </div>
                ))
              ) : (
                <div className="fw" style={{ marginTop: 0 }}>
                  <PlateImage src={null} alt="도판 없음" ratio="3/2" note="ABSENT · 도판 미기재" />
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </NtPage>
  );
};

export default About;
