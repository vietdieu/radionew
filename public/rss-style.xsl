<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <xsl:output method="html" encoding="utf-8" indent="yes"/>
  <xsl:template match="/">
    <html lang="vi">
      <head>
        <title><xsl:value-of select="rss/channel/title"/> - Podcast Feed</title>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;display=swap" rel="stylesheet"/>
        <style>
          body {
            font-family: 'Inter', sans-serif;
          }
        </style>
      </head>
      <body class="bg-slate-50 text-slate-800 min-h-screen">
        <div class="max-w-4xl mx-auto px-4 py-8">
          
          <!-- Header Banner -->
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8 flex flex-col md:flex-row">
            <div class="md:w-1/3 bg-slate-900 flex items-center justify-center p-6">
              <img class="w-48 h-48 rounded-xl shadow-md object-cover border border-slate-700" src="{rss/channel/itunes:image/@href}" alt="Podcast Cover"/>
            </div>
            <div class="md:w-2/3 p-8 flex flex-col justify-between">
              <div>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-100 text-cyan-850 mb-3">
                  🎙️ RSS Podcast Feed
                </span>
                <h1 class="text-2xl font-bold text-slate-900 tracking-tight mb-2">
                  <xsl:value-of select="rss/channel/title"/>
                </h1>
                <p class="text-sm text-slate-500 mb-4">
                  <xsl:value-of select="rss/channel/description"/>
                </p>
              </div>
              <div class="pt-4 border-t border-slate-100 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-400 font-medium">
                <div>Tác giả: <strong class="text-slate-600"><xsl:value-of select="rss/channel/itunes:author"/></strong></div>
                <div>Ngôn ngữ: <strong class="text-slate-600"><xsl:value-of select="rss/channel/language"/></strong></div>
                <div>Bản quyền: <strong class="text-slate-600"><xsl:value-of select="rss/channel/copyright"/></strong></div>
              </div>
            </div>
          </div>

          <!-- Explanation box -->
          <div class="bg-cyan-50 border border-cyan-200 rounded-xl p-5 mb-8 text-xs text-cyan-850 flex gap-3 items-start">
            <span class="text-lg">ℹ️</span>
            <div>
              <p class="font-bold mb-1">Đây là đường dẫn RSS Podcast Feed chính thức của bạn!</p>
              <p class="mb-2">Bạn có thể sao chép URL trên thanh địa chỉ trình duyệt và dán trực tiếp vào các ứng dụng nghe podcast chuyên nghiệp như <strong>Spotify, Apple Podcasts, Google Podcasts, Overcast</strong> để đăng ký và tải tự động các tập tin phát thanh.</p>
              <p>Dưới đây là danh sách các tập bản tin đã được bạn xuất bản lên Cloud. Bạn có thể nghe trực tiếp tại đây!</p>
            </div>
          </div>

          <!-- Episode List -->
          <h2 class="text-lg font-bold text-slate-800 mb-4">Danh Sách Tập Bản Tin (<xsl:value-of select="count(rss/channel/item)"/> tập)</h2>
          
          <div class="space-y-4">
            <xsl:for-each select="rss/channel/item">
              <div class="bg-white rounded-xl border border-slate-200 p-6 shadow-xs hover:shadow-sm transition">
                <div class="flex justify-between items-start gap-4 mb-3">
                  <h3 class="text-base font-bold text-slate-900 hover:text-cyan-650 transition">
                    <xsl:value-of select="title"/>
                  </h3>
                  <span class="text-xs text-slate-400 font-mono whitespace-nowrap">
                    <xsl:value-of select="pubDate"/>
                  </span>
                </div>
                <p class="text-xs text-slate-500 leading-relaxed mb-4">
                  <xsl:value-of select="description"/>
                </p>
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-100">
                  <audio class="w-full sm:max-w-md h-8 outline-none" controls="controls" preload="none">
                    <source src="{enclosure/@url}" type="audio/mpeg"/>
                    Trình duyệt của bạn không hỗ trợ phát âm thanh HTML5.
                  </audio>
                  <div class="flex items-center gap-4 text-xs font-medium text-slate-400">
                    <span>Thời lượng: <strong class="text-slate-600"><xsl:value-of select="itunes:duration"/> giây</strong></span>
                    <a class="text-cyan-600 hover:text-cyan-700 font-bold flex items-center gap-1" href="{enclosure/@url}" target="_blank" download="">
                      Tải tệp MP3 📥
                    </a>
                  </div>
                </div>
              </div>
            </xsl:for-each>
            <xsl:if test="count(rss/channel/item) = 0">
              <div class="text-center py-12 text-slate-400 bg-white border border-slate-200 rounded-xl">
                <p class="text-sm">Chưa có tập podcast nào được phát hành lên RSS Feed.</p>
              </div>
            </xsl:if>
          </div>

        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
