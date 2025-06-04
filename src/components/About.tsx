import React from 'react';

const About: React.FC = () => {
  return (
    <div className="page-content">
      <h1 className="page-title">
        ABOUT
        <div className="page-subtitle" style={{position: 'relative', top: 'auto', left: 'auto', transform: 'none', marginTop: '1rem'}}>NODE TREE에 대하여</div>
      </h1>
      
      {/* About 컨테이너 */}
      <div className="about-container">
        {/* 소개 섹션 */}
        <div className="about-intro-section">
          <h2 className="about-section-title">NODE TREE란?</h2>
          <p className="about-text page-body-text">
            NODE TREE는 디지털 아트와 인간의 관계, 공간과 위치, 그리고 창작 작업을 통해 
            현대 사회의 복잡한 네트워크 구조를 탐구하는 프로젝트입니다.
          </p>
        </div>
        
        {/* 철학 섹션 */}
        <div className="about-philosophy-section">
          <h2 className="about-section-title">철학과 접근법</h2>
          <div className="philosophy-grid">
            <div className="philosophy-item">
              <h3 className="philosophy-title">연결성</h3>
              <p className="philosophy-text page-body-text-small">
                모든 것은 연결되어 있다. 인간, 공간, 시간, 그리고 아이디어들 간의 
                보이지 않는 네트워크를 시각화합니다.
              </p>
            </div>
            <div className="philosophy-item">
              <h3 className="philosophy-title">지속성</h3>
              <p className="philosophy-text page-body-text-small">
                창작물과 아카이빙을 통해 순간들을 영속화하고, 
                시간의 흐름 속에서 의미를 축적합니다.
              </p>
            </div>
            <div className="philosophy-item">
              <h3 className="philosophy-title">상호작용</h3>
              <p className="philosophy-text page-body-text-small">
                관찰자와 작품, 작품과 공간, 공간과 시간 사이의 
                역동적인 상호작용을 추구합니다.
              </p>
            </div>
          </div>
        </div>
        
        {/* 비전 섹션 */}
        <div className="about-vision-section">
          <h2 className="about-section-title">비전</h2>
          <p className="about-text page-body-text">
            NODE TREE는 디지털과 아날로그, 개인과 집단, 과거와 미래를 연결하는 
            새로운 형태의 예술적 실험을 통해 인간의 경험을 확장하고자 합니다.
          </p>
          
          <div className="vision-stats">
            <div className="stat-card">
              <span className="stat-number">∞</span>
              <span className="stat-label page-body-text-small">가능성</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">●</span>
              <span className="stat-label page-body-text-small">연결점</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">◇</span>
              <span className="stat-label page-body-text-small">네트워크</span>
            </div>
          </div>
        </div>
        
        {/* 컨택트 섹션 */}
        <div className="about-contact-section">
          <h2 className="about-section-title">연결하기</h2>
          <p className="about-text page-body-text">
            NODE TREE 프로젝트에 대한 문의나 협업 제안은 언제든 환영합니다.
          </p>
          <div className="contact-links">
            <span className="contact-item page-body-text-small">협업 문의</span>
            <span className="contact-item page-body-text-small">전시 기획</span>
            <span className="contact-item page-body-text-small">프로젝트 참여</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About; 