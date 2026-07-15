/**
 * config 命令 — 配置管理
 *
 * 参考 PRD §7 config 命令规范
 *
 * 用法：
 *   skill-sync config set <key> <value>
 *   skill-sync config get <key>
 *   skill-sync config list
 *   skill-sync config init
 */

import chalk from 'chalk';
import { readConfig, writeConfig, getDefaultConfig } from '../config.js';
import { configPath } from '../lib/paths.js';
import { handleCommandError } from '../lib/errors.js';
import { stringify as stringifyYaml } from 'yaml';

export function configCommand(action: string, key: string | undefined, value: string | undefined): void {
  try {
    switch (action) {
      case 'set': {
        if (!key || value === undefined) {
          console.error(chalk.red('\n✗ 用法: skill-sync config set <key> <value>'));
          process.exit(2);
        }

        const config = readConfig();
        setNestedValue(config, key, parseValue(value));
        writeConfig(config);
        console.log(chalk.green(`\n✓ ${key} = ${value}`));
        break;
      }

      case 'get': {
        if (!key) {
          console.error(chalk.red('\n✗ 用法: skill-sync config get <key>'));
          process.exit(2);
        }

        const config = readConfig();
        const v = getNestedValue(config, key);
        if (v === undefined) {
          console.log(chalk.gray(`\n  ${key} = (未设置)`));
        } else {
          console.log(`\n  ${key} = ${typeof v === 'object' ? JSON.stringify(v) : v}`);
        }
        break;
      }

      case 'list': {
        const config = readConfig();
        const yamlStr = stringifyYaml(config, { indent: 2 });
        console.log(chalk.cyan(`\n  Config: ${configPath()}`));
        console.log(chalk.gray('  ' + '─'.repeat(50)));
        console.log(yamlStr);
        break;
      }

      case 'init': {
        const p = configPath();
        const defaultConfig = getDefaultConfig();
        writeConfig(defaultConfig);
        console.log(chalk.green(`\n✓ 配置文件已初始化: ${p}`));
        break;
      }

      default:
        console.error(chalk.red(`\n✗ 未知操作: ${action}`));
        console.error(chalk.gray('  可用操作: set, get, list, init'));
        process.exit(2);
    }
  } catch (e) {
    handleCommandError(e);
  }
}

/**
 * 解析值字符串为合适的类型
 */
function parseValue(v: string): unknown {
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null') return null;
  if (/^\d+$/.test(v)) return parseInt(v, 10);
  if (/^\d+\.\d+$/.test(v)) return parseFloat(v);
  return v;
}

/**
 * 获取嵌套属性值
 *
 * 支持 dot notation: "sync.github.branch"
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getNestedValue(obj: any, key: string): any {
  const parts = key.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

/**
 * 设置嵌套属性值
 *
 * 支持 dot notation: "sync.github.branch"
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setNestedValue(obj: any, key: string, value: unknown): void {
  const parts = key.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]!] = value;
}
