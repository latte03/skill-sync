/**
 * sanitize 模块单元测试
 */

import { describe, it, expect } from 'vitest';
import {
  stripTerminalEscapes,
  sanitizeMetadata,
  sanitizeName,
  isPathSafe,
} from '../../src/lib/sanitize.js';
import path from 'node:path';

describe('stripTerminalEscapes', () => {
  it('正常字符串不受影响', () => {
    expect(stripTerminalEscapes('hello world')).toBe('hello world');
  });

  it('剥离 CSI 序列', () => {
    expect(stripTerminalEscapes('\x1b[31mred text\x1b[0m')).toBe('red text');
    expect(stripTerminalEscapes('\x1b[2J\x1b[H')).toBe('');
  });

  it('剥离 OSC 序列', () => {
    expect(stripTerminalEscapes('\x1b]0;malicious title\x07normal')).toBe('normal');
    expect(stripTerminalEscapes('\x1b]0;title\x1b\\normal')).toBe('normal');
  });

  it('剥离 DCS/PM/APC 序列', () => {
    expect(stripTerminalEscapes('\x1bPsome data\x1b\\clean')).toBe('clean');
  });

  it('剥离简单 ESC+字符', () => {
    expect(stripTerminalEscapes('\x1bDtext')).toBe('text');
  });

  it('剥离 C1 控制码', () => {
    expect(stripTerminalEscapes('\x85text')).toBe('text');
  });

  it('保留 tab 和换行', () => {
    expect(stripTerminalEscapes('line1\n\tindented')).toBe('line1\n\tindented');
  });

  it('剥离 BEL (0x07)', () => {
    expect(stripTerminalEscapes('alert\x07text')).toBe('alerttext');
  });

  it('混合序列', () => {
    const input = '\x1b[32mgreen\x1b[0m \x1b]0;title\x07 \x1b[1mbold\x1b[0m';
    expect(stripTerminalEscapes(input)).toBe('green  bold');
  });

  it('空字符串', () => {
    expect(stripTerminalEscapes('')).toBe('');
  });
});

describe('sanitizeMetadata', () => {
  it('修剪空白', () => {
    expect(sanitizeMetadata('  hello  ')).toBe('hello');
  });

  it('折叠换行为空格', () => {
    expect(sanitizeMetadata('line1\nline2\nline3')).toBe('line1 line2 line3');
  });

  it('剥离转义序列并折叠换行', () => {
    expect(sanitizeMetadata('\x1b[31mred\nline\x1b[0m')).toBe('red line');
  });
});

describe('sanitizeName', () => {
  it('保留合法字符', () => {
    expect(sanitizeName('my-skill.name_v2')).toBe('my-skill.name_v2');
  });

  it('替换非法字符为连字符', () => {
    expect(sanitizeName('my skill!@#')).toBe('my-skill');
  });

  it('折叠多个连字符', () => {
    expect(sanitizeName('a---b')).toBe('a-b');
  });

  it('去除首尾连字符', () => {
    expect(sanitizeName('---test---')).toBe('test');
  });

  it('路径遍历攻击防护', () => {
    expect(sanitizeName('../../etc/passwd')).toBe('..-..-etc-passwd');
  });

  it('空字符串返回默认值', () => {
    expect(sanitizeName('')).toBe('unnamed-skill');
  });

  it('全非法字符返回默认值', () => {
    expect(sanitizeName('!!!')).toBe('unnamed-skill');
  });
});

describe('isPathSafe', () => {
  it('在基础目录内的路径返回 true', () => {
    expect(isPathSafe('/tmp/skill-sync/skills/test', '/tmp/skill-sync')).toBe(true);
  });

  it('等于基础目录返回 true', () => {
    expect(isPathSafe('/tmp/skill-sync', '/tmp/skill-sync')).toBe(true);
  });

  it('路径遍历攻击返回 false', () => {
    expect(isPathSafe('/tmp/skill-sync/../../etc/passwd', '/tmp/skill-sync')).toBe(false);
  });

  it('完全不同的路径返回 false', () => {
    expect(isPathSafe('/etc/passwd', '/tmp/skill-sync')).toBe(false);
  });

  it('前缀相似但不同的路径返回 false', () => {
    expect(isPathSafe('/tmp/skill-sync-evil/skill', '/tmp/skill-sync')).toBe(false);
  });
});
