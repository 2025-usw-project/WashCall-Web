// service-worker.js
// (프로젝트 최상위 폴더, index.html과 같은 위치에 있어야 함)

console.log('서비스 워커 로드됨.');

// 1. (나중에 할 일) 서버로부터 푸시 알림이 도착했을 때
self.addEventListener('push', event => {
  console.log('[Service Worker] 푸시 알림 수신:', event.data.text());

  const data = event.data.json(); // 서버가 보낸 JSON 데이터 (예: {title: "빨래 끝!", ...})
  const title = data.title;
  const options = {
    body: data.body,
    icon: 'images/icon.png' // (알림 아이콘 경로 - 나중에 추가)
  };

  // 알림을 화면에 띄웁니다.
  event.waitUntil(self.registration.showNotification(title, options));
});

// 2. (나중에 할 일) 사용자가 알림을 클릭했을 때
self.addEventListener('notificationclick', event => {
  event.notification.close(); // 알림 닫기
  
  // (예시) 알림을 클릭하면 메인 페이지(index.html)로 이동
  event.waitUntil(
    clients.openWindow('index.html')
  );
});