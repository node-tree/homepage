import React, { lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { useInViewOnce } from '../hooks/useInViewOnce';
import './Team.css';

// [perf] p5(gzip 331 kB) 배경 스케치는 별도 청크로 분리해 뷰포트 진입 시 마운트한다.
const TeamBackdrop = lazy(() => import('./TeamBackdrop'));

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
// TEAM COMPONENT
// ═══════════════════════════════════════════════════════════════
const Team: React.FC = () => {
  // 배경 캔버스 슬롯이 뷰포트(+200px)에 들어올 때 p5 청크를 요청한다.
  const [backdropRef, backdropInView] = useInViewOnce<HTMLDivElement>('200px');

  return (
    <div className="team-page">
      <div ref={backdropRef} className="team-bg-canvas-slot">
        {backdropInView && (
          <Suspense fallback={<div className="team-bg-canvas" aria-hidden="true" />}>
            <TeamBackdrop />
          </Suspense>
        )}
      </div>

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
