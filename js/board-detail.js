// js/board-detail.js
// (좋아요 기능이 포함된 최종본)

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
        // ❗️ 참고: 현재 백엔드 응답은 'author'가 아닌 'user_snum'을 포함합니다.
        // ❗️ 익명성을 위해 'author' 대신 user_snum을 사용하거나 수정이 필요합니다.
        const authorDisplay = comment.author || (comment.user_snum ? `학번: ${comment.user_snum}` : '익명');
        const timestampDisplay = comment.timestamp || comment.created_at;

        li.innerHTML = `
            <div class="comment-meta">
                <span>${authorDisplay} (${new Date(timestampDisplay).toLocaleString()})</span>
            </div>
            <div class="comment-text">${comment.content}</div>
        `;
        commentList.appendChild(li);
    });
}


// 게시글 상세 내용을 로드하고 표시
async function loadPostDetail(postId) { 
    const commentCountSpan = document.getElementById('comment-count');
    commentCountSpan.textContent = '(로딩 중...)';

    // ❗️ server-api.js의 getPostById 호출
    const response = await api.getPostById(postId); 

    if (response.error || !response.post) { 
        document.getElementById('post-detail').innerHTML = `
            <h1 class="detail-title" style="color: #D8000C;">오류</h1>
            <p class="detail-content">요청하신 게시글을 찾을 수 없습니다.</p>
        `;
        document.getElementById('comments-section').style.display = 'none';
        return;
    }

    // ❗️ 백엔드는 {post: {...}, comments: [...]} 형식으로 응답합니다.
    const { post, comments } = response;

    // 1. 게시글 정보 표시
    document.querySelector('.detail-title').textContent = post.title;
    // ❗️ 참고: post.author_snum을 '익명' 등으로 처리할지 결정 필요
    document.getElementById('post-author').textContent = `작성자: ${post.author_snum || '익명'}`;
    document.getElementById('post-timestamp').textContent = `작성일: ${new Date(post.created_at).toLocaleString()}`;
    document.getElementById('post-likes').textContent = `좋아요 ${post.like_count}`;
    document.getElementById('post-content').textContent = post.content;

    
    // ❗️ [수정] 2. 좋아요 버튼 상태 관리 및 클릭 이벤트
    const likeButton = document.getElementById('like-button');
    
    // UI 업데이트용 헬퍼 함수
    function updateLikeButtonUI(count, liked) {
        document.getElementById('post-likes').textContent = `좋아요 ${count}`;
        if (liked) {
            likeButton.textContent = '👍 좋아요 취소';
            likeButton.classList.add('liked'); // (CSS로 .liked { color: blue; } 등 스타일 추가 가능)
        } else {
            likeButton.textContent = '👍 좋아요';
            likeButton.classList.remove('liked');
        }
    }

    // 2-A. 페이지 로드 시: 초기 상태 설정
    // (백엔드 /posts/{post_id}에서 받은 post.user_liked 값 사용)
    updateLikeButtonUI(post.like_count, post.user_liked); 

    // 2-B. 클릭 이벤트 리스너 (기존 alert 로직 대체)
    likeButton.addEventListener('click', async () => {
        likeButton.disabled = true; // 중복 클릭 방지
        try {
            // ❗️ server-api.js의 toggleLike 호출
            const likeResponse = await api.toggleLike(postId);
            
            if (likeResponse && !likeResponse.error) {
                // ❗️ 백엔드가 반환한 최신 값({like_count, user_liked})으로 UI 업데이트
                updateLikeButtonUI(likeResponse.like_count, likeResponse.user_liked);
            } else {
                alert(likeResponse.error || '좋아요 처리에 실패했습니다.');
            }
        } catch (error) {
            alert('좋아요 처리 중 오류 발생: ' + error);
        } finally {
            likeButton.disabled = false;
        }
    });

    // 3. 댓글 로드 및 표시
    renderComments(comments);

    // 4. (임시) 수정/삭제 버튼 가시성 설정 (나중에 사용자 ID 비교 로직 추가 필요)
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
            // ❗️ server-api.js의 createComment 호출
            const commentResponse = await api.createComment(postId, content); 
            
            if (commentResponse && !commentResponse.error) {
                // 댓글 리스트 다시 렌더링 (서버에서 최신 목록을 받아오는 것이 가장 정확함)
                const freshResponse = await api.getPostById(postId);
                if (freshResponse && freshResponse.comments) {
                    renderComments(freshResponse.comments);
                }
            } else {
                alert(commentResponse.error || '댓글 등록에 실패했습니다.');
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