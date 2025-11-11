// js/main.js
// ❗️ (요청: "알림 받기"와 "코스 선택"을 통합한 최종본)

let connectionStatusElement;

document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
        main();
    }
});

// [수정 없음] main 함수 (tryConnect 호출)
async function main() {
    console.log('WashCall WebApp 시작!');
    connectionStatusElement = document.getElementById('connection-status');
    
    try {
        updateConnectionStatus('connecting'); 
        
        // [수정] 팁 로드(아이디어 2)와 세탁기 목록 로드를 병렬 처리
        const [machines] = await Promise.all([
            api.getInitialMachines(),
            loadCongestionTip() 
        ]);

        renderMachines(machines); 
        tryConnect(); // 웹소켓 연결 시작
    } catch (error) {
        console.error("초기 세탁기 목록 또는 팁 로드 실패:", error);
        updateConnectionStatus('error'); 
    }
}

// [신규] 혼잡도 팁 로드 및 렌더링 (아이디어 2)
async function loadCongestionTip() {
    const tipContainer = document.getElementById('congestion-tip-container');
    if (!tipContainer) return;
    try {
        const tipText = await api.getCongestionTip(); 
        if (tipText) {
            tipContainer.textContent = tipText; 
            tipContainer.style.display = 'flex'; 
        } else {
            tipContainer.style.display = 'none'; 
        }
    } catch (error) {
        console.warn("혼잡도 팁을 불러오는 데 실패했습니다:", error);
        tipContainer.style.display = 'none';
    }
}


// [수정 없음] tryConnect (5초 재연결 로직)
function tryConnect() {
    api.connect(
        () => {
            updateConnectionStatus('success');
        },
        (event) => {
            handleSocketMessage(event); // ❗️ 수정된 함수가 연결됨
        },
        () => {
            updateConnectionStatus('error');
            setTimeout(() => {
                console.log("WebSocket 재연결 시도...");
                tryConnect();
            }, 5000); // 5초
        }
    );
}

// [수정 없음] 연결 상태 UI
function updateConnectionStatus(status) {
    if (!connectionStatusElement) return;
    // ... (기존 코드와 동일) ...
    // (이 함수는 수정할 필요 없습니다)
    connectionStatusElement.className = 'status-alert';
    switch (status) {
        case 'connecting':
            connectionStatusElement.classList.add('info');
            connectionStatusElement.textContent = '서버와 연결을 시도 중...';
            connectionStatusElement.style.opacity = 1;
            break;
        case 'success':
            connectionStatusElement.classList.add('success');
            connectionStatusElement.textContent = '✅ 서버 연결 성공! 실시간 업데이트 중.';
            connectionStatusElement.style.opacity = 1;
            setTimeout(() => {
                connectionStatusElement.style.opacity = 0;
            }, 3000);
            break;
        case 'error':
            connectionStatusElement.classList.add('error');
            connectionStatusElement.textContent = '❌ 서버와의 연결이 끊어졌습니다. 5초 후 재연결 시도...';
            connectionStatusElement.style.opacity = 1;
            break;
    }
}

/**
 * ❗️ [핵심 수정] WebSocket 메시지 처리 
 * (turnOffToggle 제거, 자동 구독 취소 로직 추가)
 */
async function handleSocketMessage(event) {
    try {
        const message = JSON.parse(event.data); 

        // 1. 1분마다 타이머 동기화 (배열 순회)
        if (message.type === 'timer_sync') {
            if (message.machines && Array.isArray(message.machines)) {
                for (const machine of message.machines) {
                    updateMachineCard(machine.machine_id, machine.status, machine.timer);
                }
            }
            return; // timer_sync 메시지는 여기서 처리가 끝남
        }

        // 2. 개별 상태 변경
        const machineId = message.machine_id;
        const newStatus = message.status;
        const newTimer = (message.timer !== undefined) ? message.timer : null; 

        if (message.type === 'room_status' || message.type === 'notify') {
            if (message.type === 'notify') {
                const msg = `세탁기 ${machineId} 상태 변경: ${translateStatus(newStatus)}`;
                alert(msg); 
            }
            updateMachineCard(machineId, newStatus, newTimer); 
        }

        // 3. ❗️ [수정] FINISHED 상태일 때 후처리
        if (newStatus === 'FINISHED') {
            
            // ❗️ [제거] turnOffToggle(machineId, false);
            
            // ❗️ [신규] 서버가 1회성 알림을 처리하지 않는 경우를 대비해,
            // ❗️ 클라이언트가 직접 구독을 취소시킴 (api.toggleNotifyMe(false))
            console.log(`알림 완료: ${machineId}번 세탁기 자동 구독을 취소합니다.`);
            try {
                // (사용자가 이전에 '세탁실 알림'을 켰든 '개별'을 켰든,
                //  FINISHED가 되면 해당 기기의 구독은 끄는 것이 안전함)
                await api.toggleNotifyMe(machineId, false);
            } catch (e) {
                // (실패해도 큰 문제 없음)
                console.warn(`자동 구독 취소 실패 (Machine ${machineId}):`, e.message);
            }
            
            // ❗️ [기존] "세탁실 알림" 버튼 상태 초기화 (버그 수정)
            const STORAGE_KEY = 'washcallRoomSubState';
            if (localStorage.getItem(STORAGE_KEY) === 'true') {
                localStorage.setItem(STORAGE_KEY, 'false'); 
                const masterBtn = document.getElementById('room-subscribe-button');
                if (masterBtn) {
                    masterBtn.textContent = "🔔 세탁실 알림 받기";
                    masterBtn.classList.remove('subscribed'); 
                }
            }
        }

    } catch (error) {
        console.error("WebSocket 메시지 파싱 오류 또는 처리 오류:", error);
    }
}

/**
 * ❗️ [제거] turnOffToggle 함수
 * (더 이상 이 함수를 사용하지 않습니다. handleSocketMessage에 통합됨)
 */
// async function turnOffToggle(machineId, notifyServer) { ... }


/**
 * ❗️ [핵심 수정] updateMachineCard (타이머 로직 '복원')
 */
function updateMachineCard(machineId, newStatus, newTimer) {
    const card = document.getElementById(`machine-${machineId}`);
    if (!card) return; 

    card.className = 'machine-card'; 
    card.classList.add(`status-${newStatus.toLowerCase()}`);

    const statusStrong = card.querySelector('.status-display strong');
    if (statusStrong) {
        statusStrong.textContent = translateStatus(newStatus);
    }

    const timerSpan = card.querySelector('.timer-display span');
    if (timerSpan) {
        timerSpan.textContent = formatTimer(newTimer, newStatus);
    }

    // [수정] 버튼 비활성화/숨김 로직
    const shouldBeDisabled = (newStatus === 'WASHING' || newStatus === 'SPINNING');
    
    // (새 버튼/코스 버튼을 찾음)
    const startButton = card.querySelector('.notify-start-btn');
    const courseButtonsDiv = card.querySelector('.course-buttons');
    const courseButtons = card.querySelectorAll('.course-btn');

    if (shouldBeDisabled) {
        // 1. 작동 중일 때
        if (startButton) startButton.style.display = 'none'; // 시작 버튼 숨김
        if (courseButtonsDiv) courseButtonsDiv.style.display = 'none'; // 코스 버튼 숨김
    } else {
        // 2. 대기/완료 상태일 때
        if (startButton) startButton.style.display = 'block'; // 시작 버튼 보임
        if (courseButtonsDiv) courseButtonsDiv.style.display = 'none'; // ❗️ 코스 버튼은 항상 숨김 (시작 버튼 눌러야 보임)
        // (코스 버튼 자체의 disabled 속성도 초기화)
        courseButtons.forEach(btn => {
            btn.disabled = false;
            btn.textContent = btn.dataset.courseName; 
        });
    }
}

/**
 * ❗️ [핵심 수정] renderMachines (UI 변경)
 */
function renderMachines(machines) {
    const container = document.getElementById('machine-list-container');
    if (!container) return;
    container.innerHTML = '';

    machines.forEach(machine => {
        const machineDiv = document.createElement('div');
        machineDiv.className = 'machine-card';
        machineDiv.classList.add(`status-${machine.status.toLowerCase()}`);
        machineDiv.id = `machine-${machine.machine_id}`; 
        
        const displayTimerText = formatTimer(machine.timer, machine.status);
        
        // ❗️ 작동 중(isDisabled)이면 버튼/코스 모두 숨김 (updateMachineCard 로직과 일치)
        const isDisabled = (machine.status === 'WASHING' || machine.status === 'SPINNING');
        const hideStyle = isDisabled ? 'style="display: none;"' : '';

        const machineDisplayName = machine.machine_name || `세탁기 ${machine.machine_id}`;
        
        // ❗️ [제거] isCurrentlyUsing, checkedAttribute
        // ❗️ [제거] <div class="notify-me-container">...</div>

        machineDiv.innerHTML = `
            <h3>${machineDisplayName}</h3> 
            <div class="status-display">
                상태: <strong id="status-${machine.machine_id}">${translateStatus(machine.status)}</strong>
            </div>
            <div class="timer-display">
                타이머: <span id="timer-${machine.machine_id}">${displayTimerText}</span>
            </div>
            
            <button class="notify-start-btn" data-machine-id="${machine.machine_id}" ${hideStyle}>
                🔔 알림 받고 시작
            </button>
            
            <div class="course-buttons" ${hideStyle}>
                <button class="course-btn" data-machine-id="${machine.machine_id}" data-course-name="표준">표준</button>
                <button class="course-btn" data-machine-id="${machine.machine_id}" data-course-name="강력">강력</button>
                <button class="course-btn" data-machine-id="${machine.machine_id}" data-course-name="쾌속">쾌속</button>
            </div>
        `;
        container.appendChild(machineDiv);
    });

    // ❗️ [수정] 이벤트 리스너 연결
    addNotifyStartLogic(); // ❗️ (신규)
    addCourseButtonLogic();
    // ❗️ [제거] addNotifyMeLogic(); 
}

/**
 * ❗️ [신규] "알림 받고 시작" 버튼 로직 (요청 1)
 */
function addNotifyStartLogic() {
    document.querySelectorAll('.notify-start-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const btn = event.target;
            const card = btn.closest('.machine-card');
            if (!card) return;

            // 1. 코스 버튼 div를 찾아서 .show-courses 클래스 추가 (CSS가 flex로 변경)
            const courseButtonsDiv = card.querySelector('.course-buttons');
            if (courseButtonsDiv) {
                courseButtonsDiv.classList.add('show-courses');
            }
            
            // 2. "알림 받고 시작" 버튼 자신은 숨김
            btn.style.display = 'none';
        });
    });
}


/**
 * ❗️ [핵심 수정] 코스 버튼 로직 (FCM 및 알림 구독 통합)
 */
function addCourseButtonLogic() {
    document.querySelectorAll('.course-btn').forEach(clickedBtn => {
        clickedBtn.onclick = async (event) => { 
            const machineId = parseInt(clickedBtn.dataset.machineId, 10);
            const courseName = clickedBtn.dataset.courseName;
            
            const card = clickedBtn.closest('.machine-card');
            if (!card) return;

            // 1. ❗️ [수정] "취소 안되게" - 모든 코스 버튼 비활성화
            const allButtonsOnCard = card.querySelectorAll('.course-btn');
            allButtonsOnCard.forEach(btn => {
                btn.disabled = true;
                if (btn === clickedBtn) {
                    btn.textContent = "요청 중...";
                }
            });

            try {
                // 2. ❗️ [신규] FCM 토큰 발급 (요청 3)
                // (push.js의 requestPermissionAndGetToken() 함수를 호출)
                const tokenOrStatus = await requestPermissionAndGetToken();

                if (tokenOrStatus === 'denied') {
                    throw new Error("알림이 '차단' 상태입니다.\n\n주소창의 🔒 아이콘을 클릭하여 '알림'을 '허용'으로 변경해주세요.");
                } else if (tokenOrStatus === null) {
                    throw new Error('알림 권한이 거부되었습니다.'); 
                }
                
                // 3. ❗️ [신규] 토큰 등록 및 알림 구독
                const token = tokenOrStatus;
                await api.registerPushToken(token); // (1) 토큰 등록
                await api.toggleNotifyMe(machineId, true); // (2) 이 기계 알림 켜기
                
                // 4. ❗️ [기존] 코스 시작
                const response = await api.startCourse(machineId, courseName); // (3) 세탁 시작
                
                console.log(`API: 코스 시작 및 알림 구독 성공`);
                
                // 5. ❗️ [기존] UI 즉시 업데이트
                updateMachineCard(machineId, "WASHING", response.timer);

                alert(`${courseName} 코스 알림이 등록되었습니다.`);

            } catch (error) {
                // 6. ❗️ [수정] 실패 시 롤백 (버튼/UI 원상복구)
                console.error("API: 코스 시작/알림 등록 실패:", error);
                alert(`시작 실패: ${error.message}`);
                
                allButtonsOnCard.forEach(btn => {
                    btn.disabled = false;
                    btn.textContent = btn.dataset.courseName; 
                });
                
                // (코스 선택창 숨기고 '알림 받고 시작' 버튼 다시 보이게)
                const startButton = card.querySelector('.notify-start-btn');
                if (startButton) startButton.style.display = 'block';
                
                const courseButtonsDiv = card.querySelector('.course-buttons');
                if (courseButtonsDiv) courseButtonsDiv.classList.remove('show-courses');
            }
        };
    });
}


// [수정 없음] 유틸리티: 상태값 한글 번역
function translateStatus(status) {
    switch (status) {
        case 'WASHING': return '세탁 중';
        case 'SPINNING': return '탈수 중';
        case 'FINISHED': return '세탁 완료';
        case 'OFF': return '대기 중';
        default: return status;
    }
}

/**
 * ❗️ [수정] 타이머 표시 헬퍼 함수 (null일 때 "시간 계산 중...")
 */
function formatTimer(timerValue, status) {
    if (status === 'WASHING' || status === 'SPINNING') {
        if (timerValue === null || timerValue === undefined) {
            return '시간 계산 중...'; // ❗️ (수정됨)
        }
        if (timerValue <= 0) {
            return '마무리 중...'; 
        }
        return `약 ${timerValue}분 남음`;
    } else if (status === 'FINISHED') {
        return '세탁 완료!';
    } else { 
        return '대기 중';
    }
}