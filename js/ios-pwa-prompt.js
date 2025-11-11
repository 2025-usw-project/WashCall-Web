// js/ios-pwa-prompt.js
// iOS PWA 홈 화면 추가 유도 UI

/**
 * iOS 기기 감지
 */
function isIOSDevice() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

/**
 * PWA 모드(홈 화면에서 실행) 확인
 */
function isPWAInstalled() {
    // iOS: window.navigator.standalone
    // Android/Desktop: display-mode
    return window.navigator.standalone === true || 
           window.matchMedia('(display-mode: standalone)').matches;
}

/**
 * iOS PWA 설치 상태 체크 및 안내 표시
 */
function checkAndShowPWAPrompt() {
    // iOS 기기가 아니면 종료
    if (!isIOSDevice()) {
        console.log('iOS 기기가 아닙니다. PWA 프롬프트 스킵');
        return;
    }
    
    // 이미 PWA로 설치되어 실행 중이면 종료
    if (isPWAInstalled()) {
        console.log('✅ iOS PWA 모드에서 실행 중 (푸시 알림 지원)');
        return;
    }
    
    // Safari 브라우저에서 실행 중 → 홈 화면 추가 안내
    console.log('📱 iOS Safari에서 실행 중 → 홈 화면 추가 안내 표시');
    showPWAInstallPrompt();
}

/**
 * 홈 화면 추가 안내 UI 표시
 */
function showPWAInstallPrompt() {
    const PROMPT_STORAGE_KEY = 'washcall_pwa_prompt_shown';
    const PROMPT_DISMISS_COUNT_KEY = 'washcall_pwa_prompt_dismiss_count';
    
    // 사용자가 3번 이상 닫았으면 더 이상 표시 안 함
    const dismissCount = parseInt(localStorage.getItem(PROMPT_DISMISS_COUNT_KEY) || '0', 10);
    if (dismissCount >= 3) {
        console.log('PWA 프롬프트가 3번 이상 무시됨. 더 이상 표시 안 함');
        return;
    }
    
    // 이미 오늘 표시했으면 스킵 (24시간 후 재표시)
    const lastShown = localStorage.getItem(PROMPT_STORAGE_KEY);
    if (lastShown) {
        const lastShownTime = new Date(lastShown);
        const now = new Date();
        const hoursSinceLastShown = (now - lastShownTime) / (1000 * 60 * 60);
        
        if (hoursSinceLastShown < 24) {
            console.log(`PWA 프롬프트는 ${Math.floor(24 - hoursSinceLastShown)}시간 후 다시 표시됩니다.`);
            return;
        }
    }
    
    // 3초 후 표시 (페이지 로드 직후 표시하면 사용자 경험 저하)
    setTimeout(() => {
        createPWAPromptUI();
        localStorage.setItem(PROMPT_STORAGE_KEY, new Date().toISOString());
    }, 3000);
}

/**
 * PWA 프롬프트 UI 생성
 */
function createPWAPromptUI() {
    // 이미 표시 중이면 종료
    if (document.getElementById('ios-pwa-prompt')) {
        return;
    }
    
    const promptHTML = `
        <div id="ios-pwa-prompt" style="
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px 16px 24px 16px;
            text-align: center;
            z-index: 10000;
            box-shadow: 0 -4px 20px rgba(0,0,0,0.3);
            animation: slideUp 0.4s ease-out;
        ">
            <style>
                @keyframes slideUp {
                    from {
                        transform: translateY(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
                
                #ios-pwa-prompt button {
                    transition: all 0.3s ease;
                }
                
                #ios-pwa-prompt button:active {
                    transform: scale(0.95);
                }
            </style>
            
            <div style="max-width: 500px; margin: 0 auto;">
                <div style="font-size: 28px; margin-bottom: 8px;">📱</div>
                <p style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold; line-height: 1.4;">
                    WashCall을 홈 화면에 추가하세요!
                </p>
                <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.5; opacity: 0.95;">
                    Safari 하단의 <strong>공유 버튼 📤</strong>을 눌러<br>
                    <strong>"홈 화면에 추가"</strong>를 선택하세요.
                </p>
                <p style="margin: 0 0 16px 0; font-size: 13px; opacity: 0.85; line-height: 1.4;">
                    <em>※ 푸시 알림은 홈 화면 앱에서만 동작합니다 (iOS 16.4+)</em>
                </p>
                <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                    <button id="pwa-prompt-close" style="
                        background: white;
                        color: #667eea;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 12px;
                        font-weight: bold;
                        font-size: 14px;
                        cursor: pointer;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                    ">확인</button>
                    <button id="pwa-prompt-never" style="
                        background: rgba(255, 255, 255, 0.2);
                        color: white;
                        border: 1px solid rgba(255, 255, 255, 0.4);
                        padding: 12px 24px;
                        border-radius: 12px;
                        font-weight: normal;
                        font-size: 14px;
                        cursor: pointer;
                    ">다시 보지 않기</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', promptHTML);
    
    // 확인 버튼
    const closeButton = document.getElementById('pwa-prompt-close');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            dismissPWAPrompt(false);
        });
    }
    
    // 다시 보지 않기 버튼
    const neverButton = document.getElementById('pwa-prompt-never');
    if (neverButton) {
        neverButton.addEventListener('click', () => {
            dismissPWAPrompt(true);
        });
    }
}

/**
 * PWA 프롬프트 닫기
 */
function dismissPWAPrompt(neverShowAgain) {
    const prompt = document.getElementById('ios-pwa-prompt');
    if (!prompt) return;
    
    // 애니메이션과 함께 닫기
    prompt.style.animation = 'slideDown 0.3s ease-in';
    prompt.style.animationFillMode = 'forwards';
    
    // CSS 애니메이션 추가
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideDown {
            from {
                transform: translateY(0);
                opacity: 1;
            }
            to {
                transform: translateY(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
    
    setTimeout(() => {
        prompt.remove();
    }, 300);
    
    if (neverShowAgain) {
        // 다시 보지 않기 선택 시 dismiss count를 3으로 설정
        localStorage.setItem('washcall_pwa_prompt_dismiss_count', '3');
        console.log('PWA 프롬프트 영구 숨김');
    } else {
        // 확인 버튼: dismiss count 증가
        const PROMPT_DISMISS_COUNT_KEY = 'washcall_pwa_prompt_dismiss_count';
        const currentCount = parseInt(localStorage.getItem(PROMPT_DISMISS_COUNT_KEY) || '0', 10);
        localStorage.setItem(PROMPT_DISMISS_COUNT_KEY, String(currentCount + 1));
        console.log(`PWA 프롬프트 닫힘 (${currentCount + 1}/3)`);
    }
}

/**
 * 페이지 로드 시 자동 실행
 */
document.addEventListener('DOMContentLoaded', () => {
    // index.html에서만 실행
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
        checkAndShowPWAPrompt();
    }
});

// 전역으로 노출 (디버깅용)
window.showPWAPromptManually = () => {
    localStorage.removeItem('washcall_pwa_prompt_shown');
    localStorage.removeItem('washcall_pwa_prompt_dismiss_count');
    createPWAPromptUI();
};
