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
 * ❗️ [핵심 수정] updateMachineCard (건조기/세탁기 UI 분리)
 */
function updateMachineCard(machineId, newStatus, newTimer, isSubscribed) {
    const card = document.getElementById(`machine-${machineId}`);
    if (!card) return; 

    // ❗️ [신규] 카드의 machine-type 읽기
    const machineType = card.dataset.machineType || 'washer';

    card.className = 'machine-card'; 
    card.classList.add(machineType === 'dryer' ? 'machine-type-dryer' : 'machine-type-washer'); // ❗️ 타입 클래스 유지
    card.classList.add(`status-${newStatus.toLowerCase()}`); // ❗️ 새 상태 클래스

    const statusStrong = card.querySelector('.status-display strong');
    if (statusStrong) {
        statusStrong.textContent = translateStatus(newStatus);
    }

    const timerDiv = card.querySelector('.timer-display');
    const timerSpan = card.querySelector('.timer-display span');

    // ❗️ [수정] 탈수 또는 건조 중일 때
    if (newStatus === 'SPINNING' || newStatus === 'DRYING') {
        if (timerDiv) timerDiv.style.display = 'block'; 
        if (timerSpan) {
            timerSpan.textContent = formatTimer(newTimer, newStatus);
        }
    } else {
        // (세탁, 완료, 대기)
        if (timerDiv) timerDiv.style.display = 'none';
    }

    // [수정] 버튼 비활성화/숨김 로직
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
            // (isSubscribed가 null이면 기존 상태를 유지하기 위해 체크)
            if (isSubscribed === false) { 
                notifyMeButton.style.display = 'block'; 
                notifyMeButton.textContent = '🔔 완료 알림 받기';
                notifyMeButton.disabled = false;
            } else if (isSubscribed === true) {
                // (시나리오 A로 시작했거나, B를 눌렀을 때)
                notifyMeButton.style.display = 'none'; // ❗️ 이미 구독했으면 숨김
            }
            // (isSubscribed가 null이면(예: room_status) 아무것도 안함)
        }
        
    } else {
        // 2. 대기/완료 상태일 때 (시나리오 A 리셋)
        
        // ❗️ [수정] 세탁기일 때만 A버튼 보임
        if (machineType === 'washer') {
            if (startButton) startButton.style.display = 'block'; 
            if (courseButtonsDiv) {
                courseButtonsDiv.classList.remove('show-courses'); 
                courseButtonsDiv.style.display = ''; 
            }
            // (버튼 리셋)
            if (courseButtons) {
                courseButtons.forEach(btn => {
                    btn.disabled = false; 
                    btn.textContent = btn.dataset.courseName; 
                });
            }
        } else {
            // ❗️ 건조기는 OFF일 때 아무 버튼도 보이지 않음
            if (startButton) startButton.style.display = 'none'; 
            if (courseButtonsDiv) courseButtonsDiv.style.display = 'none'; 
        }
        
        if (notifyMeButton) notifyMeButton.style.display = 'none'; 
    }
}

/**
 * ❗️ [핵심 수정] renderMachines (건조기/세탁기 UI 분리)
 */
function renderMachines(machines) {
    const container = document.getElementById('machine-list-container');
    if (!container) return;
    container.innerHTML = '';

    machines.forEach(machine => {
        const machineDiv = document.createElement('div');
        
        // ❗️ [신규] machine_type 읽기
        const machineType = machine.machine_type || 'washer'; // (기본값 washer)
        
        machineDiv.className = 'machine-card';
        machineDiv.classList.add(`status-${machine.status.toLowerCase()}`);
        
        // ❗️ [신규] CSS 아이콘/색상을 위한 클래스 및 data 속성 추가
        machineDiv.classList.add(machineType === 'dryer' ? 'machine-type-dryer' : 'machine-type-washer');
        machineDiv.dataset.machineType = machineType; // ❗️ update를 위해 타입 저장
        
        machineDiv.id = `machine-${machine.machine_id}`; 
        
        // ❗️ [신규] 탈수/건조 상태인지 확인
        const shouldShowTimer = (machine.status === 'SPINNING' || machine.status === 'DRYING');
        const timerDivStyle = shouldShowTimer ? '' : 'style="display: none;"';
        const displayTimerText = shouldShowTimer ? formatTimer(machine.timer, machine.status) : '';

        // (공통)
        const isDisabled = (machine.status === 'WASHING' || machine.status === 'SPINNING' || machine.status === 'DRYING');
        const isSubscribed = (machine.isusing === 1);
        
        // (시나리오 B용)
        const scenarioB_DisabledAttr = isSubscribed ? 'disabled' : '';
        const scenarioB_Text = isSubscribed ? '✅ 알림 등록됨' : '🔔 완료 알림 받기';

        // ❗️ [수정] 시나리오 A/B 버튼 보임/숨김 로직
        let showScenario_A = (!isDisabled && machineType === 'washer'); // ❗️ A는 세탁기+OFF일때만
        let showScenario_B = (isDisabled && isSubscribed === false);    // ❗️ B는 작동중+미구독시

        const machineDisplayName = machine.machine_name || `기기 ${machine.machine_id}`;
        
        machineDiv.innerHTML = `
            <h3>${machineDisplayName}</h3> 
            <div class="status-display">
                상태: <strong id="status-${machine.machine_id}">${translateStatus(machine.status)}</strong>
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

            <button class="notify-me-during-wash-btn" data-machine-id="${machine.machine_id}" ${showScenario_B ? '' : 'style="display: none;"'} ${scenarioB_DisabledAttr}>
                ${scenarioB_Text}
            </button>
        `;
        container.appendChild(machineDiv);
    });

    // 이벤트 리스너 연결
    addNotifyStartLogic(); 
    addCourseButtonLogic(); 
    addNotifyMeDuringWashLogic(); 
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

/**
 * ❗️ [신규] "완료 알림 받기" 버튼 로직 (시나리오 B)
 */
function addNotifyMeDuringWashLogic() {
    document.querySelectorAll('.notify-me-during-wash-btn').forEach(button => {
        button.addEventListener('click', async (event) => {
            const btn = event.target;
            const machineId = parseInt(btn.dataset.machineId, 10);

            btn.disabled = true;
            btn.textContent = "요청 중...";

            try {
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

                // 4. (성공) UI 업데이트
                btn.textContent = '✅ 알림 등록됨';
                // (disabled=true 상태 유지)

                alert('완료 알림이 등록되었습니다.');

            } catch (error) {
                // 5. (실패) 롤백
                console.error("API: '세탁 중' 알림 등록 실패:", error);
                alert(`알림 등록 실패: ${error.message}`);
                btn.disabled = false;
                btn.textContent = '🔔 완료 알림 받기';
            }
        });
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