/**
 * 爬虫工厂
 * 根据站点配置创建对应的爬虫实例
 */

class CrawlerFactory {
  /**
   * 创建爬虫实例
   * @param {Object} siteConfig 站点配置
   * @returns {Object} 爬虫实例
   */
  static create(siteConfig) {
    const crawlerModule = siteConfig.crawlerModule || 'default';
    
    console.log(`[CrawlerFactory] 创建爬虫实例: ${crawlerModule}`);
    
    try {
      switch (crawlerModule) {
        case '51chigua':
          return this.create51ChiguaCrawler(siteConfig);
        
        case 'uaa':
          return this.createUAACrawler(siteConfig);
        
        case 'tianya':
          return this.createTianyaCrawler(siteConfig);
        
        default:
          throw new Error(`未知的爬虫模块: ${crawlerModule}`);
      }
    } catch (error) {
      console.error(`[CrawlerFactory] 创建爬虫失败:`, error);
      throw error;
    }
  }
  
  /**
   * 创建51吃瓜爬虫实例
   */
  static create51ChiguaCrawler(config) {
    // 使用原有的爬虫模块（保持向后兼容）
    const categoryParser = require('../categoryParser');
    const contentParser = require('../contentParser');
    
    return {
      type: '51chigua',
      config: config,
      
      getCategories: () => {
        console.log('[51ChiguaCrawler] 获取分类列表');
        return categoryParser.getCategories();
      },
      
      getContent: (categoryUrl, page) => {
        console.log('[51ChiguaCrawler] 获取内容:', categoryUrl, 'page:', page);
        return contentParser.getContent(categoryUrl, page);
      }
    };
  }
  
  /**
   * 创建UAA有声小说爬虫实例
   */
  static createUAACrawler(config) {
    const audioListParser = require('../uaa/audioListParser');
    
    return {
      type: 'uaa',
      config: config,
      
      getCategories: () => {
        console.log('[UAACrawler] 获取分类列表');
        return audioListParser.getCategories();
      },
      
      getContent: (categoryUrl, page, options = {}) => {
        console.log('[UAACrawler] 获取音频列表:', categoryUrl, 'page:', page, 'options:', options);
        return audioListParser.getAudioList(categoryUrl, page, options);
      }
    };
  }
  
  /**
   * 创建天涯爬虫实例（未实现）
   */
  static createTianyaCrawler(config) {
    throw new Error('天涯爬虫尚未实现');
  }
}

module.exports = CrawlerFactory;
