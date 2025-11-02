// js/push.js
// ❗️ (수정됨) "api" 중개자를 사용하도록 변경

document.addEventListener('DOMContentLoaded', function() {
  if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
    setupPushButton();
  }
});

function setupPushButton() {
  const pushButton = document.getElementById('enable-push-button');
  if (!pushButton) return; 

  // (서비스 워커 미지원 브라우저 체크 - 기존과 동일)
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('푸시 알림이 지원되지 않는 브라우저입니다.');
    pushButton.textContent = '알림 미지원';
    pushButton.disabled = true;
    return;
  }

  // (서비스 워커 등록 - 기존과 동일)
  navigator.serviceWorker.register('/service-worker.js')
    .then(registration => {
      console.log('서비스 워커 등록 성공:', registration);
    })
    .catch(error => {
      console.error('서비스 워커 등록 실패:', error);
      pushButton.textContent = '알림 설정 실패';
      pushButton.disabled = true;
    });

  // (버튼 클릭 이벤트 - 기존과 동일)
  pushButton.onclick = () => {
    pushButton.disabled = true; 
    subscribeUserToPush(pushButton);
  };
}

/**
 * ❗️ (수정됨) 사용자에게 알림 권한을 요청하고 "api"를 통해 구독
 */
async function subscribeUserToPush(pushButton) { // (async 추가)
  try {
    // 1. 사용자에게 "알림 허용?" 팝업창 띄우기 (기존과 동일)
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      console.log('알림 권한이 승인되었습니다.');
      
      // 2. (❗️ 수정!) "가짜 토큰" 대신 "가짜" 푸시 구독 요청
      // (실제 서버가 오면, 이 'fakeToken' 대신
      //  registration.pushManager.subscribe(...)로 받은 '진짜 토큰'을 넣어야 함)
      const fakeToken = 'FAKE_PUSH_TOKEN_' + Date.now();
      
      // 3. (❗️ 수정!) "중개자(api.js)"에게 토큰 등록 요청
      await api.registerPushToken(fakeToken); 
      
      alert('알림 구독에 성공했습니다!');
      pushButton.textContent = '✅ 알림 구독 완료';

    } else {
      // (알림 거부 로직 - 기존과 동일)
      console.warn('알림 권한이 거부되었습니다.');
      alert('알림이 거부되었습니다. 설정에서 변경해주세요.');
      pushButton.textContent = '알림 거부됨';
      pushButton.disabled = true;
    }
  } catch (error) {
    console.error('푸시 구독 중 오류 발생:', error);
    alert('알림 구독 중 오류가 발생했습니다.');
    pushButton.disabled = false; // 다시 시도할 수 있게
  }
}