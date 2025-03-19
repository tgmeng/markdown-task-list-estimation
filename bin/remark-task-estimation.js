import { inspect } from "util";
import { SKIP, visit } from "unist-util-visit";
import { toMarkdown } from "mdast-util-to-markdown";

const timeRegExp = /(\d+)h$/;

// 解析文本中的时间（如"8h"）
function parseTime(text) {
  const match = text.match(timeRegExp);
  return match ? parseInt(match[1], 10) : 0;
}

// 从文本中提取任务和时间
function extractTaskAndTime(text) {
  // 匹配任务名称和可能存在的时间（如 "任务名称 8h"）
  const match = text.match(/(?<task>.*?)(\s+)(?<time>\d+h)?(\s*)$/);
  if (!match) return { task: text, time: 0 };

  const task = match.groups.task.trim();
  const timeStr = match.groups.time ? match.groups.time.trim() : null;
  const time = timeStr ? parseTime(timeStr) : 0;

  return { task, time };
}

// 处理列表项节点的函数 - 不返回值，直接修改节点
function processListItem(node, options = {}) {
  // 如果不是列表项，直接返回
  if (node.type !== "listItem") {
    return;
  }

  // 1. 提取当前节点的任务和时间信息
  const paragraph = node.children.find(child => child.type === "paragraph");

  if (!paragraph || !paragraph.children || paragraph.children.length === 0) {
    return;
  }

  const paragraphText = toMarkdown(paragraph);
  const { task, time } = extractTaskAndTime(paragraphText);

  const textNode = paragraph.children.at(-1);

  if (!textNode) {
    return;
  }

  // 存储原始信息
  if (!node.data) {
    node.data = {};
  }

  node.data.task = task;
  node.data.time = time;
  node.data.textNodeRef = textNode;

  if (options.debug) {
    console.log(`解析节点: "${node.data.task}" 时间: ${node.data.time}h`);
  }

  // 2. 递归处理子节点
  let childrenTime = 0;
  let hasChildWithTime = false;

  // 查找所有子列表
  const childLists = node.children.filter(child => child.type === "list");

  // 处理每个子列表中的列表项
  childLists.forEach(list => {
    list.children.forEach(childItem => {
      // 先递归处理子列表项
      processListItem(childItem, options);

      // 获取处理后的子节点时间
      if (childItem.data && childItem.data.time > 0) {
        childrenTime += childItem.data.time;
        hasChildWithTime = true;

        if (options.debug) {
          console.log(
            `子项 "${childItem.data.task}" 的时间: ${childItem.data.time}h`
          );
        }
      }
    });
  });

  // 3. 处理当前节点的时间计算
  if (hasChildWithTime) {
    if (options.debug) {
      console.log(
        `节点 "${node.data.task}" 的子项总时间: ${childrenTime}h, 原时间: ${node.data.time}h`
      );
    }

    // 如果子项时间总和与当前节点时间不同，更新当前节点
    if (childrenTime !== node.data.time) {
      if (options.debug) {
        console.log(
          `更新节点 "${node.data.task}" 的时间: ${node.data.time}h -> ${childrenTime}h`
        );
      }

      // 更新数据
      node.data.time = childrenTime;

      // 更新文本节点
      if (timeRegExp.test(node.data.textNodeRef.value)) {
        node.data.textNodeRef.value = node.data.textNodeRef.value.replace(
          timeRegExp,
          `${childrenTime}h`
        );
      } else {
        node.data.textNodeRef.value = `${node.data.textNodeRef.value} ${childrenTime}h`;
      }
    }
  }
}

// 查找根级列表
function findRootLists(tree) {
  // 找出文档中的所有根级列表
  const rootLists = [];

  // 如果树本身就是列表，直接添加
  if (tree.type === "list") {
    rootLists.push(tree);
  }
  // 否则查找根级子节点
  else if (tree.children && tree.children.length) {
    tree.children.forEach(child => {
      if (child.type === "list") {
        rootLists.push(child);
      }
    });
  }

  return rootLists;
}

// 自定义 remark 插件
export default function remarkTaskEstimation(pluginOptions = {}) {
  // 默认选项
  const options = {
    debug: false, // 默认不输出调试信息
    ...pluginOptions,
  };

  return tree => {
    if (options.debug) {
      console.log("开始计算任务时间");
    }

    // 找到所有根级列表
    const rootLists = [];

    visit(tree, "list", node => {
      rootLists.push(node);
      return SKIP;
    });

    // 处理所有根级列表中的列表项
    rootLists.forEach(list => {
      list.children.forEach(item => {
        if (item.type === "listItem") {
          processListItem(item, options);
        }
      });
    });

    return tree;
  };
}
