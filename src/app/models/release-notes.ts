export interface ReleaseNote {
  version: string;
  date: string;
  displayDate: string;
  text: string;
}

/** Add new releases at the beginning; navigation and the page show only the latest. */
export const RELEASE_NOTES: readonly ReleaseNote[] = [
  { version: '1.1.0', date: '2026-11-01', displayDate: '1 November 2026', text: 'Added gRNA group annotations and improved Curate updates and threshold restoration.' },
  { version: '1.0.0', date: '2026-10-27', displayDate: '27 October 2026', text: 'Initial public release.' },
];

export const LATEST_RELEASE = RELEASE_NOTES[0];
