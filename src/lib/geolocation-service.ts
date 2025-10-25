/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 地理位置检测服务
 * 提供基于IP地址的地理位置检测和CDN优化功能
 */

export interface GeolocationInfo {
  country: string;
  countryCode: string;
  region: string;
  regionCode: string;
  city: string;
  latitude: number;
  longitude: number;
  timezone: string;
  isp: string;
  ip: string;
  cached: boolean;
  timestamp: number;
}

export interface CDNNode {
  id: string;
  name: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
  priority: number;
  baseUrl?: string;
}

export interface CDNOptimizationResult {
  recommendedNode: CDNNode;
  alternativeNodes: CDNNode[];
  distance: number;
  estimatedLatency: number;
  confidence: number;
}

const DEFAULT_CDN_NODES: CDNNode[] = [
  // 中国大陆节点
  {
    id: 'cn-beijing',
    name: '北京',
    region: '华北',
    country: 'CN',
    latitude: 39.9042,
    longitude: 116.4074,
    priority: 100,
  },
  {
    id: 'cn-shanghai',
    name: '上海',
    region: '华东',
    country: 'CN',
    latitude: 31.2304,
    longitude: 121.4737,
    priority: 95,
  },
  {
    id: 'cn-guangzhou',
    name: '广州',
    region: '华南',
    country: 'CN',
    latitude: 23.1291,
    longitude: 113.2644,
    priority: 90,
  },
  {
    id: 'cn-chengdu',
    name: '成都',
    region: '西南',
    country: 'CN',
    latitude: 30.5728,
    longitude: 104.0668,
    priority: 85,
  },
  {
    id: 'cn-xian',
    name: '西安',
    region: '西北',
    country: 'CN',
    latitude: 34.3416,
    longitude: 108.9398,
    priority: 80,
  },

  // 香港节点
  {
    id: 'hk-hongkong',
    name: '香港',
    region: '香港',
    country: 'HK',
    latitude: 22.3193,
    longitude: 114.1694,
    priority: 90,
  },

  // 台湾节点
  {
    id: 'tw-taipei',
    name: '台北',
    region: '台湾',
    country: 'TW',
    latitude: 25.033,
    longitude: 121.5654,
    priority: 85,
  },

  // 新加坡节点
  {
    id: 'sg-singapore',
    name: '新加坡',
    region: '东南亚',
    country: 'SG',
    latitude: 1.3521,
    longitude: 103.8198,
    priority: 80,
  },

  // 日本节点
  {
    id: 'jp-tokyo',
    name: '东京',
    region: '日本',
    country: 'JP',
    latitude: 35.6762,
    longitude: 139.6503,
    priority: 75,
  },

  // 美国节点
  {
    id: 'us-west',
    name: '美国西部',
    region: '北美',
    country: 'US',
    latitude: 37.7749,
    longitude: -122.4194,
    priority: 60,
  },
  {
    id: 'us-east',
    name: '美国东部',
    region: '北美',
    country: 'US',
    latitude: 40.7128,
    longitude: -74.006,
    priority: 60,
  },

  // 欧洲节点
  {
    id: 'eu-london',
    name: '伦敦',
    region: '欧洲',
    country: 'GB',
    latitude: 51.5074,
    longitude: -0.1278,
    priority: 50,
  },
];

class GeolocationService {
  private cache: Map<string, GeolocationInfo> = new Map();
  private cdnNodes: CDNNode[] = DEFAULT_CDN_NODES;
  private cacheExpiry = 24 * 60 * 60 * 1000; // 24小时缓存

  constructor() {
    this.loadCacheFromStorage();
  }

  /**
   * 从本地存储加载缓存
   */
  private loadCacheFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const cached = localStorage.getItem('geolocation_cache');
      if (cached) {
        const data = JSON.parse(cached);
        Object.entries(data).forEach(([key, value]) => {
          this.cache.set(key, value as GeolocationInfo);
        });
      }
    } catch (error) {
      console.warn('Failed to load geolocation cache:', error);
    }
  }

  /**
   * 保存缓存到本地存储
   */
  private saveCacheToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const data: Record<string, GeolocationInfo> = {};
      this.cache.forEach((value, key) => {
        data[key] = value;
      });
      localStorage.setItem('geolocation_cache', JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save geolocation cache:', error);
    }
  }

  /**
   * 获取用户地理位置信息
   */
  async getGeolocationInfo(): Promise<GeolocationInfo | null> {
    try {
      // 首先尝试从缓存获取
      const cached = this.getCachedGeolocation();
      if (cached) {
        return cached;
      }

      // 从多个服务获取地理位置信息
      const geolocationInfo = await this.fetchGeolocationFromServices();

      if (geolocationInfo) {
        // 缓存结果
        this.cacheGeolocation(geolocationInfo);
        return geolocationInfo;
      }

      return null;
    } catch (error) {
      console.warn('Failed to get geolocation info:', error);
      return null;
    }
  }

  /**
   * 从缓存获取地理位置信息
   */
  private getCachedGeolocation(): GeolocationInfo | null {
    const now = Date.now();
    for (const [key, info] of Array.from(this.cache.entries())) {
      if (now - info.timestamp < this.cacheExpiry) {
        return { ...info, cached: true };
      }
    }
    return null;
  }

  /**
   * 缓存地理位置信息
   */
  private cacheGeolocation(info: GeolocationInfo): void {
    const key = info.ip || 'default';
    this.cache.set(key, { ...info, cached: false, timestamp: Date.now() });
    this.saveCacheToStorage();
  }

  /**
   * 从多个服务获取地理位置信息
   */
  private async fetchGeolocationFromServices(): Promise<GeolocationInfo | null> {
    const services = [
      this.fetchFromIpApi,
      this.fetchFromIpify,
      this.fetchFromIpInfo,
    ];

    for (const service of services) {
      try {
        const result = await service();
        if (result) {
          return result;
        }
      } catch (error) {
        console.warn(`Geolocation service failed:`, error);
      }
    }

    return null;
  }

  /**
   * 从 ip-api.com 获取地理位置信息
   */
  private async fetchFromIpApi(): Promise<GeolocationInfo | null> {
    const response = await fetch(
      'http://ip-api.com/json/?fields=status,message,country,countryCode,region,regionName,city,lat,lon,timezone,isp,query',
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error(data.message || 'Failed to get location');
    }

    return {
      country: data.country,
      countryCode: data.countryCode,
      region: data.regionName,
      regionCode: data.region,
      city: data.city,
      latitude: data.lat,
      longitude: data.lon,
      timezone: data.timezone,
      isp: data.isp,
      ip: data.query,
      cached: false,
      timestamp: Date.now(),
    };
  }

  /**
   * 从 ipify.org 获取地理位置信息
   */
  private async fetchFromIpify(): Promise<GeolocationInfo | null> {
    // 首先获取IP地址
    const ipResponse = await fetch('https://api.ipify.org?format=json');
    if (!ipResponse.ok) {
      throw new Error(`HTTP ${ipResponse.status}`);
    }

    const ipData = await ipResponse.json();
    const ip = ipData.ip;

    // 然后获取地理位置信息
    const geoResponse = await fetch(`https://ipapi.co/${ip}/json/`);
    if (!geoResponse.ok) {
      throw new Error(`HTTP ${geoResponse.status}`);
    }

    const geoData = await geoResponse.json();

    if (geoData.error) {
      throw new Error(geoData.reason || 'Failed to get location');
    }

    return {
      country: geoData.country_name,
      countryCode: geoData.country_code,
      region: geoData.region,
      regionCode: geoData.region_code,
      city: geoData.city,
      latitude: geoData.latitude,
      longitude: geoData.longitude,
      timezone: geoData.timezone,
      isp: geoData.org,
      ip: ip,
      cached: false,
      timestamp: Date.now(),
    };
  }

  /**
   * 从 ipinfo.io 获取地理位置信息
   */
  private async fetchFromIpInfo(): Promise<GeolocationInfo | null> {
    const response = await fetch('https://ipinfo.io/json');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || 'Failed to get location');
    }

    const [lat, lon] = data.loc ? data.loc.split(',').map(Number) : [0, 0];

    return {
      country: data.country || 'Unknown',
      countryCode: data.country || 'Unknown',
      region: data.region || 'Unknown',
      regionCode: data.region || 'Unknown',
      city: data.city || 'Unknown',
      latitude: lat,
      longitude: lon,
      timezone: data.timezone || 'UTC',
      isp: data.org || 'Unknown',
      ip: data.ip,
      cached: false,
      timestamp: Date.now(),
    };
  }

  /**
   * 计算两点之间的距离（公里）
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // 地球半径（公里）
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * 角度转弧度
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * 根据地理位置选择最优CDN节点
   */
  async getOptimalCDNNode(): Promise<CDNOptimizationResult | null> {
    try {
      const geolocation = await this.getGeolocationInfo();
      if (!geolocation) {
        // 如果没有地理位置信息，返回默认节点
        return {
          recommendedNode: this.cdnNodes[0],
          alternativeNodes: this.cdnNodes.slice(1, 4),
          distance: 0,
          estimatedLatency: 100,
          confidence: 0.5,
        };
      }

      // 计算到各个CDN节点的距离和评分
      const scoredNodes = this.cdnNodes.map((node) => {
        const distance = this.calculateDistance(
          geolocation.latitude,
          geolocation.longitude,
          node.latitude,
          node.longitude
        );

        // 基于距离和优先级的综合评分
        const distanceScore = Math.max(0, 100 - distance * 2); // 距离越近分数越高
        const priorityScore = node.priority;
        const countryBonus = geolocation.countryCode === node.country ? 20 : 0;

        const totalScore =
          distanceScore * 0.6 + priorityScore * 0.3 + countryBonus;
        const estimatedLatency = Math.max(20, distance * 2 + 20); // 估算延迟

        return {
          node,
          distance,
          score: totalScore,
          estimatedLatency,
        };
      });

      // 按评分排序
      scoredNodes.sort((a, b) => b.score - a.score);

      const recommended = scoredNodes[0];
      const alternatives = scoredNodes.slice(1, 4).map((item) => item.node);

      // 计算置信度
      const confidence = Math.min(0.95, Math.max(0.3, recommended.score / 100));

      console.log(
        `CDN优化结果: 推荐节点 ${
          recommended.node.name
        }, 距离 ${recommended.distance.toFixed(
          1
        )}km, 预估延迟 ${recommended.estimatedLatency.toFixed(0)}ms`
      );

      return {
        recommendedNode: recommended.node,
        alternativeNodes: alternatives,
        distance: recommended.distance,
        estimatedLatency: recommended.estimatedLatency,
        confidence,
      };
    } catch (error) {
      console.warn('Failed to get optimal CDN node:', error);
      return null;
    }
  }

  /**
   * 更新CDN节点配置
   */
  updateCDNNodes(nodes: CDNNode[]): void {
    this.cdnNodes = [...nodes];
  }

  /**
   * 清除地理位置缓存
   */
  clearCache(): void {
    this.cache.clear();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('geolocation_cache');
    }
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }
}

// 单例实例
export const geolocationService = new GeolocationService();
