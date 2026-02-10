/**
 * 分页逻辑模块
 */

// 初始化分页按钮事件
function initPaginationEvents() {
  const firstBtn = document.getElementById('firstPage');
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');
  const lastBtn = document.getElementById('lastPage');
  const jumpBtn = document.getElementById('jumpBtn');
  const pageInput = document.getElementById('pageInput');
  
  // 首页
  firstBtn.addEventListener('click', () => {
    if (window.currentState && window.currentState.currentPage > 1) {
      window.goToPage(1);
    }
  });
  
  // 上一页
  prevBtn.addEventListener('click', () => {
    if (window.currentState && window.currentState.currentPage > 1) {
      window.goToPage(window.currentState.currentPage - 1);
    }
  });
  
  // 下一页
  nextBtn.addEventListener('click', () => {
    if (window.currentState && window.currentState.pagination.hasNext) {
      window.goToPage(window.currentState.currentPage + 1);
    }
  });
  
  // 尾页
  lastBtn.addEventListener('click', () => {
    if (window.currentState && window.currentState.pagination) {
      const total = window.currentState.pagination.total;
      if (total > window.currentState.currentPage) {
        window.goToPage(total);
      }
    }
  });
  
  // 跳转按钮
  jumpBtn.addEventListener('click', () => {
    handlePageJump();
  });
  
  // 输入框回车跳转
  pageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handlePageJump();
    }
  });
}

// 处理页码跳转
function handlePageJump() {
  const pageInput = document.getElementById('pageInput');
  const targetPage = parseInt(pageInput.value);
  
  if (!targetPage || isNaN(targetPage)) {
    showToast('请输入有效的页码', 'error');
    return;
  }
  
  if (!window.currentState || !window.currentState.pagination) {
    showToast('请先选择分类', 'error');
    return;
  }
  
  const total = window.currentState.pagination.total;
  
  if (targetPage < 1) {
    showToast('页码不能小于1', 'error');
    return;
  }
  
  if (targetPage > total) {
    showToast(`页码不能大于${total}`, 'error');
    return;
  }
  
  if (targetPage === window.currentState.currentPage) {
    showToast('已经在当前页', 'info');
    return;
  }
  
  pageInput.value = '';
  window.goToPage(targetPage);
}

// 跳转到指定页码
window.goToPage = async function(page) {
  if (!window.currentState || !window.currentState.categoryUrl) {
    showToast('请先选择分类', 'error');
    return;
  }
  
  const { categoryUrl, categoryName, currentOptions } = window.currentState;
  
  try {
    showLoading();
    
    // 获取内容（传递siteId和options，options包含题材等筛选参数）
    const siteId = window.currentState.currentSiteId || '51chigua';
    const options = currentOptions || {}; // 携带题材筛选参数
    
    console.log('[Pagination] 跳转到第', page, '页, 筛选条件:', options);
    
    const result = await window.electronAPI.getContent(siteId, categoryUrl, page, options);
    
    if (result.success) {
      await renderContentList(result.data.items);
      renderPagination(result.data.pagination);
      
      // 更新状态
      window.currentState.currentPage = page;
      window.currentState.pagination = result.data.pagination;
      
      // 滚动到顶部
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      showToast('加载失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('跳转页码失败:', error);
    showToast('加载失败，请重试', 'error');
  } finally {
    hideLoading();
  }
};
