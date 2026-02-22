/**
 * YouTube 爬虫模块入口
 * 导出所有 YouTube 相关模块
 */

const YouTubeApiClient = require('./youtubeApiClient');
const YouTubeDataMapper = require('./youtubeDataMapper');
const YouTubeSearchParser = require('./youtubeSearchParser');

module.exports = {
  YouTubeApiClient,
  YouTubeDataMapper,
  YouTubeSearchParser
};
