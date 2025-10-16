export interface Publisher {
  publish(channel: string, event: string, payload: any): Promise<void>;
}
