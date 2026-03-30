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
    
    let mdContent = "";

    for (const item of items) {
      const { title, desc, interactInfo, comments } = item;
      
      mdContent += `# ${title || "无标题"}\n\n`;
      mdContent += `**收藏数:** ${interactInfo?.collectedCount || 0}\n\n`;
      mdContent += `## 描述\n\n${desc || "无描述"}\n\n`;

      // 仅处理有内容的评论列表
      const commentList = comments?.list || [];
      // 过滤点赞数大于 0 的评论
      const filteredComments = commentList.filter(c => isLiked(c.likeCount));

      if (filteredComments.length > 0) {
        mdContent += `## 热门评论\n\n`;
        for (const comment of filteredComments) {
          mdContent += `### ${comment.userInfo?.nickname || "未知用户"}: ${comment.content} (赞: ${comment.likeCount})\n`;
          
          if (comment.subComments && comment.subComments.length > 0) {
            // 子评论也按需展示，不强求子评论必须有点赞（因为它们是针对父评论的补充）
            // 但如果用户说“没有点赞就过滤掉”，可能也包含子评论。这里也过滤一下子评论。
            const filteredSubComments = comment.subComments.filter(s => isLiked(s.likeCount));
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
    console.log(`成功导出到: ${outputPath} (已过滤无点赞评论)`);
  } catch (error) {
    console.error("导出失败:", error);
  }
}

const targetFile = process.argv[2] || "data/卡什_details.json";
exportJsonToMd(targetFile);
