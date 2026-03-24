export enum TextTrackType {
  SUBRIP = 'application/x-subrip',
  TTML = 'application/ttml+xml',
  VTT = 'text/vtt',
}

export interface TextTrack {
  title?: string;
  language?: string;
  type: TextTrackType;
  uri: string;
}

export type TextTracks = TextTrack[];
