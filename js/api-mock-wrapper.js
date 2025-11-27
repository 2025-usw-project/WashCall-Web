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

    function wrapWithMock(name, realFn, mockFn) {
        return async function wrappedApiMethod() {
            const args = Array.prototype.slice.call(arguments);

            if (isMockEnabled()) {
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
        if (sessionStorage.getItem(MOCK_TOAST_SHOWN_KEY) === '1') {
            return;
        }
        sessionStorage.setItem(MOCK_TOAST_SHOWN_KEY, '1');

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
                    status: 'OFF',
                    timer: null,
                    elapsed_time_minutes: 0,
                    isusing: 0
                },
                {
                    machine_id: 2,
                    machine_name: '세탁기 2번',
                    room_name: '기숙사 세탁실',
                    machine_type: 'washer',
                    status: 'WASHING',
                    timer: 20,
                    elapsed_time_minutes: 10,
                    isusing: 1
                },
                {
                    machine_id: 3,
                    machine_name: '건조기 1번',
                    room_name: '기숙사 세탁실',
                    machine_type: 'dryer',
                    status: 'DRYING',
                    timer: 30,
                    elapsed_time_minutes: 15,
                    isusing: 0
                }
            ],
            congestionByDay: createDefaultCongestionByDay(),
            congestionTip: '현재는 비교적 여유로운 시간대입니다. 세탁을 시작하기 좋습니다.'
        };

        try {
            sessionStorage.setItem(MOCK_DB_KEY, JSON.stringify(seed));
        } catch (e) {
            console.error(MOCK_PREFIX, '목업 DB 초기화 중 오류:', e);
        }
    }

    function createDefaultCongestionByDay() {
        const days = ['월', '화', '수', '목', '금', '토', '일'];
        const result = {};
        for (var i = 0; i < days.length; i++) {
            var day = days[i];
            var arr = [];
            for (var h = 0; h < 24; h++) {
                var value = 0;
                if (h >= 18 && h <= 22) {
                    value = 4;
                } else if (h >= 10 && h <= 17) {
                    value = 2;
                } else {
                    value = 1;
                }
                if (day === '토' || day === '일') {
                    value = Math.max(0, value - 1);
                }
                arr.push(value);
            }
            result[day] = arr;
        }
        return result;
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
        if (!db.congestionByDay) {
            db.congestionByDay = createDefaultCongestionByDay();
        }
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
    }

    if (api && typeof api.getInitialMachines === 'function') {
        api.getInitialMachines = wrapWithMock('getInitialMachines', api.getInitialMachines, mockGetInitialMachines);
    }

    if (api && typeof api.getCongestionData === 'function') {
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
