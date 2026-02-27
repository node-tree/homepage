/**
 * 생산소 DB Seed 스크립트
 * 실행: node backend/scripts/seedSaengsanso.js
 * 기존 sso_* 컬렉션을 모두 초기화하고 새 데이터로 채운다.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { SaengsansoProject, SaengsansoNews, SaengsansoArchive } = require('../models/Saengsanso');

const PROJECTS = [
  // ── EXHIBITION (전시) ──
  { category: 'EXHIBITION', date: '2024.09.06-22.', title: '고도 주민의 삶과 기억전', detail: '2024 고도주민활동지원사업. 백제역사문화연구원 위탁. 부여 청소년 문화의집.', sortOrder: 1 },
  { category: 'EXHIBITION', date: '2023.07.', title: '백제기와문화관 세계국가유산산업전 부스 기획 및 설치', detail: '충청남도 부여군 사적관리소 위탁. 세계국가유산산업전(경주) 부여 백제기와 홍보 부스.', sortOrder: 2 },
  { category: 'EXHIBITION', date: '2021.10.', title: '공예주간 조각수집', detail: '2021 공예주간. 대장장이 체험(산소절단기/용접), 용기화분 만들기, 목공예·도자·보태니컬아트 전시, 살구에이드.', sortOrder: 3 },

  // ── SOUNDSCAPE ──
  { category: 'SOUNDSCAPE', date: '2024.11.10.', title: '사운드 오케스트라 in 부여', detail: '신동엽문학관 → 임천면 성흥산 → 대조사. 모듈러신스로 참여자와 소리 만들기. 관광두레 파일럿 프로그램.', sortOrder: 12 },
  { category: 'SOUNDSCAPE', date: '2021-2023', title: '도시기록프로젝트 소리탐사조', detail: '서울 기반 도시 사운드 리서치', sortOrder: 13 },

  // ── COLLABORATION ──
  { category: 'COLLABORATION', date: '2025.08-11.', title: '비단가람온길 레저코스 탄소중립 여행 활성화', detail: '서부내륙권 관광진흥사업. 백제역사문화연구원 위탁. 금강 인접 지자체(부여·세종·공주·논산·익산) 자전거여행+탄소중립 체험. 미션플로깅투어·친환경 여행지 꾸러미·금강 재순환 미술 체험.', sortOrder: 19 },
  { category: 'COLLABORATION', date: '2025.09.20.', title: '비단가람 무브먼트 에코-플로깅', detail: '큐클리프(CUECLYP) × 인디언모터사이클 × 생산소 협업 — 백마강, 부여. 폐현수막·재활용 원단으로 사코슈백 제작. 무소음 DJing 프로그램 운영. 비단가람온길 탄소중립 사업의 일환.', sortOrder: 20 },
  { category: 'COLLABORATION', date: '2022.05.', title: '예방구 오픈 기념 뿡뿡파티', detail: '예방구(예술방앗간구룡) 오픈 기념 DJ파티. 생산소 × 예방구 협업.', sortOrder: 21 },

  // ── RESIDENCY ──
  { category: 'RESIDENCY', date: '2021', title: '민간레지던시 프로젝트', detail: '히스테리안(강정아) 기획 — 대안적 거주와 공간 리서치', sortOrder: 30 },

  // ── WORKSHOP & COMMUNITY ──
  { category: 'WORKSHOP & COMMUNITY', date: '2025.03.01.', title: '2025 삼일절 임천면', detail: '임천면 만세장터·임천보부상·장놀이패·부여웅비태권도·부여군여성농민회. 토종씨앗·연대·농민의 삶.', sortOrder: 42 },
  { category: 'WORKSHOP & COMMUNITY', date: '2025.01.', title: '이야기 자리와 기록', detail: "꿈다락 문화예술학교 워크숍 '나를 흔드는 ○○○이 있는가?' 기록집 발간. 아르떼 라이브러리 수록.", sortOrder: 43 },
  { category: 'WORKSHOP & COMMUNITY', date: '2024.12.', title: '부여청년-마스터 크리스마스', detail: '부여 5년 커뮤니티 모임. 솥뚜껑삼겹살 저녁, 시낭송, 디제잉 파티, 키네틱공연. #지원사업아님', sortOrder: 44 },
  { category: 'WORKSHOP & COMMUNITY', date: '2024.08.', title: '어반아트 네비게이터 — 하자센터', detail: '소리+움직임 워크숍. AI 시대 사람과 공간을 소리·움직임으로 해석. 어린이 대상.', sortOrder: 46 },
  { category: 'WORKSHOP & COMMUNITY', date: '2024.08.', title: '도시 읽기: 고흥', detail: '지역 기획자 초대로 고흥군 방문. 예술로 어울리기.', sortOrder: 47 },
  { category: 'WORKSHOP & COMMUNITY', date: '2024.', title: '꿈다락 문화예술학교 워크숍', detail: "'나를 흔드는 ○○○이 있는가?' — 아르떼 라이브러리 기록집 발간", sortOrder: 48 },
  { category: 'WORKSHOP & COMMUNITY', date: '2023.09.', title: '공간(공항) 기반 수요 맞춤형 문화예술교육 프로그램 개발', detail: '한국문화예술교육진흥원 위탁. 공간 기반 문화예술교육 콘텐츠 기획·개발.', sortOrder: 49 },
  { category: 'WORKSHOP & COMMUNITY', date: '2023.06.16.', title: '《블록파티》 전시공간 토크', detail: '아마도예술공간, 서울 — "축구와, 배드민턴과, (대안)예술은"', sortOrder: 51 },
  { category: 'WORKSHOP & COMMUNITY', date: '2023.04.21-23.', title: '부여세도유채꽃방울토마토축제 프로그램 운영', detail: '충청남도 부여군 세도면 위탁. 15ha 금강 하천부지 유채꽃밭. 두레풍장·산유화가·불꽃놀이·디제잉 레이저쇼. 코로나 이후 첫 재개최.', sortOrder: 52 },
  { category: 'WORKSHOP & COMMUNITY', date: '2023.', title: '문화가있는날 금강워킹', detail: '서울, 부여, 강경, 서천 — 지역문화진흥원', sortOrder: 53 },

  // ── 2022 ──
  { category: 'WORKSHOP & COMMUNITY', date: '2022.05.', title: 'DJ입문 클래스 — 플러그인 생산소', detail: '20대부터 60대 함께하는 DJ입문과정. 총 4회 프로그램. 관광두레.', sortOrder: 54 },
  { category: 'WORKSHOP & COMMUNITY', date: '2022.05.29.', title: '부여객사 로그온: 나는 너를 방울방울해', detail: '2022 공예주간 기획프로그램. 부여 방울토마토 영감 공연, 금속/한지공예 전시, 사운드 VR 체험. 민들레합주단·부여군민DJ팀·한국전통문화대 락밴드 커밍아웃 참여.', sortOrder: 55 },
  { category: 'WORKSHOP & COMMUNITY', date: '2022.05.', title: '일상색채수집보관함', detail: '세계문화예술교육주간 프로그램. 일상의 색채를 수집하고 보관하는 워크숍.', sortOrder: 56 },
  { category: 'WORKSHOP & COMMUNITY', date: '2022.05.', title: '정답은 없다', detail: '생활문화공동체지원사업. 지역 주민과 함께하는 문화예술 프로그램.', sortOrder: 57 },
  { category: 'WORKSHOP & COMMUNITY', date: '2022.05.', title: '우당탕탕운동회', detail: '세도꿈꾸는마을학교. 어린이·지역주민 참여 운동회 프로그램.', sortOrder: 58 },
  { category: 'WORKSHOP & COMMUNITY', date: '2022.04.', title: 'Cafeteria Brisa 계절다방', detail: '이동형 가판 프로젝트. 계절에 따라 마을을 순회하는 커피·문화 가판대.', sortOrder: 59 },
  { category: 'WORKSHOP & COMMUNITY', date: '2022.02.14.', title: '계절상품시리즈: 비밀결사대', detail: '정월대보름 세시풍속 재해석. 쥐불놀이·연 날리기·공룡알 평화포스터 제작. 몽사모(이몽학을 사랑하는 사람들의 모임) × 평통사 공동 주최.', sortOrder: 60 },
  { category: 'WORKSHOP & COMMUNITY', date: '2022.01.29.', title: '호랑이배 연 날리기 대회', detail: '설날 정월 행사. 부여 지역 주민과 함께하는 전통 연 날리기.', sortOrder: 61 },

  // ── 2021 ──
  { category: 'WORKSHOP & COMMUNITY', date: '2021.12.', title: '계절상품시리즈: 미리 만나는 크리스마스', detail: '연말 커뮤니티 축제. 계절상품시리즈 12월편.', sortOrder: 62 },
  { category: 'WORKSHOP & COMMUNITY', date: '2021.11.', title: '충남문화재단 × 버밀라 아카데미 — 날아오르다', detail: '생산소 × 버밀라 아카데미 협업 프로그램. 충남문화재단 지원.', sortOrder: 63 },
  { category: 'WORKSHOP & COMMUNITY', date: '2021.10.', title: '핼러윈 호박줄기 축제', detail: '생산소 핼러윈 파티. 호박줄기, 덩굴 프로그램.', sortOrder: 65 },
  { category: 'WORKSHOP & COMMUNITY', date: '2021.09.', title: '부여아트페어: 지금의 생활도구', detail: '생산소품 브랜드 런칭. 호미 디자인, 낭만히힛 조각수집전, 각도의 진심 서각 프로그램.', sortOrder: 66 },
  { category: 'WORKSHOP & COMMUNITY', date: '2021.09.', title: '옥수수파티', detail: '홍우주사회적협동조합 × 생산소. 단편선·전유동·오소리웍스·옥수수학교 참여. 부여아트페어 연계.', sortOrder: 67 },
  { category: 'WORKSHOP & COMMUNITY', date: '2021.08.', title: '웨하스영화제', detail: '고란독서회 연계. 프리다(Frida) 상영. 아날로그 포스기 제작 체험.', sortOrder: 68 },
  { category: 'WORKSHOP & COMMUNITY', date: '2021.08.', title: '이몽학 위령제', detail: '구룡면. 부여에서 술 담그고 위령제를 진행. 여러 세대가 함께 하나의 행사 준비.', sortOrder: 69 },
  { category: 'WORKSHOP & COMMUNITY', date: '2021.08.', title: '술-술-술 酒-術-述', detail: '술빚기 프로그램. 이야기와 웃음이 흘러나오는 지역 술 문화 체험.', sortOrder: 70 },
  { category: 'WORKSHOP & COMMUNITY', date: '2021.03-09.', title: '쓸데없는 대장간', detail: '1974년 생산소 공간을 대장간으로 재탄생. 청년 대장장이 프로젝트. 충남문화재단 지원. 오픈식 상영회·공연 진행.', sortOrder: 71 },
  { category: 'WORKSHOP & COMMUNITY', date: '2021.02.', title: '사운드키박스 프로젝트', detail: '동네 탐험 기록, 가사/멜로디 음악 제작. 소리 기반 지역 탐사 프로그램.', sortOrder: 72 },
  { category: 'WORKSHOP & COMMUNITY', date: '2021.', title: '만날 사람은 만난다', detail: '비대면 장애인 문화예술교육 콘텐츠 개발. 한국문화예술교육진흥원(아르떼). 발달장애 특화 콘텐츠 <일상색채수집보관함 — 그림판과 메모장>.', sortOrder: 73 },

];

const NEWS = [
  // ── press ──
  { date: '2025.08', title: '부여군, 비단가람온길 레저코스 사업 운영…11월까지', source: '에이티엔뉴스', category: 'press', url: 'https://www.atnnews.co.kr/news/articleView.html?idxno=90320', sortOrder: 8 },
  { date: '2025.08', title: '부여군 비단가람온길 레저코스 사업 11월까지 운영', source: '굿모닝충청', category: 'press', url: 'https://www.goodmorningcc.com/news/articleView.html?idxno=406473', sortOrder: 9 },
  { date: '2025.09.20', title: '비단가람 무브먼트 에코-플로깅 — 큐클리프 × 생산소 협업, 백마강 부여', source: '큐클리프', category: 'press', url: 'https://www.cueclyp.com/collaboration', sortOrder: 10 },
  { date: '2024.11.10', title: '사운드 오케스트라 in 부여 — 신동엽문학관·대조사. 관광두레 생산소 파일럿', source: '관광두레', category: 'press', url: '', sortOrder: 11 },
  { date: '2024.09.06-22', title: '고도 주민의 삶과 기억전 — 2024 고도주민활동지원사업, 백제역사문화연구원 × 생산소 기획', source: '백제역사문화연구원', category: 'press', url: '', sortOrder: 12 },
  { date: '2023.09', title: '공간(공항) 기반 수요 맞춤형 문화예술교육 프로그램 개발 — 한국문화예술교육진흥원 위탁', source: '한국문화예술교육진흥원', category: 'press', url: '', sortOrder: 12.5 },
  { date: '2023.07', title: '백제기와문화관 세계국가유산산업전 부스 기획 및 설치 — 부여군 사적관리소 위탁', source: '세계국가유산산업전', category: 'press', url: 'https://heritage-korea.com/', sortOrder: 12.7 },
  { date: '2023.06', title: '《블록파티》 전시공간 토크 — 대안예술공간 운영자 대담', source: '아마도예술공간', category: 'press', url: '', sortOrder: 13 },
  { date: '2023.04', title: '2023 부여세도 방울토마토&유채꽃 축제 프로그램 운영', source: '데일리투데이', category: 'press', url: 'http://www.dtoday.co.kr/news/articleView.html?idxno=593416', sortOrder: 13.5 },
  { date: '2023.04', title: '부여세도 방울토마토&유채꽃 축제 개최', source: '충청데일리', category: 'press', url: 'https://www.ccdailynews.com/news/articleView.html?idxno=2336781', sortOrder: 13.7 },
  { date: '2023', title: '금강아카이브: 멀고도 가까운 — 지역 문화 기록 프로젝트', source: '지역문화진흥원', category: 'press', url: '', sortOrder: 14 },
  { date: '2023', title: '문화가있는날 금강워킹 — 서울, 부여, 강경, 서천', source: '지역문화진흥원', category: 'press', url: '', sortOrder: 15 },
  { date: '2022.05', title: '즐거움이 방울방울 피어나는 부여객사로 — 부여객사 로그온, 공예주간', source: '충남일보', category: 'press', url: 'https://www.ccdn.co.kr/news/articleView.html?idxno=761279', sortOrder: 15.3 },
  { date: '2021', title: '만날 사람은 만난다 — 비대면 장애인 문화예술교육 콘텐츠 개발', source: '아르떼 라이브러리', category: 'press', url: 'https://lib.arte.or.kr/educationdata/board/ArchiveData_BoardView.do?board_id=BRD_ID0056902', sortOrder: 15.7 },
  { date: '2021', title: '히스테리안 — 민간레지던시 프로젝트 리서치', source: '히스테리안', category: 'press', url: '', sortOrder: 16 },

  // ── press (네이버 검색 추가 2026.02) ──
  { date: '2025.09.04', title: '공간공감/ 마을과 예술을 잇는 장암면 \'생산소\'', source: '동양일보', category: 'press', url: 'http://www.dynews.co.kr/news/articleView.html?idxno=818979', sortOrder: 10.3 },
  { date: '2025.08.17', title: '광복 80주년, 부여 청소년과 지역이 함께 빚은 예술의 울림', source: '동양일보', category: 'press', url: 'http://www.dynews.co.kr/news/articleView.html?idxno=816047', sortOrder: 8.5 },
  { date: '2025.08', title: '부여 비단가람온길 레저코스로 떠나는 특별한 라이딩', source: '로컬투데이', category: 'press', url: 'https://www.localtoday.co.kr/news/articleView.html?idxno=313260', sortOrder: 8.7 },
  { date: '2025.08', title: '부여군, 비단가람온길 레저코스 사업 시행', source: '중도일보', category: 'press', url: 'https://m.joongdo.co.kr/view.php?key=20241014010003245', sortOrder: 8.8 },
  { date: '2024.11.11', title: '지역소멸 대응 사례로 충남 부여 생산소 분석 — 한국예술연구소 학술세미나', source: '교수신문', category: 'press', url: 'http://www.kyosu.net/news/articleView.html?idxno=127224', sortOrder: 11.1 },
  { date: '2023.11.01', title: '부여군, 공예문화 축제 \'123사비공예페스타\' 개최 — 생산소 공방 참여', source: '파이낸스투데이', category: 'press', url: 'http://www.fntoday.co.kr/news/articleView.html?idxno=305416', sortOrder: 12.2 },
  { date: '2023.07.31', title: '클릭 이사람/ 끊임없이 3의 삶터를 찾아 부여를 들쑤시는 사람들', source: '동양일보', category: 'press', url: 'http://www.dynews.co.kr/news/articleView.html?idxno=714952', sortOrder: 12.75 },
  { date: '2023.06.22', title: '4개 지역 예술단체가 참여하는 문화행사 \'금강워킹\'', source: '중도일보', category: 'press', url: 'http://www.joongdo.co.kr/web/view.php?key=20230622010006228', sortOrder: 13.1 },
  { date: '2023.05.30', title: '청소년 위해 부여군, 예술단체와 뭉쳤다 — 금강워킹_미래항해', source: '충청투데이', category: 'press', url: 'https://www.cctoday.co.kr/news/articleView.html?idxno=2178711', sortOrder: 13.2 },
  { date: '2023.02.13', title: '클릭 이사람/ 지역의 역사·문화자원의 가치를 발굴하는 \'현대 예술가\' 이화영', source: '동양일보', category: 'press', url: 'http://www.dynews.co.kr/news/articleView.html?idxno=692107', sortOrder: 15.05 },
  { date: '2022.12.19', title: '덜어내고 더해가며 호응하는, 예술-이웃 — 대안예술공간 생산소', source: '아르떼365', category: 'press', url: 'https://arte365.kr/?p=97117', sortOrder: 15.25 },
  { date: '2022.11.14', title: '부여 생태문화 탐방 \'합류지 프로젝트\' 성료', source: '충청일보', category: 'press', url: 'https://www.ccdailynews.com/news/articleView.html?idxno=2167066', sortOrder: 15.27 },
  { date: '2022.09.28', title: '부여군 예술가·전문가·주민 모여 미래도시 상상한다', source: '아주경제', category: 'press', url: 'https://www.ajunews.com/view/20220928120034950', sortOrder: 15.29 },
  { date: '2022.05.19', title: '부여 방울토마토 맛보며 인디 뮤지션 공연 즐겨볼까', source: '금강일보', category: 'press', url: 'http://www.ggilbo.com/news/articleView.html?idxno=913349', sortOrder: 15.31 },
  { date: '2022.03.03', title: '클릭이사람/ 대안예술공간 \'생산소\' 운영자 김정기', source: '동양일보', category: 'press', url: 'http://www.dynews.co.kr/news/articleView.html?idxno=651885', sortOrder: 15.35 },
  { date: '2021.12.01', title: '부여 청년들 일 냈다…\'부여안다\' 출판·전시회 — 생산소 갤러리', source: '굿모닝충청', category: 'press', url: 'http://www.goodmorningcc.com/news/articleView.html?idxno=260973', sortOrder: 15.5 },
  { date: '2021.08.11', title: '충남문화재단, 김영민 작가 개인전 — 예술공간 생산소', source: '대전일보', category: 'press', url: 'https://www.daejonilbo.com/news/articleView.html?idxno=1483669', sortOrder: 15.65 },

  // ── notice ──
  { date: '2026.02', title: '생산소 홈페이지 오픈', source: '생산소', category: 'notice', url: '', sortOrder: 20 },
  { date: '2025.08', title: '비단가람온길 레저코스 탄소중립 여행 활성화 사업 시작', source: '생산소', category: 'notice', url: '', sortOrder: 20.5 },
  { date: '2025.09', title: '비단가람 무브먼트 에코-플로깅 진행', source: '생산소', category: 'notice', url: '', sortOrder: 21 },
  { date: '2024.11', title: '사운드 오케스트라 부여 프로그램 운영', source: '생산소', category: 'notice', url: '', sortOrder: 22 },
  { date: '2024.09', title: '고도 주민의 삶과 기억전 개최', source: '생산소', category: 'notice', url: '', sortOrder: 23 },
  { date: '2024', title: '생산소 부여 공간 운영 안내', source: '생산소', category: 'notice', url: '', sortOrder: 24 },
  { date: '2023.09', title: '공간 기반 문화예술교육 프로그램 개발 (한국문화예술교육진흥원)', source: '생산소', category: 'notice', url: '', sortOrder: 24.5 },
  { date: '2023.07', title: '세계국가유산산업전 백제기와문화관 부스 기획·설치', source: '생산소', category: 'notice', url: '', sortOrder: 24.7 },
  { date: '2023.04', title: '부여세도 방울토마토&유채꽃 축제 프로그램 운영', source: '생산소', category: 'notice', url: '', sortOrder: 24.9 },
];

const ARCHIVES = [
  { title: '', year: '', bg: '', image: '', video: 'https://nodetree.cafe24.com/mcwjd/%BB%FD%BB%EA%BC%D2/%C6%F7%BD%BA%C5%CD/talkv_high_4.gif', sortOrder: 1 },
  { title: '', year: '', bg: '', image: 'https://nodetree.cafe24.com/mcwjd/%BB%FD%BB%EA%BC%D2/%C6%F7%BD%BA%C5%CD/IMG_2091.PNG', video: '', sortOrder: 2 },
  { title: '', year: '', bg: '', image: '', video: 'https://nodetree.cafe24.com/mcwjd/%BB%FD%BB%EA%BC%D2/%C6%F7%BD%BA%C5%CD/talkv_output8.gif', sortOrder: 3 },
  { title: '', year: '', bg: '', image: 'https://nodetree.cafe24.com/mcwjd/%BB%FD%BB%EA%BC%D2/%C6%F7%BD%BA%C5%CD/IMG_5605.PNG', video: '', sortOrder: 4 },
  { title: '', year: '', bg: '', image: 'https://nodetree.cafe24.com/mcwjd/%BB%FD%BB%EA%BC%D2/%C6%F7%BD%BA%C5%CD/IMG_9909.PNG', video: '', sortOrder: 5 },
  { title: '', year: '', bg: '', image: 'https://nodetree.cafe24.com/mcwjd/%BB%FD%BB%EA%BC%D2/%C6%F7%BD%BA%C5%CD/IMG_9109.PNG', video: '', sortOrder: 6 },
  { title: '', year: '', bg: 'linear-gradient(135deg, #2a1a1a, #3a2a1a)', image: '', video: 'https://nodetree.cafe24.com/mcwjd/%BB%FD%BB%EA%BC%D2/%C6%F7%BD%BA%C5%CD/talkv_high.gif', sortOrder: 7 },
  { title: '', year: '', bg: '', image: '', video: 'https://nodetree.cafe24.com/mcwjd/%BB%FD%BB%EA%BC%D2/%C6%F7%BD%BA%C5%CD/talkv_output4.gif', sortOrder: 8 },
  { title: '', year: '', bg: '', image: '', video: 'https://nodetree.cafe24.com/mcwjd/%BB%FD%BB%EA%BC%D2/%C6%F7%BD%BA%C5%CD/talkv_output2.gif', sortOrder: 9 },
  { title: '', year: '', bg: '', image: '', video: 'https://nodetree.cafe24.com/mcwjd/%BB%FD%BB%EA%BC%D2/%C6%F7%BD%BA%C5%CD/talkv_output3.gif', sortOrder: 10 },
  { title: '', year: '', bg: '', image: '', video: 'https://nodetree.cafe24.com/mcwjd/%BB%FD%BB%EA%BC%D2/%C6%F7%BD%BA%C5%CD/talkv_output.gif', sortOrder: 11 },
  { title: '', year: '', bg: '', image: 'https://nodetree.cafe24.com/mcwjd/%BB%FD%BB%EA%BC%D2/%C6%F7%BD%BA%C5%CD/IMG_6472.PNG', video: '', sortOrder: 12 },
  { title: '', year: '', bg: '', image: '', video: 'https://nodetree.cafe24.com/mcwjd/%BB%FD%BB%EA%BC%D2/%C6%F7%BD%BA%C5%CD/talkv_high_2.gif', sortOrder: 13 },
  { title: '', year: '', bg: 'linear-gradient(135deg, #2a1a20, #3a2a30)', image: '', video: 'https://nodetree.cafe24.com/mcwjd/%BB%FD%BB%EA%BC%D2/%C6%F7%BD%BA%C5%CD/talkv_high_3.gif', sortOrder: 14 },
  { title: '', year: '', bg: '', image: 'https://nodetree.cafe24.com/mcwjd/%BB%FD%BB%EA%BC%D2/%C6%F7%BD%BA%C5%CD/IMG_5748.PNG', video: '', sortOrder: 15 },
  { title: '', year: '', bg: '', image: '', video: 'https://nodetree.cafe24.com/mcwjd/%BB%FD%BB%EA%BC%D2/%C6%F7%BD%BA%C5%CD/IMG_5219_output.gif', sortOrder: 16 },
  { title: '', year: '', bg: '', image: '', video: 'https://nodetree.cafe24.com/mcwjd/%BB%FD%BB%EA%BC%D2/%C6%F7%BD%BA%C5%CD/video.gif', sortOrder: 17 },
  { title: '', year: '', bg: '', image: '', video: 'https://nodetree.cafe24.com/mcwjd/%BB%FD%BB%EA%BC%D2/%C6%F7%BD%BA%C5%CD/video_1_911f6389_output.gif', sortOrder: 18 },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ MongoDB 연결 성공');

  // 기존 데이터 삭제
  await Promise.all([
    SaengsansoProject.deleteMany({}),
    SaengsansoNews.deleteMany({}),
    SaengsansoArchive.deleteMany({}),
  ]);
  console.log('🗑️  기존 sso_* 데이터 삭제 완료');

  // 새 데이터 삽입
  const [projects, news, archives] = await Promise.all([
    SaengsansoProject.insertMany(PROJECTS),
    SaengsansoNews.insertMany(NEWS),
    SaengsansoArchive.insertMany(ARCHIVES),
  ]);

  console.log(`📦 프로젝트 ${projects.length}개 저장`);
  console.log(`📰 뉴스 ${news.length}개 저장`);
  console.log(`🗂️  아카이브 ${archives.length}개 저장`);
  console.log('✅ Seed 완료');

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('❌ Seed 실패:', err.message);
  process.exit(1);
});
