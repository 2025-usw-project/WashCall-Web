// js/main.js
// ❗️ (타이머 UI에서 '남은 시간'을 제거한 최종 수정본)

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
        
        // ❗️ [필수] /load API가 'elapsed_time_minutes'를 반환해야 함
        const [machines] = await Promise.all([
            api.getInitialMachines(),
            loadCongestionTip() 
        ]);

        renderMachines(machines); 
        tryConnect(); 
    } catch (error) {
        console.error("초기 세탁기 목록 또는 팁 로드 실패:", error);
        updateConnectionStatus('error'); 
    }
}

async function loadCongestionTip() {
    // ... (이전과 동일) ...
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
        // ... (이전과 동일) ...
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
    // ... (이전과 동일) ...
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

        // ❗️ [수정] WebSocket이 'elapsed_time_minutes'를 보내도록 수정되어야 함
        if (message.type === 'timer_sync') {
            if (message.machines && Array.isArray(message.machines)) {
                for (const machine of message.machines) {
                    const isSubscribed = machine.isusing === 1;
                    updateMachineCard(
                        machine.machine_id, 
                        machine.status, 
                        machine.timer, // 남은 시간 (총 시간 계산용)
                        isSubscribed,
                        machine.elapsed_time_minutes // ❗️ 경과 시간
                    );
                }
            }
            return; 
        }

        const machineId = message.machine_id;
        const newStatus = message.status;
        const newTimer = (message.timer !== undefined) ? message.timer : null; 
        const isSubscribed = null; 
        
        // ❗️ [수정] 경과 시간 추출
        const newElapsedMinutes = message.elapsed_time_minutes;

        if (message.type === 'room_status' || message.type === 'notify') {
            const card = document.getElementById(`machine-${machineId}`);
            const machineType = card ? (card.dataset.machineType || 'washer') : 'washer';

            if (message.type === 'notify') {
                const msg = `세탁기 ${machineId} 상태 변경: ${translateStatus(newStatus, machineType)}`;
                alert(msg); 
            }
            
            // ❗️ [수정] 새 인자 전달
            updateMachineCard(machineId, newStatus, newTimer, isSubscribed, newElapsedMinutes); 
        }

        if (newStatus === 'FINISHED') {
            // ... (이전과 동일) ...
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
 * ❗️ [수정] updateMachineCard ('남은 시간' 제거)
 * (newElapsedMinutes 인자 추가)
 */
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

    // --- ❗️ [수정] 타이머 로직 ('남은 시간' 제거) ---
    const timerDiv = card.querySelector('.timer-display');
    const timerTotalSpan = card.querySelector(`#timer-total-${machineId}`);
    const timerElapsedSpan = card.querySelector(`#timer-elapsed-${machineId}`);
    // ❗️ [삭제] const timerRemainingSpan = card.querySelector(`#timer-remaining-${machineId}`);

    const isOperating = (newStatus === 'WASHING' || newStatus === 'SPINNING' || newStatus === 'DRYING');

    if (isOperating && timerDiv && timerTotalSpan && timerElapsedSpan) { // ❗️ timerRemainingSpan 제거
        timerDiv.style.display = 'block';
        
        // 1. 총 예상 시간 (경과 시간 + 남은 시간)
        let totalTime = null;
        if (newTimer !== null && newElapsedMinutes !== null) {
            totalTime = newElapsedMinutes + newTimer;
        }
        const totalText = (totalTime !== null && totalTime > 0) ? `약 ${totalTime}분` : '계산 중...';
        timerTotalSpan.textContent = totalText;

        // 2. 진행 시간
        let elapsedText = '계산 중...';
        if (newElapsedMinutes !== null && newElapsedMinutes >= 0) {
            elapsedText = `${newElapsedMinutes}분 진행`;
        }
        timerElapsedSpan.textContent = elapsedText;
        
        // 3. ❗️ [삭제] '남은 시간' 관련 로직
        // timerRemainingSpan.textContent = formatTimer(newTimer, newStatus, machineType);

    } else if (timerDiv) {
        timerDiv.style.display = 'none'; // 작동 중이 아니면 숨김
    }
    // --- ❗️ 타이머 로직 끝 ---

    const shouldBeDisabled = isOperating;
    
    // ... (이하 버튼 로직은 이전과 동일) ...
    const startButton = card.querySelector('.notify-start-btn');
    const courseButtonsDiv = card.querySelector('.course-buttons');
    const notifyMeButton = card.querySelector('.notify-me-during-wash-btn');
    const courseButtons = card.querySelectorAll('.course-btn');

    if (shouldBeDisabled) {
        // 1. 작동 중일 때
        if (startButton) startButton.style.display = 'none'; 
        if (courseButtonsDiv) courseButtonsDiv.style.display = 'none'; 
        
        if (notifyMeButton) {
            notifyMeButton.style.display = 'block'; 
            if (isSubscribed === false) { 
                notifyMeButton.textContent = '🔔 완료 알림 받기';
                notifyMeButton.disabled = false;
            } else if (isSubscribed === true) {
                notifyMeButton.textContent = '✅ 알림 등록됨';
                notifyMeButton.disabled = true;
            }
        }
        
    } else {
        // 2. 대기/완료 상태일 때
        if (startButton) startButton.style.display = 'block'; 

        if (machineType === 'washer') {
            if (courseButtonsDiv) {
                courseButtonsDiv.classList.remove('show-courses'); 
                courseButtonsDiv.style.display = ''; 
            }
            if (courseButtons) {
                courseButtons.forEach(btn => {
                    btn.disabled = false; 
                    btn.textContent = btn.dataset.courseName; 
                });
            }
        } else {
            if (courseButtonsDiv) courseButtonsDiv.style.display = 'none'; 
        }
        
        if (notifyMeButton) notifyMeButton.style.display = 'none'; 
    }
}

/**
 * ❗️ [수정] renderMachines (새 타이머 HTML 구조 적용)
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
        
        // --- ❗️ [수정] 타이머 텍스트 계산 ('남은 시간' 제거) ---
        const isOperating = (machine.status === 'WASHING' || machine.status === 'SPINNING' || machine.status === 'DRYING');
        const timerDivStyle = isOperating ? '' : 'style="display: none;"';
        
        const timerRemaining = machine.timer;  // (남은 시간)
        const elapsedMinutes = machine.elapsed_time_minutes; // ❗️ (서버가 보내줘야 함)
        
        let totalTime = null;
        if (timerRemaining !== null && elapsedMinutes !== null) {
            totalTime = elapsedMinutes + timerRemaining;
        }

        const displayTotalTime = (totalTime !== null && totalTime > 0) ? `약 ${totalTime}분` : '계산 중...';
        const displayElapsedTime = (elapsedMinutes !== null && elapsedMinutes >= 0) ? `${elapsedMinutes}분 진행` : '계산 중...';
        // ❗️ [삭제] const displayTimerText = formatTimer(timerRemaining, machine.status, machineType);
        // --- ❗️ 계산 끝 ---

        const isDisabled = isOperating;
        const isSubscribed = (machine.isusing === 1);
        
        const scenarioB_DisabledAttr = isSubscribed ? 'disabled' : '';
        const scenarioB_Text = isSubscribed ? '✅ 알림 등록됨' : '🔔 완료 알림 받기';

        const showScenario_B = (isDisabled);
        const showStartButton = (!isDisabled);
        const showCourseButtons = (!isDisabled && machineType === 'washer');

        const machineDisplayName = machine.machine_name || `기기 ${machine.machine_id}`;
        
        // --- ❗️ [수정] HTML 템플릿 ('남은 시간' 제거) ---
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
                🔔 알림 받고 시작
            </button>
            <div class="course-buttons" ${showCourseButtons ? '' : 'style="display: none;"'}>
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

    // 이벤트 리스너 연결 (이전과 동일)
    addNotifyStartLogic(); 
    addCourseButtonLogic(); 
    addNotifyMeDuringWashLogic(); 
}

/**
 * ❗️ [수정] "알림 받고 시작" 버튼 로직 (롤백 버그 수정)
 */
function addNotifyStartLogic() {
    document.querySelectorAll('.notify-start-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const btn = event.target;
            const card = btn.closest('.machine-card');
            if (!card) return;

            const machineType = card.dataset.machineType || 'washer';
            
            if (machineType === 'washer') {
                const courseButtonsDiv = card.querySelector('.course-buttons');
                if (courseButtonsDiv) {
                    courseButtonsDiv.classList.add('show-courses');
                }
                btn.style.display = 'none'; 
            } else {
                handleDryerStart(btn, card);
            }
        });
    });
}

/**
 * ❗️ [수정] 건조기 시작 로직 (롤백 버그 수정)
 */
async function handleDryerStart(clickedBtn, card) {
    const machineId = parseInt(clickedBtn.dataset.machineId, 10);
    if (!machineId) return;

    clickedBtn.disabled = true;
    clickedBtn.textContent = "요청 중...";

    try {
        // ... (빈자리 알림 끄기 로직 - 이전과 동일) ...
        const roomSubState = localStorage.getItem('washcallRoomSubState');
        if (roomSubState === 'true') {
            console.log("중복 방지: '빈자리 알림'을 끕니다.");
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

        // ... (FCM 토큰 발급 - 이전과 동일) ...
        const tokenOrStatus = await requestPermissionAndGetToken();
        if (tokenOrStatus === 'denied') {
            throw new Error("알림이 '차단' 상태입니다. 🔒 아이콘을 클릭하여 '허용'으로 변경해주세요.");
        } else if (tokenOrStatus === null) {
            throw new Error('알림 권한이 거부되었습니다.'); 
        }
        
        // ... (알림 구독 및 코스 시작 - 이전과 동일) ...
        const token = tokenOrStatus;
        await api.registerPushToken(token); 
        await api.toggleNotifyMe(machineId, true); // ❗️ [1] 구독
        await api.startCourse(machineId, 'DRYER');  // ❗️ [2] 시작 (실패 시 catch로)
        
        console.log(`API: 건조기 시작 및 알림 구독 성공`);
        
        // ❗️ [수정] 상태 강제 변경(updateMachineCard) 제거, 텍스트만 변경
        clickedBtn.textContent = '✅ 알림 등록됨';
        
        alert(`건조기 알림이 등록되었습니다.`);

    } catch (error) {
        // 6. ❗️ [수정] 실패 시 롤백
        console.error("API: 건조기 시작/알림 등록 실패:", error);
        alert(`시작 실패: ${error.message}`);

        // ❗️ [추가] 1번(구독)이 성공했을 수 있으므로 구독 취소
        try {
            await api.toggleNotifyMe(machineId, false);
            console.log("롤백: 알림 구독 취소 완료");
        } catch (rollbackError) {
            console.error("롤백 실패 (구독 취소):", rollbackError);
        }
        
        clickedBtn.disabled = false;
        clickedBtn.textContent = '🔔 알림 받고 시작';
    }
}


/**
 * ❗️ [수정] 코스 버튼 로직 (롤백 버그 수정 + UI 즉시 변경)
 */
function addCourseButtonLogic() {
    document.querySelectorAll('.course-btn').forEach(clickedBtn => {
        clickedBtn.onclick = async (event) => { 
            const machineId = parseInt(clickedBtn.dataset.machineId, 10);
            const courseName = clickedBtn.dataset.courseName;
            
            const card = clickedBtn.closest('.machine-card');
            if (!card) return;

            const allButtonsOnCard = card.querySelectorAll('.course-btn');
            allButtonsOnCard.forEach(btn => {
                btn.disabled = true;
                if (btn === clickedBtn) {
                    btn.textContent = "요청 중...";
                }
            });

            try {
                // ... (빈자리 알림 끄기 로직 - 이전과 동일) ...
                const roomSubState = localStorage.getItem('washcallRoomSubState');
                if (roomSubState === 'true') {
                    console.log("중복 방지: '빈자리 알림'을 끕니다.");
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

                // ... (FCM 토큰 발급 - 이전과 동일) ...
                const tokenOrStatus = await requestPermissionAndGetToken();
                if (tokenOrStatus === 'denied') {
                    throw new Error("알림이 '차단' 상태입니다. 🔒 아이콘을 클릭하여 '허용'으로 변경해주세요.");
                } else if (tokenOrStatus === null) {
                    throw new Error('알림 권한이 거부되었습니다.'); 
                }
                
                // ... (알림 구독 및 코스 시작) ...
                const token = tokenOrStatus;
                await api.registerPushToken(token); 
                await api.toggleNotifyMe(machineId, true); // ❗️ [1] 구독
                await api.startCourse(machineId, courseName); // ❗️ [2] 시작 (실패 시 catch로)
                
                console.log(`API: 코스 시작 및 알림 구독 성공`);
                
                alert(`${courseName} 코스 알림이 등록되었습니다.`);

                // ❗️ [수정] 성공 시, UI를 즉시 '작동 중'(Scenario B) 상태로 변경
                // (서버가 timer, elapsed_time_minutes를 반환할 때까지 null로 보냄)
                updateMachineCard(machineId, 'WASHING', null, true, null);

            } catch (error) {
                // 6. ❗️ [수정] 실패 시 롤백
                console.error("API: 코스 시작/알림 등록 실패:", error);
                alert(`시작 실패: ${error.message}`);
                
                // ❗️ [추가] 1번(구독)이 성공했을 수 있으므로 구독 취소
                try {
                    await api.toggleNotifyMe(machineId, false);
                    console.log("롤백: 알림 구독 취소 완료");
                } catch (rollbackError) {
                    console.error("롤백 실패 (구독 취소):", rollbackError);
                }
                
                // (기존 UI 롤백 로직)
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
 * ❗️ [수정] "완료 알림 받기" 버튼 로직 (롤백 버그 수정)
 */
function addNotifyMeDuringWashLogic() {
    document.querySelectorAll('.notify-me-during-wash-btn').forEach(button => {
        button.addEventListener('click', async (event) => {
            const btn = event.target;
            const machineId = parseInt(btn.dataset.machineId, 10);

            btn.disabled = true;
            btn.textContent = "요청 중...";

            try {
                // ... (FCM 토큰 발급 - 이전과 동일) ...
                const tokenOrStatus = await requestPermissionAndGetToken();
                if (tokenOrStatus === 'denied') {
                    throw new Error("알림이 '차단' 상태입니다. 🔒 아이콘을 클릭하여 '허용'으로 변경해주세요.");
                } else if (tokenOrStatus === null) {
                    throw new Error('알림 권한이 거부되었습니다.'); 
                }
                
                // ... (알림 구독) ...
                const token = tokenOrStatus;
                await api.registerPushToken(token); 
                await api.toggleNotifyMe(machineId, true); // ❗️ [1] 구독

                btn.textContent = '✅ 알림 등록됨';
                alert('완료 알림이 등록되었습니다.');

            } catch (error) {
                // 5. ❗️ [수정] 롤백 (API 호출 필요 없음)
                console.error("API: '세탁 중' 알림 등록 실패:", error);
                alert(`알림 등록 실패: ${error.message}`);
                
                // (어차피 toggleNotifyMe가 실패한 것이므로 API 롤백 불필요)
                
                btn.disabled = false;
                btn.textContent = '🔔 완료 알림 받기';
            }
        });
    });
}


// (유틸리티 함수 - 이전과 동일)
function translateStatus(status, machineType = 'washer') {
    switch (status) {
        case 'WASHING': return '세탁 중';
        case 'SPINNING': return '탈수 중';
        case 'DRYING': '건조 중'; 
        case 'FINISHED':
            return (machineType === 'dryer') ? '건조 완료' : '세탁 완료'; 
        case 'OFF': return '대기 중';
        default: return status;
    }
}
