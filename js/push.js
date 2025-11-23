// js/push.js
// ❗️ (404 오류 해결을 위한 다중 경로 시도 버전)

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
    } else {
        console.warn("이 브라우저는 Firebase 알림을 지원하지 않습니다.");
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

function setupMasterPushButton() {
  if (!masterPushButton) return; 

  // 브라우저 지원 확인
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !messaging) {
    masterPushButton.textContent = '알림 미지원';
    masterPushButton.disabled = true;
    return;
  }

  // ❗️ [핵심] 서비스 워커 경로 자동 감지 및 등록
  registerServiceWorkerWithFallback();

  isRoomSubscribed = (localStorage.getItem(STORAGE_KEY) === 'true');
  updateMasterButtonText(isRoomSubscribed);
  masterPushButton.onclick = onMasterSubscribeToggle;
}

// ❗️ [신규] 경로 자동 감지 함수
async function registerServiceWorkerWithFallback() {
    // 1. 시도할 경로들
    const paths = [
        './service-worker.js',  // 상대 경로 (1순위)
        '/service-worker.js',   // 절대 경로 (2순위)
        new URL('service-worker.js', window.location.href).href // 전체 URL (3순위)
    ];

    for (const path of paths) {
        try {
            const registration = await navigator.serviceWorker.register(path);
            console.log(`✅ 서비스 워커 등록 성공 (경로: ${path}):`, registration);
            
            // 성공했으므로 종료
            return; 
        } catch (error) {
            console.warn(`⚠️ 경로 실패 (${path}):`, error);
            // 다음 경로 시도...
        }
    }

    // 모든 경로 실패 시
    console.error("❌ 모든 경로에서 서비스 워커 등록 실패!");
    if (masterPushButton) masterPushButton.textContent = '알림 설정 실패 (404)';
}

async function onMasterSubscribeToggle() {
    if (!messaging) return alert("알림 기능을 사용할 수 없습니다.");

    masterPushButton.disabled = true;
    const targetState = !isRoomSubscribed; 

    try {
        if (targetState === true) {
            masterPushButton.textContent = '권한 확인 중...';
            
            const tokenOrStatus = await requestPermissionAndGetToken();
            if (tokenOrStatus === 'denied') throw new Error("알림이 차단되었습니다.");
            if (tokenOrStatus === null) throw new Error("알림 권한이 거부되었습니다.");
            
            const token = tokenOrStatus;
            await api.registerPushToken(token);
            
            const turnedOffCount = await turnOffAllIndividualToggles(); 
            const allToggles = document.querySelectorAll('.notify-me-toggle'); 
            await subscribeAllMachinesAPI(allToggles, true); 
            
            if (turnedOffCount > 0) {
                alert(`'빈자리 알림'이 등록되었습니다.\n\n켜져 있던 ${turnedOffCount}개의 개별 알림은 자동으로 꺼졌습니다.`);
            } else {
                alert("'빈자리 알림'이 등록되었습니다.");
            }

        } else {
            masterPushButton.textContent = '세탁실 알림 취소 중...';
            const allToggles = document.querySelectorAll('.notify-me-toggle');
            await subscribeAllMachinesAPI(allToggles, false); 
            alert('빈자리 알림이 취소되었습니다.');
        }

        isRoomSubscribed = targetState; 
        localStorage.setItem(STORAGE_KEY, isRoomSubscribed); 
        
    } catch (error) {
        alert(`처리 실패: ${error.message}`);
    }
    
    updateMasterButtonText(isRoomSubscribed);
    masterPushButton.disabled = false;
}

async function turnOffAllIndividualToggles() {
    const subscribedB_buttons = document.querySelectorAll('.notify-me-during-wash-btn:disabled');
    const tasks = [];
    const uniqueMachineIds = new Set();

    for (const btn of subscribedB_buttons) {
        if (btn.textContent.includes('✅ 알림 등록됨')) {
            btn.disabled = false;
            btn.textContent = '🔔 완료 알림 받기'; 
            const machineId = parseInt(btn.dataset.machineId, 10);
            if (machineId && !uniqueMachineIds.has(machineId)) {
                tasks.push(api.toggleNotifyMe(machineId, false));
                uniqueMachineIds.add(machineId);
            }
        }
    }
    if (tasks.length === 0) return 0;
    await Promise.all(tasks);
    return tasks.length; 
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

function updateMasterButtonText(isOn) {
    if (!masterPushButton) return; 
    if (isOn) {
        masterPushButton.textContent = "🔔 빈자리 알림 끄기 (허용 중)";
        masterPushButton.classList.add('subscribed'); 
    } else {
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