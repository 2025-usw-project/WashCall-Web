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

// 4. 백그라운드에서 푸시 처리 (서버가 'notification' 객체를 포함하여 전송)
messaging.onBackgroundMessage((payload) => {
    console.log('[service-worker.js] 백그라운드 메시지 수신:', payload);
    
    try {
        const notificationTitle = payload.notification?.title || "세탁 알림";
        const notificationBody = payload.notification?.body || "세탁 상태가 변경되었습니다.";
        
        // data 필드에서 추가 정보 추출
        const machineId = payload.data?.machine_id || null;
        const roomId = payload.data?.room_id || null;
        const notificationType = payload.data?.type || "general";
        
        const notificationOptions = {
            body: notificationBody,
            icon: 'favicon.png', // 아이콘
            badge: 'favicon.png', // 작은 뱃지 아이콘
            vibrate: [200, 100, 200], // 진동 패턴
            tag: `wash-${machineId || 'general'}`, // 중복 알림 방지
            requireInteraction: true, // 사용자가 직접 닫을 때까지 유지
            data: {
                machine_id: machineId,
                room_id: roomId,
                type: notificationType,
                url: 'index.html' // 클릭 시 이동할 URL
            },
            actions: [
                {
                    action: 'view',
                    title: '확인하기'
                },
                {
                    action: 'close',
                    title: '닫기'
                }
            ]
        };
        
        console.log('[service-worker.js] 알림 표시:', notificationTitle, notificationOptions);
        self.registration.showNotification(notificationTitle, notificationOptions);
        
    } catch (error) {
        console.error('[service-worker.js] 백그라운드 메시지 처리 오류:', error);
    }
});

// 5. 알림 클릭 시 동작 (특정 세탁기로 스크롤)
self.addEventListener('notificationclick', event => {
    console.log('[service-worker.js] 알림 클릭됨:', event.notification.tag);
    
    event.notification.close(); // 알림 닫기
    
    // 액션 버튼 처리
    if (event.action === 'close') {
        // 닫기 버튼 클릭 시 아무 동작 안 함
        return;
    }
    
    // 알림 데이터에서 정보 추출
    const notificationData = event.notification.data || {};
    const machineId = notificationData.machine_id;
    const targetUrl = notificationData.url || 'index.html';
    
    // 해시를 포함한 URL 생성 (특정 세탁기로 스크롤)
    const urlWithHash = machineId ? `${targetUrl}#machine-${machineId}` : targetUrl;
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(clientList => {
                // 이미 열려있는 창이 있으면 포커스
                for (let i = 0; i < clientList.length; i++) {
                    const client = clientList[i];
                    if (client.url.includes(targetUrl) && 'focus' in client) {
                        // 해시를 변경하여 특정 세탁기로 스크롤
                        if (machineId) {
                            client.postMessage({
                                type: 'SCROLL_TO_MACHINE',
                                machine_id: machineId
                            });
                        }
                        return client.focus();
                    }
                }
                
                // 열려있는 창이 없으면 새 창 열기
                if (clients.openWindow) {
                    return clients.openWindow(urlWithHash);
                }
            })
    );
});