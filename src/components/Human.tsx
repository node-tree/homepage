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
          
          <div className="character-abilities">
            
          </div>
        </div>
      </div>
    </div>
  );
};

export default Human; 