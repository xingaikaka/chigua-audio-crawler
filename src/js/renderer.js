/**
 * 渲染进程主逻辑
 */

// 全局状态
window.currentState = {
  categories: [],
  categoryUrl: null,
  categoryName: null,
  currentPage: 1,
  pagination: null,
  currentSiteId: null,
  currentRenderer: null
};

// 初始化应用
async function initApp() {
  console.log('[Renderer] 初始化应用...');
  
  try {
    // 初始化分页事件
    initPaginationEvents();
    
    // 加载分类
    await loadCategories();
    
    console.log('[Renderer] 应用初始化完成');
  } catch (error) {
    console.error('[Renderer] 初始化失败:', error);
    showToast('应用初始化失败', 'error');
  }
}

// 加载分类列表
async function loadCategories() {
  console.log('[Renderer] 加载分类列表, 站点:', window.currentState.currentSiteId);
  
  try {
    const siteId = window.currentState.currentSiteId || '51chigua';
    const result = await window.electronAPI.getCategories(siteId);
    
    if (result.success) {
      window.currentState.categories = result.data;
      renderCategories(result.data);
      console.log('[Renderer] 分类加载成功:', result.data.length, '个分类');
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('[Renderer] 加载分类失败:', error);
    showToast('加载分类失败: ' + error.message, 'error');
    
    // 显示错误状态
    const navContainer = document.querySelector('.nav-container');
    navContainer.innerHTML = `
      <div class="empty-state">
        <p>加载分类失败</p>
        <button onclick="loadCategories()" style="margin-top: 10px; padding: 10px 20px; background: #8b5cf6; color: white; border: none; border-radius: 8px; cursor: pointer;">重试</button>
      </div>
    `;
  }
}

// 重新加载分类（用于站点切换）
window.reloadCategories = async function() {
  console.log('[Renderer] 重新加载分类...');
  
  // 清空当前状态
  window.currentState.categoryUrl = null;
  window.currentState.categoryName = null;
  window.currentState.currentPage = 1;
  window.currentState.pagination = null;
  
  // 清空内容列表
  const contentList = document.getElementById('contentList');
  contentList.innerHTML = `
    <div class="empty-state">
      <p>请选择一个分类查看内容</p>
    </div>
  `;
  
  // 隐藏工具栏和分页
  document.getElementById('toolbarContainer').style.display = 'none';
  document.getElementById('paginationContainer').style.display = 'none';
  
  // 重新加载分类
  await loadCategories();
}

// 处理分类点击
window.handleCategoryClick = async function(categoryUrl, categoryName) {
  console.log('[Renderer] 点击分类:', categoryName, categoryUrl);
  
  if (!categoryUrl) {
    showToast('该分类暂无内容', 'info');
    return;
  }
  
  try {
    showLoading();
    
    // 更新状态
    window.currentState.categoryUrl = categoryUrl;
    window.currentState.categoryName = categoryName;
    window.currentState.currentPage = 1;
    window.currentState.currentOptions = {}; // 清空筛选条件（点击分类时重置题材筛选）
    
    // 如果是UAA站点，通知renderer保存当前分类URL
    if (window.currentState.currentRenderer && window.currentState.currentRenderer.setCurrentCategoryUrl) {
      window.currentState.currentRenderer.setCurrentCategoryUrl(categoryUrl);
    }
    
    // 设置活动状态
    setActiveCategory(categoryName);
    
    // 获取内容（传递siteId）
    const siteId = window.currentState.currentSiteId || '51chigua';
    const result = await window.electronAPI.getContent(siteId, categoryUrl, 1);
    
    if (result.success) {
      await renderContentList(result.data.items);
      renderPagination(result.data.pagination);
      
      // 更新分页状态
      window.currentState.pagination = result.data.pagination;
      
      showToast(`已切换到: ${categoryName}`, 'success');
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('[Renderer] 加载内容失败:', error);
    showToast('加载内容失败: ' + error.message, 'error');
    
    // 显示错误状态
    const contentList = document.getElementById('contentList');
    contentList.innerHTML = `
      <div class="empty-state">
        <p>加载内容失败</p>
        <button onclick="handleCategoryClick('${categoryUrl}', '${categoryName}')" style="margin-top: 10px; padding: 10px 20px; background: #8b5cf6; color: white; border: none; border-radius: 8px; cursor: pointer;">重试</button>
      </div>
    `;
  } finally {
    hideLoading();
  }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  console.log('[Renderer] DOM加载完成');
  initApp();
});

// 错误处理
window.addEventListener('error', (event) => {
  console.error('[Renderer] 全局错误:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Renderer] 未处理的Promise拒绝:', event.reason);
});
