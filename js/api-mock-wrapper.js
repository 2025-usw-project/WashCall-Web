//목업 안쓸때는 이

(function () {
    if (typeof api === 'undefined') {
        console.warn('[MockAPI] api 객체가 정의되지 않았습니다. server-api.js가 먼저 로드되는지 확인하세요.');
        return;
    }

    const MOCK_ENABLED_KEY = 'washcall-mock-enabled';
    const MOCK_TOAST_SHOWN_KEY = 'washcall-mock-toast-shown';
    const MOCK_DB_KEY = 'washcall-mock-db-v1';
    const MOCK_PREFIX = '[MockAPI]';

    let mockWsTimerId = null;
    let serverHealthCheckFn = null;
    let serverCheckInProgress = false;

    function isMockEnabled() {
        return sessionStorage.getItem(MOCK_ENABLED_KEY) === '1';
    }

    function enableMockMode(reason) {
        if (isMockEnabled()) {
            return;
        }
        sessionStorage.setItem(MOCK_ENABLED_KEY, '1');
        console.warn(MOCK_PREFIX, '서버 요청 실패로 목업 모드로 전환합니다.', reason);
        showMockToastOnce();
    }

    function logMockCall(name) {
        console.info(MOCK_PREFIX, name + '()', '목업 데이터 사용 중');
    }

    function isNetworkError(error) {
        if (!error) return false;
        if (error instanceof TypeError) return true;
        const message = (error && (error.message || String(error))) || '';
        const lower = message.toLowerCase();
        return lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('network error');
    }

    function createServerHealthCheckFn() {
        if (typeof API_BASE_URL === 'undefined' || typeof fetch === 'undefined') {
            return null;
        }
        return async function () {
            const url = API_BASE_URL + '/health';
            const headers = { 'ngrok-skip-browser-warning': 'true' };
            let response;
            try {
                response = await fetch(url, { method: 'GET', headers: headers });
            } catch (error) {
                throw error;
            }

            let data = null;
            try {
                data = await response.json();
            } catch (e) {}

            if (!response || !response.ok || !data || data.status !== 'ok') {
                const err = new Error('Health check failed');
                err._isHealthLogicalError = true;
                throw err;
            }
            return data;
        };
    }

    function checkServerConnectionInBackground() {
        if (!serverHealthCheckFn) {
            return;
        }
        if (serverCheckInProgress) {
            return;
        }
        serverCheckInProgress = true;

        setTimeout(function () {
            Promise.resolve()
                .then(function () {
                    console.debug(MOCK_PREFIX, '서버 재연결 상태 확인 중... (백그라운드)');
                    return serverHealthCheckFn();
                })
                .then(function () {
                    console.info(MOCK_PREFIX, '서버 연결이 복구된 것으로 판단합니다. 목업 모드를 해제합니다.');
                    try {
                        sessionStorage.setItem(MOCK_ENABLED_KEY, '0');
                    } catch (e) {}
                })
                .catch(function (error) {
                    if (error && error._isHealthLogicalError) {
                        console.debug(MOCK_PREFIX, '서버 헬스체크 실패(응답은 받았으나 상태 비정상), 목업 모드 유지:', error);
                    } else if (isNetworkError(error)) {
                        console.debug(MOCK_PREFIX, '서버 재연결 실패(네트워크 오류), 목업 모드 유지:', error);
                    } else {
                        console.debug(MOCK_PREFIX, '서버 헬스체크 중 알 수 없는 오류, 목업 모드 유지:', error);
                    }
                })
                .finally(function () {
                    serverCheckInProgress = false;
                });
        }, 0);
    }

    function wrapWithMock(name, realFn, mockFn) {
        return async function wrappedApiMethod() {
            const args = Array.prototype.slice.call(arguments);

            if (isMockEnabled()) {
                checkServerConnectionInBackground();
                logMockCall(name);
                return mockFn.apply(null, args);
            }

            try {
                return await realFn.apply(api, args);
            } catch (error) {
                if (!isNetworkError(error)) {
                    throw error;
                }
                console.error(MOCK_PREFIX, name + '() 서버 통신 오류, 목업으로 폴백합니다:', error);
                enableMockMode(error);
                logMockCall(name);
                return mockFn.apply(null, args);
            }
        };
    }

    function clearMockWebSocketTimer() {
        if (mockWsTimerId !== null) {
            clearInterval(mockWsTimerId);
            mockWsTimerId = null;
        }
    }

    function mockConnect(onOpenCallback, onMessageCallback, onErrorCallback) {
        console.info(MOCK_PREFIX, 'connect() 목업 WebSocket 시뮬레이션을 시작합니다.');
        clearMockWebSocketTimer();

        if (typeof onOpenCallback === 'function') {
            setTimeout(function () {
                onOpenCallback();
            }, 0);
        }

        if (typeof onMessageCallback !== 'function') {
            return;
        }

        mockWsTimerId = setInterval(function () {
            var db = loadMockDb();
            var list = Array.isArray(db.machines) ? db.machines : [];
            var changed = [];

            for (var i = 0; i < list.length; i++) {
                var m = list[i];
                if (!m) continue;
                var status = m.status;
                if (status === 'WASHING' || status === 'SPINNING' || status === 'DRYING') {
                    var timer = typeof m.timer === 'number' ? m.timer : null;
                    var elapsed = typeof m.elapsed_time_minutes === 'number' ? m.elapsed_time_minutes : 0;
                    if (timer === null) {
                        timer = 30;
                    }
                    if (timer > 0) {
                        timer = timer - 1;
                        if (timer < 0) timer = 0;
                        elapsed = elapsed + 1;
                        if (timer === 0) {
                            status = 'FINISHED';
                        }
                        m.timer = timer;
                        m.elapsed_time_minutes = elapsed;
                        m.status = status;
                        changed.push({
                            machine_id: m.machine_id,
                            status: status,
                            timer: timer,
                            elapsed_time_minutes: elapsed
                        });
                    }
                }
            }

            if (changed.length > 0) {
                saveMockDb(db);
                var message = {
                    type: 'timer_sync',
                    machines: changed
                };
                var event = { data: JSON.stringify(message) };
                try {
                    onMessageCallback(event);
                } catch (e) {
                    console.error(MOCK_PREFIX, 'mock WebSocket onMessage 처리 중 오류:', e);
                }
            }
        }, 15000);
    }

    function wrapConnectWithMock(realConnect) {
        return function wrappedConnect(onOpenCallback, onMessageCallback, onErrorCallback) {
            if (isMockEnabled()) {
                logMockCall('connect');
                mockConnect(onOpenCallback, onMessageCallback, onErrorCallback);
                return;
            }

            var calledFallback = false;

            function fallbackToMock(reason) {
                if (calledFallback) {
                    return;
                }
                calledFallback = true;
                console.error(MOCK_PREFIX, 'connect() WebSocket 오류, 목업 WebSocket으로 폴백합니다:', reason);
                enableMockMode(reason || 'WebSocket error');
                logMockCall('connect');
                mockConnect(onOpenCallback, onMessageCallback, onErrorCallback);
            }

            try {
                realConnect(
                    function () {
                        if (typeof onOpenCallback === 'function') {
                            onOpenCallback();
                        }
                    },
                    function (event) {
                        if (typeof onMessageCallback === 'function') {
                            onMessageCallback(event);
                        }
                    },
                    function () {
                        fallbackToMock('WebSocket onerror/onclose');
                    }
                );
            } catch (error) {
                fallbackToMock(error);
            }
        };
    }

    function showMockToastOnce() {
        if (!document || !document.body) {
            return;
        }

        const toast = document.createElement('div');
        toast.textContent = '현재 목업 데이터로 통신 중입니다';
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        toast.style.color = '#fff';
        toast.style.padding = '10px 16px';
        toast.style.borderRadius = '8px';
        toast.style.fontSize = '0.9rem';
        toast.style.zIndex = '9999';
        toast.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
        toast.style.opacity = '1';
        toast.style.transition = 'opacity 0.5s ease';

        document.body.appendChild(toast);

        setTimeout(function () {
            toast.style.opacity = '0';
            setTimeout(function () {
                if (toast && toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 600);
        }, 3500);
    }

    function initMockDbIfNeeded() {
        if (sessionStorage.getItem(MOCK_DB_KEY)) {
            return;
        }

        const seed = {
            machines: [
                {
                    machine_id: 1,
                    machine_name: '세탁기 1번',
                    room_name: '기숙사 세탁실',
                    machine_type: 'washer',
                    status: 'WASHING',
                    timer: 21,
                    elapsed_time_minutes: 15,
                    isusing: 0
                },
                {
                    machine_id: 2,
                    machine_name: '세탁기 2번',
                    room_name: '기숙사 세탁실',
                    machine_type: 'washer',
                    status: 'SPINNING',
                    timer: 5,
                    elapsed_time_minutes: 5,
                    isusing: 0
                },
                {
                    machine_id: 3,
                    machine_name: '세탁기 3번',
                    room_name: '기숙사 세탁실',
                    machine_type: 'washer',
                    status: 'FINISHED',
                    timer: 0,
                    elapsed_time_minutes: 0,
                    isusing: 0
                },
                {
                    machine_id: 4,
                    machine_name: '건조기 1번',
                    room_name: '기숙사 세탁실',
                    machine_type: 'dryer',
                    status: 'DRYING',
                    timer: 35,
                    elapsed_time_minutes: 10,
                    isusing: 0
                }
            ],
            congestionByDay: getBusyTableCongestionFromDump(),
            congestionTip: '지금은 3대 사용 중으로 바쁜 시간대에요, 월요일 밤이 비교적 한산해요! 😊'
        };

        try {
            sessionStorage.setItem(MOCK_DB_KEY, JSON.stringify(seed));
        } catch (e) {
            console.error(MOCK_PREFIX, '목업 DB 초기화 중 오류:', e);
        }
    }

    function getBusyTableCongestionFromDump() {
        return {
            '월': [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 1, 3, 4, 3, 4, 2, 2, 1, 0, 0],
            '화': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 2, 3, 2, 1, 4, 3, 1, 3, 0, 0],
            '수': [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 0, 3, 1, 1, 0, 2, 4, 4, 1, 4, 1, 0, 0],
            '목': [0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 1, 0, 1, 1, 2, 0, 3, 4, 4, 2, 3, 3, 0, 0],
            '금': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 1, 4, 1, 4, 4, 3, 4, 4, 1, 0, 0],
            '토': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 3, 4, 1, 3, 1, 3, 1, 0, 0],
            '일': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 2, 4, 3, 2, 4, 3, 3, 1, 4, 0, 0]
        };
    }

    function loadMockDb() {
        var raw = sessionStorage.getItem(MOCK_DB_KEY);
        if (!raw) {
            return { machines: [], congestionByDay: {}, congestionTip: null };
        }
        try {
            return JSON.parse(raw);
        } catch (e) {
            console.error(MOCK_PREFIX, '목업 DB 파싱 실패, 새로 초기화합니다.', e);
            sessionStorage.removeItem(MOCK_DB_KEY);
            initMockDbIfNeeded();
            raw = sessionStorage.getItem(MOCK_DB_KEY) || '{}';
            try {
                return JSON.parse(raw);
            } catch (e2) {
                return { machines: [], congestionByDay: {}, congestionTip: null };
            }
        }
    }

    function saveMockDb(db) {
        try {
            sessionStorage.setItem(MOCK_DB_KEY, JSON.stringify(db));
        } catch (e) {
            console.error(MOCK_PREFIX, '목업 DB 저장 중 오류:', e);
        }
    }

    function findUserByStudentId(db, studentId) {
        db.users = db.users || [];
        var numericId = parseInt(studentId, 10);
        if (isNaN(numericId)) {
            return null;
        }
        for (var i = 0; i < db.users.length; i++) {
            if (db.users[i].user_snum === numericId) {
                return db.users[i];
            }
        }
        return null;
    }

    function createUser(db, username, studentId, password) {
        db.users = db.users || [];
        var nextId = db.nextUserId || 1;
        var numericId = parseInt(studentId, 10);
        if (isNaN(numericId)) {
            numericId = null;
        }
        var user = {
            user_id: nextId,
            user_username: username || ('사용자' + nextId),
            user_snum: numericId,
            user_password: password || '',
            fcm_token: null
        };
        db.users.push(user);
        db.nextUserId = nextId + 1;
        return user;
    }

    function getCurrentMockUserId() {
        var token = localStorage.getItem('user_token') || '';
        var prefix = 'mock-user-';
        if (token.indexOf(prefix) !== 0) {
            return null;
        }
        var idStr = token.substring(prefix.length);
        var id = parseInt(idStr, 10);
        if (isNaN(id)) {
            return null;
        }
        return id;
    }

    function mockGetInitialMachines() {
        var db = loadMockDb();
        var list = Array.isArray(db.machines) ? db.machines : [];

        db.notifySubscriptions = db.notifySubscriptions || [];
        var subs = db.notifySubscriptions;
        for (var i = 0; i < list.length; i++) {
            var m = list[i];
            if (subs.indexOf(m.machine_id) !== -1) {
                m.isusing = 1;
            } else if (typeof m.isusing !== 'number') {
                m.isusing = 0;
            }
        }

        console.debug(MOCK_PREFIX, 'getInitialMachines() 목업 데이터 반환:', list.length, '개');
        return Promise.resolve(list);
    }

    function mockGetCongestionData() {
        var db = loadMockDb();
        db.congestionByDay = getBusyTableCongestionFromDump();
        saveMockDb(db);
        console.debug(MOCK_PREFIX, 'getCongestionData() 목업 데이터 사용');
        return Promise.resolve(db.congestionByDay);
    }

    function mockGetCongestionTip() {
        var db = loadMockDb();
        var tip = db.congestionTip || null;
        console.debug(MOCK_PREFIX, 'getCongestionTip() 목업 데이터 사용:', tip);
        return Promise.resolve(tip);
    }

    function mockRegister(username, studentId, password) {
        var db = loadMockDb();
        var existing = findUserByStudentId(db, studentId);
        if (existing) {
            return Promise.reject(new Error('이미 등록된 학번입니다. (mock)'));
        }
        createUser(db, username, studentId, password);
        saveMockDb(db);
        console.debug(MOCK_PREFIX, 'register() 목업 사용자 생성:', studentId);
        return Promise.resolve({ message: 'mock registered' });
    }

    function mockLogin(studentId, password) {
        var db = loadMockDb();
        var user = findUserByStudentId(db, studentId);
        if (!user) {
            user = createUser(db, '사용자', studentId, password || '');
        } else if (user.user_password && password && user.user_password !== password) {
            return Promise.reject(new Error('비밀번호가 올바르지 않습니다. (mock)'));
        }
        saveMockDb(db);
        var token = 'mock-user-' + user.user_id;
        console.debug(MOCK_PREFIX, 'login() 목업 로그인 성공, user_id=', user.user_id);
        return Promise.resolve(token);
    }

    function mockRegisterPushToken(fcmToken) {
        var db = loadMockDb();
        var userId = getCurrentMockUserId();
        if (userId) {
            db.users = db.users || [];
            for (var i = 0; i < db.users.length; i++) {
                if (db.users[i].user_id === userId) {
                    db.users[i].fcm_token = fcmToken;
                    break;
                }
            }
        } else {
            db.lastFcmToken = fcmToken;
        }
        saveMockDb(db);
        console.debug(MOCK_PREFIX, 'registerPushToken() 목업: FCM 토큰 저장');
        return Promise.resolve({ message: 'mock fcm registered' });
    }

    function mockToggleNotifyMe(machineId, subscribe) {
        var id = parseInt(machineId, 10);
        var db = loadMockDb();
        db.notifySubscriptions = db.notifySubscriptions || [];
        var subs = db.notifySubscriptions;
        var idx = subs.indexOf(id);

        if (subscribe) {
            if (idx === -1) {
                subs.push(id);
            }
        } else if (idx !== -1) {
            subs.splice(idx, 1);
        }

        if (Array.isArray(db.machines)) {
            for (var i = 0; i < db.machines.length; i++) {
                if (db.machines[i].machine_id === id) {
                    db.machines[i].isusing = subscribe ? 1 : 0;
                    break;
                }
            }
        }

        saveMockDb(db);
        console.debug(MOCK_PREFIX, 'toggleNotifyMe() 목업: machine', id, 'subscribe=', !!subscribe);
        return Promise.resolve({ machine_id: id, subscribed: !!subscribe });
    }

    function mockStartCourse(machineId, courseName) {
        var id = parseInt(machineId, 10);
        var db = loadMockDb();
        var list = Array.isArray(db.machines) ? db.machines : [];
        var machine = null;
        for (var i = 0; i < list.length; i++) {
            if (list[i].machine_id === id) {
                machine = list[i];
                break;
            }
        }
        if (!machine) {
            machine = {
                machine_id: id,
                machine_name: '세탁기 ' + id + '번',
                room_name: '기숙사 세탁실',
                machine_type: 'washer',
                status: 'OFF',
                timer: null,
                elapsed_time_minutes: 0,
                isusing: 0
            };
            list.push(machine);
            db.machines = list;
        }

        var isDryerCourse = (courseName === 'DRYER' || machine.machine_type === 'dryer');
        var totalMinutes = isDryerCourse ? 45 : 36;

        machine.status = isDryerCourse ? 'DRYING' : 'WASHING';
        machine.elapsed_time_minutes = 0;
        machine.timer = totalMinutes;

        saveMockDb(db);
        console.debug(MOCK_PREFIX, 'startCourse() 목업: machine', id, 'status=', machine.status, 'timer=', machine.timer);
        return Promise.resolve({ timer: machine.timer });
    }

    function mockSubmitSurvey(surveyData) {
        var db = loadMockDb();
        db.surveys = db.surveys || [];
        var now = new Date().toISOString();

        var satisfaction = null;
        if (surveyData && typeof surveyData.satisfaction !== 'undefined') {
            var s = parseInt(surveyData.satisfaction, 10);
            satisfaction = isNaN(s) ? null : s;
        }

        var item = {
            id: db.nextSurveyId || 1,
            created_at: now,
            satisfaction: satisfaction,
            suggestion: (surveyData && surveyData.suggestion) ? surveyData.suggestion : ''
        };

        db.surveys.push(item);
        db.nextSurveyId = (db.nextSurveyId || 1) + 1;
        saveMockDb(db);
        console.debug(MOCK_PREFIX, 'submitSurvey() 목업: 설문 저장, 총 개수=', db.surveys.length);
        return Promise.resolve({ message: 'mock survey stored' });
    }

    initMockDbIfNeeded();

    if (isMockEnabled()) {
        console.info(MOCK_PREFIX, '이전 요청에서 이미 목업 모드가 활성화되어 있습니다. 모든 지원 API는 목업으로 동작합니다.');
        showMockToastOnce();
    }

    if (api && typeof api.getInitialMachines === 'function') {
        api.getInitialMachines = wrapWithMock('getInitialMachines', api.getInitialMachines, mockGetInitialMachines);
    }

    if (api && typeof api.getCongestionData === 'function') {
        serverHealthCheckFn = createServerHealthCheckFn();
        api.getCongestionData = wrapWithMock('getCongestionData', api.getCongestionData, mockGetCongestionData);
    }

    if (api && typeof api.getCongestionTip === 'function') {
        api.getCongestionTip = wrapWithMock('getCongestionTip', api.getCongestionTip, mockGetCongestionTip);
    }

    if (api && typeof api.register === 'function') {
        api.register = wrapWithMock('register', api.register, mockRegister);
    }

    if (api && typeof api.login === 'function') {
        api.login = wrapWithMock('login', api.login, mockLogin);
    }

    if (api && typeof api.registerPushToken === 'function') {
        api.registerPushToken = wrapWithMock('registerPushToken', api.registerPushToken, mockRegisterPushToken);
    }

    if (api && typeof api.toggleNotifyMe === 'function') {
        api.toggleNotifyMe = wrapWithMock('toggleNotifyMe', api.toggleNotifyMe, mockToggleNotifyMe);
    }

    if (api && typeof api.startCourse === 'function') {
        api.startCourse = wrapWithMock('startCourse', api.startCourse, mockStartCourse);
    }

    if (api && typeof api.submitSurvey === 'function') {
        api.submitSurvey = wrapWithMock('submitSurvey', api.submitSurvey, mockSubmitSurvey);
    }

    if (api && typeof api.connect === 'function') {
        api.connect = wrapConnectWithMock(api.connect);
    }
})();
