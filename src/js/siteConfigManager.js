/**
 * 站点配置管理器
 * 负责不同站点的配置管理（使用左侧配置面板）
 */

class SiteConfigManager {
  constructor() {
    this.currentSiteId = null;
    this.currentConfig = null;
    this.initEvents();
  }

  /**
   * 初始化事件（使用事件委托）
   */
  initEvents() {
    const container = document.getElementById('siteConfigContainer');
    if (container) {
      container.addEventListener('click', (e) => {
        if (e.target.id === 'saveConfigBtn' || e.target.closest('#saveConfigBtn')) {
          this.saveConfig();
        }
      });
    }
  }

  /**
   * 加载站点配置到左侧面板
   */
  async loadSiteConfig(siteId) {
    console.log('[SiteConfigManager] 加载站点配置:', siteId);
    
    try {
      this.currentSiteId = siteId;
      
      // 获取站点信息
      const site = window.siteManager.sites.find(s => s.id === siteId);
      if (!site) {
        throw new Error(`站点不存在: ${siteId}`);
      }

      // 加载站点配置
      const result = await window.electronAPI.getSiteConfig(siteId);
      if (!result.success) {
        throw new Error(result.error);
      }

      this.currentConfig = result.data;
      
      // 更新面板标题
      document.getElementById('currentSiteName').textContent = `${site.name} - 配置`;
      
      // 渲染配置表单
      this.renderConfigForm(siteId, this.currentConfig);
      
    } catch (error) {
      console.error('[SiteConfigManager] 加载配置失败:', error);
      this.showToast('加载配置失败: ' + error.message, 'error');
    }
  }

  /**
   * 渲染配置表单到左侧面板
   */
  renderConfigForm(siteId, config) {
    const container = document.getElementById('siteConfigContainer');
    
    // 根据站点类型渲染不同的配置项
    if (siteId === '51chigua') {
      container.innerHTML = this.render51ChiguaConfig(config);
    } else if (siteId === 'uaa') {
      container.innerHTML = this.renderUaaConfig(config);
    } else {
      container.innerHTML = '<p class="empty-hint">该站点暂无可配置项</p>';
    }
  }

  /**
   * 渲染51吃瓜配置
   */
  render51ChiguaConfig(config) {
    return `
      <div class="config-section">
        <h3>🔗 API配置</h3>
        <div class="config-item">
          <label>同步API地址</label>
          <input type="text" id="config_apiBaseUrl" value="${config.apiBaseUrl || ''}" 
                 placeholder="http://47.239.212.188:8880">
        </div>
        <div class="config-item">
          <label>用户UID</label>
          <input type="text" id="config_syncUid" value="${config.syncUid || ''}" 
                 placeholder="1765988676000011375">
        </div>
        <div class="config-item">
          <label>角色代码</label>
          <input type="text" id="config_roleCode" value="${config.roleCode || 'jianzhi'}">
        </div>
        <div class="config-item">
          <label>认证UUID</label>
          <input type="text" id="config_authUuid" value="${config.authUuid || ''}" 
                 placeholder="dd7d5b1b9f1348ec58eb3a1b884b93a2">
        </div>
        <div class="config-item">
          <label>爬虫Token</label>
          <input type="password" id="config_crawlerToken" value="${config.crawlerToken || ''}" 
                 placeholder="UQ8k7P2nV6cXr9T1mK5Zs3YpH8dN4bJ0qL2vW7eA">
        </div>
      </div>

      <div class="config-section">
        <h3>☁️ R2存储配置</h3>
        <div class="config-item">
          <label>R2 Worker URL</label>
          <input type="text" id="config_r2WorkerUrl" value="${config.r2WorkerUrl || ''}" 
                 placeholder="https://khjghjghjjh.xyz/upload">
        </div>
        <div class="config-item">
          <label>R2预览域名</label>
          <input type="text" id="config_r2PreviewDomain" value="${config.r2PreviewDomain || ''}" 
                 placeholder="https://khjghjghjjh.xyz">
        </div>
        <div class="config-item">
          <label>图片加密Key</label>
          <input type="password" id="config_r2ImageEncryptionKey" value="${config.r2ImageEncryptionKey || ''}" 
                 placeholder="cYC8lOMnoUnqzeFhYcGCoLqNa44k9RMfmoorxeS7vIo=">
        </div>
        <div class="config-item">
          <label>图片加密IV</label>
          <input type="password" id="config_r2ImageEncryptionIV" value="${config.r2ImageEncryptionIV || ''}" 
                 placeholder="E9s7nMx5bH1jF3kC6vD2rP8qT4wZ0yL9">
        </div>
      </div>

      <div class="config-section">
        <h3>🔐 图片解密配置</h3>
        <div class="config-item">
          <label>解密Key</label>
          <input type="text" id="config_imageDecryptKey" value="${config.imageDecryptKey || ''}" 
                 placeholder="102_53_100_57_54_53_100_102_55_53_51_51_54_50_55_48">
        </div>
        <div class="config-item">
          <label>解密IV</label>
          <input type="text" id="config_imageDecryptIV" value="${config.imageDecryptIV || ''}" 
                 placeholder="57_55_98_54_48_51_57_52_97_98_99_50_102_98_101_49">
        </div>
      </div>

      <div class="config-section">
        <h3>⚙️ 其他配置</h3>
        <div class="config-item">
          <label>每页数量</label>
          <input type="number" id="config_pageSize" value="${config.pageSize || 20}" min="1" max="100">
        </div>
        <div class="config-item">
          <label>User Agent</label>
          <textarea id="config_userAgent" rows="2">${config.userAgent || ''}</textarea>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="config-actions">
        <button class="btn-primary" id="saveConfigBtn">💾 保存配置</button>
      </div>
    `;
  }

  /**
   * 渲染UAA配置
   */
  renderUaaConfig(config) {
    const cookies = config.cookies || {};
    
    return `
      <div class="config-section">
        <h3>🔗 API配置</h3>
        <div class="config-item">
          <label>同步API地址</label>
          <input type="text" id="config_apiBaseUrl" value="${config.apiBaseUrl || ''}" 
                 placeholder="http://47.239.212.188:8880">
        </div>
        <div class="config-item">
          <label>用户UID</label>
          <input type="text" id="config_syncUid" value="${config.syncUid || ''}" 
                 placeholder="1765988676000011375">
        </div>
        <div class="config-item">
          <label>角色代码</label>
          <input type="text" id="config_roleCode" value="${config.roleCode || 'jianzhi'}">
        </div>
        <div class="config-item">
          <label>认证UUID</label>
          <input type="text" id="config_authUuid" value="${config.authUuid || ''}" 
                 placeholder="dd7d5b1b9f1348ec58eb3a1b884b93a2">
        </div>
        <div class="config-item">
          <label>爬虫Token</label>
          <input type="password" id="config_crawlerToken" value="${config.crawlerToken || ''}" 
                 placeholder="UQ8k7P2nV6cXr9T1mK5Zs3YpH8dN4bJ0qL2vW7eA">
        </div>
      </div>

      <div class="config-section">
        <h3>☁️ R2存储配置</h3>
        <div class="config-item">
          <label>R2 Worker URL</label>
          <input type="text" id="config_r2WorkerUrl" value="${config.r2WorkerUrl || ''}" 
                 placeholder="https://khjghjghjjh.xyz/upload">
        </div>
        <div class="config-item">
          <label>R2预览域名</label>
          <input type="text" id="config_r2PreviewDomain" value="${config.r2PreviewDomain || ''}" 
                 placeholder="https://khjghjghjjh.xyz">
        </div>
        <div class="config-item">
          <label>图片加密Key</label>
          <input type="password" id="config_r2ImageEncryptionKey" value="${config.r2ImageEncryptionKey || ''}" 
                 placeholder="cYC8lOMnoUnqzeFhYcGCoLqNa44k9RMfmoorxeS7vIo=">
        </div>
        <div class="config-item">
          <label>图片加密IV</label>
          <input type="password" id="config_r2ImageEncryptionIV" value="${config.r2ImageEncryptionIV || ''}" 
                 placeholder="E9s7nMx5bH1jF3kC6vD2rP8qT4wZ0yL9">
        </div>
      </div>

      <div class="config-section">
        <h3>🍪 Cookie配置</h3>
        <p style="color: #888; font-size: 12px; margin-bottom: 12px;">
          💡 每个Cookie字段都可以独立修改，请从浏览器开发者工具中获取最新值
        </p>
        
        <div class="config-item">
          <label>token <span style="color: #e74c3c; font-weight: bold;">*</span></label>
          <input type="text" id="config_cookie_token" value="${cookies.token || ''}" 
                 placeholder="eyJhbGciOiJIUzI1NiJ9...">
          <small style="display: block; color: #888; margin-top: 4px;">用户认证令牌（必填）</small>
        </div>
        
        <div class="config-item">
          <label>SESSION <span style="color: #e74c3c; font-weight: bold;">*</span></label>
          <input type="text" id="config_cookie_SESSION" value="${cookies.SESSION || ''}" 
                 placeholder="OTcwNzE3MDMtZTc3Ni00ZmNmLTg2YTMtYjdhMTY5Yzg3MjJj">
          <small style="display: block; color: #888; margin-top: 4px;">会话ID（必填）</small>
        </div>
        
        <div class="config-item">
          <label>Hm_tf_v3ixeqe37a6</label>
          <input type="text" id="config_cookie_Hm_tf_v3ixeqe37a6" value="${cookies.Hm_tf_v3ixeqe37a6 || ''}" 
                 placeholder="1770612774">
        </div>
        
        <div class="config-item">
          <label>Hm_lvt_v3ixeqe37a6</label>
          <input type="text" id="config_cookie_Hm_lvt_v3ixeqe37a6" value="${cookies.Hm_lvt_v3ixeqe37a6 || ''}" 
                 placeholder="1770612774">
        </div>
        
        <div class="config-item">
          <label>_ga</label>
          <input type="text" id="config_cookie__ga" value="${cookies._ga || ''}" 
                 placeholder="GA1.1.650150967.1770612776">
        </div>
        
        <div class="config-item">
          <label>Hm_lpvt_v3ixeqe37a6</label>
          <input type="text" id="config_cookie_Hm_lpvt_v3ixeqe37a6" value="${cookies.Hm_lpvt_v3ixeqe37a6 || ''}" 
                 placeholder="1770618294">
        </div>
        
        <div class="config-item">
          <label>_ga_4BC3P9JVX3</label>
          <input type="text" id="config_cookie__ga_4BC3P9JVX3" value="${cookies._ga_4BC3P9JVX3 || ''}" 
                 placeholder="GS2.1.s1770617697...">
        </div>
        
        <div class="config-item">
          <label>_ga_EDY4YZ85BM</label>
          <input type="text" id="config_cookie__ga_EDY4YZ85BM" value="${cookies._ga_EDY4YZ85BM || ''}" 
                 placeholder="GS2.1.s1770615113...">
        </div>
      </div>

      <div class="config-section">
        <h3>⚙️ 其他配置</h3>
        <div class="config-item">
          <label>每页数量</label>
          <input type="number" id="config_pageSize" value="${config.pageSize || 48}" min="1" max="100">
        </div>
        <div class="config-item">
          <label>最大并发数</label>
          <input type="number" id="config_maxConcurrent" value="${config.maxConcurrent || 2}" min="1" max="10">
        </div>
        <div class="config-item">
          <label>User Agent</label>
          <textarea id="config_userAgent" rows="2">${config.userAgent || ''}</textarea>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="config-actions">
        <button class="btn-primary" id="saveConfigBtn">💾 保存配置</button>
      </div>
    `;
  }

  /**
   * 保存配置
   */
  async saveConfig() {
    console.log('[SiteConfigManager] 保存配置:', this.currentSiteId);
    
    try {
      // 收集表单数据
      const updatedConfig = { ...this.currentConfig };
      
      // 通用配置项
      const configFields = [
        'apiBaseUrl', 'syncUid', 'roleCode', 'authUuid', 'crawlerToken',
        'r2WorkerUrl', 'r2PreviewDomain', 'r2ImageEncryptionKey', 'r2ImageEncryptionIV',
        'imageDecryptKey', 'imageDecryptIV',
        'pageSize', 'userAgent', 'maxConcurrent'
      ];
      
      configFields.forEach(field => {
        const input = document.getElementById(`config_${field}`);
        if (input) {
          const value = input.value.trim();
          if (field === 'pageSize' || field === 'maxConcurrent') {
            updatedConfig[field] = parseInt(value) || updatedConfig[field];
          } else {
            updatedConfig[field] = value || updatedConfig[field];
          }
        }
      });

      // 如果是UAA站点，读取独立的Cookie输入框
      if (this.currentSiteId === 'uaa') {
        const cookieFields = [
          'token', 'SESSION', 'Hm_tf_v3ixeqe37a6', 'Hm_lvt_v3ixeqe37a6',
          '_ga', 'Hm_lpvt_v3ixeqe37a6', '_ga_4BC3P9JVX3', '_ga_EDY4YZ85BM'
        ];
        
        updatedConfig.cookies = {};
        const cookieParts = [];
        
        cookieFields.forEach(field => {
          const input = document.getElementById(`config_cookie_${field}`);
          if (input && input.value.trim()) {
            const value = input.value.trim();
            updatedConfig.cookies[field] = value;
            cookieParts.push(`${field}=${value}`);
          }
        });
        
        // 更新 cookieString
        updatedConfig.cookieString = cookieParts.join('; ');
        
        console.log('[SiteConfigManager] 更新后的Cookies:', updatedConfig.cookies);
        console.log('[SiteConfigManager] 更新后的CookieString:', updatedConfig.cookieString);
      }
      
      console.log('[SiteConfigManager] 更新后的配置:', updatedConfig);
      
      // 调用IPC保存配置
      const result = await window.electronAPI.saveSiteConfig(this.currentSiteId, updatedConfig);
      
      if (result.success) {
        this.showToast('配置保存成功！正在刷新列表...', 'success');
        
        // 更新当前配置缓存
        this.currentConfig = updatedConfig;
        
        // 如果是当前活动站点，重新加载配置并刷新列表
        if (window.currentState && window.currentState.currentSiteId === this.currentSiteId) {
          // 更新 configManager 中的配置
          if (window.configManager) {
            window.configManager.loadSiteConfig(updatedConfig);
          }
          
          // 重新加载分类列表（使用新配置）
          setTimeout(async () => {
            if (window.currentRenderer && window.currentState.categoryUrl) {
              console.log('[SiteConfigManager] 使用新配置重新加载列表');
              const result = await window.electronAPI.getContent(
                this.currentSiteId,
                window.currentState.categoryUrl,
                1,
                window.currentState.currentOptions || {}
              );
              
              if (result.success) {
                await window.renderContentList(result.data.items);
                window.renderPagination(result.data.pagination);
                this.showToast('列表已使用新配置刷新', 'success');
              }
            }
          }, 500);
        }
      } else {
        throw new Error(result.error);
      }
      
    } catch (error) {
      console.error('[SiteConfigManager] 保存配置失败:', error);
      this.showToast('保存配置失败: ' + error.message, 'error');
    }
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
}

// 创建全局实例
window.siteConfigManager = new SiteConfigManager();
