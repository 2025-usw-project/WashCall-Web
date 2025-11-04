// js/push.js
// ❗️ ('전체 알림 켜기/끄기' 마스터 토글 스위치 최종본)

// 1. Firebase 설정 (이전과 동일)
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
const messaging = firebase.messaging();

// ❗️ 마스터 버튼 DOM을 전역에서 참조
let masterPushButton; 

document.addEventListener('DOMContentLoaded', function() {
  if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
    setupMasterPushButton();
  }
});

function setupMasterPushButton() {
  masterPushButton = document.getElementById('enable-push-button');
  if (!masterPushButton) return; 

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    masterPushButton.textContent = '알림 미지원';
    masterPushButton.disabled = true;
    return;
  }

  // 2. 서비스 워커 등록 (필수)
  navigator.serviceWorker.register('/service-worker.js')
    .then(registration => {
      messaging.useServiceWorker(registration);
    })
    .catch(error => {
      console.error('서비스 워커 등록 실패:', error);
      masterPushButton.textContent = '알림 설정 실패';
    });

  // 3. ❗️ [핵심] 마스터 버튼 클릭 이벤트
  masterPushButton.onclick = onMasterToggleClick;

  // 4. ❗️ [핵심] 페이지 로드 시, 그리고 2초 후(DOM 렌더링 대기) 버튼 상태 업데이트
  updateMasterButtonText();
  setTimeout(updateMasterButtonText, 2000); // main.js가 렌더링할 시간 대기

  // 5. ❗️ [핵심] 개별 토글이 변경될 때마다 마스터 버튼 텍스트 동기화
  // (이벤트 위임 사용)
  document.body.addEventListener('change', event => {
      if (event.target.classList.contains('notify-me-toggle')) {
          // 개별 토글이 변경되면, 잠시 후 마스터 버튼 텍스트 업데이트
          setTimeout(updateMasterButtonText, 50); 
      }
  });
}

/**
 * ❗️ [신규] 마스터 토글 버튼 클릭 시 실행되는 메인 로직
 */
async function onMasterToggleClick() {
    masterPushButton.disabled = true; // 중복 클릭 방지

    // 1. 현재 켜진 토글과 전체 토글 수를 계산
    const allToggles = document.querySelectorAll('.notify-me-toggle');
    const checkedToggles = document.querySelectorAll('.notify-me-toggle:checked');
    
    // 2. 켤지(true) 끌지(false) 결정
    // (절반 이하로 켜져 있으면 '켜기' 실행, 아니면 '끄기' 실행)
    const shouldTurnOn = (checkedToggles.length <= allToggles.length / 2);

    if (shouldTurnOn) {
        // --- [A] 전체 켜기 로직 ---
        masterPushButton.textContent = '권한 확인 중...';
        try {
            // 3. 권한 요청 및 토큰 발급 (Q1 로직)
            const token = await requestPermissionAndGetToken();
            if (!token) throw new Error('알림 권한이 거부되었습니다.');

            // 4. FCM 토큰 서버 등록
            await api.registerPushToken(token);

            // 5. 모든 토글을 켜고 API 호출
            await toggleAllMachinesAPI(allToggles, true);
            alert('전체 알림이 켜졌습니다.');

        } catch (error) {
            alert(`전체 켜기 실패: ${error.message}`);
        }
    } else {
        // --- [B] 전체 끄기 로직 ---
        masterPushButton.textContent = '끄는 중...';
        try {
            // 3. 권한 필요 없음. 모든 토글을 끄고 API 호출
            await toggleAllMachinesAPI(allToggles, false);
            alert('전체 알림이 꺼졌습니다.');
        } catch (error) {
            alert(`전체 끄기 실패: ${error.message}`);
        }
    }
    
    // 4. 최종 버튼 텍스트 업데이트 및 버튼 활성화
    updateMasterButtonText();
    masterPushButton.disabled = false;
}

/**
 * ❗️ [신규] 모든 토글의 DOM을 업데이트하고 서버 API를 병렬 호출
 * @param {NodeListOf<Element>} toggles - 제어할 토글 요소 목록
 * @param {boolean} shouldBeOn - 켜야 할지(true) 꺼야 할지(false)
 */
async function toggleAllMachinesAPI(toggles, shouldBeOn) {
    const tasks = [];
    for (const toggle of toggles) {
        // 1. DOM(UI) 상태 변경
        toggle.checked = shouldBeOn;
        
        // 2. 서버 API 호출
        const machineId = parseInt(toggle.dataset.machineId, 10);
        if (machineId) {
            tasks.push(api.toggleNotifyMe(machineId, shouldBeOn));
        }
    }
    // 3. 모든 API 호출이 끝날 때까지 대기
    await Promise.all(tasks);
}


/**
 * ❗️ [신규] 현재 토글 상태를 읽어 마스터 버튼 텍스트를 업데이트
 */
function updateMasterButtonText() {
    if (!masterPushButton) return;

    const allToggles = document.querySelectorAll('.notify-me-toggle');
    const checkedToggles = document.querySelectorAll('.notify-me-toggle:checked');
    
    if (allToggles.length === 0) {
        masterPushButton.textContent = '🔔 전체 알림 켜기'; // (기본값)
        return;
    }

    // 절반 이하로 켜져 있으면 '켜기' 버튼 표시, 아니면 '끄기' 버튼 표시
    const shouldTurnOn = (checkedToggles.length <= allToggles.length / 2);
    masterPushButton.textContent = shouldTurnOn ? "🔔 전체 알림 켜기" : "🔕 전체 알림 끄기";
}


/**
 * ❗️ [신규] 권한 요청 및 FCM 토큰 발급 헬퍼 (Q1 로직)
 * @returns {Promise<string|null>} FCM 토큰 또는 실패 시 null
 */
async function requestPermissionAndGetToken() {
    // (이 함수는 Q1 응답의 requestPermissionAndGetToken과 동일)
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
        const currentToken = await messaging.getToken();
        if (currentToken) {
            console.log('FCM 토큰 획득:', currentToken);
            return currentToken;
        } else {
            throw new Error('FCM 토큰 발급에 실패했습니다.');
        }
    } else {
        return null; // (거부 시 null 반환)
    }
}