// js/board.js
// (server-api.js가 먼저 로드되어야 함)

document.addEventListener('DOMContentLoaded', () => {
    // ❗️ (수정) auth.js가 처리하므로 setupLogoutButton() 호출 제거
    loadPosts();
});

function loadPosts() {
    const container = document.getElementById('post-list-container');
    if (!container) return;

    // ❗️ (수정) api.getPosts() 호출 (server-api.js 참조)
    const posts = api.getPosts(); 
    
    container.innerHTML = ''; 

    if (!posts || posts.length === 0) {
        container.innerHTML = '<p>아직 작성된 게시글이 없습니다.</p>';
        return;
    }

    posts.reverse(); // 최신 글이 위로 오도록 역순 정렬

    posts.forEach(post => {
        const postElement = document.createElement('a');
        postElement.className = 'post-item';
        postElement.href = `board-detail.html?id=${post.id}`;
        
        // ❗️ (수정) post.comments.length 대신 안전한 post.comments || 0 사용 [user_response]
        const commentCount = post.comments || 0; 

        postElement.innerHTML = `
            <h3 class="post-title">
                <span class="tag">[${post.tag}]</span> ${post.title}
            </h3>
            <div class="post-meta">
                <span>${post.author}</span> | 
                <span>${post.timestamp}</span> | 
                <span>좋아요 ${post.likes}</span> | 
                <span>댓글 ${commentCount}</span>
            </div>
        `;
        
        container.appendChild(postElement);
    });
}
// ❗️ (수정) setupLogoutButton 함수 제거 (auth.js가 담당)