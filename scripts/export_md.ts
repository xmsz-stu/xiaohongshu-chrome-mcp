import fs from "node:fs";
import path from "node:path";

interface UserInfo {
  nickname?: string;
  userId?: string;
}

interface SubComment {
  content: string;
  userInfo?: UserInfo;
  likeCount?: string | number;
}

interface Comment {
  content: string;
  userInfo?: UserInfo;
  likeCount?: string | number;
  subComments?: SubComment[];
}

interface NoteDetail {
  title?: string;
  desc?: string;
  interactInfo?: {
    collectedCount?: string | number;
  };
  comments?: {
    list?: Comment[];
  };
}

function isLiked(count: string | number | undefined): boolean {
  if (count === undefined) return false;
  const num = typeof count === "string" ? parseInt(count, 10) : count;
  return num > 0;
}

async function exportJsonToMd(inputPath: string) {
  try {
    const absolutePath = path.resolve(inputPath);
    if (!fs.existsSync(absolutePath)) {
      console.error(`文件不存在: ${absolutePath}`);
      return;
    }

    const data = JSON.parse(fs.readFileSync(absolutePath, "utf-8"));
    const items: NoteDetail[] = Array.isArray(data) ? data : [data];
    
    // 获取数字计数的简单辅助函数
    const getCount = (count: string | number | undefined) => {
      if (count === undefined) return 0;
      return typeof count === "string" ? parseInt(count, 10) : count;
    };

    // 默认按照收藏数降序排序笔记
    items.sort((a, b) => getCount(b.interactInfo?.collectedCount) - getCount(a.interactInfo?.collectedCount));

    let mdContent = "";

    for (const item of items) {
      const { title, desc, interactInfo, comments } = item;
      
      mdContent += `# ${title || "无标题"}\n\n`;
      mdContent += `**收藏数:** ${interactInfo?.collectedCount || 0}\n\n`;
      mdContent += `## 描述\n\n${desc || "无描述"}\n\n`;

      // 仅处理有内容的评论列表
      const commentList = comments?.list || [];
      // 过滤点赞数大于 0 的评论，并按点赞数排序
      const filteredComments = commentList
        .filter(c => isLiked(c.likeCount))
        .sort((a, b) => getCount(b.likeCount) - getCount(a.likeCount));

      if (filteredComments.length > 0) {
        mdContent += `## 热门评论\n\n`;
        for (const comment of filteredComments) {
          mdContent += `### ${comment.userInfo?.nickname || "未知用户"}: ${comment.content} (赞: ${comment.likeCount})\n`;
          
          if (comment.subComments && comment.subComments.length > 0) {
            // 子评论也按需展示，过滤点赞数大于 0 的并按点赞数排序
            const filteredSubComments = comment.subComments
              .filter(s => isLiked(s.likeCount))
              .sort((a, b) => getCount(b.likeCount) - getCount(a.likeCount));
              
            for (const sub of filteredSubComments) {
              mdContent += `- **${sub.userInfo?.nickname || "未知用户"}**: ${sub.content} (赞: ${sub.likeCount})\n`;
            }
          }
          mdContent += `\n`;
        }
      }
      mdContent += `---\n\n`; // 分隔符
    }

    const outputPath = absolutePath.replace(".json", ".md");
    fs.writeFileSync(outputPath, mdContent.trim(), "utf-8");
    console.log(`成功导出到: ${outputPath} (已按热度排序并过滤无点赞评论)`);
  } catch (error) {
    console.error("导出失败:", error);
  }
}

const targetFile = process.argv[2] || "data/以佛所_details.json";
exportJsonToMd(targetFile);
