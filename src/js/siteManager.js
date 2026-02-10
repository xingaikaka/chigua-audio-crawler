/**
 * 站点管理器
 * 负责站点列表的加载、站点切换等功能
 */

class SiteManager {
  constructor() {
    this.sites = [];
    this.currentSite = null;
    this.initEvents();
    this.loadSites();
  }

  /**
   * 加载站点列表
   */
  async loadSites() {
    try {
      console.log('[SiteManager] 加载站点列表...');
      const result = await window.electronAPI.getSitesList();
      
      if (result.success) {
        this.sites = result.data.sites;
        this.defaultSiteId = result.data.defaultSite;
        
        console.log('[SiteManager] 站点列表加载成功:', this.sites);
        
        // 找到第一个启用的站点作为默认站点
        const firstEnabledSite = this.sites.find(s => s.enabled);
        const defaultSiteId = firstEnabledSite ? firstEnabledSite.id : this.defaultSiteId;
        
        // 加载上次选择的站点，或使用第一个启用的站点
        const savedSiteId = localStorage.getItem('current_site_id');
        const initialSiteId = savedSiteId || defaultSiteId;
        
        console.log('[SiteManager] 默认站点ID:', defaultSiteId, '初始站点ID:', initialSiteId);
        
        await this.switchSite(initialSiteId, true);
        
        // 渲染站点选择器
        this.renderSiteSelector();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('[SiteManager] 加载站点列表失败:', error);
      this.showToast('加载站点列表失败: ' + error.message, 'error');
    }
  }

  /**
   * 切换站点
   */
  async switchSite(siteId, isInitial = false) {
    console.log(`[SiteManager] 切换站点: ${siteId}`);
    
    try {
      // 查找站点信息
      const site = this.sites.find(s => s.id === siteId);
      if (!site) {
        throw new Error(`站点不存在: ${siteId}`);
      }

      // 检查站点是否启用
      if (!site.enabled && !isInitial) {
        this.showToast(`站点 "${site.name}" 暂未启用`, 'warning');
        return false;
      }

      // 显示加载中
      if (!isInitial) {
        this.showLoading();
      }

      // 加载站点配置
      const configResult = await window.electronAPI.getSiteConfig(siteId);
      if (!configResult.success) {
        throw new Error(configResult.error);
      }

      // 更新配置管理器
      window.configManager.loadSiteConfig(configResult.data);

      // 更新当前站点
      this.currentSite = site;
      localStorage.setItem('current_site_id', siteId);

      // 设置全局站点状态
      window.currentState.currentSiteId = siteId;
      
      // 初始化对应的渲染器
      this.initRenderer(site);

      console.log(`[SiteManager] 站点切换成功:`, site);

      // 更新UI
      this.updateSiteUI();
      
      // 加载站点配置到左侧面板
      if (window.siteConfigManager) {
        await window.siteConfigManager.loadSiteConfig(siteId);
      }

      // 重新加载分类
      if (!isInitial) {
        await window.reloadCategories();
        this.showToast(`已切换到站点: ${site.name}`, 'success');
      }

      return true;
    } catch (error) {
      console.error('[SiteManager] 切换站点失败:', error);
      if (!isInitial) {
        this.showToast('切换站点失败: ' + error.message, 'error');
      }
      return false;
    } finally {
      if (!isInitial) {
        this.hideLoading();
      }
    }
  }
  
  /**
   * 初始化渲染器
   */
  initRenderer(site) {
    const rendererType = site.rendererType || 'grid';
    
    console.log(`[SiteManager] 初始化渲染器: ${rendererType}`);
    
    if (rendererType === 'list' && site.type === 'audio') {
      // UAA有声小说使用列表渲染器
      console.log('[SiteManager] >>> 创建 UAAAudioRenderer');
      console.log('[SiteManager] window.UAAAudioRenderer 存在:', !!window.UAAAudioRenderer);
      if (window.UAAAudioRenderer) {
        window.currentState.currentRenderer = new window.UAAAudioRenderer();
        console.log('[SiteManager] ✓ UAAAudioRenderer 创建成功');
      } else {
        console.error('[SiteManager] ✗ window.UAAAudioRenderer 不存在！');
        window.currentState.currentRenderer = null;
      }
    } else {
      // 默认使用卡片渲染器（原51吃瓜的渲染方式）
      console.log('[SiteManager] 使用默认渲染器 (51吃瓜)');
      window.currentState.currentRenderer = null; // 使用原有的renderContentList
    }
  }

  /**
   * 渲染站点导航
   */
  renderSiteSelector() {
    const siteNav = document.getElementById('siteNav');
    if (!siteNav) return;

    siteNav.innerHTML = '';

    this.sites.forEach(site => {
      const item = document.createElement('div');
      item.className = 'site-nav-item';
      
      if (!site.enabled) {
        item.classList.add('disabled');
      }
      
      if (this.currentSite && site.id === this.currentSite.id) {
        item.classList.add('active');
      }

      item.innerHTML = `
        <span class="site-nav-icon">${site.icon}</span>
        <span class="site-nav-name">${site.name}</span>
        ${!site.enabled ? '<span class="site-nav-badge">未启用</span>' : ''}
      `;

      item.addEventListener('click', async () => {
        if (site.enabled && (!this.currentSite || site.id !== this.currentSite.id)) {
          await this.switchSite(site.id);
        }
      });

      siteNav.appendChild(item);
    });
  }

  /**
   * 更新站点UI显示
   */
  updateSiteUI() {
    if (!this.currentSite) return;

    // 更新导航项的激活状态
    document.querySelectorAll('.site-nav-item').forEach(item => {
      item.classList.remove('active');
    });

    const activeIndex = this.sites.findIndex(s => s.id === this.currentSite.id);
    if (activeIndex >= 0) {
      const activeItem = document.querySelectorAll('.site-nav-item')[activeIndex];
      if (activeItem) {
        activeItem.classList.add('active');
      }
    }
  }


  /**
   * 获取当前站点
   */
  getCurrentSite() {
    return this.currentSite;
  }

  /**
   * 初始化事件监听
   */
  initEvents() {
    // 横向导航不需要额外的事件监听
    // 点击事件在 renderSiteSelector 中已经绑定
  }

  /**
   * 显示提示消息
   */
  showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  /**
   * 显示加载遮罩
   */
  showLoading() {
    document.getElementById('loadingOverlay').style.display = 'flex';
  }

  /**
   * 隐藏加载遮罩
   */
  hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
  }
}

// 创建全局实例
window.siteManager = new SiteManager();
