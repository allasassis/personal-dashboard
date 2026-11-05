import type { ComponentType } from 'react';
import type { Route } from '../core/router';
import type { IconName } from '../core/ui';
import { bodyModule } from './body';
import { studiesModule } from './studies';

export interface Module {
  id: string;
  label: string;
  /** Entries in the navigation. */
  nav: { path: string; label: string; icon: IconName }[];
  routes: Route[];
  /** Optional strip shown above every page, e.g. a workout in progress. */
  Banner?: ComponentType;
}

// To add a module: create src/modules/<name>/index.tsx and list it here.
export const modules: Module[] = [bodyModule, studiesModule];
