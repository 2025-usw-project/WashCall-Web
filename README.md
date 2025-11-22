# 🫧 WashCall 웹 앱 - 디자인 시스템 v2.0

> 대학 기숙사 세탁기/건조기 실시간 모니터링 & 푸시 알림 서비스
> **Glassmorphism + Tailwind CSS 디자인 시스템 완전 적용**세탁실 알림 서비스

대학 기숙사의 세탁기/건조기를 실시간으로 모니터링하고 푸시 알림을 제공하는 Progressive Web App입니다.

## 🚀 디자인 시스템 v2.0 (2025)

### 설치 및 빌드

#### 1. 의존성 설치
```bash
npm install
```

#### 2. 개발 모드 (CSS 자동 빌드)
```bash
npm run dev
```

#### 3. 프로덕션 빌드
```bash
npm run build
```

#### 4. 로컬 미리보기
```bash
npm run preview
```
http://localhost:8080 에서 확인 가능

---

## 📁 프로젝트 구조

```
WashCall-Web/
├── index.html                # 메인 페이지
├── login.html                # 로그인 페이지
├── congestion.html           # 혼잡도 분석
├── survey.html               # 설문조사
│
├── css/
│   ├── input.css             # Tailwind 입력 파일
│   ├── output.css            # 빌드 결과 (자동 생성)
│   ├── variables.css         # CSS Variables
│   ├── fonts.css             # 폰트 설정
│   ├── base.css              # 기본 스타일
│   ├── components.css        # 컴포넌트 스타일
│   ├── animations.css        # 애니메이션
│   └── utilities.css         # 유틸리티 클래스
│
├── js/
│   ├── theme.js              # 다크모드 토글 (신규)
│   ├── main.js               # 메인 로직
│   ├── server-api.js         # API 통신
│   ├── push.js               # FCM 푸시 알림
│   └── auth.js               # 인증
│
├── tailwind.config.js        # Tailwind 설정
├── postcss.config.js         # PostCSS 설정
└── package.json              # 의존성 관리
```

---

## 🎨 디자인 시스템

### 색상 팔레트
- **Primary**: 보라-파랑 그라디언트 (#8b5cf6 → #7c3aed)
- **Accent**: 핑크-빨강 그라디언트 (#ec4899 → #db2777)
- **Status Colors**: 
  - Idle (대기): #94a3b8
  - Washing (세탁): #3b82f6
  - Spinning (탈수): #f59e0b
  - Finished (완료): #10b981

### 타이포그래피
- **Font**: Pretendard Variable (한글/영문 모두 지원)
- **Scale**: Perfect Fourth (1.333 비율)

### 간격 시스템
- 8pt Grid 기반 (4px, 8px, 12px, 16px, 24px, 32px, ...)

### 그림자
- sm, base, md, lg, xl, 2xl
- Glassmorphism용 glass shadow
- 상태별 glow shadow

---

## 🧩 주요 컴포넌트 클래스

### 버튼
```html
<!-- Primary 버튼 (그라디언트) -->
<button class="btn btn-primary">세탁 시작</button>

<!-- Secondary 버튼 -->
<button class="btn btn-secondary">취소</button>

<!-- Ghost 버튼 (투명) -->
<button class="btn btn-ghost">더보기</button>
```

### 카드
```html
<!-- 일반 카드 -->
<div class="card">
  <h3>제목</h3>
  <p>내용</p>
</div>

<!-- Glassmorphism 카드 -->
<div class="card glass-card">
  <h3>유리 효과</h3>
</div>
```

### 배지
```html
<span class="badge badge-washing">세탁 중</span>
<span class="badge badge-finished">완료</span>
```

### 입력 필드
```html
<input type="text" class="input" placeholder="입력하세요">
```

### 프로그레스 바
```html
<div class="progress-bar">
  <div class="progress-bar-fill" style="width: 60%"></div>
</div>
```

---

## 🌙 다크모드

### 자동 전환
- 시스템 설정 자동 감지
- localStorage에 사용자 선택 저장

### 수동 전환
```html
<!-- HTML -->
<input type="checkbox" id="theme-checkbox" />

<!-- JavaScript -->
<script src="js/theme.js"></script>
```

### CSS에서 다크모드 스타일
```css
/* 라이트 모드 */
.element {
  background: var(--bg-primary);
  color: var(--text-primary);
}

/* 다크 모드는 자동으로 CSS Variables 변경됨 */
```

---

## 🎬 애니메이션

### 기본 애니메이션 클래스
```html
<div class="animate-fade-in">페이드 인</div>
<div class="animate-slide-up">슬라이드 업</div>
<div class="animate-shake">흔들림 (탈수 중)</div>
<div class="animate-float">부유 효과</div>
```

### 순차 등장 (Stagger)
```html
<div class="animate-slide-up stagger-1">첫 번째</div>
<div class="animate-slide-up stagger-2">두 번째</div>
<div class="animate-slide-up stagger-3">세 번째</div>
```

---

## 🛠️ Tailwind 유틸리티 사용 예시

### 레이아웃
```html
<div class="container mx-auto px-4">
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    <div class="card">카드 1</div>
    <div class="card">카드 2</div>
    <div class="card">카드 3</div>
  </div>
</div>
```

### 반응형
```html
<!-- 모바일: 세로 배치, 데스크톱: 가로 배치 -->
<div class="flex flex-col md:flex-row gap-4">
  <div>첫 번째</div>
  <div>두 번째</div>
</div>
```

### 다크모드
```html
<!-- 라이트/다크 모드 각각 다른 스타일 -->
<div class="bg-white dark:bg-gray-900 text-black dark:text-white">
  내용
</div>
```

---

## 📱 반응형 브레이크포인트

| Prefix | 최소 너비 | 용도 |
|--------|----------|------|
| `sm:` | 640px | 큰 폰 |
| `md:` | 768px | 태블릿 |
| `lg:` | 1024px | 노트북 |
| `xl:` | 1280px | 데스크톱 |

---

## 🔧 개발 팁

### CSS 변경 사항 자동 반영
```bash
npm run dev
```
위 명령어를 실행하면 CSS 파일이 변경될 때마다 자동으로 재빌드됩니다.

### 빌드 최적화
프로덕션 빌드 시 사용하지 않는 Tailwind 클래스는 자동으로 제거됩니다 (PurgeCSS).

### 커스텀 유틸리티 추가
`css/utilities.css`에 추가하면 됩니다.

---

## 📚 참고 자료

- [Tailwind CSS 문서](https://tailwindcss.com/docs)
- [Pretendard 폰트](https://github.com/orioncactus/pretendard)
- [CSS Variables MDN](https://developer.mozilla.org/ko/docs/Web/CSS/Using_CSS_custom_properties)

---

## 📝 TODO (Phase 2 이후)

- [ ] 네비게이션 바 리디자인 (Floating Nav)
- [ ] 세탁기 카드 Glassmorphism 적용
- [ ] 모달/Bottom Sheet 컴포넌트
- [ ] 토스트 알림 시스템
- [ ] 스켈레톤 로딩
- [ ] 아이콘 시스템 (Lucide Icons)

---

## 📄 License

MIT License
