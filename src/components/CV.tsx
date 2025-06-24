import React, { useState } from 'react';
import { motion } from 'framer-motion';

const initialCV = `노드 트리(NODE TREE)\n이화영, 정강현\n2012 한국예술종합학교 조형예술학과(전문사) 졸업(이화영)\n2013 한양대학교 작곡가 뉴미디어 음악작곡(석사) 수료(정강현)\n2016 노드 트리 결성\n2021-현재 대안예술공간 생산소, 주식회사 생산소 운영\n\n[개인전]\n2024 위성악보시리즈:국경_신동엽문학관 기획전시실_부여\n2021 위성악보시리즈 'KARMA'_부소갤러리_부여\n2019 '캠퍼스의 낭만'_경기상상캠퍼스M3_수원\n2019 '고속화도로 로망스'_경기상상캠퍼스M3 멀티벙커_수원\n2016 'WHAT DO YOU SEE?' 개인전_문화공간지나_서울\n\n[전시/공연]\n2025 땅끝: 서쪽으로 가는 길_CCN RESIDENCY_태안\n2024 증식_팔복예술공장 A동 옥상_전주\n2024 ERROR_CN갤러리_서울\n2024 고도주민의 삶과기억전_부소갤러리\n2023 금강아카이브 : 멀고도 가까운_무대륙(MU2)_문화체육관광부\n2023 온라인예술활동 '위성악보시리즈 : 남미농장'_한국문화예술위원회\n2023 아르코 공공예술사업 '이동성 없는 거주, 거주없는 이동성: 옵드라데크'_서울메트로미술관,인사동 코트 3층 노브\n2022 아르코 공공예술사업 '욕망이 빠져나간 자리_출몰지'_한국문화예술위원회\n2022 '땡볕, 초승달과 대추'_울산시립미술관_울산\n2022 '복합돌봄장치'_울산현대미술제_울산\n2022 '오드라데크 : 땡볕, 초승달과 대추 / 복합돌봄장치_아마도예술공간_서울\n2020 온라인예술활동 '위성악보시리즈'_충남문화재단\n2020 'N의 등장' 공연_부여\n2020 '바람으로 흐르는 풍경' 공연_백제기와문화관_부여\n2020 '숲속의 쉼표' 전시_부여\n2020 ICMC(International Computer Music Conference) '소달구지' 전시_칠레\n2020 '소달구지' 전시_재팬뉴미디어아츠페스티벌_일본\n2019 '고속화도로 로망스' 공연_슬로우제이_용인\n2018 '레트로 도시건설' 사운드스케이프 영상집 제작_온라인\n2018 Nemaf(Seoul International Newmedia Festival) 'WHAT DO YOU SEE?' 전시_서울 서교예술실험소\n2018 ICMC(International Computer Music Conference) 'WHAT DO YOU SEE?' 전시_대구 문화예술발전소\n2017 자율진화도시 '메탈릭문'전시참여 _서울시립미술관\n2017 서울문화재단 'WHITE RABBIT' 전시 및 공연_써드 플레이스\n2017 사운드스케이프 '상도동 산64-56' 전시_서울시민청 소리갤러리\n2017 광주아시아문화전당 '분실물보관소의 연설' 공연_아시아문화전당 예술극장\n\n[수상/선정/레지던시]\n2025 충남창작스튜디오 2기 입주작가\n2025 충남시각예술지원사업 선정_충남문화관광재단\n2024 충남시각예술지원사업 선정_충남문화관광재단\n2023 온라인미디어 예술활동 지원사업 콘텐츠 창작 유형 선정_한국문화예술위원회\n2022 대안예술공간 '생산소' 레지던시 운영\n2021 카르마\n2020 온라인미디어 예술활동 지원사업_충남문화관광재단\n2020 Fundaction Flaquer_스페인\n2019 융·복합 공연 공간 M3 멀티벙커 대관 선정 _경기문화재단\n2019 경기상상캠퍼스 그루버 입주작가(M3)_경기문화재단\n2018 제24회 무용예술상_포스트 젊은 예술가상\n2017 젊은 예술가 인큐베이팅(공연) 레지던시_광주아시아문화전당_광주\n\n[예술교육/특강]\n2025 역량강화특강 지역기반 문화예술교육의 가능성 '스며들기와 확장하기'_이화여자대학교 문화예술교육원\n2025 롯데리조트 트레블러 액티비티 프로그램 '부여 풍경의 소리'\n2025 청소년문화의집 방과후 아카데미 '디지털체험 사이보그-반려'프로그램\n2024 청소년문화의집 방과후 아카데미 '생성형AI와함께하는 에코크리에이터'프로그램\n2024 충남문화관광재단 유아문화예술교육(연구) <소리=풍경>\n2024 충청남도부여교육지원청_상상마을교실_<상상-집> 프로그램 운영\n2024 예술로 어울림 '미디어랩'_고흥꿈꾸는예술터\n2021-현재 생산소_소리탐사조_지역리서치 기반 미디어 프로그램 어린이 연구소 운영\n2023 공간(공항)기반 수요 맞춤형 문화예술교육 프로그램 '꿈의비행' 용역사 및 프로그램 진행\n2023 아르떼 아카데미_경계없이 기획안 작성하기(챗GPT)\n2023 아르떼 아카데미_AI는 어떻게 문화예술교육의 도구가 되는가\n2023 문화가 있는 날 신문화권 발굴프로젝트금강워킹 '미래항해'_지역문화진흥원\n2023 문화기획자 '로컬을 열다'창의적 역량 발견하기_용인시마을공동체지원센터\n2022 문화다양성가치확산사업<균형잡기>_충남문화재단\n2022 생활문화공동체사업<생활예술가 마스터 되어보기>_지역문화진흥원\n2022 공예주간 기획프로그램 <부여객사-로그온>_한국공예디자인문화진흥원\n2021 장애인비대면문화예술교육프로그램개발<만날사람은만난다:그림판과 메모장>_한국문화예술교육진흥원\n2021 <계절상품시리즈>_생산소\n2021 공예주간<지금의생활도구>_한국공예디자인문화진흥원\n2021 관광두레<날을 둥글리다>_한국관광공사\n2021 사운드-키-박스-프로젝트 <여행의 행진곡>_노드 트리\n2021 충남부여시민대학_마을 매력찾기_마을기억지도만들기\n2021 용인시마을공동체지원센터_마을지도만들기-기획단\n2021 청년살이 in 부여_워크숍_미래도시, shopping mall_생산소\n2020 문화예술교육 인력양성 연수사업 <이어달리기의 시작점>_제주문화예술재단\n2020 미디어소통프로젝트 <웃ㅎ.다>_제주문화예술재단\n2020 ITAC5 <생산소:지금,우리가만드는소리>_한국문화예술교육진흥원\n2020 신나는 예술여행 <노드트리_아르카이옵테리스>_한국문화예술위원회\n2019 신나는 예술여행 <예술 생산 트럭>_한국문화예술위원회\n2019 문화예술교육 연구개발사업 <이동하는 소리 스튜디오>_충북문화재단\n2019 마을 공동체 공간조성 사업 <마을기록관 : 추억의 공간>_용인시\n2019 추계예술대학교 인터렉티브 미디어 특강\n2019 소리가공소 스토리텔링 뉴미디어 프로그램\n2019 충남문화재단 문화예술교육 우수사례 특강\n2018 도농문화소통 프로젝트 <고속화도로 로망스>_경기문화재단\n2018 세대소통 프로젝트<레트로 도시건설>_경기문화예술교육지원센터\n2018 이화여자대학교 문화예술원 현장실습의 이해 특강\n2014-2018 플라잉시티 어린이 연구소 '이룹빠' 미술 및 뉴미디어 예술교육 기획 및 운영\n\n[예술 포럼]\n2024 2024년 꿈다락 문화예술학교 워크숍 '나를 흔드는 000이 있는가?' 한국문화예술교육진흥원_발표\n2024 2024 예술로어울림 포럼 '뉴미디어 아티스트의 문화예술교육, 연결의 가능성'_고흥문화도시센터 _발표\n2024 자연과 사회, 마음이 함께하는 지역문화 생태계에 관하여_순천문화재단_발표\n2024 제6회 예술놀이 전주 국제포럼 20024 '아트플레이어-플레이아트' 발표\n2023 지속가능한 지역살이를 위한 생존전략_완주문화도시지원센터 발표\n2023 블록파티 '대안예술공간 생산소_노드 트리'축구와, 배드민턴과, (대안)예술은'_아마도예술공간 발표\n2022 생태예술의 본질 탐색을 통한 예술교육 방안의 모색 '포스트-시티_예술교육을 통해 동반자로 연결되기: 사람, 사물, 동물, 디지털 언어의 교집합_발표\n2021 마포로컬리스트 컨퍼런스 '전환의 시작_정착이 예술의 재료가 된 과정 생산소의 생산' 발표\n\n[멘토링]\n2022 한국문화예술교육진흥원_문화예술교육사 프로그램 개발 공모전\n2022 충남문화재단_예술교육팀\n2021 동작문화재단_사당의하루-도시문화LAB IN GATE10\n2020 한국콘텐츠진흥원_아이디어 융합팩토리-멘토링(텐저블아트)\n2020 충북문화재단_헬로우아트랩-멘토링(안현지)\n2019 시흥시 청년문화활성화-멘토스쿨(아트솔루스)\n2019 아르떼슈필_문화예술교육프로그램 멘토링\n2019 예비문화예술교육사 대상 문화예술교육개발 멘토링(해피노이즈)\n\n[지역활동]\n2025 (사)백제고도육성정책연구원 이사\n2025 (사)임천보부상보존회 홍보이사`;

const CV: React.FC = () => {
  const [cvText, setCvText] = useState(initialCV);
  const [isEditing, setIsEditing] = useState(false);
  const [align, setAlign] = useState<'left' | 'center' | 'right'>('left');

  const handleSave = () => {
    setIsEditing(false);
  };

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

      <div className="work-header">
        <button
          className="write-button"
          onClick={() => setIsEditing(!isEditing)}
        >
          {isEditing ? '취소' : '글 편집'}
        </button>
        {isEditing && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: '#f7f7f7', borderRadius: '18px', padding: '4px 12px', marginLeft: '1rem' }}>
            <button
              onClick={() => setAlign('left')}
              style={{
                background: align === 'left' ? '#222' : '#fff',
                color: align === 'left' ? '#fff' : '#222',
                border: 'none',
                borderRadius: '16px',
                padding: '6px 16px',
                fontWeight: 600,
                fontSize: '0.98rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >좌</button>
            <button
              onClick={() => setAlign('center')}
              style={{
                background: align === 'center' ? '#222' : '#fff',
                color: align === 'center' ? '#fff' : '#222',
                border: 'none',
                borderRadius: '16px',
                padding: '6px 16px',
                fontWeight: 600,
                fontSize: '0.98rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >중앙</button>
            <button
              onClick={() => setAlign('right')}
              style={{
                background: align === 'right' ? '#222' : '#fff',
                color: align === 'right' ? '#fff' : '#222',
                border: 'none',
                borderRadius: '16px',
                padding: '6px 16px',
                fontWeight: 600,
                fontSize: '0.98rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >우</button>
            <button
              onClick={handleSave}
              style={{
                padding: '6px 18px',
                fontSize: '1rem',
                borderRadius: '18px',
                border: '1px solid #007bff',
                background: 'transparent',
                color: '#007bff',
                fontWeight: 600,
                marginLeft: '8px',
                cursor: 'pointer',
                transition: 'background 0.2s, color 0.2s',
              }}
              onMouseOver={e => { e.currentTarget.style.background = '#007bff'; e.currentTarget.style.color = '#fff'; }}
              onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#007bff'; }}
            >저장</button>
          </div>
        )}
      </div>

      <div className="cv-content" style={{ 
        padding: '2.5rem 2rem',
        maxWidth: '900px',
        margin: '0 auto',
        lineHeight: '1.7',
        fontSize: '1.05rem',
        textAlign: align,
        minHeight: '400px',
      }}>
        {isEditing ? (
          <textarea
            value={cvText}
            onChange={e => setCvText(e.target.value)}
            style={{
              width: '100%',
              height: '600px',
              fontSize: '1.05rem',
              lineHeight: '1.7',
              fontFamily: 'inherit',
              resize: 'vertical',
              borderRadius: '12px',
              border: '1.5px solid #bbb',
              padding: '1.2rem',
              background: '#fafbfc',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              outline: 'none',
              transition: 'border 0.2s',
            }}
            onFocus={e => e.currentTarget.style.border = '1.5px solid #007bff'}
            onBlur={e => e.currentTarget.style.border = '1.5px solid #bbb'}
          />
        ) : (
          <CVModernContent text={cvText} align={align} />
        )}
      </div>
    </div>
  );
};

interface CVModernContentProps {
  text: string;
  align: 'left' | 'center' | 'right';
}

const CVModernContent: React.FC<CVModernContentProps> = ({ text, align }) => {
  // 줄 단위로 파싱 및 스타일링
  const lines = text.split('\n');
  return (
    <div style={{ width: '100%', textAlign: align }}>
      {lines.map((line, idx) => {
        // '노드 트리(NODE TREE)' 또는 '이화영, 정강현'이 포함된 줄
        if (/노드 트리\(NODE TREE\)/.test(line) || /이화영, 정강현/.test(line)) {
          return <div key={idx} style={{ fontWeight: 700, fontSize: '1.08rem', margin: '0.2rem 0' }}>{line}</div>;
        }
        // [제목] 스타일
        if (/^\[.*\]$/.test(line.trim())) {
          return <div key={idx} style={{ fontSize: '1.25rem', fontWeight: 700, margin: '2.2rem 0 1.1rem 0', letterSpacing: '0.01em', borderBottom: '2px solid #eee', paddingBottom: '0.2em' }}>{line.replace(/[\[\]]/g, '')}</div>;
        }
        // 연도(4자리)로 시작하는 줄
        if (/^20\d{2}|19\d{2}/.test(line.trim())) {
          return <div key={idx} style={{ fontWeight: 400, color: '#444', fontSize: '1.08rem', margin: '0.2rem 0 0.2rem 0' }}>{line}</div>;
        }
        // 소제목(콜론 포함)
        if (/^[^\[]+:.+/.test(line.trim())) {
          return <div key={idx} style={{ fontWeight: 500, fontSize: '1.08rem', margin: '1.1rem 0 0.3rem 0' }}>{line}</div>;
        }
        // 리스트( - 또는 * )
        if (/^[-*]\s+/.test(line.trim())) {
          return (
            <div key={idx} style={{ marginLeft: '1.2em', fontSize: '1.03rem', marginBottom: '0.1em', color: '#222', display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9em', marginRight: '0.7em', lineHeight: 1 }}>●</span>
              {line.replace(/^[-*]\s+/, '')}
            </div>
          );
        }
        // 구분선
        if (/^[-=]{5,}$/.test(line.trim())) {
          return <hr key={idx} style={{ border: 'none', borderTop: '1.5px dashed #bbb', margin: '1.5em 0' }} />;
        }
        // 빈 줄
        if (line.trim() === '') {
          return <div key={idx} style={{ height: '0.7em' }} />;
        }
        // 기본 텍스트
        return <div key={idx} style={{ fontSize: '1.04rem', margin: '0.1em 0' }}>{line}</div>;
      })}
    </div>
  );
};

export default CV; 