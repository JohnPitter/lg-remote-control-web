export enum TVCommandType {
  // Power
  POWER = 'ssap://system/turnOff',

  // Volume
  VOLUME_UP = 'ssap://audio/volumeUp',
  VOLUME_DOWN = 'ssap://audio/volumeDown',
  VOLUME_MUTE = 'ssap://audio/setMute',
  VOLUME_UNMUTE = 'ssap://audio/setMute',
  VOLUME_GET = 'ssap://audio/getVolume',

  // Channel
  CHANNEL_UP = 'ssap://tv/channelUp',
  CHANNEL_DOWN = 'ssap://tv/channelDown',

  // Media Controls
  PLAY = 'ssap://media.controls/play',
  PAUSE = 'ssap://media.controls/pause',
  STOP = 'ssap://media.controls/stop',
  REWIND = 'ssap://media.controls/rewind',
  FAST_FORWARD = 'ssap://media.controls/fastForward',

  // Navigation - Using button commands (need to send via InputSocket)
  HOME = 'ssap://system.launcher/launch',
  BACK = 'ssap://system.launcher/back',
  UP = 'button:UP',
  DOWN = 'button:DOWN',
  LEFT = 'button:LEFT',
  RIGHT = 'button:RIGHT',
  ENTER = 'button:ENTER',

  // Input
  INPUT_SOURCE = 'ssap://tv/switchInput',
}

// Key codes for navigation
export const NavigationKeys = {
  UP: 38,
  DOWN: 40,
  LEFT: 37,
  RIGHT: 39,
  ENTER: 13,
} as const;

export interface TVCommand {
  type: TVCommandType;
  payload?: Record<string, unknown>;
}
