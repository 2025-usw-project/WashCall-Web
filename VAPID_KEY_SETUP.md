# VAPID 공개키 설정 가이드

## 📋 VAPID 키란?

VAPID (Voluntary Application Server Identification)는 웹 푸시 알림을 위한 인증 표준입니다.
iOS PWA에서 FCM 푸시 알림을 받으려면 **반드시 VAPID 키를 설정**해야 합니다.

---

## 🔑 Firebase Console에서 VAPID 키 가져오기

### 1단계: Firebase Console 접속
```
https://console.firebase.google.com/
```

### 2단계: WashCall 프로젝트 선택
- 프로젝트 목록에서 **washcallproject** 클릭

### 3단계: 프로젝트 설정 열기
- 좌측 상단 **⚙️ 아이콘** 클릭
- **"프로젝트 설정"** 선택

### 4단계: Cloud Messaging 탭 이동
- 상단 탭에서 **"Cloud Messaging"** 클릭

### 5단계: 웹 푸시 인증서 섹션 찾기
- 아래로 스크롤하여 **"웹 푸시 인증서"** 섹션 찾기

### 6단계: 키 쌍 생성 또는 복사
#### 키가 없는 경우:
- **"키 쌍 생성"** 버튼 클릭
- 생성된 키 복사

#### 키가 이미 있는 경우:
- 표시된 키 값 복사 (BN으로 시작하는 긴 문자열)

**예시**:
```
BNdXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

---

## 📝 코드에 VAPID 키 적용

### 파일: `js/push.js`

**229번째 줄**을 찾아서 수정:

**수정 전**:
```javascript
const VAPID_PUBLIC_KEY = 'YOUR_VAPID_PUBLIC_KEY_HERE'; // ⚠️ 실제 VAPID 키로 교체 필요!
```

**수정 후**:
```javascript
const VAPID_PUBLIC_KEY = 'BNdXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'; // ✅ Firebase Console에서 복사한 실제 키
```

---

## ✅ 설정 완료 확인

### 브라우저 DevTools 콘솔 확인
1. 웹사이트 접속
2. 개발자 도구 (F12) → Console 탭
3. "알림 받기" 버튼 클릭
4. 콘솔에서 다음 메시지 확인:

**성공**:
```
✅ FCM 토큰 획득 (iOS PWA 지원): eABCDEFGHIJKLMNOP...
```

**실패 (VAPID 키 누락)**:
```
❌ Messaging: Please provide the VAPID key
```

---

## 🚨 주의사항

### 1. VAPID 키는 공개키입니다
- GitHub에 올려도 안전함 (서버 키가 아님)
- 클라이언트 JavaScript 코드에 포함 가능

### 2. 키 형식 확인
- `BN`으로 시작하는 87자 이상의 문자열
- Base64 URL-safe 인코딩

### 3. 키 변경 시
- 기존 사용자는 다시 토큰을 발급받아야 함
- 가능한 한 키 변경 지양

---

## 🔄 다음 단계

VAPID 키 설정 완료 후:
- ✅ **Phase 3**: iOS 홈 화면 추가 유도 UI 구현
- ✅ **Phase 4**: 서버 FCM WebpushConfig 추가
- ✅ **Phase 5**: iOS 기기에서 테스트

---

## 📞 문제 해결

### "Please provide the VAPID key" 오류
- `VAPID_PUBLIC_KEY` 값이 `'YOUR_VAPID_PUBLIC_KEY_HERE'`인지 확인
- Firebase Console에서 실제 키로 교체

### "Messaging: Registration token not available" 오류
- Service Worker 등록 확인
- iOS 16.4+ 버전 확인
- 홈 화면에 PWA 추가 확인 (iOS만 해당)

### iOS에서 토큰 발급 안 됨
- iOS 16.4 이상인지 확인
- Safari 브라우저가 아닌 **홈 화면 PWA**에서 실행
- 알림 권한 허용 확인
