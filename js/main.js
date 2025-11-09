// js/main.js
// ❗️ ('일회성 알림' + '5초 재연결' + '개별 토글 팝업'
// ❗️ + 'WASHING/클릭 시 비활성화' + '타이머 동기화 (Load + WebSocket)' 최종본)

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
        const machines = await api.getInitialMachines();
        renderMachines(machines); // ❗️ 수정된 함수가 연결됨
        tryConnect(); // 웹소켓 연결 시작
    } catch (error) {
        console.error("초기 세탁기 목록 로드 실패:", error);
        updateConnectionStatus('error'); 
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
 * ❗️ [핵심 수정] WebSocket 메시지 처리 (웹소켓 타이머 동기화)
 */
async function handleSocketMessage(event) {
    try {
        const message = JSON.parse(event.data); 
        const machineId = message.machine_id;
        const newStatus = message.status;
        
        // ❗️ [신규] 웹소켓에서 타이머 값을 읽음 (없으면 null)
        const newTimer = message.timer || null; 

        if (message.type === 'room_status') {
            updateMachineCard(machineId, newStatus, newTimer); // ❗️ newTimer 전달
        } 
        else if (message.type === 'notify') {
            const msg = `세탁기 ${machineId} 상태 변경: ${translateStatus(newStatus)}`;
            alert(msg); 
            updateMachineCard(machineId, newStatus, newTimer); // ❗️ newTimer 전달
        }

        if (newStatus === 'FINISHED') {
            await turnOffToggle(machineId);
        }

    } catch (error) {
        console.error("WebSocket 메시지 파싱 오류 또는 처리 오류:", error);
    }
}

// [수정 없음] 토글 자동 끄기 헬퍼
async function turnOffToggle(machineId) {
    const toggle = document.querySelector(`.notify-me-toggle[data-machine-id="${machineId}"]`);
    if (toggle && toggle.checked) {
        console.log(`알림 완료: ${machineId}번 세탁기 토글을 자동으로 끕니다.`);
        toggle.checked = false;
        try {
            await api.toggleNotifyMe(machineId, false);
        } catch (error) {
            console.error(`토글 ${machineId} 자동 끄기 서버 전송 실패:`, error);
        }
    }
}


/**
 * ❗️ [핵심 수정] updateMachineCard (타이머 로직 복구)
 */
function updateMachineCard(machineId, newStatus, newTimer = null) {
    const card = document.getElementById(`machine-${machineId}`);
    if (!card) return; 

    card.className = 'machine-card'; 
    card.classList.add(`status-${newStatus.toLowerCase()}`);

    const statusStrong = card.querySelector('.status-display strong');
    if (statusStrong) {
        statusStrong.textContent = translateStatus(newStatus);
    }

    // ❗️ [수정] 타이머 로직 (웹소켓 동기화)
    const timerSpan = card.querySelector('.timer-display span');
    if (timerSpan) {
        if (newTimer !== null && newTimer > 0 && (newStatus === 'WASHING' || newStatus === 'SPINNING')) {
            // (A) 서버가 타이머 값을 줬을 때 (POST /load, /start_course, *WebSocket*)
            timerSpan.textContent = `${newTimer}분 남음`;
        } else if (newStatus === 'WASHING' || newStatus === 'SPINNING') {
            // (B) 타이머 값이 없는데 작동 중일 때 (기본값)
            timerSpan.textContent = '작동 중...';
        } else if (newStatus === 'FINISHED') {
            // (C) 완료
            timerSpan.textContent = '세탁 완료!';
        } else {
            // (D) 대기 중
            timerSpan.textContent = '대기 중';
        }
    }

    // [수정 없음] 버튼 비활성화 로직 (Case 1)
    const courseButtons = card.querySelectorAll('.course-btn');
    const shouldBeDisabled = (newStatus === 'WASHING' || newStatus === 'SPINNING');
    
    courseButtons.forEach(btn => {
        btn.disabled = shouldBeDisabled;
        if (!shouldBeDisabled) {
            btn.textContent = btn.dataset.courseName; 
        }
    });
}

/**
 * ❗️ [핵심 수정] renderMachines (타이머 로직 복구)
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
        
        // ❗️ [수정] /load에서 받은 timer 값을 확인
        let displayTimerText = '대기 중';
        const machineTimer = machine.timer; 

        if ((machine.status === 'WASHING' || machine.status === 'SPINNING')) {
            if (machineTimer !== null && machineTimer !== undefined && machineTimer > 0) {
                displayTimerText = `${machineTimer}분 남음`;
            } else {
                displayTimerText = '작동 중...'; 
            }
        } else if (machine.status === 'FINISHED') {
            displayTimerText = '세탁 완료!';
        }
        // ❗️ [수정] 끝

        // [수정 없음] 버튼 비활성화 로직 (Case 1)
        const isDisabled = (machine.status === 'WASHING' || machine.status === 'SPINNING');
        const disabledAttribute = isDisabled ? 'disabled' : '';

        const machineDisplayName = machine.machine_name || `세탁기 ${machine.machine_id}`;
        const isCurrentlyUsing = (machine.isusing === 1 || machine.isusing === true);
        const checkedAttribute = isCurrentlyUsing ? 'checked' : '';

        machineDiv.innerHTML = `
            <h3>${machineDisplayName}</h3> 
            <div class="status-display">
                상태: <strong id="status-${machine.machine_id}">${translateStatus(machine.status)}</strong>
            </div>
            <div class="timer-display">
                타이머: <span id="timer-${machine.machine_id}">${displayTimerText}</span>
            </div>
            <div class="notify-me-container">
                <label class="switch">
                    <input type="checkbox" class="notify-me-toggle" data-machine-id="${machine.machine_id}" ${checkedAttribute}>
                    <span class="slider"></span>
                </label>
                <label class="notify-me-label">이 세탁기 알림 받기</label>
            </div>
            <div class="course-buttons" style="${isDisabled ? 'display: none;' : 'display: flex;'}"> <button class="course-btn" data-machine-id="${machine.machine_id}" data-course-name="표준" ${disabledAttribute}>표준</button>
                <button class="course-btn" data-machine-id="${machine.machine_id}" data-course-name="쾌속" ${disabledAttribute}>쾌속</button>
                <button class="course-btn" data-machine-id="${machine.machine_id}" data-course-name="울/섬세" ${disabledAttribute}>울/섬세</button>
            </div>
        `;
        container.appendChild(machineDiv);
    });

    addCourseButtonLogic(); // ❗️ 수정된 함수가 연결됨
    addNotifyMeLogic();
}

/**
 * ❗️ [핵심 수정] 코스 버튼 로직 (Case 2: 클릭 시 즉시 비활성화 + 숨김)
 */
function addCourseButtonLogic() {
    document.querySelectorAll('.course-btn').forEach(clickedBtn => {
        clickedBtn.onclick = async (event) => { 
            const machineId = parseInt(clickedBtn.dataset.machineId, 10);
            const courseName = clickedBtn.dataset.courseName;
            
            const card = document.getElementById(`machine-${machineId}`);
            if (!card) return;
            const allButtonsOnCard = card.querySelectorAll('.course-btn');
            const buttonContainer = card.querySelector('.course-buttons');

            // 1. ❗️ [신규] 모든 버튼 비활성화 (Case 2)
            allButtonsOnCard.forEach(btn => {
                btn.disabled = true;
                if (btn === clickedBtn) {
                    btn.textContent = "요청 중...";
                }
            });

            try {
                // 2. 서버에 /start_course API 호출 (알려주기)
                await api.startCourse(machineId, courseName);
                
                // 3. ❗️ [신규] API 호출 성공 시, 버튼 그룹을 '숨김'
                //    (어차피 곧 웹소켓이 'WASHING'을 방송하여 숨길 것이지만, 선제적 조치)
                if (buttonContainer) buttonContainer.style.display = 'none';
                
                console.log(`API: 코스 시작 요청 성공 (서버에 알림)`);
            
            } catch (error) {
                console.error("API: 코스 시작 요청 실패:", error);
                alert(`코스 시작 실패: ${error.message}`);
                
                // 5. (롤백) '실패' 시에만 모든 버튼을 다시 활성화
                allButtonsOnCard.forEach(btn => {
                    btn.disabled = false;
                    btn.textContent = btn.dataset.courseName; 
                });
            }
        };
    });
}

// [수정 없음] 개별 토글 로직 (개별 팝업 기능 포함)
function addNotifyMeLogic() {
    document.querySelectorAll('.notify-me-toggle').forEach(toggle => {
        toggle.addEventListener('change', async (event) => {
            const machineId = parseInt(event.target.dataset.machineId, 10);
            const shouldSubscribe = event.target.checked; 

            if (shouldSubscribe) {
                // --- 1. 토글을 켰을 때 (구독 신청) ---
                try {
                    // (index.html에서 push.js가 main.js보다 먼저 로드되어야 함)
                    const tokenOrStatus = await requestPermissionAndGetToken();

                    if (tokenOrStatus === 'denied') {
                        alert("알림이 '차단' 상태입니다.\n\n주소창의 🔒 아이콘을 클릭하여 '알림'을 '허용'으로 변경해주세요.");
                        throw new Error('알림 권한이 차단되었습니다.'); 
                    
                    } else if (tokenOrStatus === null) {
                        throw new Error('알림 권한이 거부되었습니다.'); 
                    
                    } else {
                        const token = tokenOrStatus;
                        await api.registerPushToken(token);
                        await api.toggleNotifyMe(machineId, true);
                        alert('알림이 등록되었습니다.');
                    }

                } catch (error) {
                    alert(`알림 등록 실패: ${error.message}`);
                    event.target.checked = false; // 롤백
                }
            } else {
                // --- 2. 토글을 껐을 때 (구독 취소) ---
                try {
                    await api.toggleNotifyMe(machineId, false);
                } catch (error) {
                    alert(`알림 해제 실패: ${error.message}`);
                    event.target.checked = true; // 롤백
                }
            }
        });
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