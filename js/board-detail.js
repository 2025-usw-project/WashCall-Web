// js/board-detail.js
// (로그아웃 중복 제거 완료)

// URL에서 게시글 ID를 가져오는 헬퍼 함수
function getPostIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    // URL 파라미터 'id' 값을 정수로 변환하여 반환
    const id = parseInt(params.get('id'), 10);
    return isNaN(id) ? null : id;
}

// 댓글 목록을 HTML로 렌더링
function renderComments(comments) {
    const commentList = document.getElementById('comment-list');
    const commentCountSpan = document.getElementById('comment-count');
    commentList.innerHTML = '';
    
    // 댓글 개수 업데이트
    commentCountSpan.textContent = `(${comments.length})`;

    if (comments.length === 0) {
        commentList.innerHTML = '<li class="comment-item comment-text" style="text-align: center; color: #999;">등록된 댓글이 없습니다.</li>';
        return;
    }

    comments.forEach(comment => {
        const li = document.createElement('li');
        li.className = 'comment-item';
        li.innerHTML = `
            <div class="comment-meta">
                <span>${comment.author} (${comment.timestamp})</span>
            </div>
            <div class="comment-text">${comment.content}</div>
        `;
        commentList.appendChild(li);
    });
}


// 게시글 상세 내용을 로드하고 표시
async function loadPostDetail(postId) { 
    // ❗️ [수정] 댓글 개수 업데이트를 위해 댓글 카운트 스팬을 여기서 찾습니다.
    const commentCountSpan = document.getElementById('comment-count');
    commentCountSpan.textContent = '(로딩 중...)';

    const response = await api.getPostById(postId); //

    if (response.error || !response.post) { 
        document.getElementById('post-detail').innerHTML = `
            <h1 class="detail-title" style="color: #D8000C;">오류</h1>
            <p class="detail-content">요청하신 게시글을 찾을 수 없습니다.</p>
        `;
        document.getElementById('comments-section').style.display = 'none';
        return;
    }

    const { post, comments } = response;

    // 1. 게시글 정보 표시
    document.querySelector('.detail-title').textContent = post.title;
    document.getElementById('post-author').textContent = `작성자: ${post.author}`;
    document.getElementById('post-timestamp').textContent = `작성일: ${post.timestamp}`;
    document.getElementById('post-likes').textContent = `좋아요 ${post.likes}`;
    document.getElementById('post-content').textContent = post.content;

    // 2. 좋아요 버튼 상태 관리
    const likeButton = document.getElementById('like-button');
    likeButton.addEventListener('click', () => {
        alert('이 기능은 서버 구현 후 추가됩니다!');
    });

    // 3. 댓글 로드 및 표시
    renderComments(comments);

    // 4. (임시) 수정/삭제 버튼 가시성 설정
    document.getElementById('edit-button').style.display = 'none';
    document.getElementById('delete-button').style.display = 'none';
    
    // 5. 댓글 폼 제출 이벤트
    document.getElementById('comment-form').addEventListener('submit', async (e) => { 
        e.preventDefault();
        const commentInput = document.getElementById('comment-input');
        const content = commentInput.value.trim();

        if (content === '') {
            alert('댓글 내용을 입력해주세요.');
            return;
        }
        
        const commentButton = document.getElementById('comment-form').querySelector('button');
        commentButton.disabled = true;
        
        try {
            // api.createComment 호출
            const newComment = await api.createComment(postId, content); 
            
            if (newComment && !newComment.error) {
                // 댓글 리스트 다시 렌더링 (서버에서 최신 목록을 받아와야 함)
                const freshResponse = await api.getPostById(postId);
                renderComments(freshResponse.comments);
            }

            // 입력창 초기화
            commentInput.value = '';
        } catch (error) {
            alert('댓글 등록 중 오류 발생: ' + error);
        } finally {
            commentButton.disabled = false;
        }
    });
}


// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', () => {
    const postId = getPostIdFromUrl();
    if (postId) {
        loadPostDetail(postId);
    } else {
        document.getElementById('post-detail').innerHTML = `
            <h1 class="detail-title" style="color: #D8000C;">오류</h1>
            <p class="detail-content">잘못된 접근입니다. 게시글 ID가 없습니다.</p>
        `;
        document.getElementById('comments-section').style.display = 'none';
    }
});