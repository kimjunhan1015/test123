// Firebase Firestore를 사용한 게시글 데이터 관리
let posts = [];
let comments = [];
let currentPostId = null;
const COLLECTION_NAME = 'posts';
const COMMENTS_COLLECTION = 'comments';
const AUTHOR_ID_KEY = 'anonymousBoardAuthorId';

// 브라우저별 고유 식별자 가져오기 또는 생성
function getAuthorId() {
  let authorId = localStorage.getItem(AUTHOR_ID_KEY);
  if (!authorId) {
    // 고유 식별자 생성 (타임스탬프 + 랜덤 문자열)
    authorId = 'author_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem(AUTHOR_ID_KEY, authorId);
  }
  return authorId;
}

// 초기화
async function init() {
  // Firebase가 로드될 때까지 대기
  if (!window.db) {
    setTimeout(init, 100);
    return;
  }
  
  await loadPosts();
  setupEventListeners();
  await showListView();
  setupRealtimeListener();
  
  // 초기 로드 시 목록 버튼 숨기기
  const listBtn = document.getElementById('listBtn');
  const writeBtn = document.getElementById('writeBtn');
  if (listBtn) listBtn.style.display = 'none';
  if (writeBtn) writeBtn.style.display = 'none';
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

// 게시글의 모든 댓글과 대댓글 삭제
async function deleteAllCommentsForPost(postId) {
  try {
    const { collection, getDocs, query, where, doc, deleteDoc, writeBatch } = window.firestoreFunctions;
    const commentsRef = collection(window.db, COMMENTS_COLLECTION);
    const q = query(commentsRef, where('postId', '==', postId));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return; // 댓글이 없으면 종료
    }
    
    // 배치로 삭제 (500개씩)
    const batch = writeBatch(window.db);
    let count = 0;
    
    querySnapshot.forEach((docSnapshot) => {
      if (count < 500) { // Firestore 배치 제한
        batch.delete(doc(window.db, COMMENTS_COLLECTION, docSnapshot.id));
        count++;
      }
    });
    
    if (count > 0) {
      await batch.commit();
    }
    
    // 500개를 초과하는 경우 재귀 호출
    if (querySnapshot.size > 500) {
      await deleteAllCommentsForPost(postId);
    }
  } catch (error) {
    console.error('댓글 일괄 삭제 실패:', error);
    throw error;
  }
}

// 특정 댓글의 모든 대댓글 삭제
async function deleteAllRepliesForComment(commentId) {
  try {
    const { collection, getDocs, query, where, doc, deleteDoc, writeBatch } = window.firestoreFunctions;
    const commentsRef = collection(window.db, COMMENTS_COLLECTION);
    const q = query(commentsRef, where('parentCommentId', '==', commentId));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return; // 대댓글이 없으면 종료
    }
    
    // 재귀적으로 모든 하위 대댓글도 삭제
    const deletePromises = [];
    querySnapshot.forEach((docSnapshot) => {
      const replyId = docSnapshot.id;
      // 각 대댓글의 하위 대댓글도 재귀적으로 삭제
      deletePromises.push(deleteAllRepliesForComment(replyId));
      // 대댓글 자체도 삭제 목록에 추가
      deletePromises.push(
        deleteDoc(doc(window.db, COMMENTS_COLLECTION, replyId))
      );
    });
    
    await Promise.all(deletePromises);
  } catch (error) {
    console.error('대댓글 일괄 삭제 실패:', error);
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
  document.getElementById('writeBtnBottom').addEventListener('click', showWriteView);
  document.getElementById('cancelBtn').addEventListener('click', showListView);
  document.getElementById('backBtn').addEventListener('click', showListView);

  // 글 작성 폼
  document.getElementById('postForm').addEventListener('submit', handleSubmit);
}

// 뷰 전환 함수들
async function showListView() {
  document.getElementById('listView').classList.remove('hidden');
  document.getElementById('writeView').classList.add('hidden');
  document.getElementById('detailView').classList.add('hidden');
  document.getElementById('listBtn').classList.add('active');
  document.getElementById('listBtn').style.display = 'none'; // 목록 버튼 숨기기
  document.getElementById('writeBtn').classList.remove('active');
  document.getElementById('writeBtn').style.display = 'none'; // 상단 글쓰기 버튼 숨기기
  await renderPosts();
}

function showWriteView() {
  document.getElementById('listView').classList.add('hidden');
  document.getElementById('writeView').classList.remove('hidden');
  document.getElementById('detailView').classList.add('hidden');
  document.getElementById('listBtn').classList.remove('active');
  document.getElementById('listBtn').style.display = 'block'; // 글쓰기 화면에서는 목록 버튼 표시
  document.getElementById('writeBtn').classList.add('active');
  document.getElementById('writeBtn').style.display = 'block'; // 글쓰기 화면에서는 글쓰기 버튼 표시
  document.getElementById('postForm').reset();
}

function showDetailView(postId) {
  document.getElementById('listView').classList.add('hidden');
  document.getElementById('writeView').classList.add('hidden');
  document.getElementById('detailView').classList.remove('hidden');
  document.getElementById('listBtn').style.display = 'none'; // 상세 화면에서도 목록 버튼 숨기기
  document.getElementById('writeBtn').style.display = 'none'; // 상세 화면에서도 글쓰기 버튼 숨기기
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
      authorId: getAuthorId(), // 작성자 식별자 추가
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

// 게시글의 댓글 개수 가져오기
async function getCommentCount(postId) {
  try {
    const { collection, getDocs, query, where } = window.firestoreFunctions;
    const commentsRef = collection(window.db, COMMENTS_COLLECTION);
    const q = query(commentsRef, where('postId', '==', postId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.size; // 댓글과 대댓글 모두 포함
  } catch (error) {
    console.error('댓글 개수 가져오기 실패:', error);
    return 0;
  }
}


// 이번 주 시작일(월요일)과 종료일(일요일) 계산
function getThisWeekRange() {
  const now = new Date();
  const day = now.getDay(); // 0(일요일) ~ 6(토요일)
  const diff = day === 0 ? -6 : 1 - day; // 월요일까지의 차이
  
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  return { start: monday, end: sunday };
}

// 이번 달 시작일과 종료일 계산
function getThisMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

// 인기글 가져오기
async function getPopularPost(posts, dateRange) {
  // 해당 기간의 게시물 필터링
  const filteredPosts = posts.filter(post => {
    const postDate = new Date(post.date);
    return postDate >= dateRange.start && postDate <= dateRange.end;
  });
  
  if (filteredPosts.length === 0) {
    return null;
  }
  
  // 각 게시물의 댓글 개수 계산
  const postsWithCommentCount = await Promise.all(
    filteredPosts.map(async (post) => {
      const commentCount = await getCommentCount(post.id);
      return { ...post, commentCount };
    })
  );
  
  // 댓글 개수로 정렬 (동점시 날짜 오름차순 - 먼저 등록된 것 우선)
  postsWithCommentCount.sort((a, b) => {
    if (b.commentCount !== a.commentCount) {
      return b.commentCount - a.commentCount; // 댓글 많은 순
    }
    return new Date(a.date) - new Date(b.date); // 동점시 먼저 등록된 것
  });
  
  return postsWithCommentCount[0]; // 가장 인기 있는 게시물
}

// 인기글 렌더링
async function renderPopularPosts() {
  const popularPostsSection = document.getElementById('popularPosts');
  if (!popularPostsSection) return;
  
  const weekRange = getThisWeekRange();
  const monthRange = getThisMonthRange();
  
  const weekPopular = await getPopularPost(posts, weekRange);
  const monthPopular = await getPopularPost(posts, monthRange);
  
  let html = '<div class="popular-posts-container">';
  
  // 이번 주 인기글
  html += '<div class="popular-post-category">';
  html += '<h3 class="popular-title">이번 주 인기글</h3>';
  if (weekPopular && weekPopular.commentCount > 0) {
    html += `
      <div class="popular-post-item" onclick="showDetailView('${weekPopular.id}')">
        <div class="popular-post-title">${escapeHtml(weekPopular.title)}</div>
        <div class="popular-post-meta">
          <span class="popular-post-date">${formatDate(weekPopular.date)}</span>
          <span class="popular-post-comments">댓글 ${weekPopular.commentCount}</span>
        </div>
      </div>
    `;
  } else {
    html += '<p class="no-popular-post">이번 주 인기글이 없습니다.</p>';
  }
  html += '</div>';
  
  // 이번 달 인기글
  html += '<div class="popular-post-category">';
  html += '<h3 class="popular-title">이번 달 인기글</h3>';
  if (monthPopular && monthPopular.commentCount > 0) {
    html += `
      <div class="popular-post-item" onclick="showDetailView('${monthPopular.id}')">
        <div class="popular-post-title">${escapeHtml(monthPopular.title)}</div>
        <div class="popular-post-meta">
          <span class="popular-post-date">${formatDate(monthPopular.date)}</span>
          <span class="popular-post-comments">댓글 ${monthPopular.commentCount}</span>
        </div>
      </div>
    `;
  } else {
    html += '<p class="no-popular-post">이번 달 인기글이 없습니다.</p>';
  }
  html += '</div>';
  
  html += '</div>';
  popularPostsSection.innerHTML = html;
}

// 게시글 목록 렌더링
async function renderPosts() {
  const postsList = document.getElementById('postsList');
  const emptyState = document.getElementById('emptyState');

  // 인기글 렌더링
  await renderPopularPosts();

  if (posts.length === 0) {
    postsList.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  
  // 각 게시물의 댓글 개수 가져오기
  const postsWithCommentCount = await Promise.all(
    posts.map(async (post) => {
      const commentCount = await getCommentCount(post.id);
      return { ...post, commentCount };
    })
  );
  
  postsList.innerHTML = postsWithCommentCount.map(post => `
    <div class="post-item">
      <div class="post-header" onclick="showDetailView('${post.id}')">
        <div class="post-title">${escapeHtml(post.title)}</div>
        <div class="post-meta-right">
          <div class="post-date">${formatDate(post.date)}</div>
          <div class="post-comment-count">댓글 ${post.commentCount}</div>
        </div>
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

  currentPostId = postId;
  const currentAuthorId = getAuthorId();
  const isAuthor = post.authorId === currentAuthorId;
  
  const detailContainer = document.getElementById('postDetail');
  detailContainer.innerHTML = `
    <div class="article-header">
      <h2 class="article-title">${escapeHtml(post.title)}</h2>
      <div class="article-meta">
        <span>작성일: ${formatDate(post.date)}</span>
      </div>
    </div>
    <div class="article-content">${escapeHtml(post.content)}</div>
    ${isAuthor ? `
    <div class="article-footer">
      <button class="delete-btn" onclick="deletePost('${post.id}')">삭제</button>
    </div>
    ` : ''}
  `;
  
  // 댓글 로드
  loadComments(postId);
  // 댓글 실시간 리스너 설정
  setupCommentsListener(postId);
}

// 게시글 삭제
async function deletePost(postId) {
  const post = posts.find(p => p.id === postId);
  if (!post) {
    alert('게시글을 찾을 수 없습니다.');
    return;
  }

  const currentAuthorId = getAuthorId();
  if (post.authorId !== currentAuthorId) {
    alert('본인이 작성한 게시글만 삭제할 수 있습니다.');
    return;
  }

  if (!confirm('정말 삭제하시겠습니까?')) {
    return;
  }

  try {
    // 먼저 해당 게시글의 모든 댓글과 대댓글 삭제
    await deleteAllCommentsForPost(postId);
    
    // 그 다음 게시글 삭제
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

// 날짜 포맷팅 (yyyy-mm-dd hh:mm 형식)
function formatDate(dateString) {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}  ${hours}:${minutes}`;
}

// HTML 이스케이프 (XSS 방지)
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 댓글 불러오기
async function loadComments(postId) {
  try {
    const { collection, getDocs, query, orderBy, where } = window.firestoreFunctions;
    const commentsRef = collection(window.db, COMMENTS_COLLECTION);
    
    let querySnapshot;
    try {
      // orderBy를 포함한 쿼리 시도 (인덱스가 있으면 작동)
      const q = query(commentsRef, where('postId', '==', postId), orderBy('date', 'asc'));
      querySnapshot = await getDocs(q);
    } catch (indexError) {
      // 인덱스가 없으면 where만 사용
      console.warn('인덱스가 없어 날짜 정렬을 건너뜁니다. 모든 댓글을 불러온 후 정렬합니다.');
      const q = query(commentsRef, where('postId', '==', postId));
      querySnapshot = await getDocs(q);
    }
    
    comments = [];
    querySnapshot.forEach((doc) => {
      comments.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // 클라이언트 측에서 날짜 정렬
    comments.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA - dateB;
    });
    
    renderComments();
  } catch (error) {
    console.error('댓글 불러오기 실패:', error);
    // 에러 메시지를 콘솔에만 표시하고 사용자에게는 조용히 처리
  }
}

// 댓글 실시간 리스너 설정
let commentsListenerUnsubscribe = null;

function setupCommentsListener(postId) {
  // 기존 리스너가 있으면 제거
  if (commentsListenerUnsubscribe) {
    commentsListenerUnsubscribe();
    commentsListenerUnsubscribe = null;
  }
  
  try {
    const { collection, query, orderBy, where, onSnapshot } = window.firestoreFunctions;
    const commentsRef = collection(window.db, COMMENTS_COLLECTION);
    
    // 먼저 orderBy를 포함한 쿼리 시도
    let q;
    try {
      q = query(commentsRef, where('postId', '==', postId), orderBy('date', 'asc'));
    } catch (indexError) {
      // 인덱스가 없으면 where만 사용
      console.warn('인덱스가 없어 날짜 정렬을 건너뜁니다.');
      q = query(commentsRef, where('postId', '==', postId));
    }
    
    commentsListenerUnsubscribe = onSnapshot(q, (snapshot) => {
      comments = [];
      snapshot.forEach((doc) => {
        comments.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      // 클라이언트 측에서 날짜 정렬
      comments.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateA - dateB;
      });
      
      renderComments();
    }, (error) => {
      console.error('댓글 리스너 오류:', error);
      // 인덱스 오류인 경우 where만 사용하여 재시도
      if (error.code === 'failed-precondition') {
        console.log('인덱스 오류로 인해 where만 사용하여 재시도합니다.');
        const simpleQ = query(commentsRef, where('postId', '==', postId));
        commentsListenerUnsubscribe = onSnapshot(simpleQ, (snapshot) => {
          comments = [];
          snapshot.forEach((doc) => {
            comments.push({
              id: doc.id,
              ...doc.data()
            });
          });
          comments.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return dateA - dateB;
          });
          renderComments();
        });
      }
    });
  } catch (error) {
    console.error('댓글 리스너 설정 실패:', error);
  }
}

// 댓글 작성
async function submitComment(parentCommentId = null) {
  const content = document.getElementById('commentContent').value.trim();
  
  if (!content) {
    alert('댓글 내용을 입력해주세요.');
    return;
  }
  
  if (!currentPostId) {
    alert('게시글을 찾을 수 없습니다.');
    return;
  }
  
  try {
    const { collection, addDoc } = window.firestoreFunctions;
    const commentsRef = collection(window.db, COMMENTS_COLLECTION);
    await addDoc(commentsRef, {
      postId: currentPostId,
      parentCommentId: parentCommentId,
      authorId: getAuthorId(),
      content: content,
      date: new Date().toISOString(),
    });
    
    document.getElementById('commentContent').value = '';
    
    // 대댓글 작성 폼 숨기기
    if (parentCommentId) {
      const replyForm = document.getElementById(`replyForm-${parentCommentId}`);
      if (replyForm) {
        replyForm.style.display = 'none';
      }
    }
  } catch (error) {
    console.error('댓글 작성 실패:', error);
    alert('댓글 작성 중 오류가 발생했습니다: ' + error.message);
  }
}

// 댓글 삭제
async function deleteComment(commentId) {
  if (!confirm('정말 삭제하시겠습니까?')) {
    return;
  }
  
  const comment = comments.find(c => c.id === commentId);
  if (!comment) {
    return;
  }
  
  const currentAuthorId = getAuthorId();
  if (comment.authorId !== currentAuthorId) {
    alert('본인이 작성한 댓글만 삭제할 수 있습니다.');
    return;
  }
  
  try {
    // 먼저 해당 댓글의 모든 대댓글 삭제
    await deleteAllRepliesForComment(commentId);
    
    // 그 다음 댓글 삭제
    const { doc, deleteDoc } = window.firestoreFunctions;
    const commentRef = doc(window.db, COMMENTS_COLLECTION, commentId);
    await deleteDoc(commentRef);
  } catch (error) {
    console.error('댓글 삭제 실패:', error);
    alert('댓글 삭제 중 오류가 발생했습니다.');
  }
}

// 댓글 렌더링
function renderComments() {
  const commentsList = document.getElementById('commentsList');
  if (!commentsList) return;
  
  const currentAuthorId = getAuthorId();
  
  // 일반 댓글과 대댓글 분리
  const topLevelComments = comments.filter(c => !c.parentCommentId);
  
  if (topLevelComments.length === 0) {
    commentsList.innerHTML = '<p class="no-comments">아직 댓글이 없습니다.</p>';
    return;
  }
  
  commentsList.innerHTML = topLevelComments.map(comment => {
    const isAuthor = comment.authorId === currentAuthorId;
    const replies = comments.filter(c => c.parentCommentId === comment.id);
    
    return renderCommentItem(comment, isAuthor, replies, currentAuthorId);
  }).join('');
}

// 댓글 아이템 렌더링
function renderCommentItem(comment, isAuthor, replies, currentAuthorId) {
  let html = `
    <div class="comment-item" data-comment-id="${comment.id}">
      <div class="comment-content">
        <div class="comment-text">${escapeHtml(comment.content)}</div>
        <div class="comment-meta">
          <span class="comment-date">${formatDate(comment.date)}</span>
          <div class="comment-actions">
            <button class="reply-btn" onclick="toggleReplyForm('${comment.id}')">답글</button>
            ${isAuthor ? `<button class="delete-comment-btn" onclick="deleteComment('${comment.id}')">삭제</button>` : ''}
          </div>
        </div>
      </div>
      <div id="replyForm-${comment.id}" class="reply-form hidden">
        <textarea id="replyContent-${comment.id}" placeholder="답글을 입력하세요..." rows="2" maxlength="500"></textarea>
        <div class="reply-form-actions">
          <button class="btn btn-secondary btn-small" onclick="cancelReply('${comment.id}')">취소</button>
          <button class="btn btn-primary btn-small" onclick="submitReply('${comment.id}')">작성</button>
        </div>
      </div>
      ${replies.length > 0 ? `
      <div class="replies">
        ${replies.map(reply => {
          const isReplyAuthor = reply.authorId === currentAuthorId;
          return `
          <div class="reply-item">
            <div class="comment-content">
              <div class="comment-text">${escapeHtml(reply.content)}</div>
              <div class="comment-meta">
                <span class="comment-date">${formatDate(reply.date)}</span>
                ${isReplyAuthor ? `<button class="delete-comment-btn" onclick="deleteComment('${reply.id}')">삭제</button>` : ''}
              </div>
            </div>
          </div>
          `;
        }).join('')}
      </div>
      ` : ''}
    </div>
  `;
  
  return html;
}

// 답글 폼 토글
function toggleReplyForm(commentId) {
  const replyForm = document.getElementById(`replyForm-${commentId}`);
  if (replyForm) {
    replyForm.classList.toggle('hidden');
    if (!replyForm.classList.contains('hidden')) {
      const textarea = document.getElementById(`replyContent-${commentId}`);
      if (textarea) {
        textarea.focus();
      }
    }
  }
}

// 답글 작성
function submitReply(parentCommentId) {
  const textarea = document.getElementById(`replyContent-${parentCommentId}`);
  if (!textarea) return;
  
  const content = textarea.value.trim();
  if (!content) {
    alert('답글 내용을 입력해주세요.');
    return;
  }
  
  // 댓글 작성 함수 호출
  const { collection, addDoc } = window.firestoreFunctions;
  const commentsRef = collection(window.db, COMMENTS_COLLECTION);
  addDoc(commentsRef, {
    postId: currentPostId,
    parentCommentId: parentCommentId,
    authorId: getAuthorId(),
    content: content,
    date: new Date().toISOString(),
  }).then(() => {
    textarea.value = '';
    const replyForm = document.getElementById(`replyForm-${parentCommentId}`);
    if (replyForm) {
      replyForm.classList.add('hidden');
    }
  }).catch(error => {
    console.error('답글 작성 실패:', error);
    alert('답글 작성 중 오류가 발생했습니다.');
  });
}

// 답글 취소
function cancelReply(commentId) {
  const replyForm = document.getElementById(`replyForm-${commentId}`);
  const textarea = document.getElementById(`replyContent-${commentId}`);
  if (replyForm) {
    replyForm.classList.add('hidden');
  }
  if (textarea) {
    textarea.value = '';
  }
}

// 전역 함수로 등록 (onclick에서 사용하기 위해)
window.showDetailView = showDetailView;
window.deletePost = deletePost;
window.submitComment = submitComment;
window.deleteComment = deleteComment;
window.toggleReplyForm = toggleReplyForm;
window.submitReply = submitReply;
window.cancelReply = cancelReply;

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', init);
