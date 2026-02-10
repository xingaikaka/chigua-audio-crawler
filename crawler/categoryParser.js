const cheerio = require('cheerio');
const { httpGet, cleanText, buildUrl } = require('./utils');
const config = require('../config/default.json');

/**
 * 获取网站分类列表
 */
async function getCategories() {
  try {
    // 获取首页HTML
    const html = await httpGet(config.baseUrl);
    const $ = cheerio.load(html);
    
    const categories = [];
    
    // 查找导航菜单
    const navList = $('nav ul, .nav-menu, header nav ul').first();
    
    if (navList.length === 0) {
      console.log('[CategoryParser] 未找到导航菜单，尝试备用选择器');
      // 尝试其他可能的选择器
      const altNav = $('ul[role="menu"], .menu, .navigation ul').first();
      if (altNav.length === 0) {
        throw new Error('无法找到导航菜单');
      }
    }
    
    // 遍历一级菜单项
    navList.find('> li').each((i, element) => {
      const $li = $(element);
      
      // 获取一级分类名称
      const categoryName = cleanText(
        $li.find('> a, > button').first().text()
      );
      
      // 跳过排除的分类
      if (config.excludeCategories.includes(categoryName)) {
        console.log(`[CategoryParser] 跳过分类: ${categoryName}`);
        return;
      }
      
      // 跳过空名称
      if (!categoryName) return;
      
      // 获取一级分类链接
      const categoryLink = $li.find('> a').attr('href');
      
      const category = {
        id: `category-${i}`,
        name: categoryName,
        url: categoryLink ? buildUrl(categoryLink) : null,
        children: []
      };
      
      // 查找二级分类
      const subList = $li.find('ul, .sub-menu, .dropdown-menu').first();
      
      if (subList.length > 0) {
        subList.find('> li').each((j, subElement) => {
          const $subLi = $(subElement);
          const subName = cleanText($subLi.find('a').first().text());
          const subLink = $subLi.find('a').attr('href');
          
          // 跳过排除的二级分类
          if (config.excludeSubCategories && config.excludeSubCategories.includes(subName)) {
            console.log(`[CategoryParser] 跳过二级分类: ${subName}`);
            return;
          }
          
          if (subName && subLink) {
            category.children.push({
              id: `category-${i}-${j}`,
              name: subName,
              url: buildUrl(subLink),
              parent: categoryName
            });
          }
        });
      }
      
      categories.push(category);
      console.log(`[CategoryParser] 解析分类: ${categoryName} (${category.children.length}个子分类)`);
    });
    
    console.log(`[CategoryParser] 总共解析到 ${categories.length} 个分类`);
    return categories;
    
  } catch (error) {
    console.error('[CategoryParser] 解析失败:', error);
    throw error;
  }
}

module.exports = {
  getCategories
};
