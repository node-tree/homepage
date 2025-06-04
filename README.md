# 노드트리 홈페이지

React와 Node.js로 구축된 노드트리 회사 홈페이지입니다.

## 프로젝트 구조

```
nodetree-home/
├── src/           # React 프론트엔드
├── backend/       # Node.js + Express 백엔드
└── public/        # 정적 파일들
```

## 설치 및 실행 방법

### 1. 저장소 클론
```bash
git clone <repository-url>
cd nodetree-home
```

### 2. 전체 애플리케이션 실행
```bash
# 프론트엔드 의존성 설치
npm install

# 백엔드 의존성 설치
cd backend && npm install && cd ..

# 프론트엔드 + 백엔드 동시 실행 (추천)
npm start
```

### 3. 백엔드 설정
```bash
# 백엔드 디렉토리로 이동
cd backend

# 백엔드 의존성 설치
npm install

# 환경변수 파일 생성 (.env.example 참고)
cp .env.example .env

# .env 파일을 편집하여 실제 값으로 변경
vim .env  # 또는 다른 에디터 사용

# 백엔드 서버 실행 (포트 8000)
npm start
```

### 4. 환경변수 설정 (중요!)

**보안을 위해 실제 환경변수는 .env 파일에 저장하고 Git에 커밋하지 마세요.**

백엔드 디렉토리에 `.env` 파일을 생성하고 다음 내용을 추가하세요:

```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
PORT=8000
JWT_SECRET=강력한-비밀키-여기에-입력하세요
```

⚠️ **주의사항:**
- MongoDB 연결 문자열에는 실제 사용자명과 비밀번호를 입력하세요
- JWT_SECRET은 강력하고 예측하기 어려운 값으로 설정하세요
- .env 파일은 절대로 Git에 커밋하지 마세요 (이미 .gitignore에 추가됨)

### 5. 개별 실행 (선택사항)
```bash
# 프론트엔드만 실행 (DB 연결 안됨)
npm run frontend

# 백엔드만 실행 (API 서버만)
npm run server
```

### 6. 빠른 시작 가이드
```bash
# 1단계: 저장소 클론
git clone <repository-url>
cd nodetree-home

# 2단계: 의존성 설치
npm install
cd backend && npm install && cd ..

# 3단계: 환경변수 설정
cd backend && cp .env.example .env
# .env 파일을 편집하여 실제 값 입력

# 4단계: 실행
npm start
```

## 기술 스택

**프론트엔드:**
- React 19.1.0
- TypeScript
- Framer Motion

**백엔드:**
- Node.js
- Express
- MongoDB (Mongoose)
- JWT 인증

## 주요 기능

- 회사 소개 페이지
- 프로젝트 포트폴리오 (Work)
- 기록 관리 (Filed)
- 위치 정보 (인터랙티브 지도)
- 관리자 인증 시스템

## 개발 모드

- 프론트엔드: http://localhost:3000
- 백엔드 API: http://localhost:8000

## 빌드

```bash
npm run build
```

프로덕션용 빌드 파일이 `build/` 폴더에 생성됩니다.

## 보안 가이드

1. **환경변수 관리**: 모든 민감한 정보는 `.env` 파일에 저장
2. **Git 보안**: `.env` 파일은 절대 Git에 커밋하지 말 것
3. **프로덕션 배포**: 프로덕션 환경에서는 더욱 강력한 JWT_SECRET 사용
4. **MongoDB**: 데이터베이스 접근 권한을 최소화하고 IP 화이트리스트 설정
