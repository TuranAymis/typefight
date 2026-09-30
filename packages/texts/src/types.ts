/**
 * Content type definitions for TypeFight.io
 * Covering word lists, tiers, narrative passages, and enemy metadata.
 */

export interface WordListTierMetadata {
  readonly id: string;
  readonly name: string;
  readonly minLength: number;
  readonly maxLength: number;
}

export interface ContentManifest {
  readonly version: string;
  readonly tiers: readonly WordListTierMetadata[];
}
