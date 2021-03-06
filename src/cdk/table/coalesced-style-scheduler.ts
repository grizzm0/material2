/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {Injectable, NgZone, OnDestroy} from '@angular/core';
import {Subject} from 'rxjs';
import {take, takeUntil} from 'rxjs/operators';

/**
 * @docs-private
 */
export class _Schedule {
  tasks: (() => unknown)[] = [];
  endTasks: (() => unknown)[] = [];
}

/**
 * Allows grouping up CSSDom mutations after the current execution context.
 * This can significantly improve performance when separate consecutive functions are
 * reading from the CSSDom and then mutating it.
 *
 * @docs-private
 */
@Injectable()
export class _CoalescedStyleScheduler implements OnDestroy {
  private _currentSchedule: _Schedule|null = null;
  private readonly _destroyed = new Subject<void>();

  constructor(private readonly _ngZone: NgZone) {}

  /**
   * Schedules the specified task to run at the end of the current VM turn.
   */
  schedule(task: () => unknown): void {
    this._createScheduleIfNeeded();

    this._currentSchedule!.tasks.push(task);
  }

  /**
   * Schedules the specified task to run after other scheduled tasks at the end of the current
   * VM turn.
   */
  scheduleEnd(task: () => unknown): void {
    this._createScheduleIfNeeded();

    this._currentSchedule!.endTasks.push(task);
  }

  /** Prevent any further tasks from running. */
  ngOnDestroy() {
    this._destroyed.next();
    this._destroyed.complete();
  }

  private _createScheduleIfNeeded() {
    if (this._currentSchedule) { return; }

    this._currentSchedule = new _Schedule();

    this._ngZone.onStable.pipe(
        take(1),
        takeUntil(this._destroyed),
    ).subscribe(() => {
      const schedule = this._currentSchedule!;
      this._currentSchedule = null;

      for (const task of schedule.tasks) {
        task();
      }
      for (const task of schedule.endTasks) {
        task();
      }
    });
  }
}
