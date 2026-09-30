/**
 * Pure Game Engine Barrel
 *
 * CRITICAL RULE:
 * This module and all submodules MUST be pure functions and data structures.
 * Under no circumstances may code here import React or reference DOM globals
 * (window, document, localStorage, performance, etc.) or read ambient time.
 */

export * from './typingTypes';
export * from './typingReducer';

export interface EngineVersionInfo {
  readonly name: string;
  readonly version: string;
  readonly pure: true;
}

export const ENGINE_INFO: EngineVersionInfo = {
  name: 'TypeFight Core Engine',
  version: '0.1.0',
  pure: true,
};
