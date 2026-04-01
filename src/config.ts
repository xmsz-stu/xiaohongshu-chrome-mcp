/**
 * 配置解析与全局变量
 */

// 解析命令行参数，例如: bun run app.ts --max 500
const args = process.argv.slice(2);

// 查找参数值，支持 --max <n> 或 --max-details <n>
const maxIndex = args.findIndex(a => a === '--max' || a === '--max-details');
export const GLOBAL_MAX_DETAILS = (maxIndex !== -1 && args[maxIndex + 1]) 
    ? parseInt(args[maxIndex + 1], 10) 
    : 200;

if (maxIndex !== -1) {
    console.log(`[Config] 🛠️ 全局详情采集上限已设置为: ${GLOBAL_MAX_DETAILS}`);
}
