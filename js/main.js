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

    card.className = 'machine-card'; 
    card.classList.add(machineType === 'dryer' ? 'machine-type-dryer' : 'machine-type-washer'); 
    card.classList.add(`status-${newStatus.toLowerCase()}`); 

    const statusStrong = card.querySelector('.status-display strong');
    if (statusStrong) {
        statusStrong.textContent = translateStatus(newStatus, machineType);
    }

    // --- 타이머 로직 ---
    const timerDiv = card.querySelector('.timer-display');
    const timerTotalSpan = card.querySelector(`#timer-total-${machineId}`);
    const timerElapsedSpan = card.querySelector(`#timer-elapsed-${machineId}`);

    const isOperating = (newStatus === 'WASHING' || newStatus === 'SPINNING' || newStatus === 'DRYING');

    const hasTimer = (newTimer !== null && typeof newTimer === 'number');
    const hasElapsed = (newElapsedMinutes !== null && typeof newElapsedMinutes === 'number' && newElapsedMinutes >= 0);
    let totalTime = (hasTimer && hasElapsed) ? (newElapsedMinutes + newTimer) : null;

    const shouldShowTimer = isOperating && (totalTime !== null && totalTime > 0);

    if (shouldShowTimer && timerDiv && timerTotalSpan && timerElapsedSpan) {
        timerDiv.style.display = 'block';
        timerTotalSpan.textContent = `약 ${totalTime}분`;
        
        let elapsedText = `${newElapsedMinutes}분 진행`;
        if (newStatus === 'SPINNING' && newElapsedMinutes === 0) {
            elapsedText = `0분 진행 (탈수)`;
        }
        timerElapsedSpan.textContent = elapsedText;

    } else if (timerDiv) {
        timerDiv.style.display = 'none';
    }

    const shouldBeDisabled = isOperating;
    
    const startButton = card.querySelector('.notify-start-btn');
    const courseButtonsDiv = card.querySelector('.course-buttons'); // (모달 방식이라 사용 안 할 수도 있지만 유지)
    const notifyMeButton = card.querySelector('.notify-me-during-wash-btn');

    // ❗️ [핵심 수정] 구독 상태 결정 로직 강화
    let finalIsSubscribed = false;

    if (isSubscribed === true) {
        // 1. 서버가 "구독 중"이라고 명시함 -> 로컬에도 저장
        finalIsSubscribed = true;
        card.dataset.isSubscribed = 'true';
    } else if (isSubscribed === false) {
        // 2. 서버가 "구독 안 함"이라고 명시함 -> 로컬 삭제
        finalIsSubscribed = false;
        delete card.dataset.isSubscribed;
    } else {
        // 3. 서버가 정보를 안 줌(null) -> 로컬 저장소(dataset) 확인 (UI 보호)
        if (card.dataset.isSubscribed === 'true') {
            finalIsSubscribed = true;
        } else {
            finalIsSubscribed = false;
        }
    }

    // --- 버튼 표시 로직 (finalIsSubscribed 사용) ---
    if (finalIsSubscribed) {
        // [구독 중]
        if (startButton) startButton.style.display = 'none'; 
        if (courseButtonsDiv) courseButtonsDiv.style.display = 'none'; 
        if (notifyMeButton) {
            notifyMeButton.style.display = 'block'; 
            notifyMeButton.textContent = '✅ 알림 등록됨';
            notifyMeButton.disabled = true;
        }
    } else {
        // [구독 안 함]
        if (shouldBeDisabled) {
             // 작동 중 -> 완료 알림 받기 버튼
             if (startButton) startButton.style.display = 'none';
             if (notifyMeButton) {
                notifyMeButton.style.display = 'block';
                notifyMeButton.textContent = '🔔 완료 알림 받기';
                notifyMeButton.disabled = false;
             }
        } else {
            // 대기 중 -> 세탁 시작 버튼
            if (notifyMeButton) notifyMeButton.style.display = 'none';
            if (startButton) startButton.style.display = 'block';
        }
    }
}

function renderMachines(machines) {
    const container = document.getElementById('machine-list-container');
    if (!container) return;
    container.innerHTML = '';

    machines.forEach(machine => {
        const machineDiv = document.createElement('div');
        const machineType = machine.machine_type || 'washer'; 
        
        machineDiv.className = 'machine-card';
        machineDiv.classList.add(`status-${machine.status.toLowerCase()}`);
        machineDiv.classList.add(machineType === 'dryer' ? 'machine-type-dryer' : 'machine-type-washer');
        machineDiv.dataset.machineType = machineType; 
        machineDiv.id = `machine-${machine.machine_id}`; 
        
        // ❗️ [초기화] 서버에서 받은 구독 정보 저장
        if (machine.isusing === 1) {
            machineDiv.dataset.isSubscribed = 'true';
        }

        // --- 타이머 계산 ---
        const isOperating = (machine.status === 'WASHING' || machine.status === 'SPINNING' || machine.status === 'DRYING');
        const timerRemaining = machine.timer; 
        const elapsedMinutes = machine.elapsed_time_minutes;
        
        const hasTimer = (timerRemaining !== null && typeof timerRemaining === 'number');
        const hasElapsed = (elapsedMinutes !== null && typeof elapsedMinutes === 'number' && elapsedMinutes >= 0);
        let totalTime = (hasTimer && hasElapsed) ? (elapsedMinutes + timerRemaining) : null;

        const shouldShowTimer = isOperating && (totalTime !== null && totalTime > 0);
        const timerDivStyle = shouldShowTimer ? '' : 'style="display: none;"';
        const displayTotalTime = shouldShowTimer ? `약 ${totalTime}분` : '';
        const displayElapsedTime = shouldShowTimer ? `${elapsedMinutes}분 진행` : '';
        
        // --- 버튼 초기 상태 ---
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
        const scenarioB_Text = isSubscribed ? '✅ 알림 등록됨' : '🔔 완료 알림 받기';

        const machineDisplayName = machine.machine_name || `기기 ${machine.machine_id}`;
        
        machineDiv.innerHTML = `
            <h3>${machineDisplayName}</h3> 
            <div class="status-display">
                상태: <strong id="status-${machine.machine_id}">${translateStatus(machine.status, machineType)}</strong>
            </div>
            
            <div class="timer-display" ${timerDivStyle}>
                <div class="timer-row total-time">
                    <span>총 예상:</span>
                    <span id="timer-total-${machine.machine_id}">${displayTotalTime}</span>
                </div>
                <div class="timer-row">
                    <span>진행 시간:</span>
                    <span id="timer-elapsed-${machine.machine_id}">${displayElapsedTime}</span>
                </div>
            </div>
            
            <button class="notify-start-btn" data-machine-id="${machine.machine_id}" ${showStartButton ? '' : 'style="display: none;"'}>
                🔔 세탁 시작
            </button>

            <button class="notify-me-during-wash-btn" data-machine-id="${machine.machine_id}" ${showScenario_B ? '' : 'style="display: none;"'} ${scenarioB_DisabledAttr}>
                ${scenarioB_Text}
            </button>
        `;
        container.appendChild(machineDiv);
    });

    addNotifyStartLogic(); 
    addNotifyMeDuringWashLogic(); 
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
            const btn = event.target;
            const card = btn.closest('.machine-card');
            if (!card) return;

            const machineId = parseInt(btn.dataset.machineId, 10);
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