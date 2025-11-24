// Firebase Firestore를 사용한 게시글 데이터 관리
let posts = [];
const COLLECTION_NAME = 'posts';

// 초기화
async function init() {
  // Firebase가 로드될 때까지 대기
  if (!window.db) {
    setTimeout(init, 100);
    return;
  }
  
  await loadPosts();
  setupEventListeners();
  showListView();
  setupRealtimeListener();
}

// Firebase에서 게시글 불러오기
async function loadPosts() {
  try {
    const { collection, getDocs, query, orderBy } = window.firestoreFunctions;
    const postsRef = collection(window.db, COLLECTION_NAME);
    const q = query(postsRef, orderBy('date', 'desc'));
    const querySnapshot = await getDocs(q);
    
    posts = [];
    querySnapshot.forEach((doc) => {
      posts.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    renderPosts();
  } catch (error) {
    console.error('게시글 불러오기 실패:', error);
    showError('게시글을 불러오는 중 오류가 발생했습니다. Firebase 설정을 확인해주세요.');
  }
}

// 실시간 리스너 설정 (새 글이 추가되면 자동으로 업데이트)
function setupRealtimeListener() {
  try {
    const { collection, query, orderBy, onSnapshot } = window.firestoreFunctions;
    const postsRef = collection(window.db, COLLECTION_NAME);
    const q = query(postsRef, orderBy('date', 'desc'));
    
    onSnapshot(q, (snapshot) => {
      posts = [];
      snapshot.forEach((doc) => {
        posts.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      // 현재 목록 화면이면 자동으로 업데이트
      const listView = document.getElementById('listView');
      if (!listView.classList.contains('hidden')) {
        renderPosts();
      }
    });
  } catch (error) {
    console.error('실시간 리스너 설정 실패:', error);
  }
}

// Firebase에 게시글 저장
async function savePost(post) {
  try {
    const { collection, addDoc } = window.firestoreFunctions;
    const postsRef = collection(window.db, COLLECTION_NAME);
    await addDoc(postsRef, post);
    return true;
  } catch (error) {
    console.error('게시글 저장 실패:', error);
    throw error;
  }
}

// Firebase에서 게시글 삭제
async function deletePostFromFirebase(postId) {
  try {
    const { doc, deleteDoc } = window.firestoreFunctions;
    const postRef = doc(window.db, COLLECTION_NAME, postId);
    await deleteDoc(postRef);
    return true;
  } catch (error) {
    console.error('게시글 삭제 실패:', error);
    throw error;
  }
}

// 에러 메시지 표시
function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.textContent = message;
  errorDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #ef4444; color: white; padding: 1rem; border-radius: 0.5rem; z-index: 1000;';
  document.body.appendChild(errorDiv);
  setTimeout(() => errorDiv.remove(), 5000);
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
async function handleSubmit(e) {
  e.preventDefault();
  
  const title = document.getElementById('postTitle').value.trim();
  const content = document.getElementById('postContent').value.trim();

  if (!title || !content) {
    alert('제목과 내용을 모두 입력해주세요.');
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = '작성 중...';

  try {
    const newPost = {
      title: title,
      content: content,
      date: new Date().toISOString(),
    };

    await savePost(newPost);
    showListView();
    alert('글이 작성되었습니다!');
  } catch (error) {
    alert('글 작성 중 오류가 발생했습니다. Firebase 설정을 확인해주세요.');
    console.error(error);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
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
    <div class="post-item" onclick="showDetailView('${post.id}')">
      <div class="post-header">
        <div class="post-title">${escapeHtml(post.title)}</div>
        <div class="post-date">${formatDate(post.date)}</div>
      </div>
      <div class="post-preview">${escapeHtml(post.content)}</div>
      <div class="post-footer">
        <span class="post-id">#${post.id.substring(0, 8)}</span>
        <button class="delete-btn" onclick="event.stopPropagation(); deletePost('${post.id}')">삭제</button>
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
        <span>게시글 번호: #${post.id.substring(0, 8)}</span>
      </div>
    </div>
    <div class="article-content">${escapeHtml(post.content)}</div>
    <div class="article-footer">
      <button class="delete-btn" onclick="deletePost('${post.id}')">삭제</button>
    </div>
  `;
}

// 게시글 삭제
async function deletePost(postId) {
  if (!confirm('정말 삭제하시겠습니까?')) {
    return;
  }

  try {
    await deletePostFromFirebase(postId);
    
    // 현재 뷰에 따라 처리
    const detailView = document.getElementById('detailView');
    if (!detailView.classList.contains('hidden')) {
      showListView();
    } else {
      renderPosts();
    }
  } catch (error) {
    alert('게시글 삭제 중 오류가 발생했습니다.');
    console.error(error);
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
