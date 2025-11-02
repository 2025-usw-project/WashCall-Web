// js/mock-data.js
// "가짜 서버" 역할을 하는 파일입니다.

// 3번: 세탁기 리스트 (가짜 상태)
const MOCK_MACHINE_LIST = {
  1: { id: 1, name: "세탁기 1번", status: "WASHING", course: "표준", timer: 45 },
  2: { id: 2, name: "세탁기 2번", status: "OFF", course: null, timer: 0 },
  3: { id: 3, name: "세탁기 3번", status: "FINISHED", course: "쾌속", timer: 0 },
  4: { id: 4, name: "세탁기 4번", status: "SPINNING", course: "표준", timer: 10 },
  5: { id: 5, name: "세탁기 5번", status: "OFF", course: null, timer: 0 }
};

// 8번: 하이브리드 타이머 (가짜 통계)
const MOCK_COURSE_STATS = {
  "표준": { min: 42, max: 55 },
  "쾌속": { min: 28, max: 32 },
  "울/섬세": { min: 35, max: 40 }
};

// 6번: 혼잡도 (가짜 통계)
const MOCK_CONGESTION_DATA = {
  "월": [0, 0, 0, 0, 0, 1, 1, 2, 3, 5, 4, 3, 2, 1, 3, 4, 5, 5, 4, 3, 2, 1, 0, 0],
  "화": [1, 0, 1, 0, 0, 1, 2, 2, 4, 5, 3, 2, 1, 1, 2, 3, 4, 4, 3, 2, 1, 1, 0, 0],
  "수": [0, 0, 0, 0, 1, 1, 2, 3, 3, 4, 4, 3, 2, 1, 2, 3, 4, 5, 5, 3, 2, 1, 1, 0],
  "목": [0, 0, 0, 1, 1, 1, 2, 2, 3, 4, 3, 2, 1, 1, 2, 3, 4, 4, 3, 2, 1, 0, 0, 0],
  "금": [1, 1, 0, 0, 0, 1, 2, 3, 4, 4, 3, 3, 2, 2, 3, 4, 5, 5, 5, 4, 3, 2, 1, 1],
  "토": [1, 1, 1, 2, 2, 3, 4, 5, 5, 5, 4, 3, 3, 2, 2, 3, 3, 4, 4, 3, 2, 1, 1, 1],
  "일": [2, 2, 1, 1, 1, 2, 3, 4, 5, 5, 5, 4, 3, 3, 4, 5, 5, 5, 5, 4, 3, 2, 1, 1]
};

// 9번: 익명 게시판 (가짜 데이터)
const MOCK_POSTS = {
    // ❗️ (수정) likes와 comments를 숫자로 정의
    1: { id: 1, tag: "잡담", title: "여기 기숙사 세탁기 너무 좋네요", author: "익명", timestamp: "2025-10-30", likes: 5, comments: 2, content: "안녕하세요! 글이 잘 올라가는지 테스트하는 게시글입니다." },
    2: { id: 2, tag: "건의사항", title: "세탁기 옆에 건조기도 있었으면", author: "익명", timestamp: "2025-10-29", likes: 12, comments: 1, content: "이건 진짜 필요하다고 생각합니다. 총학생회에 건의 부탁드려요." }
};

// 10번: 익명 게시판 댓글 (가짜 데이터)
const MOCK_COMMENTS = {
    1: { id: 1, postId: 1, author: "익명", content: "인정합니다", timestamp: "2025-10-30" },
    2: { id: 2, postId: 1, author: "익명", content: "3번 세탁기 ㄹㅇ", timestamp: "2025-10-30" },
    3: { id: 3, postId: 2, author: "익명", content: "이거 총학생회에 건의해 보죠", timestamp: "2025-10-29" }
};