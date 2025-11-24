// 게시글 데이터 관리
let posts = [];
const STORAGE_KEY = 'anonymousBoardPosts';

// 초기화
function init() {
  loadPosts();
  setupEventListeners();
  showListView();
}

// 로컬 스토리지에서 게시글 불러오기
function loadPosts() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    posts = JSON.parse(stored);
  }
  renderPosts();
}

// 로컬 스토리지에 게시글 저장
function savePosts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
}

// 이벤트 리스너 설정
function setupEventListeners() {
  // 뷰 전환 버튼
  document.getElementById('listBtn').addEventListener('click', showListView);
  document.getElementById('writeBtn').addEventListener('click', showWriteView);
  document.getElementById('cancelBtn').addEventListener('click', showListView);
  document.getElementById('backBtn').addEventListener('click', showListView);

  // 글 작성 폼
  document.getElementById('postForm').addEventListener('submit', handleSubmit);
}

// 뷰 전환 함수들
function showListView() {
  document.getElementById('listView').classList.remove('hidden');
  document.getElementById('writeView').classList.add('hidden');
  document.getElementById('detailView').classList.add('hidden');
  document.getElementById('listBtn').classList.add('active');
  document.getElementById('writeBtn').classList.remove('active');
  renderPosts();
}

function showWriteView() {
  document.getElementById('listView').classList.add('hidden');
  document.getElementById('writeView').classList.remove('hidden');
  document.getElementById('detailView').classList.add('hidden');
  document.getElementById('listBtn').classList.remove('active');
  document.getElementById('writeBtn').classList.add('active');
  document.getElementById('postForm').reset();
}

function showDetailView(postId) {
  document.getElementById('listView').classList.add('hidden');
  document.getElementById('writeView').classList.add('hidden');
  document.getElementById('detailView').classList.remove('hidden');
  renderPostDetail(postId);
}

// 게시글 작성 처리
function handleSubmit(e) {
  e.preventDefault();
  
  const title = document.getElementById('postTitle').value.trim();
  const content = document.getElementById('postContent').value.trim();

  if (!title || !content) {
    alert('제목과 내용을 모두 입력해주세요.');
    return;
  }

  const newPost = {
    id: Date.now(),
    title: title,
    content: content,
    date: new Date().toISOString(),
  };

  posts.unshift(newPost); // 최신 글이 위로
  savePosts();
  showListView();
  
  // 작성 완료 메시지
  alert('글이 작성되었습니다!');
}

// 게시글 목록 렌더링
function renderPosts() {
  const postsList = document.getElementById('postsList');
  const emptyState = document.getElementById('emptyState');

  if (posts.length === 0) {
    postsList.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  postsList.innerHTML = posts.map(post => `
    <div class="post-item" onclick="showDetailView(${post.id})">
      <div class="post-header">
        <div class="post-title">${escapeHtml(post.title)}</div>
        <div class="post-date">${formatDate(post.date)}</div>
      </div>
      <div class="post-preview">${escapeHtml(post.content)}</div>
      <div class="post-footer">
        <span class="post-id">#${post.id}</span>
        <button class="delete-btn" onclick="event.stopPropagation(); deletePost(${post.id})">삭제</button>
      </div>
    </div>
  `).join('');
}

// 게시글 상세 보기 렌더링
function renderPostDetail(postId) {
  const post = posts.find(p => p.id === postId);
  if (!post) {
    showListView();
    return;
  }

  const detailContainer = document.getElementById('postDetail');
  detailContainer.innerHTML = `
    <div class="article-header">
      <h2 class="article-title">${escapeHtml(post.title)}</h2>
      <div class="article-meta">
        <span>작성일: ${formatDate(post.date)}</span>
        <span>게시글 번호: #${post.id}</span>
      </div>
    </div>
    <div class="article-content">${escapeHtml(post.content)}</div>
    <div class="article-footer">
      <button class="delete-btn" onclick="deletePost(${post.id})">삭제</button>
    </div>
  `;
}

// 게시글 삭제
function deletePost(postId) {
  if (!confirm('정말 삭제하시겠습니까?')) {
    return;
  }

  posts = posts.filter(p => p.id !== postId);
  savePosts();
  
  // 현재 뷰에 따라 처리
  const detailView = document.getElementById('detailView');
  if (!detailView.classList.contains('hidden')) {
    showListView();
  } else {
    renderPosts();
  }
}

// 날짜 포맷팅
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return '방금 전';
  } else if (minutes < 60) {
    return `${minutes}분 전`;
  } else if (hours < 24) {
    return `${hours}시간 전`;
  } else if (days < 7) {
    return `${days}일 전`;
  } else {
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

// HTML 이스케이프 (XSS 방지)
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 전역 함수로 등록 (onclick에서 사용하기 위해)
window.showDetailView = showDetailView;
window.deletePost = deletePost;

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', init);

