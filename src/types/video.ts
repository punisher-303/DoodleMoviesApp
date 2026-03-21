export enum ResizeMode {
  NONE = 'none',
  CONTAIN = 'contain',
  COVER = 'cover',
  STRETCH = 'stretch',
}

export enum SelectedTrackType {
  SYSTEM = 'system',
  DISABLED = 'disabled',
  TITLE = 'title',
  LANGUAGE = 'language',
  INDEX = 'index',
  AUTO = 'auto',
}

export enum TextTrackType {
  SUBRIP = 'application/x-subrip',
  TTML = 'application/ttml+xml',
  VTT = 'text/vtt',
}

export type TextTracks = {
  title: string;
  language: string;
  uri: string;
  type: TextTrackType;
}[];

export interface OnProgressData {
  currentTime: number;
  playableDuration: number;
  seekableDuration: number;
}

export interface OnLoadData {
  canStepBackward: boolean;
  canStepForward: boolean;
  currentTime: number;
  duration: number;
  naturalSize: {
    height: number;
    width: number;
    orientation: string;
  };
  audioTracks: any[];
  textTracks: any[];
  videoTracks: any[];
}

export interface OnVideoErrorData {
  error: {
    errorString: string;
    errorCode: string;
  };
}
