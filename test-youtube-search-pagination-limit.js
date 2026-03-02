/**
 * YouTube Search API 分页深度测试
 * 
 * 目的：测试搜索 API 实际能翻到第几页，验证深度限制
 * 参考：YouTube 官方示例代码分析结果
 */

const axios = require('axios');
const config = require('./config/youtube-api-config');

const API_BASE_URL = 'https://www.googleapis.com/youtube/v3';
const YOUTUBE_API_KEY = config.apiKey;

// 测试配置
const TEST_CONFIGS = [
  {
    name: '热门搜索词：music',
    keyword: 'music',
    maxResults: 50,
    order: 'relevance'
  },
  {
    name: '中文搜索词：音乐',
    keyword: '音乐',
    maxResults: 50,
    order: 'relevance'
  },
  {
    name: '限制性搜索词：中共',
    keyword: '中共',
    maxResults: 50,
    order: 'relevance'
  },
  {
    name: '冷门搜索词：quantum physics documentary',
    keyword: 'quantum physics documentary',
    maxResults: 50,
    order: 'relevance'
  }
];

// 延迟函数
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 测试单个搜索词的分页深度
 */
async function testSearchPagination(config) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🔍 测试: ${config.name}`);
  console.log(`   关键词: "${config.keyword}"`);
  console.log(`   每页数量: ${config.maxResults}`);
  console.log(`   排序方式: ${config.order}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let page = 1;
  let nextPageToken = null;
  let totalResults = 0;
  let allVideoIds = new Set(); // 用于检测重复
  let duplicateCount = 0;
  const pageDetails = [];

  try {
    while (true) {
      console.log(`📄 正在获取第 ${page} 页...`);

      // 构建请求参数
      const params = {
        key: YOUTUBE_API_KEY,
        q: config.keyword,
        part: 'snippet',
        type: 'video',
        maxResults: config.maxResults,
        order: config.order,
        regionCode: 'US'
      };

      if (nextPageToken) {
        params.pageToken = nextPageToken;
      }

      // 发送请求
      const response = await axios.get(`${API_BASE_URL}/search`, { params });
      const data = response.data;

      // 统计结果
      const items = data.items || [];
      const currentPageResults = items.length;
      totalResults += currentPageResults;

      // 检测重复视频
      let duplicatesInPage = 0;
      items.forEach(item => {
        if (item.id && item.id.videoId) {
          if (allVideoIds.has(item.id.videoId)) {
            duplicatesInPage++;
            duplicateCount++;
          } else {
            allVideoIds.add(item.id.videoId);
          }
        }
      });

      // 记录本页详情
      pageDetails.push({
        page: page,
        results: currentPageResults,
        duplicates: duplicatesInPage,
        pageToken: nextPageToken || '(首页)',
        nextPageToken: data.nextPageToken || '(无)',
        totalResults: data.pageInfo ? data.pageInfo.totalResults : 0
      });

      console.log(`   ✅ 第 ${page} 页：${currentPageResults} 个结果`);
      console.log(`   📊 当前累计：${totalResults} 个结果（${allVideoIds.size} 个不重复）`);
      console.log(`   🔄 重复视频：${duplicatesInPage} 个`);
      console.log(`   🎫 PageToken: ${nextPageToken || '(首页)'}`);
      console.log(`   ➡️  NextPageToken: ${data.nextPageToken ? data.nextPageToken.substring(0, 20) + '...' : '(无)'}`);
      console.log(`   📈 API 返回的 totalResults: ${data.pageInfo ? data.pageInfo.totalResults.toLocaleString() : 'N/A'}\n`);

      // 检查是否还有下一页
      if (!data.nextPageToken) {
        console.log(`⛔ 已到最后一页！nextPageToken 为 null\n`);
        break;
      }

      // 检查是否返回空结果
      if (items.length === 0) {
        console.log(`⛔ 返回空结果，停止翻页\n`);
        break;
      }

      // 更新 token 和页码
      nextPageToken = data.nextPageToken;
      page++;

      // 安全限制：最多翻 50 页（防止无限循环）
      if (page > 50) {
        console.log(`⚠️  已达到测试上限（50页），停止测试\n`);
        break;
      }

      // 延迟，避免触发 API 限流
      await sleep(1000);
    }

  } catch (error) {
    console.error(`\n❌ 错误: ${error.message}`);
    if (error.response) {
      console.error(`   状态码: ${error.response.status}`);
      console.error(`   错误详情: ${JSON.stringify(error.response.data, null, 2)}`);
    }
  }

  // 打印汇总
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 汇总统计');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 成功翻到第 ${page} 页`);
  console.log(`📦 总结果数: ${totalResults} 个`);
  console.log(`🎯 不重复视频: ${allVideoIds.size} 个`);
  console.log(`🔄 重复视频: ${duplicateCount} 个`);
  console.log(`💰 配额消耗: 约 ${page * 100} 点（搜索）\n`);

  console.log('📄 详细分页记录:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  pageDetails.forEach(detail => {
    console.log(`第 ${detail.page.toString().padStart(2)} 页 | 结果: ${detail.results.toString().padStart(2)} | 重复: ${detail.duplicates} | NextToken: ${detail.nextPageToken === '(无)' ? '❌ 无' : '✅ 有'}`);
  });
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  return {
    config,
    maxPages: page,
    totalResults,
    uniqueResults: allVideoIds.size,
    duplicates: duplicateCount,
    pageDetails
  };
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║     YouTube Search API 分页深度限制测试                    ║');
  console.log('║     测试目的：验证不同搜索词能翻到第几页                   ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('\n');
  console.log(`🔑 API Key: ${YOUTUBE_API_KEY.substring(0, 10)}...${YOUTUBE_API_KEY.substring(YOUTUBE_API_KEY.length - 5)}`);
  console.log(`📅 测试时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
  console.log(`🧪 测试配置数: ${TEST_CONFIGS.length}`);
  console.log('\n');

  const results = [];

  for (let i = 0; i < TEST_CONFIGS.length; i++) {
    const config = TEST_CONFIGS[i];
    const result = await testSearchPagination(config);
    results.push(result);

    // 每个测试之间延迟 3 秒
    if (i < TEST_CONFIGS.length - 1) {
      console.log('⏳ 等待 3 秒后继续下一个测试...\n');
      await sleep(3000);
    }
  }

  // 打印最终对比
  console.log('\n\n');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                    最终测试结果对比                        ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('\n');

  console.log('┌────────────────────────────┬──────┬────────┬──────────┬────────┐');
  console.log('│ 搜索词                     │ 页数 │ 总结果 │ 不重复   │ 配额   │');
  console.log('├────────────────────────────┼──────┼────────┼──────────┼────────┤');
  
  results.forEach(result => {
    const keyword = result.config.keyword.padEnd(24);
    const pages = result.maxPages.toString().padStart(4);
    const total = result.totalResults.toString().padStart(6);
    const unique = result.uniqueResults.toString().padStart(8);
    const quota = (result.maxPages * 100).toString().padStart(6);
    console.log(`│ ${keyword} │ ${pages} │ ${total} │ ${unique} │ ${quota} │`);
  });
  
  console.log('└────────────────────────────┴──────┴────────┴──────────┴────────┘');

  // 统计总配额消耗
  const totalQuota = results.reduce((sum, r) => sum + (r.maxPages * 100), 0);
  console.log(`\n💰 本次测试总配额消耗: ${totalQuota} 点`);
  console.log(`📊 剩余配额（假设每日 10,000 点）: ${10000 - totalQuota} 点`);

  console.log('\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎯 关键结论');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const avgPages = (results.reduce((sum, r) => sum + r.maxPages, 0) / results.length).toFixed(1);
  const avgResults = Math.round(results.reduce((sum, r) => sum + r.uniqueResults, 0) / results.length);
  
  console.log(`• 平均可翻到第 ${avgPages} 页`);
  console.log(`• 平均可获取 ${avgResults} 个不重复结果`);
  console.log(`• 不同搜索词的深度差异明显`);
  console.log(`• nextPageToken 为 null 时无法继续`);
  console.log('\n');
}

// 执行测试
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('测试执行失败:', error);
    process.exit(1);
  });
}

module.exports = { testSearchPagination, runAllTests };
