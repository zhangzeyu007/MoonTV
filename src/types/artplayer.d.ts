declare module 'artplayer' {
  interface ArtplayerOption {
    container: HTMLElement;
    url?: string;
    poster?: string;
    volume?: number;
    muted?: boolean;
    autoplay?: boolean;
    screenshot?: boolean;
    loop?: boolean;
    theme?: string;
    lang?: string;
    hotkey?: boolean;
    type?: string;
    customType?: {
      [key: string]: (video: HTMLVideoElement, url: string) => void;
    };
  }

  class Artplayer {
    constructor(option: ArtplayerOption);

    on(event: string, callback: (...args: any[]) => void): void;
    off(event: string, callback?: (...args: any[]) => void): void;

    play(): void;
    pause(): void;
    toggle(): void;
    seek(time: number): void;
    destroy(): void;

    get video(): HTMLVideoElement;
    get paused(): boolean;
    get currentTime(): number;
    set currentTime(time: number);
    get duration(): number;
    get volume(): number;
    set volume(vol: number);
    get muted(): boolean;
    set muted(mute: boolean);
    get playbackRate(): number;
    set playbackRate(rate: number);
    get fullscreen(): boolean;
    set fullscreen(full: boolean);
    get fullscreenWeb(): boolean;

    get notice(): {
      show: (text: string, time?: number) => void;
    };
  }

  namespace Artplayer {
    const PLAYBACK_RATE: number[];
    const USE_RAF: boolean;
  }

  export = Artplayer;
}
