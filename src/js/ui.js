/**
 * UI渲染模块
 */

// 渲染分类导航
function renderCategories(categories) {
  const navContainer = document.querySelector('.nav-container');
  
  if (!categories || categories.length === 0) {
    navContainer.innerHTML = '<div class="empty-state"><p>暂无分类数据</p></div>';
    return;
  }
  
  const navList = document.createElement('ul');
  navList.className = 'nav-list';
  
  categories.forEach(category => {
    const navItem = document.createElement('li');
    navItem.className = 'nav-item';
    
    // 创建一级分类链接
    const navLink = document.createElement('a');
    navLink.className = 'nav-link';
    navLink.textContent = category.name;
    navLink.dataset.url = category.url || '';
    navLink.dataset.name = category.name;
    
    // 如果是高亮分类，添加高亮样式
    if (category.highlight) {
      navLink.classList.add('highlight');
    }
    
    // 判断是否有二级分类
    const hasChildren = category.children && category.children.length > 0;
    
    // 如果有二级分类，标记为不可点击
    if (hasChildren) {
      navLink.classList.add('has-children');
      navLink.style.cursor = 'default';
    } else if (category.url) {
      // 只有没有二级分类的一级分类才可以点击
      navLink.addEventListener('click', (e) => {
        e.preventDefault();
        handleCategoryClick(category.url, category.name);
      });
    }
    
    navItem.appendChild(navLink);
    
    // 如果有子分类，创建下拉菜单
    if (category.children && category.children.length > 0) {
      const subMenu = document.createElement('div');
      subMenu.className = 'sub-menu';
      
      let hideTimer = null;
      
      category.children.forEach(subCategory => {
        const subLink = document.createElement('a');
        subLink.className = 'sub-menu-item';
        subLink.textContent = subCategory.name;
        subLink.dataset.url = subCategory.url;
        subLink.dataset.name = subCategory.name;
        
        // 如果是高亮子分类，添加高亮样式
        if (subCategory.highlight) {
          subLink.classList.add('highlight');
        }
        
        subLink.addEventListener('click', (e) => {
          e.preventDefault();
          subMenu.classList.remove('show');
          handleCategoryClick(subCategory.url, subCategory.name);
        });
        
        subMenu.appendChild(subLink);
      });
      
      navItem.appendChild(subMenu);
      
      // 鼠标进入一级菜单项
      navItem.addEventListener('mouseenter', () => {
        // 清除隐藏定时器
        if (hideTimer) {
          clearTimeout(hideTimer);
          hideTimer = null;
        }
        
        // 计算位置并显示
        const rect = navLink.getBoundingClientRect();
        subMenu.style.top = `${rect.bottom + 5}px`;
        subMenu.style.left = `${rect.left}px`;
        subMenu.classList.add('show');
      });
      
      // 鼠标离开一级菜单项
      navItem.addEventListener('mouseleave', () => {
        // 延迟隐藏，给用户时间移动到二级菜单
        hideTimer = setTimeout(() => {
          subMenu.classList.remove('show');
        }, 200);
      });
      
      // 鼠标进入二级菜单
      subMenu.addEventListener('mouseenter', () => {
        // 清除隐藏定时器，保持显示
        if (hideTimer) {
          clearTimeout(hideTimer);
          hideTimer = null;
        }
      });
      
      // 鼠标离开二级菜单
      subMenu.addEventListener('mouseleave', () => {
        // 立即隐藏
        subMenu.classList.remove('show');
      });
    }
    
    navList.appendChild(navItem);
  });
  
  navContainer.innerHTML = '';
  navContainer.appendChild(navList);
}

// 渲染内容列表
async function renderContentList(items) {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║         [UI] renderContentList 被调用                  ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('[UI] 接收到的items数量:', items ? items.length : 0);
  console.log('[UI] currentState.currentRenderer 存在:', !!window.currentState.currentRenderer);
  console.log('[UI] currentRenderer 类型:', window.currentState.currentRenderer ? window.currentState.currentRenderer.constructor.name : 'null');
  
  // 保存到全局变量
  window.currentContentItems = items;
  
  // 检查是否有自定义渲染器
  if (window.currentState.currentRenderer) {
    console.log('[UI] ✓ 使用自定义渲染器:', window.currentState.currentRenderer.constructor.name);
    console.log('[UI] >>> 调用 renderer.renderContentList...');
    window.currentState.currentRenderer.renderContentList(items);
    console.log('[UI] <<< renderer.renderContentList 返回');
  } else {
    console.log('[UI] ✓ 使用默认渲染器 (51吃瓜)');
    // 使用带复选框的渲染函数（51吃瓜原有方式）
  window.renderContentListWithCheckbox(items);
  
  // 自动检查并标记已同步的视频（无感知）
  await autoCheckSyncStatus(items);
  }
  
  console.log('[UI] renderContentList 完成\n');
}

/**
 * 自动检查并标记已同步的视频
 */
async function autoCheckSyncStatus(items) {
  console.log('[AutoCheck] === 开始自动检查同步状态 ===');
  console.log('[AutoCheck] 输入 items 数量:', items ? items.length : 0);
  
  if (!items || items.length === 0) {
    console.log('[AutoCheck] items 为空，跳过检查');
    return;
  }
  
  try {
    // 提取 article_id 和 title
    const checkItems = items
      .map(item => {
        // 优先使用 item.article_id
        let articleId = item.article_id;
        
        // 如果不存在，尝试从 item.id 中提取（格式：item-12345）
        if (!articleId) {
          const idMatch = item.id.match(/item-(\d+)/);
          articleId = idMatch ? parseInt(idMatch[1]) : null;
        }
        
        return {
          itemId: item.id,
          articleId: articleId,
          title: item.title || ''
        };
      })
      .filter(item => item.articleId && item.articleId > 0); // 过滤无效ID
    
    console.log('[AutoCheck] 提取到有效 article_id 数量:', checkItems.length);
    
    if (checkItems.length === 0) {
      console.log('[AutoCheck] 没有有效的 article_id，跳过检查');
      return;
    }
    
    // 获取配置
    const config = window.configManager.getAll();
    if (!config.apiBaseUrl) {
      console.log('[AutoCheck] apiBaseUrl 未配置，跳过自动检查');
      return;
    }
    
    console.log('[AutoCheck] 配置信息:');
    console.log('[AutoCheck]   - apiBaseUrl:', config.apiBaseUrl);
    console.log('[AutoCheck]   - authUuid:', config.authUuid);
    console.log('[AutoCheck]   - crawlerToken:', config.crawlerToken ? '已配置' : '未配置');
    
    // 提取 article_id 列表
    const articleIds = checkItems.map(item => String(item.articleId));
    
    console.log(`[AutoCheck] 开始自动检查 ${articleIds.length} 条内容的同步状态...`);
    console.log(`[AutoCheck] article_ids:`, articleIds.slice(0, 5), '...');
    
    // 调用后端 API
    const result = await window.electronAPI.checkSyncStatus(
      articleIds,
      config
    );
    
    console.log(`[AutoCheck] API 调用结果:`, result);
    
    if (result.success && result.data) {
      let syncedCount = 0;
      
      // 标记已同步的项目
      checkItems.forEach(item => {
        const statusData = result.data[String(item.articleId)];
        if (statusData && statusData.exists) {
          // 标记为已同步
          window.syncStateManager.markAsSynced(item.itemId);
          syncedCount++;
        }
      });
      
      if (syncedCount > 0) {
        console.log(`[AutoCheck] ✅ 自动标记了 ${syncedCount} 条已同步内容`);
        
        // 重新渲染列表以显示已同步状态
        window.renderContentListWithCheckbox(items);
      } else {
        console.log(`[AutoCheck] 当前页面没有已同步的内容`);
      }
    }
  } catch (error) {
    console.error('[AutoCheck] 自动检查失败:', error);
    // 失败不影响正常使用，静默处理
  }
}

// 渲染分页器
function renderPagination(pagination) {
  const paginationContainer = document.getElementById('paginationContainer');
  const paginationInfo = document.getElementById('paginationInfo');
  const pageNumbers = document.getElementById('pageNumbers');
  const firstBtn = document.getElementById('firstPage');
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');
  const lastBtn = document.getElementById('lastPage');
  const pageInput = document.getElementById('pageInput');
  
  if (!pagination || pagination.total <= 1) {
    paginationContainer.style.display = 'none';
    return;
  }
  
  paginationContainer.style.display = 'flex';
  
  const current = pagination.current;
  const total = pagination.total;
  
  // 更新分页信息
  paginationInfo.textContent = `第 ${current} 页，共 ${total} 页`;
  
  // 更新输入框最大值
  pageInput.max = total;
  pageInput.placeholder = `1-${total}`;
  
  // 更新按钮状态
  firstBtn.disabled = current <= 1;
  prevBtn.disabled = !pagination.hasPrev || current <= 1;
  nextBtn.disabled = !pagination.hasNext || current >= total;
  lastBtn.disabled = current >= total;
  
  // 生成页码
  pageNumbers.innerHTML = '';
  
  const maxPages = 9; // 最多显示9个页码
  
  let startPage = Math.max(1, current - Math.floor(maxPages / 2));
  let endPage = Math.min(total, startPage + maxPages - 1);
  
  // 调整起始页，确保显示足够的页码
  if (endPage - startPage < maxPages - 1) {
    startPage = Math.max(1, endPage - maxPages + 1);
  }
  
  // 第一页（如果不在显示范围内）
  if (startPage > 1) {
    addPageNumber(1, current);
    if (startPage > 2) {
      const ellipsis = document.createElement('span');
      ellipsis.className = 'page-number ellipsis';
      ellipsis.textContent = '...';
      ellipsis.style.cursor = 'default';
      ellipsis.style.border = 'none';
      ellipsis.style.background = 'transparent';
      pageNumbers.appendChild(ellipsis);
    }
  }
  
  // 中间页码
  for (let i = startPage; i <= endPage; i++) {
    addPageNumber(i, current);
  }
  
  // 最后一页（如果不在显示范围内）
  if (endPage < total) {
    if (endPage < total - 1) {
      const ellipsis = document.createElement('span');
      ellipsis.className = 'page-number ellipsis';
      ellipsis.textContent = '...';
      ellipsis.style.cursor = 'default';
      ellipsis.style.border = 'none';
      ellipsis.style.background = 'transparent';
      pageNumbers.appendChild(ellipsis);
    }
    addPageNumber(total, current);
  }
}

// 添加页码按钮
function addPageNumber(pageNum, currentPage) {
  const pageNumbers = document.getElementById('pageNumbers');
  const pageBtn = document.createElement('span');
  pageBtn.className = 'page-number';
  pageBtn.textContent = pageNum;
  
  if (pageNum === currentPage) {
    pageBtn.classList.add('active');
  } else {
    pageBtn.addEventListener('click', () => {
      window.goToPage(pageNum);
    });
  }
  
  pageNumbers.appendChild(pageBtn);
}

// 显示加载遮罩
function showLoading() {
  document.getElementById('loadingOverlay').style.display = 'flex';
}

// 隐藏加载遮罩
function hideLoading() {
  document.getElementById('loadingOverlay').style.display = 'none';
}

// 显示Toast提示
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast';
  
  if (type === 'error') {
    toast.classList.add('error');
  } else if (type === 'success') {
    toast.classList.add('success');
  }
  
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// 设置活动分类
function setActiveCategory(categoryName) {
  // 移除所有活动状态
  document.querySelectorAll('.nav-link, .sub-menu-item').forEach(link => {
    link.classList.remove('active');
  });
  
  // 添加活动状态
  const targetLink = document.querySelector(`[data-name="${categoryName}"]`);
  if (targetLink) {
    targetLink.classList.add('active');
  }
}

// 加载并解密图片
async function loadAndDecryptImage(imageUrl, title) {
  try {
    if (!imageUrl) {
      throw new Error('图片URL为空');
    }
    
    // 调用主进程的解密接口
    const result = await window.electronAPI.decryptImage(imageUrl);
    
    if (!result.success) {
      throw new Error(result.error || '图片解密失败');
    }
    
    return result.data;
  } catch (error) {
    console.error(`加载图片失败 [${title}]:`, error);
    throw error;
  }
}
