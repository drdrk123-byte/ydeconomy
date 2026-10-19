# 우리반 이코노미 · Class Economy OS

초등학교 5–6학년을 위한 학급 경제 운영 웹앱. Next.js App Router, TypeScript, Firebase Authentication / Firestore, Recharts, Lucide 기반입니다. 가상화폐만 사용하며 실제 증권 주문 API는 호출하지 않습니다.

## 빠르게 실행

Node.js 22 이상을 사용합니다.

```bash
npm ci
npm run dev
```

`http://localhost:3000`에서 바로 **데모 모드**를 체험할 수 있습니다. 교사/가상 학생을 전환해 월급 → 저축 → 상점 구매 → 예산 투표 → 모의투자 → 성찰을 실행할 수 있습니다. 데모는 브라우저에만 저장되며 실제 계정 인증이나 공동 데이터베이스가 아닙니다. 실제 학생 정보를 데모에 입력하지 마세요.

## 구현 범위

- 반응형 교사·학생 대시보드, 모바일 하단 메뉴
- 신뢰된 교사 권한과 학생 계정 일괄 생성, 초기 비밀번호 변경
- 주급·기본소득·소득세, 보너스, 주간 저축 이자
- 목표 저축, 교사가 허용한 송금(1회 한도·하루 3회)
- 원장 기록과 보너스·저축·이자의 역분개
- 직업 지원·교사 배정, 재고·개인 한도가 있는 상점
- 공공예산 제안·찬성 투표·과반수 찬성 후 집행
- 국내 주식 가상 매수·매도, 해외 종목 시세 조회
- 토스 실제 시세 어댑터, 중앙 토큰 캐시·발급 잠금, 429 재시도
- 경제 뉴스 링크, 10개 수업 템플릿, 비공개 경제 일기와 피드백
- 자산 분포·평균·중앙값·참여 현황, 거래 CSV 내보내기
- 15초마다 실제 학급 상태 갱신, 서버 트랜잭션, 멱등키, 금융 정보 직접 쓰기 차단

다음 고급 기능은 **아직 구현하지 않았습니다**: 학생 기업·경매, 누진세·소비세·자산세, 단리/복리 비교 실험, 주가 기간별 차트, 해외 주식 환율 적용 거래, 정책 시행 전후 추적·로렌츠 곡선·지니계수, 예약 실행 UI, 학년도 전환·백업 복원, Excel/PDF 보고서. UI에서 동작하는 것처럼 표시하지 않습니다. 주급과 이자는 교사의 확인 후 실행하는 방식입니다. 현재 원장 CSV는 최신 200건 내보내기입니다. 전체 기간 백업은 Firestore 관리형 내보내기를 사용하세요.

## 실제 학급으로 연결

### 1. Firebase 프로젝트 준비

기존 Firebase 프로젝트의 **Cloud Firestore 네이티브 모드/에디션과 위치를 먼저 확인**하고 사용하세요. 이 저장소는 프로젝트·유료 서비스를 자동 생성하지 않습니다. Firebase Console에서 Authentication의 이메일/비밀번호를 활성화하세요. Google 로그인을 사용하려면 Google 공급자도 활성화하고 지원 이메일을 설정하세요.

`.env.example`을 `.env.local`로 복사하고 실제 프로젝트 값을 입력합니다. `NEXT_PUBLIC_FIREBASE_*`는 웹앱 설정입니다. `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`는 서비스 계정의 비공개 서버 변수입니다. 절대 `NEXT_PUBLIC_`를 붙이거나 Git에 올리지 마세요. 서비스 계정에는 필요한 Auth 사용자 관리·Firestore 권한만 부여하세요.

```bash
npx firebase-tools login
npx firebase-tools use YOUR_PROJECT_ID
npx firebase-tools deploy --only firestore:rules,firestore:indexes
```

Firebase Console → Authentication → Settings → Authorized domains에 `localhost`와 Vercel 도메인(프로토콜·포트 제외)을 추가하세요. 이 앱은 브라우저에서 Firestore에 직접 접근하지 않으므로 규칙은 모두 거부합니다. 모든 데이터 접근은 인증된 서버 API를 통합니다.

### 2. 교사 및 학급 등록

Firebase Authentication에서 교사 이메일 계정을 먼저 생성하거나, 앱에서 교사가 Google로 한 번 로그인해 Auth 사용자를 생성합니다. 공개 회원가입만으로 교사 권한을 얻지 못합니다.

프로젝트 관리자가 신뢰할 수 있는 로컬 환경에서 실행합니다.

```bash
npm run bootstrap -- yongdap-5-2 teacher@example.com
```

동일한 학급이 있으면 덮어쓰지 않습니다. 교사는 로그아웃 후 다시 로그인하세요. 여러 학급은 서로 다른 학급 코드와 교사 계정으로 등록합니다. 현재는 교사 한 계정당 한 학급입니다.

### 3. 학생 발급

교사 로그인 → **우리 반 학생 → 학생 추가**에서 별명을 한 줄에 하나씩 입력합니다. 35명까지 생성할 수 있습니다. 생성 직후 계정표를 내려받아 학생에게 개별 전달하세요. 비밀번호는 암호학적 난수로 생성되며 DB나 원장에 저장하지 않습니다. 학생은 **학급 코드 + 학생 아이디 + 초기 비밀번호**로 로그인하고 12자 이상의 새 비밀번호를 만듭니다. 최초 변경 후 재로그인이 필요합니다.

비밀번호 분실은 현재 Firebase Console에서 관리자가 재설정합니다. 앱 내 교사 비밀번호 재발급 UI는 후속 작업입니다. `.invalid` 가상 이메일이므로 이메일 재설정 메일 발송에 의존하면 안 됩니다.

## Vercel 배포

1. Vercel에서 `drdrk123-byte/ydeconomy` 저장소를 Import합니다.
2. Framework Preset **Next.js**, Root Directory 기본값, Build Command `npm run build`를 사용합니다.
3. 실제 학급을 사용할 환경(Production/Preview)에 Firebase 환경변수를 각각 등록합니다.
4. 배포 후 해당 도메인을 Firebase Authentication의 Authorized domains에 추가합니다.
5. 환경변수 변경 후 재배포하고 교사·학생 계정으로 확인합니다.

변수 없이도 데모는 빌드·배포됩니다. 실제 API는 인증 정보 없이 데이터를 제공하거나 변경하지 않습니다. Vercel 계정 연결과 Firebase 권한 설정은 Git 커밋·푸시만으로 이루어지지 않습니다.

## 토스증권 실제 시세 연결

확인한 공식 스키마: OpenAPI **1.2.24**, 확인일 **2026-10-19**.

- 가이드: https://developers.tossinvest.com/
- 스키마: https://openapi.tossinvest.com/openapi-docs/latest/openapi.json
- 사용 API: `POST /oauth2/token`, `GET /api/v1/prices`, `GET /api/v1/stocks`, `GET /api/v1/market-calendar/KR`
- 실주문·증권계좌·조건 주문 API는 사용하지 않습니다.

`MARKET_DATA_ENABLED=false`가 기본입니다. API 사용 권한, 학급 학생에게 시세를 표시하는 권리·재배포 조건, 캐싱 허용 범위, 호출 허용 IP를 **토스 측에 확인한 뒤** 서버 변수 `TOSS_CLIENT_ID`, `TOSS_CLIENT_SECRET`를 등록하고 활성화하세요. API 자격증명을 채팅이나 GitHub에 붙여넣지 마세요.

토큰은 Firestore `serverSecrets/toss`에 중앙 저장하며 브라우저에서 읽을 수 없습니다. 발급 중복은 트랜잭션 잠금으로 제어합니다. 새 토큰 발급 시 기존 토큰이 무효화되므로 이 앱과 같은 클라이언트 자격증명을 별도 프로그램에서 공유하지 마세요. 시세는 `serverCache/quotes`에 15초 캐시합니다.

토큰 발급은 허용 IP가 필요합니다. 일반 Vercel 배포에서 임의로 고정 IP를 가정하지 않습니다. 허용된 고정 출발지 IP를 확보한 환경에서 실행하거나, 고정 IP를 갖는 별도 서버에 시세 어댑터를 배치해야 합니다. 후자의 경우 어댑터 분리 배포와 내부 API 인증을 추가 구현해야 합니다. 현재 저장소는 동일 Next.js 서버에서 직접 호출합니다.

실제 시세 기반 모의거래는 국내 정규장·종목 ACTIVE·KRX 거래정지 아님을 서버에서 확인합니다. 시세 기준시각이 60초를 넘거나 공급자·휴장 정보 조회에 실패하면 신규 거래를 차단합니다. 실제 연결 장애 시 데모 가격으로 자동 체결하지 않습니다. 원화 종목만 모의거래할 수 있고, 해외 주식은 조회 전용입니다. 1주당 가상 가격을 올림하고 그 가격에 수량을 곱해 분할 주문의 반올림 차익을 막습니다.

## 데이터 및 보안 구조

- `classes/{classId}/private/economy`: 학급 상태. 35명 규모의 거래를 한 문서의 Firestore 트랜잭션으로 직렬화합니다.
- `classes/{classId}/ledger/{transactionId}`: 삭제·수정 대신 보정 거래를 추가하는 원장
- `classes/{classId}/operations/{hash}`: 사용자·요청 번호 기반 중복 방지와 감사 정보
- `classes/{classId}/reversals/{originalId}`: 역분개 중복 차단
- `serverSecrets/toss`, `serverCache/quotes`: 서버 전용 인증·시세 캐시

Firebase ID 토큰과 서버에 등록된 `role`, `classId` Custom Claims를 검사합니다. 학생 응답에는 자신의 계좌·거래·일기만 포함합니다. 친구 송금을 위해 최소한의 학급 별명·아이디 목록을 제공합니다. 개별 자산을 공개하지 않습니다. 모든 변경은 Zod 검증과 서버 권한 검사 후 처리합니다. 원장·보정·상태·중복방지 기록을 같은 DB 트랜잭션으로 저장합니다.

학급 상태 문서의 Firestore 1 MiB 한도를 고려해 일기 200건, 뉴스 100건, 제안 100건을 상한으로 둡니다. 장기 운영 전에는 이들 데이터를 개별 하위 컬렉션으로 분리하는 마이그레이션이 필요합니다. 35명이 동시에 같은 문서를 변경하는 부하 테스트는 미실시이며, 서비스 규모 확장 시 계좌별 문서로 분리해야 합니다.

개인정보는 별명 등 최소한만 수집하세요. 보유 기간·처리 목적·학교의 동의 절차를 정한 뒤 실제 학생 계정을 만드세요. 이 저장소만으로 학교의 관련 절차가 완료되지는 않습니다.

## 검증

```bash
npm run test
npm run typecheck
npm run build
```

테스트는 월급 중복·세금·잔액·재고·교사 권한·학생 데이터 격리·송금 한도·역분개·가상주식·시세 만료·반올림 차익·한국 시간 지급 주기를 검증합니다. 실제 Firebase·토스 자격증명이 없으면 해당 외부 서비스 연결 검증은 수행할 수 없습니다. 배포 후에는 별도의 시험 학급에서 교사와 학생 계정 2개로 권한·거래·동시 구매를 확인하세요.
