// service-worker.js (파일 전체 덮어쓰기)

// 1. Firebase 스크립트 임포트
importScripts("https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js");
importScripts("https://www.gstatic.com/firebasejs/8.10.0/firebase-messaging.js");

// 2. ❗️ Firebase 설정 (push.js와 동일한 값 입력)
 const firebaseConfig = {
    apiKey: "AIzaSyAiL4dY0dkiYIsXdQDByULXZB2HJLxssvM",
    authDomain: "washcall-server.firebaseapp.com",
    projectId: "washcall-server",
    storageBucket: "washcall-server.firebasestorage.app",
    messagingSenderId: "695727341464",
    appId: "1:695727341464:web:56a51f41431c27c56fb5ed",
    measurementId: "G-SL6R08TWHP"
  };
firebase.initializeApp(firebaseConfig);

// 3. 메시징 인스턴스
const messaging = firebase.messaging();

// 4. 백그라운드에서 푸시 처리
// (manager.py가 'notification' 객체를 포함하여 전송)
messaging.onBackgroundMessage((payload) => {
    console.log('[service-worker.js] 백그라운드 메시지 수신:', payload);
    
    // manager.py가 보낸 'notification' 객체를 사용
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: 'images/icon.png' // (아이콘 경로는 맞게 수정)
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// 5. 알림 클릭 시 동작 (기존 코드 유지)
self.addEventListener('notificationclick', event => {
  event.notification.close(); // 알림 닫기
  
  // (예시) 알림을 클릭하면 메인 페이지(index.html)로 이동
  event.waitUntil(
    clients.openWindow('index.html')
  );
});