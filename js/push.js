// js/push.js
// ❗️ (문구 통일: "빈자리 알림 사용 중" + 카드 버튼 잠금)

// 1. Firebase 설정
const firebaseConfig = {
    apiKey: "AIzaSyD0MBr9do9Hl3AJsNv0yZJRupDT1l-8dVE",
    authDomain: "washcallproject.firebaseapp.com",
    projectId: "washcallproject",
    storageBucket: "washcallproject.firebasestorage.app",
    messagingSenderId: "401971602509",
    appId: "1:401971602509:web:45ee34d4ed2454555aa804",
    measurementId: "G-K4FHGY7MZT"
};

// Firebase 초기화
let messaging = null;
try {
    firebase.initializeApp(firebaseConfig);
    if (typeof firebase.messaging === 'function' && firebase.messaging.isSupported()) {
        messaging = firebase.messaging();
    }
} catch (e) {
    console.error("Firebase 초기화 오류:", e);
}

let masterPushButton; 
const STORAGE_KEY = 'washcallRoomSubState'; 
let isRoomSubscribed = false; 

document.addEventListener('DOMContentLoaded', function() {
  if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
    masterPushButton = document.getElementById('room-subscribe-button');
    setupMasterPushButton();
  }
});

async function setupMasterPushButton() {
  if (!masterPushButton) return; 

  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !messaging) {
    masterPushButton.textContent = '알림 미지원';
    masterPushButton.disabled = true;
    return;
  }

  const swPath = await findServiceWorkerPath();
  if (swPath) {
      navigator.serviceWorker.register(swPath).catch(console.error);
  } else {
      masterPushButton.textContent = 'SW 파일 없음';
  }

  // 초기 상태 로드
  isRoomSubscribed = (localStorage.getItem(STORAGE_KEY) === 'true');
  updateMasterButtonText(isRoomSubscribed);
  
  // 페이지 로드 시 이미 켜져있다면 카드 잠금 실행
  if (isRoomSubscribed) {
      setTimeout(() => toggleAllCardButtons(true), 500);
  }

  masterPushButton.onclick = onMasterSubscribeToggle;
}

async function findServiceWorkerPath() {
    const candidates = ['./service-worker.js', '/service-worker.js', 'service-worker.js'];
    for (const path of candidates) {
        try {
            const res = await fetch(path, { method: 'HEAD' });
            if (res.ok) return path;
        } catch (e) {}
    }
    return null;
}

async function onMasterSubscribeToggle() {
    if (!messaging) return alert("알림 기능을 사용할 수 없습니다.");

    masterPushButton.disabled = true; 
    const targetState = !isRoomSubscribed; 

    try {
        if (targetState === true) {
            // [ON 켜기]
            masterPushButton.textContent = '권한 확인 중...';
            
            const tokenOrStatus = await requestPermissionAndGetToken();
            if (tokenOrStatus === 'denied') throw new Error("알림 차단됨");
            if (tokenOrStatus === null) throw new Error("알림 거부됨");
            
            const token = tokenOrStatus;
            await api.registerPushToken(token);
            
            // 1. 개별 알림 모두 끄기
            await turnOffAllIndividualToggles();
            
            // 2. 전체 구독 API 호출
            const allToggles = document.querySelectorAll('.notify-me-toggle'); 
            await subscribeAllMachinesAPI(allToggles, true); 
            
            // 3. 카드 버튼들 잠그기
            toggleAllCardButtons(true);

            alert(`'빈자리 알림'이 켜졌습니다.\n세탁기가 비면 푸시 알림을 드립니다.`);

        } else {
            // [OFF 끄기]
            masterPushButton.textContent = '해제 중...';
            const allToggles = document.querySelectorAll('.notify-me-toggle');
            await subscribeAllMachinesAPI(allToggles, false); 
            
            // 4. 카드 버튼들 풀기
            toggleAllCardButtons(false);
            
            alert('빈자리 알림이 꺼졌습니다.');
        }

        isRoomSubscribed = targetState; 
        localStorage.setItem(STORAGE_KEY, isRoomSubscribed); 
        
    } catch (error) {
        alert(`처리 실패: ${error.message}`);
        isRoomSubscribed = (localStorage.getItem(STORAGE_KEY) === 'true'); 
    }
    
    updateMasterButtonText(isRoomSubscribed);
    masterPushButton.disabled = false; 
}

// ❗️ [핵심] 카드 버튼 잠금/해제 함수 (문구 적용)
function toggleAllCardButtons(shouldDisable) {
    const startButtons = document.querySelectorAll('.notify-start-btn');
    const notifyButtons = document.querySelectorAll('.notify-me-during-wash-btn');

    // 시작 버튼 제어
    startButtons.forEach(btn => {
        btn.disabled = shouldDisable;
        if (shouldDisable) {
            btn.textContent = "빈자리 알림 사용 중"; // ❗️ 문구 통일
            btn.style.opacity = "0.5";
        } else {
            btn.textContent = "🔔 세탁 시작";
            btn.style.opacity = "1";
        }
    });

    // 완료 알림 버튼 제어
    notifyButtons.forEach(btn => {
        if (!btn.textContent.includes('✅')) {
            btn.disabled = shouldDisable;
            if (shouldDisable) {
                // btn.textContent = "-"; 
            } else {
                btn.textContent = "🔔 완료 알림 받기";
            }
        }
    });
}

async function turnOffAllIndividualToggles() {
    const subscribedB_buttons = document.querySelectorAll('.notify-me-during-wash-btn:disabled');
    const tasks = [];
    const uniqueMachineIds = new Set();
    for (const btn of subscribedB_buttons) {
        if (btn.textContent.includes('✅ 알림 등록됨')) {
            btn.disabled = false;
            btn.textContent = '🔔 완료 알림 받기'; 
            const card = btn.closest('.machine-card');
            if (card) delete card.dataset.isSubscribed;
            const machineId = parseInt(btn.dataset.machineId, 10);
            if (machineId && !uniqueMachineIds.has(machineId)) {
                tasks.push(api.toggleNotifyMe(machineId, false));
                uniqueMachineIds.add(machineId);
            }
        }
    }
    await Promise.all(tasks);
}

async function subscribeAllMachinesAPI(toggles, shouldBeOn) {
    const tasks = [];
    const washerCards = document.querySelectorAll('.machine-type-washer');
    washerCards.forEach(card => {
        const machineId = parseInt(card.id.replace('machine-', ''), 10);
        if (machineId) tasks.push(api.toggleNotifyMe(machineId, shouldBeOn));
    });
    await Promise.all(tasks);
}

// ❗️ [수정] 마스터 버튼 텍스트 통일
function updateMasterButtonText(isOn) {
    if (!masterPushButton) return; 
    
    if (isOn) {
        // ON 상태: "빈자리 알림 사용 중"
        masterPushButton.textContent = "🔔 빈자리 알림 사용 중"; 
        masterPushButton.classList.add('subscribed'); 
    } else {
        // OFF 상태
        masterPushButton.textContent = "🔔 빈자리 알림 받기";
        masterPushButton.classList.remove('subscribed'); 
    }
}

function checkiOSVersion() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (!isIOS) return true; 
    const match = navigator.userAgent.match(/OS (\d+)_(\d+)/);
    if (!match) return true;
    const majorVersion = parseInt(match[1], 10);
    const minorVersion = parseInt(match[2], 10);
    if (majorVersion < 16 || (majorVersion === 16 && minorVersion < 4)) {
        alert(`⚠️ iOS 16.4 이상이 필요합니다.`);
        return false;
    }
    return true;
}

async function requestPermissionAndGetToken() {
    if (!checkiOSVersion()) throw new Error('iOS 16.4 이상이 필요합니다.');
    if (!('Notification' in window)) throw new Error('알림 기능을 사용할 수 없습니다.');
    if (Notification.permission === 'denied') return 'denied'; 
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
        const VAPID_PUBLIC_KEY = 'BCyYOy8xvlx73JHB2ZikUoNI19l7qmkTnpzQvqmlheaiXwelDy9SLa4LhRcx3wG82gwdtMlFcQH3lqr3_5pwGm8'; 
        const registration = await navigator.serviceWorker.ready;
        const currentToken = await messaging.getToken({
            vapidKey: VAPID_PUBLIC_KEY,
            serviceWorkerRegistration: registration
        });
        if (currentToken) return currentToken; 
        else throw new Error('FCM 토큰 발급에 실패했습니다.'); 
    } else {
        return null; 
    }
}