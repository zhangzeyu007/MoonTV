/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * URL验证工具类
 * 验证和规范化视频源URL,防止类型错误
 */

export interface URLValidationResult {
  valid: boolean;
  url?: string;
  error?: string;
  errorType?: 'missing' | 'invalid_type' | 'malformed' | 'empty';
}

export interface SourceValidationResult {
  valid: any[];
  invalid: Array<{ source: any; error: string; errorType?: string }>;
}

/**
 * URL验证器类
 */
export class URLValidator {
  // URL最大长度限制(防止DoS)
  private static readonly MAX_URL_LENGTH = 2048;

  // 允许的URL协议
  private static readonly ALLOWED_PROTOCOLS = ['http:', 'https:', 'blob:'];

  /**
   * 验证并规范化源URL
   */
  public static validateSourceURL(source: any): URLValidationResult {
    // 1. 检查source是否存在
    if (!source) {
      return {
        valid: false,
        error: 'Source对象不存在',
        errorType: 'missing',
      };
    }

    // 2. 提取URL(优先使用episodeUrl)
    const episodeUrl = source.episodeUrl;
    const url = source.url;

    let targetUrl: any = episodeUrl || url;

    // 3. 检查URL是否存在
    if (targetUrl === undefined || targetUrl === null) {
      return {
        valid: false,
        error: 'URL字段缺失(episodeUrl和url都不存在)',
        errorType: 'missing',
      };
    }

    // 4. 检查URL类型
    if (typeof targetUrl !== 'string') {
      return {
        valid: false,
        error: `URL类型错误: 期望string,实际${typeof targetUrl} (值: ${JSON.stringify(
          targetUrl
        )})`,
        errorType: 'invalid_type',
      };
    }

    // 5. 检查空字符串
    targetUrl = targetUrl.trim();
    if (targetUrl.length === 0) {
      return {
        valid: false,
        error: 'URL为空字符串',
        errorType: 'empty',
      };
    }

    // 6. 检查URL长度
    if (targetUrl.length > URLValidator.MAX_URL_LENGTH) {
      return {
        valid: false,
        error: `URL长度超过限制(${targetUrl.length} > ${URLValidator.MAX_URL_LENGTH})`,
        errorType: 'malformed',
      };
    }

    // 7. 验证URL格式
    if (!URLValidator.isValidURLFormat(targetUrl)) {
      return {
        valid: false,
        error: `URL格式无效: ${targetUrl}`,
        errorType: 'malformed',
      };
    }

    // 8. 验证通过
    return {
      valid: true,
      url: targetUrl,
    };
  }

  /**
   * 批量验证源列表
   */
  public static validateSources(sources: any[]): SourceValidationResult {
    const valid: any[] = [];
    const invalid: Array<{ source: any; error: string; errorType?: string }> =
      [];

    if (!Array.isArray(sources)) {
      console.error('[URLValidator] sources不是数组:', typeof sources);
      return { valid: [], invalid: [] };
    }

    for (const source of sources) {
      const validation = URLValidator.validateSourceURL(source);

      if (validation.valid) {
        valid.push(source);
      } else {
        invalid.push({
          source,
          error: validation.error || 'Unknown error',
          errorType: validation.errorType,
        });
      }
    }

    console.log(
      `[URLValidator] 批量验证完成: ${valid.length}个有效, ${invalid.length}个无效`
    );

    return { valid, invalid };
  }

  /**
   * 检查URL字符串格式
   */
  public static isValidURLFormat(url: string): boolean {
    try {
      // 尝试解析URL
      const parsed = new URL(url);

      // 检查协议
      if (!URLValidator.ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
        console.warn(
          `[URLValidator] 不支持的协议: ${parsed.protocol} (URL: ${url})`
        );
        return false;
      }

      // 检查主机名(http/https需要主机名)
      if (
        (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
        !parsed.hostname
      ) {
        console.warn(`[URLValidator] 缺少主机名 (URL: ${url})`);
        return false;
      }

      return true;
    } catch (error) {
      // URL解析失败
      console.warn(`[URLValidator] URL解析失败: ${url}`, error);
      return false;
    }
  }

  /**
   * 规范化URL(移除多余空格、统一协议等)
   */
  public static normalizeURL(url: string): string {
    try {
      const trimmed = url.trim();
      const parsed = new URL(trimmed);
      return parsed.href;
    } catch {
      // 解析失败,返回原始URL
      return url.trim();
    }
  }

  /**
   * 提取URL的显示名称(用于UI显示)
   */
  public static getURLDisplayName(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname || url;
    } catch {
      return url;
    }
  }
}

// 导出便捷函数
export function validateSourceURL(source: any): URLValidationResult {
  return URLValidator.validateSourceURL(source);
}

export function validateSources(sources: any[]): SourceValidationResult {
  return URLValidator.validateSources(sources);
}

export function isValidURLFormat(url: string): boolean {
  return URLValidator.isValidURLFormat(url);
}
