// js/main.js
// ❗️ (알림 등록 후 UI가 멋대로 초기화되는 버그 수정 + 모달/타이머/속도 통합본)

let connectionStatusElement;
let currentSelectedMachineId = null; 

document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
        main();
    }
});

async function main() {
    console.log('WashCall WebApp 시작!');
    connectionStatusElement = document.getElementById('connection-status');
    
    try {
        updateConnectionStatus('connecting'); 
        
        const [machines] = await Promise.all([
            api.getInitialMachines(),
            loadCongestionTip() 
        ]);

        renderMachines(machines); 
        
        setupModalEvents();
        addGlobalClickListener();

        tryConnect(); 
    } catch (error) {
        console.error("초기 세탁기 목록 또는 팁 로드 실패:", error);
        updateConnectionStatus('error'); 
    }
}

async function loadCongestionTip() {
    const tipContainer = document.getElementById('congestion-tip-container');
    const tipTextElement = document.getElementById('congestion-tip-text');
    if (!tipContainer) return;
    try {
        const tipText = await api.getCongestionTip(); 
        if (tipText && tipTextElement) {
            tipTextElement.textContent = tipText; 
            tipContainer.classList.remove('hidden');
        } else {
            tipContainer.classList.add('hidden');
        }
    } catch (error) {
        console.warn("혼잡도 팁을 불러오는 데 실패했습니다:", error);
        tipContainer.classList.add('hidden');
    }
}

function tryConnect() {
    api.connect(
        () => {
            updateConnectionStatus('success');
        },
        (event) => {
            handleSocketMessage(event); 
        },
        () => {
            updateConnectionStatus('error');
            setTimeout(() => {
                console.log("WebSocket 재연결 시도...");
                tryConnect();
            }, 5000); 
        }
    );
}

function updateConnectionStatus(status) {
    // 토스트 스타일 알림 생성
    let message = '';
    let iconColor = '';
    let bgColor = '';
    
    switch (status) {
        case 'connecting':
            return; // 연결 시도 중일 때는 토스트 안 띄움
        case 'success':
            message = '✅ 서버 연결 성공!';
            iconColor = 'text-green-500';
            bgColor = 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
            break;
        case 'error':
            message = '❌ 서버 연결 실패';
            iconColor = 'text-red-500';
            bgColor = 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
            break;
        default:
            return;
    }
    
    // 토스트 엘리먼트 생성
    const toast = document.createElement('div');
    toast.className = `fixed bottom-20 left-1/2 transform -translate-x-1/2 z-[70] px-6 py-3 rounded-xl border ${bgColor} shadow-lg animate-slide-up`;
    toast.innerHTML = `
        <div class="flex items-center gap-2">
            <span class="${iconColor} text-lg">${message.startsWith('✅') ? '✅' : '❌'}</span>
            <span class="text-sm font-medium text-gray-900 dark:text-white">${message.replace(/[✅❌]\s/, '')}</span>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    // 3초 후 제거 (성공), 5초 후 제거 (실패)
    const duration = status === 'success' ? 3000 : 5000;
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translate(-50%, 20px)';
        toast.style.transition = 'all 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

async function handleSocketMessage(event) {
    try {
        const message = JSON.parse(event.data); 

        if (message.type === 'timer_sync') {
            if (message.machines && Array.isArray(message.machines)) {
                for (const machine of message.machines) {
                    const isSubscribed = null; // 서버 정보 없음 (기존 상태 유지)
                    updateMachineCard(
                        machine.machine_id, 
                        machine.status, 
                        machine.timer, 
                        isSubscribed,
                        machine.elapsed_time_minutes
                    );
                }
            }
            return; 
        }

        const machineId = message.machine_id;
        const newStatus = message.status;
        const newTimer = (message.timer !== undefined) ? message.timer : null; 
        const isSubscribed = null; 
        const newElapsedMinutes = message.elapsed_time_minutes;

        if (message.type === 'room_status') { 
            updateMachineCard(machineId, newStatus, newTimer, isSubscribed, newElapsedMinutes); 
        }
        
    } catch (error) {
        console.error("WebSocket 메시지 파싱 오류 또는 처리 오류:", error);
    }
}

function updateMachineCard(machineId, newStatus, newTimer, isSubscribed, newElapsedMinutes) {
    const card = document.getElementById(`machine-${machineId}`);
    if (!card) return; 

    const machineType = card.dataset.machineType || 'washer';
    const machineDisplayName = card.querySelector('h3')?.textContent || `기기 ${machineId}`;

    // 상태별 설정
    const statusConfig = getStatusConfig(newStatus);
    card.style.borderColor = statusConfig.borderColor;

    // SPINNING 상태일 때 카드에 흔들림 애니메이션 추가
    if (newStatus === 'SPINNING') {
        card.classList.add('animate-shake');
    } else {
        card.classList.remove('animate-shake');
    }

    // 구독 상태 결정
    let finalIsSubscribed = false;
    if (isSubscribed === true) {
        finalIsSubscribed = true;
        card.dataset.isSubscribed = 'true';
    } else if (isSubscribed === false) {
        finalIsSubscribed = false;
        delete card.dataset.isSubscribed;
    } else {
        finalIsSubscribed = (card.dataset.isSubscribed === 'true');
    }

    // 타이머 계산
    const isOperating = (newStatus === 'WASHING' || newStatus === 'SPINNING' || newStatus === 'DRYING');
    const hasTimer = (newTimer !== null && typeof newTimer === 'number');
    const hasElapsed = (newElapsedMinutes !== null && typeof newElapsedMinutes === 'number' && newElapsedMinutes >= 0);
    let totalTime = (hasTimer && hasElapsed) ? (newElapsedMinutes + newTimer) : null;
    const progressPercent = totalTime > 0 ? Math.round((newElapsedMinutes / totalTime) * 100) : 0;
    const shouldShowTimer = isOperating && (totalTime !== null && totalTime > 0);

    // 버튼 표시 로직
    let showStartButton = false;
    let showScenario_B = false;
    
    if (finalIsSubscribed) {
        showScenario_B = true;
    } else {
        if (isOperating) {
            showScenario_B = true;
        } else {
            showStartButton = true;
        }
    }

    // 진행 상황 텍스트 (상태별)
    let progressLabel = '진행 상황';
    if (newStatus === 'WASHING') progressLabel = '세탁 진행 상황';
    else if (newStatus === 'SPINNING') progressLabel = '탈수 진행 상황';
    else if (newStatus === 'DRYING') progressLabel = '건조 진행 상황';

    // 카드 내용 전체 재렌더링
    card.innerHTML = `
        <!-- 상태 아이콘 & 타입 -->
        <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
                <div class="text-3xl ${statusConfig.animation}">${statusConfig.icon}</div>
                <div>
                    <h3 class="text-lg font-bold text-gray-900 dark:text-white">${machineDisplayName}</h3>
                    <span class="badge badge-${newStatus.toLowerCase()} text-xs">${translateStatus(newStatus, machineType)}</span>
                </div>
            </div>
            <div class="text-2xl">${machineType === 'dryer' ? '🌀' : '🫧'}</div>
        </div>
        
        <!-- 프로그레스 바 (작동 중일 때만) -->
        ${shouldShowTimer ? `
            <div class="mb-4">
                <div class="flex justify-between text-sm mb-2">
                    <span class="text-gray-600 dark:text-white">${progressLabel}</span>
                    <span class="font-semibold ${statusConfig.textColor}">${newElapsedMinutes}분</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-bar-fill" style="width: ${progressPercent}%; background: ${statusConfig.gradient}"></div>
                </div>
            </div>
            
            <!-- 타이머 정보 -->
            <div class="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 mb-4">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-sm text-gray-600 dark:text-gray-400">총 예상 시간</span>
                    <span id="timer-total-${machineId}" class="text-lg font-bold text-gray-900 dark:text-white">약 ${totalTime}분</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-sm text-gray-600 dark:text-gray-400">진행 시간</span>
                    <span id="timer-elapsed-${machineId}" class="text-sm font-semibold ${statusConfig.textColor}">${newElapsedMinutes}분 진행</span>
                </div>
            </div>
        ` : ''}
        
        <!-- 버튼 -->
        ${showStartButton ? `
            <button class="notify-start-btn btn btn-primary w-full" data-machine-id="${machineId}">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                </svg>
                세탁 시작
            </button>
        ` : ''}
        
        ${showScenario_B ? `
            <button class="notify-me-during-wash-btn btn ${finalIsSubscribed ? 'btn-secondary cursor-not-allowed' : 'btn-ghost'} w-full" 
                    data-machine-id="${machineId}" 
                    ${finalIsSubscribed ? 'disabled' : ''}>
                ${finalIsSubscribed ? `
                    <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    알림 등록됨
                ` : `
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                    </svg>
                    완료 알림 받기
                `}
            </button>
        ` : ''}
    `;
    
    // 이벤트 리스너 재등록
    addNotifyStartLogic();
    addNotifyMeDuringWashLogic();
}

function renderMachines(machines) {
    const container = document.getElementById('machine-list-container');
    if (!container) return;
    container.innerHTML = '';

    machines.forEach((machine, index) => {
        const machineDiv = document.createElement('div');
        const machineType = machine.machine_type || 'washer'; 
        
        // 상태별 색상 및 아이콘
        const statusConfig = getStatusConfig(machine.status);
        
        // 기본 클래스 (Glassmorphism 카드)
        machineDiv.className = 'glass-card rounded-2xl p-6 border-2 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 animate-slide-up';
        machineDiv.classList.add(`stagger-${Math.min(index + 1, 5)}`);
        machineDiv.classList.add(machineType === 'dryer' ? 'machine-type-dryer' : 'machine-type-washer');
        machineDiv.style.borderColor = statusConfig.borderColor;
        machineDiv.dataset.machineType = machineType; 
        machineDiv.id = `machine-${machine.machine_id}`; 
        
        // 서버에서 받은 구독 정보 저장
        if (machine.isusing === 1) {
            machineDiv.dataset.isSubscribed = 'true';
        }

        // 타이머 계산
        const isOperating = (machine.status === 'WASHING' || machine.status === 'SPINNING' || machine.status === 'DRYING');
        const timerRemaining = machine.timer; 
        const elapsedMinutes = machine.elapsed_time_minutes;
        
        const hasTimer = (timerRemaining !== null && typeof timerRemaining === 'number');
        const hasElapsed = (elapsedMinutes !== null && typeof elapsedMinutes === 'number' && elapsedMinutes >= 0);
        let totalTime = (hasTimer && hasElapsed) ? (elapsedMinutes + timerRemaining) : null;
        const progressPercent = totalTime > 0 ? Math.round((elapsedMinutes / totalTime) * 100) : 0;

        const shouldShowTimer = isOperating && (totalTime !== null && totalTime > 0);
        
        // 버튼 초기 상태
        const isDisabled = isOperating;
        const isSubscribed = (machine.isusing === 1);
        
        let showStartButton, showScenario_B;

        if (isSubscribed) {
            showStartButton = false;
            showScenario_B = true; 
        } else {
            if (isDisabled) {
                showStartButton = false;
                showScenario_B = true;
            } else {
                showStartButton = true;
                showScenario_B = false;
            }
        }
        
        const scenarioB_DisabledAttr = isSubscribed ? 'disabled' : '';
        const machineDisplayName = machine.machine_name || `기기 ${machine.machine_id}`;
        
        // 진행 상황 텍스트 (상태별)
        let progressLabel = '진행 상황';
        if (machine.status === 'WASHING') progressLabel = '세탁 진행 상황';
        else if (machine.status === 'SPINNING') progressLabel = '탈수 진행 상황';
        else if (machine.status === 'DRYING') progressLabel = '건조 진행 상황';

        // 새로운 Glassmorphism 디자인
        machineDiv.innerHTML = `
            <!-- 상태 아이콘 & 타입 -->
            <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-3">
                    <div class="text-3xl ${statusConfig.animation}">${statusConfig.icon}</div>
                    <div>
                        <h3 class="text-lg font-bold text-gray-900 dark:text-white">${machineDisplayName}</h3>
                        <span class="badge badge-${machine.status.toLowerCase()} text-xs">${translateStatus(machine.status, machineType)}</span>
                    </div>
                </div>
                <div class="text-2xl">${machineType === 'dryer' ? '🌀' : '🫧'}</div>
            </div>
            
            <!-- 프로그레스 바 (작동 중일 때만) -->
            ${shouldShowTimer ? `
                <div class="mb-4">
                    <div class="flex justify-between text-sm mb-2">
                        <span class="text-gray-600 dark:text-white">${progressLabel}</span>
                        <span class="font-semibold ${statusConfig.textColor}">${elapsedMinutes}분</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-bar-fill" style="width: ${progressPercent}%; background: ${statusConfig.gradient}"></div>
                    </div>
                </div>
                
                <!-- 타이머 정보 -->
                <div class="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 mb-4">
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-sm text-gray-600 dark:text-gray-400">총 예상 시간</span>
                        <span id="timer-total-${machine.machine_id}" class="text-lg font-bold text-gray-900 dark:text-white">약 ${totalTime}분</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-gray-600 dark:text-gray-400">진행 시간</span>
                        <span id="timer-elapsed-${machine.machine_id}" class="text-sm font-semibold ${statusConfig.textColor}">${elapsedMinutes}분 진행</span>
                    </div>
                </div>
            ` : ''}
            
            <!-- 버튼 -->
            ${showStartButton ? `
                <button class="notify-start-btn btn btn-primary w-full" data-machine-id="${machine.machine_id}">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                    </svg>
                    세탁 시작
                </button>
            ` : ''}
            
            ${showScenario_B ? `
                <button class="notify-me-during-wash-btn btn ${isSubscribed ? 'btn-secondary cursor-not-allowed' : 'btn-ghost'} w-full" 
                        data-machine-id="${machine.machine_id}" 
                        ${scenarioB_DisabledAttr}>
                    ${isSubscribed ? `
                        <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        알림 등록됨
                    ` : `
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                        </svg>
                        완료 알림 받기
                    `}
                </button>
            ` : ''}
        `;
        
        container.appendChild(machineDiv);
    });

    addNotifyStartLogic(); 
    addNotifyMeDuringWashLogic(); 
}

// 상태별 설정 헬퍼 함수
function getStatusConfig(status) {
    const configs = {
        'OFF': {
            icon: '⏸️',
            borderColor: '#94a3b8',
            textColor: 'text-gray-500',
            gradient: 'linear-gradient(90deg, #94a3b8 0%, #cbd5e1 100%)',
            animation: ''
        },
        'WASHING': {
            icon: '🫧',
            borderColor: '#3b82f6',
            textColor: 'text-blue-600 dark:text-blue-400',
            gradient: 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)',
            animation: 'animate-pulse-slow'
        },
        'SPINNING': {
            icon: '🌀',
            borderColor: '#f59e0b',
            textColor: 'text-amber-600 dark:text-amber-400',
            gradient: 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)',
            animation: 'animate-shake'
        },
        'DRYING': {
            icon: '🔥',
            borderColor: '#ef4444',
            textColor: 'text-red-600 dark:text-red-400',
            gradient: 'linear-gradient(90deg, #ef4444 0%, #f87171 100%)',
            animation: 'animate-shake'
        },
        'FINISHED': {
            icon: '✅',
            borderColor: '#10b981',
            textColor: 'text-green-600 dark:text-green-400',
            gradient: 'linear-gradient(90deg, #10b981 0%, #34d399 100%)',
            animation: 'animate-bounce-slow'
        }
    };
    
    return configs[status] || configs['OFF'];
}

// 모달 이벤트 설정
function setupModalEvents() {
    const modal = document.getElementById('course-modal');
    const closeBtn = document.querySelector('.close-modal');
    const courseBtns = document.querySelectorAll('.modal-course-btn');

    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.style.display = 'none';
            currentSelectedMachineId = null;
        };
    }

    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
            currentSelectedMachineId = null;
        }
    };

    courseBtns.forEach(btn => {
        btn.onclick = async () => {
            const courseName = btn.dataset.course;
            if (currentSelectedMachineId && courseName) {
                modal.style.display = 'none'; 
                await handleCourseSelection(currentSelectedMachineId, courseName);
            }
        };
    });
}

// 세탁 시작 클릭 -> 모달 띄우기
function addNotifyStartLogic() {
    document.querySelectorAll('.notify-start-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const btn = event.currentTarget; // currentTarget 사용
            const machineId = parseInt(btn.dataset.machineId, 10);
            const card = document.getElementById(`machine-${machineId}`);
            if (!card) return;

            const machineType = card.dataset.machineType || 'washer';
            
            if (machineType === 'washer') {
                currentSelectedMachineId = machineId;
                const modal = document.getElementById('course-modal');
                if (modal) {
                    modal.style.display = 'flex';
                }
            } else {
                handleDryerStart(btn, card);
            }
        });
    });
}

// 외부 클릭 감지 (모달 방식에서는 크게 필요 없지만 유지)
function addGlobalClickListener() {
    // 모달은 자체 이벤트로 닫히므로 여기선 할 일 없음
}

// 모달에서 코스 선택 시
async function handleCourseSelection(machineId, courseName) {
    const card = document.getElementById(`machine-${machineId}`);
    if (!card) return;

    const startButton = card.querySelector('.notify-start-btn');
    const notifyMeButton = card.querySelector('.notify-me-during-wash-btn');

    // 로딩 상태
    if (startButton) {
        startButton.disabled = true;
        startButton.textContent = "요청 중...";
    }

    try {
        // (빈자리 알림 로직 생략 없이 포함)
        const roomSubState = localStorage.getItem('washcallRoomSubState');
        if (roomSubState === 'true') {
            const washerCards = document.querySelectorAll('.machine-type-washer');
            const tasks = [];
            washerCards.forEach(card => {
                const mid = parseInt(card.id.replace('machine-', ''), 10);
                if(mid) tasks.push(api.toggleNotifyMe(mid, false));
            });
            await Promise.all(tasks);
            localStorage.setItem('washcallRoomSubState', 'false');
            const masterBtn = document.getElementById('room-subscribe-button');
            if (masterBtn) {
                masterBtn.textContent = "🔔 빈자리 알림 받기";
                masterBtn.classList.remove('subscribed'); 
            }
            alert("'빈자리 알림'이 꺼지고, '개별 알림'이 켜집니다.");
        }

        const tokenOrStatus = await requestPermissionAndGetToken();
        if (tokenOrStatus === 'denied') throw new Error("알림 차단됨");
        if (tokenOrStatus === null) throw new Error("알림 거부됨");
        
        const token = tokenOrStatus;

        // 병렬 API 호출
        await Promise.all([
            api.registerPushToken(token),
            api.toggleNotifyMe(machineId, true),
            api.startCourse(machineId, courseName)
        ]);
        
        // ❗️ [핵심] 성공 시 로컬에 구독 상태 기록
        card.dataset.isSubscribed = 'true';

        // UI 변경
        if (startButton) startButton.style.display = 'none';
        if (notifyMeButton) {
            notifyMeButton.style.display = 'block';
            notifyMeButton.textContent = '✅ 알림 등록됨';
            notifyMeButton.disabled = true;
        }

        // alert 띄우기 (렌더링 후)
        setTimeout(() => {
            alert(`${courseName} 코스 알림이 등록되었습니다.`);
        }, 50);

    } catch (error) {
        console.error("API 오류:", error);
        alert(`시작 실패: ${error.message}`);
        
        try { await api.toggleNotifyMe(machineId, false); } catch(e) {}
        
        // 실패 시 로컬 상태 제거
        delete card.dataset.isSubscribed;

        if (startButton) {
            startButton.style.display = 'block';
            startButton.disabled = false;
            startButton.textContent = '🔔 세탁 시작';
        }
    }
}

// 완료 알림 받기 버튼 로직
function addNotifyMeDuringWashLogic() {
    document.querySelectorAll('.notify-me-during-wash-btn').forEach(button => {
        button.addEventListener('click', async (event) => {
            const btn = event.currentTarget;
            const machineId = parseInt(btn.dataset.machineId, 10);
            const card = document.getElementById(`machine-${machineId}`);
            if (!card) return;

            btn.disabled = true;
            btn.textContent = "요청 중...";

            try {
                // 1. 빈자리 알림이 켜져 있으면 끄기
                const roomSubState = localStorage.getItem('washcallRoomSubState');
                if (roomSubState === 'true') {
                    localStorage.setItem('washcallRoomSubState', 'false');
                    
                    // 빈자리 알림 버튼 UI 업데이트
                    const masterBtn = document.getElementById('room-subscribe-button');
                    if (masterBtn) {
                        masterBtn.textContent = "🔔 빈자리 알림 받기";
                        masterBtn.classList.remove('subscribed');
                    }
                    
                    // 서버에 빈자리 알림 취소 요청 (모든 세탁기)
                    const washerCards = document.querySelectorAll('.machine-type-washer');
                    const unsubTasks = [];
                    washerCards.forEach(c => {
                        const mid = parseInt(c.id.replace('machine-', ''), 10);
                        if (mid && mid !== machineId) { // 현재 클릭한 기기 제외
                            unsubTasks.push(api.toggleNotifyMe(mid, false));
                        }
                    });
                    await Promise.all(unsubTasks);
                }
                
                // 2. 개별 알림 등록
                const tokenOrStatus = await requestPermissionAndGetToken();
                if (tokenOrStatus === 'denied') throw new Error("알림 차단됨");
                if (tokenOrStatus === null) throw new Error("알림 거부됨");
                
                const token = tokenOrStatus;

                await Promise.all([
                    api.registerPushToken(token),
                    api.toggleNotifyMe(machineId, true)
                ]);
                
                // 로컬 상태 저장
                card.dataset.isSubscribed = 'true';
                
                // 버튼 UI 즉시 업데이트
                btn.classList.remove('btn-ghost');
                btn.classList.add('btn-secondary', 'cursor-not-allowed');
                btn.innerHTML = `
                    <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    알림 등록됨
                `;
                btn.disabled = true;
                
                setTimeout(() => {
                    alert('완료 알림이 등록되었습니다.\n\n빈자리 알림이 꺼졌습니다.');
                }, 50);

            } catch (error) {
                console.error("API 오류:", error);
                alert(`알림 등록 실패: ${error.message}`);
                delete card.dataset.isSubscribed;
                btn.disabled = false;
                btn.textContent = '🔔 완료 알림 받기';
            }
        });
    });
}

async function handleDryerStart(clickedBtn, card) {
    const machineId = parseInt(clickedBtn.dataset.machineId, 10);
    if (!machineId) return;

    clickedBtn.disabled = true;
    clickedBtn.textContent = "요청 중...";

    try {
        const roomSubState = localStorage.getItem('washcallRoomSubState');
        if (roomSubState === 'true') {
            // ... (빈자리 알림 끄기 로직)
             const washerCards = document.querySelectorAll('.machine-type-washer');
            const tasks = [];
            washerCards.forEach(card => {
                const mid = parseInt(card.id.replace('machine-', ''), 10);
                if(mid) tasks.push(api.toggleNotifyMe(mid, false));
            });
            await Promise.all(tasks);
            localStorage.setItem('washcallRoomSubState', 'false');
            const masterBtn = document.getElementById('room-subscribe-button');
            if (masterBtn) {
                masterBtn.textContent = "🔔 빈자리 알림 받기";
                masterBtn.classList.remove('subscribed'); 
            }
            alert("'빈자리 알림'이 꺼지고, '개별 알림'이 켜집니다.");
        }

        const tokenOrStatus = await requestPermissionAndGetToken();
        if (tokenOrStatus === 'denied') throw new Error("알림 차단됨");
        if (tokenOrStatus === null) throw new Error("알림 거부됨");
        
        const token = tokenOrStatus;

        await Promise.all([
            api.registerPushToken(token),
            api.toggleNotifyMe(machineId, true),
            api.startCourse(machineId, 'DRYER')
        ]);
        
        // ❗️ [핵심] 로컬 상태 기록
        card.dataset.isSubscribed = 'true';

        clickedBtn.style.display = 'none'; 
        const notifyMeButton = card.querySelector('.notify-me-during-wash-btn');
        if (notifyMeButton) { 
            notifyMeButton.style.display = 'block';
            notifyMeButton.textContent = '✅ 알림 등록됨';
            notifyMeButton.disabled = true;
        }
        
        setTimeout(() => {
            alert(`건조기 알림이 등록되었습니다.`);
        }, 50);

    } catch (error) {
        console.error("API 실패:", error);
        alert(`시작 실패: ${error.message}`);
        try { await api.toggleNotifyMe(machineId, false); } catch(e) {}
        delete card.dataset.isSubscribed; // 실패 시 제거
        clickedBtn.disabled = false;
        clickedBtn.textContent = '🔔 세탁 시작';
    }
}

function addNotifyMeDuringWashLogic() {
    document.querySelectorAll('.notify-me-during-wash-btn').forEach(button => {
        button.addEventListener('click', async (event) => {
            const btn = event.target;
            const machineId = parseInt(btn.dataset.machineId, 10);
            // 버튼이 있는 카드를 찾음
            const card = btn.closest('.machine-card');

            btn.disabled = true;
            btn.textContent = "요청 중...";

            try {
                const tokenOrStatus = await requestPermissionAndGetToken();
                if (tokenOrStatus === 'denied') throw new Error("알림 차단됨");
                if (tokenOrStatus === null) throw new Error("알림 거부됨");
                
                const token = tokenOrStatus;

                await Promise.all([
                    api.registerPushToken(token),
                    api.toggleNotifyMe(machineId, true)
                ]);
                
                // ❗️ [핵심] 로컬 상태 기록
                if (card) card.dataset.isSubscribed = 'true';

                btn.textContent = '✅ 알림 등록됨';
                
                setTimeout(() => {
                    alert('완료 알림이 등록되었습니다.');
                }, 50);

            } catch (error) {
                console.error("API 오류:", error);
                alert(`알림 등록 실패: ${error.message}`);
                if (card) delete card.dataset.isSubscribed;
                btn.disabled = false;
                btn.textContent = '🔔 완료 알림 받기';
            }
        });
    });
}

function translateStatus(status, machineType = 'washer') {
    switch (status) {
        case 'WASHING': return '세탁 중';
        case 'SPINNING': return '탈수 중';
        case 'DRYING': return '건조 중';
        case 'FINISHED':
            return (machineType === 'dryer') ? '건조 완료' : '세탁 완료'; 
        case 'OFF': return '대기 중';
        default: return status;
    }
}