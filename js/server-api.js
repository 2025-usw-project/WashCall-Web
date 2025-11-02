// js/server-api.js
// ❗️ (최종) "진짜" FastAPI 서버와 통신하는 API Layer
// (MOCK_DATA 의존성 완전 제거)

// 1. '진짜' 서버 주소를 여기에 정의합니다.
const API_BASE_URL = 'https://unconical-kyong-frolicsome.ngrok-free.dev';

// --- 헬퍼 함수 ---

/**
 * localStorage에서 'user_token'을 읽어옵니다.
 */
function getAuthToken() {
    return localStorage.getItem('user_token');
}
function getFetchOptions(method, body = null) {
    const token = getAuthToken();
    const options = {
        method: method,
        headers: { 'Content-Type': 'application/json' }
    };
    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }
    if (body) {
        options.body = JSON.stringify(body);
    }
    return options;
}

// -----------------------------------------------------------------
// ▼ 모든 UI 파일이 호출할 "공식" API 객체 ▼
// -----------------------------------------------------------------
const api = {
    /**
     * ❗️ (수정) 1. 실시간 연결 시작 (onOpenCallback 추가)
     */
    connect: function(onOpenCallback, onMessageCallback, onErrorCallback) { // ❗️ 1. onOpenCallback 인자 추가
        console.log('API: "진짜" WebSocket에 연결합니다...');
        const token = getAuthToken();
        if (!token) {
            console.error("WebSocket 연결 실패: 토큰이 없습니다.");
            if (onErrorCallback) onErrorCallback(); 
            return;
        }

        const wsProto = API_BASE_URL.startsWith('https:') ? 'wss:' : 'ws:';
        const wsHost = API_BASE_URL.replace(/^https?:\/\//, '');
        const wsUrl = `${wsProto}//${wsHost}/status_update?token=${token}`;

        const ws = new WebSocket(wsUrl);

        // ❗️ 2. (추가) onopen 이벤트 핸들러
        ws.onopen = () => {
            console.log("WebSocket 연결이 성공적으로 열렸습니다.");
            if (onOpenCallback) onOpenCallback(); // ❗️ main.js에 "성공" 알림
        };

        ws.onmessage = (event) => {
            onMessageCallback(event); // ❗️ main.js의 handleSocketMessage 호출
        };
        ws.onerror = (error) => {
            console.error("WebSocket 오류 발생.", error);
            if (onErrorCallback) onErrorCallback();
        };
        ws.onclose = (event) => {
            console.warn("WebSocket 연결 종료.", event.code, event.reason);
            if (onErrorCallback) onErrorCallback();
        };
    },

    // ... (api.startCourse, api.getInitialMachines, api.login, api.register 등
    //      이전 답변의 '진짜 서버 연동 버전'과 동일한 코드) ...
    // (이하 모든 함수를 이전 답변의 '진짜 서버 연동 완료 버전'으로 유지해야 합니다.)
    
    /**
     * (main.js용) 2. 코스 시작 요청 (신규 API)
     */
    startCourse: async function(machineId, courseName) {
        console.log(`API: "진짜" 코스 시작 (ID: ${machineId}, 코스: ${courseName})`);
        const response = await fetch(`${API_BASE_URL}/start_course`, getFetchOptions('POST', {
            machine_id: machineId,
            course_name: courseName
        }));
        if (!response.ok) throw new Error('코스 시작 실패');
        return await response.json(); 
    },

    /**
     * (main.js용) 3. 초기 데이터 가져오기 (POST /load)
     */
    getInitialMachines: async function() {
        console.log('API: "진짜" POST /load 요청 중...');
        const response = await fetch(`${API_BASE_URL}/load`, getFetchOptions('POST'));
        if (!response.ok) throw new Error('서버 응답 실패');
        const data = await response.json(); 
        return data.machine_list.map(m => ({
            id: m.machine_id,
            name: `${m.room_name} ${m.machine_name}`,
            status: m.status,
            timer: 0 
        }));
    },

    /**
     * (auth.js용) 4. 로그인 요청 (POST /login)
     */
    login: async function(studentId, password) {
        console.log(`API: "진짜" 로그인 시도 (ID: ${studentId})`);
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_snum: parseInt(studentId, 10),
                user_password: password,
                fcm_token: "temp_fcm_token_placeholder"
            })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || '로그인 실패');
        }
        const data = await response.json(); 
        return data.access_token;
    },

    /**
     * (auth.js용) 5. 회원가입 요청 (POST /register)
     */
    register: async function(username, studentId, password) { // ❗️ (수정됨) username 인자 추가
        console.log(`API: "진짜" 회원가입 시도 (ID: ${studentId})`);
        const response = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_username: username, // ❗️ (수정됨) auth.js에서 받은 이름 사용
                user_password: password,
                user_snum: parseInt(studentId, 10)
            })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || '회원가입 실패');
        }
    },

    /**
     * (congestion.js용) 6. 혼잡도 데이터 요청 (신규 API)
     */
    getCongestionData: async function() {
        console.log('API: "진짜" GET /statistics/congestion 요청 중...');
        const response = await fetch(`${API_BASE_URL}/statistics/congestion`, getFetchOptions('GET'));
        if (!response.ok) throw new Error('혼잡도 데이터 로딩 실패');
        return await response.json(); 
    },

    /**
     * (survey.js용) 7. 서베이 제출 (신규 API)
     */
    submitSurvey: async function(surveyData) {
        console.log('API: "진짜" POST /survey 제출 중...');
        const response = await fetch(`${API_BASE_URL}/survey`, getFetchOptions('POST', surveyData));
        if (!response.ok) throw new Error('설문 제출 실패');
        return await response.json(); 
    },

    /**
     * (push.js용) 8. 푸시 알림 토큰 등록 (POST /set_fcm_token)
     */
    registerPushToken: async function(token) {
        console.log('API: "진짜" 푸시 토큰 등록 시도...');
        const response = await fetch(`${API_BASE_URL}/set_fcm_token`, getFetchOptions('POST', {
            fcm_token: token
        }));
        if (!response.ok) throw new Error('FCM 토큰 등록 실패');
        return await response.json();
    },

    // --- 게시판 API (신규 API) ---
    
    getPosts: async function() {
        console.log("API: '진짜' GET /posts 요청 중...");
        const response = await fetch(`${API_BASE_URL}/posts`, getFetchOptions('GET'));
        if (!response.ok) throw new Error('게시글 로딩 실패');
        return await response.json(); 
    },
    getPostById: async function(postId) {
        console.log(`API: '진짜' GET /posts/${postId} 요청 중...`);
        const response = await fetch(`${API_BASE_URL}/posts/${postId}`, getFetchOptions('GET'));
        if (!response.ok) throw new Error('게시글 상세 로딩 실패');
        return await response.json(); 
    },
    createPost: async function(newPostData) {
        console.log("API: '진짜' POST /posts 요청 중...");
        const response = await fetch(`${API_BASE_URL}/posts`, getFetchOptions('POST', newPostData));
        if (!response.ok) throw new Error('글 등록 실패');
        return await response.json(); 
    },
    createComment: async function(postId, content) {
        console.log(`API: '진짜' POST /posts/${postId}/comment 요청 중...`);
        const response = await fetch(`${API_BASE_URL}/posts/${postId}/comment`, getFetchOptions('POST', {
            content: content
        }));
        if (!response.ok) throw new Error('댓글 등록 실패');
        return await response.json(); 
    }
};