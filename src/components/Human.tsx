import React from 'react';
import { motion } from 'framer-motion';
import './Human.css';

const Human: React.FC = () => {
  return (
    <div className="human-container">
      <div className="page-header">
        <h1 className="page-title">
          ART NETWORK
          <motion.div
            className="page-subtitle-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 1 }}
          >
            <div className="page-subtitle">예술의 장을 구성하는 여러 지점들-‘누구와 함께’, ‘무엇이 연결되는가’
              <br />
              <br />
              'Art Network'는 NODE TREE의 작업을 구성하는 관계적 구성체의 복합적 그물망이자, 그 과정을 <br />
              기록하는 카테고리이다. 노드 트리의 예술은 다양한 사람과 존재와 감응하는 존재하며 만들어진다.
            </div>
          </motion.div>
        </h1>
      </div>
      <div className="human-content">
        {/* 3D 컨텐츠가 여기에 렌더링될 것입니다. */}
      </div>
      
      {/* 캐릭터 프로필 컨테이너 */}
      <div className="character-profile-container">
        {/* 캐릭터 이미지 */}
        <div className="character-image-container">
          <div className="character-image-placeholder">
            <span className="page-body-text-small">캐릭터 이미지</span>
          </div>
        </div>
        
        {/* 캐릭터 정보 */}
        <div className="character-info-container">
          <div className="character-header">
            <h2 className="character-name">NODE TREE</h2>
            <p className="character-role page-body-text">디지털 아티스트</p>
          </div>
          
          <div className="character-description">
            <h3 className="character-section-title">배경 스토리</h3>
            <p className="character-text page-body-text">
              인간 중심의 사고와 관계에 대한 깊이 있는 고찰을 통해 현대 사회의 인간성을 재조명하는 작업을 수행한다. 
              개인과 집단, 자아와 타자 사이의 복잡한 관계망을 탐구하며 인간의 본질적 가치를 되묻는다.
            </p>
          </div>
          
          <div className="character-stats">
            <h3 className="character-section-title">특성</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label page-body-text-small">창조성</span>
                <div className="stat-bar">
                  <div className="stat-fill" style={{width: '85%'}}></div>
                </div>
              </div>
              <div className="stat-item">
                <span className="stat-label page-body-text-small">분석력</span>
                <div className="stat-bar">
                  <div className="stat-fill" style={{width: '90%'}}></div>
                </div>
              </div>
              <div className="stat-item">
                <span className="stat-label page-body-text-small">협업</span>
                <div className="stat-bar">
                  <div className="stat-fill" style={{width: '75%'}}></div>
                </div>
              </div>
              <div className="stat-item">
                <span className="stat-label page-body-text-small">혁신</span>
                <div className="stat-bar">
                  <div className="stat-fill" style={{width: '95%'}}></div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="character-abilities">
            <h3 className="character-section-title">핵심 능력</h3>
            <div className="abilities-list">
              <div className="ability-item">
                <span className="ability-name page-body-text">네트워크 분석</span>
                <span className="ability-description page-body-text-small">복잡한 인간 관계를 시각화하고 분석</span>
              </div>
              <div className="ability-item">
                <span className="ability-name page-body-text">감정 매핑</span>
                <span className="ability-description page-body-text-small">인간의 감정과 상호작용을 데이터로 변환</span>
              </div>
              <div className="ability-item">
                <span className="ability-name page-body-text">스토리텔링</span>
                <span className="ability-description page-body-text-small">개인의 서사를 예술 작품으로 재구성</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Human; 