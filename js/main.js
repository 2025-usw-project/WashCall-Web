// js/main.js
// ❗️ ('일회성 알림' + '코스 타이머' + '버튼 비활성화' + '5초 재연결' + '개별 토글 팝업'
// ❗️ + 'API 호출 시 상태 변경 절대 안 함' 최종본)

let connectionStatusElement;

document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
        main();
        
        // ✅ FCM 알림 클릭 시 스크롤 기능
        setupServiceWorkerMessageListener();
        handleInitialHashScroll();
    }
});

// [수정 없음] main 함수 (tryConnect 호출)
async function main() {
    console.log('WashCall WebApp 시작!');
    connectionStatusElement = document.getElementById('connection-status');
    
    try {
        updateConnectionStatus('connecting'); 
        const machines = await api.getInitialMachines();
        renderMachines(machines);
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
            handleSocketMessage(event);
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

// [수정 없음] WebSocket 메시지 처리 (타이머 로직 임시 제거됨)
async function handleSocketMessage(event) {
    try {
        const message = JSON.parse(event.data); 
        const machineId = message.machine_id;
        const newStatus = message.status;

        if (message.type === 'room_status') {
            updateMachineCard(machineId, newStatus);
        } 
        else if (message.type === 'notify') {
            const msg = `세탁기 ${machineId} 상태 변경: ${translateStatus(newStatus)}`;
            alert(msg); 
            updateMachineCard(machineId, newStatus);
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


// [수정 없음] updateMachineCard (타이머 로직 임시 제거됨)
function updateMachineCard(machineId, newStatus) {
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
        if (newStatus === 'WASHING' || newStatus === 'SPINNING') {
            timerSpan.textContent = '작동 중...';
        } else if (newStatus === 'FINISHED') {
            timerSpan.textContent = '세탁 완료!';
        } else {
            timerSpan.textContent = '대기 중';
        }
    }

    const courseButtons = card.querySelectorAll('.course-btn');
    const shouldBeDisabled = (newStatus === 'WASHING' || newStatus === 'SPINNING');
    
    courseButtons.forEach(btn => {
        btn.disabled = shouldBeDisabled;
        if (!shouldBeDisabled) {
            btn.textContent = btn.dataset.courseName; 
        }
    });
}

// [수정 없음] renderMachines (타이머 로직 임시 제거됨)
function renderMachines(machines) {
    const container = document.getElementById('machine-list-container');
    if (!container) return;
    container.innerHTML = '';

    machines.forEach(machine => {
        const machineDiv = document.createElement('div');
        machineDiv.className = 'machine-card';
        machineDiv.classList.add(`status-${machine.status.toLowerCase()}`);
        machineDiv.id = `machine-${machine.machine_id}`;
        machineDiv.dataset.machineId = machine.machine_id; // ✅ FCM 알림 클릭 시 스크롤용 
        
        let displayTimerText = '대기 중';
        if ((machine.status === 'WASHING' || machine.status === 'SPINNING')) {
            displayTimerText = '작동 중...'; 
        } else if (machine.status === 'FINISHED') {
            displayTimerText = '세탁 완료!';
        }

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
            <div class="course-buttons">
                <button class="course-btn" data-machine-id="${machine.machine_id}" data-course-name="표준" ${disabledAttribute}>표준</button>
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
 * ❗️ [핵심 수정] 코스 버튼 로직 (API 호출만 하고 UI 상태 변경 안 함)
 */
function addCourseButtonLogic() {
    document.querySelectorAll('.course-btn').forEach(clickedBtn => {
        clickedBtn.onclick = async (event) => { 
            const machineId = parseInt(clickedBtn.dataset.machineId, 10);
            const courseName = clickedBtn.dataset.courseName;
            
            const card = document.getElementById(`machine-${machineId}`);
            if (!card) return;
            const allButtonsOnCard = card.querySelectorAll('.course-btn');

            // 1. 모든 버튼 비활성화, 클릭한 버튼 텍스트 변경
            allButtonsOnCard.forEach(btn => {
                btn.disabled = true;
                if (btn === clickedBtn) {
                    btn.textContent = "요청 중...";
                }
            });

            try {
                // 2. 서버에 /start_course API 호출 (알려주기)
                await api.startCourse(machineId, courseName);
                
                // 3. ❗️ [수정] UI 업데이트(updateMachineCard) 코드 '제거'
                
                console.log(`API: 코스 시작 요청 성공 (서버에 알림)`);
                
                // 4. [신규] 성공 시, UI는 'OFF' 상태이므로 버튼을 다시 활성화
                allButtonsOnCard.forEach(btn => {
                    btn.disabled = false;
                    btn.textContent = btn.dataset.courseName; 
                });
            
            } catch (error) {
                console.error("API: 코스 시작 요청 실패:", error);
                alert(`코스 시작 실패: ${error.message}`);
                
                // 5. (롤백) 실패 시, 모든 버튼을 다시 활성화
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

// ===== 🔔 FCM 알림 클릭 시 스크롤 기능 =====

/**
 * Service Worker로부터 메시지를 받아서 특정 세탁기로 스크롤
 */
function setupServiceWorkerMessageListener() {
    if (!('serviceWorker' in navigator)) {
        console.warn('[main.js] Service Worker를 지원하지 않는 브라우저입니다.');
        return;
    }
    
    navigator.serviceWorker.addEventListener('message', event => {
        console.log('[main.js] Service Worker로부터 메시지 수신:', event.data);
        
        if (event.data && event.data.type === 'SCROLL_TO_MACHINE') {
            const machineId = event.data.machine_id;
            if (machineId) {
                scrollToMachine(machineId);
            }
        }
    });
    
    console.log('[main.js] Service Worker 메시지 리스너 등록 완료');
}

/**
 * 페이지 로드 시 URL 해시가 있으면 해당 세탁기로 스크롤
 * 예: index.html#machine-123
 */
function handleInitialHashScroll() {
    const hash = window.location.hash; // 예: "#machine-123"
    
    if (hash && hash.startsWith('#machine-')) {
        const machineId = hash.replace('#machine-', '');
        
        // DOM이 완전히 로드될 때까지 대기 후 스크롤
        setTimeout(() => {
            scrollToMachine(machineId);
        }, 500); // 500ms 대기 (세탁기 목록이 렌더링될 시간)
        
        console.log('[main.js] URL 해시 감지, 스크롤 예약:', machineId);
    }
}

/**
 * 특정 세탁기 카드로 부드럽게 스크롤하고 하이라이트 효과
 */
function scrollToMachine(machineId) {
    const machineCard = document.querySelector(`[data-machine-id="${machineId}"]`);
    
    if (!machineCard) {
        console.warn(`[main.js] 세탁기 카드를 찾을 수 없습니다: machine_id=${machineId}`);
        return;
    }
    
    // 1. 부드럽게 스크롤
    machineCard.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
    });
    
    // 2. 하이라이트 효과 (배경색 깜빡임)
    machineCard.style.transition = 'background-color 0.3s ease';
    machineCard.style.backgroundColor = '#fff3cd'; // 연한 노란색
    
    setTimeout(() => {
        machineCard.style.backgroundColor = ''; // 원래대로
    }, 2000);
    
    console.log(`[main.js] 세탁기로 스크롤 완료: machine_id=${machineId}`);
}