import React from 'react';
import { motion } from 'framer-motion';

const CV: React.FC = () => {
  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">
          CV
          <motion.div 
            className="page-subtitle-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 1 }}
          ></motion.div>
          <div className="page-subtitle" style={{position: 'relative', top: 'auto', left: 'auto', transform: 'none', marginTop: '0'}}>활동 이력
            
          </div>
        </h1>
      </div>

      <div className="cv-content" style={{ 
        padding: '2rem',
        maxWidth: '1200px',
        margin: '0 auto',
        lineHeight: '1.6',
        fontSize: '0.95rem'
      }}>
        
        {/* 기본 정보 */}
        <section style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', borderBottom: '2px solid #333', paddingBottom: '0.5rem' }}>
            노드 트리(NODE TREE)
          </h2>
          <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>이화영, 정강현</p>
          <div style={{ marginBottom: '1rem' }}>
            <p>2012 한국예술종합학교 조형예술학과(전문사) 졸업(이화영)</p>
            <p>2013 한양대학교 작곡가 뉴미디어 음악작곡(석사) 수료(정강현)</p>
            <p>2016 노드 트리 결성</p>
            <p>2021-현재 대안예술공간 생산소, 주식회사 생산소 운영</p>
          </div>
        </section>

        {/* 개인전 */}
        <section style={{ marginBottom: '3rem' }}>
          <h3 style={{ fontSize: '1.3rem', marginBottom: '1.5rem', color: '#444' }}>개인전</h3>
          <div style={{ marginLeft: '1rem' }}>
            <p style={{ marginBottom: '0.5rem' }}>2024 위성악보시리즈:국경_신동엽문학관 기획전시실_부여</p>
            <p style={{ marginBottom: '0.5rem' }}>2021 위성악보시리즈 'KARMA'_부소갤러리_부여</p>
            <p style={{ marginBottom: '0.5rem' }}>2019 '캠퍼스의 낭만'_경기상상캠퍼스M3_수원</p>
            <p style={{ marginBottom: '0.5rem' }}>2019 '고속화도로 로망스'_경기상상캠퍼스M3 멀티벙커_수원</p>
            <p style={{ marginBottom: '0.5rem' }}>2016 'WHAT DO YOU SEE?' 개인전_문화공간지나_서울</p>
          </div>
        </section>

        {/* 전시/공연 */}
        <section style={{ marginBottom: '3rem' }}>
          <h3 style={{ fontSize: '1.3rem', marginBottom: '1.5rem', color: '#444' }}>전시/공연</h3>
          <div style={{ marginLeft: '1rem' }}>
            <p style={{ marginBottom: '0.5rem' }}>2025 땅끝: 서쪽으로 가는 길_CCN RESIDENCY_태안</p>
            <p style={{ marginBottom: '0.5rem' }}>2024 증식_팔복예술공장 A동 옥상_전주</p>
            <p style={{ marginBottom: '0.5rem' }}>2024 ERROR_CN갤러리_서울</p>
            <p style={{ marginBottom: '0.5rem' }}>2024 고도주민의 삶과기억전_부소갤러리</p>
            <p style={{ marginBottom: '0.5rem' }}>2023 금강아카이브 : 멀고도 가까운_무대륙(MU2)_문화체육관광부</p>
            <p style={{ marginBottom: '0.5rem' }}>2023 온라인예술활동 '위성악보시리즈 : 남미농장'_한국문화예술위원회</p>
            <p style={{ marginBottom: '0.5rem' }}>2023 아르코 공공예술사업 '이동성 없는 거주, 거주없는 이동성: 옵드라데크'_서울메트로미술관,인사동 코트 3층 노브</p>
            <p style={{ marginBottom: '0.5rem' }}>2022 아르코 공공예술사업 '욕망이 빠져나간 자리_출몰지'_한국문화예술위원회</p>
            <p style={{ marginBottom: '0.5rem' }}>2022 '땡볕, 초승달과 대추'_울산시립미술관_울산</p>
            <p style={{ marginBottom: '0.5rem' }}>2022 '복합돌봄장치'_울산현대미술제_울산</p>
            <p style={{ marginBottom: '0.5rem' }}>2022 '오드라데크 : 땡볕, 초승달과 대추 / 복합돌봄장치_아마도예술공간_서울</p>
            <p style={{ marginBottom: '0.5rem' }}>2020 온라인예술활동 '위성악보시리즈'_충남문화재단</p>
            <p style={{ marginBottom: '0.5rem' }}>2020 'N의 등장' 공연_부여</p>
            <p style={{ marginBottom: '0.5rem' }}>2020 '바람으로 흐르는 풍경' 공연_백제기와문화관_부여</p>
            <p style={{ marginBottom: '0.5rem' }}>2020 '숲속의 쉼표' 전시_부여</p>
            <p style={{ marginBottom: '0.5rem' }}>2020 ICMC(International Computer Music Conference) '소달구지' 전시_칠레</p>
            <p style={{ marginBottom: '0.5rem' }}>2020 '소달구지' 전시_재팬뉴미디어아츠페스티벌_일본</p>
            <p style={{ marginBottom: '0.5rem' }}>2019 '고속화도로 로망스' 공연_슬로우제이_용인</p>
            <p style={{ marginBottom: '0.5rem' }}>2018 '레트로 도시건설' 사운드스케이프 영상집 제작_온라인</p>
            <p style={{ marginBottom: '0.5rem' }}>2018 Nemaf(Seoul International Newmedia Festival) 'WHAT DO YOU SEE?' 전시_서울 서교예술실험소</p>
            <p style={{ marginBottom: '0.5rem' }}>2018 ICMC(International Computer Music Conference) 'WHAT DO YOU SEE?' 전시_대구 문화예술발전소</p>
            <p style={{ marginBottom: '0.5rem' }}>2017 자율진화도시 '메탈릭문'전시참여 _서울시립미술관</p>
            <p style={{ marginBottom: '0.5rem' }}>2017 서울문화재단 'WHITE RABBIT' 전시 및 공연_써드 플레이스</p>
            <p style={{ marginBottom: '0.5rem' }}>2017 사운드스케이프 '상도동 산64-56' 전시_서울시민청 소리갤러리</p>
            <p style={{ marginBottom: '0.5rem' }}>2017 광주아시아문화전당 '분실물보관소의 연설' 공연_아시아문화전당 예술극장</p>
          </div>
        </section>

        {/* 수상/선정/레지던시 */}
        <section style={{ marginBottom: '3rem' }}>
          <h3 style={{ fontSize: '1.3rem', marginBottom: '1.5rem', color: '#444' }}>수상/선정/레지던시</h3>
          <div style={{ marginLeft: '1rem' }}>
            <p style={{ marginBottom: '0.5rem' }}>2025 충남창작스튜디오 2기 입주작가</p>
            <p style={{ marginBottom: '0.5rem' }}>2025 충남시각예술지원사업 선정_충남문화관광재단</p>
            <p style={{ marginBottom: '0.5rem' }}>2024 충남시각예술지원사업 선정_충남문화관광재단</p>
            <p style={{ marginBottom: '0.5rem' }}>2023 온라인미디어 예술활동 지원사업 콘텐츠 창작 유형 선정_한국문화예술위원회</p>
            <p style={{ marginBottom: '0.5rem' }}>2022 대안예술공간 '생산소' 레지던시 운영</p>
            <p style={{ marginBottom: '0.5rem' }}>2021 카르마</p>
            <p style={{ marginBottom: '0.5rem' }}>2020 온라인미디어 예술활동 지원사업_충남문화관광재단</p>
            <p style={{ marginBottom: '0.5rem' }}>2020 Fundaction Flaquer_스페인</p>
            <p style={{ marginBottom: '0.5rem' }}>2019 융·복합 공연 공간 M3 멀티벙커 대관 선정 _경기문화재단</p>
            <p style={{ marginBottom: '0.5rem' }}>2019 경기상상캠퍼스 그루버 입주작가(M3)_경기문화재단</p>
            <p style={{ marginBottom: '0.5rem' }}>2018 제24회 무용예술상_포스트 젊은 예술가상</p>
            <p style={{ marginBottom: '0.5rem' }}>2017 젊은 예술가 인큐베이팅(공연) 레지던시_광주아시아문화전당_광주</p>
          </div>
        </section>

        {/* 예술교육/특강 */}
        <section style={{ marginBottom: '3rem' }}>
          <h3 style={{ fontSize: '1.3rem', marginBottom: '1.5rem', color: '#444' }}>예술교육/특강</h3>
          <div style={{ marginLeft: '1rem' }}>
            <p style={{ marginBottom: '0.5rem' }}>2025 역량강화특강 지역기반 문화예술교육의 가능성 '스며들기와 확장하기'_이화여자대학교 문화예술교육원</p>
            <p style={{ marginBottom: '0.5rem' }}>2025 롯데리조트 트레블러 액티비티 프로그램 '부여 풍경의 소리'</p>
            <p style={{ marginBottom: '0.5rem' }}>2025 청소년문화의집 방과후 아카데미 '디지털체험 사이보그-반려'프로그램</p>
            <p style={{ marginBottom: '0.5rem' }}>2024 청소년문화의집 방과후 아카데미 '생성형AI와함께하는 에코크리에이터'프로그램</p>
            <p style={{ marginBottom: '0.5rem' }}>2024 충남문화관광재단 유아문화예술교육(연구) &lt;소리=풍경&gt;</p>
            <p style={{ marginBottom: '0.5rem' }}>2024 충청남도부여교육지원청_상상마을교실_&lt;상상-집&gt; 프로그램 운영</p>
            <p style={{ marginBottom: '0.5rem' }}>2024 예술로 어울림 '미디어랩'_고흥꿈꾸는예술터</p>
            <p style={{ marginBottom: '0.5rem' }}>2021-현재 생산소_소리탐사조_지역리서치 기반 미디어 프로그램 어린이 연구소 운영</p>
            <p style={{ marginBottom: '0.5rem' }}>2023 공간(공항)기반 수요 맞춤형 문화예술교육 프로그램 '꿈의비행' 용역사 및 프로그램 진행</p>
            <p style={{ marginBottom: '0.5rem' }}>2023 아르떼 아카데미_경계없이 기획안 작성하기(챗GPT)</p>
            <p style={{ marginBottom: '0.5rem' }}>2023 아르떼 아카데미_AI는 어떻게 문화예술교육의 도구가 되는가</p>
            <p style={{ marginBottom: '0.5rem' }}>2023 문화가 있는 날 신문화권 발굴프로젝트금강워킹 '미래항해'_지역문화진흥원</p>
            <p style={{ marginBottom: '0.5rem' }}>2023 문화기획자 '로컬을 열다'창의적 역량 발견하기_용인시마을공동체지원센터</p>
            <p style={{ marginBottom: '0.5rem' }}>2022 문화다양성가치확산사업&lt;균형잡기&gt;_충남문화재단</p>
            <p style={{ marginBottom: '0.5rem' }}>2022 생활문화공동체사업&lt;생활예술가 마스터 되어보기&gt;_지역문화진흥원</p>
            <p style={{ marginBottom: '0.5rem' }}>2022 공예주간 기획프로그램 &lt;부여객사-로그온&gt;_한국공예디자인문화진흥원</p>
            <p style={{ marginBottom: '0.5rem' }}>2021 장애인비대면문화예술교육프로그램개발&lt;만날사람은만난다:그림판과 메모장&gt;_한국문화예술교육진흥원</p>
            <p style={{ marginBottom: '0.5rem' }}>2021 &lt;계절상품시리즈&gt;_생산소</p>
            <p style={{ marginBottom: '0.5rem' }}>2021 공예주간&lt;지금의생활도구&gt;_한국공예디자인문화진흥원</p>
            <p style={{ marginBottom: '0.5rem' }}>2021 관광두레&lt;날을 둥글리다&gt;_한국관광공사</p>
            <p style={{ marginBottom: '0.5rem' }}>2021 사운드-키-박스-프로젝트 &lt;여행의 행진곡&gt;_노드 트리</p>
            <p style={{ marginBottom: '0.5rem' }}>2021 충남부여시민대학_마을 매력찾기_마을기억지도만들기</p>
            <p style={{ marginBottom: '0.5rem' }}>2021 용인시마을공동체지원센터_마을지도만들기-기획단</p>
            <p style={{ marginBottom: '0.5rem' }}>2021 청년살이 in 부여_워크숍_미래도시, shopping mall_생산소</p>
            <p style={{ marginBottom: '0.5rem' }}>2020 문화예술교육 인력양성 연수사업 &lt;이어달리기의 시작점&gt;_제주문화예술재단</p>
            <p style={{ marginBottom: '0.5rem' }}>2020 미디어소통프로젝트 &lt;웃ㅎ.다&gt;_제주문화예술재단</p>
            <p style={{ marginBottom: '0.5rem' }}>2020 ITAC5 &lt;생산소:지금,우리가만드는소리&gt;_한국문화예술교육진흥원</p>
            <p style={{ marginBottom: '0.5rem' }}>2020 신나는 예술여행 &lt;노드트리_아르카이옵테리스&gt;_한국문화예술위원회</p>
            <p style={{ marginBottom: '0.5rem' }}>2019 신나는 예술여행 &lt;예술 생산 트럭&gt;_한국문화예술위원회</p>
            <p style={{ marginBottom: '0.5rem' }}>2019 문화예술교육 연구개발사업 &lt;이동하는 소리 스튜디오&gt;_충북문화재단</p>
            <p style={{ marginBottom: '0.5rem' }}>2019 마을 공동체 공간조성 사업 &lt;마을기록관 : 추억의 공간&gt;_용인시</p>
            <p style={{ marginBottom: '0.5rem' }}>2019 추계예술대학교 인터렉티브 미디어 특강</p>
            <p style={{ marginBottom: '0.5rem' }}>2019 소리가공소 스토리텔링 뉴미디어 프로그램</p>
            <p style={{ marginBottom: '0.5rem' }}>2019 충남문화재단 문화예술교육 우수사례 특강</p>
            <p style={{ marginBottom: '0.5rem' }}>2018 도농문화소통 프로젝트 &lt;고속화도로 로망스&gt;_경기문화재단</p>
            <p style={{ marginBottom: '0.5rem' }}>2018 세대소통 프로젝트&lt;레트로 도시건설&gt;_경기문화예술교육지원센터</p>
            <p style={{ marginBottom: '0.5rem' }}>2018 이화여자대학교 문화예술원 현장실습의 이해 특강</p>
            <p style={{ marginBottom: '0.5rem' }}>2014-2018 플라잉시티 어린이 연구소 '이룹빠' 미술 및 뉴미디어 예술교육 기획 및 운영</p>
          </div>
        </section>

        {/* 예술 포럼 */}
        <section style={{ marginBottom: '3rem' }}>
          <h3 style={{ fontSize: '1.3rem', marginBottom: '1.5rem', color: '#444' }}>예술 포럼</h3>
          <div style={{ marginLeft: '1rem' }}>
            <p style={{ marginBottom: '0.5rem' }}>2024 2024년 꿈다락 문화예술학교 워크숍 '나를 흔드는 000이 있는가?' 한국문화예술교육진흥원_발표</p>
            <p style={{ marginBottom: '0.5rem' }}>2024 2024 예술로어울림 포럼 '뉴미디어 아티스트의 문화예술교육, 연결의 가능성'_고흥문화도시센터 _발표</p>
            <p style={{ marginBottom: '0.5rem' }}>2024 자연과 사회, 마음이 함께하는 지역문화 생태계에 관하여_순천문화재단_발표</p>
            <p style={{ marginBottom: '0.5rem' }}>2024 제6회 예술놀이 전주 국제포럼 20024 '아트플레이어-플레이아트' 발표</p>
            <p style={{ marginBottom: '0.5rem' }}>2023 지속가능한 지역살이를 위한 생존전략_완주문화도시지원센터 발표</p>
            <p style={{ marginBottom: '0.5rem' }}>2023 블록파티 '대안예술공간 생산소_노드 트리'축구와, 배드민턴과, (대안)예술은'_아마도예술공간 발표</p>
            <p style={{ marginBottom: '0.5rem' }}>2022 생태예술의 본질 탐색을 통한 예술교육 방안의 모색 '포스트-시티_예술교육을 통해 동반자로 연결되기: 사람, 사물, 동물, 디지털 언어의 교집합_발표</p>
            <p style={{ marginBottom: '0.5rem' }}>2021 마포로컬리스트 컨퍼런스 '전환의 시작_정착이 예술의 재료가 된 과정 생산소의 생산' 발표</p>
          </div>
        </section>

        {/* 멘토링 */}
        <section style={{ marginBottom: '3rem' }}>
          <h3 style={{ fontSize: '1.3rem', marginBottom: '1.5rem', color: '#444' }}>멘토링</h3>
          <div style={{ marginLeft: '1rem' }}>
            <p style={{ marginBottom: '0.5rem' }}>2022 한국문화예술교육진흥원_문화예술교육사 프로그램 개발 공모전</p>
            <p style={{ marginBottom: '0.5rem' }}>2022 충남문화재단_예술교육팀</p>
            <p style={{ marginBottom: '0.5rem' }}>2021 동작문화재단_사당의하루-도시문화LAB IN GATE10</p>
            <p style={{ marginBottom: '0.5rem' }}>2020 한국콘텐츠진흥원_아이디어 융합팩토리-멘토링(텐저블아트)</p>
            <p style={{ marginBottom: '0.5rem' }}>2020 충북문화재단_헬로우아트랩-멘토링(안현지)</p>
            <p style={{ marginBottom: '0.5rem' }}>2019 시흥시 청년문화활성화-멘토스쿨(아트솔루스)</p>
            <p style={{ marginBottom: '0.5rem' }}>2019 아르떼슈필_문화예술교육프로그램 멘토링</p>
            <p style={{ marginBottom: '0.5rem' }}>2019 예비문화예술교육사 대상 문화예술교육개발 멘토링(해피노이즈)</p>
          </div>
        </section>

        {/* 지역활동 */}
        <section style={{ marginBottom: '3rem' }}>
          <h3 style={{ fontSize: '1.3rem', marginBottom: '1.5rem', color: '#444' }}>지역활동</h3>
          <div style={{ marginLeft: '1rem' }}>
            <p style={{ marginBottom: '0.5rem' }}>2025 (사)백제고도육성정책연구원 이사</p>
            <p style={{ marginBottom: '0.5rem' }}>2025 (사)임천보부상보존회 홍보이사</p>
          </div>
        </section>

      </div>
    </div>
  );
};

export default CV; 