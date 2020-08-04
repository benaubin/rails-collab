export type CommitData = {
  v: number;
  steps: { [k: string]: unknown }[];
  ref?: string | null;
};

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
