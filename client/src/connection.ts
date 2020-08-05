export interface CommitData {
  v: number;
  steps: { [k: string]: unknown }[];
  ref?: string | null;
  ack?: never;
}

export interface SelectionData {
  v: number;
  head: number;
  anchor: number;
}

export interface SubscriptionParams {
  channel?: string;
  startingVersion?: number;
  [k: string]: unknown;
}
