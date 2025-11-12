// js/main.js
// ❗️ (Error 2, 3이 모두 수정된 최종본)

let connectionStatusElement;

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
            loadCongestionTip() // (아이디어 2)
        ]);

        renderMachines(machines); 
        tryConnect(); 
    } catch (error) {
        console.error("초기 세탁기 목록 또는 팁 로드 실패:", error);
        updateConnectionStatus('error'); 
    }
}

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
    if (!connectionStatusElement) return;
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

async function handleSocketMessage(event) {
    try {
        const message = JSON.parse(event.data); 

        // 1. 1분마다 타이머 동기화 (배열 순회)
        if (message.type === 'timer_sync') {
            if (message.machines && Array.isArray(message.machines)) {
                for (const machine of message.machines) {
                    const isSubscribed = machine.isusing === 1;
                    updateMachineCard(machine.machine_id, machine.status, machine.timer, isSubscribed);
                }
            }
            return; 
        }

        // 2. 개별 상태 변경
        const machineId = message.machine_id;
        const newStatus = message.status;
        const newTimer = (message.timer !== undefined) ? message.timer : null; 
        const isSubscribed = null; 

        if (message.type === 'room_status' || message.type === 'notify') {
            if (message.type === 'notify') {
                const msg = `세탁기 ${machineId} 상태 변경: ${translateStatus(newStatus)}`;
                alert(msg); 
            }
            updateMachineCard(machineId, newStatus, newTimer, isSubscribed); 
        }

        // 3. FINISHED 상태일 때 후처리
        if (newStatus === 'FINISHED') {
            
            console.log(`알림 완료: ${machineId}번 세탁기 자동 구독을 취소합니다.`);
            try {
                await api.toggleNotifyMe(machineId, false);
            } catch (e) {
                console.warn(`자동 구독 취소 실패 (Machine ${machineId}):`, e.message);
            }
            
            const STORAGE_KEY = 'washcallRoomSubState';
            if (localStorage.getItem(STORAGE_KEY) === 'true') {
                localStorage.setItem(STORAGE_KEY, 'false'); 
                const masterBtn = document.getElementById('room-subscribe-button');
                if (masterBtn) {
                    // ❗️ [이름 수정]
                    masterBtn.textContent = "🔔 빈자리 알림 받기"; 
                    masterBtn.classList.remove('subscribed'); 
                }
            }
        }

    } catch (error) {
        console.error("WebSocket 메시지 파싱 오류 또는 처리 오류:", error);
    }
}


/**
 * ❗️ [핵심 수정] updateMachineCard (버그 수정)
 * (isSubscribed 상태에 따라 B버튼의 텍스트/활성화/숨김을 제어)
 */
function updateMachineCard(machineId, newStatus, newTimer, isSubscribed) {
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

    const timerDiv = card.querySelector('.timer-display');
    const timerSpan = card.querySelector('.timer-display span');

    if (newStatus === 'SPINNING' || newStatus === 'DRYING') {
        if (timerDiv) timerDiv.style.display = 'block'; 
        if (timerSpan) {
            timerSpan.textContent = formatTimer(newTimer, newStatus, machineType);
        }
    } else {
        if (timerDiv) timerDiv.style.display = 'none';
    }

    const shouldBeDisabled = (newStatus === 'WASHING' || newStatus === 'SPINNING' || newStatus === 'DRYING');
    
    const startButton = card.querySelector('.notify-start-btn');
    const courseButtonsDiv = card.querySelector('.course-buttons');
    const notifyMeButton = card.querySelector('.notify-me-during-wash-btn');
    const courseButtons = card.querySelectorAll('.course-btn');

    if (shouldBeDisabled) {
        // 1. 작동 중일 때 (시나리오 B 판단)
        if (startButton) startButton.style.display = 'none'; 
        if (courseButtonsDiv) courseButtonsDiv.style.display = 'none'; 
        
        if (notifyMeButton) {
            // ❗️ [버그 수정] B 버튼을 '항상' 표시 (display = 'block')
            notifyMeButton.style.display = 'block'; 

            // ❗️ (isSubscribed가 null이면 기존 상태를 유지하기 위해 체크)
            if (isSubscribed === false) { 
                // 구독 안 함: "완료 알림 받기" 활성화
                notifyMeButton.textContent = '🔔 완료 알림 받기';
                notifyMeButton.disabled = false;
            } else if (isSubscribed === true) {
                // ❗️ [버그 수정] 구독 함: "알림 등록됨" 비활성화
                notifyMeButton.textContent = '✅ 알림 등록됨';
                notifyMeButton.disabled = true;
            }
            // (isSubscribed가 null이면(예: room_status) 텍스트/활성화 상태 변경 안 함)
        }
        
    } else {
        // 2. 대기/완료 상태일 때 (시나리오 A 리셋)
        if (machineType === 'washer') {
            if (startButton) startButton.style.display = 'block'; 
            if (courseButtonsDiv) {
                courseButtonsDiv.classList.remove('show-courses'); 
                courseButtonsDiv.style.display = ''; 
            }
            if (courseButtons) {
                courseButtons.forEach(btn => {
                    btn.disabled = false; 
                    btn.textContent = btn.dataset.courseName; 
                });/**
 * ❗️ [핵심 수정] updateMachineCard (사용자 요청 반영)
 * (WASHING 상태일 때도 A버튼(코스)을 표시. B버튼(notify-me-during-wash-btn) 제거)
 */
function updateMachineCard(machineId, newStatus, newTimer, isSubscribed) {
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

    const timerDiv = card.querySelector('.timer-display');
    const timerSpan = card.querySelector('.timer-display span');

    if (newStatus === 'SPINNING' || newStatus === 'DRYING') {
        if (timerDiv) timerDiv.style.display = 'block'; 
        if (timerSpan) {
            timerSpan.textContent = formatTimer(newTimer, newStatus, machineType);
        }
    } else {
        if (timerDiv) timerDiv.style.display = 'none';
    }

    // ❗️ [수정] A버튼 숨김 조건: 탈수/건조 중이거나, 건조기일 때
    const hideScenario_A = (newStatus === 'SPINNING' || newStatus === 'DRYING') || (machineType === 'dryer');
    
    const startButton = card.querySelector('.notify-start-btn');
    const courseButtonsDiv = card.querySelector('.course-buttons');
    const notifyMeButton = card.querySelector('.notify-me-during-wash-btn'); // (숨김 처리용)
    const courseButtons = card.querySelectorAll('.course-btn');

    if (hideScenario_A) {
        // 1. 탈수/건조 중일 때 (A 버튼 숨김)
        if (startButton) startButton.style.display = 'none'; 
        if (courseButtonsDiv) courseButtonsDiv.style.display = 'none'; 
        if (notifyMeButton) notifyMeButton.style.display = 'none'; // (B 버튼도 숨김)
        
    } else {
        // 2. ❗️ 대기/완료/세탁(WASHING) 상태일 때 (A 버튼 표시 및 리셋)
        if (startButton) startButton.style.display = 'block'; 
        if (courseButtonsDiv) {
            courseButtonsDiv.classList.remove('show-courses'); 
            courseButtonsDiv.style.display = ''; 
        }
        if (notifyMeButton) notifyMeButton.style.display = 'none'; 
        
        if (courseButtons) {
            courseButtons.forEach(btn => {
                btn.disabled = false; 
                btn.textContent = btn.dataset.courseName; 
            });
        }
    }
}
            }
        } else {
            if (startButton) startButton.style.display = 'none'; 
            if (courseButtonsDiv) courseButtonsDiv.style.display = 'none'; 
        }
        
        if (notifyMeButton) notifyMeButton.style.display = 'none'; 
    }
}

/**
 * ❗️ [핵심 수정] renderMachines (사용자 요청 반영)
 * (WASHING 상태일 때도 A버튼(코스)을 표시. B버튼(notify-me-during-wash-btn) 제거)
 */
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
        
        const shouldShowTimer = (machine.status === 'SPINNING' || machine.status === 'DRYING');
        const timerDivStyle = shouldShowTimer ? '' : 'style="display: none;"';
        const displayTimerText = shouldShowTimer ? formatTimer(machine.timer, machine.status, machineType) : '';

        // ❗️ [수정] A버튼 숨김 조건: 탈수/건조 중이거나, 건조기일 때
        const hideScenario_A = (machine.status === 'SPINNING' || machine.status === 'DRYING') || (machineType === 'dryer');
        const showScenario_A = !hideScenario_A;

        const machineDisplayName = machine.machine_name || `기기 ${machine.machine_id}`;
        
        machineDiv.innerHTML = `
            <h3>${machineDisplayName}</h3> 
            <div class="status-display">
                상태: <strong id="status-${machine.machine_id}">${translateStatus(machine.status, machineType)}</strong>
            </div>
            
            <div class="timer-display" ${timerDivStyle}>
                타이머: <span id="timer-${machine.machine_id}">${displayTimerText}</span>
            </div>
            
            <button class="notify-start-btn" data-machine-id="${machine.machine_id}" ${showScenario_A ? '' : 'style="display: none;"'}>
                🔔 알림 받고 시작
            </button>
            <div class="course-buttons" ${showScenario_A ? '' : 'style="display: none;"'}>
                <button class="course-btn" data-machine-id="${machine.machine_id}" data-course-name="표준">표준</button>
                <button class="course-btn" data-machine-id="${machine.machine_id}" data-course-name="강력">강력</button>
                <button class="course-btn" data-machine-id="${machine.machine_id}" data-course-name="쾌속">쾌속</button>
            </div>

            `;
        container.appendChild(machineDiv);
    });

    // 이벤트 리스너 연결
    addNotifyStartLogic(); 
    addCourseButtonLogic(); 
    // ❗️ [제거] addNotifyMeDuringWashLogic(); 
}

/**
 * ❗️ [수정] "알림 받고 시작" 버튼 로직 (세로 정렬용)
 */
function addNotifyStartLogic() {
    document.querySelectorAll('.notify-start-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const btn = event.target;
            const card = btn.closest('.machine-card');
            if (!card) return;
            const courseButtonsDiv = card.querySelector('.course-buttons');
            
            if (courseButtonsDiv) {
                // ❗️ 'show-courses' 클래스 (CSS가 display: flex/column 적용)
                courseButtonsDiv.classList.add('show-courses');
            }
            btn.style.display = 'none'; // ❗️ '시작' 버튼은 숨김
        });
    });
}


/**
 * ❗️ [핵심 수정] 코스 버튼 로직 (시나리오 A)
 * ('빈자리 알림' 텍스트 및 CSS 클래스 수정)
 */
function addCourseButtonLogic() {
    document.querySelectorAll('.course-btn').forEach(clickedBtn => {
        clickedBtn.onclick = async (event) => { 
            const machineId = parseInt(clickedBtn.dataset.machineId, 10);
            const courseName = clickedBtn.dataset.courseName;
            
            const card = clickedBtn.closest('.machine-card');
            if (!card) return;

            // 1. "취소 안되게"
            const allButtonsOnCard = card.querySelectorAll('.course-btn');
            allButtonsOnCard.forEach(btn => {
                btn.disabled = true;
                if (btn === clickedBtn) {
                    btn.textContent = "요청 중...";
                }
            });

            try {
                // ❗️ [수정] '빈자리 알림' (마스터 버튼) 끄기
                const roomSubState = localStorage.getItem('washcallRoomSubState');
                if (roomSubState === 'true') {
                    console.log("중복 방지: '빈자리 알림'을 끕니다.");
                    
                    // 1. API 끄기 (모든 기기에 대해)
                    const allToggles = document.querySelectorAll('.notify-me-during-wash-btn, .notify-start-btn'); // (모든 기기 ID 확보용)
                    const tasks = [];
                    allToggles.forEach(t => {
                        const mid = parseInt(t.dataset.machineId, 10);
                        if (mid) tasks.push(api.toggleNotifyMe(mid, false));
                    });
                    await Promise.all(tasks);
                    
                    // 2. localStorage 끄기
                    localStorage.setItem('washcallRoomSubState', 'false');
                    
                    // 3. 마스터 버튼 UI 끄기 (텍스트 및 CSS 수정)
                    const masterBtn = document.getElementById('room-subscribe-button');
                    if (masterBtn) {
                        masterBtn.textContent = "🔔 빈자리 알림 받기";
                        masterBtn.classList.remove('subscribed'); // ❗️ CSS 클래스 제거
                    }
                    
                    alert("'빈자리 알림'이 꺼지고, '개별 알림'이 켜집니다.");
                }

                // 2. FCM 토큰 발급 (push.js 함수 호출)
                const tokenOrStatus = await requestPermissionAndGetToken();
                if (tokenOrStatus === 'denied') {
                    throw new Error("알림이 '차단' 상태입니다. 🔒 아이콘을 클릭하여 '허용'으로 변경해주세요.");
                } else if (tokenOrStatus === null) {
                    throw new Error('알림 권한이 거부되었습니다.'); 
                }
                
                // 3. 토큰 등록 및 알림 구독
                const token = tokenOrStatus;
                await api.registerPushToken(token); 
                await api.toggleNotifyMe(machineId, true); 
                
                // 4. 코스 시작 (서버에 코스 이름만 전송)
                await api.startCourse(machineId, courseName); 
                
                console.log(`API: 코스 시작 및 알림 구독 성공 (서버가 /update를 보낼 때까지 대기)`);
                
                // 5. ❗️ (수정) UI 즉시 변경 안 함
                clickedBtn.textContent = '✅ 알림 등록됨';

                alert(`${courseName} 코스 알림이 등록되었습니다.`);

            } catch (error) {
                // 6. 실패 시 롤백
                console.error("API: 코스 시작/알림 등록 실패:", error);
                alert(`시작 실패: ${error.message}`);
                
                allButtonsOnCard.forEach(btn => {
                    btn.disabled = false;
                    btn.textContent = btn.dataset.courseName; 
                });
                
                const startButton = card.querySelector('.notify-start-btn');
                if (startButton) startButton.style.display = 'block';
                const courseButtonsDiv = card.querySelector('.course-buttons');
                if (courseButtonsDiv) courseButtonsDiv.classList.remove('show-courses');
            }
        };
    });
}

// [수정] 유틸리티: 상태값 한글 번역 (DRYING 추가)
function translateStatus(status) {
    switch (status) {
        case 'WASHING': return '세탁 중';
        case 'SPINNING': return '탈수 중';
        case 'DRYING': return '건조 중'; // ❗️ [신규] 건조기 상태
        case 'FINISHED': return '완료'; // (세탁/건조 공통)
        case 'OFF': return '대기 중';
        default: return status;
    }
}

/**
 * ❗️ [핵심 수정] 타이머 표시 헬퍼 함수
 * (요청: 'SPINNING' 또는 'DRYING'일 때만 타이머 표시)
 */
function formatTimer(timerValue, status) {
    
    // ❗️ [수정] 탈수 또는 건조 중일 때
    if (status === 'SPINNING' || status === 'DRYING') {
        if (timerValue === null || timerValue === undefined) {
            return '시간 계산 중...'; 
        }
        if (timerValue <= 0) {
            return '마무리 중...'; 
        }
        return `약 ${timerValue}분 남음`;
    }
    
    // 그 외 모든 상태(WASHING, FINISHED, OFF)는 빈 텍스트 반환
    return ''; 
}