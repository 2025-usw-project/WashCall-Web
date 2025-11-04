// js/main.js
// ❗️ ('일회성 알림' - 완료 시 토글 자동 OFF 로직이 추가된 최종본)

let connectionStatusElement;

document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
        main();
    }
});

async function main() {
    console.log('WashCall WebApp 시작!');

    connectionStatusElement = document.getElementById('connection-status');
    updateConnectionStatus('connecting');

    try {
        const machines = await api.getInitialMachines();
        renderMachines(machines); 

        api.connect(
            () => updateConnectionStatus('success'),
            (event) => handleSocketMessage(event), // ❗️ 수정된 함수가 연결됨
            () => updateConnectionStatus('error')
        );

    } catch (error) {
        console.error("초기 세탁기 목록 로드 실패:", error);
        updateConnectionStatus('error');
    }
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
 * ❗️ [핵심 수정] WebSocket 메시지 처리 (async 추가)
 * '세탁 완료' 시 토글을 자동으로 끄는 로직이 추가되었습니다.
 */
async function handleSocketMessage(event) { // ❗️ async 키워드 추가
    try {
        const message = JSON.parse(event.data); 
        const machineId = message.machine_id;
        const newStatus = message.status;

        // 1. 상태 브로드캐스트 처리 ('room_status')
        if (message.type === 'room_status') { 
            updateMachineCard(machineId, newStatus);
        } 
        // 2. 개별 알림 처리 ('notify')
        else if (message.type === 'notify') {
            const msg = `세탁기 ${machineId} 상태 변경: ${translateStatus(newStatus)}`;
            alert(msg); 
        }

        // 3. ❗️ [신규 로직] 상태가 'FINISHED'라면, 타입과 관계없이 토글을 끈다
        if (newStatus === 'FINISHED') {
            await turnOffToggle(machineId);
        }

    } catch (error) {
        console.error("WebSocket 메시지 파싱 오류 또는 처리 오류:", error);
    }
}

/**
 * ❗️ [신규 헬퍼 함수]
 * 지정된 세탁기 ID의 토글을 찾아 끄고, 서버에도 '알림 해제'를 전송합니다.
 */
async function turnOffToggle(machineId) {
    // 1. UI에서 해당 기기의 토글 스위치를 찾음
    const toggle = document.querySelector(`.notify-me-toggle[data-machine-id="${machineId}"]`);
    
    // 2. 토글이 존재하고, 현재 'ON(checked)' 상태일 때만 실행
    if (toggle && toggle.checked) { 
        console.log(`알림 완료: ${machineId}번 세탁기 토글을 자동으로 끕니다.`);
        
        // 3. UI에서 토글을 'OFF'로 변경
        toggle.checked = false; 
        
        try {
            // 4. 서버에도 '알림 해제'를 전송하여 상태를 동기화
            await api.toggleNotifyMe(machineId, false);
        } catch (error) {
            console.error(`토글 ${machineId} 자동 끄기 서버 전송 실패:`, error);
            // (실패해도 UI는 꺼진 상태로 두어, 사용자 혼란 방지)
        }
    }
}


// [수정 없음] 세탁기 카드 1개 UI 업데이트
function updateMachineCard(machineId, newStatus) {
    const card = document.getElementById(`machine-${machineId}`);
    if (!card) return; 
    card.className = 'machine-card'; 
    card.classList.add(`status-${newStatus.toLowerCase()}`);
    const statusStrong = card.querySelector('.status-display strong');
    if (statusStrong) statusStrong.textContent = translateStatus(newStatus);
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
}

// [수정 없음] 세탁기 리스트 렌더링
function renderMachines(machines) {
    const container = document.getElementById('machine-list-container');
    if (!container) return;
    container.innerHTML = '';

    machines.forEach(machine => {
        const machineDiv = document.createElement('div');
        machineDiv.className = 'machine-card';
        machineDiv.classList.add(`status-${machine.status.toLowerCase()}`);
        machineDiv.id = `machine-${machine.machine_id}`; 
        const machineDisplayName = machine.machine_name || `세탁기 ${machine.machine_id}`;
        const isCurrentlyUsing = (machine.isusing === 1 || machine.isusing === true);
        const checkedAttribute = isCurrentlyUsing ? 'checked' : '';

        machineDiv.innerHTML = `
            <h3>${machineDisplayName}</h3> 
            <div class="status-display">
                상태: <strong id="status-${machine.machine_id}">${translateStatus(machine.status)}</strong>
            </div>
            <div class="timer-display">
                타이머: <span id="timer-${machine.machine_id}">${(machine.status === 'WASHING' || machine.status === 'SPINNING') ? '작동 중...' : (machine.status === 'FINISHED' ? '세탁 완료!' : '대기 중')}</span>
            </div>
            <div class="notify-me-container">
                <label class="switch">
                    <input type="checkbox" class="notify-me-toggle" data-machine-id="${machine.machine_id}" ${checkedAttribute}>
                    <span class="slider"></span>
                </label>
                <label class="notify-me-label">이 세탁기 알림 받기</label>
            </div>
            <div class="course-buttons">
                <button class="course-btn" data-machine-id="${machine.machine_id}" data-course-name="표준">표준</button>
                <button class="course-btn" data-machine-id="${machine.machine_id}" data-course-name="쾌속">쾌속</button>
                <button class="course-btn" data-machine-id="${machine.machine_id}" data-course-name="울/섬세">울/섬세</button>
            </div>
        `;
        container.appendChild(machineDiv);
    });

    addCourseButtonLogic();
    addNotifyMeLogic(); 
}

// [수정 없음] 코스 버튼 로직
function addCourseButtonLogic() {
    document.querySelectorAll('.course-btn').forEach(btn => {
        btn.onclick = async (event) => { 
            const machineId = parseInt(event.target.dataset.machineId, 10);
            const courseName = event.target.dataset.courseName;
            try {
                await api.startCourse(machineId, courseName);
            } catch (error) {
                alert(`코스 시작 실패: ${error.message}`);
            }
        };
    });
}

// [수정 없음] 개별 토글 로직 (Q1 버전 - FCM 로직 없음)
function addNotifyMeLogic() {
    document.querySelectorAll('.notify-me-toggle').forEach(toggle => {
        toggle.addEventListener('change', async (event) => {
            const machineId = parseInt(event.target.dataset.machineId, 10);
            const shouldSubscribe = event.target.checked; 

            if (shouldSubscribe && Notification.permission !== 'granted') {
                alert("먼저 '전체 알림 켜기' 버튼을 눌러 알림 권한을 허용해주세요.");
                event.target.checked = false; 
                return; 
            }

            try {
                await api.toggleNotifyMe(machineId, shouldSubscribe);
            } catch (error) {
                alert(`알림 설정 실패: ${error.message}`);
                event.target.checked = !shouldSubscribe; 
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