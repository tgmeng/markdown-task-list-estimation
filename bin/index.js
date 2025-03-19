#!/usr/bin/env node

import readline from "readline";
import { inspect } from "util";

import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import remarkTaskEstimation from "./remark-task-estimation.js";

// 处理 Markdown 的主函数
async function processMarkdown(markdown) {
  const processor = unified()
    .use(remarkParse)
    .use(remarkTaskEstimation, {
      debug: false,
    }) // 传递选项给插件
    .use(remarkStringify, {
      allowDangerousHtml: true,
    });

  const file = await processor.process(markdown);
  return String(file);
}

// 从 stdin 读取数据
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

let markdown = "";
rl.on("line", line => {
  markdown += line + "\n";
});

rl.on("close", async () => {
  try {
    // 仅传递调试选项
    const updatedMarkdown = await processMarkdown(markdown);
    console.log(updatedMarkdown);
  } catch (error) {
    console.error("处理 Markdown 时出错:", error);
  }
});
